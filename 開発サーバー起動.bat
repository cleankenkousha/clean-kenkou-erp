@echo off
chcp 65001 > NUL
title Clean KENKOU ERP - 開発サーバー起動

cd /d "%~dp0"
set "PATH=%USERPROFILE%\.node\node-v20.18.0-win-x64;%PATH%"

echo ========================================================
echo Clean KENKOU ERP 開発サーバーを起動しています...
echo ブラウザが自動的に開きます。終了するときはこのウィンドウを閉じてください。
echo ========================================================
echo.

npm run dev

pause
