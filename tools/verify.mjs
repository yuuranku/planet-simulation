#!/usr/bin/env node
/**
 * 发布前校验：检查源码与 dist 产物的健康度，并运行全部测试。
 *   - 授权与关键文件存在（LICENSE / server.py / MainActivity / 测试）
 *   - 版本一致性（version.json vs build.gradle / README / index.html / RESOURCE_BUILD）
 *   - Android 打包源必须指向 dist（而非源码 site/）
 *   - 缓存串一致性
 *   - dist 产物齐全（若已构建）
 *   - 全部测试必须全绿（node --test）
 * 用法： node tools/verify.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const v = JSON.parse(readFileSync(join(ROOT, 'version.json'), 'utf8'));
let errors = 0;
const ok = m => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = m => { errors++; console.error(`  \x1b[31m✗\x1b[0m ${m}`); };
const head = m => console.log(`\n\x1b[36m▸ ${m}\x1b[0m`);
const read = f => existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), 'utf8') : '';

head('授权与关键文件');
existsSync(join(ROOT, 'LICENSE')) && read('LICENSE').includes('MIT License') ? ok('LICENSE (MIT) 存在') : fail('缺少 MIT LICENSE');
const gradle = read('android/build.gradle');
for (const f of ['site/index.html', 'windows/server.py', 'android/build.gradle',
                 'android/src/cn/planet/world/MainActivity.java', 'version.json']) {
  existsSync(join(ROOT, f)) ? ok(f) : fail(`缺少 ${f}`);
}

head('版本一致性');
if (gradle.includes(`versionName '${v.version}'`)) ok('build.gradle 版本一致'); else fail('build.gradle 版本与 version.json 不一致（运行 npm run sync-version）');
if (gradle.includes(`versionCode ${v.versionCode}`)) ok('build.gradle versionCode 一致'); else fail('build.gradle versionCode 不一致');
if (read('README.md').includes(`当前版本：**${v.version}**`)) ok('README 版本一致'); else fail('README 版本不一致');
if (read('site/index.html').includes(`世界生成器 ${v.version}`)) ok('index.html 页脚版本一致'); else fail('index.html 页脚版本不一致');

head('Android 打包源（必须指向 dist，不读源码 site/）');
const pointsToDist = /\.\.\/dist\/android\/site/.test(gradle);
const pointsToSource = /from\s+['"]\.\.\/site['"]/.test(gradle);
if (pointsToDist && !pointsToSource) ok('build.gradle 从 dist/android/site 打包');
else if (pointsToSource) fail('build.gradle 仍从源码 ../site 打包：缓存串不会统一、dist/android 白产出');
else fail('无法确认 build.gradle 的 copySite from 路径');

head('缓存串一致性');
const builds = new Set();
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name), st = statSync(p);
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
else fail(`源码存在 ${builds.size} 种缓存串 [${[...builds].join(', ')}]，请先统一源码占位串`);
if ([...builds].every(b => b === v.build) || builds.size === 0) ok(`源码缓存串 = version.build (${v.build})`);
else console.log(`  \x1b[90m—\x1b[0m 源码占位串与 version.build 不同（build 会在 dist 统一，属正常）`);

head('dist 产物（若已构建）');
if (existsSync(join(ROOT, 'dist/manifest.json'))) {
  const m = JSON.parse(readFileSync(join(ROOT, 'dist/manifest.json'), 'utf8'));
  if (m.version === v.version) ok(`dist 版本一致 ${m.version}`); else fail(`dist 版本 ${m.version} ≠ ${v.version}，请重新构建`);
  for (const t of m.targets) existsSync(join(ROOT, `dist/${t}/site/index.html`)) ? ok(`${t} 产物齐全`) : fail(`${t} 产物缺少 site/index.html`);
  existsSync(join(ROOT, 'dist/windows/启动世界生成器.cmd')) ? ok('Windows 启动脚本存在') : fail('Windows 启动脚本缺失');
  // dist 内缓存串必须只有一种且等于 version.build
  const dBuilds = new Set();
  const dw = join(ROOT, 'dist/windows/site');
  if (existsSync(dw)) {
    for (const rel of walkList(dw)) {
      if (/\.(html|js)$/.test(rel)) {
        const s = readFileSync(join(dw, rel), 'utf8');
        for (const mm of s.matchAll(/\?build=([A-Za-z0-9]+)/g)) dBuilds.add(mm[1]);
        for (const mm of s.matchAll(/RESOURCE_BUILD\s*=\s*'([^']+)'/g)) dBuilds.add(mm[1]);
      }
    }
    if ([...dBuilds].every(b => b === v.build)) ok(`dist 缓存串统一为 ${v.build}`); else fail(`dist 缓存串混杂或过期：${[...dBuilds].join(', ')}（请重新 build）`);
  }
} else {
  console.log('  \x1b[90m—\x1b[0m 尚未构建（运行 npm run build 后校验更完整）');
}

head('测试（全部必须全绿）');
const testDir = join(ROOT, 'tests');
const testFiles = readdirSync(testDir).filter(f => f.endsWith('.cjs')).sort().map(f => join(testDir, f));
const t = spawnSync(process.execPath, ['--test', ...testFiles], { cwd: ROOT, stdio: 'inherit' });
if (t.status === 0) ok(`${testFiles.length} 个测试文件全部通过`);
else fail('测试未通过，禁止发布');

console.log(errors ? `\n\x1b[31m校验失败：${errors} 处问题\x1b[0m\n` : `\n\x1b[32m\x1b[1m校验通过 ✓\x1b[0m\n`);
process.exit(errors ? 1 : 0);

function walkList(dir) {
  const out = [];
  (function rec(d, base) {
    for (const name of readdirSync(d)) {
      const p = join(d, name), st = statSync(p);
      if (st.isDirectory()) rec(p, base ? base + '/' + name : name);
      else out.push(base ? base + '/' + name : name);
    }
  })(dir, '');
  return out;
}
