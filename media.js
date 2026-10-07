/* Shared media loading: one visibility observer, real source fallback, no heading effects. */
(() => {
  'use strict';
  const root = document.querySelector('.crt-scroll');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videos = new Set();
  const visible = new Set();
  const videoObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const video = entry.target;
      if (entry.isIntersecting) {
        visible.add(video);
        if (video.preload === 'none') {video.preload = 'metadata'; video.load();}
        if (!reduce && !document.hidden) video.play().catch(() => {});
      } else {visible.delete(video); video.pause();}
    }
  }, {root, threshold:.05});
  function observeVideo(video) {videos.add(video); videoObserver.observe(video);}
  document.querySelectorAll('.js-visible-video').forEach(observeVideo);
  document.addEventListener('visibilitychange', () => {
    for (const video of videos) {
      if (!document.hidden && visible.has(video) && !reduce) video.play().catch(() => {});
      else video.pause();
    }
  });
  function imageChain(slot, base, extensions, isLogo) {
    const image = new Image();
    image.alt = isLogo ? '' : (slot.dataset.alt || 'Материалы проекта VNATURE DESIGN');
    image.decoding = 'async';
    image.className = isLogo ? 'project-logo-img' : 'auto-media';
    let i = 0;
    image.onerror = () => {if (i < extensions.length) image.src = `${base}.${extensions[i++]}`;};
    image.onload = () => {slot.classList.add('has-user-media'); if(isLogo) slot.replaceChildren(image); else slot.append(image);};
    image.onerror();
  }
  function loadSlot(slot) {
    const isLogo = Boolean(slot.dataset.logoBase);
    const base = slot.dataset.logoBase || slot.dataset.mediaBase;
    if (isLogo) {imageChain(slot, base, ['svg','png','jpg','jpeg'], true); return;}
    if (!slot.querySelector('.media-placeholder,.case-placeholder')) {
      const placeholder = document.createElement('div');placeholder.className='media-placeholder';
      placeholder.setAttribute('aria-hidden','true');slot.append(placeholder);
    }
    const video = document.createElement('video');
    video.className = 'auto-media';video.muted=true;video.loop=true;video.playsInline=true;video.preload='metadata';
    video.setAttribute('aria-label', slot.dataset.alt || 'Видео проекта VNATURE DESIGN');
    let settled = false;
    video.onerror = () => {
      if(settled) return;settled=true;videoObserver.unobserve(video);videos.delete(video);visible.delete(video);video.remove();
      imageChain(slot, base, ['png','jpg','jpeg','webp','gif'], false);
    };
    video.onloadeddata = () => {
      if(settled)return;settled=true;slot.classList.add('has-user-media');observeVideo(video);
    };
    for(const ext of ['webm','mp4','m4v']) {
      const source=document.createElement('source');source.src=`${base}.${ext}`;
      source.type=ext==='webm'?'video/webm':'video/mp4';video.append(source);
    }
    slot.append(video);video.load();
  }
  const slots = document.querySelectorAll('[data-media-base],[data-logo-base]');
  const loader = new IntersectionObserver(entries => {
    for(const entry of entries) if(entry.isIntersecting){loader.unobserve(entry.target);loadSlot(entry.target);}
  }, {root,rootMargin:'300px 0px'});
  slots.forEach(slot => loader.observe(slot));
})();
