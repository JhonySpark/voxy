#include "wgc_capture.h"
#include <iostream>
#include <thread>
#include <chrono>

int main(int argc, char* argv[]) {
    std::cout << "===========================================" << std::endl;
    std::cout << " Voxy Native WGC Capture Test Engine (C++) " << std::endl;
    std::cout << "===========================================" << std::endl;

    // Conecta à estação de trabalho do usuário
    HWINSTA hWinSta = OpenWindowStationA("WinSta0", FALSE, MAXIMUM_ALLOWED);
    if (hWinSta) {
        SetProcessWindowStation(hWinSta);
        HDESK hDesk = OpenDesktopA("Default", 0, FALSE, MAXIMUM_ALLOWED);
        if (hDesk) {
            SetThreadDesktop(hDesk);
        }
    }

    if (argc < 2) {
        std::cout << "Uso: voxy_wgc_capture.exe <HWND_EM_DECIMAL>" << std::endl;
        std::cout << "Dica: Execute voxy_game_detector.exe para listar os HWNDs ativos." << std::endl;
        return 1;
    }

    uintptr_t hwndVal = std::stoull(argv[1]);
    HWND targetHwnd = reinterpret_cast<HWND>(hwndVal);

    if (!IsWindow(targetHwnd)) {
        std::cerr << "Erro: HWND invalido ou janela nao encontrada." << std::endl;
        return 1;
    }

    WGCCaptureEngine engine;
    uint64_t frameCount = 0;
    auto startTime = std::chrono::high_resolution_clock::now();

    bool started = engine.StartCapture(targetHwnd, [&](ID3D11Texture2D* texture, uint32_t width, uint32_t height) {
        frameCount++;
        if (frameCount % 60 == 0) {
            auto now = std::chrono::high_resolution_clock::now();
            double seconds = std::chrono::duration<double>(now - startTime).count();
            double fps = frameCount / seconds;
            std::cout << "[Voxy Native WGC] GPU Frame #" << frameCount 
                      << " | Resolucao: " << width << "x" << height 
                      << " | Taxa Real: " << fps << " FPS (Zero-Copy GPU Direct)" << std::endl;
        }
    });

    if (!started) {
        std::cerr << "Falha ao iniciar a captura WGC." << std::endl;
        return 1;
    }

    std::cout << "Capturando por 5 segundos para teste de performance..." << std::endl;
    std::this_thread::sleep_for(std::chrono::seconds(5));

    engine.StopCapture();
    std::cout << "Teste concluido. Total de frames capturados: " << frameCount << std::endl;

    return 0;
}
