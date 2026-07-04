@echo off
setlocal
title Investment Research Dashboard - Vite Dev Server

cd /d "%~dp0"

echo.
echo Investment Research Dashboard
echo Starting Vite development server with hot reload...
echo.

if not exist "node_modules" (
  echo node_modules not found. Running npm install first...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Please check the error above.
    pause
    exit /b 1
  )
)

echo.
echo Dev URL will be shown below, usually http://localhost:5173/
echo Keep this window open while developing.
echo.

call npm run dev

echo.
echo Vite dev server stopped.
pause
