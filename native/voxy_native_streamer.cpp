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

// Uma transmissão interrompida não deve retomar sozinha após o SDK reconectar.
// A UI passa a exigir que o emissor escolha "Transmitir" outra vez, criando uma
// nova publicação explícita e evitando espectadores reinscritos por engano.
class StreamLifecycleDelegate final : public livekit::RoomDelegate {
public:
    void onReconnecting(livekit::Room&, const livekit::ReconnectingEvent&) override {
        std::cerr << "[Voxy Native Streamer] Conexão interrompida; encerrando transmissão. Inicie novamente para retomar." << std::endl;
        g_running = false;
    }

    void onDisconnected(livekit::Room&, const livekit::DisconnectedEvent&) override {
        g_running = false;
    }
};

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

    // Alinhamento para múltiplos de 16 (macroblocos H.264 e NVENC)
    targetWidth = (targetWidth + 15) & ~15;
    targetHeight = (targetHeight + 1) & ~1;

    std::cout << "[Voxy Native Streamer] Janela de origem: " << srcW << "x" << srcH 
              << " (Aspect Ratio: " << aspectRatio << ")" << std::endl;
    std::cout << "[Voxy Native Streamer] Resolução de saída GPU: " << targetWidth << "x" << targetHeight 
              << " @ " << fps << " FPS (" << (bitrate / 1000000.0) << " Mbps)" << std::endl;

    // 1. Inicializa o LiveKit C++ SDK
    livekit::initialize(livekit::LogLevel::Warn);

    auto room = std::make_shared<livekit::Room>();
    StreamLifecycleDelegate roomDelegate;
    room->setDelegate(&roomDelegate);
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

    NVENCEncoder encoder;
    if (!encoder.Initialize(d3dDevice, targetWidth, targetHeight, fps, bitrate)) {
        std::cerr << "[Voxy Native Streamer] Falha ao inicializar NVENC Hardware Encoder!" << std::endl;
        scaler.Shutdown();
        room->disconnect();
        livekit::shutdown();
        return 1;
    }

    // 5. Inicia a captura WGC direta na GPU com limitador de framerate de alta precisao
    std::atomic<uint64_t> frameCount(0);

    const int64_t targetFrameIntervalUs = 1000000 / fps;
    const int64_t minFrameIntervalUs = static_cast<int64_t>(targetFrameIntervalUs * 0.85);
    auto lastFrameTime = std::chrono::steady_clock::now();
    uint32_t activeEncoderBitrate = bitrate;

    bool started = captureEngine.StartCapture(targetHwnd, [&](ID3D11Texture2D* texture, uint32_t w, uint32_t h) {
        if (!g_running.load()) return;

        // Pacing de quadros: quando o jogo roda a taxas altas (ex: 149 FPS no jogo),
        // descarta quadros intermediarios redundantes para manter o envio exatamente estavel a 60 / 30 FPS
        auto now = std::chrono::steady_clock::now();
        int64_t elapsedUs = std::chrono::duration_cast<std::chrono::microseconds>(now - lastFrameTime).count();
        if (frameCount.load() > 0 && elapsedUs < minFrameIntervalUs) {
            return;
        }
        lastFrameTime = now;
        const auto captureTime = std::chrono::system_clock::now();

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
            if (targetBps > 0 && targetBps != activeEncoderBitrate && encoder.Reconfigure(targetBps, fps)) {
                activeEncoderBitrate = targetBps;
                std::cout << "[Voxy Native Streamer] NVENC reconfigurado para "
                          << (targetBps / 1000000.0) << " Mbps" << std::endl;
            }
        }

        std::vector<uint8_t> bitstream;
        bool isKeyframe = false;

        if (encoder.EncodeTexture(scaledTexture, forceKeyframe, bitstream, isKeyframe)) {
            // O timestamp deve representar a captura real. Com 54 FPS reais,
            // anunciar uma sequencia artificial de 60 FPS faz o receptor tratar
            // frames atrasados como descartaveis.
            const int64_t captureTimestampUs = std::chrono::duration_cast<std::chrono::microseconds>(
                captureTime.time_since_epoch()).count();

            livekit::EncodedVideoSource::Frame lkFrame;
            lkFrame.is_keyframe = isKeyframe;
            lkFrame.width = targetWidth;
            lkFrame.height = targetHeight;
            lkFrame.timestamp_us = captureTimestampUs;
            lkFrame.data = std::move(bitstream);

            if (!encodedSource->captureFrame(lkFrame)) {
                std::cerr << "[Voxy Native Streamer] LiveKit recusou access unit de "
                          << lkFrame.data.size() << " bytes" << std::endl;
                return;
            }

            frameCount++;
        }
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
