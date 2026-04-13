@echo off
chcp 65001 >NUL 2>&1
setlocal enabledelayedexpansion
set "LOGFILE=%~dp0start_docker_daily.log"

call :log "========== Script Start =========="

tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I "Docker Desktop.exe" >NUL
if errorlevel 1 (
    call :log "Docker Desktop not running, starting..."
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    call :log "Docker Desktop already running."
)

call :log "Waiting for Docker Engine..."
set /a count=0
:wait_docker
docker info >NUL 2>&1
if errorlevel 1 (
    set /a count+=1
    if !count! GEQ 24 (
        call :log "TIMEOUT: Docker Engine not ready in 120s, exit."
        exit /b 1
    )
    ping -n 6 127.0.0.1 >NUL 2>&1
    goto wait_docker
)
call :log "Docker Engine ready. Waiting 15s for Linux Engine pipe..."
ping -n 16 127.0.0.1 >NUL 2>&1

call :log "Starting Dify containers..."
docker compose -f "F:\dify-docker\docker\docker-compose.yaml" -f "F:\dify-docker\docker\docker-compose.override.yaml" up -d 2>&1
if errorlevel 1 (
    call :log "WARN: Dify failed, retry in 15s..."
    ping -n 16 127.0.0.1 >NUL 2>&1
    docker compose -f "F:\dify-docker\docker\docker-compose.yaml" -f "F:\dify-docker\docker\docker-compose.override.yaml" up -d 2>&1
    if errorlevel 1 (
        call :log "ERROR: Dify containers failed after retry!"
    ) else (
        call :log "Dify containers started (retry)."
    )
) else (
    call :log "Dify containers started."
)

call :log "Starting n8n containers..."
docker compose -f "F:\n8n-docker\docker-compose.yml" up -d 2>&1
if errorlevel 1 (
    call :log "WARN: n8n failed, retry in 10s..."
    ping -n 11 127.0.0.1 >NUL 2>&1
    docker compose -f "F:\n8n-docker\docker-compose.yml" up -d 2>&1
    if errorlevel 1 (
        call :log "ERROR: n8n containers failed after retry!"
    ) else (
        call :log "n8n containers started (retry)."
    )
) else (
    call :log "n8n containers started."
)

call :log "Starting RSSHub..."
docker start rsshub 2>NUL
call :log "========== All Done =========="

endlocal
exit /b 0

:log
echo [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOGFILE%"
goto :eof
