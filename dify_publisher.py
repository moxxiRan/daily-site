# dify_publisher.py (v14 - 自动修复 Markdown 换行格式)
# 本地 HTTP 服务：接收 Dify Webhook，自动修正排版，归档到 GitHub Pages 仓库，并更新 manifest.json 后 push

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
PUBLIC_DIR = "public"                                 # public 目录名
WRITE_TO_ROOT = True                                  # True: 同时写入仓库根目录与 public/

# ===== 时区：优先 ZoneInfo("Asia/Shanghai")；失败兜底 UTC+08:00 =====
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

# ===== manifest 默认模板 =====
DEFAULT_MANIFEST = {
  "site": {
    "title": "AI / 游戏 日报",
    "description": "每天 10 分钟，跟上 AI 与游戏进展",
    "baseUrl": ""
  },
  "categories": {
    "ai": "AI 日报",
    "game": "游戏日报"
  },
  "months": {
    "ai": {},
    "game": {}
  }
}


# ===== 核心改动：新增 Markdown 格式化函数 =====
def format_markdown_spacing(md: str) -> str:
    """
    自动修复 Dify 可能生成的单换行 Markdown，将其转换为标准的双换行。
    - 查找后面不是特殊字符（如列表项、标题、另一换行符）的换行符
    - 将其替换为两个换行符，从而创建正确的段落。
    """
    if not md:
        return ""
    # 正则表达式：查找一个换行符 \n，条件是它的后面不能是以下任何内容：
    # \n (另一个换行符), -, *, >, #, 数字. (即 \d\.)
    # 这可以保护已经存在的段落分隔和列表/标题格式。
    # 使用正向预查 (?=...) 来检查，而不是消耗字符。
    formatted_md = re.sub(r'\n(?=[^\n\-*+># \d\.])', r'\n\n', md)
    return formatted_md


# ===== 分类规则 =====
def classify(content: str) -> str:
    return "game" if ("🎮" in content or "游戏行业速递" in content) else "ai"


# ===== 提取标题/摘要 =====
def extract_title_summary(md: str) -> Tuple[str, str]:
    m = re.search(r'^\s*#\s+(.+)$', md, flags=re.M)
    title = m.group(1).strip() if m else (next((ln.strip() for ln in md.splitlines() if ln.strip()), "日报"))

    plain = re.sub(r'`{1,3}.*?`{1,3}', '', md, flags=re.S)
    plain = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', plain)
    plain = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', plain)
    plain = re.sub(r'[#>*_`~\-]+', ' ', plain)
    plain = re.sub(r'\s+', ' ', plain).strip()
    short = (plain[:120] + '...') if len(plain) > 120 else plain
    return title, short


# ===== 原子写文件 =====
def atomic_write(path: str, data: str):
    dirpath = os.path.dirname(path) or "."
    if dirpath and dirpath != ".":
        os.makedirs(dirpath, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', delete=False, encoding='utf-8', newline='\n', dir=dirpath) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    shutil.move(tmp_path, path)


# ===== manifest 初始化 & 覆盖逻辑 =====
def load_or_init_manifest(manifest_path: str) -> dict:
    if not os.path.exists(manifest_path):
        print(f"ℹ️ manifest.json 不存在于 {manifest_path}，将使用默认模板创建。")
        return DEFAULT_MANIFEST.copy()
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        data.setdefault("site", DEFAULT_MANIFEST["site"])
        data.setdefault("categories", DEFAULT_MANIFEST["categories"])
        data.setdefault("months", {"ai": {}, "game": {}})
        data["months"].setdefault("ai", {})
        data["months"].setdefault("game", {})
        return data
    except Exception as e:
        print(f"⚠️ 读取 manifest.json 失败 ({e})，将使用默认模板。")
        return DEFAULT_MANIFEST.copy()


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
    entries = [e for e in manifest["months"][category][month_key] if e.get("date") != date_str]
    entries.insert(0, new_entry)
    manifest["months"][category][month_key] = entries
    return manifest


# ===== Git 操作 =====
def run_git(cmd, cwd):
    try:
        subprocess.run(["git", "config", "--global", "--add", "safe.directory", cwd], check=False, cwd=cwd)
    except Exception:
        pass
    return subprocess.run(cmd, check=True, cwd=cwd)


def git_commit_push(cwd: str, message: str):
    run_git(["git", "add", "."], cwd)
    rs = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=cwd)
    if rs.returncode == 0:
        print("ℹ️ 无文件变更，跳过提交。")
        return
    run_git(["git", "commit", "-m", message], cwd)
    run_git(["git", "push", "origin", "main"], cwd)


# ===== 主处理逻辑 =====
def process_dify_report(content: str):
    # ===== 核心改动：在处理前先调用格式化函数 =====
    content = format_markdown_spacing(content)
    
    print(f"🚀 处理 Dify 报告 (已自动格式化)...（TZ={TZ_LABEL}）")
    if not content or not content.strip():
        print("❌ 内容为空，忽略。")
        return

    category = classify(content)
    print(f"✅ 分类：{category}")

    now_cn = datetime.now(CN_TZ)
    yyyy, mm, dd = now_cn.strftime("%Y"), now_cn.strftime("%m"), now_cn.strftime("%d")
    date_str = f"{yyyy}-{mm}-{dd}"

    if not os.path.isdir(GITHUB_REPO_PATH):
        print(f"❌ 仓库目录不存在：{GITHUB_REPO_PATH}")
        return

    os.chdir(GITHUB_REPO_PATH)
    print(f"📁 仓库目录：{GITHUB_REPO_PATH}")

    md_rel = os.path.join(category, yyyy, mm, f"{dd}.md")
    atomic_write(os.path.join(PUBLIC_DIR, md_rel), content)
    if WRITE_TO_ROOT:
        atomic_write(md_rel, content)
    print(f"✅ Markdown 写入：{os.path.join(PUBLIC_DIR, md_rel)}" + (" & " + md_rel if WRITE_TO_ROOT else ""))

    manifest_root = os.path.join("manifest.json")
    manifest_pub  = os.path.join(PUBLIC_DIR, "manifest.json")
    manifest_load_path = manifest_root if (WRITE_TO_ROOT and os.path.exists(manifest_root)) else manifest_pub
    manifest = load_or_init_manifest(manifest_load_path)

    title, summary = extract_title_summary(content)
    manifest = upsert_manifest(manifest, category, yyyy, mm, dd, title, summary)
    manifest_json = json.dumps(manifest, ensure_ascii=False, indent=2)

    atomic_write(manifest_pub, manifest_json)
    if WRITE_TO_ROOT:
        atomic_write(manifest_root, manifest_json)
    print("✅ manifest.json 已更新（public" + (" + root" if WRITE_TO_ROOT else "") + "）。")

    commit_msg = f"docs(content): Update {category.upper()} daily report for {date_str}"
    print("⏳ Git 提交中 ...")
    try:
        git_commit_push(GITHUB_REPO_PATH, commit_msg)
        print("🎉 推送完成。")
    except subprocess.CalledProcessError as e:
        print(f"❌ Git 失败：{e}")


# ===== Webhook Server (无变动) =====
class WebhookHandler(http.server.SimpleHTTPRequestHandler):
    def _read_body(self) -> bytes:
        te = (self.headers.get("Transfer-Encoding") or "").lower()
        if "chunked" in te:
            body = b""
            while True:
                line = self.rfile.readline().strip()
                if not line: break
                size = int(line, 16)
                if size == 0:
                    self.rfile.readline()
                    break
                body += self.rfile.read(size)
                self.rfile.readline()
            return body
        n = int(self.headers.get("Content-Length", "0"))
        return self.rfile.read(n)

    def do_POST(self):
        if self.path != "/webhook":
            self.send_response(404); self.end_headers(); return
        try:
            raw = self._read_body()
            body = raw.decode("utf-8", errors="replace").strip()

            try:
                dbg = (body[:200] + '...') if len(body) > 200 else body
                print(f"🔍 请求体预览: {dbg}")
            except Exception: pass

            content = None
            data = None
            try: data = json.loads(body)
            except Exception: data = None

            if isinstance(data, dict):
                content = data.get("content")
                if not content:
                    candidate = (data.get("text_input") or data.get("text") or data.get("final_report_markdown"))
                    if isinstance(candidate, dict):
                        content = (candidate.get("content") or candidate.get("text") or candidate.get("final_report_markdown"))
                    elif isinstance(candidate, str) and candidate:
                        try:
                            inner = json.loads(candidate)
                            if isinstance(inner, dict):
                                content = (inner.get("content") or inner.get("text") or inner.get("final_report_markdown"))
                            else: content = candidate
                        except Exception: content = candidate
            else:
                content = body

            if not content or not content.strip():
                raise ValueError("未找到内容（content/text_input/text），或为空。")

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
    print(f"--- Dify Publisher (v14) ---  Using TZ: {TZ_LABEL}")
    print(f"Listening: http://127.0.0.1:{PORT}/webhook")
    print(f"Set Dify Webhook URL to: http://host.docker.internal:{PORT}/webhook")
    with socketserver.TCPServer(("", PORT), WebhookHandler) as httpd:
        httpd.serve_forever()