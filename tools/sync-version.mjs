#!/usr/bin/env node
/**
 * 版本同步脚本：把 version.json 作为唯一事实来源，同步到所有散落位置。
 *   - android/build.gradle  : versionName / versionCode
 *   - README.md             : 顶部「当前版本」
 *   - site/index.html       : 页脚「世界生成器 x.y.z」
 * 用法： node tools/sync-version.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const v = JSON.parse(readFileSync(join(ROOT, 'version.json'), 'utf8'));
let changed = 0;
function sync(file, fn) {
  const p = join(ROOT, file);
  const before = readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) { writeFileSync(p, after); changed++; console.log(`  \x1b[32m✓\x1b[0m 已同步 ${file}`); }
  else console.log(`  \x1b[90m=\x1b[0m ${file} 已是最新`);
}

console.log(`\x1b[1m同步版本 ${v.version} (code ${v.versionCode})\x1b[0m`);
sync('android/build.gradle', s => s
  .replace(/versionCode\s+\d+/, `versionCode ${v.versionCode}`)
  .replace(/versionName\s+'[^']*'/, `versionName '${v.version}'`));
sync('README.md', s => s.replace(/当前版本：\*\*[^*]+\*\*/, `当前版本：**${v.version}**`));
sync('site/index.html', s => s.replace(/世界生成器\s+\d+(?:\.\d+)*/, `世界生成器 ${v.version}`));
console.log(changed ? `\n\x1b[32m完成：更新了 ${changed} 个文件\x1b[0m\n` : '\n\x1b[32m无需变更\x1b[0m\n');
