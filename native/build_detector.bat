@echo off
setlocal
echo [Voxy Native] Initializing Visual Studio 2022 Developer Environment...
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64

if not exist "..\electron\bin" mkdir "..\electron\bin"

echo [Voxy Native] Compiling game_detector.cpp with cl.exe (O2 Speed Optimization)...
cl.exe /nologo /O2 /EHsc /std:c++17 game_detector.cpp /Fe:"..\electron\bin\voxy_game_detector.exe" /link psapi.lib user32.lib kernel32.lib

if %errorlevel% neq 0 (
    echo [Voxy Native] Compilation FAILED with error %errorlevel%
    exit /b %errorlevel%
)

echo [Voxy Native] Compilation SUCCEEDED: ..\electron\bin\voxy_game_detector.exe
del /q *.obj 2>nul
exit /b 0
