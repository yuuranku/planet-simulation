/* 右栏纸页卷开时，跟着展开的下缘滚下去的一根纸轴（只是装饰，动画结束即移除）。
 * 纸页本身的展开由 sheet.css 的 sheet-unroll 完成；这里只在它开始时补上纸轴，时长与缓动保持一致。 */
(function () {
  'use strict';
  const EASE = 'cubic-bezier(.45, .05, .25, 1)';
  document.addEventListener('animationstart', e => {
    if (e.animationName !== 'sheet-unroll' || e.target !== e.composedPath()[0]) return;
    const el = e.target, r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return;
    const dur = (parseFloat(getComputedStyle(el).animationDuration) || 0.7) * 1000;
    const old = el._sheetRoller; if (old) old.remove();
    const roll = document.createElement('div'); roll.className = 'sheet-roller'; roll.setAttribute('aria-hidden', 'true');
    roll.style.left = (r.left - 3) + 'px'; roll.style.width = (r.width + 6) + 'px'; roll.style.top = r.top + 'px';
    const z = parseInt(getComputedStyle(el).zIndex, 10); if (Number.isFinite(z)) roll.style.zIndex = z + 1;
    document.body.appendChild(roll); el._sheetRoller = roll;
    const end = r.height + 60; // 与 clip-path 的 100% → -60px 同步
    const a = roll.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: `translateY(${end * 0.85}px)`, opacity: 1, offset: 0.85 },
      { transform: `translateY(${end}px)`, opacity: 0 }
    ], { duration: dur, easing: EASE, fill: 'forwards' });
    const done = () => { roll.remove(); if (el._sheetRoller === roll) el._sheetRoller = null; };
    a.onfinish = done; a.oncancel = done;
  }, true);
})();
