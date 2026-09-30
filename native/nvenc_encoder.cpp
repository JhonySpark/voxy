#include "nvenc_encoder.h"

#include <iostream>
#include <utility>

typedef NVENCSTATUS(NVENCAPI* PNvEncodeAPICreateInstance)(NV_ENCODE_API_FUNCTION_LIST* functionList);

NVENCEncoder::NVENCEncoder() {}
NVENCEncoder::~NVENCEncoder() { Shutdown(); }

bool NVENCEncoder::Initialize(ID3D11Device* device, uint32_t width, uint32_t height,
                              uint32_t fps, uint32_t bitrateBps, OutputCallback outputCallback) {
    Shutdown();
    if (!device || !outputCallback) return false;

    m_d3dDevice = device;
    m_d3dDevice->GetImmediateContext(&m_d3dContext);
    m_width = width;
    m_height = height;
    m_fps = fps > 0 ? fps : 60;
    m_bitrate = bitrateBps > 0 ? bitrateBps : 8000000;
    m_outputCallback = std::move(outputCallback);
    m_forceNextKeyframe = true;
    m_droppedFrames = 0;
    m_stopping = false;
    m_abortOutput = false;

    m_hNvenc = LoadLibraryW(L"nvEncodeAPI64.dll");
    if (!m_hNvenc) {
        std::cerr << "[NVENC] Erro: nvEncodeAPI64.dll nao encontrada!" << std::endl;
        return false;
    }

    auto createInstance = reinterpret_cast<PNvEncodeAPICreateInstance>(
        GetProcAddress(m_hNvenc, "NvEncodeAPICreateInstance"));
    if (!createInstance) {
        std::cerr << "[NVENC] Erro: NvEncodeAPICreateInstance nao encontrada!" << std::endl;
        Shutdown();
        return false;
    }

    m_nvenc = {};
    m_nvenc.version = NV_ENCODE_API_FUNCTION_LIST_VER;
    NVENCSTATUS status = createInstance(&m_nvenc);
    if (status != NV_ENC_SUCCESS) {
        std::cerr << "[NVENC] Falha em NvEncodeAPICreateInstance: " << status << std::endl;
        Shutdown();
        return false;
    }

    NV_ENC_OPEN_ENCODE_SESSION_EX_PARAMS openParams = {};
    openParams.version = NV_ENC_OPEN_ENCODE_SESSION_EX_PARAMS_VER;
    openParams.deviceType = NV_ENC_DEVICE_TYPE_DIRECTX;
    openParams.device = m_d3dDevice.Get();
    openParams.apiVersion = NVENCAPI_VERSION;
    status = m_nvenc.nvEncOpenEncodeSessionEx(&openParams, &m_encoder);
    if (status != NV_ENC_SUCCESS || !m_encoder) {
        std::cerr << "[NVENC] Falha ao abrir sessao: " << status << std::endl;
        Shutdown();
        return false;
    }

    NV_ENC_CAPS_PARAM caps = {};
    caps.version = NV_ENC_CAPS_PARAM_VER;
    caps.capsToQuery = NV_ENC_CAPS_ASYNC_ENCODE_SUPPORT;
    int asyncSupported = 0;
    status = m_nvenc.nvEncGetEncodeCaps(m_encoder, NV_ENC_CODEC_H264_GUID, &caps, &asyncSupported);
    if (status != NV_ENC_SUCCESS || asyncSupported == 0) {
        std::cerr << "[NVENC] Driver/GPU sem suporte a encode assincrono." << std::endl;
        Shutdown();
        return false;
    }

    NV_ENC_PRESET_CONFIG preset = {};
    preset.version = NV_ENC_PRESET_CONFIG_VER;
    preset.presetCfg.version = NV_ENC_CONFIG_VER;
    GUID presetGuid = NV_ENC_PRESET_P4_GUID;
    NV_ENC_TUNING_INFO tuning = NV_ENC_TUNING_INFO_LOW_LATENCY;
    status = m_nvenc.nvEncGetEncodePresetConfigEx(
        m_encoder, NV_ENC_CODEC_H264_GUID, presetGuid, tuning, &preset);
    if (status != NV_ENC_SUCCESS) {
        presetGuid = NV_ENC_PRESET_P3_GUID;
        status = m_nvenc.nvEncGetEncodePresetConfigEx(
            m_encoder, NV_ENC_CODEC_H264_GUID, presetGuid, tuning, &preset);
    }
    if (status != NV_ENC_SUCCESS) {
        presetGuid = NV_ENC_PRESET_P1_GUID;
        tuning = NV_ENC_TUNING_INFO_ULTRA_LOW_LATENCY;
        status = m_nvenc.nvEncGetEncodePresetConfigEx(
            m_encoder, NV_ENC_CODEC_H264_GUID, presetGuid, tuning, &preset);
    }
    if (status != NV_ENC_SUCCESS) {
        std::cerr << "[NVENC] Falha ao carregar preset: " << status << std::endl;
        Shutdown();
        return false;
    }

    m_encodeConfig = preset.presetCfg;
    m_encodeConfig.profileGUID = NV_ENC_H264_PROFILE_HIGH_GUID;
    m_encodeConfig.encodeCodecConfig.h264Config.entropyCodingMode = NV_ENC_H264_ENTROPY_CODING_MODE_CABAC;
    m_encodeConfig.encodeCodecConfig.h264Config.sliceMode = 0;
    m_encodeConfig.encodeCodecConfig.h264Config.sliceModeData = 0;
    m_encodeConfig.gopLength = m_fps * 2;
    m_encodeConfig.frameIntervalP = 1;
    m_encodeConfig.encodeCodecConfig.h264Config.idrPeriod = m_fps * 2;
    m_encodeConfig.encodeCodecConfig.h264Config.repeatSPSPPS = 1;
    m_encodeConfig.encodeCodecConfig.h264Config.maxNumRefFrames = 1;
    m_encodeConfig.encodeCodecConfig.h264Config.outputAUD = 1;
    m_encodeConfig.rcParams.rateControlMode = NV_ENC_PARAMS_RC_CBR;
    m_encodeConfig.rcParams.averageBitRate = m_bitrate;
    m_encodeConfig.rcParams.maxBitRate = m_bitrate;
    m_encodeConfig.rcParams.vbvBufferSize = (m_bitrate * 2) / m_fps;
    m_encodeConfig.rcParams.vbvInitialDelay = m_encodeConfig.rcParams.vbvBufferSize;
    m_encodeConfig.rcParams.zeroReorderDelay = 1;
    m_encodeConfig.rcParams.enableAQ = 1;
    m_encodeConfig.rcParams.aqStrength = 6;
    m_encodeConfig.rcParams.enableTemporalAQ = 0;
    m_encodeConfig.rcParams.enableMinQP = 0;
    m_encodeConfig.rcParams.enableMaxQP = 0;

    m_initParams = {};
    m_initParams.version = NV_ENC_INITIALIZE_PARAMS_VER;
    m_initParams.encodeGUID = NV_ENC_CODEC_H264_GUID;
    m_initParams.presetGUID = presetGuid;
    m_initParams.tuningInfo = tuning;
    m_initParams.encodeWidth = m_width;
    m_initParams.encodeHeight = m_height;
    m_initParams.darWidth = m_width;
    m_initParams.darHeight = m_height;
    m_initParams.frameRateNum = m_fps;
    m_initParams.frameRateDen = 1;
    m_initParams.enablePTD = 1;
    m_initParams.enableEncodeAsync = 1;
    m_initParams.encodeConfig = &m_encodeConfig;

    status = m_nvenc.nvEncInitializeEncoder(m_encoder, &m_initParams);
    if (status != NV_ENC_SUCCESS) {
        std::cerr << "[NVENC] Falha ao inicializar encode assincrono: " << status << std::endl;
        Shutdown();
        return false;
    }
    if (!CreateBufferPool()) {
        Shutdown();
        return false;
    }

    m_initialized = true;
    m_acceptingFrames = true;
    m_outputThread = std::thread(&NVENCEncoder::OutputLoop, this);
    std::cout << "[NVENC] Inicializado: " << m_width << "x" << m_height << " @ " << m_fps
              << " FPS | " << (m_bitrate / 1000000.0) << " Mbps | 4 slots assincronos GPU" << std::endl;
    return true;
}

bool NVENCEncoder::CreateBufferPool() {
    D3D11_TEXTURE2D_DESC desc = {};
    desc.Width = m_width;
    desc.Height = m_height;
    desc.MipLevels = 1;
    desc.ArraySize = 1;
    desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    desc.SampleDesc.Count = 1;
    desc.Usage = D3D11_USAGE_DEFAULT;
    desc.BindFlags = D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE;

    for (size_t i = 0; i < kBufferCount; ++i) {
        BufferSlot& slot = m_slots[i];
        HRESULT hr = m_d3dDevice->CreateTexture2D(&desc, nullptr, &slot.inputTexture);
        if (FAILED(hr)) {
            std::cerr << "[NVENC] Falha ao criar textura do slot " << i << ": " << std::hex << hr << std::dec << std::endl;
            return false;
        }

        NV_ENC_REGISTER_RESOURCE registration = {};
        registration.version = NV_ENC_REGISTER_RESOURCE_VER;
        registration.resourceType = NV_ENC_INPUT_RESOURCE_TYPE_DIRECTX;
        registration.resourceToRegister = slot.inputTexture.Get();
        registration.width = m_width;
        registration.height = m_height;
        registration.bufferFormat = NV_ENC_BUFFER_FORMAT_ARGB;
        registration.bufferUsage = NV_ENC_INPUT_IMAGE;
        NVENCSTATUS status = m_nvenc.nvEncRegisterResource(m_encoder, &registration);
        if (status != NV_ENC_SUCCESS) {
            std::cerr << "[NVENC] Falha ao registrar textura do slot " << i << ": " << status << std::endl;
            return false;
        }
        slot.registeredResource = registration.registeredResource;

        NV_ENC_CREATE_BITSTREAM_BUFFER bitstream = {};
        bitstream.version = NV_ENC_CREATE_BITSTREAM_BUFFER_VER;
        status = m_nvenc.nvEncCreateBitstreamBuffer(m_encoder, &bitstream);
        if (status != NV_ENC_SUCCESS) {
            std::cerr << "[NVENC] Falha ao criar bitstream do slot " << i << ": " << status << std::endl;
            return false;
        }
        slot.bitstreamBuffer = bitstream.bitstreamBuffer;

        slot.completionEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
        if (!slot.completionEvent) return false;
        NV_ENC_EVENT_PARAMS eventParams = {};
        eventParams.version = NV_ENC_EVENT_PARAMS_VER;
        eventParams.completionEvent = slot.completionEvent;
        status = m_nvenc.nvEncRegisterAsyncEvent(m_encoder, &eventParams);
        if (status != NV_ENC_SUCCESS) {
            std::cerr << "[NVENC] Falha ao registrar evento do slot " << i << ": " << status << std::endl;
            return false;
        }
        slot.eventRegistered = true;
    }

    m_eosEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    if (!m_eosEvent) return false;
    NV_ENC_EVENT_PARAMS eosEvent = {};
    eosEvent.version = NV_ENC_EVENT_PARAMS_VER;
    eosEvent.completionEvent = m_eosEvent;
    NVENCSTATUS status = m_nvenc.nvEncRegisterAsyncEvent(m_encoder, &eosEvent);
    if (status != NV_ENC_SUCCESS) return false;
    m_eosEventRegistered = true;
    return true;
}

bool NVENCEncoder::SubmitTexture(ID3D11Texture2D* texture, bool forceKeyframe, int64_t timestampUs) {
    if (!m_initialized || !m_acceptingFrames || !texture) return false;
    if (forceKeyframe) m_forceNextKeyframe = true;

    size_t slotIndex = kBufferCount;
    {
        std::lock_guard<std::mutex> lock(m_stateMutex);
        if (!m_acceptingFrames) return false;
        for (size_t i = 0; i < kBufferCount; ++i) {
            if (!m_slots[i].inUse) {
                slotIndex = i;
                m_slots[i].inUse = true;
                break;
            }
        }
    }
    if (slotIndex == kBufferCount) {
        ++m_droppedFrames;
        return false;
    }

    BufferSlot& slot = m_slots[slotIndex];
    slot.timestampUs = timestampUs;
    slot.requestedKeyframe = forceKeyframe || m_forceNextKeyframe.load();
    ResetEvent(slot.completionEvent);

    // Cópia GPU->GPU: o scaler pode reutilizar sua saída sem sobrescrever
    // uma superfície que ainda esteja sendo lida pelo NVENC.
    m_d3dContext->CopyResource(slot.inputTexture.Get(), texture);

    NVENCSTATUS status;
    {
        std::lock_guard<std::mutex> apiLock(m_apiMutex);
        NV_ENC_MAP_INPUT_RESOURCE mapping = {};
        mapping.version = NV_ENC_MAP_INPUT_RESOURCE_VER;
        mapping.registeredResource = slot.registeredResource;
        status = m_nvenc.nvEncMapInputResource(m_encoder, &mapping);
        if (status == NV_ENC_SUCCESS) {
            slot.mappedResource = mapping.mappedResource;
            NV_ENC_PIC_PARAMS picture = {};
            picture.version = NV_ENC_PIC_PARAMS_VER;
            picture.inputBuffer = slot.mappedResource;
            picture.bufferFmt = mapping.mappedBufferFmt;
            picture.inputWidth = m_width;
            picture.inputHeight = m_height;
            picture.outputBitstream = slot.bitstreamBuffer;
            picture.completionEvent = slot.completionEvent;
            picture.pictureStruct = NV_ENC_PIC_STRUCT_FRAME;
            if (slot.requestedKeyframe) {
                picture.encodePicFlags = NV_ENC_PIC_FLAG_FORCEIDR | NV_ENC_PIC_FLAG_OUTPUT_SPSPPS;
            }
            status = m_nvenc.nvEncEncodePicture(m_encoder, &picture);
        }
    }

    if (status != NV_ENC_SUCCESS && status != NV_ENC_ERR_NEED_MORE_INPUT) {
        std::cerr << "[NVENC] Falha ao submeter frame: " << status << std::endl;
        if (slot.requestedKeyframe) m_forceNextKeyframe = true;
        ReleaseSlot(slotIndex);
        return false;
    }
    if (slot.requestedKeyframe) m_forceNextKeyframe = false;
    {
        std::lock_guard<std::mutex> lock(m_stateMutex);
        m_pendingSlots.push_back(slotIndex);
    }
    m_pendingCondition.notify_one();
    return true;
}

void NVENCEncoder::OutputLoop() {
    while (true) {
        size_t slotIndex;
        {
            std::unique_lock<std::mutex> lock(m_stateMutex);
            m_pendingCondition.wait(lock, [&] { return !m_pendingSlots.empty() || m_stopping.load(); });
            if (m_pendingSlots.empty()) {
                if (m_stopping) break;
                continue;
            }
            slotIndex = m_pendingSlots.front();
        }

        BufferSlot& slot = m_slots[slotIndex];
        DWORD waitResult = WAIT_TIMEOUT;
        while (waitResult == WAIT_TIMEOUT && !m_abortOutput) {
            waitResult = WaitForSingleObject(slot.completionEvent, 100);
        }

        EncodedFrame frame;
        bool ready = false;
        if (waitResult == WAIT_OBJECT_0 && !m_abortOutput) {
            NV_ENC_LOCK_BITSTREAM lock = {};
            lock.version = NV_ENC_LOCK_BITSTREAM_VER;
            lock.outputBitstream = slot.bitstreamBuffer;
            lock.doNotWait = 1;
            std::lock_guard<std::mutex> apiLock(m_apiMutex);
            NVENCSTATUS status = m_nvenc.nvEncLockBitstream(m_encoder, &lock);
            if (status == NV_ENC_SUCCESS) {
                const auto* bytes = reinterpret_cast<const uint8_t*>(lock.bitstreamBufferPtr);
                frame.data.assign(bytes, bytes + lock.bitstreamSizeInBytes);
                frame.timestampUs = slot.timestampUs;
                frame.isKeyframe = lock.pictureType == NV_ENC_PIC_TYPE_IDR ||
                                   lock.pictureType == NV_ENC_PIC_TYPE_I ||
                                   slot.requestedKeyframe;
                m_nvenc.nvEncUnlockBitstream(m_encoder, slot.bitstreamBuffer);
                ready = !frame.data.empty();
            } else {
                std::cerr << "[NVENC] Falha ao obter bitstream: " << status << std::endl;
            }
            if (slot.mappedResource) {
                m_nvenc.nvEncUnmapInputResource(m_encoder, slot.mappedResource);
                slot.mappedResource = nullptr;
            }
        }

        {
            std::lock_guard<std::mutex> stateLock(m_stateMutex);
            if (!m_pendingSlots.empty() && m_pendingSlots.front() == slotIndex) m_pendingSlots.pop_front();
            slot.inUse = false;
        }

        if (ready && m_outputCallback) {
            try {
                m_outputCallback(std::move(frame));
            } catch (const std::exception& error) {
                std::cerr << "[NVENC] Callback de saida falhou: " << error.what() << std::endl;
            } catch (...) {
                std::cerr << "[NVENC] Callback de saida falhou." << std::endl;
            }
        }
    }
}

void NVENCEncoder::ReleaseSlot(size_t slotIndex) {
    BufferSlot& slot = m_slots[slotIndex];
    if (slot.mappedResource && m_encoder) {
        std::lock_guard<std::mutex> apiLock(m_apiMutex);
        m_nvenc.nvEncUnmapInputResource(m_encoder, slot.mappedResource);
        slot.mappedResource = nullptr;
    }
    std::lock_guard<std::mutex> stateLock(m_stateMutex);
    slot.inUse = false;
}

void NVENCEncoder::RequestKeyframe() { m_forceNextKeyframe = true; }

bool NVENCEncoder::Reconfigure(uint32_t bitrateBps, uint32_t fps) {
    if (!m_initialized || bitrateBps == 0 || fps == 0) return false;
    NV_ENC_RECONFIGURE_PARAMS params = {};
    params.version = NV_ENC_RECONFIGURE_PARAMS_VER;
    params.reInitEncodeParams = m_initParams;
    params.reInitEncodeParams.encodeConfig = &m_encodeConfig;
    m_encodeConfig.rcParams.averageBitRate = bitrateBps;
    m_encodeConfig.rcParams.maxBitRate = bitrateBps;
    m_encodeConfig.rcParams.vbvBufferSize = (bitrateBps * 2) / fps;
    m_encodeConfig.rcParams.vbvInitialDelay = m_encodeConfig.rcParams.vbvBufferSize;
    m_initParams.frameRateNum = fps;
    std::lock_guard<std::mutex> apiLock(m_apiMutex);
    NVENCSTATUS status = m_nvenc.nvEncReconfigureEncoder(m_encoder, &params);
    if (status != NV_ENC_SUCCESS) {
        std::cerr << "[NVENC] Falha ao reconfigurar: " << status << std::endl;
        return false;
    }
    m_bitrate = bitrateBps;
    m_fps = fps;
    return true;
}

void NVENCEncoder::DestroyBufferPool() {
    if (!m_encoder) return;
    for (auto& slot : m_slots) {
        if (slot.mappedResource) {
            m_nvenc.nvEncUnmapInputResource(m_encoder, slot.mappedResource);
            slot.mappedResource = nullptr;
        }
        if (slot.registeredResource) {
            m_nvenc.nvEncUnregisterResource(m_encoder, slot.registeredResource);
            slot.registeredResource = nullptr;
        }
        if (slot.bitstreamBuffer) {
            m_nvenc.nvEncDestroyBitstreamBuffer(m_encoder, slot.bitstreamBuffer);
            slot.bitstreamBuffer = nullptr;
        }
        if (slot.completionEvent) {
            if (slot.eventRegistered) {
                NV_ENC_EVENT_PARAMS event = {};
                event.version = NV_ENC_EVENT_PARAMS_VER;
                event.completionEvent = slot.completionEvent;
                m_nvenc.nvEncUnregisterAsyncEvent(m_encoder, &event);
            }
            CloseHandle(slot.completionEvent);
            slot.completionEvent = nullptr;
            slot.eventRegistered = false;
        }
        slot.inputTexture.Reset();
        slot.inUse = false;
    }
    if (m_eosEvent) {
        if (m_eosEventRegistered) {
            NV_ENC_EVENT_PARAMS event = {};
            event.version = NV_ENC_EVENT_PARAMS_VER;
            event.completionEvent = m_eosEvent;
            m_nvenc.nvEncUnregisterAsyncEvent(m_encoder, &event);
        }
        CloseHandle(m_eosEvent);
        m_eosEvent = nullptr;
        m_eosEventRegistered = false;
    }
}

void NVENCEncoder::Shutdown() {
    m_acceptingFrames = false;
    if (m_encoder && m_initialized && m_eosEvent) {
        ResetEvent(m_eosEvent);
        NV_ENC_PIC_PARAMS eos = {};
        eos.version = NV_ENC_PIC_PARAMS_VER;
        eos.encodePicFlags = NV_ENC_PIC_FLAG_EOS;
        eos.completionEvent = m_eosEvent;
        std::lock_guard<std::mutex> apiLock(m_apiMutex);
        m_nvenc.nvEncEncodePicture(m_encoder, &eos);
    }

    m_stopping = true;
    m_pendingCondition.notify_all();
    if (m_eosEvent && WaitForSingleObject(m_eosEvent, 3000) != WAIT_OBJECT_0) {
        m_abortOutput = true;
        for (auto& slot : m_slots) if (slot.completionEvent) SetEvent(slot.completionEvent);
    }
    if (m_outputThread.joinable()) m_outputThread.join();

    if (m_encoder) {
        std::lock_guard<std::mutex> apiLock(m_apiMutex);
        DestroyBufferPool();
        m_nvenc.nvEncDestroyEncoder(m_encoder);
        m_encoder = nullptr;
    }
    if (m_hNvenc) {
        FreeLibrary(m_hNvenc);
        m_hNvenc = nullptr;
    }
    {
        std::lock_guard<std::mutex> stateLock(m_stateMutex);
        m_pendingSlots.clear();
    }
    m_outputCallback = nullptr;
    m_d3dContext.Reset();
    m_d3dDevice.Reset();
    m_initialized = false;
    m_stopping = false;
    m_abortOutput = false;
}
