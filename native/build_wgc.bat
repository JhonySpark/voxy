@echo off
setlocal
echo [Voxy Native WGC] Initializing Visual Studio 2022 Developer Environment...
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64

if not exist "..\electron\bin" mkdir "..\electron\bin"

echo [Voxy Native WGC] Compiling wgc_capture.cpp and wgc_main.cpp with cl.exe (C++17 / WinRT)...
cl.exe /nologo /O2 /EHsc /std:c++17 /await:strict wgc_capture.cpp wgc_main.cpp /Fe:"..\electron\bin\vx_rt_f52d.exe" /link d3d11.lib dxgi.lib windowsapp.lib user32.lib kernel32.lib

if %errorlevel% neq 0 (
    echo [Voxy Native WGC] Compilation FAILED with error %errorlevel%
    exit /b %errorlevel%
)

echo [Voxy Native WGC] Compilation SUCCEEDED: ..\electron\bin\vx_rt_f52d.exe
del /q *.obj 2>nul
exit /b 0
