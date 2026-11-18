#!/usr/bin/env node
/**
 * 本地冒烟测试：启动真实服务，请求关键资源，验证首页与脚本可用。
 * 使用仓库自带的 windows/server.py（本机 127.0.0.1:18768），无需额外依赖。
 * 注意：会占用 18768 端口数秒；若该端口已被占用则跳过启动、直接复用。
 *
 * 用法： node tools/smoke-test.mjs [--port 18768]
 */
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portArg = process.argv.indexOf('--port');
const PORT = portArg >= 0 && process.argv[portArg + 1] ? Number(process.argv[portArg + 1]) : 18768;
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) { console.error('--port 必须是 1-65535 的端口'); process.exit(1); }
const BASE = `http://127.0.0.1:${PORT}`;
const targets = [
  ['/', 'text/html', '世界生成器'],
  ['/style.css', 'text/css', null],
  ['/app/main.js', 'javascript', null],
  ['/core/worker.js', 'javascript', 'RESOURCE_BUILD'],
  ['/globe/globe.html', 'text/html', null]
];

let server = null;
let started = false;

async function reachable() {
  try { const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(1000) }); return r.ok; }
  catch { return false; }
}

async function main() {
  console.log('\x1b[1m本地冒烟测试\x1b[0m');
  if (await reachable()) {
    console.log('  \x1b[33m!\x1b[0m 端口 18768 已有服务，复用之');
  } else {
    const py = 'windows/server.py';
    if (!existsSync(join(ROOT, py))) { console.error('  \x1b[31m✗\x1b[0m 缺少 server.py'); process.exit(1); }
    server = spawn('python3', [py, '--no-browser', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
    started = true;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (await reachable()) break;
    }
    if (!(await reachable())) { console.error('  \x1b[31m✗\x1b[0m 服务未能启动'); finish(1); return; }
    console.log('  \x1b[32m✓\x1b[0m 服务已启动');
  }

  let errors = 0;
  for (const [path, mime, needle] of targets) {
    try {
      const r = await fetch(BASE + path, { signal: AbortSignal.timeout(5000) });
      const body = await r.text();
      const okMime = r.headers.get('content-type')?.includes(mime.split('/')[0]) || mime === 'javascript';
      const okBody = !needle || body.includes(needle);
      if (r.ok && okBody) console.log(`  \x1b[32m✓\x1b[0m ${path.padEnd(22)} ${r.status} ${r.headers.get('content-type')}`);
      else { console.error(`  \x1b[31m✗\x1b[0m ${path} 状态=${r.status} 内容校验=${okBody}`); errors++; }
    } catch (e) { console.error(`  \x1b[31m✗\x1b[0m ${path} 请求失败：${e.message}`); errors++; }
  }
  await finish(errors ? 1 : 0);
}

async function finish(code) {
  if (server && started && !server.killed) {
    await new Promise(resolve => {
      const timer = setTimeout(() => { try { server.kill('SIGKILL'); } catch {} resolve(); }, 2000);
      server.once('exit', () => { clearTimeout(timer); resolve(); });
      server.kill('SIGTERM');
    });
  }
  console.log(code ? '\n\x1b[31m冒烟测试失败\x1b[0m\n' : '\n\x1b[32m\x1b[1m冒烟测试通过 ✓\x1b[0m\n');
  process.exit(code);
}
main();
