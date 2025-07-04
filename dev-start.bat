@echo off
echo ========================================
echo FileBot Development Server Starter
echo ========================================

echo.
echo Starting all servers...

echo.
echo 1. Starting FileBot server...
start "FileBot Server" cmd /k "node server.js"

echo.
echo 2. Starting Filesystem server...
start "Filesystem Server" cmd /k "node test-filesystem-server.js"

echo.
echo ========================================
echo All servers started!
echo ========================================
echo.
echo Servers running on:
echo - FileBot: http://localhost:3000
echo - Filesystem: http://localhost:8080
echo.
echo Test with: curl http://localhost:3000/status
echo.
pause 