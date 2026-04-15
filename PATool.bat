@echo off
echo ========================================
echo Starting PATool...
echo ========================================

:: Start Backend (server)
echo Starting Server...
start "Backend Server" cmd /k "cd /d C:\source\announce\server && node server.js"

:: Wait a few seconds for backend to start
timeout /t 5 >nul

:: Start Frontend (React)
echo Starting App...
start "Frontend App" cmd /k "cd /d C:\source\announce\announcements-app\src && npm start"

echo.
echo Both servers are starting...
echo.
echo Backend should be on: http://localhost:4000
echo Frontend should open in browser at: http://localhost:3000
echo.
echo Close these windows to stop the app.
pause