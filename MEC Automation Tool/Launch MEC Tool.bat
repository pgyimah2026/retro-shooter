@echo off
title MEC Automation Tool
cd /d "%~dp0"
echo Starting MEC Automation Tool...
echo.

REM Open browser after 3 seconds (runs in background while server starts)
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000"

REM Run server in foreground -- closing this window stops the server
"C:\Users\gyima\anaconda3\python.exe" web_app.py

echo.
echo Server stopped. Press any key to close.
pause >nul
