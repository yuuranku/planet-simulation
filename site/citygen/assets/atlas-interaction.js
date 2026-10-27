/* Native atlas camera gestures, adapted from the supplied map frontend. */
(function (root) {
  'use strict';

  function wheelPixels(event, pageHeight) {
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1;
    return Math.max(-240, Math.min(240, event.deltaY * unit));
  }

  function attach({viewport, getCamera, setCamera, reset, onTap, onCommit,
                   onGestureStart = () => {}, onDoubleClick = () => false,
                   onEscape = () => false}) {
    const listeners = [], pointers = new Map(), panSamples = [];
    const reducedMotion = root.matchMedia('(prefers-reduced-motion: reduce)');
    let wheelFrame = 0, motionFrame = 0, wheelExponent = 0, wheelX = 0, wheelY = 0, wheelCommit = 0;
    let gestureMoved = false, gestureMultiple = false, tapTarget = null, destroyed = false;
    const now = () => root.performance.now();
    const listen = (target, name, callback, options) => {
      target.addEventListener(name, callback, options);
      listeners.push(() => target.removeEventListener(name, callback, options));
    };
    const editable = target => target.closest('button,a,input,textarea,select,[contenteditable="true"]');
    const cancelMotion = () => {
      if (motionFrame) root.cancelAnimationFrame(motionFrame);
      motionFrame = 0;
    };
    const cancelWheel = () => {
      if (wheelFrame) root.cancelAnimationFrame(wheelFrame);
      wheelFrame = 0; wheelExponent = 0;
      root.clearTimeout(wheelCommit); wheelCommit = 0;
    };
    function stop() {
      const moving = !!(motionFrame || wheelFrame || wheelCommit || pointers.size);
      cancelMotion(); cancelWheel();
      const captured = Array.from(pointers.keys());
      pointers.clear(); panSamples.length = 0; tapTarget = null;
      viewport.classList.remove('dragging');
      for (const id of captured) if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
      if (moving && !destroyed) onCommit();
    }
    function animate(duration, update) {
      const started = now();
      const advance = time => {
        motionFrame = 0;
        if (destroyed) return;
        const progress = Math.min(1, Math.max(0, (time-started)/duration));
        update(progress);
        if (progress < 1) motionFrame = root.requestAnimationFrame(advance);
        else onCommit();
      };
      motionFrame = root.requestAnimationFrame(advance);
    }
    function zoomAt(factor, clientX, clientY, duration = 280) {
      if (destroyed || !(factor > 0) || !Number.isFinite(factor)) return;
      stop();
      const camera = getCamera(), bounds = viewport.getBoundingClientRect();
      const endScale = Math.max(camera.minimumScale, Math.min(camera.maximumScale, camera.scale*factor));
      if (endScale === camera.scale) return;
      const px = clientX-bounds.left, py = clientY-bounds.top;
      const x = (px-camera.translateX)/camera.scale, y = (py-camera.translateY)/camera.scale;
      const logarithm = Math.log(endScale/camera.scale);
      const update = progress => {
        const eased = 1-(1-progress)**3;
        const nextScale = progress === 1 ? endScale : camera.scale*Math.exp(logarithm*eased);
        setCamera({scale:nextScale, translateX:px-x*nextScale, translateY:py-y*nextScale});
      };
      onGestureStart();
      if (reducedMotion.matches || duration === 0) {update(1); onCommit();}
      else animate(duration, update);
    }
    function zoomBy(factor) {
      const bounds = viewport.getBoundingClientRect();
      zoomAt(factor, bounds.left+bounds.width/2, bounds.top+bounds.height/2);
    }
    const gesture = () => {
      const points = Array.from(pointers.values()).slice(0, 2);
      if (points.length === 1) return {...points[0], distance:0};
      return {x:(points[0].x+points[1].x)/2, y:(points[0].y+points[1].y)/2,
        distance:Math.hypot(points[0].x-points[1].x, points[0].y-points[1].y)};
    };
    function recordPan() {
      const camera = getCamera(), time = now();
      panSamples.push({time,x:camera.translateX,y:camera.translateY});
      while (panSamples.length && time-panSamples[0].time > 160) panSamples.shift();
    }
    function coast() {
      if (reducedMotion.matches || panSamples.length < 2) return false;
      const time = now();
      while (panSamples.length && time-panSamples[0].time > 160) panSamples.shift();
      if (panSamples.length < 2) return false;
      let first = Math.max(0,panSamples.length-2);
      while (first > 0 && panSamples[first-1].time >= time-60) first--;
      const start = panSamples[first], camera = getCamera();
      const dx = camera.translateX-start.x, dy = camera.translateY-start.y, distance = Math.hypot(dx,dy);
      const elapsed = time-start.time;
      if (elapsed <= 0 || distance < 1) return false;
      // MapLibre's pan defaults: 0.3 linearity, 1400 px/s cap, 2500 px/s² deceleration.
      const speed = Math.min(1400,distance*.3/(elapsed/1000));
      const seconds = speed/(2500*.3), travel = speed*seconds/2;
      if (travel < 1) return false;
      animate(seconds*1000, progress => {
        const amount = travel*(2*progress-progress*progress)/distance;
        setCamera({scale:camera.scale,translateX:camera.translateX+dx*amount,
          translateY:camera.translateY+dy*amount});
      });
      return true;
    }

    listen(viewport, 'wheel', event => {
      if (editable(event.target)) return;
      event.preventDefault(); cancelMotion();
      onGestureStart();
      wheelExponent -= wheelPixels(event, viewport.clientHeight) * (event.ctrlKey ? .01 : .0025);
      wheelX = event.clientX; wheelY = event.clientY;
      if (!wheelFrame) wheelFrame = root.requestAnimationFrame(() => {
        wheelFrame = 0;
        const camera = getCamera(), bounds = viewport.getBoundingClientRect();
        const factor = Math.exp(Math.max(-Math.log(4), Math.min(Math.log(4), wheelExponent)));
        wheelExponent = 0;
        const nextScale = Math.max(camera.minimumScale, Math.min(camera.maximumScale,camera.scale*factor));
        const x = (wheelX-bounds.left-camera.translateX)/camera.scale;
        const y = (wheelY-bounds.top-camera.translateY)/camera.scale;
        setCamera({scale:nextScale,translateX:wheelX-bounds.left-x*nextScale,
          translateY:wheelY-bounds.top-y*nextScale});
      });
      root.clearTimeout(wheelCommit);
      wheelCommit = root.setTimeout(() => {wheelCommit = 0; onCommit();},140);
    }, {passive:false});

    listen(viewport, 'pointerdown', event => {
      if (![0,1].includes(event.button) || editable(event.target)) return;
      event.preventDefault(); cancelMotion(); cancelWheel();
      root.getSelection()?.removeAllRanges();
      if (!pointers.size) {
        gestureMoved = false; gestureMultiple = false;
        tapTarget = event.button === 0 ? event.target : null;
        panSamples.length = 0; recordPan();
      }
      pointers.set(event.pointerId, {x:event.clientX, y:event.clientY,
        startX:event.clientX, startY:event.clientY});
      if (pointers.size > 1) gestureMultiple = true;
      onGestureStart();
      viewport.focus({preventScroll:true});
      viewport.classList.add('dragging');
      // Keep a name as the native double-click target until an actual drag begins.
      if (!event.target.closest('[data-name-id], [data-city-screen-label][data-feature-id]:not([data-feature-kind="elevation"])'))
        viewport.setPointerCapture(event.pointerId);
    });

    listen(viewport, 'pointermove', event => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const before = gesture();
      pointers.set(event.pointerId, {...previous, x:event.clientX, y:event.clientY});
      const after = gesture();
      if (Math.hypot(event.clientX-previous.startX, event.clientY-previous.startY) > 5) gestureMoved = true;
      if ((gestureMoved || gestureMultiple) && !viewport.hasPointerCapture(event.pointerId)) viewport.setPointerCapture(event.pointerId);
      const camera = getCamera(), bounds = viewport.getBoundingClientRect();
      const ratio = before.distance > 0 && after.distance > 0 ? after.distance/before.distance : 1;
      const nextScale = Math.max(camera.minimumScale, Math.min(camera.maximumScale, camera.scale*ratio));
      const x = (before.x-bounds.left-camera.translateX)/camera.scale;
      const y = (before.y-bounds.top-camera.translateY)/camera.scale;
      setCamera({scale:nextScale,translateX:after.x-bounds.left-x*nextScale,
        translateY:after.y-bounds.top-y*nextScale});
      if (!gestureMultiple) recordPan();
    });

    const finishPointer = event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (pointers.size) return;
      viewport.classList.remove('dragging');
      if (!(event.type === 'pointerup' && gestureMoved && !gestureMultiple && !wheelFrame && !wheelCommit && coast())) onCommit();
      if (event.type === 'pointerup' && !gestureMoved && !gestureMultiple && tapTarget) {
        onTap({clientX:event.clientX, clientY:event.clientY, target:tapTarget});
      }
      tapTarget = null; panSamples.length = 0;
    };
    for (const name of ['pointerup','pointercancel','lostpointercapture']) listen(viewport, name, finishPointer);
    listen(viewport, 'selectstart', event => { if (!editable(event.target)) event.preventDefault(); });
    listen(viewport, 'dragstart', event => event.preventDefault());
    listen(viewport, 'dblclick', event => {
      if (editable(event.target)) return;
      event.preventDefault();
      if (!onDoubleClick(event)) zoomAt(event.shiftKey ? .5 : 2,event.clientX,event.clientY);
    });
    listen(viewport, 'keydown', event => {
      if (editable(event.target)) return;
      if (event.key === 'Escape') {
        const moving = !!(motionFrame || wheelFrame || wheelCommit || pointers.size);
        stop();
        if (onEscape() || moving) event.preventDefault();
        return;
      }
      if (['+','='].includes(event.key)) {event.preventDefault(); zoomBy(2);}
      else if (['-','_'].includes(event.key)) {event.preventDefault(); zoomBy(.5);}
      else if (event.key === '0') {event.preventDefault(); stop(); reset();}
      else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
        event.preventDefault(); stop(); onGestureStart();
        const camera = getCamera(), distance = event.shiftKey ? 180 : 80;
        setCamera({scale:camera.scale,
          translateX:camera.translateX+({ArrowLeft:distance,ArrowRight:-distance}[event.key] || 0),
          translateY:camera.translateY+({ArrowUp:distance,ArrowDown:-distance}[event.key] || 0)});
        onCommit();
      }
    });
    const destroy = () => {
      if (destroyed) return;
      destroyed = true; stop();
      for (const remove of listeners) remove();
    };
    listen(root,'blur',stop);
    listen(root,'pagehide',destroy);
    return {zoomAt,zoomBy,stop,get dragging() {return pointers.size > 0;},
      get animating() {return !!motionFrame;},destroy};
  }

  const api = {wheelPixels, attach};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorldAtlasInteraction = api;
})(typeof window !== 'undefined' ? window : globalThis);
