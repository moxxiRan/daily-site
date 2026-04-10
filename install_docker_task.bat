@echo off
schtasks /create /tn "DailyDockerStart" /tr "\"C:\Users\arashiduan\daily-site\start_docker_daily.bat\"" /sc DAILY /st 09:30 /rl HIGHEST /f
echo Done.
pause >nul
