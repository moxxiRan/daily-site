# dify_publisher_service.pyw
# 守护进程：后台无窗口运行 dify_publisher.py，崩溃自动重启
# 用法：pythonw dify_publisher_service.pyw  （无黑框）
#       python  dify_publisher_service.pyw  （有终端，调试用）

import subprocess
import sys
import os
import time
import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(SCRIPT_DIR, "dify_publisher.py")
LOG_FILE = os.path.join(SCRIPT_DIR, "dify_publisher.log")
RESTART_DELAY = 5  # 崩溃后重启等待秒数


def log(msg: str):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}\n"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass


def main():
    log("=== DifyPublisher 守护进程启动 ===")
    log(f"目标脚本: {TARGET}")
    log(f"Python: {sys.executable}")

    while True:
        log(f"启动 dify_publisher.py ...")
        try:
            # 用当前 Python 解释器运行目标脚本
            result = subprocess.run(
                [sys.executable, TARGET],
                cwd=SCRIPT_DIR,
                timeout=None,  # 永不超时，正常情况下 serve_forever() 不会退出
            )
            log(f"dify_publisher.py 退出，返回码: {result.returncode}")
        except KeyboardInterrupt:
            log("收到 Ctrl+C，守护进程退出。")
            break
        except Exception as e:
            log(f"异常: {e}")

        log(f"等待 {RESTART_DELAY} 秒后重启...")
        time.sleep(RESTART_DELAY)


if __name__ == "__main__":
    main()
