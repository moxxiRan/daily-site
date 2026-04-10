@echo off
setlocal enabledelayedexpansion
:: 每天 9:30 由计划任务调用，确保 Docker Desktop 和 Dify 容器全部就绪
:: 日志输出到同目录下 start_docker_daily.log
set "LOGFILE=%~dp0start_docker_daily.log"

call :log "========== 脚本启动 =========="

:: 1. 启动 Docker Desktop（如果没在运行）
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I "Docker Desktop.exe" >NUL
if errorlevel 1 (
    call :log "Docker Desktop 未运行，正在启动..."
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    call :log "Docker Desktop 已在运行。"
)

:: 2. 等待 Docker Engine 就绪（最多等 120 秒）
call :log "等待 Docker Engine 就绪..."
set /a count=0
:wait_docker
docker info >NUL 2>&1
if errorlevel 1 (
    set /a count+=1
    if !count! GEQ 24 (
        call :log "超时：Docker Engine 120 秒内未就绪，退出。"
        exit /b 1
    )
    :: 用 ping 替代 timeout，避免在非交互式环境下报错
    ping -n 6 127.0.0.1 >NUL 2>&1
    goto wait_docker
)
call :log "Docker Engine 已就绪。"

:: 3. 启动 Dify 容器
call :log "启动 Dify 容器..."
docker compose -f "F:\dify-docker\docker\docker-compose.yaml" up -d
if errorlevel 1 (
    call :log "警告：Dify 容器启动失败！"
) else (
    call :log "Dify 容器已启动。"
)

:: 4. 启动 n8n 容器
call :log "启动 n8n 容器..."
docker compose -f "F:\n8n-docker\docker-compose.yml" up -d
if errorlevel 1 (
    call :log "警告：n8n 容器启动失败！"
) else (
    call :log "n8n 容器已启动。"
)

:: 5. 启动 RSSHub（独立容器）
call :log "启动 RSSHub..."
docker start rsshub 2>NUL
call :log "全部完成。"

endlocal
exit /b 0

:log
echo [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOGFILE%"
goto :eof
