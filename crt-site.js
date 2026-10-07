/* Live document inside a fixed CRT cabinet; one curvature pass, static edge optics. */
(() => {
  'use strict';
  const svgNS = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(svgNS, 'svg');
  defs.classList.add('crt-defs');
  defs.setAttribute('aria-hidden', 'true');
  defs.setAttribute('width', '1'); defs.setAttribute('height', '1');
  defs.innerHTML = `<defs><filter id="crtSiteCurve" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feImage id="crtSiteMap" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" color-interpolation-filters="sRGB"/><feComponentTransfer in="map" result="curve" color-interpolation-filters="sRGB"><feFuncR id="crtCurveX" type="linear" slope="1" intercept="0"/><feFuncG id="crtCurveY" type="linear" slope="1" intercept="0"/></feComponentTransfer><feDisplacementMap id="crtSiteDisplacement" in="SourceGraphic" in2="curve" scale="0" xChannelSelector="R" yChannelSelector="G" color-interpolation-filters="sRGB"/></filter></defs>`;
  const shell = document.createElement('div'); shell.className = 'crt-shell';
  const display = document.createElement('div'); display.className = 'crt-display';
  const signal = document.createElement('div'); signal.className = 'crt-signal';
  const scroller = document.createElement('div'); scroller.className = 'crt-scroll';
  scroller.tabIndex = 0; scroller.setAttribute('aria-label', 'Содержимое сайта');
  const content = document.createElement('div'); content.className = 'crt-document';
  const fixed = new Set(['siteHeader', 'grain', 'mobileMenuShell']);
  // Keep scripts outside the filtered surface; move existing content without cloning IDs.
  [...document.body.children].forEach(el => {
    if (el.tagName === 'SCRIPT') return;
    if (fixed.has(el.id)) signal.append(el); else content.append(el);
  });
  scroller.append(content); signal.prepend(scroller); display.append(signal);
  // Animate a separate screen layer: the page curvature remains static.
  const raster = document.createElement('div'); raster.className = 'crt-raster';
  raster.setAttribute('aria-hidden', 'true'); display.append(raster);
  function pauseRaster() {
    raster.classList.toggle('is-paused', document.hidden);
  }
  document.addEventListener('visibilitychange', pauseRaster);
  pauseRaster();
  const glass = document.createElement('div'); glass.className = 'crt-glass';
  glass.setAttribute('aria-hidden', 'true'); display.append(glass);
  const frame = document.createElement('img'); frame.className = 'crt-frame';
  frame.src = './assets/crt-frame.png'; frame.alt = ''; frame.draggable = false;
  frame.setAttribute('aria-hidden', 'true');
  shell.append(display, frame); document.body.append(defs, shell);
  document.documentElement.classList.add('crt-site');
  if (document.activeElement === document.body) scroller.focus({preventScroll:true});

  // Existing v91 code listens on window for header tone, grain clipping and media visibility.
  // A native overflow viewport keeps anchors, selection, forms and keyboard scrolling intact.
  let scrollRaf = 0;
  scroller.addEventListener('scroll', () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {scrollRaf = 0; window.dispatchEvent(new Event('scroll'));});
  }, {passive:true});
  function revealHash() {
    if (!location.hash) return;
    let id; try {id = decodeURIComponent(location.hash.slice(1));} catch {return;}
    const target = document.getElementById(id);
    if (target && content.contains(target)) target.scrollIntoView({behavior:'instant',block:'start'});
  }
  window.addEventListener('hashchange', revealHash);
  window.addEventListener('load', revealHash, {once:true});
  requestAnimationFrame(revealHash);

  const filter = document.getElementById('crtSiteCurve');
  const mapImage = document.getElementById('crtSiteMap');
  const displacement = document.getElementById('crtSiteDisplacement');
  const curveX = document.getElementById('crtCurveX');
  const curveY = document.getElementById('crtCurveY');
  let resizeTimer = 0;
  function sizeScreen() {
    // Measure the surface being filtered rather than a separate viewport estimate.
    const w = display.clientWidth, h = display.clientHeight;
    if (!w || !h) return;
    const longest = Math.max(w, h);
    for (const node of [filter, mapImage, displacement]) {
      node.setAttribute('x', '0'); node.setAttribute('y', '0');
      node.setAttribute('width', String(w)); node.setAttribute('height', String(h));
    }
    // Preserve the original aspect-aware bend while centring byte value 128 exactly.
    for (const [node, ratio] of [[curveX, w / longest], [curveY, h / longest]]) {
      node.setAttribute('slope', String(ratio));
      node.setAttribute('intercept', String(.5 - (128 / 255) * ratio));
    }
    displacement.setAttribute('scale', String(longest * (w <= 720 ? .063 : .115)));
    const pitch = (w <= 600 ? h : w) * .004;
    raster.style.setProperty('--raster-pitch', `${pitch}px`);
    raster.style.setProperty('--raster-half-pitch', `${pitch / 2}px`);
    raster.style.setProperty('--screen-half-height', `${h / 2}px`);
    raster.style.setProperty('--beam-start', `${h * 1.1}px`);
    raster.style.setProperty('--beam-end', `${-h * 2}px`);
  }
  function scheduleSize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sizeScreen, 120);
  }
  window.addEventListener('resize', scheduleSize, {passive:true});
  if ('ResizeObserver' in window) new ResizeObserver(scheduleSize).observe(display);
  sizeScreen();

  // Activate the filter only with a loaded same-origin map. No toDataURL/readback.
  const mapURL = './assets/crt-curve-map.png';
  const mapAsset = new Image();
  mapAsset.onload = () => {
    mapImage.setAttribute('href', mapURL);
    mapImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', mapURL);
    sizeScreen();
    requestAnimationFrame(() => signal.classList.add('has-curve'));
  };
  mapAsset.onerror = () => signal.classList.remove('has-curve');
  mapAsset.src = mapURL;
})();
