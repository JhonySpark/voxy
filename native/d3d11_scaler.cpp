#include "d3d11_scaler.h"
#include <iostream>

#pragma comment(lib, "d3dcompiler.lib")

static const char* g_scalerHlsl = R"(
struct VS_OUTPUT {
    float4 Pos : SV_POSITION;
    float2 Tex : TEXCOORD0;
};

VS_OUTPUT VS(uint id : SV_VertexID) {
    VS_OUTPUT output;
    output.Tex = float2((id << 1) & 2, id & 2);
    output.Pos = float4(output.Tex * float2(2.0f, -2.0f) + float2(-1.0f, 1.0f), 0.0f, 1.0f);
    return output;
}

Texture2D tx : register(t0);
SamplerState samLinear : register(s0);

float4 PS(VS_OUTPUT input) : SV_Target {
    return tx.Sample(samLinear, input.Tex);
}
)";

D3D11Scaler::D3D11Scaler() {}

D3D11Scaler::~D3D11Scaler() {
    Shutdown();
}

bool D3D11Scaler::Initialize(ID3D11Device* device) {
    if (!device) return false;
    m_device = device;
    m_device->GetImmediateContext(&m_context);

    // Compila o Vertex Shader (Fullscreen triangle sem vertex buffer)
    Microsoft::WRL::ComPtr<ID3DBlob> vsBlob;
    Microsoft::WRL::ComPtr<ID3DBlob> errorBlob;
    HRESULT hr = D3DCompile(
        g_scalerHlsl,
        strlen(g_scalerHlsl),
        "scaler_hlsl",
        nullptr,
        nullptr,
        "VS",
        "vs_4_0",
        0,
        0,
        &vsBlob,
        &errorBlob
    );

    if (FAILED(hr)) {
        if (errorBlob) {
            std::cerr << "[D3D11Scaler] Erro ao compilar Vertex Shader: " 
                      << (char*)errorBlob->GetBufferPointer() << std::endl;
        }
        return false;
    }

    hr = m_device->CreateVertexShader(vsBlob->GetBufferPointer(), vsBlob->GetBufferSize(), nullptr, &m_vs);
    if (FAILED(hr)) {
        std::cerr << "[D3D11Scaler] Falha ao criar Vertex Shader: " << std::hex << hr << std::endl;
        return false;
    }

    // Compila o Pixel Shader (Amostragem bilinear com Texture2D)
    Microsoft::WRL::ComPtr<ID3DBlob> psBlob;
    errorBlob.Reset();
    hr = D3DCompile(
        g_scalerHlsl,
        strlen(g_scalerHlsl),
        "scaler_hlsl",
        nullptr,
        nullptr,
        "PS",
        "ps_4_0",
        0,
        0,
        &psBlob,
        &errorBlob
    );

    if (FAILED(hr)) {
        if (errorBlob) {
            std::cerr << "[D3D11Scaler] Erro ao compilar Pixel Shader: " 
                      << (char*)errorBlob->GetBufferPointer() << std::endl;
        }
        return false;
    }

    hr = m_device->CreatePixelShader(psBlob->GetBufferPointer(), psBlob->GetBufferSize(), nullptr, &m_ps);
    if (FAILED(hr)) {
        std::cerr << "[D3D11Scaler] Falha ao criar Pixel Shader: " << std::hex << hr << std::endl;
        return false;
    }

    // Cria o Sampler Linear com Clamp
    D3D11_SAMPLER_DESC sampDesc = {};
    sampDesc.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
    sampDesc.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampDesc.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampDesc.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampDesc.ComparisonFunc = D3D11_COMPARISON_NEVER;
    sampDesc.MinLOD = 0;
    sampDesc.MaxLOD = D3D11_FLOAT32_MAX;

    hr = m_device->CreateSamplerState(&sampDesc, &m_sampler);
    if (FAILED(hr)) {
        std::cerr << "[D3D11Scaler] Falha ao criar SamplerState: " << std::hex << hr << std::endl;
        return false;
    }

    m_initialized = true;
    std::cout << "[D3D11Scaler] Inicializado com sucesso na GPU (HLSL Direct3D 11 Bilinear Downscaler)!" << std::endl;
    return true;
}

ID3D11Texture2D* D3D11Scaler::Scale(ID3D11Texture2D* inputTexture, uint32_t targetWidth, uint32_t targetHeight) {
    if (!m_initialized || !inputTexture || targetWidth == 0 || targetHeight == 0) {
        return nullptr;
    }

    // Se o tamanho de destino mudou ou a textura de saída ainda não foi alocada
    if (m_currentWidth != targetWidth || m_currentHeight != targetHeight || !m_outputTexture) {
        m_outputTexture.Reset();
        m_rtv.Reset();

        D3D11_TEXTURE2D_DESC desc = {};
        desc.Width = targetWidth;
        desc.Height = targetHeight;
        desc.MipLevels = 1;
        desc.ArraySize = 1;
        desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        desc.SampleDesc.Count = 1;
        desc.SampleDesc.Quality = 0;
        desc.Usage = D3D11_USAGE_DEFAULT;
        desc.BindFlags = D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE;
        desc.CPUAccessFlags = 0;
        desc.MiscFlags = 0;

        HRESULT hr = m_device->CreateTexture2D(&desc, nullptr, &m_outputTexture);
        if (FAILED(hr)) {
            std::cerr << "[D3D11Scaler] Falha ao criar output texture (" << targetWidth << "x" << targetHeight << "): " << std::hex << hr << std::endl;
            return nullptr;
        }

        hr = m_device->CreateRenderTargetView(m_outputTexture.Get(), nullptr, &m_rtv);
        if (FAILED(hr)) {
            std::cerr << "[D3D11Scaler] Falha ao criar RenderTargetView: " << std::hex << hr << std::endl;
            m_outputTexture.Reset();
            return nullptr;
        }

        m_currentWidth = targetWidth;
        m_currentHeight = targetHeight;
        std::cout << "[D3D11Scaler] Buffer de saida alocado: " << targetWidth << "x" << targetHeight << " (DXGI_FORMAT_B8G8R8A8_UNORM)" << std::endl;
    }

    // Gerencia o SRV da textura de entrada (cache para os 4 buffers do FramePool do WGC)
    ID3D11ShaderResourceView* srv = nullptr;
    for (int i = 0; i < 4; i++) {
        if (m_slotTex[i] == inputTexture && m_slotSRV[i]) {
            srv = m_slotSRV[i].Get();
            break;
        }
    }

    if (!srv) {
        D3D11_TEXTURE2D_DESC inDesc;
        inputTexture->GetDesc(&inDesc);

        D3D11_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Format = inDesc.Format;
        srvDesc.ViewDimension = D3D11_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MostDetailedMip = 0;
        srvDesc.Texture2D.MipLevels = 1;

        Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> newSRV;
        HRESULT hr = m_device->CreateShaderResourceView(inputTexture, &srvDesc, &newSRV);
        if (FAILED(hr)) {
            std::cerr << "[D3D11Scaler] Erro ao criar SRV para input texture: " << std::hex << hr << std::endl;
            return nullptr;
        }

        static int nextSlot = 0;
        int slot = nextSlot % 4;
        nextSlot++;

        m_slotTex[slot] = inputTexture;
        m_slotSRV[slot] = newSRV;
        srv = newSRV.Get();
    }

    // Configura o Viewport de destino
    D3D11_VIEWPORT vp = {};
    vp.Width = static_cast<float>(targetWidth);
    vp.Height = static_cast<float>(targetHeight);
    vp.MinDepth = 0.0f;
    vp.MaxDepth = 1.0f;
    vp.TopLeftX = 0;
    vp.TopLeftY = 0;

    m_context->RSSetViewports(1, &vp);
    m_context->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    m_context->IASetInputLayout(nullptr);
    m_context->VSSetShader(m_vs.Get(), nullptr, 0);
    m_context->PSSetShader(m_ps.Get(), nullptr, 0);

    ID3D11SamplerState* samplers[] = { m_sampler.Get() };
    m_context->PSSetSamplers(0, 1, samplers);

    ID3D11ShaderResourceView* views[] = { srv };
    m_context->PSSetShaderResources(0, 1, views);

    ID3D11RenderTargetView* rtvs[] = { m_rtv.Get() };
    m_context->OMSetRenderTargets(1, rtvs, nullptr);

    // Executa a amostragem em tela cheia na GPU (< 0.03 ms)
    m_context->Draw(3, 0);

    // Desvincula recursos para evitar avisos ou conflitos de pipeline Direct3D
    ID3D11ShaderResourceView* nullSRV[] = { nullptr };
    m_context->PSSetShaderResources(0, 1, nullSRV);
    ID3D11RenderTargetView* nullRTV[] = { nullptr };
    m_context->OMSetRenderTargets(1, nullRTV, nullptr);

    return m_outputTexture.Get();
}

void D3D11Scaler::Shutdown() {
    m_outputTexture.Reset();
    m_rtv.Reset();
    for (int i = 0; i < 4; i++) {
        m_slotTex[i] = nullptr;
        m_slotSRV[i].Reset();
    }
    m_sampler.Reset();
    m_ps.Reset();
    m_vs.Reset();
    m_context.Reset();
    m_device.Reset();
    m_initialized = false;
    m_currentWidth = 0;
    m_currentHeight = 0;
}
