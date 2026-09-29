#include "nvenc_encoder.h"
#include <iostream>

typedef NVENCSTATUS (NVENCAPI *PNvEncodeAPICreateInstance)(NV_ENCODE_API_FUNCTION_LIST *functionList);

NVENCEncoder::NVENCEncoder() {}

NVENCEncoder::~NVENCEncoder() {
    Shutdown();
}

bool NVENCEncoder::Initialize(ID3D11Device* device, uint32_t width, uint32_t height, uint32_t fps, uint32_t bitrateBps) {
    if (m_initialized) {
        Shutdown();
    }

    m_d3dDevice = device;
    m_width = width;
    m_height = height;
    m_fps = fps > 0 ? fps : 60;
    m_bitrate = bitrateBps > 0 ? bitrateBps : 8000000;
    m_forceNextKeyframe = true;

    m_hNvenc = LoadLibraryW(L"nvEncodeAPI64.dll");
    if (!m_hNvenc) {
        std::cerr << "[NVENC] Erro: nvEncodeAPI64.dll nao encontrada!" << std::endl;
        return false;
    }

    auto pfnCreate = (PNvEncodeAPICreateInstance)GetProcAddress(m_hNvenc, "NvEncodeAPICreateInstance");
    if (!pfnCreate) {
        std::cerr << "[NVENC] Erro: NvEncodeAPICreateInstance nao encontrada!" << std::endl;
        Shutdown();
        return false;
    }

    m_nvenc.version = NV_ENCODE_API_FUNCTION_LIST_VER;
    NVENCSTATUS status = pfnCreate(&m_nvenc);
    if (status != NV_ENC_SUCCESS) {
        std::cerr << "[NVENC] Erro: falha em NvEncodeAPICreateInstance: " << status << std::endl;
        Shutdown();
        return false;
    }

    // Abre a sessao de codificacao no dispositivo D3D11
    NV_ENC_OPEN_ENCODE_SESSION_EX_PARAMS openParams = {};
    openParams.version = NV_ENC_OPEN_ENCODE_SESSION_EX_PARAMS_VER;
    openParams.deviceType = NV_ENC_DEVICE_TYPE_DIRECTX;
    openParams.device = m_d3dDevice;
    openParams.apiVersion = NVENCAPI_VERSION;

    status = m_nvenc.nvEncOpenEncodeSessionEx(&openParams, &m_encoder);
    if (status != NV_ENC_SUCCESS || !m_encoder) {
        std::cerr << "[NVENC] Erro: falha ao abrir sessao NVENC: " << status << std::endl;
        Shutdown();
        return false;
    }

    // Configura o Preset de Baixa Latencia para Jogos
    // Configura o Preset de Baixa Latencia para Jogos (Tenta P4 para alta qualidade; fallback para P3 e P1)
    NV_ENC_PRESET_CONFIG presetConfig = {};
    presetConfig.version = NV_ENC_PRESET_CONFIG_VER;
    presetConfig.presetCfg.version = NV_ENC_CONFIG_VER;

    GUID usedPreset = NV_ENC_PRESET_P4_GUID;
    NV_ENC_TUNING_INFO usedTuning = NV_ENC_TUNING_INFO_LOW_LATENCY;
    status = m_nvenc.nvEncGetEncodePresetConfigEx(
        m_encoder,
        NV_ENC_CODEC_H264_GUID,
        NV_ENC_PRESET_P4_GUID,
        NV_ENC_TUNING_INFO_LOW_LATENCY,
        &presetConfig
    );

    if (status != NV_ENC_SUCCESS) {
        status = m_nvenc.nvEncGetEncodePresetConfigEx(
            m_encoder,
            NV_ENC_CODEC_H264_GUID,
            NV_ENC_PRESET_P3_GUID,
            NV_ENC_TUNING_INFO_LOW_LATENCY,
            &presetConfig
        );
        usedPreset = NV_ENC_PRESET_P3_GUID;
    }

    if (status != NV_ENC_SUCCESS) {
        status = m_nvenc.nvEncGetEncodePresetConfigEx(
            m_encoder,
            NV_ENC_CODEC_H264_GUID,
            NV_ENC_PRESET_P1_GUID,
            NV_ENC_TUNING_INFO_ULTRA_LOW_LATENCY,
            &presetConfig
        );
        usedPreset = NV_ENC_PRESET_P1_GUID;
        usedTuning = NV_ENC_TUNING_INFO_ULTRA_LOW_LATENCY;
    }

    bool hasPresetConfig = (status == NV_ENC_SUCCESS);
    if (hasPresetConfig) {
        m_encodeConfig = presetConfig.presetCfg;

        // 1. High Profile com transform 8x8 e CABAC para fidelidade gráfica
        m_encodeConfig.profileGUID = NV_ENC_H264_PROFILE_HIGH_GUID;
        m_encodeConfig.encodeCodecConfig.h264Config.entropyCodingMode = NV_ENC_H264_ENTROPY_CODING_MODE_CABAC;

        // 2. Fatia única padrão para máxima compatibilidade com o depacketizer WebRTC
        m_encodeConfig.encodeCodecConfig.h264Config.sliceMode = 0;
        m_encodeConfig.encodeCodecConfig.h264Config.sliceModeData = 0;

        // 3. Controle de quadros de referência (GOP e IDR)
        m_encodeConfig.gopLength = m_fps * 2;
        m_encodeConfig.frameIntervalP = 1; // Sem B-frames para zero latência
        m_encodeConfig.encodeCodecConfig.h264Config.idrPeriod = m_fps * 2;
        m_encodeConfig.encodeCodecConfig.h264Config.repeatSPSPPS = 1;
        m_encodeConfig.encodeCodecConfig.h264Config.maxNumRefFrames = 1;
        m_encodeConfig.encodeCodecConfig.h264Config.outputAUD = 1;

        // 4. Rate Control: CBR estrito com buffer VBV de baixa latência (2 quadros)
        // Isso impede explosão para 25 Mbps e garante taxa estável sem descarte no WebRTC
        m_encodeConfig.rcParams.rateControlMode = NV_ENC_PARAMS_RC_CBR;
        m_encodeConfig.rcParams.averageBitRate = m_bitrate;
        m_encodeConfig.rcParams.maxBitRate = m_bitrate;
        m_encodeConfig.rcParams.vbvBufferSize = (m_bitrate * 2) / m_fps;
        m_encodeConfig.rcParams.vbvInitialDelay = m_encodeConfig.rcParams.vbvBufferSize;
        m_encodeConfig.rcParams.zeroReorderDelay = 1;

        // 5. Adaptive Quantization Espacial para suavizar texturas
        m_encodeConfig.rcParams.enableAQ = 1;
        m_encodeConfig.rcParams.aqStrength = 6;
        m_encodeConfig.rcParams.enableTemporalAQ = 0; // Desativa AQ temporal que conflita com CBR ultra-low latency

        // 6. Deixa o rate control gerenciar QP sem travar teto (o teto anterior forçava picos de 25 Mbps)
        m_encodeConfig.rcParams.enableMinQP = 0;
        m_encodeConfig.rcParams.enableMaxQP = 0;
    } else {
        std::cerr << "[NVENC] Aviso: nvEncGetEncodePresetConfigEx retornou: " << status << std::endl;
    }

    // Inicializa o Encoder
    m_initParams = {};
    m_initParams.version = NV_ENC_INITIALIZE_PARAMS_VER;
    m_initParams.encodeGUID = NV_ENC_CODEC_H264_GUID;
    m_initParams.presetGUID = usedPreset;
    m_initParams.tuningInfo = usedTuning;
    m_initParams.encodeWidth = m_width;
    m_initParams.encodeHeight = m_height;
    m_initParams.darWidth = m_width;
    m_initParams.darHeight = m_height;
    m_initParams.frameRateNum = m_fps;
    m_initParams.frameRateDen = 1;
    m_initParams.enablePTD = 1;
    m_initParams.encodeConfig = hasPresetConfig ? &m_encodeConfig : nullptr;

    status = m_nvenc.nvEncInitializeEncoder(m_encoder, &m_initParams);
    if (status != NV_ENC_SUCCESS && m_initParams.encodeConfig != nullptr) {
        std::cerr << "[NVENC] Tentando inicializacao com preset nativo direto (encodeConfig = nullptr)..." << std::endl;
        m_initParams.encodeConfig = nullptr;
        status = m_nvenc.nvEncInitializeEncoder(m_encoder, &m_initParams);
    }

    if (status != NV_ENC_SUCCESS) {
        std::cerr << "[NVENC] Erro fatal: falha em nvEncInitializeEncoder: " << status << std::endl;
        Shutdown();
        return false;
    }

    // Cria o buffer de saida bitstream
    NV_ENC_CREATE_BITSTREAM_BUFFER bitstreamParams = {};
    bitstreamParams.version = NV_ENC_CREATE_BITSTREAM_BUFFER_VER;
    status = m_nvenc.nvEncCreateBitstreamBuffer(m_encoder, &bitstreamParams);
    if (status != NV_ENC_SUCCESS) {
        std::cerr << "[NVENC] Erro: falha ao criar buffer de bitstream: " << status << std::endl;
        Shutdown();
        return false;
    }
    m_bitstreamBuffer = bitstreamParams.bitstreamBuffer;

    m_initialized = true;
    std::cout << "[NVENC] Inicializado com sucesso: " << m_width << "x" << m_height 
              << " @ " << m_fps << " FPS | " << (m_bitrate / 1000000.0) << " Mbps (Zero-Copy GPU Direct)" << std::endl;
    return true;
}

bool NVENCEncoder::EncodeTexture(ID3D11Texture2D* texture, bool forceKeyframe, std::vector<uint8_t>& outBitstream, bool& isKeyframe) {
    if (!m_initialized || !texture) return false;

    // Registra a textura no NVENC se for uma nova textura
    if (m_registeredTexture != texture) {
        if (m_registeredResource) {
            m_nvenc.nvEncUnregisterResource(m_encoder, m_registeredResource);
            m_registeredResource = nullptr;
        }

        NV_ENC_REGISTER_RESOURCE regParams = {};
        regParams.version = NV_ENC_REGISTER_RESOURCE_VER;
        regParams.resourceType = NV_ENC_INPUT_RESOURCE_TYPE_DIRECTX;
        regParams.resourceToRegister = texture;
        regParams.width = m_width;
        regParams.height = m_height;
        regParams.pitch = 0;
        regParams.bufferFormat = NV_ENC_BUFFER_FORMAT_ARGB; // WGC DXGI_FORMAT_B8G8R8A8_UNORM
        regParams.bufferUsage = NV_ENC_INPUT_IMAGE;

        NVENCSTATUS status = m_nvenc.nvEncRegisterResource(m_encoder, &regParams);
        if (status != NV_ENC_SUCCESS) {
            std::cerr << "[NVENC] Erro ao registrar textura: " << status << std::endl;
            return false;
        }
        m_registeredResource = regParams.registeredResource;
        m_registeredTexture = texture;
    }

    // Mapeia o recurso para codificacao
    NV_ENC_MAP_INPUT_RESOURCE mapParams = {};
    mapParams.version = NV_ENC_MAP_INPUT_RESOURCE_VER;
    mapParams.registeredResource = m_registeredResource;
    NVENCSTATUS status = m_nvenc.nvEncMapInputResource(m_encoder, &mapParams);
    if (status != NV_ENC_SUCCESS) {
        std::cerr << "[NVENC] Erro ao mapear recurso: " << status << std::endl;
        return false;
    }

    // Executa a codificacao do quadro na GPU
    NV_ENC_PIC_PARAMS picParams = {};
    picParams.version = NV_ENC_PIC_PARAMS_VER;
    picParams.inputBuffer = mapParams.mappedResource;
    picParams.bufferFmt = NV_ENC_BUFFER_FORMAT_ARGB;
    picParams.inputWidth = m_width;
    picParams.inputHeight = m_height;
    picParams.outputBitstream = m_bitstreamBuffer;
    picParams.pictureStruct = NV_ENC_PIC_STRUCT_FRAME;

    bool requestIDR = forceKeyframe || m_forceNextKeyframe;
    if (requestIDR) {
        picParams.encodePicFlags = NV_ENC_PIC_FLAG_FORCEIDR | NV_ENC_PIC_FLAG_OUTPUT_SPSPPS;
        m_forceNextKeyframe = false;
    }

    status = m_nvenc.nvEncEncodePicture(m_encoder, &picParams);
    if (status != NV_ENC_SUCCESS) {
        std::cerr << "[NVENC] Erro ao codificar quadro: " << status << std::endl;
        m_nvenc.nvEncUnmapInputResource(m_encoder, mapParams.mappedResource);
        return false;
    }

    // Trava e le os bytes NAL codificados
    NV_ENC_LOCK_BITSTREAM lockParams = {};
    lockParams.version = NV_ENC_LOCK_BITSTREAM_VER;
    lockParams.outputBitstream = m_bitstreamBuffer;
    lockParams.doNotWait = 0;

    status = m_nvenc.nvEncLockBitstream(m_encoder, &lockParams);
    if (status == NV_ENC_SUCCESS) {
        uint8_t* bitstreamBytes = reinterpret_cast<uint8_t*>(lockParams.bitstreamBufferPtr);
        outBitstream.assign(bitstreamBytes, bitstreamBytes + lockParams.bitstreamSizeInBytes);
        isKeyframe = (lockParams.pictureType == NV_ENC_PIC_TYPE_IDR || lockParams.pictureType == NV_ENC_PIC_TYPE_I || requestIDR);
        m_nvenc.nvEncUnlockBitstream(m_encoder, m_bitstreamBuffer);
    }

    m_nvenc.nvEncUnmapInputResource(m_encoder, mapParams.mappedResource);
    return (status == NV_ENC_SUCCESS);
}

void NVENCEncoder::RequestKeyframe() {
    m_forceNextKeyframe = true;
}

bool NVENCEncoder::Reconfigure(uint32_t bitrateBps, uint32_t fps) {
    if (!m_initialized || bitrateBps == 0 || fps == 0) return false;
    m_bitrate = bitrateBps;
    m_fps = fps;

    NV_ENC_RECONFIGURE_PARAMS reconfigParams = {};
    reconfigParams.version = NV_ENC_RECONFIGURE_PARAMS_VER;
    reconfigParams.reInitEncodeParams = m_initParams;
    reconfigParams.reInitEncodeParams.encodeConfig = &m_encodeConfig;
    m_encodeConfig.rcParams.averageBitRate = m_bitrate;
    m_encodeConfig.rcParams.maxBitRate = m_bitrate;
    m_encodeConfig.rcParams.vbvBufferSize = (m_bitrate * 2) / m_fps;
    m_encodeConfig.rcParams.vbvInitialDelay = m_encodeConfig.rcParams.vbvBufferSize;
    m_initParams.frameRateNum = m_fps;

    NVENCSTATUS status = m_nvenc.nvEncReconfigureEncoder(m_encoder, &reconfigParams);
    if (status != NV_ENC_SUCCESS) {
        std::cerr << "[NVENC] Erro ao reconfigurar encoder: " << status << std::endl;
        return false;
    }
    return true;
}

void NVENCEncoder::Shutdown() {
    if (m_encoder) {
        if (m_registeredResource) {
            m_nvenc.nvEncUnregisterResource(m_encoder, m_registeredResource);
            m_registeredResource = nullptr;
        }
        if (m_bitstreamBuffer) {
            m_nvenc.nvEncDestroyBitstreamBuffer(m_encoder, m_bitstreamBuffer);
            m_bitstreamBuffer = nullptr;
        }
        m_nvenc.nvEncDestroyEncoder(m_encoder);
        m_encoder = nullptr;
    }
    if (m_hNvenc) {
        FreeLibrary(m_hNvenc);
        m_hNvenc = nullptr;
    }
    m_registeredTexture = nullptr;
    m_initialized = false;
}
