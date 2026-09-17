"""本機預覽用的靜態伺服器，路由規則比照 Cloudflare Pages：/diaphragm-wall → diaphragm-wall.html。
App 內所有連結與 Service Worker 快取清單都是無副檔名路徑，直接用 python -m http.server 會 404、
Service Worker 也裝不起來。用法：python3 scripts/serve.py [port]
"""
import http.server
import os
import sys
from pathlib import Path

ROOT = str(Path(__file__).resolve().parents[1])
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173


class PagesHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        resolved = super().translate_path(path)
        if not os.path.exists(resolved) and os.path.exists(resolved + ".html"):
            return resolved + ".html"
        return resolved

    def end_headers(self):
        # 預覽時不要讓瀏覽器快取，改了檔案重新整理就看得到
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print(f"http://localhost:{PORT}/  （Ctrl+C 結束）")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), PagesHandler).serve_forever()
