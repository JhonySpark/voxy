@echo off
setlocal
echo ======================================================================
echo  Voxy - Iniciando Empacotamento MSIX para Microsoft Windows Store
echo ======================================================================

cd /d "%~dp0"

node scripts\build_msix.js
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Ocorreu uma falha na geracao do pacote MSIX.
    exit /b %errorlevel%
)

exit /b 0
