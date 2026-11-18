from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import sys
import webbrowser

ROOT = Path(__file__).resolve().parent
SITE = ROOT.parent / 'site'
PORT = 18768
# 支持 --port <端口> / --port=<端口>；未指定时用默认端口
if '--port' in sys.argv:
    try:
        idx = sys.argv.index('--port')
        PORT = int(sys.argv[idx + 1])
    except (ValueError, IndexError):
        print('--port 需要一个有效的端口号。')
        sys.exit(1)
URL = f'http://127.0.0.1:{PORT}/'

class Server(ThreadingHTTPServer):
    # 允许地址立即重用：避免「停止后立刻重启」或冒烟测试连续运行时撞 TIME_WAIT 端口
    allow_reuse_address = True
    daemon_threads = True

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

if not (SITE / 'index.html').is_file():
    print('未找到网页文件。请完整解压压缩包，不要移动或删除其中的文件。')
    sys.exit(1)

try:
    server = Server(('127.0.0.1', PORT), partial(Handler, directory=str(SITE)))
except OSError as error:
    print(f'启动失败：本机端口 {PORT} 已被占用或无法使用。')
    print('如果已经启动过本程序，请使用之前打开的页面；否则请关闭占用该端口的程序，或用 --port 指定其他端口后重试。')
    print(f'详细信息：{error}')
    sys.exit(1)

print('星球推演已启动。请保持此窗口打开；关闭窗口即可停止。', flush=True)
print(f'如果浏览器没有自动打开，请访问：{URL}', flush=True)
if '--no-browser' not in sys.argv:
    try:
        webbrowser.open(URL)
    except Exception:
        print('浏览器未能自动打开，请手动访问上面的地址。', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
