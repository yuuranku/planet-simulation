/* 手机横屏（安卓 App）：按屏幕高度计算界面缩放 --z，并在 App 内接管文件保存。
   放在 <head> 里最先执行，避免首帧以原尺寸闪一下。 */
(function () {
  'use strict';
  var root = document.documentElement;
  var LAND = matchMedia('(orientation: landscape) and (max-height: 540px)');
  // 以 530px 的屏幕高度为“原尺寸”；412 高 ≈ 0.78，360 高 ≈ 0.68
  function fit() {
    var z = Math.max(0.66, Math.min(0.86, (window.innerHeight || 412) / 530));
    root.style.setProperty('--z', z.toFixed(3));
    root.classList.toggle('m-land', LAND.matches);
  }
  fit();
  addEventListener('resize', fit);
  if (LAND.addEventListener) LAND.addEventListener('change', fit);

  // 元素的有效缩放（地图之外的界面层被 CSS zoom 缩小时，用它把屏幕坐标换回布局坐标）
  window.uiZoom = function (el) { return (el && el.currentCSSZoom) || 1; };

  // ---- 安卓返回键：关掉最上层的东西；都关了就回首页；已在首页返回 false（由原生层处理退出） ----
  window.__androidBack = function () {
    var $ = function (id) { return document.getElementById(id); };
    var vis = function (id) { var e = $(id); return !!e && !e.hidden; };
    var tap = function (el) { if (el) { el.click(); return true; } return false; };
    var ed = document.querySelector('.name-editor'); if (ed) { ed.remove(); return true; }
    if (vis('libModal')) { return tap($('libModal').querySelector('[data-lm-close]')) || (($('libModal').hidden = true), true); }
    if (vis('wizard')) return tap($('wizClose'));
    if (vis('relPage')) return tap($('relBack'));
    if (vis('libPage')) return tap($('libBack'));
    if (vis('globeWrap')) {
      try { var gd = $('globeFrame').contentDocument, sb = gd.getElementById('globe-sidebar'); if (sb && !sb.hidden) return tap(gd.querySelector('[data-globe-sidebar-close]')); } catch (e) { /* */ }
      return tap(document.querySelector('[data-tool=globe]'));
    }
    if (vis('cityGenBox')) return tap($('cityGenClose'));
    if (vis('cityPanel')) return tap($('cityClose'));
    if (vis('menu')) { $('menu').hidden = true; return true; }
    if (vis('results')) { $('results').hidden = true; return true; }
    if (vis('tip')) { $('tip').hidden = true; return true; }
    if (vis('stylePanel')) return tap(document.querySelector('[data-tool=style]'));
    var ps = ['layerPanel', 'infoPanel', 'savedPanel'];
    for (var i = 0; i < ps.length; i++) if (vis(ps[i])) return tap($(ps[i]).querySelector('[data-close]'));
    if (vis('tlRiver')) return tap($('tlRiverX'));
    if (vis('tlFocus')) return tap($('tlFocus').querySelector('[data-act=x]'));
    if (vis('tlCity')) return tap($('tlCity').querySelector('[data-act=x]'));
    if (vis('tlProv')) return tap($('tlProv').querySelector('[data-act=x]'));
    if (vis('tlDrawer')) return tap($('tlDrawerX'));
    if (vis('timeline')) return tap($('tlClose'));
    var app = window.app; if (app && app.tool) return tap(document.querySelector('[data-tool=' + app.tool + ']'));
    if (vis('progress')) return false;
    if (!vis('home') && window.Home && window.Home.show) { window.Home.show(); return true; }
    return false;
  };

  // ---- 安卓 App 外壳：window.StarForge 由原生层注入 ----
  var bridge = window.StarForge;
  if (!bridge) return;
  root.classList.add('m-app');
  // 页面里所有“下载”（导出世界、PNG、城市存档、文化库……）都是 <a download href="blob:..."> 点击。
  // WebView 不能下载 blob，这里读出内容交给原生层，写进“下载/星球推演”。
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var href = this.href || '', name = this.getAttribute('download');
    if (name !== null && /^(blob:|data:)/.test(href)) {
      fetch(href).then(function (r) { return r.blob(); }).then(function (b) {
        var fr = new FileReader();
        fr.onload = function () { var s = String(fr.result); bridge.saveFile(name || 'download', b.type || 'application/octet-stream', s.slice(s.indexOf(',') + 1)); };
        fr.readAsDataURL(b);
      });
      return;
    }
    return origClick.apply(this, arguments);
  };
  // App 里没有“另存为”文件选择器，统一走下载
  try { delete window.showSaveFilePicker; window.showSaveFilePicker = undefined; } catch (e) { /* */ }
  // 分享链接：交给系统分享面板
  if (navigator.clipboard && bridge.copyText) {
    navigator.clipboard.writeText = function (t) { bridge.copyText(String(t)); return Promise.resolve(); };
  }
})();
