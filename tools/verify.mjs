#!/usr/bin/env node
/**
 * 发布前校验：检查源码与 dist 产物的健康度。
 *   - 版本一致性（version.json vs build.gradle / README / index.html）
 *   - 缓存串一致性（源码中不应残留多种 build 值）
 *   - dist 产物齐全（若已构建）
 *   - 关键文件存在（server.py / MainActivity / 测试）
 * 用法： node tools/verify.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const v = JSON.parse(readFileSync(join(ROOT, 'version.json'), 'utf8'));
let errors = 0;
const ok = m => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = m => { errors++; console.error(`  \x1b[31m✗\x1b[0m ${m}`); };
const head = m => console.log(`\n\x1b[36m▸ ${m}\x1b[0m`);
const read = f => existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), 'utf8') : '';

head('版本一致性');
if (read('android/build.gradle').includes(`versionName '${v.version}'`)) ok('build.gradle 版本一致'); else fail('build.gradle 版本与 version.json 不一致（运行 npm run sync-version）');
if (read('android/build.gradle').includes(`versionCode ${v.versionCode}`)) ok('build.gradle versionCode 一致'); else fail('build.gradle versionCode 不一致');
if (read('README.md').includes(`当前版本：**${v.version}**`)) ok('README 版本一致'); else fail('README 版本不一致');

head('关键文件');
for (const f of ['site/index.html', 'windows/server.py', 'android/build.gradle',
                 'android/src/cn/planet/world/MainActivity.java', 'version.json']) {
  existsSync(join(ROOT, f)) ? ok(f) : fail(`缺少 ${f}`);
}

head('源码缓存串一致性（发布前 build 会统一，此处仅提示）');
const builds = new Set();
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'globe') walk(p); }
    else if (/\.(html|js)$/.test(name)) {
      const s = readFileSync(p, 'utf8');
      for (const m of s.matchAll(/\?build=([A-Za-z0-9]+)/g)) builds.add(m[1]);
      for (const m of s.matchAll(/RESOURCE_BUILD\s*=\s*'([^']+)'/g)) builds.add(m[1]);
    }
  }
}
walk(join(ROOT, 'site'));
if (builds.size <= 1) ok(`源码缓存串统一：${[...builds].join(', ') || '（无）'}`);
else console.log(`  \x1b[33m!\x1b[0m 源码存在 ${builds.size} 种缓存串 [${[...builds].join(', ')}]，构建产物会自动统一`);

head('dist 产物（若已构建）');
if (existsSync(join(ROOT, 'dist/manifest.json'))) {
  const m = JSON.parse(readFileSync(join(ROOT, 'dist/manifest.json'), 'utf8'));
  if (m.version === v.version) ok(`dist 版本一致 ${m.version}`); else fail(`dist 版本 ${m.version} ≠ ${v.version}，请重新构建`);
  for (const t of m.targets) existsSync(join(ROOT, `dist/${t}/site/index.html`)) ? ok(`${t} 产物齐全`) : fail(`${t} 产物缺少 site/index.html`);
  existsSync(join(ROOT, 'dist/windows/启动世界生成器.cmd')) ? ok('Windows 启动脚本存在') : fail('Windows 启动脚本缺失');
} else {
  console.log('  \x1b[90m—\x1b[0m 尚未构建（运行 npm run build 后校验更完整）');
}

console.log(errors ? `\n\x1b[31m校验失败：${errors} 处问题\x1b[0m\n` : `\n\x1b[32m\x1b[1m校验通过 ✓\x1b[0m\n`);
process.exit(errors ? 1 : 0);
