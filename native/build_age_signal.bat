@echo off
setlocal
echo [Voxy Native] Initializing Visual Studio 2022 Developer Environment...
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64

if not exist "..\electron\bin" mkdir "..\electron\bin"

echo [Voxy Native] Compiling age_signal.cpp with cl.exe (C++17 / WinRT)...
cl.exe /nologo /O2 /EHsc /std:c++17 /await:strict age_signal.cpp /Fe:"test_age_signal.exe" /link windowsapp.lib user32.lib kernel32.lib

if %errorlevel% neq 0 (
    echo [Voxy Native] Compilation FAILED with error %errorlevel%
    exit /b %errorlevel%
)

echo [Voxy Native] Compilation SUCCEEDED
del /q *.obj 2>nul
exit /b 0
