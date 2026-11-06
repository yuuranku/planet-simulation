/* 界面用 SVG：图标与装饰（古籍星图风格：墨青底、描金线） */
(function (G) {
  'use strict';
  const I = {};
  I.dice = '<svg viewBox="0 0 24 24" class="ui-dice"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.3" cy="8.3" r="1.25" fill="currentColor" stroke="none"/><circle cx="15.7" cy="15.7" r="1.25" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="15.7" cy="8.3" r="1.25" fill="currentColor" stroke="none"/><circle cx="8.3" cy="15.7" r="1.25" fill="currentColor" stroke="none"/></svg>';
  // 浑仪地球：标志
  I.logo = '<svg viewBox="0 0 48 48" class="ui-logo"><circle cx="24" cy="22" r="13"/><ellipse cx="24" cy="22" rx="20" ry="6.5" transform="rotate(-18 24 22)"/><path d="M11 22h26M24 9c4 3.6 5.8 8 5.8 13S28 31.4 24 35c-4-3.6-5.8-8-5.8-13S20 12.6 24 9z"/><path d="M17 41h14M24 35v6M20 44h8"/><circle cx="24" cy="5.5" r="1.4" fill="currentColor" stroke="none"/></svg>';
  // 罗盘玫瑰
  I.compass = '<svg viewBox="0 0 64 64" class="ui-compass"><circle cx="32" cy="32" r="21" stroke-width=".8"/><circle cx="32" cy="32" r="17.5" stroke-width=".5" stroke-dasharray="1 2.2"/><path d="M32 4 36 28 60 32 36 36 32 60 28 36 4 32 28 28z" fill="rgba(201,163,91,.18)" stroke-width="1"/><path d="M32 4 32 32 28 28zM60 32 32 32 36 28zM32 60 32 32 36 36zM4 32 32 32 28 36z" fill="currentColor" stroke="none" opacity=".85"/><path d="m32 14 3 15 15 3-15 3-3 15-3-15-15-3 15-3z" transform="rotate(45 32 32)" stroke-width=".8"/><text x="32" y="3.2" text-anchor="middle" font-size="5.2" fill="currentColor" stroke="none" font-family="serif">N</text></svg>';
  // 远山线描（顶栏装饰）
  I.mountains = '<svg viewBox="0 0 420 46" preserveAspectRatio="xMaxYMax meet" class="ui-mountains"><path d="M0 44 26 30 40 36 70 14 92 30 110 22 138 40 160 28 176 34 206 8 232 30 252 20 276 38 300 24 318 32 346 12 370 30 392 22 420 36"/><path d="M60 22 70 14 78 20M196 16 206 8 216 18M336 20 346 12 356 22" stroke-width=".8"/><path d="M0 46 40 40 80 43 130 37 190 42 250 36 310 41 370 35 420 40" stroke-width=".6" opacity=".7"/><path d="M215 25c4-2 7 0 10-1M300 30c4-2 6 0 9-1M110 30c3-1 6 0 8-1" stroke-width=".6"/></svg>';
  // 小山水（卡片角饰）
  I.vignette = '<svg viewBox="0 0 120 34" class="ui-vignette"><path d="M2 32 20 20 30 26 46 8 60 22 70 16 86 30 98 22 118 32"/><path d="M40 14 46 8 52 13M66 19 70 16 74 19" stroke-width=".7"/><path d="M8 33h104" stroke-width=".6"/><circle cx="96" cy="8" r="3.2" stroke-width=".7"/></svg>';
  // 卷草花饰分隔线
  I.flourish = '<svg viewBox="0 0 160 14" class="ui-flourish"><path d="M2 7h58M100 7h58"/><path d="M60 7c6-6 14-6 20 0 6 6 14 6 20 0"/><path d="M80 7c-4-4-10-4-12 0 2 4 8 4 12 0zm0 0c4-4 10-4 12 0-2 4-8 4-12 0z" fill="currentColor" stroke="none" opacity=".8"/><circle cx="2" cy="7" r="1.4" fill="currentColor" stroke="none"/><circle cx="158" cy="7" r="1.4" fill="currentColor" stroke="none"/></svg>';
  // 角花（地图画框四角）
  I.corner = '<svg viewBox="0 0 40 40" class="ui-corner"><path d="M2 38V8a6 6 0 0 1 6-6h30"/><path d="M7 38V13a6 6 0 0 1 6-6h25" stroke-width=".7"/><path d="M2 8c6 0 6 6 12 6M8 2c0 6 6 6 6 12" stroke-width=".8"/><circle cx="14" cy="14" r="1.6" fill="currentColor" stroke="none"/></svg>';
  G.UIIcons = I;
  // 装饰挂载：有 data-ui-icon 的元素填入对应 SVG
  const mount = () => document.querySelectorAll('[data-ui-icon]').forEach(el => { if (!el.firstElementChild) el.innerHTML = I[el.dataset.uiIcon] || ''; });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  G.UIIcons.mount = mount;
})(window);
