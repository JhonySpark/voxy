#pragma once

#include <windows.h>
#include <d3d11.h>
#include <vector>
#include <cstdint>
#include "nvenc/include/nvEncodeAPI.h"

class NVENCEncoder {
public:
    NVENCEncoder();
    ~NVENCEncoder();

    bool Initialize(ID3D11Device* device, uint32_t width, uint32_t height, uint32_t fps, uint32_t bitrateBps);
    bool EncodeTexture(ID3D11Texture2D* texture, bool forceKeyframe, std::vector<uint8_t>& outBitstream, bool& isKeyframe);
    void RequestKeyframe();
    bool Reconfigure(uint32_t bitrateBps, uint32_t fps);
    void Shutdown();

    bool IsInitialized() const { return m_initialized; }

private:
    bool m_initialized = false;
    bool m_forceNextKeyframe = true;
    uint32_t m_width = 1920;
    uint32_t m_height = 1080;
    uint32_t m_fps = 60;
    uint32_t m_bitrate = 8000000;

    HMODULE m_hNvenc = nullptr;
    NV_ENCODE_API_FUNCTION_LIST m_nvenc = {};
    void* m_encoder = nullptr;
    ID3D11Device* m_d3dDevice = nullptr;

    NV_ENC_INITIALIZE_PARAMS m_initParams = {};
    NV_ENC_CONFIG m_encodeConfig = {};

    // Input resource registration
    ID3D11Texture2D* m_registeredTexture = nullptr;
    NV_ENC_REGISTERED_PTR m_registeredResource = nullptr;
    NV_ENC_OUTPUT_PTR m_bitstreamBuffer = nullptr;
};
