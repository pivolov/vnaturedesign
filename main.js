(() => {
  "use strict";

  const grainCanvas = document.getElementById("grain");
  const wrap = document.getElementById("heroLogoWrap");
  const canvas = document.getElementById("heroLogoCanvas");

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ------------------------------------------------------------
  // HERO VIDEO
  // ------------------------------------------------------------
  //
  // Video-only hero.
  // Keep ONE file named "hero" in /assets.
  // The loader tries common browser video containers automatically.
  //
  // Important:
  // JavaScript cannot make a browser decode a codec/container that the
  // browser itself does not support. Unsupported candidates are skipped.
  //
  const HERO_VIDEO_SOURCES = [
    "./assets/hero.webm",
    "./assets/hero.mp4",
    "./assets/hero.m4v",
    "./assets/hero.mov",
    "./assets/hero.ogv",
    "./assets/hero.ogg",
    "./assets/hero.mkv",
    "./assets/hero.avi"
  ];

  let pointerX = innerWidth * 0.5;
  let pointerY = innerHeight * 0.5;
  // Native cursor; retain pointer coordinates for the original hero interaction.
  window.addEventListener("pointermove", (event) => {
    if(event.pointerType === "touch") return;
    pointerX = event.clientX;
    pointerY = event.clientY;
  }, {passive:true});

  // ------------------------------------------------------------
  // WEBGL
  // ------------------------------------------------------------

  const gl =
    canvas.getContext("webgl", {
      alpha:true,
      antialias:true,
      premultipliedAlpha:true,
      preserveDrawingBuffer:false
    }) ||
    canvas.getContext("experimental-webgl", {
      alpha:true,
      antialias:true,
      premultipliedAlpha:true,
      preserveDrawingBuffer:false
    });

  if(gl){
    const vertexSource = `
      precision highp float;

      attribute vec2 a_position;
      attribute vec2 a_uv;

      uniform vec2 u_cursor;
      uniform vec2 u_motion;
      uniform float u_strength;
      uniform float u_aspect;
      uniform vec2 u_meshScale;

      varying vec2 v_uv;

      void main(){
        vec2 uv = a_uv;

        vec2 delta = uv - u_cursor;
        vec2 metric = vec2(delta.x * u_aspect, delta.y);
        float dist = length(metric);

        float radius = 0.465;

        float pressure =
          exp(-pow(dist / radius, 2.0) * 2.0) *
          u_strength;

        float inner =
          exp(-pow(dist / (radius * 0.58), 2.0) * 2.2) *
          u_strength;

        float core =
          pressure * 0.47 +
          inner * 0.095;

        float ringCenter = radius * 0.74;
        float ringWidth = radius * 0.28;

        float ring =
          exp(-pow((dist - ringCenter) / ringWidth, 2.0)) *
          u_strength;

        vec2 deformed = uv;

        deformed += delta * core;
        deformed -= delta * (ring * 0.064);

        float motionFalloff =
          exp(-pow(dist / (radius * 0.98), 2.0) * 2.25);

        deformed +=
          u_motion *
          motionFalloff *
          pressure *
          0.52;

        vec2 tangent =
          vec2(-metric.y, metric.x);

        tangent.x /=
          max(u_aspect, 0.001);

        deformed +=
          tangent *
          inner *
          (u_motion.x - u_motion.y) *
          0.045;

        deformed.y =
          u_cursor.y +
          (deformed.y - u_cursor.y) *
          (1.0 - pressure * 0.152);

        deformed.x =
          u_cursor.x +
          (deformed.x - u_cursor.x) *
          (1.0 + pressure * 0.108);

        vec2 clip =
          (deformed * 2.0 - 1.0) *
          u_meshScale;

        gl_Position =
          vec4(clip, 0.0, 1.0);

        v_uv = uv;
      }
    `;

    const fragmentSource = `
      precision highp float;

      uniform sampler2D u_logoMask;
      uniform sampler2D u_mediaTexture;

      uniform float u_videoMix;
      uniform vec3 u_loadingColor;
      uniform vec2 u_resolution;
      uniform vec2 u_logoWindowOffset;
      uniform vec2 u_logoWindowScale;
      uniform vec2 u_mediaCropScale;

      varying vec2 v_uv;

      void main(){
        // The alpha-mask follows the DEFORMED mesh.
        float maskAlpha =
          texture2D(
            u_logoMask,
            v_uv
          ).a;

        if(maskAlpha <= 0.001){
          gl_FragColor = vec4(0.0);
          return;
        }

        // The media is sampled from FIXED canvas/screen coordinates,
        // not from mesh UVs. So media itself does not warp.
        vec2 screenUv =
          gl_FragCoord.xy /
          u_resolution;

        vec2 logoUv =
          (screenUv - u_logoWindowOffset) /
          u_logoWindowScale;

        vec2 mediaUv =
          (logoUv - 0.5) *
          u_mediaCropScale +
          0.5;

        mediaUv =
          clamp(
            mediaUv,
            0.0,
            1.0
          );

        vec3 videoColor =
          texture2D(
            u_mediaTexture,
            mediaUv
          ).rgb;

        /*
         * Before the first real frame is uploaded, the logo is exactly
         * the hero background color. Once video is ready it fades in,
         * removing the previous white -> video jump.
         */
        vec3 color =
          mix(
            u_loadingColor,
            videoColor,
            u_videoMix
          );

        /*
         * The WebGL canvas is composited with premultipliedAlpha:true.
         * Premultiply RGB here as well so partially transparent edge
         * pixels do not create a bright/noisy fringe around the mask.
         */
        gl_FragColor =
          vec4(
            color * maskAlpha,
            maskAlpha
          );
      }
    `;

    function compile(type, source){
      const shader =
        gl.createShader(type);

      gl.shaderSource(
        shader,
        source
      );

      gl.compileShader(shader);

      if(
        !gl.getShaderParameter(
          shader,
          gl.COMPILE_STATUS
        )
      ){
        throw new Error(
          gl.getShaderInfoLog(shader) ||
          "Shader compile failed"
        );
      }

      return shader;
    }

    function createProgram(){
      const program =
        gl.createProgram();

      gl.attachShader(
        program,
        compile(
          gl.VERTEX_SHADER,
          vertexSource
        )
      );

      gl.attachShader(
        program,
        compile(
          gl.FRAGMENT_SHADER,
          fragmentSource
        )
      );

      gl.linkProgram(program);

      if(
        !gl.getProgramParameter(
          program,
          gl.LINK_STATUS
        )
      ){
        throw new Error(
          gl.getProgramInfoLog(program) ||
          "Program link failed"
        );
      }

      return program;
    }

    function buildMesh(cols, rows){
      const positions = [];
      const uvs = [];
      const indices = [];

      for(
        let y = 0;
        y <= rows;
        y++
      ){
        const v =
          y / rows;

        for(
          let x = 0;
          x <= cols;
          x++
        ){
          const u =
            x / cols;

          positions.push(
            u * 2 - 1,
            v * 2 - 1
          );

          uvs.push(
            u,
            v
          );
        }
      }

      const rowSize =
        cols + 1;

      for(
        let y = 0;
        y < rows;
        y++
      ){
        for(
          let x = 0;
          x < cols;
          x++
        ){
          const a =
            y * rowSize + x;

          const b = a + 1;
          const c = a + rowSize;
          const d = c + 1;

          indices.push(
            a, b, c,
            c, b, d
          );
        }
      }

      return {
        positions:
          new Float32Array(
            positions
          ),

        uvs:
          new Float32Array(
            uvs
          ),

        indices:
          new Uint16Array(
            indices
          )
      };
    }

    function createTexture(){
      const texture =
        gl.createTexture();

      gl.bindTexture(
        gl.TEXTURE_2D,
        texture
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        gl.CLAMP_TO_EDGE
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        gl.CLAMP_TO_EDGE
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        gl.LINEAR
      );

      return texture;
    }

    try{
      const program =
        createProgram();

      gl.useProgram(program);

      const aPosition =
        gl.getAttribLocation(
          program,
          "a_position"
        );

      const aUv =
        gl.getAttribLocation(
          program,
          "a_uv"
        );

      const uCursor =
        gl.getUniformLocation(
          program,
          "u_cursor"
        );

      const uMotion =
        gl.getUniformLocation(
          program,
          "u_motion"
        );

      const uStrength =
        gl.getUniformLocation(
          program,
          "u_strength"
        );

      const uAspect =
        gl.getUniformLocation(
          program,
          "u_aspect"
        );

      const uMeshScale =
        gl.getUniformLocation(
          program,
          "u_meshScale"
        );

      const uLogoMask =
        gl.getUniformLocation(
          program,
          "u_logoMask"
        );

      const uMediaTexture =
        gl.getUniformLocation(
          program,
          "u_mediaTexture"
        );

      const uVideoMix =
        gl.getUniformLocation(
          program,
          "u_videoMix"
        );

      const uLoadingColor =
        gl.getUniformLocation(
          program,
          "u_loadingColor"
        );

      const uResolution =
        gl.getUniformLocation(
          program,
          "u_resolution"
        );

      const uLogoWindowOffset =
        gl.getUniformLocation(
          program,
          "u_logoWindowOffset"
        );

      const uLogoWindowScale =
        gl.getUniformLocation(
          program,
          "u_logoWindowScale"
        );

      const uMediaCropScale =
        gl.getUniformLocation(
          program,
          "u_mediaCropScale"
        );

      /*
       * Hero background is var(--bg) = #101010.
       * Keep preload logo exactly the same color.
       */
      gl.uniform3f(
        uLoadingColor,
        16 / 255,
        16 / 255,
        16 / 255
      );

      gl.uniform1f(
        uVideoMix,
        0
      );

      gl.uniform1i(
        uMediaTexture,
        2
      );

      const mesh =
        buildMesh(
          132,
          46
        );

      const positionBuffer =
        gl.createBuffer();

      gl.bindBuffer(
        gl.ARRAY_BUFFER,
        positionBuffer
      );

      gl.bufferData(
        gl.ARRAY_BUFFER,
        mesh.positions,
        gl.STATIC_DRAW
      );

      gl.enableVertexAttribArray(
        aPosition
      );

      gl.vertexAttribPointer(
        aPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0
      );

      const uvBuffer =
        gl.createBuffer();

      gl.bindBuffer(
        gl.ARRAY_BUFFER,
        uvBuffer
      );

      gl.bufferData(
        gl.ARRAY_BUFFER,
        mesh.uvs,
        gl.STATIC_DRAW
      );

      gl.enableVertexAttribArray(
        aUv
      );

      gl.vertexAttribPointer(
        aUv,
        2,
        gl.FLOAT,
        false,
        0,
        0
      );

      const indexBuffer =
        gl.createBuffer();

      gl.bindBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        indexBuffer
      );

      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        mesh.indices,
        gl.STATIC_DRAW
      );

      // --------------------------------------------------------
      // LOGO MASK TEXTURE
      // --------------------------------------------------------

      const logoTexture =
        createTexture();

      gl.activeTexture(
        gl.TEXTURE0
      );

      gl.bindTexture(
        gl.TEXTURE_2D,
        logoTexture
      );

      gl.uniform1i(
        uLogoMask,
        0
      );

      const logoImage =
        new Image();

      logoImage.decoding =
        "async";

      logoImage.src = "./assets/vnature.svg";

      logoImage.onerror = () => {
        wrap.classList.remove("is-webgl");
        wrap.classList.add("is-fallback");
      };

      let logoReady = false;

      logoImage.onload = () => {
        /*
         * Rasterize only as large as the current screen actually needs.
         * The previous fixed 4240×1408 texture cost ~24 MB uncompressed
         * in GPU memory even when the logo was displayed much smaller.
         */
        const wrapRect =
          wrap.getBoundingClientRect();

        const maskDpr =
          Math.min(
            devicePixelRatio || 1,
            1.35
          );

        const texW =
          Math.max(
            1060,
            Math.min(
              3640,
              Math.round(
                wrapRect.width *
                maskDpr
              )
            )
          );

        const texH =
          Math.round(
            texW *
            352 /
            1060
          );

        const source =
          document.createElement(
            "canvas"
          );

        source.width = texW;
        source.height = texH;

        const ctx =
          source.getContext(
            "2d",
            {
              alpha:true
            }
          );

        ctx.imageSmoothingEnabled = true;

        if(
          "imageSmoothingQuality"
          in ctx
        ){
          ctx.imageSmoothingQuality =
            "high";
        }

        ctx.clearRect(
          0,
          0,
          texW,
          texH
        );

        ctx.drawImage(
          logoImage,
          0,
          0,
          texW,
          texH
        );

        gl.activeTexture(
          gl.TEXTURE0
        );

        gl.bindTexture(
          gl.TEXTURE_2D,
          logoTexture
        );

        gl.pixelStorei(
          gl.UNPACK_FLIP_Y_WEBGL,
          true
        );

        gl.pixelStorei(
          gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
          true
        );

        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          source
        );

        logoReady = true;
      };

      // --------------------------------------------------------
      // VIDEO TEXTURE
      // --------------------------------------------------------

      const videoTexture =
        createTexture();

      /*
       * Initialise with a 1x1 pixel matching --bg.
       * That guarantees texture2D() always has valid data before video.
       */
      gl.activeTexture(
        gl.TEXTURE2
      );

      gl.bindTexture(
        gl.TEXTURE_2D,
        videoTexture
      );

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([16,16,16,255])
      );

      const mediaVideo =
        document.createElement(
          "video"
        );

      mediaVideo.muted = true;
      mediaVideo.defaultMuted = true;
      mediaVideo.loop = true;
      mediaVideo.playsInline = true;
      mediaVideo.preload = "auto";

      /*
       * Safari/iOS behaviour is more reliable with these attributes
       * set explicitly as well as through JS properties.
       */
      mediaVideo.setAttribute(
        "muted",
        ""
      );

      mediaVideo.setAttribute(
        "playsinline",
        ""
      );

      let videoReady = false;
      let videoFrameUploaded = false;
      let lastUploadedVideoTime = -1;
      const hasVideoFrameCallback = typeof mediaVideo.requestVideoFrameCallback === "function";
      let videoFrameDirty = true;
      let videoFrameCallback = 0;
      function watchVideoFrame(){
        if(!hasVideoFrameCallback || videoFrameCallback) return;
        videoFrameCallback = mediaVideo.requestVideoFrameCallback(() => {
          videoFrameCallback = 0;
          videoFrameDirty = true;
          if(!mediaVideo.paused && !document.hidden && heroRenderActive) watchVideoFrame();
        });
      }
      function stopVideoFrameWatch(){
        if(videoFrameCallback){
          mediaVideo.cancelVideoFrameCallback(videoFrameCallback);
          videoFrameCallback = 0;
        }
      }
      let videoMix = 0;
      let videoMixTarget = 0;
      let heroSourceIndex = -1;
      let activeHeroSource = "";

      let heroRenderActive = true;
      let renderRaf = 0;
      let contextLost = false;

      canvas.addEventListener(
        "webglcontextlost",
        (event) => {
          event.preventDefault();
          contextLost = true;
          stopVideoFrameWatch();
          mediaVideo.pause();

          if(renderRaf){
            cancelAnimationFrame(renderRaf);
            renderRaf = 0;
          }

          wrap.classList.remove("is-webgl");
          wrap.classList.add("is-fallback");
        },
        false
      );

      function tryNextHeroVideo(){
        stopVideoFrameWatch();
        videoFrameDirty = true;
        heroSourceIndex += 1;

        if(
          heroSourceIndex >=
          HERO_VIDEO_SOURCES.length
        ){
          videoReady = false;
          videoFrameUploaded = false;
          videoMixTarget = 0;

          console.warn(
            "VNATURE: no playable hero video found. Tried:",
            HERO_VIDEO_SOURCES
          );

          return;
        }

        activeHeroSource =
          HERO_VIDEO_SOURCES[
            heroSourceIndex
          ];

        videoReady = false;
        videoFrameUploaded = false;
        lastUploadedVideoTime = -1;
        videoMixTarget = 0;
        videoMix = 0;

        mediaVideo.pause();
        mediaVideo.removeAttribute(
          "src"
        );

        mediaVideo.src =
          activeHeroSource;

        mediaVideo.load();
      }

      function startVideo(){
        if(
          mediaVideo.readyState <
          2
        ) return;

        videoReady = true;
        videoFrameDirty = true;
        watchVideoFrame();

        /*
         * Respect the operating-system reduced-motion preference.
         * loadeddata still gives WebGL a real first frame, but the loop
         * stays paused instead of autoplaying.
         */
        if(reducedMotion){
          mediaVideo.pause();
          scheduleRender();
          return;
        }

        const p =
          mediaVideo.play();

        if(
          p &&
          typeof p.catch ===
          "function"
        ){
          p.catch(() => {
            /*
             * The first loaded frame is still usable.
             * A later pointer interaction retries playback.
             */
          });
        }
      }

      mediaVideo.addEventListener(
        "loadeddata",
        startVideo
      );

      mediaVideo.addEventListener(
        "canplay",
        startVideo
      );

      mediaVideo.addEventListener(
        "error",
        () => {
          console.info(
            "VNATURE: hero source unavailable/unsupported:",
            activeHeroSource
          );

          tryNextHeroVideo();
        }
      );

      window.addEventListener(
        "pointerdown",
        () => {
          if(!reducedMotion){
            startVideo();
          }
        },
        {
          passive:true
        }
      );

      tryNextHeroVideo();

      // --------------------------------------------------------
      // INTERACTION
      // --------------------------------------------------------

      let targetU = 0.5;
      let targetV = 0.5;

      let currentU = 0.5;
      let currentV = 0.5;

      let previousU = 0.5;
      let previousV = 0.5;

      let motionU = 0;
      let motionV = 0;

      let targetStrength = 0;
      let strength = 0;
      let velocity = 0;

      let geometryDirty = true;
      let positionDirty = true;
      let cachedCanvasRect;
      let cachedWrapRect;
      let cachedMediaWidth = -1;
      let cachedMediaHeight = -1;
      const invalidateGeometry = () => {geometryDirty = true; positionDirty = true;};
      window.addEventListener("resize", invalidateGeometry, {passive:true});
      window.addEventListener("scroll", () => {positionDirty = true;}, {passive:true});
      if("ResizeObserver" in window){
        const geometryObserver = new ResizeObserver(invalidateGeometry);
        geometryObserver.observe(wrap);
        geometryObserver.observe(canvas);
      }
      if(document.fonts) document.fonts.ready.then(invalidateGeometry);
      function updateInteraction(){
        if(positionDirty || geometryDirty){
          cachedWrapRect = wrap.getBoundingClientRect();
          positionDirty = false;
        }
        const rect = cachedWrapRect;

        /*
         * Larger cursor influence field, retained from v59.
         * The elastic response begins slightly before the cursor reaches
         * the visible logo silhouette.
         */
        const interactionPadX =
          rect.width * 0.075;

        const interactionPadY =
          rect.height * 0.16;

        const inside =
          pointerX >= rect.left - interactionPadX &&
          pointerX <= rect.right + interactionPadX &&
          pointerY >= rect.top - interactionPadY &&
          pointerY <= rect.bottom + interactionPadY;

        if(inside){
          targetU =
            (pointerX - rect.left) /
            Math.max(
              rect.width,
              1
            );

          targetV =
            1 -
            (pointerY - rect.top) /
            Math.max(
              rect.height,
              1
            );

          targetStrength =
            reducedMotion
              ? 0
              : 1;
        }else{
          targetStrength = 0;
        }
      }

      function updateDynamics(){
        currentU +=
          (targetU - currentU) *
          0.205;

        currentV +=
          (targetV - currentV) *
          0.205;

        const rawMotionU =
          currentU -
          previousU;

        const rawMotionV =
          currentV -
          previousV;

        previousU =
          currentU;

        previousV =
          currentV;

        motionU +=
          (rawMotionU - motionU) *
          0.34;

        motionV +=
          (rawMotionV - motionV) *
          0.34;

        const motionLength =
          Math.hypot(
            motionU,
            motionV
          );

        const maxMotion =
          0.028;

        if(
          motionLength >
          maxMotion
        ){
          const k =
            maxMotion /
            motionLength;

          motionU *= k;
          motionV *= k;
        }

        const stiffness =
          targetStrength > strength
            ? 0.205
            : 0.145;

        const damping =
          targetStrength > 0
            ? 0.70
            : 0.735;

        velocity +=
          (targetStrength - strength) *
          stiffness;

        velocity *= damping;
        strength += velocity;

        strength =
          Math.max(
            -0.11,
            Math.min(
              1.34,
              strength
            )
          );
      }

      // --------------------------------------------------------
      // VIDEO STATE
      // --------------------------------------------------------

      function getActiveMedia(){
        return {
          width:
            videoReady
              ? (
                  mediaVideo.videoWidth ||
                  1
                )
              : 1,

          height:
            videoReady
              ? (
                  mediaVideo.videoHeight ||
                  1
                )
              : 1
        };
      }

      function updateVideoTexture(){
        if(
          !videoReady ||
          mediaVideo.readyState <
          2
        ) return;

        /*
         * A 30 fps video does not need to be uploaded 60/120 times a second.
         * Keep the elastic mesh at display refresh rate, but refresh the GPU
         * texture only when the decoded video frame actually advances.
         */
        if(videoFrameUploaded && (hasVideoFrameCallback
          ? !videoFrameDirty
          : Math.abs(mediaVideo.currentTime - lastUploadedVideoTime) < 0.0001)) return;

        gl.activeTexture(
          gl.TEXTURE2
        );

        gl.bindTexture(
          gl.TEXTURE_2D,
          videoTexture
        );

        gl.pixelStorei(
          gl.UNPACK_FLIP_Y_WEBGL,
          true
        );

        gl.pixelStorei(
          gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
          false
        );

        try{
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            mediaVideo
          );

          lastUploadedVideoTime = mediaVideo.currentTime;
          videoFrameDirty = false;

          if(!videoFrameUploaded){
            videoFrameUploaded = true;
            videoMixTarget = 1;
          }
        }catch(error){
          videoReady = false;
          videoFrameUploaded = false;
          videoMixTarget = 0;

          console.info(
            "VNATURE: browser could not upload this video format to WebGL:",
            activeHeroSource,
            error
          );

          tryNextHeroVideo();
        }
      }

      // --------------------------------------------------------
      // RESIZE + UNIFORMS
      // --------------------------------------------------------

      function resize(activeMedia){
        const mediaChanged = activeMedia.width !== cachedMediaWidth || activeMedia.height !== cachedMediaHeight;
        if(!geometryDirty && !mediaChanged) return;
        if(geometryDirty) cachedCanvasRect = canvas.getBoundingClientRect();
        const canvasRect = cachedCanvasRect;
        const wrapRect = cachedWrapRect;
        geometryDirty = false;
        cachedMediaWidth = activeMedia.width;
        cachedMediaHeight = activeMedia.height;

        const dpr =
          Math.min(
            devicePixelRatio || 1,
            1.35
          );

        const width =
          Math.max(
            1,
            Math.round(
              canvasRect.width *
              dpr
            )
          );

        const height =
          Math.max(
            1,
            Math.round(
              canvasRect.height *
              dpr
            )
          );

        if(
          canvas.width !== width ||
          canvas.height !== height
        ){
          canvas.width = width;
          canvas.height = height;

          gl.viewport(
            0,
            0,
            width,
            height
          );
        }

        gl.uniform2f(
          uResolution,
          width,
          height
        );

        gl.uniform1f(
          uAspect,
          wrapRect.width /
          Math.max(
            wrapRect.height,
            1
          )
        );

        gl.uniform2f(
          uMeshScale,

          wrapRect.width /
          Math.max(
            canvasRect.width,
            1
          ),

          wrapRect.height /
          Math.max(
            canvasRect.height,
            1
          )
        );

        /*
         * gl_FragCoord has bottom-left origin.
         * Convert visible logo wrapper into normalized canvas coordinates.
         */
        const offsetX =
          (wrapRect.left -
          canvasRect.left) /
          Math.max(
            canvasRect.width,
            1
          );

        const offsetY =
          (
            canvasRect.bottom -
            wrapRect.bottom
          ) /
          Math.max(
            canvasRect.height,
            1
          );

        const scaleX =
          wrapRect.width /
          Math.max(
            canvasRect.width,
            1
          );

        const scaleY =
          wrapRect.height /
          Math.max(
            canvasRect.height,
            1
          );

        gl.uniform2f(
          uLogoWindowOffset,
          offsetX,
          offsetY
        );

        gl.uniform2f(
          uLogoWindowScale,
          scaleX,
          scaleY
        );

        /*
         * cover:
         * u_mediaCropScale represents the visible fraction
         * of the source texture.
         */
        const logoAspect =
          wrapRect.width /
          Math.max(
            wrapRect.height,
            1
          );

        const mediaAspect =
          activeMedia.width /
          Math.max(
            activeMedia.height,
            1
          );

        let cropX = 1;
        let cropY = 1;

        if(
          mediaAspect >
          logoAspect
        ){
          cropX =
            logoAspect /
            mediaAspect;
        }else{
          cropY =
            mediaAspect /
            logoAspect;
        }

        gl.uniform2f(
          uMediaCropScale,
          cropX,
          cropY
        );
      }

      // --------------------------------------------------------
      // RENDER
      // --------------------------------------------------------

      let lastHeroPaint = -Infinity;
      function render(timestamp){
        renderRaf = 0;
        updateInteraction();
        // Keep elastic response at 60 fps, while idle video needs only 30 fps.
        const interval = (targetStrength > 0 || Math.abs(strength) > .01) ? 1000 / 60 : 1000 / 30;
        if(timestamp - lastHeroPaint < interval - 1){
          scheduleRender();
          return;
        }
        lastHeroPaint = timestamp;
        updateDynamics();

        updateVideoTexture();

        /*
         * Soft 0 -> 1 transition after the first uploaded frame.
         * Fast enough to feel immediate, slow enough to remove a flash.
         */
        videoMix +=
          (videoMixTarget - videoMix) *
          0.22;

        if(
          Math.abs(
            videoMixTarget - videoMix
          ) <
          0.001
        ){
          videoMix =
            videoMixTarget;
        }

        const activeMedia =
          getActiveMedia();

        resize(activeMedia);

        gl.clearColor(
          0,
          0,
          0,
          0
        );

        gl.clear(
          gl.COLOR_BUFFER_BIT
        );

        if(logoReady){
          gl.useProgram(
            program
          );

          gl.uniform2f(
            uCursor,
            currentU,
            currentV
          );

          gl.uniform2f(
            uMotion,
            motionU,
            motionV
          );

          gl.uniform1f(
            uStrength,
            strength
          );

          gl.uniform1f(
            uVideoMix,
            videoMix
          );

          gl.activeTexture(
            gl.TEXTURE2
          );

          gl.bindTexture(
            gl.TEXTURE_2D,
            videoTexture
          );

          gl.uniform1i(
            uMediaTexture,
            2
          );

          gl.activeTexture(
            gl.TEXTURE0
          );

          gl.bindTexture(
            gl.TEXTURE_2D,
            logoTexture
          );

          gl.uniform1i(
            uLogoMask,
            0
          );

          gl.drawElements(
            gl.TRIANGLES,
            mesh.indices.length,
            gl.UNSIGNED_SHORT,
            0
          );

          wrap.classList.add(
            "is-webgl"
          );
        }

        scheduleRender();
      }

      function scheduleRender(){
        if(
          renderRaf ||
          !heroRenderActive ||
          document.hidden ||
          contextLost
        ){
          return;
        }

        renderRaf =
          requestAnimationFrame(
            render
          );
      }

      function setHeroRenderActive(active){
        heroRenderActive = active;

        if(active && !document.hidden){
          invalidateGeometry();
          if(reducedMotion){
            mediaVideo.pause();
          }else{
            startVideo();
          }

          scheduleRender();
        }else{
          mediaVideo.pause();
          stopVideoFrameWatch();

          if(renderRaf){
            cancelAnimationFrame(
              renderRaf
            );
            renderRaf = 0;
          }
        }
      }

      if("IntersectionObserver" in window){
        const heroObserver =
          new IntersectionObserver(
            (entries) => {
              setHeroRenderActive(
                entries.some(
                  (entry) =>
                    entry.isIntersecting
                )
              );
            },
            {
              rootMargin:"140px 0px",
              threshold:0
            }
          );

        heroObserver.observe(wrap);
      }

      document.addEventListener(
        "visibilitychange",
        () => {
          if(document.hidden){
            setHeroRenderActive(false);
          }else{
            const rect =
              wrap.getBoundingClientRect();

            setHeroRenderActive(
              rect.bottom >= -140 &&
              rect.top <=
                innerHeight + 140
            );
          }
        }
      );

      scheduleRender();

    }catch(error){
      console.warn(
        "VNATURE hero WebGL fallback:",
        error
      );

      wrap.classList.remove(
        "is-webgl"
      );

      wrap.classList.add(
        "is-fallback"
      );
    }
  }else{
    wrap.classList.add(
      "is-fallback"
    );
  }

  // Grain stays disabled; the CRT shell supplies static glass and curvature.
  grainCanvas.style.display = 'none';

})();
