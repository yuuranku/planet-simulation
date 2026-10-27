/* Shared first-paint and flat/globe navigation feedback. */
(() => {
  'use strict';
  const page=document.currentScript.dataset.mapLoading;
  const style=document.createElement('style');style.textContent=`
    #atlas-map-loading{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#f5f4ef;color:#26333d;font:15px/1.7 system-ui,sans-serif;padding:28px;text-align:center}
    #atlas-map-loading[hidden],#atlas-map-loading [hidden]{display:none!important}
    #atlas-map-loading .map-loading-card{width:min(420px,100%)}
    #atlas-map-loading .map-loading-spinner{width:34px;height:34px;margin:0 auto 22px;border:3px solid #d8dedc;border-top-color:#31748a;border-radius:50%;animation:map-loading-spin .85s linear infinite}
    #atlas-map-loading h1{margin:0 0 9px;font-size:21px;font-weight:600}
    #atlas-map-loading p{margin:0;color:#65717a;overflow-wrap:anywhere}
    #atlas-map-loading .map-loading-actions{display:flex;justify-content:center;gap:12px;margin-top:24px}
    #atlas-map-loading button{padding:9px 18px;border:1px solid #bcc8ca;border-radius:8px;background:#fff;color:#26333d;font:inherit;cursor:pointer}
    #atlas-map-loading button:first-child{background:#31748a;border-color:#31748a;color:#fff}
    #atlas-map-loading[data-state="error"] .map-loading-spinner{display:none}
    @keyframes map-loading-spin{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){#atlas-map-loading .map-loading-spinner{animation:none}}
  `;document.head.append(style);
  const overlay=document.createElement('section');overlay.id='atlas-map-loading';overlay.dataset.state='loading';overlay.setAttribute('role','status');
  overlay.setAttribute('aria-live','polite');overlay.tabIndex=-1;
  overlay.innerHTML='<div class="map-loading-card"><div class="map-loading-spinner" aria-hidden="true"></div><h1></h1><p></p><div class="map-loading-actions" hidden><button type="button" data-loading-retry>重新加载</button><button type="button" data-loading-back>返回上一页</button></div></div>';
  document.body.append(overlay);
  const heading=overlay.querySelector('h1'),message=overlay.querySelector('p'),actions=overlay.querySelector('.map-loading-actions');
  let initial=true,navigating=false,failed=false,readyTask=null;
  const painted=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  function show(title){overlay.hidden=false;overlay.dataset.state='loading';heading.textContent=title;
    message.textContent='正在准备地图，请稍候…';actions.hidden=true;document.documentElement.dataset.mapLoading='loading';overlay.focus({preventScroll:true});}
  function fail(error){if(!initial||navigating)return;failed=true;overlay.hidden=false;overlay.dataset.state='error';
    heading.textContent='地图未能载入';message.textContent=error?.message||String(error);actions.hidden=false;
    document.documentElement.dataset.mapLoading='error';overlay.querySelector('[data-loading-retry]').focus();}
  function ready(){
    if(!readyTask)readyTask=painted().then(()=>{if(failed||navigating)return;initial=false;overlay.hidden=true;delete document.documentElement.dataset.mapLoading;});
    return readyTask;
  }
  window.WorldAtlasMapLoading={ready,fail};show(page==='globe'?'正在载入球体地图':'正在载入平面地图');
  overlay.querySelector('[data-loading-retry]').addEventListener('click',()=>location.reload());
  overlay.querySelector('[data-loading-back]').addEventListener('click',()=>{if(history.length>1)history.back();else location.assign(page==='globe'?'index.html':'globe.html');});
  document.addEventListener('click',async event=>{
    const link=event.target.closest('#globe-link,#atlas-link');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank')return;
    event.preventDefault();if(navigating)return;navigating=true;
    const target=link.href;show(link.id==='globe-link'?'正在切换到球体地图':'正在切换到平面地图');
    await painted();location.assign(target);
  });
  window.addEventListener('error',event=>{if(event.target===window)fail(event.message||'地图程序发生错误。');
    else if(event.target instanceof HTMLScriptElement)fail('地图程序未能载入，请重试。');},{capture:true});
  window.addEventListener('unhandledrejection',event=>fail(event.reason||'地图资源未能载入。'));
  window.addEventListener('pageshow',event=>{if(event.persisted){navigating=false;if(!initial&&!failed){overlay.hidden=true;delete document.documentElement.dataset.mapLoading;}}});
  // DOMContentLoaded alone does not wait for map tiles or image decoding.
  // The tectonic view uses one image instead of the viewport tile pyramid.
  document.addEventListener('DOMContentLoaded',()=>{
    if(page!=='flat'||document.documentElement.dataset.activeTheme!=='tectonic')return;
    const image=new Image();image.src=document.getElementById('tectonic-map').getAttribute('href');image.decode().then(ready).catch(fail);
  },{once:true});
})();
