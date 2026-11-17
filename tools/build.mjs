#!/usr/bin/env node
/**
 * 星球推演 · 统一构建脚本
 * ------------------------------------------------------------------
 * 职责：把仓库根目录的 site/ 源码，加工成两套可发布产物：
 *   dist/windows/  —— Windows 便携版（site + windows/server.py + 启动脚本）
 *   dist/android/  —— Android 版（site，供 Gradle 打包进 assets/site）
 *
 * 设计原则（重要）：
 *  1. 不改动 site/ 中的任何源文件；所有加工只发生在 dist/ 产物上。
 *  2. 前端是「全局脚本 + Worker importScripts」双上下文架构，不能简单合并
 *     成单个 bundle。因此这里做的是「统一缓存串」而非打包。
 *  3. 缓存串 ?build= 过去散落在 6 个不同的值，手工维护易漏改导致缓存不刷新。
 *     构建时统一替换为 version.json 的 build 值，一处定义、全局一致。
 *
 * 用法： node tools/build.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const version = JSON.parse(readFileSync(join(ROOT, 'version.json'), 'utf8'));

let errors = 0;
const ok = m => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const warn = m => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const fail = m => { errors++; console.error(`  \x1b[31m✗\x1b[0m ${m}`); };
const head = m => console.log(`\n\x1b[36m▸ ${m}\x1b[0m`);

/* ---------- 收集文件 ---------- */
function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push(relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}

/* ---------- 校验 1：index.html 引用的本地文件齐全 ---------- */
function checkReferences(siteDir) {
  head('校验 site/ 引用完整性');
  const html = readFileSync(join(siteDir, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"]*)?"/g)]
    .map(m => m[1])
    .filter(p => !/^(https?:)?\/\//.test(p) && !p.startsWith('data:'));
  for (const ref of new Set(refs)) {
    if (!existsSync(join(siteDir, ref))) fail(`index.html 引用了不存在的文件：${ref}`);
  }
  ok(`index.html 本地引用 ${new Set(refs).size} 个，全部存在`);
  // 动态加载的城市脚本
  const cityJs = join(siteDir, 'app/city.js');
  if (existsSync(cityJs)) {
    const src = readFileSync(cityJs, 'utf8');
    const scripts = [...src.matchAll(/'(city\/[^']+\.js)'/g)].map(m => m[1]);
    for (const s of scripts) if (!existsSync(join(siteDir, s))) fail(`app/city.js 动态引用不存在：${s}`);
    ok(`城市模块动态引用 ${scripts.length} 个，全部存在`);
  }
}

/* ---------- 校验 2：无外部 CDN 依赖（离线发布要求） ---------- */
function checkNoExternal(siteDir) {
  head('校验离线可用性（无外部 CDN）');
  let found = 0;
  for (const rel of walk(siteDir)) {
    if (!/\.(html|js|css)$/.test(rel)) continue;
    const src = readFileSync(join(siteDir, rel), 'utf8');
    const urls = [...src.matchAll(/https?:\/\/[^"'\s)]+/g)].map(m => m[0])
      .filter(u => !/w3\.org|localhost|127\.0\.0\.1/.test(u));
    if (urls.length) {
      found += urls.length;
      warn(`${rel} 含外链：${[...new Set(urls)].slice(0, 3).join(', ')}`);
    }
  }
  if (found === 0) ok('未发现外部网络依赖，可完全离线运行');
}

/* ---------- 加工：统一缓存串 ---------- */
function normalizeCache(src) {
  // <script/link ... ?build=xxxx> 与 new Worker('...?build=xxxx')
  src = src.replace(/\?build=[A-Za-z0-9]+/g, `?build=${version.build}`);
  // worker.js 内的 const RESOURCE_BUILD = 'xxxx';
  src = src.replace(/(RESOURCE_BUILD\s*=\s*')[^']*(')/g, `$1${version.build}$2`);
  return src;
}

/* ---------- 复制并加工 site → 目标 ---------- */
function buildSite(siteDir, target, flavor) {
  head(`生成 ${flavor} 产物 → ${relative(ROOT, target)}`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  let changed = 0;
  for (const rel of walk(siteDir)) {
    const from = join(siteDir, rel), to = join(target, rel);
    mkdirSync(dirname(to), { recursive: true });
    if (/\.(html|js|css)$/.test(rel)) {
      const before = readFileSync(from, 'utf8');
      const after = normalizeCache(before);
      if (after !== before) changed++;
      writeFileSync(to, after);
    } else {
      cpSync(from, to);
    }
  }
  ok(`复制 ${walk(siteDir).length} 个文件，统一 ${changed} 处缓存串 → ${version.build}`);
}

/* ---------- 生成 Windows 启动脚本 ---------- */
function windowsLauncher(target) {
  // Windows 便携版沿用现有 server.py（本地 127.0.0.1:18768），需机器装有 Python 3。
  const cmd = [
    '@echo off',
    'chcp 65001 >nul',
    'cd /d "%~dp0"',
    'where python >nul 2>nul && (python windows\\server.py & goto :eof)',
    'where py >nul 2>nul && (py -3 windows\\server.py & goto :eof)',
    'echo 未找到 Python 3。请先安装 Python 3 并加入 PATH，或联系发布者获取内嵌运行时的版本。',
    'pause'
  ].join('\r\n');
  writeFileSync(join(target, '启动世界生成器.cmd'), cmd, 'utf8');
  cpSync(join(ROOT, 'windows/server.py'), join(target, 'windows/server.py'), { recursive: true });
  ok('写入 Windows 启动脚本与 server.py');
}

/* ---------- 主流程 ---------- */
console.log(`\x1b[1m星球推演 构建 v${version.version} (build ${version.build})\x1b[0m`);
const siteDir = join(ROOT, 'site');
if (!existsSync(join(siteDir, 'index.html'))) {
  fail('site/index.html 不存在，终止');
  process.exit(1);
}
checkReferences(siteDir);
checkNoExternal(siteDir);

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

buildSite(siteDir, join(DIST, 'windows/site'), 'Windows');
windowsLauncher(join(DIST, 'windows'));
buildSite(siteDir, join(DIST, 'android/site'), 'Android');

// 构建清单
const manifest = {
  version: version.version,
  versionCode: version.versionCode,
  build: version.build,
  generatedAt: new Date().toISOString(),
  targets: ['windows', 'android']
};
writeFileSync(join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

if (errors) {
  console.error(`\n\x1b[31m构建失败：${errors} 个校验错误\x1b[0m`);
  process.exit(1);
}
console.log(`\n\x1b[32m\x1b[1m构建完成 ✓\x1b[0m  版本 ${version.version} · 产物位于 dist/\n`);
