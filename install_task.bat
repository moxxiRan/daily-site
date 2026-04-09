@echo off
schtasks /create /tn "DifyPublisher" /tr "\"C:\Users\arashiduan\AppData\Local\Microsoft\WindowsApps\pythonw.exe\" \"C:\Users\arashiduan\daily-site\dify_publisher_service.pyw\"" /sc ONLOGON /rl HIGHEST /f
echo Done. Press any key to exit.
pause >nul
