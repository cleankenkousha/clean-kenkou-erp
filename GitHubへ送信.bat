@echo off
chcp 65001 > nul
echo =========================================
echo  Clean KENKOU ERP - GitHub 送信ツール
echo =========================================
echo.
echo GitHub へコードを送信（Push）しています...
cd /d "%~dp0"
git push -u origin main
echo.
echo -----------------------------------------
echo 処理が終了しました。
pause
