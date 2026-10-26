// 11 硬盘 — 1950s atomic-age advertising turning into precision engineering.
// Part 1 (cards 0–2): a cream magazine-ad page. Flat inks + bold outlines are drawn on one canvas, dot densities
// on a second one; a GL pass turns the second into a printed halftone screen over the first.
// Part 2 (card 3): the camera pushes into a modern drive — a baked brushed-metal platter with anisotropic
// highlights in a deep-teal studio; capacity curve vs. lifespan bar; the platter spins down.
'use strict';
(() => {
  const ch = CH('disk');
  const TAU = Math.PI * 2;
  const CREAM = '#F4EAD5', TURQ = '#3FB8AF', CORAL = '#FF6B57', MUST = '#E0A526', CHAR = '#2B2724',
    OXIDE = '#93502F', OXD = '#62301A', ALU = '#DDD5C5', ALUD = '#A9A090', GLASS = '#243130', WOOD = '#B98C52';
  const DISPLAY = '"Abril Fatface"';

  // ---------- shaders ----------
  const PAPER = `void main(){ vec2 px=uv*R;
    float n=fbm3(px*.0035), m=fbm3(px*.022+5.);
    float fib=vn(px*vec2(.05,.9))*vn(px*vec2(.9,.04)+3.);
    vec3 c=vec3(.957,.918,.835)*(.975+.05*n)-.012*m-.03*smoothstep(.55,.95,fib);
    vec2 q=uv-.5; c*=1.-dot(q,q)*.22;
    O=vec4(c,1.);}`;
  const STUDIO = `void main(){ vec2 px=uv*R; vec2 q=(uv-vec2(.62,.56))*vec2(R.x/R.y,1.);
    float g=exp(-dot(q,q)*1.5);
    vec3 c=mix(vec3(.09,.175,.172),vec3(.20,.345,.335),g);
    vec2 s=mat2(.7071,.7071,-.7071,.7071)*px/9.; float d=length(fract(s)-.5);
    c+=vec3(.016,.03,.028)*smoothstep(.34*g+.07,.34*g+.01,d);
    c*=.96+.07*fbm3(px*.004);
    O=vec4(c,1.);}`;
  const HALF = `uniform sampler2D SRC; uniform sampler2D SH;
    void main(){ vec2 px=uv*R; vec3 c=texture(SRC,uv).rgb; vec3 s=texture(SH,uv).rgb;
      const float P=6.5;
      vec2 q=mat2(.7071,.7071,-.7071,.7071)*px/P; float d=length(fract(q)-.5)*P;
      float rd=sqrt(s.r)*P*.68; float cov=clamp(rd-d+.5,0.,1.)*smoothstep(.05,.7,rd);
      c=mix(c,c*vec3(.34,.33,.36),cov);
      vec2 q2=mat2(.966,.259,-.259,.966)*px/P; float d2=length(fract(q2)-.5)*P;
      float rd2=sqrt(s.g)*P*.6; float cov2=clamp(rd2-d2+.5,0.,1.)*smoothstep(.05,.7,rd2);
      c=mix(c,vec3(1.,.97,.9),cov2*.85);
      O=vec4(c,1.);}`;
  // concentric-brushed mirror platter: two light sources give the classic crossed "bow-tie" highlights
  const PLATTER = `uniform float A1; uniform float A2;
    void main(){ vec2 p=(uv-.5)*2.; float r=length(p); if(r>1.){O=vec4(0.);return;}
      float th=atan(p.y,p.x);
      float fine=h21(vec2(floor(r*720.),1.7)), mid=h21(vec2(floor(r*150.),4.1));
      float br=.55*fine+.45*mid;
      float env=smoothstep(-1.1,1.1,p.y-.45*p.x);
      vec3 c=mix(vec3(.24,.27,.28),vec3(.56,.60,.60),env)*(.94+.12*br);
      c+=vec3(.10,.13,.12)*exp(-dot(p-vec2(-.45,.5),p-vec2(-.45,.5))*3.);
      float s1=sin(th-A1), s2=sin(th-A2);
      float w1=exp(-s1*s1/.0011)+.32*exp(-s1*s1/.03);
      float w2=.5*exp(-s2*s2/.0022)+.16*exp(-s2*s2/.05);
      float rr=smoothstep(.28,.6,r)*(.45+.55*r);
      c+=vec3(1.,.94,.84)*w1*rr*(.45+.95*br)+vec3(.40,.90,.84)*w2*rr*(.45+.95*br);
      c+=vec3(.55)*smoothstep(.972,.988,r)*smoothstep(1.,.99,r);
      c=mix(c,vec3(.16,.17,.17),smoothstep(.29,.27,r));
      O=vec4(c,smoothstep(1.,.993,r));}`;

  // ---------- layout ----------
  const HERO = { x: 1310, y: 440, rx: 400, ry: 138 };
  const GA = 2.5; // where the first glint sits on the hero rim
  const GLINT = [HERO.x + HERO.rx * Math.cos(GA), HERO.y + HERO.ry * Math.sin(GA) + 6];
  const ICON = { x: 564, y: 712, rx: 118, ry: 41 };
  const YX = y => 300 + (y - 1950) * 44;
  const LY = 600;
  const CAB = { x: 1100, gy: 806 };
  const STK = { x: -75, y0: -252, dy: 4.1, rx: 92, ry: 14 };   // stack inside the cabinet (cabinet-local)
  const BIG = { x: 440, y: 468, r: 290 };                         // 24-inch platter, face-on
  const K = BIG.r * 2 / 24;                                        // px per inch for the scale comparison
  const D5 = { x: 812, w: 8 * K, h: 5.75 * K, yb: 758 };          // drives lie landscape: platter left, actuator right
  const D3 = { x: 1078, w: 5.75 * K, h: 4 * K, yb: 758 };
  const P35 = { x: D3.x + 4 + 3.74 / 2 * K, y: D3.yb - D3.h / 2, r: 3.74 / 2 * K };
  const PE = { x: 1236, y: 470, r: 360 };
  const SEEKS = [[7.62, 44], [8.92, 12], [9.38, 31]];
  const SD0 = 16.55, SDD = 1.9;                                    // spin-down start / length
  const PU0 = 13.82;                                               // push-in into the modern drive

  let paper, studio, plat, platS, art, ag, shd, sg;
  const DK = a => `rgba(255,0,0,${a})`, HL = a => `rgba(0,255,0,${a})`;
  const ell = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, TAU); };
  function star(g, x, y, r1, r2, n, rot) {
    g.beginPath();
    for (let k = 0; k < n * 2; k++) { const a = rot + k * Math.PI / n, r = k % 2 ? r2 : r1; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.closePath();
  }
  function kidney(g, x, y, sx, sy, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(sx, sy);
    g.beginPath(); g.moveTo(-1, .05);
    g.bezierCurveTo(-1.02, -.75, -.25, -.95, .22, -.6); g.bezierCurveTo(.55, -.36, .88, -.78, 1.08, -.3);
    g.bezierCurveTo(1.25, .2, .8, .78, .1, .7); g.bezierCurveTo(-.45, .64, -.98, .82, -1, .05); g.closePath();
    g.restore();
  }
  function twinkle(g, x, y, r) { // the four-point "atomic" sparkle of 1950s ads
    g.beginPath();
    for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 ? r * .2 : r; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    g.closePath(); g.fill();
  }
  function sparkle(g, x, y, s, rot, a) {
    if (a <= 0 || s <= 0) return;
    g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(x, y, 0, x, y, s * .7);
    gr.addColorStop(0, 'rgba(255,248,230,.85)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#FFF9EC';
    g.beginPath();
    for (let k = 0; k < 8; k++) { const an = rot + k * Math.PI / 4, r = k % 2 ? s * .09 : (k % 4 ? s * .55 : s); g.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); }
    g.closePath(); g.fill();
    g.restore();
  }

  // ---------- ad-layer objects (g = flat ink, s = dot density) ----------
  function platterAd(g, s, x, y, rx, ry, o = {}) {
    const a = o.alpha ?? 1; if (a <= 0) return;
    const tilt = clamp(1 - ry / rx), th = (o.th ?? 6) * tilt * Math.max(.5, rx / 400) + (tilt > .05 ? 1.2 : 0);
    const lw = clamp(rx / 130, 1.2, 3.2), rot = o.rot || 0, sq = ry / rx;
    g.save(); g.globalAlpha *= a; s.save(); s.globalAlpha *= a;
    if (o.shadow !== false) { // hard printed drop shadow
      ell(s, x + rx * .035 + 5, y + th + ry * .06 + 7, rx, ry); s.fillStyle = DK(.42); s.fill();
    }
    g.strokeStyle = CHAR; g.lineJoin = 'round';
    if (th > .6) {
      g.beginPath(); g.ellipse(x, y + th, rx, ry, 0, 0, Math.PI); g.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); g.closePath();
      g.fillStyle = OXD; g.fill(); g.lineWidth = lw; g.stroke();
    }
    ell(g, x, y, rx, ry); g.fillStyle = OXIDE; g.fill();
    // tone + the two-wedge shine of a polished disk (light dots), in disk coordinates
    s.save(); ell(s, x, y, rx, ry); s.clip(); s.translate(x, y); s.scale(1, sq);
    let gr = s.createLinearGradient(-rx * .8, -rx * .8, rx * .8, rx * .8);
    gr.addColorStop(0, DK(0)); gr.addColorStop(1, DK(.24)); s.fillStyle = gr; s.fillRect(-rx, -rx, rx * 2, rx * 2);
    const SH = -2.25;
    for (const base of [SH, SH + Math.PI]) {
      for (const [w, al] of [[.34, .16], [.2, .2], [.09, .3]]) {
        s.beginPath(); s.moveTo(0, 0); s.arc(0, 0, rx * .985, base - w, base + w); s.closePath();
        const rg = s.createRadialGradient(0, 0, rx * .22, 0, 0, rx);
        rg.addColorStop(0, HL(0)); rg.addColorStop(.55, HL(al * (base === SH ? 1 : .7))); rg.addColorStop(1, HL(al * .5));
        s.fillStyle = rg; s.fill();
      }
    }
    s.restore();
    g.lineWidth = Math.max(.8, lw * .42); g.strokeStyle = 'rgba(48,18,6,.32)';
    for (const k of [.36, .47, .58, .69, .8, .91]) { ell(g, x, y, rx * k, ry * k); g.stroke(); }
    g.strokeStyle = 'rgba(232,170,120,.55)'; g.lineWidth = Math.max(.8, lw * .5);
    g.beginPath(); g.ellipse(x, y, rx * .965, ry * .965, 0, Math.PI * .95, Math.PI * 1.55); g.stroke();
    g.strokeStyle = CHAR; ell(g, x, y, rx, ry); g.lineWidth = lw; g.stroke();
    // hub (raised aluminium clamp with six bolts)
    const hr = .19, hth = Math.max(th * 1.6, tilt * rx * .02), hy = y - hth;
    if (hth > .6) {
      g.beginPath(); g.ellipse(x, y, rx * hr, ry * hr, 0, 0, Math.PI); g.ellipse(x, hy, rx * hr, ry * hr, 0, Math.PI, 0, true); g.closePath();
      g.fillStyle = ALUD; g.fill(); g.lineWidth = lw * .7; g.stroke();
    }
    ell(g, x, hy, rx * hr, ry * hr); g.fillStyle = ALU; g.fill(); g.lineWidth = lw * .8; g.stroke();
    s.save(); ell(s, x, hy, rx * hr, ry * hr); s.clip();
    gr = s.createLinearGradient(x - rx * hr, hy - ry * hr, x + rx * hr, hy + ry * hr);
    gr.addColorStop(0, HL(.5)); gr.addColorStop(.45, HL(0)); gr.addColorStop(.55, DK(0)); gr.addColorStop(1, DK(.3));
    s.fillStyle = gr; s.fillRect(x - rx * hr, hy - ry * hr, 2 * rx * hr, 2 * ry * hr);
    s.restore();
    ell(g, x, hy, rx * .125, ry * .125); g.lineWidth = lw * .5; g.stroke();
    g.fillStyle = CHAR;
    for (let k = 0; k < 6; k++) {
      const an = rot + k * TAU / 6;
      ell(g, x + Math.cos(an) * rx * .158, hy + Math.sin(an) * ry * .158, rx * .016, ry * .016 + rx * .005 * tilt); g.fill();
    }
    ell(g, x, hy, rx * .045, ry * .045); g.fill();
    if (o.speed > 0) { // motion lines around the turning rim
      g.lineCap = 'round'; g.lineWidth = lw * 1.1; g.strokeStyle = CHAR;
      const f = Math.floor((o.speedT || 0) * 8) % 2;
      for (const [a0, len] of [[2.3, .42], [-.84, .42]]) {
        for (let i = 0; i < 3; i++) {
          const sc = 1.05 + i * .045, j = (f ? .04 : 0) + i * .07;
          g.globalAlpha = a * o.speed * (1 - i * .18);
          g.beginPath(); g.ellipse(x, y + th * .5, rx * sc, ry * sc + (sc - 1) * rx * .25, 0, a0 + j, a0 + j + len * (1 - i * .2)); g.stroke();
        }
      }
    }
    g.restore(); s.restore();
  }

  function floppy8(g, s, x, y, sz, rot, a) {
    if (a <= 0) return;
    const h = sz / 2;
    s.save(); s.globalAlpha *= a; s.translate(x + 11, y + 13); s.rotate(rot); s.fillStyle = DK(.55); s.fillRect(-h, -h, sz, sz); s.restore();
    g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(rot);
    g.fillStyle = '#3B3632'; g.fillRect(-h, -h, sz, sz);
    g.fillStyle = CREAM; g.fillRect(-h + sz * .08, -h + sz * .07, sz * .52, sz * .2);
    g.strokeStyle = 'rgba(43,39,36,.45)'; g.lineWidth = 1.5;
    for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(-h + sz * .12, -h + sz * (.15 + k * .065)); g.lineTo(-h + sz * .55, -h + sz * (.15 + k * .065)); g.stroke(); }
    ell(g, 0, 0, sz * .17, sz * .17); g.fillStyle = OXIDE; g.fill();
    ell(g, 0, 0, sz * .1, sz * .1); g.fillStyle = CREAM; g.fill();
    g.fillStyle = OXIDE; g.beginPath(); g.roundRect(-sz * .05, sz * .22, sz * .1, sz * .24, sz * .05); g.fill();
    ell(g, sz * .17, -sz * .04, sz * .022, sz * .022); g.fillStyle = CREAM; g.fill();
    g.lineWidth = 3; g.strokeStyle = CHAR; g.strokeRect(-h, -h, sz, sz);
    g.restore();
  }

  function armState(t) {
    let i = 25, ext = 0;
    for (const [tk, to] of SEEKS) {
      if (t < tk) return { i, ext };
      const u = t - tk;
      if (u < .34) {
        const r = ease.inOut(clamp(u / .08)), m = ease.inOut(clamp((u - .06) / .17)), x = ease.out(clamp((u - .23) / .11));
        return { i: lerp(i, to, m), ext: x > 0 ? x : ext * (1 - r) };
      }
      i = to; ext = 1;
    }
    return { i, ext };
  }

  // IBM 350-style cabinet, front view; local origin = centre of the pallet bottom
  function cabinet(g, s, t, x, y, n, skip) {
    g.save(); g.translate(x, y); s.save(); s.translate(x, y);
    g.strokeStyle = CHAR; g.lineJoin = 'round';
    // pallet: deck, three blocks, bottom boards
    g.fillStyle = WOOD; g.lineWidth = 2.5;
    for (const [px, py, pw, ph] of [[-250, -32, 500, 9], [-250, -9, 500, 9], [-250, -23, 46, 14], [-23, -23, 46, 14], [204, -23, 46, 14]]) {
      g.fillRect(px, py, pw, ph); g.strokeRect(px, py, pw, ph);
    }
    const CT = -552, CB = -32;
    // body
    g.beginPath(); g.roundRect(-230, CT, 460, CB - CT, [18, 18, 3, 3]); g.fillStyle = TURQ; g.fill();
    let gr = s.createLinearGradient(40, 0, 232, 0); gr.addColorStop(0, DK(0)); gr.addColorStop(1, DK(.5));
    s.fillStyle = gr; s.fillRect(-230, CT, 460, CB - CT);
    gr = s.createLinearGradient(-230, 0, -150, 0); gr.addColorStop(0, HL(.45)); gr.addColorStop(1, HL(0));
    s.fillStyle = gr; s.fillRect(-230, CT, 120, CB - CT);
    g.lineWidth = 4; g.stroke();
    // top cap
    g.beginPath(); g.roundRect(-230, CT, 460, 30, [18, 18, 0, 0]); g.fillStyle = '#EADFC6'; g.fill(); g.lineWidth = 3; g.stroke();
    // window with the disk stack and the access mechanism
    const wx = -206, wy = CT + 52, ww = 412, wh = 270;
    g.save(); g.beginPath(); g.roundRect(wx, wy, ww, wh, 8); g.fillStyle = GLASS; g.fill(); g.clip();
    gr = g.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(63,184,175,.10)');
    g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
    const top = STK.y0 - (n - 1) * STK.dy;
    g.fillStyle = '#6E716C'; g.fillRect(STK.x - 6, wy, 12, wh);                // spindle
    g.fillStyle = '#8D928B'; g.fillRect(112, wy + 18, 8, wh - 36); g.fillRect(146, wy + 18, 8, wh - 36);   // positioner rails
    const st = armState(t);
    const ay = STK.y0 - st.i * STK.dy - STK.dy * .5;
    const drawArm = () => {
      const tip = lerp(36, -30, st.ext);
      g.fillStyle = '#E4DCCB'; g.fillRect(tip, ay - 1.6, 112 - tip, 3.2);
      g.fillStyle = '#F2EEE4'; g.fillRect(tip - 7, ay - 2.6, 9, 5.2);
      g.fillStyle = CORAL; g.fillRect(104, ay - 13, 58, 26); g.strokeStyle = CHAR; g.lineWidth = 2; g.strokeRect(104, ay - 13, 58, 26);
    };
    let armDrawn = false;
    for (let i = 0; i < n; i++) {
      if (i === skip) continue;
      const py = STK.y0 - i * STK.dy;
      const topmost = i === n - 1;
      ell(g, STK.x, py, STK.rx, STK.ry); g.fillStyle = topmost ? OXIDE : '#3E1E10'; g.fill();
      g.beginPath(); g.ellipse(STK.x, py, STK.rx, STK.ry, 0, .02, Math.PI - .02); g.strokeStyle = '#C47A48'; g.lineWidth = 1.7; g.stroke();
      if (topmost) { g.beginPath(); g.ellipse(STK.x, py, STK.rx, STK.ry, 0, Math.PI, TAU); g.strokeStyle = '#7A3C20'; g.lineWidth = 1.2; g.stroke(); }
      if (!armDrawn && i >= Math.round(st.i) && n > 40) { drawArm(); armDrawn = true; }
    }
    if (n > 0) {
      ell(g, STK.x, top - 3, STK.rx * .2, STK.ry * .2); g.fillStyle = ALU; g.fill(); g.strokeStyle = CHAR; g.lineWidth = 1.5; g.stroke();
    }
    if (!armDrawn && n > 40) drawArm();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,248,230,.09)';
    g.beginPath(); g.moveTo(wx + 40, wy + wh); g.lineTo(wx + 150, wy); g.lineTo(wx + 205, wy); g.lineTo(wx + 95, wy + wh); g.fill();
    g.beginPath(); g.moveTo(wx + 230, wy + wh); g.lineTo(wx + 340, wy); g.lineTo(wx + 360, wy); g.lineTo(wx + 250, wy + wh); g.fill();
    g.restore();
    g.beginPath(); g.roundRect(wx, wy, ww, wh, 8); g.lineWidth = 4; g.strokeStyle = CHAR; g.stroke();
    // lower panel: louvres + lamps
    g.beginPath(); g.roundRect(-206, CT + 345, 412, 140, 6); g.fillStyle = '#EFE4CC'; g.fill(); g.lineWidth = 3; g.stroke();
    gr = s.createLinearGradient(0, CT + 345, 0, CT + 485); gr.addColorStop(0, DK(.28)); gr.addColorStop(.3, DK(0));
    s.fillStyle = gr; s.fillRect(-206, CT + 345, 412, 140);
    g.lineWidth = 3; g.lineCap = 'round';
    for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(-180, CT + 368 + k * 15); g.lineTo(60, CT + 368 + k * 15); g.stroke(); }
    [[110, CORAL], [145, MUST], [180, TURQ]].forEach(([lx, c], k) => {
      const on = k === 0 ? (Math.floor(t * 3) % 2 ? 1 : .55) : 1;
      ell(g, lx - 20, CT + 385, 11, 11); g.fillStyle = c; g.globalAlpha = on; g.fill(); g.globalAlpha = 1; g.lineWidth = 2.5; g.stroke();
    });
    g.beginPath(); g.roundRect(84, CT + 420, 90, 40, 5); g.lineWidth = 2.5; g.stroke();
    g.fillStyle = CHAR; g.fillRect(122, CT + 428, 14, 24);
    // kick plate
    g.fillStyle = CHAR; g.fillRect(-230, CB - 18, 460, 18);
    g.restore(); s.restore();
  }

  // forklift silhouette, facing right; origin = front of the mast at ground level
  function forklift(g, s, x, y, lift) {
    g.save(); g.translate(x, y); s.save(); s.translate(x, y);
    g.fillStyle = CHAR; g.strokeStyle = CHAR; g.lineJoin = 'round';
    // mast + forks
    g.fillRect(-32, -372, 24, 368);
    g.fillStyle = '#3D3733'; g.fillRect(-27, -372 - lift, 14, 368);
    g.fillStyle = CHAR;
    g.fillRect(-12, -138 - lift, 12, 128); for (let k = 0; k < 4; k++) g.fillRect(-12, -134 - lift + k * 30, 30, 5);
    g.beginPath(); g.moveTo(-6, -24 - lift); g.lineTo(226, -22 - lift); g.lineTo(232, -16 - lift); g.lineTo(-6, -14 - lift); g.closePath(); g.fill();
    // chassis + counterweight
    g.beginPath(); g.roundRect(-340, -168, 156, 128, [58, 10, 6, 24]); g.fill();
    g.fillRect(-200, -110, 172, 70);
    g.beginPath(); g.moveTo(-60, -110); g.lineTo(-30, -150); g.lineTo(-30, -60); g.closePath(); g.fill();
    // overhead guard
    g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-296, -168); g.lineTo(-282, -356); g.lineTo(-92, -350); g.lineTo(-68, -110); g.stroke();
    // operator
    g.beginPath(); g.arc(-182, -268, 18, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-212, -170); g.lineTo(-206, -240); g.quadraticCurveTo(-182, -252, -160, -236); g.lineTo(-130, -196); g.lineTo(-138, -186);
    g.lineTo(-166, -214); g.lineTo(-170, -170); g.closePath(); g.fill();
    g.fillRect(-232, -230, 14, 64); g.fillRect(-232, -176, 70, 12);
    g.lineWidth = 6; g.beginPath(); g.moveTo(-112, -110); g.lineTo(-134, -192); g.stroke();
    g.beginPath(); g.ellipse(-136, -196, 20, 6, -.3, 0, TAU); g.stroke();
    // beacon + stripe
    g.fillStyle = MUST; g.beginPath(); g.arc(-186, -360, 11, Math.PI, 0); g.fill();
    g.fillRect(-336, -116, 290, 7);
    // wheels
    for (const [wx, r] of [[-262, 30], [-84, 36]]) {
      g.fillStyle = CHAR; g.beginPath(); g.arc(wx, -r, r, 0, TAU); g.fill();
      g.fillStyle = ALU; g.beginPath(); g.arc(wx, -r, r * .36, 0, TAU); g.fill();
    }
    const gr = s.createLinearGradient(-340, -168, -240, -60); gr.addColorStop(0, HL(.5)); gr.addColorStop(.6, HL(0));
    s.fillStyle = gr; s.beginPath(); s.roundRect(-340, -168, 156, 128, [58, 10, 6, 24]); s.fill();
    g.restore(); s.restore();
  }

  function drive525(g, s, x, top, a) {
    if (a <= 0) return;
    const w = D5.w, h = D5.h;
    s.save(); s.globalAlpha *= a; s.fillStyle = DK(.5); s.beginPath(); s.roundRect(x + 10, top + 12, w, h, 6); s.fill(); s.restore();
    g.save(); g.globalAlpha *= a; g.strokeStyle = CHAR; g.lineJoin = 'round';
    g.beginPath(); g.roundRect(x, top, w, h, 6); g.fillStyle = '#D9D0BE'; g.fill(); g.lineWidth = 2.5; g.stroke();
    g.beginPath(); g.roundRect(x + 22, top + 6, w - 28, h - 12, 4); g.fillStyle = '#CBC1AC'; g.fill(); g.lineWidth = 1.5; g.stroke();
    g.fillStyle = CHAR; g.fillRect(x, top, 16, h);                      // front bezel
    g.fillStyle = CORAL; g.fillRect(x + 6, top + h - 26, 4, 12);
    // stepper positioner + arm
    const mx = x + w - 30, my = top + h - 34;
    ell(g, mx, my, 15, 15); g.fillStyle = '#8C8578'; g.fill(); g.lineWidth = 2; g.stroke();
    g.restore();
    const pr = 5.12 / 2 * K, cx = x + 24 + pr, cy = top + h / 2;
    platterAd(g, s, cx, cy, pr, pr, { shadow: false, alpha: a, rot: .4 });
    g.save(); g.globalAlpha *= a; g.strokeStyle = '#EDE6D6'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(mx, my); g.lineTo(cx + pr * .62, cy + pr * .2); g.stroke();
    g.strokeStyle = CHAR; g.lineWidth = 1.2; g.stroke();
    ell(g, mx, my, 5, 5); g.fillStyle = CHAR; g.fill();
    g.restore();
  }
  function drive35Case(g, s, x, top, a) {
    if (a <= 0) return;
    const w = D3.w, h = D3.h;
    s.save(); s.globalAlpha *= a; s.fillStyle = DK(.5); s.beginPath(); s.roundRect(x + 9, top + 11, w, h, 5); s.fill(); s.restore();
    g.save(); g.globalAlpha *= a; g.strokeStyle = CHAR; g.lineJoin = 'round';
    g.beginPath(); g.roundRect(x, top, w, h, 5); g.fillStyle = '#C3C6C2'; g.fill(); g.lineWidth = 2.2; g.stroke();
    ell(g, P35.x - D3.x + x, top + h / 2, P35.r + 2.5, P35.r + 2.5); g.fillStyle = '#9EA29F'; g.fill();
    // actuator magnet plate
    g.beginPath(); g.roundRect(x + w * .74, top + 4, w * .23, h * .5, 5); g.fillStyle = '#4A4B4A'; g.fill(); g.lineWidth = 1.2; g.stroke();
    g.fillStyle = CHAR;
    for (const [sx, sy] of [[w - 6, h - 6], [w * .66, 6], [w - 6, h * .62]]) { ell(g, x + sx, top + sy, 2.2, 2.2); g.fill(); }
    g.restore();
  }

  // ---------- metal layer (drawn after the halftone pass) ----------
  function spin(t) { // angle and per-frame smear of the clamp
    if (t < SD0) return { th: 0, sm: 9 };
    const u = clamp((t - SD0) / SDD), w0 = 260;
    return { th: w0 * SDD * (1 - Math.pow(1 - u, 4)) / 4, sm: w0 * Math.pow(1 - u, 3) / 60 };
  }
  function clampHub(c, x, y, r, sp) {
    const R0 = r * .27;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(x + r * .012, y + r * .018, R0 * 1.03, 0, TAU); c.fill();
    let gr = c.createRadialGradient(x - R0 * .35, y - R0 * .45, 0, x, y, R0);
    gr.addColorStop(0, '#F3F0E8'); gr.addColorStop(.55, '#BEBCB5'); gr.addColorStop(1, '#85857F');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, R0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(15,18,18,.6)'; c.lineWidth = Math.max(1, r * .004); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.arc(x, y, R0 * .8, 0, TAU); c.stroke();
    const rs = r * .165, ss = r * .022;
    if (sp.sm >= TAU / 6) {
      c.strokeStyle = 'rgba(40,40,38,.42)'; c.lineWidth = ss * 1.9; c.beginPath(); c.arc(x, y, rs, 0, TAU); c.stroke();
    } else {
      const steps = Math.max(1, Math.ceil(sp.sm / .05));
      for (let k = 0; k < 6; k++) {
        for (let j = 0; j < steps; j++) {
          const an = sp.th + k * TAU / 6 - sp.sm * j / steps;
          c.globalAlpha = j === 0 ? 1 : .5 / steps * (steps - j);
          c.fillStyle = '#3A3B39'; c.beginPath(); c.arc(x + Math.cos(an) * rs, y + Math.sin(an) * rs, ss, 0, TAU); c.fill();
          if (j === 0) { c.strokeStyle = '#D9D7D0'; c.lineWidth = ss * .35; c.beginPath(); c.moveTo(x + Math.cos(an) * rs - ss * .5, y + Math.sin(an) * rs); c.lineTo(x + Math.cos(an) * rs + ss * .5, y + Math.sin(an) * rs); c.stroke(); }
        }
      }
      c.globalAlpha = 1;
      const an = sp.th + TAU / 12; // balance notch
      c.fillStyle = 'rgba(30,30,28,.6)'; c.beginPath(); c.arc(x + Math.cos(an) * R0 * .88, y + Math.sin(an) * R0 * .88, ss * .6, 0, TAU); c.fill();
    }
    gr = c.createRadialGradient(x - r * .02, y - r * .02, 0, x, y, r * .06);
    gr.addColorStop(0, '#9A9993'); gr.addColorStop(1, '#2E2F2D');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r * .06, 0, TAU); c.fill();
  }
  function armGeom(r, rho) {
    const px = 1.42 * r, py = -.70 * r, L = 1.45 * r, d = Math.hypot(px, py);
    const cosD = clamp((d * d + L * L - rho * rho * r * r) / (2 * d * L), -1, 1);
    const phi = Math.atan2(-py, -px) + Math.acos(cosD);
    return { px, py, L, phi };
  }
  function arm(c, x, y, r, rho, a) {
    if (a <= 0) return;
    const { px, py, L, phi } = armGeom(r, rho);
    const lw = Math.max(1, r * .005);
    c.save(); c.globalAlpha = a; c.translate(x + px, y + py); c.rotate(phi);
    const armP = g => { g.beginPath(); g.moveTo(0, -r * .14); g.lineTo(L * .64, -r * .052); g.lineTo(L * .64, r * .052); g.lineTo(0, r * .14);
      g.arc(0, 0, r * .14, Math.PI / 2, Math.PI * 1.5); g.closePath(); };
    const beamP = g => { g.beginPath(); g.moveTo(L * .58, -r * .045); g.lineTo(L * .985, -r * .014); g.lineTo(L * .985, r * .014); g.lineTo(L * .58, r * .045); g.closePath(); };
    // drop shadow falls down-right in screen space, like the platter's: rotate that offset into the arm frame
    const sdx = r * .03, sdy = r * .045, cp = Math.cos(phi), sp = Math.sin(phi);
    c.save(); c.translate(sdx * cp + sdy * sp, -sdx * sp + sdy * cp); c.fillStyle = 'rgba(0,0,0,.3)'; armP(c); c.fill(); beamP(c); c.fill(); c.restore();
    // voice coil behind the pivot
    c.beginPath(); c.moveTo(-r * .08, -r * .1); c.lineTo(-r * .46, -r * .26); c.quadraticCurveTo(-r * .55, 0, -r * .46, r * .26); c.lineTo(-r * .08, r * .1); c.closePath();
    c.fillStyle = '#C9663F'; c.fill(); c.strokeStyle = 'rgba(20,16,14,.8)'; c.lineWidth = lw; c.stroke();
    c.beginPath(); c.moveTo(-r * .16, -r * .08); c.lineTo(-r * .38, -r * .17); c.quadraticCurveTo(-r * .43, 0, -r * .38, r * .17); c.lineTo(-r * .16, r * .08); c.closePath();
    c.fillStyle = '#3B2A22'; c.fill();
    let gr = c.createLinearGradient(0, -r * .14, 0, r * .14);
    gr.addColorStop(0, '#E9E7E1'); gr.addColorStop(.5, '#B4B5B1'); gr.addColorStop(1, '#7B7D7A');
    armP(c); c.fillStyle = gr; c.fill(); c.strokeStyle = 'rgba(20,22,22,.75)'; c.stroke();
    c.beginPath(); c.moveTo(L * .17, -r * .075); c.lineTo(L * .47, -r * .042); c.lineTo(L * .47, r * .042); c.lineTo(L * .17, r * .075); c.closePath();
    c.fillStyle = 'rgba(18,24,24,.9)'; c.fill();
    gr = c.createLinearGradient(0, -r * .045, 0, r * .045);
    gr.addColorStop(0, '#FBFAF6'); gr.addColorStop(.5, '#CFD0CC'); gr.addColorStop(1, '#8E908C');
    beamP(c); c.fillStyle = gr; c.fill(); c.strokeStyle = 'rgba(20,22,22,.75)'; c.stroke();
    c.strokeStyle = 'rgba(70,72,70,.6)'; c.beginPath(); c.moveTo(L * .6, 0); c.lineTo(L * .95, 0); c.stroke();
    c.fillStyle = '#1F2222'; c.fillRect(L * .955, -r * .02, r * .045, r * .04);
    c.beginPath(); c.arc(0, 0, r * .085, 0, TAU); c.fillStyle = '#D2D1CB'; c.fill(); c.strokeStyle = 'rgba(20,22,22,.75)'; c.stroke();
    c.beginPath(); c.arc(0, 0, r * .035, 0, TAU); c.fillStyle = '#3A3B39'; c.fill();
    c.restore();
  }
  function metalPlatter(c, x, y, r, sp, a = 1) {
    c.save(); c.globalAlpha = a;
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.arc(x + r * .02, y + r * .03, r * 1.01, 0, TAU); c.fill();
    c.drawImage(r < 140 ? platS : plat, x - r, y - r, r * 2, r * 2);
    clampHub(c, x, y, r, sp);
    c.restore();
  }

  // ---------- chart (card 3) ----------
  const CH0 = { x: 150, y: 760, w: 560, h: 560 };
  const curveF = u => (Math.exp(8.2 * u) - 1) / (Math.exp(8.2) - 1) * 1.2;
  function chart(c, t) {
    const a = smooth(14.8, 15.15, t) * (1 - smooth(17.95, 18.35, t)); if (a <= 0) return;
    c.save(); c.globalAlpha = a; c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(242,232,210,.55)'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(CH0.x, CH0.y - CH0.h); c.lineTo(CH0.x, CH0.y); c.lineTo(CH0.x + CH0.w + 120, CH0.y); c.stroke();
    c.fillStyle = 'rgba(242,232,210,.18)';
    for (let i = 1; i <= 6; i++) for (let j = 1; j <= 5; j++) { c.beginPath(); c.arc(CH0.x + i * CH0.w / 6, CH0.y - j * CH0.h / 5, 2.2, 0, TAU); c.fill(); }
    const pc = ease.inOut(clamp((t - 15.0) / 1.1));
    if (pc > 0) {
      const pts = [];
      const N = 90;
      for (let i = 0; i <= N; i++) {
        const u = pc * i / N, y = CH0.y - CH0.h * curveF(u);
        pts.push([CH0.x + u * CH0.w, Math.max(y, 80)]);
        if (y < 80) break;
      }
      c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
      c.strokeStyle = CORAL; c.lineWidth = 7; c.stroke();
      const hd = pts[pts.length - 1];
      c.fillStyle = '#FFE9DF'; c.beginPath(); c.arc(hd[0], hd[1], 7, 0, TAU); c.fill();
      c.fillStyle = CORAL; c.beginPath(); c.arc(CH0.x, CH0.y, 8, 0, TAU); c.fill();
    }
    // lifespan: a bar that tries to grow and stays a stub
    const kb = clamp((t - 15.9) / .5);
    if (kb > 0) {
      const bx = CH0.x + CH0.w + 52, bw = 46;
      const hgt = 4 + 9 * ease.outBack(kb) + .8 * Math.sin(t * 9) * (1 - smooth(16.6, 17.2, t)) * (kb >= 1 ? 1 : 0);
      c.fillStyle = MUST; c.fillRect(bx, CH0.y - hgt, bw, hgt);
      const kl = ease.out(clamp((t - 16.05) / .4));
      c.globalAlpha = a * kl;
      font(c, 34, '"Noto Serif SC"', 700); c.fillStyle = '#F6D58A'; c.textAlign = 'center';
      c.fillText(ch.meter.value + ' ' + ch.meter.unit, bx + bw / 2, CH0.y - hgt - 22 - (1 - kl) * 10);
      c.textAlign = 'left';
    }
    c.restore();
  }

  // ---------- the ad page ----------
  function travelPlatter(t) { // hero → timeline icon → bottom of the cabinet stack
    const k1 = ease.inOut(clamp((t - 3.0) / .7)), k2 = ease.inOut(clamp((t - 6.42) / .52));
    const sx = CAB.x + STK.x, sy = CAB.gy + STK.y0 + cabRise(t);
    let x = lerp(HERO.x, ICON.x, k1), y = lerp(HERO.y, ICON.y, k1), rx = lerp(HERO.rx, ICON.rx, k1), ry = lerp(HERO.ry, ICON.ry, k1);
    x = lerp(x, sx, k2); y = lerp(y, sy, k2); rx = lerp(rx, STK.rx, k2); ry = lerp(ry, STK.ry, k2);
    return { x, y, rx, ry, k1, k2 };
  }
  function cabRise(t) { return (1 - ease.outBack(clamp((t - 6.3) / .55))) * 760; }

  function drawAd(t) {
    const g = ag, s = sg;
    // --- hero decor (title moment)
    const da = 1 - smooth(2.85, 3.3, t);
    if (da > 0) {
      const kin = ease.outBack(clamp((t - .5) / .6));
      g.save(); g.globalAlpha = da; s.save(); s.globalAlpha = da;
      kidney(g, 1330, 430, 470 * kin, 330 * kin, -.06); g.fillStyle = TURQ; g.fill();
      kidney(s, 1330, 430, 470 * kin, 330 * kin, -.06);
      let gr = s.createLinearGradient(0, 120, 0, 760); gr.addColorStop(0, DK(0)); gr.addColorStop(.5, DK(.08)); gr.addColorStop(1, DK(.4)); s.fillStyle = gr; s.fill();
      star(g, 1676, 214, 112 * kin, 76 * kin, 12, t * .08); g.fillStyle = MUST; g.fill(); g.lineWidth = 3; g.strokeStyle = CHAR; g.stroke();
      star(s, 1676, 214, 112 * kin, 76 * kin, 12, t * .08);
      gr = s.createLinearGradient(1600, 140, 1760, 300); gr.addColorStop(0, DK(0)); gr.addColorStop(1, DK(.35)); s.fillStyle = gr; s.fill();
      g.fillStyle = CHAR;
      [[985, 248, 26, 0], [1700, 640, 20, 1.3], [1092, 690, 15, 2.1]].forEach(([x, y, r, ph]) => {
        const k = smooth(.8 + ph * .2, 1.2 + ph * .2, t) * (.75 + .25 * Math.sin(t * 5 + ph * 3));
        twinkle(g, x, y, r * k);
      });
      g.restore(); s.restore();
    }
    // --- timeline (card 0)
    const ta = smooth(3.05, 3.3, t) * (1 - smooth(6.25, 6.65, t));
    if (ta > 0) {
      const dx = -80 * ease.in(clamp((t - 6.25) / .4));
      g.save(); g.globalAlpha = ta; g.translate(dx, 0); s.save(); s.globalAlpha = ta; s.translate(dx, 0);
      const pr = ease.inOut(clamp((t - 3.1) / .6));
      g.fillStyle = CHAR; g.fillRect(250, LY - 2, 1420 * pr, 4);
      const P0 = [YX(1971), LY - 24], C = [(YX(1971) + YX(1956)) / 2, 420], P1 = [YX(1956), LY - 24];
      const pa = ease.inOut(clamp((t - 3.85) / .9));
      const hx = lerp(P0[0], P1[0], pa);
      for (let y = 1950; y <= 1980; y++) {
        const x = YX(y); if (x > 250 + 1420 * pr) break;
        const dec = y % 10 === 0;
        const lit = y >= 1956 && y < 1971 && pa > 0 ? clamp((x + 12 - hx) / 22) : 0;
        g.fillStyle = lit > 0 ? CORAL : CHAR;
        const hh = (dec ? 22 : 10) + lit * 12;
        g.fillRect(x - (dec ? 2 : 1.5), LY - hh, dec ? 4 : 3, hh);
      }
      if (pa > 0) {
        const B = u => [(1 - u) * (1 - u) * P0[0] + 2 * u * (1 - u) * C[0] + u * u * P1[0], (1 - u) * (1 - u) * P0[1] + 2 * u * (1 - u) * C[1] + u * u * P1[1]];
        g.strokeStyle = CORAL; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath(); for (let i = 0; i <= 40; i++) { const p = B(pa * i / 40); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
        const hp = B(pa), hq = B(Math.max(0, pa - .02)), an = Math.atan2(hp[1] - hq[1], hp[0] - hq[0]);
        g.fillStyle = CORAL; g.beginPath(); g.moveTo(hp[0] + Math.cos(an) * 22, hp[1] + Math.sin(an) * 22);
        g.lineTo(hp[0] + Math.cos(an + 2.4) * 18, hp[1] + Math.sin(an + 2.4) * 18); g.lineTo(hp[0] + Math.cos(an - 2.4) * 18, hp[1] + Math.sin(an - 2.4) * 18); g.fill();
      }
      // 1971 + its floppy
      const k71 = clamp((t - 3.3) / .4);
      floppy8(g, s, YX(1971), ICON.y - 70 * (1 - ease.outBack(k71)), 150, -.06, smooth(0, .4, k71));
      if (k71 > 0) {
        const kk = ease.out(k71);
        font(g, 196, DISPLAY, 400); g.textAlign = 'center';
        font(s, 196, DISPLAY, 400); s.textAlign = 'center';
        s.globalAlpha = ta * kk; s.fillStyle = DK(.7); s.fillText('1971', YX(1971) + 10, 474 + (1 - kk) * 30);
        g.globalAlpha = ta * kk; g.fillStyle = TURQ; g.fillText('1971', YX(1971), 464 + (1 - kk) * 30);
        g.globalAlpha = ta; s.globalAlpha = ta;
      }
      // 1956 stamp + burst
      const k56 = clamp((t - 4.75) / .32);
      if (k56 > 0) {
        const kb = ease.outBack(k56), sc = lerp(1.5, 1, ease.out(k56));
        const bx = YX(1956), by = ICON.y - 4;
        star(s, bx + 10, by + 12, 146 * kb, 112 * kb, 18, .1 + t * .05); s.fillStyle = DK(.38); s.fill();
        star(g, bx, by, 146 * kb, 112 * kb, 18, .1 + t * .05); g.fillStyle = MUST; g.fill(); g.lineWidth = 3; g.strokeStyle = CHAR; g.stroke();
        const al = ta * smooth(0, .35, k56);
        font(g, 196, DISPLAY, 400); g.textAlign = 'center'; font(s, 196, DISPLAY, 400); s.textAlign = 'center';
        s.save(); s.translate(bx, 400); s.scale(sc, sc); s.globalAlpha = al; s.fillStyle = DK(.7); s.fillText('1956', 10, 74); s.restore();
        g.save(); g.translate(bx, 400); g.scale(sc, sc); g.globalAlpha = al; g.fillStyle = CORAL; g.fillText('1956', 0, 64); g.restore();
      }
      g.restore(); s.restore();
    }
    // --- travelling platter: hero → 1956 icon → into the cabinet
    const tp = travelPlatter(t);
    if (t < 6.95) {
      const spd = (1 - tp.k1 * .6) * (1 - tp.k2) * smooth(.7, 1.1, t);
      platterAd(g, s, tp.x, tp.y, tp.rx, tp.ry, { rot: t * 1.6, speed: spd, speedT: t, shadow: tp.k2 < .5 });
    }
    // --- cabinet + forklift (card 1)
    if (t > 6.3 && t < 10.6) {
      const out = ease.inOut(clamp((t - 9.88) / .6)), ox = out * 1750, oy = cabRise(t);
      const lift = 44 * ease.inOut(clamp((t - 8.05) / .7));
      const fx = lerp(-300, CAB.x - 256, ease.out(clamp((t - 7.08) / .85))) + ox;
      // floor shadows
      s.save(); s.translate(CAB.x + ox, CAB.gy + 2 + oy); s.scale(1, .06);
      let gr = s.createRadialGradient(0, 0, 60, 0, 0, 300); gr.addColorStop(0, DK(.6 - lift / 150)); gr.addColorStop(1, DK(0));
      s.fillStyle = gr; s.beginPath(); s.arc(0, 0, 300, 0, TAU); s.fill(); s.restore();
      if (fx > -420) {
        s.save(); s.translate(fx - 170, CAB.gy + 2); s.scale(1, .07);
        gr = s.createRadialGradient(0, 0, 40, 0, 0, 230); gr.addColorStop(0, DK(.55)); gr.addColorStop(1, DK(0));
        s.fillStyle = gr; s.beginPath(); s.arc(0, 0, 230, 0, TAU); s.fill(); s.restore();
        forklift(g, s, fx, CAB.gy, lift);
      }
      const n = t < 6.95 ? 0 : 1 + Math.floor(49 * ease.out(clamp((t - 6.95) / .6)));
      cabinet(g, s, t, CAB.x + ox, CAB.gy - lift + oy, n, t > 9.9 ? 30 : -1);
      if (lift > 1 && lift < 43) { // strain marks under the rising pallet
        g.save(); g.strokeStyle = CHAR; g.lineWidth = 3; g.lineCap = 'round';
        for (let k = 0; k < 3; k++) { const yy = CAB.gy + 8 - k * 12; g.beginPath(); g.moveTo(CAB.x - 120 + k * 90 + ox, yy); g.lineTo(CAB.x - 80 + k * 90 + ox, yy); g.stroke(); }
        g.restore();
      }
      // one platter leaves the stack and turns to face us
      if (t > 9.9) {
        const k = ease.inOut(clamp((t - 9.9) / .7));
        const sx = CAB.x + ox + STK.x, sy = CAB.gy - lift + STK.y0 - 30 * STK.dy;
        platterAd(g, s, lerp(sx, BIG.x, k), lerp(sy, BIG.y, k), lerp(STK.rx, BIG.r, k), lerp(STK.ry, BIG.r, k), { rot: .3, shadow: k > .3 });
      }
    }
    // --- scale comparison (card 2), drawn through the push-in camera
    if (t >= 10.6) {
      const cm = cam(t);
      g.save(); g.setTransform(...cm.m); s.save(); s.setTransform(...cm.m);
      platterAd(g, s, BIG.x, BIG.y, BIG.r, BIG.r, { rot: .3 + (t - 10.6) * .35 });
      const k5 = clamp((t - 10.62) / .38), p5 = 1 - ease.outBack(k5);
      drive525(g, s, D5.x, D5.yb - D5.h - 90 * p5, smooth(0, .35, k5));
      const p3 = drive35Pose(t);
      drive35Case(g, s, D3.x, D3.yb - D3.h + p3.dy, p3.a);
      const kt = clamp((t - 10.95) / .26);
      if (kt > 0) {
        const sc = lerp(1.5, 1, ease.out(kt));
        g.save(); g.globalAlpha *= smooth(0, .4, kt); g.translate(D5.x + D5.w / 2, D5.yb - D5.h - 34); g.scale(sc, sc);
        font(g, 78, DISPLAY, 400); g.textAlign = 'center'; g.fillStyle = CHAR; g.fillText('5 MB', 0, 0); g.restore();
      }
      const k40 = clamp((t - 12.1) / .24);
      if (k40 > 0) {
        const sc = lerp(1.25, 1, ease.out(k40));
        font(g, 100, DISPLAY, 400); const w100 = g.measureText('40 TB').width, fs = Math.min(250, 100 * 540 / w100), tw = w100 * fs / 100;
        const tx = D3.x + D3.w + 70 + tw / 2, ty = D3.yb - fs * .35;   // slam scales about the centre of the word
        s.save(); s.globalAlpha *= smooth(0, .4, k40); s.translate(tx, ty); s.scale(sc, sc); font(s, fs, DISPLAY, 400); s.textAlign = 'center'; s.fillStyle = DK(.45); s.fillText('40 TB', 9, fs * .35 + 9); s.restore();
        g.save(); g.globalAlpha *= smooth(0, .4, k40); g.translate(tx, ty); g.scale(sc, sc); font(g, fs, DISPLAY, 400); g.textAlign = 'center'; g.fillStyle = CORAL; g.fillText('40 TB', 0, fs * .35); g.restore();
      }
      g.restore(); s.restore();
    }
  }
  function drive35Pose(t) { const k = clamp((t - 11.72) / .36); return { dy: -80 * (1 - ease.outBack(k)), a: smooth(0, .35, k) }; }
  function cam(t) {
    const k = clamp((t - PU0) / 1.0), e = ease.inOut(k);
    const drift = Math.log(1.1) * ease.inOut(clamp((t - 12.3) / 1.6)); // slow lean toward the small drive, then the dive
    const sc = Math.exp(drift + (Math.log(PE.r / P35.r) - drift) * e), cx = lerp(P35.x, PE.x, e), cy = lerp(P35.y, PE.y, e);
    return { k, sc, cx, cy, m: [sc, 0, 0, sc, cx - sc * P35.x, cy - sc * P35.y] };
  }
  function headRho(t) { // seeks during card 3, then park on the ramp before the spin-down
    const keys = [[0, .6], [15.25, .42], [15.72, .8], [16.42, 1.08]];
    let r = keys[0][1];
    for (let i = 1; i < keys.length; i++) r = lerp(r, keys[i][1], ease.inOut(clamp((t - keys[i][0]) / .22)));
    return r;
  }
  function baseState(g) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.lineCap = 'butt'; g.lineJoin = 'miter'; g.lineWidth = 1; g.miterLimit = 10; g.setLineDash([]); g.lineDashOffset = 0;
    g.textAlign = 'start'; g.textBaseline = 'alphabetic'; g.font = '10px sans-serif'; g.filter = 'none';
    g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; g.shadowColor = 'rgba(0,0,0,0)';
    g.imageSmoothingEnabled = true; g.fillStyle = '#000'; g.strokeStyle = '#000';
  }
  // Text layout guards for the shared opener()/subs():
  // - subs() sets textAlign 'center' and revealText() then places each glyph at its left-edge advance, so every glyph
  //   is shifted left by half its own width ("5M B", "1956年，  IBM"). Hold the context at 'left' during the call.
  // - Chrome's shaping cache makes measureText(<whole line>) depend on what earlier frames shaped (a 0.4 px shift of
  //   a subtitle line between renders). Glyphs are advanced one by one anyway, so measure a line as the sum of its
  //   single-glyph advances: identical layout, and a pure function of the string.
  const MT = CanvasRenderingContext2D.prototype.measureText;
  function stableText(ctx, left, fn) {
    if (left) { ctx.textAlign = 'left'; Object.defineProperty(ctx, 'textAlign', { configurable: true, get: () => 'left', set: () => {} }); }
    Object.defineProperty(ctx, 'measureText', { configurable: true, value: s => {
      const cs = [...s]; if (cs.length < 2) return MT.call(ctx, s);
      let w = 0; for (const c of cs) w += MT.call(ctx, c).width; return { width: w };
    } });
    try { fn(); } finally { delete ctx.measureText; if (left) delete ctx.textAlign; }
  }
  function mixHex(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = [16, 8, 0].map(sh => Math.round(lerp(pa >> sh & 255, pb >> sh & 255, k)));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  TRANS.disk_crtoff = (ctx, A, B, p) => {
    ctx.fillStyle = '#060707'; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    if (p < .3) { // picture collapses vertically and over-brightens
      const k = ease.in(p / .3), sy = Math.max(.003, 1 - k), sx = 1 - .04 * k;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.drawImage(A, -W / 2, -H / 2);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * .9; ctx.fillStyle = '#d6e8ff'; ctx.fillRect(-W / 2, -H / 2, W, H);
      ctx.restore();
    }
    if (p > .24 && p < .6) { // bright line shrinks to a dot, dot dies
      const k = ease.in(clamp((p - .3) / .15)), len = lerp(W * .96, 2, k);
      const al = smooth(.24, .3, p) * (1 - smooth(.47, .6, p)), th = lerp(5, 3, k);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      let gr = ctx.createLinearGradient(0, cy - 60, 0, cy + 60);
      gr.addColorStop(0, 'rgba(150,200,255,0)'); gr.addColorStop(.5, `rgba(150,200,255,${.35 * al})`); gr.addColorStop(1, 'rgba(150,200,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(cx - len / 2 - 40, cy - 60, len + 80, 120);
      ctx.fillStyle = `rgba(245,250,255,${al})`; ctx.fillRect(cx - len / 2, cy - th / 2, len, th);
      const dr = lerp(10, 70, k) * al;
      gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, dr));
      gr.addColorStop(0, `rgba(255,255,255,${al})`); gr.addColorStop(1, 'rgba(160,210,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(cx - dr, cy - dr, dr * 2, dr * 2);
      ctx.restore();
    }
    if (p > .6) { // the page opens out of the glint
      const k = ease.inOut(clamp((p - .6) / .4)), r = k * 2300;
      ctx.save(); ctx.beginPath(); ctx.arc(GLINT[0], GLINT[1], r, 0, TAU); ctx.clip(); ctx.drawImage(B, 0, 0);
      const gr = ctx.createRadialGradient(GLINT[0], GLINT[1], r * .55, GLINT[0], GLINT[1], r + 1);
      gr.addColorStop(0, 'rgba(6,7,7,0)'); gr.addColorStop(1, `rgba(6,7,7,${.6 * (1 - k)})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const gk = smooth(.5, .62, p) * (1 - smooth(.66, .85, p)); // the dying dot becomes the platter's glint
    sparkle(ctx, lerp(cx, GLINT[0], smooth(.5, .62, p)), lerp(cy, GLINT[1], smooth(.5, .62, p)), 170 * gk, .2 + p, gk);
  };

  scene({
    id: 'disk', n: ch.n, dur: ch.dur,
    trans: { type: 'disk_crtoff', d: 1.2 },
    cues: [
      { t: .08, sfx: 'click', v: .5 }, { t: .72, sfx: 'chime', v: .45 }, { t: .85, sfx: 'spin' },
      { t: 3.3, sfx: 'blip', v: .6 }, { t: 3.85, sfx: 'whoosh', v: .45 }, { t: 4.75, sfx: 'stamp' },
      { t: 6.4, sfx: 'whoosh', v: .4 }, { t: 7.88, sfx: 'click', v: .6 },
      { t: 8.05, sfx: 'press' }, { t: 9.18, sfx: 'click', v: .6 }, { t: 9.64, sfx: 'click', v: .6 },
      { t: 9.95, sfx: 'whoosh', v: .45 }, { t: 10.1, sfx: 'disk', v: .6 }, { t: 10.97, sfx: 'stamp', v: .6 },
      { t: 12.12, sfx: 'impact' }, { t: 13.84, sfx: 'whoosh' }, { t: 15.0, sfx: 'whoosh', v: .6 },
      { t: 15.42, sfx: 'click', v: .45 }, { t: 15.95, sfx: 'blip', v: .5 }, { t: 16.6, sfx: 'click', v: .7 },
      { t: 16.65, sfx: 'spin', v: .5 },
    ],
    init() {
      paper = GL.bake(PAPER, W, H);
      studio = GL.bake(STUDIO, W, H);
      plat = GL.bake(PLATTER, 1024, 1024, { A1: 2.25, A2: .36 });
      platS = makeCanvas(256, 256);
      const pg = platS.getContext('2d'); pg.imageSmoothingQuality = 'high'; pg.drawImage(plat, 0, 0, 256, 256);
      art = makeCanvas(); ag = art.getContext('2d');
      shd = makeCanvas(); sg = shd.getContext('2d');
    },
    draw(ctx, t) {
      const cm = cam(t), stA = ease.in(clamp((cm.k - .38) / .5));
      if (stA < 1) {
        // the offscreen contexts persist between frames: start each frame from a known state and scope it,
        // so nothing set in an earlier frame (lineCap, textAlign…) can leak into this one (ctx.reset() costs ~90 ms)
        baseState(ag); baseState(sg); ag.save(); sg.save();
        ag.drawImage(paper, 0, 0);
        sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H); sg.globalCompositeOperation = 'lighter';
        drawAd(t);
        ag.restore(); sg.restore();
        ctx.drawImage(GL.run(HALF, W, H, { SRC: art, SH: shd }), 0, 0);
      }
      if (stA >= 1) ctx.drawImage(studio, 0, 0);
      else if (stA > 0) { // the studio opens as a hard iris from the platter centre
        ctx.save(); ctx.beginPath(); ctx.arc(cm.cx, cm.cy, stA * 2300, 0, TAU); ctx.clip(); ctx.drawImage(studio, 0, 0); ctx.restore();
      }
      // metal: the modern drive's platter and arm
      if (t >= 11.72) {
        let x, y, r, a = 1;
        if (t < PU0 + 1) { const p = drive35Pose(t); x = cm.cx; y = cm.cy + p.dy * cm.sc; r = P35.r * cm.sc; a = p.a; }
        else { const gk = ease.inOut(clamp((t - 18.0) / .75)); x = lerp(PE.x, 960, gk); y = lerp(PE.y, 470, gk); r = PE.r; }
        if (t > 14.7) chart(ctx, t);
        metalPlatter(ctx, x, y, r, spin(t), a);
        arm(ctx, x, y, r, headRho(t), a);
      }
      // the glint the page opens from
      const gl = smooth(.6, .78, t) * (1 - smooth(.95, 1.7, t));
      sparkle(ctx, GLINT[0], GLINT[1], 150 * gl, .2 + t * .4, gl);
      if (t < 3.4) stableText(ctx, false, () => opener(ctx, t, ch, {
        ink: CHAR, sub: '#5E4837', accent: CORAL, x: 200, y: 470, align: 'left', inAt: .95, outAt: 2.75,
        title: { family: '"Noto Serif SC"', size: 150, weight: 900, sp: 26 },
        small: { family: '"Noto Serif SC"', size: 30, weight: 600 },
        num: { family: `${DISPLAY}, "Noto Serif SC"`, size: 72, weight: 400 },
      }));
      for (let i = 0; i < 4; i++) { // cards 0–2 sit on the paper, card 3 on the studio
        const k = i < 3 ? 0 : 1;
        stableText(ctx, true, () => subs(ctx, t, { cards: [ch.cards[i]], segs: [ch.segs[i]], notes: {} }, {
          ink: mixHex(CHAR, '#F3E9D3', k), body: { family: '"Noto Serif SC"', size: 52, weight: 700 },
          shadow: k < .5 ? 'rgba(244,234,213,.9)' : 'rgba(6,20,20,.85)',
        }));
      }
      grain(ctx, t, .045);
    },
  });
})();
