#pragma once

#include <windows.h>
#include <d3d11.h>
#include <wrl/client.h>

#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <deque>
#include <functional>
#include <mutex>
#include <thread>
#include <vector>

#include "nvenc/include/nvEncodeAPI.h"

class NVENCEncoder {
public:
    struct EncodedFrame {
        std::vector<uint8_t> data;
        int64_t timestampUs = 0;
        bool isKeyframe = false;
    };

    using OutputCallback = std::function<void(EncodedFrame&&)>;

    NVENCEncoder();
    ~NVENCEncoder();

    bool Initialize(ID3D11Device* device, uint32_t width, uint32_t height,
                    uint32_t fps, uint32_t bitrateBps, OutputCallback outputCallback);
    bool SubmitTexture(ID3D11Texture2D* texture, bool forceKeyframe, int64_t timestampUs);
    void RequestKeyframe();
    bool Reconfigure(uint32_t bitrateBps, uint32_t fps);
    void Shutdown();

    bool IsInitialized() const { return m_initialized.load(); }
    uint64_t DroppedFrames() const { return m_droppedFrames.load(); }

private:
    static constexpr size_t kBufferCount = 4; // 4 + 0 B-frames

    struct BufferSlot {
        Microsoft::WRL::ComPtr<ID3D11Texture2D> inputTexture;
        NV_ENC_REGISTERED_PTR registeredResource = nullptr;
        NV_ENC_INPUT_PTR mappedResource = nullptr;
        NV_ENC_OUTPUT_PTR bitstreamBuffer = nullptr;
        HANDLE completionEvent = nullptr;
        bool eventRegistered = false;
        int64_t timestampUs = 0;
        bool requestedKeyframe = false;
        bool inUse = false;
    };

    bool CreateBufferPool();
    void OutputLoop();
    void ReleaseSlot(size_t slotIndex);
    void DestroyBufferPool();

    std::atomic<bool> m_initialized{false};
    std::atomic<bool> m_acceptingFrames{false};
    std::atomic<bool> m_stopping{false};
    std::atomic<bool> m_abortOutput{false};
    std::atomic<bool> m_forceNextKeyframe{true};
    std::atomic<uint64_t> m_droppedFrames{0};

    uint32_t m_width = 1920;
    uint32_t m_height = 1080;
    uint32_t m_fps = 60;
    uint32_t m_bitrate = 8000000;

    HMODULE m_hNvenc = nullptr;
    NV_ENCODE_API_FUNCTION_LIST m_nvenc = {};
    void* m_encoder = nullptr;
    Microsoft::WRL::ComPtr<ID3D11Device> m_d3dDevice;
    Microsoft::WRL::ComPtr<ID3D11DeviceContext> m_d3dContext;

    NV_ENC_INITIALIZE_PARAMS m_initParams = {};
    NV_ENC_CONFIG m_encodeConfig = {};

    BufferSlot m_slots[kBufferCount];
    HANDLE m_eosEvent = nullptr;
    bool m_eosEventRegistered = false;
    std::deque<size_t> m_pendingSlots;
    std::mutex m_stateMutex;
    std::condition_variable m_pendingCondition;
    std::mutex m_apiMutex;
    std::thread m_outputThread;
    OutputCallback m_outputCallback;
};
