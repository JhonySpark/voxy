@echo off
setlocal
echo ======================================================================
echo  Compilando todos os binarios de runtime nativos do Voxy (Otimizados)
echo ======================================================================

if not exist "..\electron\bin" mkdir "..\electron\bin"

echo [1/4] Compilando vx_rt_b18e.exe (Runtime Probe)...
call "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /optimize /platform:x64 /target:exe /out:"..\electron\bin\vx_rt_b18e.exe" sys_probe.cs

echo [2/4] Compilando vx_rt_c831.exe (Runtime Inspector)...
call build_detector.bat

echo [3/4] Compilando vx_rt_a94f.exe (Hardware Pipeline Host)...
call build_native_streamer.bat

echo [4/4] Compilando vx_rt_f52d.exe (Graphics Helper)...
call build_wgc.bat

echo [5/5] Gerando manifesto de integridade criptografica (SHA-256)...
call node ..\scripts\generate_native_manifest.js

echo ======================================================================
echo  TODOS OS BINARIOS E MANIFESTO DE INTEGRIDADE FORAM GERADOS COM SUCESSO!
echo ======================================================================
exit /b 0
