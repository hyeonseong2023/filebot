@echo off
echo ========================================
echo FileBot Development Server Stopper
echo ========================================

echo.
echo Stopping all FileBot servers...

echo.
echo Stopping Node.js processes...
taskkill /f /im node.exe 2>nul
if %errorlevel% equ 0 (
    echo Node.js processes stopped.
) else (
    echo No Node.js processes found.
)

echo.
echo ========================================
echo All servers stopped!
echo ========================================
echo.
pause 