@echo off
REM ─────────────────────────────────────────────────────────────
REM  Tiba Print — one-click launcher (Windows)
REM  Double-click this file to start the app.
REM  • Installs Node.js automatically if missing (winget, or official MSI)
REM  • Installs app dependencies on first run
REM  • Starts the local server and opens your browser
REM ─────────────────────────────────────────────────────────────
title Tiba Print
cd /d "%~dp0"
setlocal enabledelayedexpansion

echo.
echo   Tiba Print - DTF Layout ^& Nesting
echo   ---------------------------------
echo.

REM 1) Check Node.js
where node >nul 2>nul
if not errorlevel 1 goto NODE_OK

echo   [..] Node.js not found - installing it for you...
echo.

REM --- Try winget first (built into Windows 10/11) ---
where winget >nul 2>nul
if not errorlevel 1 (
  echo   [..] Installing Node.js via winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
)

REM Refresh PATH so a freshly installed node is found in THIS window.
set "PATH=%PATH%;%ProgramFiles%\nodejs\;%ProgramFiles(x86)%\nodejs\"
where node >nul 2>nul
if not errorlevel 1 goto NODE_OK

REM --- Fallback: download the official Node.js MSI and install it silently ---
echo   [..] winget unavailable or failed - downloading official Node.js installer...
set "NODE_MSI=%TEMP%\nodejs-lts.msi"
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi' -OutFile '%NODE_MSI%' } catch { exit 1 }"
if exist "%NODE_MSI%" (
  echo   [..] Installing Node.js ^(a User Account Control prompt may appear - click Yes^)...
  msiexec /i "%NODE_MSI%" /qb
  del "%NODE_MSI%" >nul 2>nul
  set "PATH=%PATH%;%ProgramFiles%\nodejs\"
)

where node >nul 2>nul
if not errorlevel 1 goto NODE_OK

echo.
echo   [X] Couldn't install Node.js automatically.
echo       Install it manually from https://nodejs.org ^(LTS^), then run this again.
echo       ^(You may also just need to close and re-open this launcher.^)
echo.
pause
exit /b 1

:NODE_OK
for /f "delims=" %%v in ('node --version') do echo   [ok] Node.js %%v found

REM 2) Install dependencies only if missing
if not exist "node_modules\next" (
  echo   [..] First run - installing dependencies ^(this can take a few minutes^)...
  call npm install
  if errorlevel 1 (
    echo   [X] Install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
  echo   [ok] Dependencies installed
) else (
  echo   [ok] Dependencies already installed
)

REM 3) Open browser after the server boots
start "" cmd /c "timeout /t 4 >nul & start http://localhost:4040"

echo.
echo   Starting the app at http://localhost:4040
echo   ^(Your browser will open automatically.^)
echo.
echo   Keep this window OPEN while using the app.
echo   Close it to stop the app.
echo.

call npm run dev
pause
