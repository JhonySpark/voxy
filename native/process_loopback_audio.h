#pragma once

#include <windows.h>
#include <atomic>
#include <cstdint>
#include <functional>
#include <thread>

// Captura apenas o áudio renderizado pelo processo indicado e por seus filhos.
// Requer Windows 10 build 20348 ou mais recente.
class ProcessLoopbackAudio {
public:
    using FrameCallback = std::function<void(const int16_t* samples, uint32_t frames)>;

    ProcessLoopbackAudio() = default;
    ~ProcessLoopbackAudio();

    ProcessLoopbackAudio(const ProcessLoopbackAudio&) = delete;
    ProcessLoopbackAudio& operator=(const ProcessLoopbackAudio&) = delete;

    bool Start(DWORD processId, FrameCallback callback);
    void Stop();

private:
    void CaptureThread(DWORD processId, FrameCallback callback);

    std::atomic<bool> running_{false};
    HANDLE stopEvent_{nullptr};
    HANDLE startedEvent_{nullptr};
    HRESULT startResult_{E_FAIL};
    std::thread thread_;
};
