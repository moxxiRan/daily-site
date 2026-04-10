@echo off
:: 每天 9:30 由计划任务调用，确保 Docker Desktop 和 Dify 容器全部就绪

:: 1. 启动 Docker Desktop（如果没在运行）
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I "Docker Desktop.exe" >NUL
if errorlevel 1 (
    echo [%date% %time%] Docker Desktop 未运行，正在启动...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    echo [%date% %time%] Docker Desktop 已在运行。
)

:: 2. 等待 Docker Engine 就绪（最多等 120 秒）
echo [%date% %time%] 等待 Docker Engine 就绪...
set /a count=0
:wait_docker
docker info >NUL 2>&1
if errorlevel 1 (
    set /a count+=1
    if %count% GEQ 24 (
        echo [%date% %time%] 超时：Docker Engine 120 秒内未就绪，退出。
        exit /b 1
    )
    timeout /t 5 /nobreak >NUL
    goto wait_docker
)
echo [%date% %time%] Docker Engine 已就绪。

:: 3. 启动 Dify 容器
echo [%date% %time%] 启动 Dify 容器...
docker compose -f "F:\dify-docker\docker\docker-compose.yaml" up -d
echo [%date% %time%] Dify 容器已启动。

:: 4. 启动 n8n 容器
echo [%date% %time%] 启动 n8n 容器...
docker compose -f "F:\n8n-docker\docker-compose.yml" up -d
echo [%date% %time%] n8n 容器已启动。

:: 5. 启动 RSSHub（独立容器）
echo [%date% %time%] 启动 RSSHub...
docker start rsshub 2>NUL
echo [%date% %time%] 全部完成。
