@echo off
chcp 65001 >nul
title Instalador AURA TV v2.1 para Samsung Smart TV (Tizen)
echo ====================================================================
echo         AURA TV v2.1 - INSTALADOR SAMSUNG SMART TV (TIZEN)
echo ====================================================================
echo.
echo PASOS PREVIOS EN EL TELEVISOR SAMSUNG:
echo  1. Abre "Apps" en el televisor Samsung.
echo  2. Presiona "12345" con los numeros del control remoto.
echo  3. Activa "Developer Mode" = ON y escribe la IP de este PC.
echo  4. Apaga y prende el televisor (manteniendo presionado Power 5 seg).
echo.
set /p TV_IP="Ingresa la direccion IP del TV Samsung (ej. 192.168.1.50): "

if "%TV_IP%"=="" (
    echo [!] Debes ingresar la IP del televisor Samsung.
    pause
    exit /b 1
)

set "TIZEN_DIR=C:\tizen-studio"
if exist "%USERPROFILE%\tizen-studio\tools\sdb.exe" set "TIZEN_DIR=%USERPROFILE%\tizen-studio"
if exist "C:\TizenStudio\tools\sdb.exe" set "TIZEN_DIR=C:\TizenStudio"
if exist "%LOCALAPPDATA%\Programs\tizen-studio\tools\sdb.exe" set "TIZEN_DIR=%LOCALAPPDATA%\Programs\tizen-studio"

if not exist "%TIZEN_DIR%\tools\sdb.exe" (
    echo.
    echo [!] No se encontro Tizen Studio CLI en %TIZEN_DIR%.
    echo     Descargalo gratis desde: https://developer.tizen.org/development/tizen-studio/download
    echo     ^(Solo necesitas el "Package Manager / CLI Installer"^).
    pause
    exit /b 1
)

echo.
echo [1/3] Conectando con el TV Samsung en %TV_IP%:26101...
"%TIZEN_DIR%\tools\sdb.exe" connect %TV_IP%:26101

echo.
echo [2/3] Verificando paquete AURA TV (.wgt)...
if exist "%~dp0AuraTV.wgt" (
    echo     Usando paquete listo: AuraTV.wgt
) else (
    if exist "%TIZEN_DIR%\tools\ide\bin\tizen.bat" (
        call "%TIZEN_DIR%\tools\ide\bin\tizen.bat" package -t wgt -- "%~dp0"
    )
)

echo.
echo [3/3] Instalando AURA TV en el televisor Samsung...
if exist "%TIZEN_DIR%\tools\ide\bin\tizen.bat" (
    if exist "%~dp0AuraTV.wgt" (
        call "%TIZEN_DIR%\tools\ide\bin\tizen.bat" install -n "AuraTV.wgt" -- "%~dp0"
    ) else (
        for %%f in ("%~dp0*.wgt") do (
            call "%TIZEN_DIR%\tools\ide\bin\tizen.bat" install -n "%%~nxf" -- "%~dp0"
        )
    )
) else (
    "%TIZEN_DIR%\tools\sdb.exe" install "%~dp0AuraTV.wgt"
)

echo.
echo ====================================================================
echo  LISTO! Busca el icono de AURA TV en la seccion de Apps de tu TV.
echo ====================================================================
pause
