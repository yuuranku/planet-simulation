#!/usr/bin/env node
/**
 * 无缝地图端到端验证（可选，需自备 Chromium）。
 * 启动真实页面 → 生成世界 → 定位最大城市 → 逐级缩放到街道 → 截图 + 状态/错误报告。
 *
 * 前置：
 *   1. npm install（devDependencies 含 playwright-core）
 *   2. 系统有 Chromium：默认用 /usr/bin/chromium，或用 CHROMIUM_PATH 指定
 *   3. 另开一个终端运行 `python3 windows/server.py --no-browser`（默认 18768）
 *
 * 用法：
 *   node tools/e2e-zoom.mjs [--base http://127.0.0.1:18768] [--out .e2e-shots]
 *
 * 退出码：0 = 城市配方成功加载且无页面错误；1 = 有异常/关键资源失败。
 * 注意：截图仅作人工核验，默认不进仓库（.e2e-shots/ 已忽略）。
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:18768');
const OUT = resolve(arg('--out', '.e2e-shots'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [], failedReq = [];
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', r => failedReq.push(r.url() + ' :: ' + (r.failure()?.errorText || '')));
page.on('response', r => { if (r.status() >= 400) failedReq.push(r.status() + ' ' + r.url()); });
const log = (...a) => console.log(...a);
let fatal = false;

try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Config && window.app && window.Home && window.Wizard, null, { timeout: 30000 });
  log('页面脚本加载完成');

  // 真实入口：首页"创建世界" → wizard(带真正 onDone=generate) → 随机配置 → 提交
  await page.evaluate(() => window.Home.show());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('homeCreate')?.click());
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = document.querySelector('[data-world-source="procedural"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('wizRandom')?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('wizNext')?.click());
  log('已提交世界生成');

  await page.waitForFunction(() => window.app?.data?.cities?.length > 0, null, { timeout: 180000 });
  const info = await page.evaluate(() => ({
    cities: window.app.data.cities.length, W: window.app.data.W, H: window.app.data.H,
    hasCityLayer: !!(window.CityLayer && window.CityLayer._i),
    maxRel: window.cityMaxRel ? window.cityMaxRel() : null,
    maxScale: window.app.map.maxScale()
  }));
  log('世界信息:', JSON.stringify(info));

  const city = await page.evaluate(() => {
    const cs = window.app.data.cities; let bi = 0;
    for (let i = 1; i < cs.length; i++) if ((cs[i].pop || 0) > (cs[bi].pop || 0)) bi = i;
    return { x: cs[bi].x, y: cs[bi].y, name: cs[bi].name, pop: cs[bi].pop };
  });
  log('目标城市:', JSON.stringify(city));

  await page.evaluate(({ x, y }) => {
    document.body.classList.remove('city-open');
    for (const id of ['cityCard', 'cityPanel', 'homeWrap', 'layerPanel', 'wizard']) { const el = document.getElementById(id); if (el) el.hidden = true; }
    window.app.map.flyTo(x, y, 30);
  }, city);
  await page.waitForTimeout(3000);

  try {
    await page.waitForFunction(() => window.CityLayer?._i?.cache?.size > 0, null, { timeout: 40000 });
  } catch { log('等待城市配方数据超时'); fatal = true; }
  await page.screenshot({ path: OUT + '/city-zoom.png' });

  // 固定镜头序列：从街区过渡一路到建筑级
  for (const rel of [120, 300, 600, 880]) {
    await page.evaluate(r => { const m = window.app.map; m.setScaleAt(m.fitScale() * r, m.vw / 2, m.vh / 2); }, rel);
    await page.waitForTimeout(1200);
    const st = await page.evaluate(() => ({
      zoomRel: +window.app.map.zoomRel().toFixed(1),
      cache: window.CityLayer?._i?.cache?.size ?? 0,
      stats: window.CityLayer?._i?.stats ? { ...window.CityLayer._i.stats } : null
    }));
    log('缩放 ' + rel + ':', JSON.stringify(st));
    await page.screenshot({ path: OUT + '/rel' + rel + '.png' });
  }

  const finalState = await page.evaluate(() => ({
    cache: window.CityLayer?._i?.cache?.size ?? 0,
    buildingsBuilt: [...(window.CityLayer?._i?.cache?.values() || [])].some(e => !!e.buildings),
    discarded: window.CityLayer?._i?.stats?.discarded ?? 0,
    failed: window.CityLayer?._i?.stats?.failed ?? 0
  }));
  log('最终状态:', JSON.stringify(finalState));
  if (finalState.cache === 0) fatal = true;
  log('截图输出目录:', OUT);
} catch (e) {
  log('测试异常:', e.message); fatal = true;
} finally {
  log('\n=== 失败请求 (' + failedReq.length + ') ==='); failedReq.slice(0, 15).forEach(x => log(x));
  log('\n=== 控制台错误 (' + errors.length + ') ==='); errors.slice(0, 20).forEach(x => log(x));
  await browser.close();
}

log(fatal || errors.length ? '\n端到端验证未完全通过' : '\n端到端验证通过 ✓');
process.exit(fatal || errors.length ? 1 : 0);
