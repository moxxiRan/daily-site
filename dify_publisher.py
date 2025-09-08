# dify_publisher.py (v10 - 时区兜底 + 兼容 text/text_input/纯文本/双重JSON/Chunked)
# 本地 HTTP 服务：接收 Dify Webhook，分类归档 Markdown 到 GitHub Pages 仓库，并更新 manifest.json 后 push

import http.server
import socketserver
import json
import os
import subprocess
from datetime import datetime, timezone, timedelta
import tempfile
import shutil
import re
from typing import Tuple

# ===== 用户需配置 =====
GITHUB_REPO_PATH = r"C:\Users\arashiduan\daily-site"  # 本地仓库绝对路径
PORT = 9397                                           # 监听端口

# ===== 时区：优先用 ZoneInfo("Asia/Shanghai")；失败则兜底为固定 UTC+08:00 =====
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
    try:
        CN_TZ = ZoneInfo("Asia/Shanghai")
        TZ_LABEL = "ZoneInfo(Asia/Shanghai)"
    except Exception:
        CN_TZ = timezone(timedelta(hours=8), name="Asia/Shanghai")
        TZ_LABEL = "FixedOffset(+08:00)"
except Exception:
    CN_TZ = timezone(timedelta(hours=8), name="Asia/Shanghai")
    TZ_LABEL = "FixedOffset(+08:00)"


# ===== 分类规则 =====
def classify(content: str) -> str:
    # 命中 🎮 或 “游戏行业速递” → game，否则 ai
    return "game" if ("🎮" in content or "游戏行业速递" in content) else "ai"


# ===== 提取标题/摘要 =====
def extract_title_summary(md: str) -> Tuple[str, str]:
    # 标题：首个一级标题，否则首行非空文本
    m = re.search(r'^\s*#\s+(.+)$', md, flags=re.M)
    title = m.group(1).strip() if m else (next((ln.strip() for ln in md.splitlines() if ln.strip()), "日报"))

    # 摘要：粗糙去 Markdown 标记，抓前 ~120 字
    plain = re.sub(r'`{1,3}.*?`{1,3}', '', md, flags=re.S)              # 行内/代码块
    plain = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', plain)                  # 图片
    plain = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', plain)              # 链接 -> 文本
    plain = re.sub(r'[#>*_`~\-]+', ' ', plain)                          # 修饰符
    plain = re.sub(r'\s+', ' ', plain).strip()
    short = (plain[:120] + '...') if len(plain) > 120 else plain
    return title, short


# ===== 原子写文件 =====
def atomic_write(path: str, data: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with tempfile.NamedTemporaryFile('w', delete=False, encoding='utf-8', newline='\n') as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    shutil.move(tmp_path, path)


# ===== manifest 初始化 & 覆盖逻辑 =====
def load_or_init_manifest(manifest_path: str) -> dict:
    if not os.path.exists(manifest_path):
        return {"months": {"ai": {}, "game": {}}}
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return {"months": {"ai": {}, "game": {}}}
    data.setdefault("months", {})
    data["months"].setdefault("ai", {})
    data["months"].setdefault("game", {})
    return data


def upsert_manifest(manifest: dict, category: str, yyyy: str, mm: str, dd: str, title: str, summary: str):
    month_key = f"{yyyy}-{mm}"
    manifest["months"].setdefault(category, {})
    manifest["months"][category].setdefault(month_key, [])

    date_str = f"{yyyy}-{mm}-{dd}"
    url_path = f"{category}/{yyyy}/{mm}/{dd}.md"
    new_entry = {
        "date": date_str,
        "title": title,
        "summary": summary,
        "tags": [category.capitalize(), "Daily"],
        "url": url_path
    }
    # 覆盖同日：删同日期旧条目，插到最前
    entries = [e for e in manifest["months"][category][month_key] if e.get("date") != date_str]
    entries.insert(0, new_entry)
    manifest["months"][category][month_key] = entries
    return manifest


# ===== Git 操作 =====
def run_git(cmd, cwd):
    # 避免“dubious ownership”
    try:
        subprocess.run(["git", "config", "--global", "--add", "safe.directory", cwd], check=False, cwd=cwd)
    except Exception:
        pass
    return subprocess.run(cmd, check=True, cwd=cwd)


def git_commit_push(cwd: str, message: str):
    run_git(["git", "add", "."], cwd)
    # 无变更就跳过 commit
    rs = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=cwd)
    if rs.returncode == 0:
        print("ℹ️ 无文件变更，跳过提交。")
        return
    run_git(["git", "commit", "-m", message], cwd)
    run_git(["git", "push", "origin", "main"], cwd)


# ===== 主处理逻辑 =====
def process_dify_report(content: str):
    print(f"🚀 处理 Dify 报告 ...（TZ={TZ_LABEL}）")
    if not content or not content.strip():
        print("❌ 内容为空，忽略。")
        return

    category = classify(content)
    print(f"✅ 分类：{category}")

    # 用北京时间生成归档路径（ZoneInfo 可用则用；否则使用固定 UTC+08:00）
    now_cn = datetime.now(CN_TZ)
    yyyy, mm, dd = now_cn.strftime("%Y"), now_cn.strftime("%m"), now_cn.strftime("%d")
    date_str = f"{yyyy}-{mm}-{dd}"

    if not os.path.isdir(GITHUB_REPO_PATH):
        print(f"❌ 仓库目录不存在：{GITHUB_REPO_PATH}")
        return

    os.chdir(GITHUB_REPO_PATH)
    print(f"📁 仓库目录：{GITHUB_REPO_PATH}")

    # 写 Markdown
    md_dir = os.path.join("public", category, yyyy, mm)
    md_path = os.path.join(md_dir, f"{dd}.md")
    atomic_write(md_path, content)
    print(f"✅ Markdown 写入：{md_path}")

    # 更新 manifest.json（覆盖同日、顶端插入）
    manifest_path = os.path.join("public", "manifest.json")
    manifest = load_or_init_manifest(manifest_path)
    title, summary = extract_title_summary(content)
    manifest = upsert_manifest(manifest, category, yyyy, mm, dd, title, summary)
    atomic_write(manifest_path, json.dumps(manifest, ensure_ascii=False, indent=2))
    print("✅ manifest.json 已更新。")

    # Git 提交推送
    commit_msg = f"docs(content): Update {category.upper()} daily report for {date_str}"
    print("⏳ Git 提交中 ...")
    try:
        git_commit_push(GITHUB_REPO_PATH, commit_msg)
        print("🎉 推送完成。")
    except subprocess.CalledProcessError as e:
        print(f"❌ Git 失败：{e}")


# ===== Webhook Server =====
class WebhookHandler(http.server.SimpleHTTPRequestHandler):
    # 支持 chunked & content-length
    def _read_body(self) -> bytes:
        te = (self.headers.get("Transfer-Encoding") or "").lower()
        if "chunked" in te:
            body = b""
            while True:
                line = self.rfile.readline().strip()
                if not line:
                    break
                size = int(line, 16)
                if size == 0:
                    self.rfile.readline()  # 末尾空行
                    break
                body += self.rfile.read(size)
                self.rfile.readline()    # 每个 chunk 的 \r\n
            return body
        n = int(self.headers.get("Content-Length", "0"))
        return self.rfile.read(n)

    def do_POST(self):
        if self.path != "/webhook":
            self.send_response(404); self.end_headers(); return
        try:
            raw = self._read_body()
            body = raw.decode("utf-8", errors="replace").strip()

            # 调试：打印顶层体预览（可注释掉）
            try:
                dbg = (body[:200] + '...') if len(body) > 200 else body
                print(f"🔍 请求体预览: {dbg}")
            except Exception:
                pass

            content = None
            data = None

            # 1) 尝试把 body 当 JSON
            try:
                data = json.loads(body)
            except Exception:
                data = None

            if isinstance(data, dict):
                # 1a) 直接 content
                content = data.get("content")

                # 1b) 常见包装：text_input / text / final_report_markdown
                if not content:
                    candidate = (
                        data.get("text_input")
                        or data.get("text")                    # Dify 某些形态发这个
                        or data.get("final_report_markdown")
                    )
                    if isinstance(candidate, dict):
                        content = (
                            candidate.get("content")
                            or candidate.get("text")
                            or candidate.get("final_report_markdown")
                        )
                    elif isinstance(candidate, str) and candidate:
                        # 可能是再次序列化的 JSON 字符串 → 再解一次
                        try:
                            inner = json.loads(candidate)
                            if isinstance(inner, dict):
                                content = (
                                    inner.get("content")
                                    or inner.get("text")
                                    or inner.get("final_report_markdown")
                                )
                            else:
                                content = candidate
                        except Exception:
                            content = candidate
            else:
                # 2) body 不是 JSON：当纯文本 Markdown
                content = body

            if not content or not content.strip():
                raise ValueError("未找到内容（content/text_input/text），或为空。")

            # 异步处理
            from threading import Thread
            Thread(target=process_dify_report, args=(content,), daemon=True).start()

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')

        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            preview = body[:200] if 'body' in locals() else ""
            msg = json.dumps({"error": str(e), "preview": preview}, ensure_ascii=False).encode("utf-8")
            self.wfile.write(msg)


if __name__ == "__main__":
    print(f"--- Dify Publisher (v10) ---  Using TZ: {TZ_LABEL}")
    print(f"Listening: http://127.0.0.1:{PORT}/webhook")
    print(f"Set Dify Webhook URL to: http://host.docker.internal:{PORT}/webhook")
    with socketserver.TCPServer(("", PORT), WebhookHandler) as httpd:
        httpd.serve_forever()
