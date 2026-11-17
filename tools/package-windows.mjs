#!/usr/bin/env node
/**
 * Windows 便携版打包：把 dist/windows 打成 ZIP。
 * 依赖系统 zip 命令（Linux/macOS 自带；Windows 可用 Git Bash 或 WSL）。
 * 用法： npm run build && npm run package:windows
 */
import { existsSync, statSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const v = JSON.parse(readFileSync(join(ROOT, 'version.json'), 'utf8'));
const src = join(ROOT, 'dist/windows');

if (!existsSync(join(src, 'site/index.html'))) {
  console.error('  \x1b[31m✗\x1b[0m 未找到 dist/windows，请先运行 npm run build');
  process.exit(1);
}

const outDir = join(ROOT, 'release');
mkdirSync(outDir, { recursive: true });
const zipName = `planet-simulation-${v.version}-windows.zip`;
const zipPath = join(outDir, zipName);

console.log(`\x1b[1m打包 Windows 便携版 ${v.version}\x1b[0m`);
const r = spawnSync('zip', ['-r', '-q', zipPath, '.'], { cwd: src, stdio: 'inherit' });
if (r.status !== 0) {
  console.error('\n  \x1b[31m✗\x1b[0m zip 命令失败。请在装有 zip 的环境运行，或手动压缩 dist/windows 目录。');
  process.exit(1);
}
const size = (statSync(zipPath).size / 1024 / 1024).toFixed(1);
console.log(`\n\x1b[32m打包完成 ✓\x1b[0m  release/${zipName}  (${size} MB)\n`);
