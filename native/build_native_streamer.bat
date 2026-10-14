@echo off
setlocal
echo ======================================================================
echo  Compilando Voxy Transmission Audio (WGC + NVENC + Audio Loopback + LiveKit)
echo ======================================================================

echo [1/4] Inicializando Ambiente Visual Studio 2022 (MSVC x64)...
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64

if not exist "..\electron\bin" mkdir "..\electron\bin"

echo [2/4] Copiando DLLs necessarias para electron/bin...
copy /Y "livekit\bin\*.dll" "..\electron\bin\" >nul

echo [3/4] Compilando arquivo de recursos de versao e icone (voxy_transmission_audio.rc)...
rc.exe /nologo /fo"voxy_transmission_audio.res" voxy_transmission_audio.rc
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao compilar arquivo de recursos (.rc)
    exit /b %errorlevel%
)

echo [4/4] Compilando voxy_transmission_audio.exe...
cl.exe /nologo /O2 /EHsc /std:c++17 /await:strict ^
    /I"livekit\include" /I"nvenc\include" ^
    wgc_capture.cpp nvenc_encoder.cpp d3d11_scaler.cpp process_loopback_audio.cpp voxy_native_streamer.cpp ^
    voxy_transmission_audio.res ^
    /Fe:"..\electron\bin\voxy_transmission_audio.exe" ^
    /link /LIBPATH:"livekit\lib" livekit.lib ^
    d3d11.lib dxgi.lib d3dcompiler.lib windowsapp.lib user32.lib kernel32.lib ole32.lib mmdevapi.lib

if %errorlevel% neq 0 (
    echo [ERRO] Falha na compilacao com codigo %errorlevel%
    del /q *.obj *.res 2>nul
    exit /b %errorlevel%
)

:: Mantem copia com espacos caso o sistema operacional consulte por nome descritivo direto
copy /Y "..\electron\bin\voxy_transmission_audio.exe" "..\electron\bin\Voxy Transmission Audio.exe" >nul

echo ======================================================================
echo  SUCESSO: voxy_transmission_audio.exe gerado com sucesso em electron/bin!
echo  Nome no Mixer de Audio: Voxy Transmission Audio
echo ======================================================================
del /q *.obj *.res 2>nul
exit /b 0
