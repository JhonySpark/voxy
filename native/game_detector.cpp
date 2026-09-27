#include <windows.h>
#include <psapi.h>
#include <tlhelp32.h>
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

// Estrutura para armazenar o diagnóstico de cada janela
struct WindowGraphicsInfo {
    HWND hwnd;
    DWORD pid;
    std::string processName;
    std::string fullPath;
    std::string windowTitle;
    bool isVisible;
    bool hasD3D11;
    bool hasD3D12;
    bool hasDXGI;
    bool hasVulkan;
    bool hasOpenGL;
    bool hasD3D9;
    bool isAntiCheatProtected;
    bool isGameCandidate;
};

// Converte string para minúsculas
std::string toLower(const std::string& str) {
    std::string result = str;
    std::transform(result.begin(), result.end(), result.begin(), ::tolower);
    return result;
}

// Escapa string para formato JSON
std::string escapeJson(const std::string& input) {
    std::string output;
    for (char c : input) {
        if (c == '"') output += "\\\"";
        else if (c == '\\') output += "\\\\";
        else if (c == '\b') output += "\\b";
        else if (c == '\f') output += "\\f";
        else if (c == '\n') output += "\\n";
        else if (c == '\r') output += "\\r";
        else if (c == '\t') output += "\\t";
        else if (static_cast<unsigned char>(c) < 32) {
            // Ignora caracteres de controle inválidos
        } else {
            output += c;
        }
    }
    return output;
}

// Analisa os módulos gráficos 3D carregados no espaço de endereçamento do processo
void inspectProcessGraphicsModules(DWORD pid, WindowGraphicsInfo& info) {
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
    if (!hProcess) {
        DWORD err = GetLastError();
        // Se falhou com ACCESS_DENIED em um processo de usuário comum com janela aberta,
        // é quase certamente um jogo protegido por Anti-Cheat (EAC, BattlEye, Vanguard, Ricochet)
        if (err == ERROR_ACCESS_DENIED) {
            info.isAntiCheatProtected = true;
        }
        return;
    }

    HMODULE hMods[1024];
    DWORD cbNeeded;

    if (EnumProcessModulesEx(hProcess, hMods, sizeof(hMods), &cbNeeded, LIST_MODULES_ALL)) {
        DWORD numModules = cbNeeded / sizeof(HMODULE);
        for (DWORD i = 0; i < numModules; i++) {
            char modName[MAX_PATH];
            if (GetModuleBaseNameA(hProcess, hMods[i], modName, sizeof(modName))) {
                std::string lowerMod = toLower(modName);

                if (lowerMod == "d3d11.dll") info.hasD3D11 = true;
                else if (lowerMod == "d3d12.dll" || lowerMod == "d3d12core.dll") info.hasD3D12 = true;
                else if (lowerMod == "dxgi.dll") info.hasDXGI = true;
                else if (lowerMod == "vulkan-1.dll") info.hasVulkan = true;
                else if (lowerMod == "opengl32.dll" || lowerMod == "nvoglv64.dll") info.hasOpenGL = true;
                else if (lowerMod == "d3d9.dll") info.hasD3D9 = true;
            }
        }
    }

    CloseHandle(hProcess);
}

// Callback de EnumWindows para enumerar janelas principais
BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM lParam) {
    if (!IsWindowVisible(hwnd)) return TRUE;

    // Obtém o título da janela usando WideChar (Unicode UTF-16) para suportar qualquer caractere
    wchar_t titleW[1024];
    int titleLen = GetWindowTextW(hwnd, titleW, ARRAYSIZE(titleW));
    if (titleLen <= 0) return TRUE;

    // Converte UTF-16 para UTF-8 limpo
    int utf8Len = WideCharToMultiByte(CP_UTF8, 0, titleW, -1, nullptr, 0, nullptr, nullptr);
    std::string title;
    if (utf8Len > 1) {
        title.resize(utf8Len - 1);
        WideCharToMultiByte(CP_UTF8, 0, titleW, -1, &title[0], utf8Len, nullptr, nullptr);
    } else {
        return TRUE;
    }

    RECT rect;
    GetWindowRect(hwnd, &rect);
    int width = rect.right - rect.left;
    int height = rect.bottom - rect.top;
    if (width < 100 || height < 100) return TRUE;

    // Ignora janelas utilitárias / de sistema
    LONG exStyle = GetWindowLongA(hwnd, GWL_EXSTYLE);
    if (exStyle & WS_EX_TOOLWINDOW) return TRUE;

    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);
    if (pid == 0) return TRUE;

    // Obtém o nome e caminho completo do processo
    char processName[MAX_PATH] = "Unknown";
    char fullPath[MAX_PATH] = "";
    
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (hProcess) {
        DWORD nameSize = MAX_PATH;
        if (QueryFullProcessImageNameA(hProcess, 0, fullPath, &nameSize)) {
            std::string pathStr(fullPath);
            size_t lastSlash = pathStr.find_last_of("\\/");
            if (lastSlash != std::string::npos) {
                strncpy_s(processName, pathStr.substr(lastSlash + 1).c_str(), sizeof(processName) - 1);
            }
        }
        CloseHandle(hProcess);
    }

    std::string lowerProc = toLower(processName);
    std::string lowerFullPath = toLower(fullPath);

    // Ignora processos internos do sistema, shell UWP e do próprio Voxy
    if (lowerProc == "explorer.exe" || lowerProc == "taskmgr.exe" || 
        lowerProc == "voxy.exe" || lowerProc == "systemsettings.exe" ||
        lowerProc == "searchhost.exe" || lowerProc == "shellexperiencehost.exe" ||
        lowerProc == "applicationframehost.exe" || lowerProc == "textinputhost.exe" ||
        lowerProc == "startmenuexperiencehost.exe" || lowerProc == "lockapp.exe") {
        return TRUE;
    }

    WindowGraphicsInfo info = {};
    info.hwnd = hwnd;
    info.pid = pid;
    info.processName = processName;
    info.fullPath = fullPath;
    info.windowTitle = title;
    info.isVisible = true;

    // Inspeciona módulos DirectX / Vulkan / OpenGL
    inspectProcessGraphicsModules(pid, info);

    // Heurística de Jogo Inteligente:
    // 1. Processo carregou módulos de renderização 3D reais (Direct3D 11, Direct3D 12, Vulkan, OpenGL, D3D9+DXGI)
    bool uses3DGraphics = (info.hasD3D11 || info.hasD3D12 || info.hasVulkan || info.hasOpenGL || (info.hasD3D9 && info.hasDXGI));

    // 2. Processo protegido por Anti-Cheat (EAC, BattlEye, Vanguard bloqueiam PROCESS_VM_READ)
    bool isAntiCheatGame = info.isAntiCheatProtected;

    // 3. Executável está em diretório de jogos ou tem convenção de engine de jogo (Unreal/Unity: *Game.exe, *Shipping.exe)
    bool isGameDirectoryOrNaming = (
        lowerFullPath.find("steamapps") != std::string::npos ||
        lowerFullPath.find("epic games") != std::string::npos ||
        lowerFullPath.find("riot games") != std::string::npos ||
        lowerFullPath.find("\\games\\") != std::string::npos ||
        lowerFullPath.find("/games/") != std::string::npos ||
        lowerProc.find("game.exe") != std::string::npos ||
        lowerProc.find("shipping.exe") != std::string::npos
    );

    // Aplicativos comuns que NUNCA são jogos (para evitar falsos positivos de navegadores e IDEs)
    bool isKnownDesktopApp = (
        lowerProc.find("chrome") != std::string::npos ||
        lowerProc.find("msedge") != std::string::npos ||
        lowerProc.find("firefox") != std::string::npos ||
        lowerProc.find("brave") != std::string::npos ||
        lowerProc.find("opera") != std::string::npos ||
        lowerProc.find("code") != std::string::npos ||
        lowerProc.find("devenv") != std::string::npos ||
        lowerProc.find("discord") != std::string::npos ||
        lowerProc.find("slack") != std::string::npos ||
        lowerProc.find("spotify") != std::string::npos ||
        lowerProc.find("steam") != std::string::npos ||
        lowerProc.find("epicgameslauncher") != std::string::npos ||
        lowerProc.find("antigravity") != std::string::npos ||
        lowerProc.find("whatsapp") != std::string::npos ||
        lowerProc.find("powertoys") != std::string::npos ||
        lowerProc.find("wdadesktop") != std::string::npos ||
        lowerProc.find("notes") != std::string::npos
    );

    // É um jogo se usar gráficos 3D ou for protegido por anti-cheat ou estiver em pasta/nome de jogo
    info.isGameCandidate = (!isKnownDesktopApp) && (uses3DGraphics || isAntiCheatGame || isGameDirectoryOrNaming);

    auto* list = reinterpret_cast<std::vector<WindowGraphicsInfo>*>(lParam);
    list->push_back(info);

    return TRUE;
}

int main() {
    // Configura stdout para UTF-8
    SetConsoleOutputCP(CP_UTF8);

    // Garante que o processo esteja conectado à estação de janela e desktop interativo do usuário (WinSta0\Default)
    HWINSTA hWinSta = OpenWindowStationA("WinSta0", FALSE, MAXIMUM_ALLOWED);
    if (hWinSta) {
        SetProcessWindowStation(hWinSta);
        HDESK hDesk = OpenDesktopA("Default", 0, FALSE, MAXIMUM_ALLOWED);
        if (hDesk) {
            SetThreadDesktop(hDesk);
        }
    }

    std::vector<WindowGraphicsInfo> windows;
    EnumWindows(EnumWindowsProc, reinterpret_cast<LPARAM>(&windows));

    // Saída em JSON para o Electron consumir de forma ultra rápida
    std::cout << "[\n";
    for (size_t i = 0; i < windows.size(); i++) {
        const auto& w = windows[i];
        std::cout << "  {\n";
        std::cout << "    \"hwnd\": \"" << reinterpret_cast<uintptr_t>(w.hwnd) << "\",\n";
        std::cout << "    \"pid\": " << w.pid << ",\n";
        std::cout << "    \"processName\": \"" << escapeJson(w.processName) << "\",\n";
        std::cout << "    \"fullPath\": \"" << escapeJson(w.fullPath) << "\",\n";
        std::cout << "    \"windowTitle\": \"" << escapeJson(w.windowTitle) << "\",\n";
        std::cout << "    \"isGame\": " << (w.isGameCandidate ? "true" : "false") << ",\n";
        std::cout << "    \"antiCheat\": " << (w.isAntiCheatProtected ? "true" : "false") << ",\n";
        std::cout << "    \"graphics\": {\n";
        std::cout << "      \"d3d11\": " << (w.hasD3D11 ? "true" : "false") << ",\n";
        std::cout << "      \"d3d12\": " << (w.hasD3D12 ? "true" : "false") << ",\n";
        std::cout << "      \"dxgi\": " << (w.hasDXGI ? "true" : "false") << ",\n";
        std::cout << "      \"vulkan\": " << (w.hasVulkan ? "true" : "false") << ",\n";
        std::cout << "      \"opengl\": " << (w.hasOpenGL ? "true" : "false") << ",\n";
        std::cout << "      \"d3d9\": " << (w.hasD3D9 ? "true" : "false") << "\n";
        std::cout << "    }\n";
        std::cout << "  }" << (i + 1 < windows.size() ? "," : "") << "\n";
    }
    std::cout << "]\n";

    return 0;
}
