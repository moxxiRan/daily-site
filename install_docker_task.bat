@echo off
:: 删除旧任务（如存在）
schtasks /delete /tn "DailyDockerStart" /f >NUL 2>&1

:: 创建新的计划任务
:: /ri 1440  = 间隔 1440 分钟 (不实际使用，仅为满足参数)
:: /sc DAILY /st 09:30 = 每天 09:30
:: /rl HIGHEST = 最高权限运行
schtasks /create /tn "DailyDockerStart" ^
    /tr "\"C:\Users\arashiduan\daily-site\start_docker_daily.bat\"" ^
    /sc DAILY /st 09:30 ^
    /rl HIGHEST /f

:: 通过 PowerShell 补充配置 schtasks 无法设置的选项
powershell -Command ^
    "$task = Get-ScheduledTask -TaskName 'DailyDockerStart';" ^
    "$task.Settings.StartWhenAvailable = $true;" ^
    "$task.Settings.DisallowStartIfOnBatteries = $false;" ^
    "$task.Settings.StopIfGoingOnBatteries = $false;" ^
    "$task.Settings.WakeToRun = $true;" ^
    "Set-ScheduledTask -InputObject $task"

echo.
echo 计划任务 DailyDockerStart 已创建并优化：
echo   - 每天 09:30 运行
echo   - 错过执行时间后会尽快补执行 (StartWhenAvailable)
echo   - 电池模式下也会运行
echo   - 可唤醒休眠电脑运行
echo.
pause >nul
