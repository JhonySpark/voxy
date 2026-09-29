#pragma once

#include <windows.h>
#include <d3d11.h>
#include <d3dcompiler.h>
#include <wrl/client.h>
#include <cstdint>

class D3D11Scaler {
public:
    D3D11Scaler();
    ~D3D11Scaler();

    bool Initialize(ID3D11Device* device);
    ID3D11Texture2D* Scale(ID3D11Texture2D* inputTexture, uint32_t targetWidth, uint32_t targetHeight);
    void Shutdown();

private:
    Microsoft::WRL::ComPtr<ID3D11Device> m_device;
    Microsoft::WRL::ComPtr<ID3D11DeviceContext> m_context;
    Microsoft::WRL::ComPtr<ID3D11VertexShader> m_vs;
    Microsoft::WRL::ComPtr<ID3D11PixelShader> m_ps;
    Microsoft::WRL::ComPtr<ID3D11SamplerState> m_sampler;

    // Cache do alvo de renderização
    uint32_t m_currentWidth = 0;
    uint32_t m_currentHeight = 0;
    Microsoft::WRL::ComPtr<ID3D11Texture2D> m_outputTexture;
    Microsoft::WRL::ComPtr<ID3D11RenderTargetView> m_rtv;

    // Cache dos SRVs da textura de entrada (WGC usa Direct3D11CaptureFramePool com 3-4 buffers)
    ID3D11Texture2D* m_slotTex[4] = {nullptr, nullptr, nullptr, nullptr};
    Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> m_slotSRV[4];

    bool m_initialized = false;
};
