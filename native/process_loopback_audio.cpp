#include "process_loopback_audio.h"

#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>
#include <propvarutil.h>
#include <vector>
#include <iostream>

namespace {
constexpr int kSampleRate = 48000;
constexpr int kChannels = 2;
constexpr uint32_t kFramesPerPacket = kSampleRate / 100; // 10 ms

class ActivationHandler final : public IActivateAudioInterfaceCompletionHandler, public IAgileObject {
public:
    explicit ActivationHandler(HANDLE completedEvent) : completedEvent_(completedEvent) {}
    ~ActivationHandler() {
        if (audioClient_) audioClient_->Release();
    }

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** object) override {
        if (!object) return E_POINTER;
        if (iid == __uuidof(IUnknown) || iid == __uuidof(IActivateAudioInterfaceCompletionHandler)) {
            *object = static_cast<IActivateAudioInterfaceCompletionHandler*>(this);
        } else if (iid == __uuidof(IAgileObject)) {
            *object = static_cast<IAgileObject*>(this);
        } else {
            *object = nullptr;
            return E_NOINTERFACE;
        }
        AddRef();
        return S_OK;
    }

    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        const ULONG refs = --refs_;
        if (refs == 0) delete this;
        return refs;
    }

    HRESULT STDMETHODCALLTYPE ActivateCompleted(IActivateAudioInterfaceAsyncOperation* operation) override {
        HRESULT activationResult = E_FAIL;
        IUnknown* unknown = nullptr;
        HRESULT hr = operation->GetActivateResult(&activationResult, &unknown);
        if (SUCCEEDED(hr) && SUCCEEDED(activationResult) && unknown) {
            hr = unknown->QueryInterface(IID_PPV_ARGS(&audioClient_));
        } else if (SUCCEEDED(hr)) {
            hr = activationResult;
        }
        if (unknown) unknown->Release();
        result_ = hr;
        SetEvent(completedEvent_);
        return S_OK;
    }

    HRESULT result() const { return result_; }
    IAudioClient* audioClient() const { return audioClient_; }

private:
    std::atomic<ULONG> refs_{1};
    HANDLE completedEvent_;
    HRESULT result_{E_FAIL};
    IAudioClient* audioClient_{nullptr};
};

HRESULT ActivateProcessLoopback(DWORD processId, IAudioClient** audioClient) {
    *audioClient = nullptr;
    HANDLE completed = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    if (!completed) return HRESULT_FROM_WIN32(GetLastError());

    auto* handler = new ActivationHandler(completed);
    AUDIOCLIENT_ACTIVATION_PARAMS params = {};
    params.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    params.ProcessLoopbackParams.TargetProcessId = processId;
    params.ProcessLoopbackParams.ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT activation = {};
    activation.vt = VT_BLOB;
    activation.blob.cbSize = sizeof(params);
    activation.blob.pBlobData = reinterpret_cast<BYTE*>(&params);

    IActivateAudioInterfaceAsyncOperation* operation = nullptr;
    HRESULT hr = ActivateAudioInterfaceAsync(
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
        __uuidof(IAudioClient),
        &activation,
        handler,
        &operation);

    if (SUCCEEDED(hr)) {
        const DWORD wait = WaitForSingleObject(completed, 10000);
        if (wait == WAIT_OBJECT_0) {
            hr = handler->result();
            if (SUCCEEDED(hr) && handler->audioClient()) {
                *audioClient = handler->audioClient();
                (*audioClient)->AddRef();
            } else if (SUCCEEDED(hr)) {
                hr = E_NOINTERFACE;
            }
        } else {
            hr = wait == WAIT_TIMEOUT ? HRESULT_FROM_WIN32(WAIT_TIMEOUT) : HRESULT_FROM_WIN32(GetLastError());
        }
    }

    if (operation) operation->Release();
    handler->Release();
    CloseHandle(completed);
    return hr;
}
} // namespace

ProcessLoopbackAudio::~ProcessLoopbackAudio() {
    Stop();
}

bool ProcessLoopbackAudio::Start(DWORD processId, FrameCallback callback) {
    Stop();
    if (!processId || !callback) return false;

    stopEvent_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    startedEvent_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (!stopEvent_ || !startedEvent_) {
        Stop();
        return false;
    }

    running_ = true;
    startResult_ = E_FAIL;
    thread_ = std::thread(&ProcessLoopbackAudio::CaptureThread, this, processId, std::move(callback));

    const DWORD wait = WaitForSingleObject(startedEvent_, 12000);
    if (wait != WAIT_OBJECT_0 || FAILED(startResult_)) {
        std::cerr << "[Voxy Process Audio] Falha ao iniciar captura por processo: 0x"
                  << std::hex << static_cast<unsigned long>(startResult_) << std::dec << std::endl;
        Stop();
        return false;
    }
    return true;
}

void ProcessLoopbackAudio::Stop() {
    running_ = false;
    if (stopEvent_) SetEvent(stopEvent_);
    if (thread_.joinable()) thread_.join();
    if (startedEvent_) { CloseHandle(startedEvent_); startedEvent_ = nullptr; }
    if (stopEvent_) { CloseHandle(stopEvent_); stopEvent_ = nullptr; }
}

void ProcessLoopbackAudio::CaptureThread(DWORD processId, FrameCallback callback) {
    const HRESULT coHr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(coHr) && coHr != RPC_E_CHANGED_MODE) {
        startResult_ = coHr;
        SetEvent(startedEvent_);
        return;
    }

    IAudioClient* audioClient = nullptr;
    HRESULT hr = ActivateProcessLoopback(processId, &audioClient);
    if (FAILED(hr)) {
        startResult_ = hr;
        SetEvent(startedEvent_);
        if (SUCCEEDED(coHr)) CoUninitialize();
        return;
    }

    WAVEFORMATEX format = {};
    format.wFormatTag = WAVE_FORMAT_PCM;
    format.nChannels = kChannels;
    format.nSamplesPerSec = kSampleRate;
    format.wBitsPerSample = 16;
    format.nBlockAlign = format.nChannels * format.wBitsPerSample / 8;
    format.nAvgBytesPerSec = format.nSamplesPerSec * format.nBlockAlign;

    hr = audioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM,
        0, 0, &format, nullptr);

    IAudioCaptureClient* captureClient = nullptr;
    HANDLE sampleEvent = nullptr;
    if (SUCCEEDED(hr)) hr = audioClient->GetService(IID_PPV_ARGS(&captureClient));
    if (SUCCEEDED(hr)) {
        sampleEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
        if (!sampleEvent) hr = HRESULT_FROM_WIN32(GetLastError());
    }
    if (SUCCEEDED(hr)) hr = audioClient->SetEventHandle(sampleEvent);
    if (SUCCEEDED(hr)) hr = audioClient->Start();

    startResult_ = hr;
    SetEvent(startedEvent_);
    if (FAILED(hr)) {
        if (sampleEvent) CloseHandle(sampleEvent);
        if (captureClient) captureClient->Release();
        audioClient->Release();
        if (SUCCEEDED(coHr)) CoUninitialize();
        return;
    }

    std::vector<int16_t> pending;
    pending.reserve(kFramesPerPacket * kChannels * 4);
    HANDLE events[] = { stopEvent_, sampleEvent };
    while (running_) {
        const DWORD wait = WaitForMultipleObjects(2, events, FALSE, 500);
        if (wait == WAIT_OBJECT_0) break;
        if (wait != WAIT_OBJECT_0 + 1) continue;

        UINT32 packetFrames = 0;
        while (SUCCEEDED(captureClient->GetNextPacketSize(&packetFrames)) && packetFrames > 0) {
            BYTE* data = nullptr;
            DWORD flags = 0;
            UINT32 frames = 0;
            hr = captureClient->GetBuffer(&data, &frames, &flags, nullptr, nullptr);
            if (FAILED(hr)) break;

            const size_t samples = static_cast<size_t>(frames) * kChannels;
            if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                pending.insert(pending.end(), samples, 0);
            } else {
                const auto* pcm = reinterpret_cast<const int16_t*>(data);
                pending.insert(pending.end(), pcm, pcm + samples);
            }
            captureClient->ReleaseBuffer(frames);

            const size_t packetSamples = kFramesPerPacket * kChannels;
            while (pending.size() >= packetSamples) {
                callback(pending.data(), kFramesPerPacket);
                pending.erase(pending.begin(), pending.begin() + static_cast<std::ptrdiff_t>(packetSamples));
            }
        }
    }

    audioClient->Stop();
    CloseHandle(sampleEvent);
    captureClient->Release();
    audioClient->Release();
    if (SUCCEEDED(coHr)) CoUninitialize();
}
