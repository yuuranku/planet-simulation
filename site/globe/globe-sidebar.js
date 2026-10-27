/* The map rail owns only panel layout; the globe owns its camera and clock. */
(() => {
  'use strict';
  const panel = document.getElementById('globe-sidebar');
  const toggle = document.getElementById('globe-sidebar-toggle');
  const media = matchMedia('(max-width:700px)');
  let returnFocus = toggle;
  function openPanel(open, focus = false) {
    panel.hidden = !open;
    panel.inert = !open;
    document.body.classList.toggle('globe-sidebar-collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '收起球面控制栏' : '展开球面控制栏');
    for (const button of document.querySelectorAll('[data-globe-section]')) {
      button.setAttribute('aria-expanded', String(open));
      if (!open) button.removeAttribute('aria-pressed');
    }
    if (focus) (open ? document.getElementById('globe-world-name') : returnFocus).focus();
  }
  toggle.addEventListener('click', () => { returnFocus = toggle; openPanel(panel.hidden, true); });
  document.querySelector('[data-globe-sidebar-close]').addEventListener('click', () => openPanel(false, true));
  for (const button of document.querySelectorAll('[data-globe-section]')) {
    button.addEventListener('click', () => {
      returnFocus = button;
      openPanel(true);
      for (const other of document.querySelectorAll('[data-globe-section]'))
        other.setAttribute('aria-pressed', String(other === button));
      const section = document.getElementById(button.dataset.globeSection);
      panel.scrollTop = Math.max(0, section.offsetTop - 16);
      section.querySelector('h2').focus({preventScroll:true});
    });
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); openPanel(false, true); }
  });
  media.addEventListener('change', () => openPanel(!media.matches));
  openPanel(!media.matches);
})();
