#include <windows.h>
#include <iostream>
#include <string>
#include <memory>
#include <thread>
#include <chrono>
#include <atomic>
#include <algorithm>
#include <sstream>
#include <cmath>

#include "wgc_capture.h"
#include "nvenc_encoder.h"
#include "d3d11_scaler.h"
#include "process_loopback_audio.h"
#include "livekit/livekit.h"

std::atomic<bool> g_running(true);

BOOL WINAPI ConsoleCtrlHandler(DWORD dwCtrlType) {
    if (dwCtrlType == CTRL_C_EVENT || dwCtrlType == CTRL_CLOSE_EVENT || dwCtrlType == CTRL_BREAK_EVENT) {
        g_running = false;
        return TRUE;
    }
    return FALSE;
}

int main(int argc, char* argv[]) {
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCtrlHandler(ConsoleCtrlHandler, TRUE);

    // Conecta à estação de trabalho do usuário no Windows
    HWINSTA hWinSta = OpenWindowStationA("WinSta0", FALSE, MAXIMUM_ALLOWED);
    if (hWinSta) {
        SetProcessWindowStation(hWinSta);
        HDESK hDesk = OpenDesktopA("Default", 0, FALSE, MAXIMUM_ALLOWED);
        if (hDesk) {
            SetThreadDesktop(hDesk);
        }
    }

    // Eleva a prioridade do processo para garantir 60 FPS sem engasgos com o jogo
    SetPriorityClass(GetCurrentProcess(), ABOVE_NORMAL_PRIORITY_CLASS);

    std::string url;
    std::string token;
    uintptr_t hwndVal = 0;
    uint32_t reqWidth = 1280;
    uint32_t reqHeight = 720;
    uint32_t fps = 60;
    uint32_t bitrate = 8000000;
    bool captureProcessAudio = false;

    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--url" && i + 1 < argc) url = argv[++i];
        else if (arg == "--token" && i + 1 < argc) token = argv[++i];
        else if (arg == "--hwnd" && i + 1 < argc) hwndVal = std::stoull(argv[++i]);
        else if (arg == "--width" && i + 1 < argc) reqWidth = std::stoul(argv[++i]);
        else if (arg == "--height" && i + 1 < argc) reqHeight = std::stoul(argv[++i]);
        else if (arg == "--fps" && i + 1 < argc) fps = std::stoul(argv[++i]);
        else if (arg == "--bitrate" && i + 1 < argc) bitrate = std::stoul(argv[++i]);
        else if (arg == "--capture-process-audio") captureProcessAudio = true;
    }

    if (url.empty() || token.empty() || hwndVal == 0) {
        std::cerr << "Uso: voxy_native_streamer.exe --url <ws://...> --token <JWT> --hwnd <HWND> [--width 1280] [--height 720] [--fps 60] [--bitrate 8000000]" << std::endl;
        return 1;
    }

    HWND targetHwnd = reinterpret_cast<HWND>(hwndVal);
    if (!IsWindow(targetHwnd)) {
        std::cerr << "Erro: HWND invalido ou janela nao existe: " << hwndVal << std::endl;
        return 1;
    }
    DWORD targetProcessId = 0;
    GetWindowThreadProcessId(targetHwnd, &targetProcessId);

    // Detecta as dimensoes nativas da janela ou tela para manter aspect ratio
    RECT clientRect = {};
    GetClientRect(targetHwnd, &clientRect);
    uint32_t srcW = clientRect.right - clientRect.left;
    uint32_t srcH = clientRect.bottom - clientRect.top;

    if (srcW == 0 || srcH == 0) {
        RECT winRect = {};
        GetWindowRect(targetHwnd, &winRect);
        srcW = winRect.right - winRect.left;
        srcH = winRect.bottom - winRect.top;
    }
    if (srcW == 0 || srcH == 0) {
        srcW = reqWidth;
        srcH = reqHeight;
    }

    // Calcula dimensões de codificação mantendo a proporção nativa da janela (21:9 ultrawide, 16:9, etc)
    uint32_t targetHeight = reqHeight > 0 ? reqHeight : 720;
    double aspectRatio = static_cast<double>(srcW) / static_cast<double>(srcH);
    uint32_t targetWidth = static_cast<uint32_t>(std::round(targetHeight * aspectRatio));

    // Em 60 FPS, "1080p" ultrawide calculado apenas pela altura chegava a
    // 2592x1080: ~35% mais pixels que 1920x1080 e carga de macroblocos de
    // H.264 Level 5.1. Mantém a proporção, mas respeita o orçamento de pixels
    // do preset selecionado. O caminho estável de 30 FPS permanece inalterado.
    bool cappedForHighFps = false;
    if (fps > 30 && reqWidth > 0 && reqHeight > 0) {
        const uint64_t pixelBudget = static_cast<uint64_t>(reqWidth) * reqHeight;
        const uint64_t requestedPixels = static_cast<uint64_t>(targetWidth) * targetHeight;
        if (requestedPixels > pixelBudget) {
            targetHeight = static_cast<uint32_t>(std::floor(std::sqrt(pixelBudget / aspectRatio)));
            targetWidth = static_cast<uint32_t>(std::floor(targetHeight * aspectRatio));
            cappedForHighFps = true;
        }
    }

    // Para o modo limitado, arredonda para baixo para não ultrapassar o
    // orçamento. Nos demais casos preserva o comportamento anterior.
    targetWidth = cappedForHighFps
        ? (std::max)(16u, targetWidth & ~15u)
        : (targetWidth + 15) & ~15u;
    targetHeight = cappedForHighFps
        ? (std::max)(2u, targetHeight & ~1u)
        : (targetHeight + 1) & ~1u;

    std::cout << "[Voxy Native Streamer] Janela de origem: " << srcW << "x" << srcH 
              << " (Aspect Ratio: " << aspectRatio << ")" << std::endl;
    std::cout << "[Voxy Native Streamer] Resolução de saída GPU: " << targetWidth << "x" << targetHeight 
              << " @ " << fps << " FPS (" << (bitrate / 1000000.0) << " Mbps)" << std::endl;
    if (cappedForHighFps) {
        std::cout << "[Voxy Native Streamer] Resolução ultrawide limitada ao orçamento de pixels do preset para 60 FPS." << std::endl;
    }

    // 1. Inicializa o LiveKit C++ SDK
    livekit::initialize(livekit::LogLevel::Warn);

    auto room = std::make_shared<livekit::Room>();
    livekit::RoomOptions roomOptions;
    roomOptions.auto_subscribe = false;
    roomOptions.dynacast = false;

    std::cout << "[Voxy Native Streamer] Conectando a sala LiveKit: " << url << std::endl;
    bool connected = room->connect(url, token, roomOptions);
    if (!connected) {
        std::cerr << "[Voxy Native Streamer] Falha fatal ao conectar na sala LiveKit!" << std::endl;
        livekit::shutdown();
        return 1;
    }

    std::cout << "[Voxy Native Streamer] Conectado com sucesso na sala LiveKit!" << std::endl;

    // 2. Cria a fonte de video pre-codificada H.264 com a resolucao calculada
    auto encodedSource = std::make_shared<livekit::EncodedVideoSource>(livekit::VideoCodec::H264, targetWidth, targetHeight);

    // 3. Cria a track local e publica no LiveKit com opcoes explicitas de bitrate e framerate
    auto localPart = room->localParticipant().lock();
    if (!localPart) {
        std::cerr << "[Voxy Native Streamer] LocalParticipant nao disponivel!" << std::endl;
        room->disconnect();
        livekit::shutdown();
        return 1;
    }

    auto localTrack = livekit::LocalVideoTrack::createLocalVideoTrack("screen_share", encodedSource);
    if (!localTrack) {
        std::cerr << "[Voxy Native Streamer] Falha ao criar LocalVideoTrack!" << std::endl;
        room->disconnect();
        livekit::shutdown();
        return 1;
    }

    livekit::TrackPublishOptions pubOptions;
    pubOptions.source = livekit::TrackSource::SOURCE_SCREENSHARE;
    pubOptions.video_codec = livekit::VideoCodec::H264;
    pubOptions.video_encoder = livekit::VideoEncoderBackend::PreEncoded;
    pubOptions.simulcast = false;
    pubOptions.degradation_preference = livekit::DegradationPreference::MaintainFramerate;

    livekit::VideoEncodingOptions encOptions;
    // O teto publicado precisa ser o mesmo teto do NVENC; caso contrario o
    // congestion controller pode aceitar uma rajada que o transporte descarta.
    encOptions.max_bitrate = bitrate;
    encOptions.max_framerate = static_cast<double>(fps);
    pubOptions.video_encoding = encOptions;

    std::cout << "[Voxy Native Streamer] Publicando track de tela no LiveKit (Max Bitrate: " 
              << (bitrate / 1000000.0) << " Mbps | Max FPS: " << fps << ")..." << std::endl;
    localPart->publishTrack(localTrack, pubOptions);
    std::cout << "[Voxy Native Streamer] Track publicada com sucesso: " << localTrack->name() << std::endl;

    std::shared_ptr<livekit::AudioSource> processAudioSource;
    std::shared_ptr<livekit::LocalAudioTrack> processAudioTrack;
    ProcessLoopbackAudio processAudioCapture;
    if (captureProcessAudio && targetProcessId) {
        processAudioSource = std::make_shared<livekit::AudioSource>(48000, 2, 0);
        processAudioTrack = livekit::LocalAudioTrack::createLocalAudioTrack("screen_audio", processAudioSource);
        if (processAudioTrack) {
            livekit::TrackPublishOptions audioOptions;
            audioOptions.source = livekit::TrackSource::SOURCE_SCREENSHARE_AUDIO;
            livekit::AudioEncodingOptions audioEncoding;
            audioEncoding.max_bitrate = 128000;
            audioOptions.audio_encoding = audioEncoding;
            localPart->publishTrack(processAudioTrack, audioOptions);

            if (processAudioCapture.Start(targetProcessId,
                [processAudioSource](const int16_t* samples, uint32_t frames) {
                    try {
                        std::vector<int16_t> pcm(samples, samples + static_cast<size_t>(frames) * 2);
                        processAudioSource->captureFrame(livekit::AudioFrame(std::move(pcm), 48000, 2, frames));
                    } catch (const std::exception& err) {
                        std::cerr << "[Voxy Process Audio] Falha ao enviar frame: " << err.what() << std::endl;
                    }
                })) {
                std::cout << "[Voxy Process Audio] Capturando somente o PID " << targetProcessId
                          << " e seus processos-filhos." << std::endl;
            } else {
                std::cerr << "[Voxy Process Audio] Áudio do jogo indisponível; transmissão seguirá sem áudio." << std::endl;
            }
        }
    }

    // 4. Inicializa o WGCCaptureEngine, D3D11Scaler e o NVENCEncoder no mesmo ID3D11Device
    WGCCaptureEngine captureEngine;
    if (!captureEngine.InitializeD3D()) {
        std::cerr << "[Voxy Native Streamer] Falha ao inicializar Direct3D 11 na GPU!" << std::endl;
        room->disconnect();
        livekit::shutdown();
        return 1;
    }

    ID3D11Device* d3dDevice = captureEngine.GetDevice();

    D3D11Scaler scaler;
    if (!scaler.Initialize(d3dDevice)) {
        std::cerr << "[Voxy Native Streamer] Falha ao inicializar D3D11Scaler na GPU!" << std::endl;
        room->disconnect();
        livekit::shutdown();
        return 1;
    }

    std::atomic<uint64_t> frameCount(0);
    std::atomic<uint64_t> livekitRejectedFrames(0);

    NVENCEncoder encoder;
    if (!encoder.Initialize(
        d3dDevice,
        targetWidth,
        targetHeight,
        fps,
        bitrate,
        [encodedSource, targetWidth, targetHeight, &frameCount, &livekitRejectedFrames](NVENCEncoder::EncodedFrame&& encoded) {
            livekit::EncodedVideoSource::Frame lkFrame;
            lkFrame.is_keyframe = encoded.isKeyframe;
            lkFrame.width = targetWidth;
            lkFrame.height = targetHeight;
            lkFrame.timestamp_us = encoded.timestampUs;
            lkFrame.data = std::move(encoded.data);

            if (encodedSource->captureFrame(lkFrame)) {
                ++frameCount;
            } else {
                ++livekitRejectedFrames;
            }
        })) {
        std::cerr << "[Voxy Native Streamer] Falha ao inicializar NVENC Hardware Encoder!" << std::endl;
        scaler.Shutdown();
        room->disconnect();
        livekit::shutdown();
        return 1;
    }

    // 5. Inicia a captura WGC direta na GPU com limitador de framerate de alta precisao
    const auto targetFrameInterval = std::chrono::nanoseconds(1000000000ULL / fps);
    const auto pacingTolerance = std::chrono::microseconds(500);
    auto nextFrameDeadline = std::chrono::steady_clock::time_point{};
    bool pacingStarted = false;
    int64_t lastCaptureTimestampUs = 0;
    uint32_t activeEncoderBitrate = bitrate;
    uint32_t desiredEncoderBitrate = bitrate;

    bool started = captureEngine.StartCapture(targetHwnd, [&](ID3D11Texture2D* texture, uint32_t w, uint32_t h) {
        if (!g_running.load()) return;

        // Pacing de quadros: quando o jogo roda a taxas altas (ex: 149 FPS no jogo),
        // descarta quadros intermediarios redundantes para manter o envio exatamente estavel a 60 / 30 FPS
        const auto now = std::chrono::steady_clock::now();
        if (!pacingStarted) {
            nextFrameDeadline = now;
            pacingStarted = true;
        }
        if (now + pacingTolerance < nextFrameDeadline) {
            return;
        }
        if (now > nextFrameDeadline + targetFrameInterval) {
            nextFrameDeadline = now + targetFrameInterval;
        } else {
            nextFrameDeadline += targetFrameInterval;
        }

        // steady_clock não salta quando o relógio do sistema é ajustado.
        int64_t captureTimestampUs = std::chrono::duration_cast<std::chrono::microseconds>(
            now.time_since_epoch()).count();
        captureTimestampUs = (std::max)(captureTimestampUs, lastCaptureTimestampUs + 1);
        lastCaptureTimestampUs = captureTimestampUs;

        // Redimensiona a textura capturada na GPU preservando tela cheia (sem cortes)
        ID3D11Texture2D* scaledTexture = scaler.Scale(texture, targetWidth, targetHeight);
        if (!scaledTexture) return;

        // Feedback de keyframe do LiveKit quando outros participantes entram na sala
        auto feedback = encodedSource->takeFeedback();
        bool forceKeyframe = feedback.keyframe_requested;
        if (feedback.rate_control.has_value()) {
            static uint64_t lastLoggedBps = 0;
            if (feedback.rate_control->target_bitrate_bps != lastLoggedBps) {
                lastLoggedBps = feedback.rate_control->target_bitrate_bps;
                std::cout << "[Voxy Native Streamer] Feedback LiveKit RateControl: "
                          << (feedback.rate_control->target_bitrate_bps / 1000000.0) << " Mbps | "
                          << feedback.rate_control->framerate_fps << " FPS" << std::endl;
            }

            // Em modo PreEncoded, o LiveKit apenas informa o alvo: e' a
            // aplicacao que deve reconfigurar o codificador externo.
            const uint64_t requestedBps = feedback.rate_control->target_bitrate_bps;
            const uint32_t targetBps = static_cast<uint32_t>(std::min<uint64_t>(requestedBps, bitrate));
            if (targetBps > 0) desiredEncoderBitrate = targetBps;
        }
        // Se o driver estiver momentaneamente ocupado, a meta permanece e a
        // reconfiguração será tentada novamente no próximo frame.
        if (desiredEncoderBitrate != activeEncoderBitrate &&
            encoder.Reconfigure(desiredEncoderBitrate, fps)) {
            activeEncoderBitrate = desiredEncoderBitrate;
            std::cout << "[Voxy Native Streamer] NVENC reconfigurado para "
                      << (activeEncoderBitrate / 1000000.0) << " Mbps" << std::endl;
        }

        // Retorna imediatamente após a submissão. LockBitstream e LiveKit rodam
        // em uma única thread de saída, na ordem de submissão.
        encoder.SubmitTexture(scaledTexture, forceKeyframe, captureTimestampUs);
    });

    if (!started) {
        std::cerr << "[Voxy Native Streamer] Falha ao iniciar captura WGC para o HWND especificado!" << std::endl;
        encoder.Shutdown();
        scaler.Shutdown();
        room->disconnect();
        livekit::shutdown();
        return 1;
    }

    std::cout << "[Voxy Native Streamer] PIPELINE GPU DIRECT TOTALMENTE ATIVO!" << std::endl;

    // 6. Loop de controle pelo stdin (permite que o Electron envie "stop" ou encerre)
    std::thread inputThread([&]() {
        std::string line;
        while (g_running.load() && std::getline(std::cin, line)) {
            while (!line.empty() && (line.back() == '\r' || line.back() == '\n' || line.back() == ' ')) {
                line.pop_back();
            }
            if (line == "stop" || line == "quit" || line == "exit") {
                std::cout << "[Voxy Native Streamer] Comando de parada recebido via stdin." << std::endl;
                g_running = false;
                break;
            }
        }
    });

    std::cout << "[Voxy Native Streamer] Transmitindo frames pela GPU com redimensionamento bilinear..." << std::endl;

    while (g_running.load()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
        // Checa se a janela ainda existe
        if (!IsWindow(targetHwnd)) {
            std::cout << "[Voxy Native Streamer] Janela do jogo foi fechada pelo usuario." << std::endl;
            g_running = false;
            break;
        }
    }

    std::cout << "[Voxy Native Streamer] Finalizando pipeline nativo..." << std::endl;

    captureEngine.StopCapture();
    processAudioCapture.Stop();
    encoder.Shutdown();
    std::cout << "[Voxy Native Streamer] Frames descartados por backpressure: "
              << encoder.DroppedFrames() << " | recusados pelo LiveKit: "
              << livekitRejectedFrames.load() << std::endl;
    scaler.Shutdown();

    if (inputThread.joinable()) {
        inputThread.detach();
    }

    try {
        room->disconnect();
    } catch (...) {}

    livekit::shutdown();
    std::cout << "[Voxy Native Streamer] Finalizado com sucesso. Ate logo!" << std::endl;
    return 0;
}
