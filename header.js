/* ============================================================
   v63 — persistent header + living rabbit mark
   ============================================================ */
(() => {
  "use strict";

  const header =
    document.getElementById(
      "siteHeader"
    );

  const hero =
    document.querySelector(
      ".hero"
    );

  if(header && hero){
    let headerRaf = 0;

    const updateHeaderTone = () => {
      headerRaf = 0;

      const heroRect =
        hero.getBoundingClientRect();

      const headerHeight =
        header.getBoundingClientRect().height;

      header.classList.toggle(
        "is-light",
        heroRect.bottom <=
          headerHeight
      );
    };

    const requestHeaderTone = () => {
      if(headerRaf){
        return;
      }

      headerRaf =
        requestAnimationFrame(
          updateHeaderTone
        );
    };

    updateHeaderTone();

    addEventListener(
      "scroll",
      requestHeaderTone,
      {passive:true}
    );

    addEventListener(
      "resize",
      requestHeaderTone,
      {passive:true}
    );
  }

  const brand =
    document.getElementById(
      "rabbitBrand"
    );

  const outerPath =
    brand?.querySelector(
      ".rabbit-outer"
    );

  if(
    !brand ||
    !outerPath
  ){
    return;
  }

  const reduce =
    matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

  const base =
    [[0.784,7.21],[0.0,10.188],[0.157,12.853],[1.097,15.674],[4.075,20.69],[11.755,30.564],[16.771,40.282],[18.652,43.103],[21.16,45.925],[23.668,47.806],[25.235,48.589],[28.056,49.373],[31.191,49.53],[34.013,49.06],[35.423,48.433],[37.147,47.179],[40.909,43.26],[42.32,42.476],[43.887,42.32],[45.141,43.26],[45.298,44.514],[44.201,47.179],[37.931,55.799],[35.423,60.502],[34.796,62.226],[34.169,65.361],[34.169,67.398],[34.483,68.966],[36.677,73.824],[38.558,76.489],[40.282,78.213],[42.32,79.624],[44.984,80.878],[48.903,81.975],[51.411,82.288],[56.897,82.288],[65.674,81.191],[69.906,80.251],[74.451,78.84],[80.094,76.176],[85.58,72.571],[88.871,70.063],[93.103,65.831],[97.492,59.875],[99.216,55.643],[99.687,53.135],[99.843,48.589],[99.373,44.984],[98.589,42.006],[96.708,37.774],[94.201,34.483],[91.066,31.348],[88.715,29.31],[84.169,26.176],[79.467,23.981],[76.176,23.041],[72.1,22.414],[67.555,22.257],[63.166,22.884],[58.621,24.295],[57.367,24.138],[56.583,23.511],[56.426,22.571],[57.053,21.473],[61.285,18.182],[63.793,15.674],[64.89,14.107],[65.987,11.285],[66.144,9.248],[65.361,6.27],[63.95,4.232],[61.755,2.508],[59.875,1.567],[57.68,0.94],[53.918,0.784],[50.94,1.567],[48.119,2.978],[45.925,4.545],[42.947,7.524],[39.812,11.912],[35.737,19.906],[34.169,21.317],[32.759,21.787],[31.034,21.317],[29.467,19.906],[28.84,18.652],[26.489,11.129],[24.138,6.897],[21.16,3.762],[18.495,1.881],[16.144,0.784],[13.95,0.157],[9.248,0.157],[6.897,0.94],[4.545,2.351],[2.351,4.545]];

  const leftAnchor =
    [32.0,21.2];

  const rightAnchor =
    [53.0,22.8];

  let earAnimation = 0;

  const clamp01 =
    (value) =>
      Math.max(
        0,
        Math.min(1,value)
      );

  const rotatePoint =
    (
      x,
      y,
      ax,
      ay,
      angle,
      weight
    ) => {
      if(weight <= 0){
        return [x,y];
      }

      const dx = x - ax;
      const dy = y - ay;
      const cos = Math.cos(
        angle * weight
      );
      const sin = Math.sin(
        angle * weight
      );

      return [
        ax + dx * cos - dy * sin,
        ay + dx * sin + dy * cos
      ];
    };

  const toPath =
    (points) => {
      if(!points.length){
        return "";
      }

      let d =
        `M ${points[0][0].toFixed(3)} ${points[0][1].toFixed(3)}`;

      for(
        let i = 1;
        i < points.length;
        i += 1
      ){
        d +=
          ` L ${points[i][0].toFixed(3)} ${points[i][1].toFixed(3)}`;
      }

      return d + " Z";
    };

  const drawEars =
    (
      leftAngle,
      rightAngle
    ) => {
      const points =
        base.map(
          ([x,y]) => {
            let nextX = x;
            let nextY = y;

            if(
              x < 35 &&
              y < 30
            ){
              const weight =
                clamp01(
                  (30 - y) /
                  24
                ) *
                clamp01(
                  (36 - x) /
                  18
                );

              [nextX,nextY] =
                rotatePoint(
                  nextX,
                  nextY,
                  leftAnchor[0],
                  leftAnchor[1],
                  leftAngle,
                  weight
                );
            }

            if(
              x > 31 &&
              x < 70 &&
              y < 29
            ){
              const weight =
                clamp01(
                  (29 - y) /
                  23
                );

              [nextX,nextY] =
                rotatePoint(
                  nextX,
                  nextY,
                  rightAnchor[0],
                  rightAnchor[1],
                  rightAngle,
                  weight
                );
            }

            return [
              nextX,
              nextY
            ];
          }
        );

      outerPath.setAttribute(
        "d",
        toPath(points)
      );
    };

  const blink = () => {
    brand.classList.remove(
      "is-blinking"
    );

    /*
     * Restart the CSS blink even on rapid re-hover.
     */
    void brand.offsetWidth;

    brand.classList.add(
      "is-blinking"
    );

    setTimeout(
      () =>
        brand.classList.remove(
          "is-blinking"
        ),
      300
    );
  };

  const wiggle = () => {
    if(reduce){
      return;
    }

    cancelAnimationFrame(
      earAnimation
    );

    const start =
      performance.now();

    const duration =
      760;

    const frame = (now) => {
      const p =
        Math.min(
          1,
          (now - start) /
          duration
        );

      /*
       * Envelope keeps the start/end perfectly on the original mark.
       * Each ear gets a slightly different phase so it feels alive,
       * not like one rigid object rotating.
       */
      const envelope =
        Math.sin(
          Math.PI * p
        );

      const leftAngle =
        (
          -0.115 *
          Math.sin(
            p *
            Math.PI *
            2.2
          )
        ) *
        envelope;

      const rightAngle =
        (
          0.095 *
          Math.sin(
            p *
            Math.PI *
            2.0 +
            .7
          )
        ) *
        envelope;

      drawEars(
        leftAngle,
        rightAngle
      );

      if(p < 1){
        earAnimation =
          requestAnimationFrame(
            frame
          );
      }else{
        outerPath.setAttribute(
          "d",
          toPath(base)
        );
      }
    };

    earAnimation =
      requestAnimationFrame(
        frame
      );
  };

  brand.addEventListener(
    "pointerenter",
    () => {
      wiggle();
      blink();

      /*
       * A second tiny blink gives the mark a character without
       * turning it into a cartoon mascot.
       */
      setTimeout(
        () => {
          if(
            brand.matches(
              ":hover"
            )
          ){
            blink();
          }
        },
        390
      );
    }
  );
})();


/* ============================================================
   v82 — mobile off-canvas navigation
   ============================================================ */
(() => {
  "use strict";

  const toggle =
    document.getElementById(
      "mobileMenuToggle"
    );

  const shell =
    document.getElementById(
      "mobileMenuShell"
    );

  if(!toggle || !shell){
    return;
  }

  const closeButton =
    shell.querySelector(
      ".mobile-menu-close"
    );

  const backdrop =
    shell.querySelector(
      ".mobile-menu-backdrop"
    );

  const links =
    [
      ...shell.querySelectorAll(
        "a"
      )
    ];

  let previousFocus = null;

  const focusable = () => [
    ...shell.querySelectorAll(
      'a[href], button:not([disabled])'
    )
  ].filter(
    (element) =>
      element.offsetParent !== null
  );

  const openMenu = () => {
    previousFocus =
      document.activeElement;

    shell.classList.add(
      "is-open"
    );

    shell.setAttribute(
      "aria-hidden",
      "false"
    );

    toggle.setAttribute(
      "aria-expanded",
      "true"
    );

    toggle.setAttribute(
      "aria-label",
      "Закрыть меню"
    );

    document.body.classList.add(
      "mobile-menu-open"
    );

    requestAnimationFrame(
      () => {
        closeButton?.focus();
      }
    );
  };

  const closeMenu = (
    restoreFocus = true
  ) => {
    shell.classList.remove(
      "is-open"
    );

    shell.setAttribute(
      "aria-hidden",
      "true"
    );

    toggle.setAttribute(
      "aria-expanded",
      "false"
    );

    toggle.setAttribute(
      "aria-label",
      "Открыть меню"
    );

    document.body.classList.remove(
      "mobile-menu-open"
    );

    if(
      restoreFocus &&
      previousFocus instanceof HTMLElement
    ){
      previousFocus.focus();
    }
  };

  toggle.addEventListener(
    "click",
    () => {
      if(
        shell.classList.contains(
          "is-open"
        )
      ){
        closeMenu(false);
      }else{
        openMenu();
      }
    }
  );

  closeButton?.addEventListener(
    "click",
    () => closeMenu()
  );

  backdrop?.addEventListener(
    "click",
    () => closeMenu()
  );

  links.forEach(
    (link) =>
      link.addEventListener(
        "click",
        () => closeMenu(false)
      )
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if(
        !shell.classList.contains(
          "is-open"
        )
      ){
        return;
      }

      if(event.key === "Escape"){
        event.preventDefault();
        closeMenu();
        return;
      }

      if(event.key !== "Tab"){
        return;
      }

      const items =
        focusable();

      if(!items.length){
        return;
      }

      const first =
        items[0];

      const last =
        items[
          items.length - 1
        ];

      if(
        event.shiftKey &&
        document.activeElement === first
      ){
        event.preventDefault();
        last.focus();
      }else if(
        !event.shiftKey &&
        document.activeElement === last
      ){
        event.preventDefault();
        first.focus();
      }
    }
  );

  addEventListener(
    "resize",
    () => {
      if(
        innerWidth > 720 &&
        shell.classList.contains(
          "is-open"
        )
      ){
        closeMenu(false);
      }
    },
    {passive:true}
  );
})();
