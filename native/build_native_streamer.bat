@echo off
setlocal
echo ======================================================================
echo  Compilando Voxy Native Streamer (WGC + NVENC + LiveKit C++ SDK)
echo ======================================================================

echo [1/3] Inicializando Ambiente Visual Studio 2022 (MSVC x64)...
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64

if not exist "..\electron\bin" mkdir "..\electron\bin"

echo [2/3] Copiando DLLs necessarias para electron/bin...
copy /Y "livekit\bin\*.dll" "..\electron\bin\" >nul

echo [3/3] Compilando voxy_native_streamer.exe...
cl.exe /nologo /O2 /EHsc /std:c++17 /await:strict ^
    /I"livekit\include" /I"nvenc\include" ^
    wgc_capture.cpp nvenc_encoder.cpp d3d11_scaler.cpp voxy_native_streamer.cpp ^
    /Fe:"..\electron\bin\voxy_native_streamer.exe" ^
    /link /LIBPATH:"livekit\lib" livekit.lib ^
    d3d11.lib dxgi.lib d3dcompiler.lib windowsapp.lib user32.lib kernel32.lib ole32.lib

if %errorlevel% neq 0 (
    echo [ERRO] Falha na compilacao com codigo %errorlevel%
    del /q *.obj 2>nul
    exit /b %errorlevel%
)

echo ======================================================================
echo  SUCESSO: ..\electron\bin\voxy_native_streamer.exe gerado com sucesso!
echo ======================================================================
del /q *.obj 2>nul
exit /b 0
