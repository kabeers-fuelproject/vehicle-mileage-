@echo off
findstr /C:"api.trycloudflare.com" %SystemRoot%\System32\drivers\etc\hosts >nul
if errorlevel 1 (
  echo 104.18.32.47 api.trycloudflare.com>> %SystemRoot%\System32\drivers\etc\hosts
)
ipconfig /flushdns
echo Done: hosts entry added and DNS flushed.
pause
