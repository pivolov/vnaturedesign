/* Native WebGL points; immutable geometry, scroll uniforms, no idle animation loop. */
(() => {
  'use strict';
  const section = document.querySelector('.particle-section');
  if (!section) return;
  const steps = [...section.querySelectorAll('[data-form-step]')];
  const canvas = section.querySelector('canvas');
  const visual = section.querySelector('.particle-visual');
  const scroller = document.querySelector('.crt-scroll') || document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 720px)');
  let gl, program, geometry, ready = false, loading = false, failed = false;
  let visible = false, frame = 0, needsMeasure = true;
  let start = 0, travel = 1, count = 0, dpr = 1, lastProgress = -1, activeStep = -1;
  let uniforms;

  const vertex = `
    precision highp float;
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec4 aScatter;
    uniform float uProgress;
    uniform float uAspect;
    uniform float uDpr;
    uniform float uScale;
    varying float vInk;
    vec3 turnY(vec3 v, float a) {
      float c=cos(a), s=sin(a);
      return vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);
    }
    vec3 turnX(vec3 v, float a) {
      float c=cos(a), s=sin(a);
      return vec3(v.x,c*v.y-s*v.z,s*v.y+c*v.z);
    }
    void main() {
      float seed=aScatter.w;
      float p=smoothstep(seed*.19,.80+seed*.18,uProgress);
      vec3 cloud=turnY(aScatter.xyz,uProgress*.55);
      vec3 point=mix(cloud,aPosition,p);
      float angle=mix(-.85,.38,uProgress);
      point=turnX(turnY(point,angle),.12);
      vec3 normal=turnX(turnY(aNormal,angle),.12);
      float depth=5.8-point.z;
      float focal=3.7*uScale;
      gl_Position=vec4(point.x*focal/uAspect,point.y*focal,
        1.0143885*depth-.20143885,depth);
      float rim=pow(1.-abs(normal.z),1.5);
      float size=1.1+seed*.3+rim*.25*p;
      gl_PointSize=clamp(size*uDpr*5.8/depth,.75,3.5*uDpr);
      float light=max(0.,dot(normal,normalize(vec3(-.45,.7,1.))));
      float shade=clamp(.30+.65*(1.-light)+rim*.35,.3,.98);
      // A visible front and thick sides, without drawing the rear face through them.
      float facing=smoothstep(-.18,.18,normal.z);
      float distanceFade=clamp(5.5/depth,.40,1.);
      vInk=mix((.18+seed*.25)*distanceFade,shade*facing,p);
    }`;
  const fragment = `
    precision mediump float;
    varying float vInk;
    void main() {
      float radius=length(gl_PointCoord-vec2(.5));
      if(radius>.5 || vInk<.005) discard;
      float coverage=1.-smoothstep(.28,.5,radius);
      gl_FragColor=vec4(.018,.018,.025,vInk*coverage);
    }`;

  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      gl.deleteShader(result); throw new Error('Particle shader unavailable');
    }
    return result;
  }
  function setup() {
    gl = canvas.getContext('webgl', {alpha:true, antialias:false, depth:false, stencil:false, powerPreference:'low-power'});
    if (!gl) throw new Error('WebGL unavailable');
    const vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
    program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs);
    gl.linkProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Particle program unavailable');
    gl.useProgram(program);
    const points = new DataView(geometry), total = points.getUint32(0, true);
    if (!total || total > 50000 || geometry.byteLength !== 4+total*12) throw new Error('Invalid point geometry');
    const data = new Float32Array(total*10);
    let state = 112;
    const random = () => {state = (Math.imul(state,1664525)+1013904223) >>> 0; return state/4294967296;};
    for (let i=0; i<total; i++) {
      for (let j=0; j<6; j++) data[i*10+j] = points.getInt16(4+i*12+j*2,true)/(j<3?8192:32767);
      // Real depth, not a 2D texture: near and far points project at different scales.
      data[i*10+6]=(random()-.5)*3.8;
      data[i*10+7]=(random()-.5)*2.7;
      data[i*10+8]=(random()-.5)*4.8;
      data[i*10+9]=random();
    }
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    for (const [name,size,offset] of [['aPosition',3,0],['aNormal',3,12],['aScatter',4,24]]) {
      const location = gl.getAttribLocation(program,name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,size,gl.FLOAT,false,40,offset);
    }
    uniforms = Object.fromEntries(['uProgress','uAspect','uDpr','uScale'].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0,0,0,0);
    count = total; ready = true; failed = false; lastProgress = -1;
    section.classList.add('has-particles');
    needsMeasure = true; requestDraw();
  }
  async function load() {
    if (loading || ready || failed) return;
    loading = true;
    try {
      const response = await fetch('./assets/particle-rabbit.bin');
      if (!response.ok) throw new Error('Point geometry unavailable');
      geometry = await response.arrayBuffer(); setup();
    } catch {
      failed = true; ready = false; section.classList.remove('has-particles');
    } finally {loading = false;}
  }
  function measure() {
    const h = scroller.clientHeight || window.innerHeight;
    // The CRT viewport is the scroll root; ordinary window.scrollY stays zero here.
    const stageHeight = Math.max(mobile.matches?480:580,h*.94);
    const distance = motion.matches?0:h*(mobile.matches?1.15:1.35);
    section.style.setProperty('--particle-height',`${stageHeight}px`);
    section.style.setProperty('--particle-travel',`${distance}px`);
    start = section.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
    travel = Math.max(distance,1);
    const w = visual.clientWidth, height = visual.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1,mobile.matches?1.25:1.35);
    canvas.width = Math.max(1,Math.round(w*dpr));
    canvas.height = Math.max(1,Math.round(height*dpr));
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform1f(uniforms.uAspect,w/Math.max(height,1));
    gl.uniform1f(uniforms.uDpr,dpr);
    // Keep the assembled silhouette inside narrow portrait canvases too.
    gl.uniform1f(uniforms.uScale,Math.min(1.12,(w/Math.max(height,1))*.92));
    count = Math.min(new DataView(geometry).getUint32(0,true),mobile.matches?18000:36000);
    needsMeasure = false; lastProgress = -1;
  }
  function updateSteps(progress) {
    const next=Math.min(2,Math.floor(progress*3));
    section.style.setProperty('--form-progress',progress.toFixed(4));
    if (next===activeStep) return;
    activeStep=next;
    steps.forEach((step,i)=>{step.classList.toggle('is-active',i===next);step.setAttribute('aria-pressed',String(i===next));});
  }
  function draw() {
    frame = 0;
    if (!ready || !visible || document.hidden) return;
    if (needsMeasure) measure();
    const progress = motion.matches?1:Math.max(0,Math.min(1,(scroller.scrollTop-start)/travel));
    if (progress === lastProgress) return;
    lastProgress = progress; updateSteps(progress);
    gl.uniform1f(uniforms.uProgress,progress);
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.POINTS,0,count);
    // No self-scheduling: a stationary page consumes no animation frames.
  }
  function requestDraw() {
    if (!frame && ready && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function resize() {needsMeasure = true; requestDraw();}
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) {load(); requestDraw();}
    else if (frame) {cancelAnimationFrame(frame); frame = 0;}
  },{root:scroller === document.documentElement?null:scroller,rootMargin:'160px 0px'});
  observer.observe(section);
  steps.forEach((step,i)=>step.addEventListener('click',()=>{
    if (!ready || motion.matches) {updateSteps((i+.5)/3);return;}
    if (needsMeasure) measure();
    scroller.scrollTo({top:start+(i===2?1:i===1?.5:0)*travel,behavior:'smooth'});
  }));
  scroller.addEventListener('scroll',requestDraw,{passive:true});
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('load',resize,{once:true});
  motion.addEventListener('change',resize);
  mobile.addEventListener('change',resize);
  document.addEventListener('visibilitychange',requestDraw);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(visual); resizeObserver.observe(scroller);
  // Content above can change height after video metadata or font loading.
  document.querySelectorAll('#about video').forEach(video=>video.addEventListener('loadedmetadata',resize,{once:true}));
  if (document.fonts) document.fonts.ready.then(resize);
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault(); ready = false; section.classList.remove('has-particles');
    if (frame) cancelAnimationFrame(frame); frame = 0;
  });
  canvas.addEventListener('webglcontextrestored',()=>{
    try {setup();} catch {failed = true; ready = false; section.classList.remove('has-particles');}
  });
})();
