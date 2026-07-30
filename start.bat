@echo off
chcp 65001 > NUL
title Clean KENKOU ERP - 開発サーバー起動

cd /d "%~dp0"
set "PATH=%USERPROFILE%\.node\node-v20.18.0-win-x64;%PATH%"

echo ========================================================
echo Clean KENKOU ERP 開発サーバーを起動しています...
echo ========================================================
echo.

npm run dev

pause
