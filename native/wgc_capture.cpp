#include "wgc_capture.h"
#include <iostream>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "windowsapp.lib")

WGCCaptureEngine::WGCCaptureEngine() {
    winrt::init_apartment(winrt::apartment_type::multi_threaded);
}

WGCCaptureEngine::~WGCCaptureEngine() {
    StopCapture();
    if (m_ownsDevice) {
        if (m_d3dContext) {
            m_d3dContext->Release();
            m_d3dContext = nullptr;
        }
        if (m_d3dDevice) {
            m_d3dDevice->Release();
            m_d3dDevice = nullptr;
        }
    }
}

bool WGCCaptureEngine::InitializeD3D(ID3D11Device* existingDevice, ID3D11DeviceContext* existingContext) {
    if (existingDevice) {
        m_d3dDevice = existingDevice;
        m_d3dContext = existingContext;
        m_ownsDevice = false;
        return true;
    }

    UINT creationFlags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
#if defined(_DEBUG)
    creationFlags |= D3D11_CREATE_DEVICE_DEBUG;
#endif

    D3D_FEATURE_LEVEL featureLevels[] = {
        D3D_FEATURE_LEVEL_11_1,
        D3D_FEATURE_LEVEL_11_0,
        D3D_FEATURE_LEVEL_10_1,
        D3D_FEATURE_LEVEL_10_0
    };
    D3D_FEATURE_LEVEL featureLevel;

    HRESULT hr = D3D11CreateDevice(
        nullptr,
        D3D_DRIVER_TYPE_HARDWARE,
        nullptr,
        creationFlags,
        featureLevels,
        ARRAYSIZE(featureLevels),
        D3D11_SDK_VERSION,
        &m_d3dDevice,
        &featureLevel,
        &m_d3dContext
    );

    if (FAILED(hr)) {
        std::cerr << "[Voxy Native WGC] Erro ao criar ID3D11Device: " << std::hex << hr << std::endl;
        return false;
    }

    m_ownsDevice = true;
    return true;
}

bool WGCCaptureEngine::SetupCaptureSession(winrt::Windows::Graphics::Capture::GraphicsCaptureItem const& item) {
    if (!item) return false;
    m_captureItem = item;

    try {
        winrt::com_ptr<IDXGIDevice> dxgiDevice;
        m_d3dDevice->QueryInterface(IID_PPV_ARGS(&dxgiDevice));

        winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice winrtDevice = nullptr;
        HRESULT hr = CreateDirect3D11DeviceFromDXGIDevice(dxgiDevice.get(), reinterpret_cast<IInspectable**>(winrt::put_abi(winrtDevice)));
        if (FAILED(hr) || !winrtDevice) {
            std::cerr << "[Voxy Native WGC] Falha ao converter IDXGIDevice para WinRT IDirect3DDevice" << std::endl;
            return false;
        }

        auto itemSize = m_captureItem.Size();
        m_framePool = winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool::CreateFreeThreaded(
            winrtDevice,
            winrt::Windows::Graphics::DirectX::DirectXPixelFormat::B8G8R8A8UIntNormalized,
            3,
            itemSize
        );

        m_frameArrivedRevoker = m_framePool.FrameArrived(
            winrt::auto_revoke,
            { this, &WGCCaptureEngine::OnFrameArrived }
        );

        m_captureSession = m_framePool.CreateCaptureSession(m_captureItem);
        
        try {
            m_captureSession.IsBorderRequired(false);
            m_captureSession.IsCursorCaptureEnabled(true);
        } catch (...) {}

        m_captureSession.StartCapture();
        m_isCapturing = true;
        std::cout << "[Voxy Native WGC] Captura iniciada com sucesso na GPU! Resolucao nativa: "
                  << itemSize.Width << "x" << itemSize.Height << std::endl;
        return true;
    } catch (const winrt::hresult_error& ex) {
        std::wcerr << L"[Voxy Native WGC] Excecao WinRT: " << ex.message().c_str() << std::endl;
        return false;
    }
}

bool WGCCaptureEngine::StartCapture(HWND targetHwnd, FrameCallback callback) {
    if (!m_d3dDevice) {
        if (!InitializeD3D()) return false;
    }

    m_targetHwnd = targetHwnd;
    m_frameCallback = callback;

    try {
        auto interopFactory = winrt::get_activation_factory<winrt::Windows::Graphics::Capture::GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
        winrt::Windows::Graphics::Capture::GraphicsCaptureItem item = nullptr;
        HRESULT hr = interopFactory->CreateForWindow(
            m_targetHwnd,
            winrt::guid_of<winrt::Windows::Graphics::Capture::GraphicsCaptureItem>(),
            winrt::put_abi(item)
        );

        if (FAILED(hr) || !item) {
            std::cerr << "[Voxy Native WGC] Falha ao criar GraphicsCaptureItem para HWND" << std::endl;
            return false;
        }

        return SetupCaptureSession(item);
    } catch (const winrt::hresult_error& ex) {
        std::wcerr << L"[Voxy Native WGC] Excecao WinRT: " << ex.message().c_str() << std::endl;
        return false;
    }
}

bool WGCCaptureEngine::StartCaptureMonitor(HMONITOR targetMonitor, FrameCallback callback) {
    if (!m_d3dDevice) {
        if (!InitializeD3D()) return false;
    }

    m_targetMonitor = targetMonitor;
    m_frameCallback = callback;

    try {
        auto interopFactory = winrt::get_activation_factory<winrt::Windows::Graphics::Capture::GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
        winrt::Windows::Graphics::Capture::GraphicsCaptureItem item = nullptr;
        HRESULT hr = interopFactory->CreateForMonitor(
            m_targetMonitor,
            winrt::guid_of<winrt::Windows::Graphics::Capture::GraphicsCaptureItem>(),
            winrt::put_abi(item)
        );

        if (FAILED(hr) || !item) {
            std::cerr << "[Voxy Native WGC] Falha ao criar GraphicsCaptureItem para Monitor" << std::endl;
            return false;
        }

        return SetupCaptureSession(item);
    } catch (const winrt::hresult_error& ex) {
        std::wcerr << L"[Voxy Native WGC] Excecao WinRT: " << ex.message().c_str() << std::endl;
        return false;
    }
}

void WGCCaptureEngine::OnFrameArrived(
    winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool const& sender,
    winrt::Windows::Foundation::IInspectable const&
) {
    if (!m_isCapturing) return;

    auto frame = sender.TryGetNextFrame();
    if (!frame) return;

    auto frameSurface = frame.Surface();
    auto surfaceAccess = frameSurface.as<Windows::Graphics::DirectX::Direct3D11::IDirect3DDxgiInterfaceAccess>();

    winrt::com_ptr<ID3D11Texture2D> surfaceTexture;
    HRESULT hr = surfaceAccess->GetInterface(IID_PPV_ARGS(&surfaceTexture));

    if (SUCCEEDED(hr) && surfaceTexture && m_frameCallback) {
        D3D11_TEXTURE2D_DESC desc;
        surfaceTexture->GetDesc(&desc);
        m_frameCallback(surfaceTexture.get(), desc.Width, desc.Height);
    }
}

void WGCCaptureEngine::StopCapture() {
    if (!m_isCapturing) return;

    m_isCapturing = false;
    m_frameArrivedRevoker.revoke();

    if (m_captureSession) {
        try { m_captureSession.Close(); } catch (...) {}
        m_captureSession = nullptr;
    }

    if (m_framePool) {
        try { m_framePool.Close(); } catch (...) {}
        m_framePool = nullptr;
    }

    m_captureItem = nullptr;
    m_frameCallback = nullptr;
    std::cout << "[Voxy Native WGC] Captura finalizada com sucesso." << std::endl;
}
