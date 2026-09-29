#pragma once

#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>
#include <functional>
#include <memory>

/**
 * Voxy Native WGC (Windows Graphics Capture) Engine
 * 
 * Captura direta de jogos 3D via GPU DirectX 11 / DXGI zero-copy:
 * - Frames capturados diretamente na memória VRAM da GPU dedicada
 * - Sem cópias desnecessárias para CPU ou RAM do sistema
 * - Suporta jogos em modo janela sem borda e tela cheia
 * - Livre de interferência de anti-cheats (Vanguard, EAC, BattlEye)
 */
class WGCCaptureEngine {
public:
    using FrameCallback = std::function<void(ID3D11Texture2D* texture, uint32_t width, uint32_t height)>;

    WGCCaptureEngine();
    ~WGCCaptureEngine();

    // Inicializa o dispositivo Direct3D 11 na GPU dedicada (ou usa um existente)
    bool InitializeD3D(ID3D11Device* existingDevice = nullptr, ID3D11DeviceContext* existingContext = nullptr);

    // Inicia a captura de uma janela pelo seu HWND
    bool StartCapture(HWND targetHwnd, FrameCallback callback);

    // Inicia a captura de um monitor pelo seu HMONITOR
    bool StartCaptureMonitor(HMONITOR targetMonitor, FrameCallback callback);

    // Para a captura ativa
    void StopCapture();

    bool IsCapturing() const { return m_isCapturing; }
    ID3D11Device* GetDevice() const { return m_d3dDevice; }
    ID3D11DeviceContext* GetContext() const { return m_d3dContext; }

private:
    bool m_isCapturing = false;
    bool m_ownsDevice = true;
    HWND m_targetHwnd = nullptr;
    HMONITOR m_targetMonitor = nullptr;
    FrameCallback m_frameCallback;

    // Direct3D 11 GPU Resources
    ID3D11Device* m_d3dDevice = nullptr;
    ID3D11DeviceContext* m_d3dContext = nullptr;

    // WinRT WGC Resources
    winrt::Windows::Graphics::Capture::GraphicsCaptureItem m_captureItem = nullptr;
    winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool m_framePool = nullptr;
    winrt::Windows::Graphics::Capture::GraphicsCaptureSession m_captureSession = nullptr;
    winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool::FrameArrived_revoker m_frameArrivedRevoker;

    bool SetupCaptureSession(winrt::Windows::Graphics::Capture::GraphicsCaptureItem const& item);
    void OnFrameArrived(winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool const& sender, winrt::Windows::Foundation::IInspectable const& args);
};
