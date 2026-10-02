@echo off
chcp 65001 > nul
echo ========================================================
echo   Clean KENKOU ERP 社内説明会スライドをブラウザで開きます
echo ========================================================
echo.
start "" "%~dp0docs\presentation_slides.html"
exit
