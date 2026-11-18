from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import sys

ROOT = Path(__file__).resolve().parent
SITE = ROOT.parent / 'site'
PORT = 18768
URL = f'http://127.0.0.1:{PORT}/'

class Server(ThreadingHTTPServer):
    allow_reuse_address = False
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
    print('如果已经启动过本程序，请使用之前打开的页面；否则请关闭占用该端口的程序后重试。')
    print(f'详细信息：{error}')
    sys.exit(1)

print('星球推演已启动。请保持此窗口打开；关闭窗口即可停止。', flush=True)
print(f'如果浏览器没有自动打开，请访问：{URL}', flush=True)
if '--no-browser' not in sys.argv:
    try:
        os.startfile(URL)
    except OSError:
        print('浏览器未能自动打开，请手动访问上面的地址。', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()