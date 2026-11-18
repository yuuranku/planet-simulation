#!/usr/bin/env node
/**
 * 城市模块同源分叉检查
 * ------------------------------------------------------------------
 * 背景：仓库存在两套城市实现，它们同源但用途不同，且刻意存在分叉：
 *   - site/city/          主应用「城市详情面板」动态加载（app/city.js 的 SCRIPTS）
 *   - site/citygen/assets/ 独立城市地图生成器（可离线运行，也被主应用 iframe 嵌入）
 *
 * citygen 版本含有「星球推演」专属改良（河道裁剪、长桥、水门等），是刻意的分叉，
 * 因此不能简单互相覆盖。本工具的责任是「让分叉状态透明」：
 *   - 完全相同的文件：标记为「应保持一致」，若将来出现差异会提示。
 *   - 已知分叉的文件：标记为「刻意分叉」，说明差异为预期。
 *   - 出现「非预期差异」时给出警告，提醒人工确认。
 *
 * 用法： node tools/check-city-sync.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const A = join(ROOT, 'site/city');
const B = join(ROOT, 'site/citygen/assets');

// 已知刻意分叉（citygen 为改良版）的文件
const KNOWN_FORKS = new Set(['city-site.js', 'city-detail.js', 'city-map.js']);
// 同名且应保持一致的文件
const SHARED = new Set(['city-character.js', 'city-era.js', 'city-layout-store.js', 'city-worker.js', 'atlas-interaction.js']);
// 扫描两侧目录取交集，避免硬编码名单导致新增文件漏检
const jsOf = dir => existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.js')) : [];
const inA = jsOf(A), inB = jsOf(B);
const ALL = [...new Set([...inA, ...inB])].sort();
const REGISTERED = new Set([...SHARED, ...KNOWN_FORKS]);

const md5 = p => createHash('md5').update(readFileSync(p)).digest('hex');
const forked = p => (readFileSync(p, 'utf8').match(/星球推演/g) || []).length;

let unexpected = 0;
console.log('\x1b[1m城市模块同源分叉检查\x1b[0m');
console.log('  city/（主应用面板）  vs  citygen/assets/（独立生成器）\n');
console.log('  文件'.padEnd(26) + '状态'.padEnd(16) + '备注');
console.log('  ' + '-'.repeat(72));

for (const f of ALL) {
  const pa = join(A, f), pb = join(B, f);
  if (!existsSync(pa) || !existsSync(pb)) {
    console.log(`  ${f.padEnd(24)}\x1b[33m缺失\x1b[0m`.padEnd(44) + '一侧文件不存在');
    continue;
  }
  if (!REGISTERED.has(f)) {
    unexpected++;
    const where = inA.includes(f) && inB.includes(f) ? '两侧都有' : (inA.includes(f) ? '仅 city/' : '仅 citygen/');
    console.log(`  ${f.padEnd(24)}\x1b[33m未登记\x1b[0m`.padEnd(44) + `${where}：新文件需人工确认分叉策略并登记到 KNOWN_FORKS/SHARED`);
    continue;
  }
  const same = md5(pa) === md5(pb);
  if (KNOWN_FORKS.has(f)) {
    if (!same) {
      console.log(`  ${f.padEnd(24)}\x1b[36m刻意分叉\x1b[0m`.padEnd(44) + `citygen 改良注释 ${forked(pb)} 处（预期）`);
    } else {
      unexpected++;
      console.log(`  ${f.padEnd(24)}\x1b[31m分叉消失?\x1b[0m`.padEnd(44) + '已知分叉文件如今相同，请确认改良是否丢失');
    }
  } else {
    if (same) {
      console.log(`  ${f.padEnd(24)}\x1b[32m一致\x1b[0m`.padEnd(44) + '应保持一致');
    } else {
      unexpected++;
      console.log(`  ${f.padEnd(24)}\x1b[31m非预期差异\x1b[0m`.padEnd(44) + '本应一致却出现差异，需人工确认');
    }
  }
}

console.log('\n  提示：两套实现服务于不同功能，修改前先确认影响范围。');
console.log(unexpected
  ? `\n  \x1b[33m发现 ${unexpected} 处需要人工确认的状态变化\x1b[0m\n`
  : '\n  \x1b[32m分叉状态符合预期 ✓\x1b[0m\n');
