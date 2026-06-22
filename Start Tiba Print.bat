@echo off
REM ─────────────────────────────────────────────────────────────
REM  Tiba Print — one-click launcher (Windows)
REM  Double-click this file to start the app.
REM ─────────────────────────────────────────────────────────────
title Tiba Print
cd /d "%~dp0"

echo.
echo   Tiba Print - DTF Layout ^& Nesting
echo   ---------------------------------
echo.

REM 1) Check Node.js - install automatically via winget if missing
where node >nul 2>nul
if errorlevel 1 (
  echo   [..] Node.js not found - installing it for you via winget...
  echo.
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  REM Refresh PATH for this session so node is found right away
  set "PATH=%PATH%;%ProgramFiles%\nodejs\"
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo   [X] Couldn't install Node.js automatically.
    echo       Install it manually from https://nodejs.org ^(LTS^), then run this again.
    echo       ^(You may also just need to close and re-open this launcher.^)
    echo.
    pause
    exit /b 1
  )
)
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
