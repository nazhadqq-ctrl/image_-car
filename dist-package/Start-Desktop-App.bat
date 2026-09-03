@echo off
title تۆماری تاقیگەکان - دەستپێکردن
cd /d "%~dp0"

:: 1. Auto-detect Node binary
set "NODE_EXE="
if exist "%~dp0bin\node.exe" (
    set "NODE_EXE=%~dp0bin\node.exe"
) else if exist "%~dp0node.exe" (
    set "NODE_EXE=%~dp0node.exe"
) else if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
) else if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
    set "NODE_EXE=%LOCALAPPDATA%\Programs\node\node.exe"
) else (
    where node >nul 2>&1
    if %errorlevel% equ 0 set "NODE_EXE=node"
)

if "%NODE_EXE%"=="" (
    echo [ERROR] Node.js was not found!
    mshta "javascript:alert('تکایە سەرەتا Node.js دابمەزرێنە یان فایلی Setup.exe بەکاربهێنە.\n\nPlease install Node.js or run Setup.exe.');close();"
    exit /b 1
)

:: 2. Find and kill any hung process holding port 3002
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3002') do (
    if not "%%a"=="0" taskkill /F /PID %%a >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul

:: 3. Start the background Node server silently
start /b "" "%NODE_EXE%" "%~dp0server.js" >nul 2>&1

:: 4. Active Health Check Loop - Wait until localhost:3002 is fully ready
set /a ATTEMPTS=0
:WAIT_LOOP
set /a ATTEMPTS+=1
powershell -NoProfile -NonInteractive -Command "try { $r = [System.Net.WebRequest]::Create('http://127.0.0.1:3002/api/setup-status'); $r.Timeout = 800; $resp = $r.GetResponse(); if ($resp.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto LAUNCH_BROWSER

if %ATTEMPTS% geq 25 goto LAUNCH_BROWSER

ping 127.0.0.1 -n 1 -w 300 >nul
goto WAIT_LOOP

:LAUNCH_BROWSER
:: 5. Launch dedicated standalone app window
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3002 --start-maximized
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3002 --start-maximized
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3002 --start-maximized
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3002 --start-maximized
) else (
    start http://localhost:3002
)

exit
