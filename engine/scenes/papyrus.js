// 03 莎草纸 — Egyptian papyrus. An ochre plaster wall framed by block-border friezes and the winged sun.
// Title over a papyrus marsh. Card 0 makes a sheet: a stem is split into strips, one layer laid vertically,
// one horizontally, beaten with a mallet, dried by the sun. Card 1: more sheets are pasted on into a long roll,
// the roll winds up, a damp stain creeps in from a corner, the dry sun stops it. Card 2: the roll opens on a fresh
// stretch and the Diary of Merer is written right-to-left in columns, with Khufu's cartouche, then a Nile boat
// carries a limestone block toward the pyramid.
'use strict';
(() => {
  const ch = CH('papyrus');
  const BLUE = '#2b62a6', RED = '#b4432b', YEL = '#d6a03c', GRN = '#3f8a66', INK = '#1d1510', GOLD = '#d9a536';
  const SW = 1200, SH = 600, SEP = 1170;            // sheet size in world px; sheets overlap 30 px at the paste join
  const NV = 18, NH = 9, PW = SW / NV, PH = SH / NH; // strips per layer
  const L = SEP * 2 + SW;                            // length of the pasted roll
  const G = s => String.fromCodePoint(s);
  const GY = 830;                                    // ground line of the marsh: the top rule of the lower frieze
  const HG = '"Noto Sans Egyptian Hieroglyphs"';

  // ---------- baked textures ----------
  const WALL = `
  void main(){ vec2 px=uv*R;
    float m=fbm(px*.0022), f=fbm3(px*vec2(.003,.03)+5.), s=h21(floor(px*.5));
    vec3 col=vec3(.80,.62,.37)*(.88+.2*m)*(.97+.05*f)*(.975+.05*s);
    vec2 v=vor(px*.018); col*=1.-.07*smoothstep(.12,.0,v.x)*step(.82,h21(floor(px*.018)+.5));
    col=mix(col,col*vec3(1.02,.96,.88),smoothstep(.45,.8,fbm3(px*.006+11.))*.6);
    vec2 q=uv-.5; col*=1.-dot(q*vec2(1.,1.3),q*vec2(1.,1.3))*.55;
    O=vec4(col,1.); }`;
  // a pressed sheet: two cross-laid layers fused, faint strip seams, deckled edges (alpha)
  const SHEET = `uniform float SEED;
  void main(){ vec2 px=uv*R; vec2 sp=px+SEED*173.;
    float wy=(fbm3(sp*.004)-.5)*.35, wx=(fbm3(sp*.004+3.)-.5)*.35;
    float fy=px.y/${PH.toFixed(3)}+wy, yi=floor(fy), fry=fract(fy);
    float fx=px.x/${PW.toFixed(3)}+wx, xi=floor(fx), frx=fract(fx);
    float fibH=vn(vec2(sp.x*.014+yi*3., sp.y*.85+yi*13.))*.55+vn(vec2(sp.x*.0035, sp.y*.22+yi*5.))*.45;
    float fibV=vn(vec2(sp.x*.85+xi*11., sp.y*.012));
    float seamH=1.-smoothstep(.0,.07,min(fry,1.-fry));
    float seamV=1.-smoothstep(.0,.045,min(frx,1.-frx));
    vec3 col=vec3(.90,.81,.60)*(.95+.1*(h21(vec2(yi,SEED))-.5))*(.87+.17*fibH)*(.965+.06*fibV);
    col-=seamH*.055+seamV*.03;
    col*=1.-.09*smoothstep(.55,.85,fbm(sp*.002+9.));
    col=mix(col,col*vec3(.94,.87,.74),smoothstep(.5,.9,fbm(sp*.005+2.))*.45);
    float e=min(min(px.x,R.x-px.x),min(px.y,R.y-px.y));
    float a=smoothstep(0.,1.6,e-2.5-vn(sp*.12)*5.-vn(sp*.6)*1.5);
    col*=mix(.84,1.,smoothstep(0.,16.,e));
    O=vec4(col,a); }`;
  // loose wet strips of pith, one layer; DIR 0 = vertical strips, 1 = horizontal
  const STRIPS = `uniform float DIR; uniform float N;
  void main(){ vec2 px=uv*R; vec2 q=DIR<.5?px:px.yx; float len=DIR<.5?R.x:R.y;
    float w=len/N, i=floor(q.x/w), u=fract(q.x/w);
    float jag=(vn(vec2(i*7.,q.y*.04))-.5)*.07;
    float a=smoothstep(.0,.03,u-.02+jag)*smoothstep(.0,.03,.98-u+jag*.8);
    float fib=vn(vec2(q.x*.75,q.y*.01+i*9.))*.6+vn(vec2(q.x*.22,q.y*.004+i))*.4;
    vec3 col=vec3(.84,.80,.58)*(.85+.22*fib);
    col=mix(col,vec3(.62,.70,.44),.32*smoothstep(.22,.0,min(u,1.-u)));
    col*=.93+.09*h21(vec2(i,DIR+3.));
    O=vec4(col,a*.97); }`;
  // damp stain spreading from a corner (bottom-left of the drawn rect). P spread, D dried
  const STAIN = `uniform float P; uniform float D;
  void main(){ vec2 px=uv*R;
    float n=fbm3(px*vec2(.011,.013))*.8+vn(px*.06)*.2;
    float d=length(px/R*vec2(1.,.75))+(n-.5)*.34;
    float e=P-d;
    float inside=smoothstep(-.01,.03,e);
    float tide=exp(-abs(e+.004)*95.);
    float core=smoothstep(.0,.3,e);
    vec3 wet=vec3(.74,.70,.56), dry=vec3(.94,.90,.80);
    vec3 m=mix(vec3(1.),mix(wet,dry,D),inside*(.5+.5*core));
    m=mix(m,m*vec3(.74,.62,.46),tide*(.7+.2*D)*smoothstep(-.03,.01,e));
    vec2 v=vor(px*.07); float dot_=smoothstep(.16,.08,v.x)*step(.72,h21(floor(px*.07)+7.));
    m*=1.-dot_*inside*smoothstep(.04,.25,e)*(.4-.2*D);
    O=vec4(m,clamp(max(inside,tide*smoothstep(-.03,.01,e)),0.,1.)); }`;

  // incoming transition: fire rises from the bottom of the clay frame, the burnt-through holes open onto papyrus
  const BURN = `uniform sampler2D A; uniform sampler2D B; uniform float P;
  void main(){ vec2 p=uv;
    float n=fbm3(p*vec2(3.2,2.4)+vec2(1.7,-P*.8))*.7+vn(p*vec2(26.,18.)+3.)*.23+vn(p*vec2(58.,41.)+9.)*.07;
    float x=p.y+(n-.5)*.5-(P*1.5-.16);
    vec4 a=texture(A,p), b=texture(B,p);
    float hole=smoothstep(.004,-.004,x);
    float rim=exp(-abs(x)*55.)*(1.-hole);
    float charA=smoothstep(.13,.0,x)*(1.-hole);
    vec3 col=mix(a.rgb*(1.-charA*.88), b.rgb*(1.-.35*exp(x*40.)*hole), hole);
    float fl=vn(vec2(p.x*14.,(p.y-T*1.6)*3.))*.6+vn(vec2(p.x*31.,(p.y-T*2.4)*7.))*.4;
    float flame=smoothstep(.0,.03,x)*smoothstep(.2,.0,x-fl*.06)*smoothstep(.35,.85,fl+(.16-x)*2.2);
    col+=rim*vec3(1.7,.66,.17)*1.3+flame*vec3(1.4,.55,.12)*(1.-smoothstep(.0,.2,x))*1.2;
    vec2 gs=vec2(p.x*110.,(p.y-T*.9)*62.), fs=fract(gs)-.5;
    float sp=step(.99,h21(floor(gs)))*smoothstep(.22,.06,length(fs*vec2(1.,.6)))*smoothstep(.4,.05,x)*step(.0,x);
    col+=sp*vec3(1.5,.8,.3);
    O=vec4(col,1.); }`;
  TRANS.papyrus_burn = (ctx, A, B, p, o, T) => { ctx.drawImage(GL.run(BURN, W, H, { A, B, P: p, T }), 0, 0); };

  let wall, sheets, vlay, hlay, maskC, pressC, plantsL, plantsR, colGlyphs, header;

  // ---------- camera (world: sheet 0 spans 0..1200 x 0..600) ----------
  const CY = 505;
  const KEYS = [[0, 600, 300, 1], [6.55, 600, 300, 1], [7.55, 1545, 300, .55], [7.95, 1545, 300, .55],
    [9.0, 655, 300, .9], [10.85, 655, 300, .9], [11.85, 1715, 300, 1], [17.5, 1740, 300, 1.025]];
  function camKeys(t) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const [t0, x0, y0, s0] = KEYS[i], [t1, x1, y1, s1] = KEYS[i + 1];
      if (t <= t1) {
        const e = ease.inOut(clamp((t - t0) / (t1 - t0)));
        return { x: lerp(x0, x1, e), y: lerp(y0, y1, e), s: s0 * Math.pow(s1 / s0, e) };
      }
    }
    const k = KEYS[KEYS.length - 1]; return { x: k[1], y: k[2], s: k[3] };
  }
  // while the long strip winds up (7.55–9.0 s) the camera keeps the shrinking strip centred (soft minimum, no kink)
  function cam(t) {
    const c = camKeys(t);
    if (t > 7.55 && t < 9.0) {
      const rx = rollX(t), f = (rx + 2 * rollR(rx)) / 2 + 24, k = 60;
      c.x = -k * Math.log(Math.exp(-1545 / k) + Math.exp(-f / k));
    }
    return c;
  }
  const IMP = [[5.1, 330, 330], [5.4, 720, 250], [5.7, 960, 400]]; // mallet strikes: time, world x, y
  function shake(t) {
    let x = 0, y = 0;
    for (const [ti] of IMP) { const u = t - ti; if (u >= 0 && u < .18) { const k = Math.exp(-u * 26) * Math.sin(u * 90); x += k * 3; y += k * 5; } }
    return [x, y];
  }
  function rollX(t) {
    if (t < 7.8) return L;
    if (t < 10.9) return lerp(L, 1150, ease.inOut(clamp((t - 7.8) / 1.0)));
    return lerp(1150, 2290, ease.inOut(clamp((t - 10.9) / .95)));
  }
  const rollR = rx => Math.sqrt(144 + (L - rx) * 1.25);

  // ---------- frame ornaments ----------
  function frieze(ctx, y, h, p) { // block border grows from the centre outward
    const seq = [BLUE, RED, GRN, YEL, RED, BLUE, YEL, GRN], bw = 34, half = W / 2 * ease.out(p);
    if (half <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - half, y - 8, half * 2, h + 16); ctx.clip();
    ctx.fillStyle = INK; ctx.fillRect(0, y, W, h);
    for (let i = 0, x = W / 2 - 17 - bw * 28; x < W; i++, x += bw) { ctx.fillStyle = seq[(i % 8 + 8) % 8]; ctx.fillRect(x + 3, y + 4, bw - 6, h - 8); }
    ctx.fillStyle = YEL; ctx.fillRect(0, y - 6, W, 4); ctx.fillRect(0, y + h + 2, W, 4);
    ctx.restore();
  }
  function wingedSun(ctx, cx, cy, s, t, glow) {
    const open = ease.out(clamp((t - .12) / .9)), disc = ease.outBack(clamp((t - .05) / .6));
    if (glow > 0) {
      const g = ctx.createRadialGradient(cx, cy, 30, cx, cy, 520);
      g.addColorStop(0, `rgba(255,226,150,${.55 * glow})`); g.addColorStop(.35, `rgba(255,210,120,${.22 * glow})`); g.addColorStop(1, 'rgba(255,210,120,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 600, 0, 1200, cy + 560);
    }
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      ctx.save(); ctx.scale(Math.max(.001, open), 1);
      for (let row = 0; row < 3; row++) {
        const n = 14 - row * 3;
        for (let i = 0; i < n; i++) {
          const x0 = side * (70 + i * 26), len = 60 - row * 14 - i * 1.2;
          const y0 = -18 + row * 20 - Math.pow(i / n, 2) * 24;
          ctx.fillStyle = [BLUE, GRN, RED][row];
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + side * 22, y0 + 4 - Math.pow(i / n, 2) * 6);
          ctx.lineTo(x0 + side * 22, y0 + len * .42); ctx.lineTo(x0, y0 + len * .42); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      ctx.restore();
      // uraeus: a rearing cobra hanging from each side of the disc
      if (disc > .3) {
        ctx.save(); ctx.globalAlpha = smooth(.3, 1, disc); ctx.translate(side * 50, 30); ctx.scale(side, 1);
        ctx.fillStyle = YEL; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-6, -20); ctx.bezierCurveTo(14, -4, -2, 18, 10, 34); ctx.lineTo(18, 33);
        ctx.bezierCurveTo(8, 18, 24, -2, 4, -24); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(14, 40, 9, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.save(); ctx.scale(disc, disc);
    const gr = ctx.createRadialGradient(-12, -14, 4, 0, 0, 62);
    gr.addColorStop(0, '#ffd877'); gr.addColorStop(.7, GOLD); gr.addColorStop(1, '#9c6a1c');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
    if (glow > 0) { ctx.fillStyle = `rgba(255,190,90,${.45 * glow})`; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.restore();
  }

  // ---------- papyrus marsh (title moment) ----------
  function makeClump(seed, bx, dir) {
    const r = mulberry(seed), stems = [];
    for (let i = 0; i < 11; i++) {
      const f = (i - 5) / 5 + (r() - .5) * .12;
      const h = 360 + (1 - Math.abs(f)) * 190 + r() * 70;
      const tx = bx + f * 150 + dir * 10, ty = GY - h;
      stems.push({ bx: bx + f * 26, tx, ty, cx: bx + f * 40, cy: GY - h * .55, bud: r() < .3, d: r() * .35 + Math.abs(f) * .25, s: .82 + r() * .3 });
    }
    stems.sort((a, b) => b.ty - a.ty);
    return stems;
  }
  function umbel(ctx, k, bud) {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    if (bud) {
      ctx.fillStyle = GRN; ctx.beginPath(); ctx.moveTo(0, 4); ctx.bezierCurveTo(-13 * k, -12, -9 * k, -40, 0, -54 * k);
      ctx.bezierCurveTo(9 * k, -40, 13 * k, -12, 0, 4); ctx.fill(); ctx.stroke(); return;
    }
    const w = 46 * k, h = 60;
    ctx.fillStyle = GRN; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-w, -h); ctx.quadraticCurveTo(0, -h - 24 * k, w, -h); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#86b07a'; ctx.beginPath(); ctx.moveTo(-w, -h); ctx.quadraticCurveTo(0, -h - 24 * k, w, -h); ctx.quadraticCurveTo(0, -h - 8 * k, -w, -h); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(INK, .7);
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(i / 3 * w * .82, -h + 2 - (1 - Math.abs(i / 3)) * 8 * k); ctx.stroke(); }
  }
  function clump(ctx, stems, t, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
    for (const s of stems) {
      const g = ease.out(clamp((t - .12 - s.d) / .95));
      if (g <= 0) continue;
      const P = u => [(1 - u) * (1 - u) * s.bx + 2 * u * (1 - u) * s.cx + u * u * s.tx, (1 - u) * (1 - u) * GY + 2 * u * (1 - u) * s.cy + u * u * s.ty];
      ctx.beginPath(); for (let k = 0; k <= 14; k++) { const [x, y] = P(g * k / 14); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#6f9a58'; ctx.lineWidth = 3.6; ctx.stroke();
      const [x1, y1] = P(g), [x0, y0] = P(Math.max(0, g - .02));
      const ang = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
      const k = ease.outBack(clamp((t - .62 - s.d) / .55));
      if (k > 0) { ctx.save(); ctx.translate(x1, y1); ctx.rotate(ang); ctx.scale(s.s * k, s.s * k); umbel(ctx, 1, s.bud); ctx.restore(); }
    }
    // sheath leaves at the base
    const b = stems[0].bx, gb = ease.out(clamp((t - .1) / .5));
    ctx.fillStyle = '#2f6a4c'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      const bx = (stems[5].bx + stems[4].bx) / 2 + i * 15;
      ctx.beginPath(); ctx.moveTo(bx - 10, GY); ctx.quadraticCurveTo(bx + i * 6, GY - 70 * gb, bx + i * 9, GY - (64 - Math.abs(i) * 10) * gb);
      ctx.quadraticCurveTo(bx + 4, GY - 22, bx + 10, GY); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- card 0: making a sheet ----------
  function splitStem(ctx, t) {
    const a = 1 - smooth(3.7, 4.2, t);
    if (t < 2.4 || a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    const slide = ease.out(clamp((t - 2.42) / .5));
    const x0 = 40 - (1 - slide) * 1600, x1 = x0 + 1120, y = 560, th = 36;
    const kx = lerp(x0 - 20, x1 + 60, ease.inOut(clamp((t - 2.92) / .62)));
    const spr = x => clamp((kx - x) / 260) * 9;
    // shadow
    ctx.fillStyle = 'rgba(60,35,12,.22)'; ctx.fillRect(x0 + 6, y - th / 2 + 9, x1 - x0, th);
    // split part: rind slivers peel away, three pith strips spread
    const xe = clamp(kx, x0, x1);
    if (xe > x0) {
      const strip = (dy, hh, col, k) => {
        ctx.beginPath();
        for (let x = x0; x <= xe; x += 40) ctx.lineTo(x, y + dy(Math.min(x, xe)) - hh / 2);
        ctx.lineTo(xe, y + dy(xe) - hh / 2);
        ctx.lineTo(xe, y + dy(xe) + hh / 2);
        for (let x = Math.floor((xe - x0) / 40) * 40 + x0; x >= x0; x -= 40) ctx.lineTo(x, y + dy(x) + hh / 2);
        ctx.closePath(); ctx.fillStyle = col; ctx.globalAlpha = a * k; ctx.fill();
        ctx.strokeStyle = rgba(INK, .55); ctx.lineWidth = 1.2; ctx.stroke();
      };
      strip(x => -th / 2 - spr(x) * 3.2, 5, '#3d6a33', .9);
      strip(x => th / 2 + spr(x) * 3.2, 5, '#355f2c', .9);
      for (let j = -1; j <= 1; j++) strip(x => j * (th / 3 + spr(x) * 1.4), th / 3 - 1.5, ['#e7dcb4', '#efe5c2', '#e2d6ab'][j + 1], 1);
      ctx.globalAlpha = a;
    }
    // intact stem ahead of the knife
    if (xe < x1) {
      const g = ctx.createLinearGradient(0, y - th / 2, 0, y + th / 2);
      g.addColorStop(0, '#8fbf6a'); g.addColorStop(.42, '#5f9a48'); g.addColorStop(.5, '#4c8540'); g.addColorStop(1, '#2f5f2c');
      ctx.fillStyle = g; ctx.fillRect(xe, y - th / 2, x1 - xe, th);
      ctx.strokeStyle = rgba(INK, .8); ctx.lineWidth = 2; ctx.strokeRect(xe, y - th / 2, x1 - xe, th);
      ctx.strokeStyle = 'rgba(40,70,30,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xe, y + 2); ctx.lineTo(x1, y + 2); ctx.stroke();
      // pale pith at the cut end
      ctx.fillStyle = '#efe6c6'; ctx.fillRect(x1 - 5, y - th / 2 + 4, 5, th - 8);
    }
    // bronze knife riding along the stem
    if (t > 2.85 && t < 3.75) {
      const ka = smooth(2.85, 2.95, t) * (1 - smooth(3.55, 3.75, t));
      ctx.save(); ctx.globalAlpha = a * ka; ctx.translate(kx, y); ctx.rotate(-.75);
      ctx.fillStyle = 'rgba(60,35,12,.25)'; ctx.fillRect(14, 10, 150, 16);
      const bg = ctx.createLinearGradient(0, -14, 0, 14); bg.addColorStop(0, '#e8b36a'); bg.addColorStop(.5, '#b8783a'); bg.addColorStop(1, '#7a4a20');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(30, -18, 84, -10); ctx.lineTo(84, 10); ctx.quadraticCurveTo(30, 12, -6, 0); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#6b4424'; ctx.fillRect(84, -9, 76, 18); ctx.strokeRect(84, -9, 76, 18);
      ctx.restore();
    }
    ctx.restore();
  }
  const vk = (t, i) => ease.out(clamp((t - 3.38 - i * .042) / .3));
  const hk = (t, j) => ease.out(clamp((t - 4.22 - j * .062) / .32));
  function strips(ctx, t) {
    // vertical layer, laid left to right
    for (let i = 0; i < NV; i++) {
      const k = vk(t, i); if (k <= 0) continue;
      const dy = -46 * (1 - k);
      ctx.globalAlpha = k * .5; ctx.fillStyle = 'rgba(60,35,12,.4)'; ctx.fillRect(i * PW + 3 + 10 * (1 - k), 6 + dy * .3, PW - 4, SH);
      ctx.globalAlpha = k; ctx.drawImage(vlay, i * PW, 0, PW, SH, i * PW, dy, PW, SH);
    }
    // horizontal layer on top, laid top to bottom
    for (let j = 0; j < NH; j++) {
      const k = hk(t, j); if (k <= 0) continue;
      const dx = -70 * (1 - k);
      ctx.globalAlpha = k * .5; ctx.fillStyle = 'rgba(60,35,12,.35)'; ctx.fillRect(dx + 6, j * PH + 5, SW, PH - 3);
      ctx.globalAlpha = k * .93; ctx.drawImage(hlay, 0, j * PH, SW, PH, dx, j * PH, SW, PH);
    }
    ctx.globalAlpha = 1;
  }
  // pressed sheet: sheet 0 tinted wet (drying front sweeps down from the sun), revealed where the mallet has struck
  function pressedLayer(ctx, t) {
    const p = pressC.getContext('2d');
    p.globalCompositeOperation = 'copy'; p.drawImage(sheets[0], 0, 0);
    const front = lerp(-140, SH + 160, ease.inOut(clamp((t - 5.88) / .8)));
    const g = p.createLinearGradient(0, front - 130, 0, front + 30);
    g.addColorStop(0, 'rgba(96,112,58,0)'); g.addColorStop(1, 'rgba(96,112,58,.22)');
    p.globalCompositeOperation = 'source-atop'; p.fillStyle = g; p.fillRect(0, 0, SW, SH);
    if (t < 6.04) {
      const m = maskC.getContext('2d');
      m.clearRect(0, 0, 600, 300);
      for (const [ti, x, y] of IMP) {
        const u = t - ti; if (u < 0) continue;
        const r = 20 + 300 * ease.out(clamp(u / .45));
        const rg = m.createRadialGradient(x / 2, y / 2, 0, x / 2, y / 2, r / 2);
        rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(.7, 'rgba(0,0,0,.95)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        m.fillStyle = rg; m.fillRect(0, 0, 600, 300);
      }
      const gl = smooth(5.72, 6.02, t);
      if (gl > 0) { m.fillStyle = `rgba(0,0,0,${gl})`; m.fillRect(0, 0, 600, 300); }
      p.globalCompositeOperation = 'destination-in'; p.drawImage(maskC, 0, 0, SW, SH);
    }
    p.globalCompositeOperation = 'source-over';
    ctx.drawImage(pressC, 0, 0);
  }
  function impacts(ctx, t) {
    for (const [ti, x, y] of IMP) {
      const u = t - ti; if (u < 0 || u > .5) continue;
      const k = u / .5;
      ctx.strokeStyle = `rgba(255,248,225,${.55 * (1 - k)})`; ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(x, y, 40 + 200 * ease.out(k), 30 + 150 * ease.out(k), 0, 0, Math.PI * 2); ctx.stroke();
      // water squeezed out of the pith
      const r = mulberry(ti * 100 | 0);
      ctx.fillStyle = `rgba(232,240,236,${.85 * (1 - k)})`;
      for (let d = 0; d < 14; d++) {
        const a = r() * Math.PI * 2, v = 120 + r() * 220, rr = 2 + r() * 3;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * v * ease.out(k), y + Math.sin(a) * v * .75 * ease.out(k), rr * (1 - k * .5), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function malletAt(t) { // ground point and lift (0 = on the sheet)
    const ins = ease.out(clamp((t - 4.72) / .3)), out = ease.in(clamp((t - 5.78) / .35));
    let x, y, h;
    if (t < IMP[0][0]) {
      const u = clamp((t - 4.72) / (IMP[0][0] - 4.72));
      x = IMP[0][1] + 500 * (1 - ins); y = IMP[0][2] - 420 * (1 - ins); h = u < .55 ? 1 : 1 - ease.in((u - .55) / .45);
    } else {
      let i = IMP.length - 1; while (i > 0 && t < IMP[i][0]) i--;
      const [t0, xa, ya] = IMP[i];
      if (i < IMP.length - 1) {
        const [t1, xb, yb] = IMP[i + 1], u = (t - t0) / (t1 - t0);
        h = u < .6 ? ease.out(u / .6) : 1 - ease.in((u - .6) / .4);
        const m = ease.inOut(clamp(u / .7)); x = lerp(xa, xb, m); y = lerp(ya, yb, m);
      } else {
        const u = clamp((t - t0) / .3); h = ease.out(u); x = xa + 500 * out; y = ya - 420 * out;
      }
    }
    return [x, y, h];
  }
  function mallet(ctx, t) {
    if (t < 4.72 || t > 6.15) return;
    const [x, y, h] = malletAt(t);
    const draw = (g, fill) => { // wooden mallet: barrel head across the handle
      g.save(); g.rotate(-.62);
      if (fill) {
        g.fillStyle = '#7a4f2a'; g.strokeStyle = INK; g.lineWidth = 2.5;
        g.beginPath(); g.roundRect(30, -12, 230, 24, 11); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,230,190,.25)'; g.fillRect(36, -9, 220, 5);
        const wg = g.createLinearGradient(-40, 0, 40, 0);
        wg.addColorStop(0, '#5e3a1c'); wg.addColorStop(.28, '#c99460'); wg.addColorStop(.5, '#a8703d'); wg.addColorStop(1, '#4e2f15');
        g.fillStyle = wg; g.beginPath(); g.roundRect(-40, -92, 80, 184, 14); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(60,32,12,.4)'; g.lineWidth = 1.3;
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 13, -88); g.bezierCurveTo(i * 13 + 5, -30, i * 13 - 5, 30, i * 13 + 2, 88); g.stroke(); }
        g.strokeStyle = 'rgba(40,20,6,.55)'; g.lineWidth = 3;
        for (const yy of [-78, 78]) { g.beginPath(); g.moveTo(-38, yy); g.lineTo(38, yy); g.stroke(); }
      } else { g.beginPath(); g.roundRect(30, -12, 230, 24, 11); g.fill(); g.beginPath(); g.roundRect(-40, -92, 80, 184, 14); g.fill(); }
      g.restore();
    };
    ctx.save(); ctx.translate(x + 40 * h + 8, y + 52 * h + 10); ctx.globalAlpha = .3 - .12 * h; ctx.fillStyle = '#3c220c'; draw(ctx, false); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.scale(1 + .22 * h, 1 + .22 * h); draw(ctx, true); ctx.restore();
  }
  // ---------- the roll ----------
  function shadowRect(ctx, s, x, y, w, h, a = .42) {
    ctx.save(); ctx.shadowColor = `rgba(55,30,10,${a})`; ctx.shadowBlur = 24 * s; ctx.shadowOffsetX = -20000 * s + 9 * s; ctx.shadowOffsetY = 13 * s;
    ctx.fillStyle = '#000'; ctx.fillRect(x + 20000, y, w, h); ctx.restore();
  }
  function drawRoll(ctx, s, rx, r) {
    const c = rx + r, N = 22, src = sheets[2];
    shadowRect(ctx, s, c - r * .4, -6, r * 1.6, SH + 12, .5);
    for (let k = 0; k < N; k++) {
      const a1 = -Math.PI / 2 + Math.PI * k / N, a2 = a1 + Math.PI / N;
      const x1 = c + r * Math.sin(a1), x2 = c + r * Math.sin(a2);
      const u1 = 300 + r * (a1 + Math.PI / 2), u2 = 300 + r * (a2 + Math.PI / 2);
      ctx.drawImage(src, u1, 0, Math.max(1, u2 - u1), SH, x1, 0, x2 - x1 + .8, SH);
    }
    const g = ctx.createLinearGradient(c - r, 0, c + r, 0);
    g.addColorStop(0, 'rgba(50,28,10,.55)'); g.addColorStop(.12, 'rgba(50,28,10,.12)'); g.addColorStop(.3, 'rgba(255,246,220,.22)');
    g.addColorStop(.45, 'rgba(255,246,220,0)'); g.addColorStop(.8, 'rgba(50,28,10,.28)'); g.addColorStop(1, 'rgba(40,20,6,.62)');
    ctx.fillStyle = g; ctx.fillRect(c - r, 1, 2 * r, SH - 2);
    // spiral end of the roll at the bottom
    ctx.save(); ctx.translate(c, SH - 2); const ry = r * .3;
    ctx.fillStyle = '#d8c393'; ctx.beginPath(); ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = 'rgba(70,45,20,.55)'; ctx.lineWidth = 1.2 / s;
    for (let q = .88; q > .1; q -= .12) { ctx.beginPath(); ctx.ellipse(-r * (1 - q) * .3, 0, r * q, ry * q, 0, 0, Math.PI); ctx.stroke(); }
    ctx.fillStyle = 'rgba(60,35,12,.7)'; ctx.beginPath(); ctx.ellipse(-r * .27, 0, r * .12, ry * .12, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = rgba(INK, .6); ctx.lineWidth = 1.5 / s; ctx.beginPath(); ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI); ctx.stroke();
    ctx.restore();
  }

  // ---------- card 2: the Diary of Merer ----------
  const COLX = k => 2185 - k * 74;           // columns, written right to left
  const COLT = k => 12.04 + k * .2;           // start time of column k (each takes .2 s)
  const NCOL = 7, KCART = 1;
  const KHUFU = [0x1340D, 0x13171, 0x13191, 0x13171];
  const WID = new Map();
  // a sign mirrored to face right (columns read right to left), shrunk to fit its column, stroked for brush weight
  function glyphM(ctx, cp, x, y, sz, maxW, col, lw = 1.7) {
    const k = Math.min(1, maxW / ((WID.get(cp) || 100) * sz / 100));
    ctx.save(); ctx.translate(x, y); ctx.scale(-k, k); ctx.fillStyle = ctx.strokeStyle = col; ctx.lineWidth = lw / k;
    ctx.fillText(G(cp), 0, 0); ctx.strokeText(G(cp), 0, 0); ctx.restore();
  }
  function penAt(t) {
    if (t >= 11.78 && t < 12.02) { const u = (t - 11.78) / .24; return [lerp(2215, 1135, u), 98]; }
    if (t >= 13.45 && t < 13.8) return [lerp(1620, 1000, (t - 13.45) / .35), 474];          // the Nile and its bank
    if (t >= 13.8 && t < 14.2) { const d = (t - 13.8) / .4 * 626;                            // pyramid outline
      return d < 313 ? [lerp(1032, 1190, d / 313), lerp(466, 196, d / 313)] : [lerp(1190, 1348, d / 313 - 1), lerp(196, 466, d / 313 - 1)]; }
    if (t >= 14.2 && t < 14.5) { const u = (t - 14.2) / .3; return u < .6 ? [lerp(1446, 1606, u / .6), 462] : [lerp(1552, 1494, (u - .6) / .4), 412]; }
    for (let k = NCOL - 1; k >= 0; k--) if (t >= COLT(k)) {
      const u = clamp((t - COLT(k)) / .2); if (u >= 1) return null;
      return [COLX(k), 168 + u * 330];
    }
    return null;
  }
  function writing(ctx, t) {
    if (t < 11.75) return;
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // header line with a red rubric, written right to left
    font(ctx, 40, HG);
    header.forEach((g, i) => {
      const k = clamp((t - 11.78 - i * .0086) / .05); if (k <= 0) return;
      ctx.globalAlpha = k * .92; glyphM(ctx, g, 2215 - i * 40, 98, 40, 36, i < 4 ? RED : INK, 1.2);
    });
    const rl = clamp((t - 11.8) / .3);
    ctx.globalAlpha = .55; ctx.fillStyle = INK; ctx.fillRect(2238 - 1200 * rl, 128, 1200 * rl, 2.5);
    // column rules and columns
    font(ctx, 58, HG);
    for (let k = 0; k < NCOL; k++) {
      const p = clamp((t - COLT(k)) / .2); if (p <= 0) continue;
      const x = COLX(k);
      ctx.globalAlpha = .4; ctx.fillStyle = INK; ctx.fillRect(x - 37, 140, 2, 380 * Math.min(1, p * 2));
      if (k === KCART) {
        const a = clamp(p * 1.4);
        ctx.globalAlpha = .95; ctx.strokeStyle = RED; ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.roundRect(x - 33, 148, 66, 352, 33); ctx.setLineDash([a * 900, 900]); ctx.stroke(); ctx.setLineDash([]);
        if (a > .9) ctx.fillRect(x - 38, 508, 76, 6);
        KHUFU.forEach((cp, i) => { const g = clamp(p * 5 - i - .6); if (g > 0) { ctx.globalAlpha = g * .95; glyphM(ctx, cp, x, 200 + i * 84, 58, 50, INK); } });
        continue;
      }
      colGlyphs[k].forEach((g, i) => {
        const a = clamp(p * 5 - i); if (a <= 0) return;
        ctx.globalAlpha = a * .92; glyphM(ctx, g.cp, x, 186 + i * 74, 58, 62, g.red ? RED : INK);
      });
    }
    ctx.restore();
  }
  function cartGlow(ctx, t) { // a warm breath behind the cartouche while the subtitle names Khufu
    const a = win(t, 12.4, 14.6, .5, .9); if (a <= 0) return;
    const x = COLX(KCART), g = ctx.createRadialGradient(x, 330, 20, x, 330, 260);
    g.addColorStop(0, `rgba(255,236,190,${.55 * a})`); g.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = g; ctx.fillRect(x - 260, 70, 520, 520); ctx.restore();
  }
  function vignetteNile(ctx, t) {
    if (t < 13.45) return;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // register ground painted right to left: the Nile (blue band, zigzag ripples) on the right, the desert bank
    // (sand band with red stipple, as in Egyptian painting) on the left, where the pyramid stands
    const wa = clamp((t - 13.45) / .35);
    ctx.save(); ctx.beginPath(); ctx.rect(1626 - 632 * wa, 440, 632 * wa, 90); ctx.clip();
    ctx.globalAlpha = .9; ctx.fillStyle = BLUE; ctx.fillRect(1360, 470, 260, 44);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.globalAlpha = .85;
    for (const yy of [482, 500]) { ctx.beginPath(); for (let x = 1366, i = 0; x <= 1614; x += 11, i++) ctx.lineTo(x, yy + (i % 2 ? -5 : 5)); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.strokeRect(1360, 470, 260, 44);
    ctx.globalAlpha = .85; ctx.fillStyle = '#d3a95c'; ctx.fillRect(1000, 466, 360, 16);
    const r = mulberry(612); ctx.fillStyle = RED; ctx.globalAlpha = .6;
    for (let i = 0; i < 46; i++) { ctx.beginPath(); ctx.arc(1006 + r() * 348, 470 + r() * 8, 1.3 + r() * .9, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.lineWidth = 2.4; ctx.strokeRect(1000, 466, 360, 16);
    ctx.restore();
    // pyramid with its white limestone casing, standing on the bank
    const pa = clamp((t - 13.8) / .4), pf = smooth(14.1, 14.4, t);
    if (pa > 0) {
      ctx.beginPath(); ctx.moveTo(1032, 466); ctx.lineTo(1190, 196); ctx.lineTo(1348, 466);
      ctx.globalAlpha = pf * .95; ctx.fillStyle = '#efe6cc'; ctx.fill();
      ctx.globalAlpha = pf * .5; ctx.fillStyle = '#d9c99c'; ctx.beginPath(); ctx.moveTo(1190, 196); ctx.lineTo(1348, 466); ctx.lineTo(1230, 466); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = .9; ctx.strokeStyle = INK; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(1032, 466); ctx.lineTo(1190, 196); ctx.lineTo(1348, 466); ctx.setLineDash([pa * 640, 700]); ctx.stroke(); ctx.setLineDash([]);
    }
    // cargo boat with a limestone block, sailing toward the pyramid
    const ba = smooth(14.2, 14.5, t);
    if (ba > 0) {
      const bx = -66 * ease.inOut(clamp((t - 14.5) / 1.8));
      ctx.save(); ctx.translate(bx, 0); ctx.globalAlpha = ba;
      ctx.fillStyle = '#9a6a3a'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(1446, 444); ctx.quadraticCurveTo(1460, 474, 1520, 474); ctx.quadraticCurveTo(1580, 474, 1606, 432);
      ctx.lineTo(1596, 452); ctx.lineTo(1452, 456); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#efe6cc'; ctx.fillRect(1494, 410, 58, 42); ctx.strokeRect(1494, 410, 58, 42);
      ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(1470, 404); ctx.lineTo(1452, 482); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(1451, 484, 4, 11, .25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- the whole sheet / roll in world space ----------
  function world(ctx, t, c) {
    const rx = rollX(t), r = rollR(rx);
    const making = t < 6.05, wetSheet = t >= IMP[0][0] && t < 6.75;
    const s1x = SEP + 1800 * (1 - ease.out(clamp((t - 6.85) / .6)));
    const s2x = 2 * SEP + 2000 * (1 - ease.out(clamp((t - 7.12) / .6)));
    const flatR = Math.min(rx + r, L);
    // cast shadow of the flat part
    if (!making || t > 5.0) shadowRect(ctx, c.s, 0, 0, Math.min(SW, flatR), SH, making ? .42 * smooth(5.0, 5.9, t) : .42);
    if (t > 6.85) { shadowRect(ctx, c.s, Math.min(s1x, flatR), 0, clamp(flatR - s1x, 0, SW), SH); shadowRect(ctx, c.s, Math.min(s2x, flatR), 0, clamp(flatR - s2x, 0, SW), SH); }
    ctx.save(); ctx.beginPath(); ctx.rect(-80, -80, flatR + 80, SH + 160); ctx.clip();
    if (making) {
      splitStem(ctx, t);
      strips(ctx, t);
    }
    if (wetSheet) pressedLayer(ctx, t); else if (!making) ctx.drawImage(sheets[0], 0, 0);
    if (t > 6.85) {
      for (const [img, x] of [[sheets[1], s1x], [sheets[2], s2x]]) {
        ctx.fillStyle = 'rgba(70,40,14,.25)'; ctx.fillRect(x - 5, 0, 5, SH); // lip of the paste join
        ctx.drawImage(img, x, 0);
      }
    }
    // damp stain from the bottom-left corner of sheet 0
    if (t > 8.95 && t < 12.2) {
      const P = .06 + .8 * ease.out(clamp((t - 8.98) / 1.3)), D = smooth(9.9, 10.75, t);
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(GL.run(STAIN, 460, 330, { P, D }), 0, SH - 330, 460, 330); ctx.restore();
    }
    writing(ctx, t);
    cartGlow(ctx, t);
    vignetteNile(ctx, t);
    ctx.restore();
    if (rx < L - .5) drawRoll(ctx, c.s, rx, r);
    if (making) { impacts(ctx, t); mallet(ctx, t); }
    // a drop of water falling onto the corner
    if (t > 8.55 && t < 9.25) {
      const u = clamp((t - 8.55) / .42), x = 92, y = 520;
      if (u < 1) {
        const hgt = (1 - u * u) * 160;
        ctx.fillStyle = `rgba(60,35,12,${.25 * u})`; ctx.beginPath(); ctx.ellipse(x + hgt * .3, y + hgt * .4, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(150,175,185,.9)'; ctx.beginPath(); ctx.ellipse(x, y, 15 + hgt * .06, 20 + hgt * .08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(225,240,244,.95)'; ctx.beginPath(); ctx.ellipse(x - 2, y - 3, 11 + hgt * .05, 15 + hgt * .06, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(x - 5, y - 8, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        const k = clamp((t - 8.97) / .28);
        ctx.strokeStyle = `rgba(235,245,248,${.9 * (1 - k)})`; ctx.lineWidth = 5 * (1 - k) + 1.5;
        ctx.beginPath(); ctx.ellipse(x, y, 16 + 80 * k, 12 + 60 * k, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // reed pen following the writing
    const pp = penAt(t);
    if (pp) {
      const [x, y] = pp;
      ctx.save(); ctx.translate(x + 6, y + 4); ctx.rotate(-1.05);
      ctx.fillStyle = 'rgba(55,30,10,.22)'; ctx.fillRect(18, 14, 230, 7);
      ctx.fillStyle = '#c8a564'; ctx.fillRect(6, -3, 240, 6); ctx.fillStyle = INK; ctx.fillRect(0, -2, 10, 4);
      ctx.restore();
    }
  }

  scene({
    id: 'papyrus', n: ch.n, dur: ch.dur, trans: { type: 'papyrus_burn', d: 1.1 },
    cues: [
      { t: 0, sfx: 'fire', v: .7 }, { t: .3, sfx: 'harp' },
      { t: 2.95, sfx: 'carve', v: .6 },
      { t: 3.42, sfx: 'paper', v: .6 }, { t: 4.26, sfx: 'paper', v: .6 },
      { t: 5.1, sfx: 'wood' }, { t: 5.4, sfx: 'wood' }, { t: 5.7, sfx: 'wood' },
      { t: 7.35, sfx: 'paper', v: .5 }, { t: 7.85, sfx: 'paper', v: .6 },
      { t: 8.97, sfx: 'drip' },
      { t: 10.92, sfx: 'paper', v: .6 },
      ...[0, 1, 2, 3, 4, 5, 6].map(k => ({ t: +COLT(k).toFixed(2), sfx: 'brush', v: .55 })),
      { t: 13.45, sfx: 'water', v: .4 },
    ],
    init() {
      wall = GL.bake(WALL, W, H);
      sheets = [0, 1, 2].map(i => GL.bake(SHEET, SW, SH, { SEED: 1 + i * 2.7 }));
      vlay = GL.bake(STRIPS, SW, SH, { DIR: 0, N: NV });
      hlay = GL.bake(STRIPS, SW, SH, { DIR: 1, N: NH });
      maskC = makeCanvas(600, 300); pressC = makeCanvas(SW, SH);
      plantsL = makeClump(31, 190, -1); plantsR = makeClump(77, 1730, 1);
      const SET = [0x13000, 0x13153, 0x13080, 0x131A3, 0x131F3, 0x132B9, 0x13171, 0x13191, 0x133CF, 0x13216, 0x1308B,
        0x132AA, 0x1313F, 0x131CB, 0x130C0, 0x133A1, 0x132F4, 0x13193, 0x13250, 0x13333, 0x1320E, 0x1302D, 0x13050, 0x1309D, 0x13283];
      const r = mulberry(404);
      colGlyphs = [];
      for (let k = 0; k < NCOL; k++) { const a = []; for (let i = 0; i < 5; i++) a.push({ cp: SET[Math.floor(r() * SET.length)], red: k === 0 && i < 2 }); colGlyphs.push(a); }
      header = []; for (let i = 0; i < 28; i++) header.push(SET[Math.floor(r() * SET.length)]);
      const mc = makeCanvas(8, 8).getContext('2d'); font(mc, 100, HG);
      for (const cp of [...SET, ...KHUFU]) WID.set(cp, mc.measureText(G(cp)).width);
    },
    draw(ctx, t) {
      ctx.drawImage(wall, 0, 0);
      // marsh: papyrus clumps rise beside the title, leave when the roll is pulled back
      const pa = 1 - smooth(6.5, 7.1, t);
      if (pa > 0) { clump(ctx, plantsL, t, pa); clump(ctx, plantsR, t, pa); }
      const c = cam(t), [sx, sy] = shake(t);
      ctx.save(); ctx.setTransform(c.s, 0, 0, c.s, W / 2 - c.x * c.s + sx, CY - c.y * c.s + sy);
      world(ctx, t, c);
      ctx.restore();
      // the sun that dries the sheet, and the dry Egyptian air
      const glow = Math.max(win(t, 5.75, 6.9, .3, .6), win(t, 9.85, 11.2, .4, .7));
      if (glow > 0) {
        ctx.fillStyle = `rgba(255,214,140,${.12 * glow})`; ctx.fillRect(0, 0, W, H);
      }
      frieze(ctx, 0, 30, clamp(t / .8));
      frieze(ctx, 832, 20, clamp((t - .1) / .8)); // sits high enough to leave the subtitle room to breathe
      wingedSun(ctx, 960, 120, .95, t, glow);
      opener(ctx, t, ch, {
        ink: '#24170d', sub: '#3e2814', accent: RED, y: 440, outAt: 2.9,
        title: { family: '"Noto Serif SC"', size: 150, weight: 900, sp: 30 },
        small: { family: '"Noto Serif SC"', size: 32, weight: 600 },
        num: { family: 'Cinzel', size: 66, weight: 700 },
      });
      subs(ctx, t, ch, { ink: '#24170d', body: { family: '"Noto Serif SC"', size: 52, weight: 700 } });
      grain(ctx, t, .05);
    },
  });
})();
