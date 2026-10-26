// 04 龟甲 — Shang bronze: a patinated bronze surface framed by cast thunder-pattern (云雷纹) bands. On it a turtle
// plastron: heat glows through from the drilled hollows, cracks run out in the shape of 卜, an inscription is incised
// stroke by stroke and filled with cinnabar, the 卜 crack becomes the oracle glyph and then the modern character,
// and the camera pulls back over an archive of plastrons, scapulae and fragments.
'use strict';
(() => {
  const ch = CH('oracle');
  const IV = '#efe4c8', CIN = '#c4402b';
  const P0 = 62, P1 = 800, CX = 960, CY = (P0 + P1) / 2;   // picture area between the two cast bands
  const PX = 580, PY = 760;                                   // archive grid pitch (world units)

  // ---------------------------------------------------------------- shaders (baked once)
  const PATINA = `
  float crustH(vec2 p){ return smoothstep(.5,.66,fbm(p*7.+5.3))*smoothstep(.35,.6,fbm3(p*1.4+2.)); }
  void main(){ vec2 p=uv*vec2(R.x/R.y,1.)*2.6;
    float a=fbm3(p*1.3), c0=crustH(p), e=.003;
    float cx=crustH(p+vec2(e,0.))-c0, cy=crustH(p+vec2(0.,e))-c0;
    vec3 n=normalize(vec3(-cx*4.,-cy*4.,1.));
    float dif=clamp(dot(n,normalize(vec3(-.45,.5,.75))),0.,1.);
    float cup=smoothstep(.6,.8,fbm3(p*2.2+9.1));
    float g1=vn(p*110.), g2=vn(p*30.+4.);
    vec3 bronze=vec3(.2,.26,.22), olive=vec3(.26,.33,.27), mal=vec3(.31,.45,.37), cu=vec3(.36,.27,.19);
    vec3 col=mix(bronze,olive,smoothstep(.3,.7,a));
    col*=.92+.16*g2;
    col=mix(col,mal*(.88+.24*g1),c0*.5);
    col=mix(col,cu*(.88+.24*g1),cup*.22*(1.-c0));
    col*=.88+.24*dif;
    col*=.95+.08*g1;
    vec2 q=uv-.5; col*=1.-dot(q,q)*.4;
    O=vec4(col,1.); }`;
  // bone: ivory with warm mottling, porous speckle and a faint grain along the length. K = px per world unit.
  const BONE = `uniform float K; uniform vec2 OFF;
  void main(){ vec2 p=uv*R/(K*230.)+OFF;
    float a=fbm(p*1.2), b=fbm(p*3.4+3.), c=vn(p*70.), d=fbm(p*8.+1.);
    vec3 ivory=vec3(.89,.81,.64), warm=vec3(.8,.65,.45), dark=vec3(.6,.45,.29), grey=vec3(.74,.71,.6);
    vec3 col=mix(ivory,warm,smoothstep(.3,.78,a));
    col=mix(col,grey,smoothstep(.55,.8,b)*.26);
    col=mix(col,dark,smoothstep(.56,.86,fbm(p*.9+7.))*.62);
    col*=.93+.1*d;
    vec2 v=vor(p*12.); col*=1.-smoothstep(.07,.0,v.x)*.13;
    vec2 v2=vor(p*3.1+11.); col*=1.-smoothstep(.016,.0,v2.y-v2.x)*.06;
    col*=.97+.06*c;
    O=vec4(col,1.); }`;
  // cast relief for the thunder-pattern band: M is a height mask (white = raised)
  const RELIEF = `uniform sampler2D M;
  void main(){ vec2 px=1./R;
    float h=texture(M,uv).r;
    float hl=texture(M,uv-vec2(px.x*1.5,0.)).r, hr=texture(M,uv+vec2(px.x*1.5,0.)).r;
    float hd=texture(M,uv-vec2(0.,px.y*1.5)).r, hu=texture(M,uv+vec2(0.,px.y*1.5)).r;
    vec3 n=normalize(vec3((hl-hr)*2.4,(hd-hu)*2.4,1.));
    float dif=clamp(dot(n,normalize(vec3(-.45,.55,.7))),0.,1.);
    vec2 q=uv*R/34.;
    float a=fbm3(q*.6), crust=smoothstep(.45,.7,fbm3(q*1.3+4.)), fine=vn(q*9.);
    vec3 recess=mix(vec3(.1,.17,.14),vec3(.26,.43,.36),crust*.8);
    vec3 raised=mix(vec3(.54,.45,.29),vec3(.34,.5,.41),smoothstep(.35,.65,a)*.7);
    vec3 col=mix(recess,raised,smoothstep(.15,.6,h));
    col*=.5+.8*dif; col*=.9+.2*fine;
    col+=vec3(.95,.78,.46)*pow(dif,10.)*.22*h;
    O=vec4(col,1.); }`;

  // ---------------------------------------------------------------- geometry helpers
  function catmull(pts, n = 6) { // closed uniform Catmull-Rom; a doubled point makes a corner
    const out = [], N = pts.length;
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(d => .5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    return out;
  }
  const toPath = (pts, close = true) => { const p = new Path2D(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); if (close) p.closePath(); return p; };
  const polyline = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
  function partial(g, pts, k) { // first fraction k of a polyline
    const n = pts.length - 1, up = k * n; if (up <= 0) return false;
    g.moveTo(pts[0][0], pts[0][1]);
    for (let j = 1; j <= Math.ceil(up); j++) { const f = Math.min(1, up - (j - 1)), a = pts[j - 1], b = pts[j]; g.lineTo(lerp(a[0], b[0], f), lerp(a[1], b[1], f)); }
    return true;
  }
  function pointAt(pts, k) { const n = pts.length - 1, up = clamp(k) * n, j = Math.min(n - 1, Math.floor(up)), f = up - j; return [lerp(pts[j][0], pts[j + 1][0], f), lerp(pts[j][1], pts[j + 1][1], f)]; }
  function jag(a, b, n, amp, seed) { // jagged crack line a→b, fixed at a
    const pts = [], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    for (let k = 0; k <= n; k++) {
      const f = k / n, env = Math.min(1, f * 4);
      const o = ((vnoise(f * 5 + seed, seed * 3.1) - .5) * 2 + (hash2(k, seed * 13 + 7) - .5) * .9) * amp * env;
      pts.push([a[0] + dx * f + nx * o, a[1] + dy * f + ny * o]);
    }
    return pts;
  }
  function mixHex(a, b, m, al = 1) {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const c = s => Math.round(lerp(A >> s & 255, B >> s & 255, m));
    return `rgba(${c(16)},${c(8)},${c(0)},${al})`;
  }

  // turtle plastron, right half from the anterior midline to the anal notch (world units; doubled points = corners)
  const HALF = [[0, -334], [46, -346], [108, -346], [166, -328], [210, -292], [234, -244], [240, -196],
    [240, -176], [240, -176], [262, -162], [262, -162], [272, -96], [275, -30], [268, 28], [268, 28], [244, 48], [236, 72], [236, 72],
    [232, 130], [222, 196], [202, 256], [170, 306], [128, 340], [94, 358], [94, 358], [62, 338], [28, 318], [0, 306]];
  const fullOutline = (half, s = 1) => catmull(half.concat(half.slice(1, -1).reverse().map(([x, y]) => [-x, y])).map(([x, y]) => [x * s, y * s]));
  const PL_PTS = fullOutline(HALF), PL = toPath(PL_PTS);
  const SULCI = [ // scute seams, right half (left half mirrored, slightly offset so the midline zig-zags)
    [[0, -262], [60, -266], [130, -290], [196, -312]],
    [[0, -150], [90, -146], [180, -158], [244, -178]],
    [[0, -14], [100, -8], [200, -22], [272, -40]],
    [[0, 146], [90, 142], [170, 128], [236, 106]],
    [[0, 248], [60, 252], [130, 272], [178, 304]]];

  // oracle-bone glyph forms as stroke lists in a unit box (archaic shapes, carved with straight strokes)
  const GLY = {
    bu: [[[.5, .04], [.5, .96]], [[.5, .36], [.9, .28]]],
    jin: [[[.1, .62], [.5, .06], [.9, .62]], [[.32, .8], [.68, .8]]],
    ri: [[[.24, .12], [.76, .12], [.86, .5], [.76, .88], [.24, .88], [.14, .5], [.24, .12]], [[.38, .5], [.62, .5]]],
    yu: [[[.08, .1], [.92, .1]], [[.5, .1], [.5, .38]], [[.2, .26], [.2, .44]], [[.8, .26], [.8, .44]], [[.2, .6], [.2, .78]], [[.5, .56], [.5, .74]], [[.8, .6], [.8, .78]], [[.35, .84], [.35, .98]], [[.65, .84], [.65, .98]]],
    qi: [[[.12, .06], [.3, .9], [.7, .9], [.88, .06]], [[.18, .3], [.64, .9]], [[.82, .3], [.36, .9]]],
    zi: [[[.5, .02], [.5, .14]], [[.5, .14], [.24, .26], [.22, .9], [.78, .9], [.76, .26], [.5, .14]], [[.32, .46], [.68, .46]], [[.32, .68], [.68, .68]]],
    dong: [[[.5, .02], [.5, .2]], [[.5, .2], [.8, .38], [.8, .62], [.5, .8], [.2, .62], [.2, .38], [.5, .2]], [[.3, .36], [.7, .64]], [[.7, .36], [.3, .64]], [[.5, .2], [.26, .06]], [[.5, .2], [.74, .06]], [[.5, .8], [.5, .98]], [[.5, .8], [.26, .94]], [[.5, .8], [.74, .94]]],
    lai: [[[.5, .04], [.5, .96]], [[.5, .04], [.68, .14]], [[.14, .52], [.5, .28], [.86, .52]], [[.22, .96], [.5, .72], [.78, .96]]],
    bei: [[[.4, .06], [.42, .94]], [[.41, .36], [.12, .6]], [[.6, .06], [.58, .94]], [[.59, .36], [.88, .6]]],
    wang: [[[.2, .1], [.8, .1]], [[.5, .1], [.5, .78]], [[.14, .78], [.5, .98], [.86, .78]]],
    ren: [[[.58, .06], [.46, .4], [.3, .94]], [[.47, .38], [.74, .62]]],
    yue: [[[.62, .06], [.3, .22], [.2, .56], [.36, .86], [.66, .96], [.5, .66], [.5, .32], [.62, .06]], [[.4, .46], [.48, .56]]],
    zhen: [[[.2, .14], [.8, .14], [.8, .62], [.2, .62], [.2, .14]], [[.2, .38], [.8, .38]], [[.3, .62], [.18, .94]], [[.7, .62], [.82, .94]]],
    one: [[[.18, .5], [.82, .5]]],
    two: [[[.24, .34], [.76, .34]], [[.14, .66], [.86, .66]]],
  };
  const GKEYS = ['jin', 'ri', 'yu', 'qi', 'zi', 'dong', 'lai', 'bei', 'wang', 'ren', 'yue', 'zhen', 'bu'];

  // ---------------------------------------------------------------- the four heat cracks (卜兆), branches toward the midline
  const CRACKS = [
    { J: [-95, -215], L: 172, dir: 1, tc: 2.5, seed: 11 },
    { J: [95, -215], L: 172, dir: -1, tc: 3.9, seed: 23 },
    { J: [-95, 36], L: 160, dir: 1, tc: 4.6, seed: 37 },
    { J: [95, 36], L: 160, dir: -1, tc: 5.3, seed: 41 },
  ];
  for (const c of CRACKS) {
    const [x, y] = c.J, L = c.L;
    c.up = jag(c.J, [x, y - .35 * L], 9, 2.6, c.seed);
    c.down = jag(c.J, [x, y + .65 * L], 16, 2.8, c.seed + 1);
    c.br = jag(c.J, [x + c.dir * .45 * L, y - .08 * L], 9, 2.2, c.seed + 2);
    const r = mulberry(c.seed);
    c.hairs = [];
    for (let k = 0; k < 4; k++) {
      const src = k < 2 ? c.down : k === 2 ? c.up : c.br, f = .3 + r() * .55, p = pointAt(src, f);
      const ang = (k < 3 ? (r() < .5 ? 0 : Math.PI) : -Math.PI / 2) + (r() - .5) * 1.2, len = 10 + r() * 16;
      c.hairs.push({ at: f, src: k < 2 ? 0 : k === 2 ? 1 : 2, pts: jag(p, [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len], 4, 1.4, c.seed * 5 + k) });
    }
  }

  // ---------------------------------------------------------------- inscription: 今日雨 / 其自東來雨 (right), 其自北來雨 (left)
  const GS = 46, GSTEP = 52;
  const COLS = [
    { x: 174, y: -264, g: ['jin', 'ri', 'yu'], t0: 6.35, dt: .27 },
    { x: 174, y: -42, g: ['qi', 'zi', 'dong', 'lai', 'yu'], t0: 7.2, dt: .2 },
    { x: -174, y: -42, g: ['qi', 'zi', 'bei', 'lai', 'yu'], t0: 8.2, dt: .15 },
  ];
  const INSC = [];
  COLS.forEach(col => col.g.forEach((name, i) => INSC.push({ name, x: col.x - GS / 2, y: col.y + i * GSTEP, S: GS, t0: col.t0 + i * col.dt, t1: col.t0 + (i + 1) * col.dt - .02 })));
  INSC.forEach((e, i) => { e.tf = 9.0 + i * .045; });
  // crack-order numerals (兆序) carved beside each crack
  CRACKS.forEach((c, i) => INSC.push({ name: i < 2 ? 'one' : 'two', x: c.J[0] - c.dir * 46 - 10, y: c.J[1] - 56, S: 20, t0: 8.95 + i * .05, t1: 9.0 + i * .05, num: true }));

  // ---------------------------------------------------------------- camera
  const HOME = { x: -385, y: 0, z: .96 };
  const HERO = { x: 257, y: -194, z: 1.45 };
  const FAR1 = { x: 0, y: 0, z: .105 }, FAR2 = { x: 0, y: 0, z: .058 };
  function pan(a, b, u) { return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), u)) }; }
  function dolly(a, b, u) { // pure zoom about the fixed point of the move
    const z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), u));
    const fx = (b.x * b.z - a.x * a.z) / (b.z - a.z), fy = (b.y * b.z - a.y * a.z) / (b.z - a.z);
    return { x: fx - (fx - a.x) * a.z / z, y: fy - (fy - a.y) * a.z / z, z };
  }
  const KEYS = [ // [time, camera, easing into this key]
    [0, HOME], [3.2, { x: -385, y: 0, z: .985 }, 'lin'],
    [4.7, { x: 0, y: -10, z: 1.0 }, 'io'], [5.7, { x: 0, y: -14, z: 1.02 }, 'lin'],
    [6.6, { x: 12, y: -30, z: 1.36 }, 'io'], [9.55, { x: 0, y: -30, z: 1.39 }, 'lin'],
    [10.5, HERO, 'io'], [13.6, { x: 262, y: -196, z: 1.48 }, 'lin'],
    [16.2, FAR1, 'dolly'],
  ];
  function camAt(t) {
    if (t <= 0) return HOME;
    for (let i = 0; i < KEYS.length - 1; i++) {
      const [ta, a] = KEYS[i], [tb, b, mode] = KEYS[i + 1];
      if (t > tb) continue;
      const u = inv(ta, tb, t);
      return mode === 'dolly' ? dolly(a, b, ease.inOut(u)) : pan(a, b, mode === 'io' ? ease.inOut(u) : u);
    }
    return pan(FAR1, FAR2, smooth(16.2, 21, t)); // keep creeping back past the end of the chapter
  }
  const setWorld = (g, c) => g.setTransform(c.z, 0, 0, c.z, CX - c.x * c.z, CY - c.y * c.z);

  // ---------------------------------------------------------------- baked assets
  let patina, band, plLv, plShadow, frags, gBu, cells;

  function thunderMask(w, h) { // 雷纹: rows of square spirals between two raised rims
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.fillRect(0, 2, w, 4); g.fillRect(0, h - 6, w, 4);
    const u = (h - 18) / 7, y0 = 9;
    const S = [[.5, 7], [.5, .5], [6.5, .5], [6.5, 6.5], [2.5, 6.5], [2.5, 2.5], [4.5, 2.5], [4.5, 4.5], [3.5, 4.5]];
    g.strokeStyle = '#fff'; g.lineWidth = u * .92; g.lineCap = 'butt'; g.lineJoin = 'miter';
    for (let i = 0, x = -u * 3; x < w + 8 * u; i++, x += 8 * u) {
      g.beginPath();
      S.forEach(([a, b], k) => { const X = x + (i % 2 ? 7 - a : a) * u, Y = y0 + (i % 2 ? 7 - b : b) * u; k ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      g.stroke();
    }
    const out = makeCanvas(w, h), o = out.getContext('2d');
    o.filter = 'blur(1.1px)'; o.drawImage(c, 0, 0); o.filter = 'none';
    return out;
  }
  function inner(g, path, k, blur, width, col) { // soft inner edge shading
    g.save(); g.clip(path); g.filter = `blur(${blur}px)`; g.lineWidth = width; g.strokeStyle = col; g.stroke(path); g.restore(); g.filter = 'none';
  }
  function bakePlastron() {
    const k = 2, w = 560 * k, h = 760 * k;
    const c = makeCanvas(w, h), g = c.getContext('2d');
    const bone = GL.bake(BONE, w, h, { K: k, OFF: [3.1, 1.7] });
    g.setTransform(k, 0, 0, k, 280 * k, 380 * k);
    g.save(); g.clip(PL); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bone, 0, 0); g.restore();
    g.setTransform(k, 0, 0, k, 280 * k, 380 * k);
    // broad thickness falloff toward the rim, then a tight darker rim
    inner(g, PL, k, 26 * k, 70, 'rgba(120,84,44,.32)');
    inner(g, PL, k, 5 * k, 10, 'rgba(92,60,30,.55)');
    // scute seams: grooves with a lit lower lip
    g.lineCap = 'round'; g.lineJoin = 'round';
    const seam = (pts, wdt) => {
      g.save(); g.clip(PL);
      g.strokeStyle = 'rgba(255,246,226,.45)'; g.lineWidth = wdt * .9; g.save(); g.translate(1.1, 1.3); polyline(g, pts); g.stroke(); g.restore();
      g.strokeStyle = 'rgba(104,72,42,.62)'; g.lineWidth = wdt; polyline(g, pts); g.stroke(); g.restore();
    };
    const r = mulberry(7);
    const wob = pts => { const out = []; for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < 6; s++) { const f = s / 6; out.push([lerp(pts[i][0], pts[i + 1][0], f) + (r() - .5) * 1.6, lerp(pts[i][1], pts[i + 1][1], f) + (r() - .5) * 1.6]); } out.push(pts[pts.length - 1]); return out; };
    SULCI.forEach((s, i) => { seam(wob(s), 2.4); seam(wob(s.map(([x, y]) => [-x, y + (i % 2 ? -7 : 7)])), 2.4); });
    const mid = []; for (let y = -334; y <= 306; y += 8) mid.push([Math.sin(y * .05) * 1.6 + (r() - .5) * 1.2, y]);
    seam(mid, 2.6);
    // bone sutures: finer, wavier, fainter than the seams
    const sut = (pts) => { const out = []; for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < 10; s++) { const f = s / 10; out.push([lerp(pts[i][0], pts[i + 1][0], f) + Math.sin(i * 10 + s) * 1.6, lerp(pts[i][1], pts[i + 1][1], f) + Math.cos(i * 7 + s * 2.3) * 1.6]); } return out; };
    g.save(); g.clip(PL); g.strokeStyle = 'rgba(120,88,56,.3)'; g.lineWidth = 1.2;
    for (const s of [[[0, -268], [-56, -214], [0, -146], [56, -214], [0, -268]], [[-276, 34], [-120, 46], [0, 38], [120, 50], [276, 32]], [[-200, 222], [-90, 232], [0, 226], [90, 236], [200, 220]], [[-180, -318], [-120, -270], [-56, -214]], [[180, -318], [120, -270], [56, -214]]]) { polyline(g, sut(s)); g.stroke(); }
    g.restore();
    // a soft polish highlight from the upper left
    g.save(); g.clip(PL); g.globalCompositeOperation = 'soft-light';
    const hl = g.createRadialGradient(-120, -200, 20, -60, -120, 520); hl.addColorStop(0, 'rgba(255,250,235,.55)'); hl.addColorStop(1, 'rgba(255,250,235,0)');
    g.fillStyle = hl; g.fillRect(-300, -400, 600, 800); g.restore();
    // lit upper-left rim
    g.save(); g.clip(PL); g.translate(2, 2.5); g.strokeStyle = 'rgba(255,248,230,.45)'; g.lineWidth = 3; g.stroke(PL); g.restore();
    const lv = [{ k, c }];
    for (let kk = k / 2; kk >= .12; kk /= 2) {
      const prev = lv[lv.length - 1].c, n = makeCanvas(Math.ceil(prev.width / 2), Math.ceil(prev.height / 2)), ng = n.getContext('2d');
      ng.imageSmoothingQuality = 'high'; ng.drawImage(prev, 0, 0, n.width, n.height); lv.push({ k: kk, c: n });
    }
    return lv;
  }
  function bakeShadow(path, k = .5) {
    const c = makeCanvas(640 * k, 840 * k), g = c.getContext('2d');
    g.filter = `blur(${14 * k}px)`; g.setTransform(k, 0, 0, k, 320 * k, 420 * k);
    g.fillStyle = 'rgba(6,12,9,.85)'; g.fill(path); g.filter = 'none';
    return c;
  }

  // incised stroke group, knife-cut: strokes taper at both ends; lit lower wall, shaded upper wall, groove, deep core.
  // f = cinnabar infill 0..1; returns the knife position while a stroke is being cut.
  function incise(g, strokes, x, y, S, p, f = 0, w = .085, lipA = .55) {
    const total = strokes.length, segs = []; let tip = null;
    strokes.forEach((st, i) => {
      const k = clamp(p * total - i); if (k <= 0) return;
      const pts = st.map(([a, b]) => [x + a * S, y + b * S]), cum = [0];
      for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
      const L = cum[cum.length - 1], Lk = L * k, W0 = S * w;
      const wid = q => W0 * Math.min(1, .3 + 2.8 * q / L, .3 + 2.8 * (L - q) / L);
      for (let j = 1; j < pts.length; j++) {
        if (cum[j - 1] >= Lk) break;
        const e = Math.min(1, (Lk - cum[j - 1]) / (cum[j] - cum[j - 1] || 1)), a = pts[j - 1];
        const bb = [lerp(a[0], pts[j][0], e), lerp(a[1], pts[j][1], e)];
        segs.push([a[0], a[1], bb[0], bb[1], wid(cum[j - 1]), wid(cum[j - 1] + (cum[j] - cum[j - 1]) * e)]);
        if (k < 1) tip = bb;
      }
    });
    if (!segs.length) return tip;
    const pass = (dx, dy, sc, col) => { g.beginPath(); for (const q of segs) ribbon(g, [q[0] + dx, q[1] + dy, q[2] + dx, q[3] + dy, q[4] * sc, q[5] * sc]); g.fillStyle = col; g.fill(); };
    const o = S * w;
    pass(o * .3, o * .35, 1.0, `rgba(255,248,232,${lipA})`);
    pass(-o * .12, -o * .14, .95, 'rgba(46,28,14,.45)');
    pass(0, 0, .8, mixHex('#4a321f', CIN, f, .96));
    pass(o * .05, o * .06, .3, mixHex('#25150b', '#6e1c12', f, .85));
    return tip;
  }
  function drawCrack(g, c, p, heat, alpha = 1) {
    const k1 = ease.out(clamp(p / .55)), k2 = ease.out(clamp((p - .3) / .5)), kh = clamp((p - .55) / .45);
    const lines = (wd) => {
      g.lineWidth = wd;
      g.beginPath(); partial(g, c.up, k1); partial(g, c.down, k1); partial(g, c.br, k2); g.stroke();
      if (kh > 0) { g.lineWidth = wd * .55; g.beginPath(); c.hairs.forEach(hh => { if ([k1, k1, k2][hh.src] >= hh.at) partial(g, hh.pts, kh); }); g.stroke(); }
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.save(); g.translate(1, 1.2); g.strokeStyle = `rgba(255,246,226,${.42 * alpha})`; lines(2.6); g.restore();
    g.strokeStyle = `rgba(50,28,14,${.93 * alpha})`; lines(3);
    if (heat > .005) {
      g.save(); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(255,80,16,${.14 * heat})`; lines(20);
      g.strokeStyle = `rgba(255,120,36,${.36 * heat})`; lines(8);
      g.strokeStyle = `rgba(255,214,140,${.95 * heat})`; lines(2.4);
      g.restore();
    }
  }
  function heatGlow(g, J, a, t, i) {
    if (a <= .002) return;
    const fl = .82 + .18 * vnoise(t * 9, i * 7.3);
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(J[0], J[1] + 8); g.scale(1, 1.55);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 58);
    gr.addColorStop(0, `rgba(255,178,92,${.72 * a * fl})`); gr.addColorStop(.18, `rgba(250,104,34,${.5 * a * fl})`);
    gr.addColorStop(.5, `rgba(200,52,14,${.2 * a * fl})`); gr.addColorStop(1, 'rgba(160,40,10,0)');
    g.fillStyle = gr; g.fillRect(-58, -58, 116, 116); g.restore();
  }
  function scorch(g, J, a) { // char showing through from the drilled hollow on the back
    if (a <= 0) return;
    g.save(); g.translate(J[0], J[1] + 10); g.scale(1, 1.8);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 20);
    gr.addColorStop(0, `rgba(58,32,14,${.7 * a})`); gr.addColorStop(.5, `rgba(104,62,28,${.38 * a})`); gr.addColorStop(1, 'rgba(130,90,46,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 20, 0, 6.283); g.fill(); g.restore();
  }

  // ---------------------------------------------------------------- archive fragments (plastrons, half plastrons, scapulae, pieces)
  const NV = 20, FK = .5;
  function fragShape(v, r) {
    if (v < 4) { const s = .84 + r() * .12; return fullOutline(HALF, s); }
    if (v < 8) { // half plastron split along the midline
      const side = v % 2 ? 1 : -1, pts = HALF.map(([x, y]) => [x, y]);
      for (let y = 290; y > -330; y -= 34) pts.push([(r() - .5) * 14, y]);
      return catmull(pts, 4).map(([x, y]) => [(x - 130) * side * 1.08, y]);
    }
    if (v < 13) { // ox scapula: socket knob, neck, flaring blade with a broken lower edge
      const side = v % 2 ? 1 : -1, s = .92 + r() * .14;
      const pts = [[-40, -366], [30, -372], [72, -344], [74, -300], [58, -262], [66, -200], [106, -90], [152, 40], [192, 180], [214, 306]];
      for (let x = 196; x > -190; x -= 44) pts.push([x, 318 + (r() - .5) * 64]);
      pts.push([-200, 290], [-208, 196], [-176, 60], [-124, -80], [-80, -190], [-68, -262], [-82, -300], [-78, -344]);
      return catmull(pts, 4).map(([x, y]) => [x * side * s, y * s]);
    }
    const n = 7 + Math.floor(r() * 4), R0 = 185 + r() * 110, pts = []; // broken piece
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + (r() - .5) * .5, rr = R0 * (.62 + r() * .42);
      pts.push([Math.cos(a) * rr * .9, Math.sin(a) * rr * 1.2]);
    }
    const out = [];
    pts.forEach((p, i) => { const q = pts[(i + 1) % n]; for (let s = 0; s < 4; s++) { const f = s / 4; out.push([lerp(p[0], q[0], f) + (s ? (r() - .5) * 18 : 0), lerp(p[1], q[1], f) + (s ? (r() - .5) * 18 : 0)]); } });
    return out;
  }
  function bakeFrag(v, bone, test) {
    const r = mulberry(1000 + v * 77);
    const pts = fragShape(v, r), path = toPath(pts);
    const w = 600 * FK, h = 800 * FK;
    const c = makeCanvas(w, h), g = c.getContext('2d');
    const red = makeCanvas(w, h), rg = red.getContext('2d');
    const T = () => g.setTransform(FK, 0, 0, FK, w / 2, h / 2);
    T(); g.filter = `blur(${7 * FK}px)`; g.save(); g.translate(10, 14); g.fillStyle = 'rgba(6,12,9,.7)'; g.fill(path); g.restore(); g.filter = 'none';
    g.save(); g.clip(path); g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bone, Math.floor(r() * (bone.width - w)), Math.floor(r() * (bone.height - h)), w, h, 0, 0, w, h);
    const tint = [[0, 0, 0, 0], [120, 92, 52, .22], [90, 84, 70, .2], [140, 100, 50, .3], [60, 40, 24, .18]][Math.floor(r() * 5)];
    g.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3]})`; g.globalCompositeOperation = 'multiply'; g.fillRect(0, 0, w, h);
    g.restore(); T();
    inner(g, path, FK, 18 * FK, 60, 'rgba(110,76,40,.35)');
    inner(g, path, FK, 4 * FK, 10, 'rgba(90,58,30,.55)');
    // a few heat cracks, glyph columns, and on a third of them cinnabar (drawn in the separate red layer)
    const inside = (x, y) => test.isPointInPath(path, x, y);
    const ncr = 1 + Math.floor(r() * 3);
    for (let i = 0; i < ncr; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const J = [(r() - .5) * 360, (r() - .5) * 520], L = 80 + r() * 60, dir = r() < .5 ? 1 : -1;
        if (!inside(J[0], J[1] - .4 * L) || !inside(J[0], J[1] + .7 * L) || !inside(J[0] + dir * .5 * L, J[1])) continue;
        const cr = { up: jag(J, [J[0], J[1] - .35 * L], 7, 2.4, v * 9 + i), down: jag(J, [J[0], J[1] + .65 * L], 10, 2.6, v * 9 + i + 3), br: jag(J, [J[0] + dir * .45 * L, J[1] - .08 * L], 6, 2, v * 9 + i + 5), hairs: [] };
        scorch(g, J, .9); drawCrack(g, cr, 1, 0, 1); break;
      }
    }
    const ncol = 2 + Math.floor(r() * 2);
    for (let i = 0; i < ncol; i++) {
      for (let tries = 0; tries < 14; tries++) {
        const n = 2 + Math.floor(r() * 4), S = 48, x = (r() - .5) * 380, y = (r() - .5) * 560;
        if (!inside(x, y) || !inside(x + S, y) || !inside(x, y + n * 56) || !inside(x + S, y + n * 56)) continue;
        for (let j = 0; j < n; j++) {
          const gl = GLY[GKEYS[Math.floor(r() * GKEYS.length)]];
          incise(g, gl, x, y + j * 56, S, 1, 0, .1, .45);
          rg.setTransform(FK, 0, 0, FK, w / 2, h / 2); rg.lineCap = 'round'; rg.lineJoin = 'round'; rg.strokeStyle = CIN; rg.lineWidth = S * .14;
          gl.forEach(st => { polyline(rg, st.map(([a, b]) => [x + a * S, y + j * 56 + b * S])); rg.stroke(); });
        }
        break;
      }
    }
    // lit rim
    g.save(); g.clip(path); g.translate(2, 2.5); g.strokeStyle = 'rgba(255,250,236,.35)'; g.lineWidth = 3; g.stroke(path); g.restore();
    const mips = (src) => { const out = [src]; let p = src; for (let i = 0; i < 2; i++) { const n = makeCanvas(Math.ceil(p.width / 2), Math.ceil(p.height / 2)), ng = n.getContext('2d'); ng.imageSmoothingQuality = 'high'; ng.drawImage(p, 0, 0, n.width, n.height); out.push(n); p = n; } return out; };
    return { img: mips(c), red: mips(red) };
  }

  // hero glyph: measure the real Noto Serif SC 卜 so the morph lands on the type
  const HFS = 560, HX = 1425;
  function measureBu() {
    const S = 800, c = makeCanvas(S, S), g = c.getContext('2d');
    font(g, HFS, '"Noto Serif SC"', 700); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('卜', 400, 620);
    const d = g.getImageData(0, 0, S, S).data, on = (x, y) => d[(y * S + x) * 4 + 3] > 128;
    let x0 = S, x1 = 0, y0 = S, y1 = 0; const colN = new Array(S).fill(0);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (on(x, y)) { colN[x]++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const ih = y1 - y0, stemCols = []; for (let x = x0; x <= x1; x++) if (colN[x] > ih * .5) stemCols.push(x);
    const vx0 = stemCols[0], vx1 = stemCols[stemCols.length - 1];
    let st = S, sb = 0; for (let y = 0; y < S; y++) for (let x = vx0; x <= vx1; x++) if (on(x, y)) { st = Math.min(st, y); sb = Math.max(sb, y); }
    const P = []; for (let y = 0; y < S; y++) for (let x = vx1 + 3; x < S; x++) if (on(x, y)) P.push([x, y]);
    let mx = 0, my = 0; P.forEach(([x, y]) => { mx += x; my += y; }); mx /= P.length; my /= P.length;
    let sxx = 0, syy = 0, sxy = 0; P.forEach(([x, y]) => { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); });
    const ang = .5 * Math.atan2(2 * sxy, sxx - syy); let ux = Math.cos(ang), uy = Math.sin(ang); if (ux < 0) { ux = -ux; uy = -uy; }
    let tmin = 1e9, tmax = -1e9; P.forEach(([x, y]) => { const t = (x - mx) * ux + (y - my) * uy; tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); });
    const spread = (a, b) => { let lo = 1e9, hi = -1e9; P.forEach(([x, y]) => { const t = (x - mx) * ux + (y - my) * uy; if (t >= a && t <= b) { const q = -(x - mx) * uy + (y - my) * ux; lo = Math.min(lo, q); hi = Math.max(hi, q); } }); return Math.max(4, hi - lo); };
    const L = tmax - tmin;
    const w0 = spread(tmin, tmin + L * .2) * .7, w1 = spread(tmax - L * .35, tmax);
    const cxI = (x0 + x1) / 2, cyI = (y0 + y1) / 2;
    // everything relative to the ink-box centre
    return {
      ax: 400 - cxI, ay: 620 - cyI, h: ih,
      stem: [(vx0 + vx1) / 2 - cxI, st - cyI, (vx0 + vx1) / 2 - cxI, sb - cyI, vx1 - vx0 + 1, (vx1 - vx0 + 1) * .82],
      dot: [mx + ux * (tmin + w0 * .5) - cxI, my + uy * (tmin + w0 * .5) - cyI, mx + ux * (tmax - w1 * .5) - cxI, my + uy * (tmax - w1 * .5) - cyI, w0, w1],
    };
  }
  function ribbon(g, s) {
    const [ax, ay, bx, by] = s, wa = Math.max(.6, s[4]), wb = Math.max(.6, s[5]), dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, an = Math.atan2(ny, nx);
    g.moveTo(ax + nx * wa / 2, ay + ny * wa / 2); g.lineTo(bx + nx * wb / 2, by + ny * wb / 2);
    g.arc(bx, by, wb / 2, an, an - Math.PI, true);
    g.lineTo(ax - nx * wa / 2, ay - ny * wa / 2);
    g.arc(ax, ay, wa / 2, an + Math.PI, an, true);
    g.closePath();
  }
  const oracleGeo = (x, cy, H, w) => { const top = cy - H / 2, yj = top + .35 * H; return [[x, top, x, top + H, w, w], [x, yj, x + .45 * H, yj - .08 * H, w, w]]; };
  // strokes for the morph are [ax, ay, bx, by, wStart, wMid, wEnd]
  const lerpGeo = (A, B, u) => A.map((s, i) => s.map((v, j) => lerp(v, B[i][j], u)));

  // ---------------------------------------------------------------- scene
  scene({
    id: ch.id, n: ch.n, dur: ch.dur,
    trans: { type: 'crack', d: 1.1, at: [.62, .62], glow: [1, .55, .2] },
    cues: [
      { t: .3, sfx: 'fire', v: .7 },
      ...CRACKS.map(c => ({ t: c.tc, sfx: 'crack' })),
      ...COLS.map(c => ({ t: c.t0, sfx: 'carve', v: .8 })),
      { t: 9.0, sfx: 'brush', v: .5 },
      { t: 10.35, sfx: 'carve' },
      { t: 11.0, sfx: 'whoosh', v: .5 },
      { t: 12.65, sfx: 'bell' },
      { t: 13.75, sfx: 'whoosh', v: .6 },
      { t: 14.9, sfx: 'wood', v: .5 },
      { t: 15.5, sfx: 'wood', v: .4 },
      { t: 16.0, sfx: 'chime', v: .5 },
    ],
    init() {
      patina = GL.bake(PATINA, 2112, 1188);
      band = GL.bake(RELIEF, W, 48, { M: thunderMask(W, 48) });
      plLv = bakePlastron();
      plShadow = bakeShadow(PL);
      const fb = GL.bake(BONE, 900, 900, { K: FK, OFF: [9.3, 4.1] });
      const test = makeCanvas(4, 4).getContext('2d');
      frags = []; for (let v = 0; v < NV; v++) frags.push(bakeFrag(v, fb, test));
      gBu = measureBu();
      // archive cells: variant, pose and the moment each one is laid down (once the camera has pulled back far enough)
      cells = [];
      const steps = []; for (let t = 13.6; t <= 21; t += .02) { const c = camAt(t); steps.push([t, c.x, c.y, 960 / c.z, 369 / c.z, c.z]); }
      for (let j = -14; j <= 14; j++) for (let i = -40; i <= 40; i++) {
        if (!i && !j) continue;
        const h1 = hash2(i + 91, j + 37), h2 = hash2(i * 3 + 5, j * 7 + 1), h3 = hash2(i - 17, j + 59), h4 = hash2(i + 211, j - 3);
        const v = Math.floor(h1 * NV), small = v >= 13;
        const x = i * PX + (h2 - .5) * 70, y = j * PY + (h3 - .5) * 70;
        let tv = 99;
        for (const [t, cx, cy, hw, hh, z] of steps) if (z < .52 && Math.abs(x - cx) < hw * 1.45 + 300 && Math.abs(y - cy) < hh * 1.45 + 400) { tv = t; break; }
        if (tv > 90) continue;
        const d = Math.hypot(i, j * 1.25);
        cells.push({ x, y, v, rot: (small ? (h4 - .5) * 1.6 : (h4 - .5) * .16), sc: small ? .95 + h2 * .3 : .92 + h3 * .1,
          ta: tv + d * .025 + h4 * .25, red: hash2(i * 13 + 3, j * 17 + 11) < 1 / 3, tr: 15.9 + d * .028 + h2 * .35 });
      }
      cells.sort((a, b) => a.ta - b.ta);
    },
    draw(ctx, t) {
      const c = camAt(t);
      // ---- bronze ground (slight parallax so the plastron sits on it)
      const sb = clamp(.985 + .03 * Math.log2(c.z), .93, 1.03);
      const bw = 2112 * sb, bh = 1188 * sb;
      ctx.drawImage(patina, CX - bw / 2 - clamp(c.x * .05, -40, 40), CY - bh / 2 - clamp(c.y * .05, -30, 30), bw, bh);

      // ---- world (clipped to the picture area)
      ctx.save();
      ctx.beginPath(); ctx.rect(0, P0, W, P1 - P0); ctx.clip();
      // archive
      if (t > 13.6) {
        const lvl = c.z >= .26 ? 0 : c.z >= .13 ? 1 : 2;
        const hw = 960 / c.z + 400, hh = 369 / c.z + 450;
        for (const e of cells) {
          if (e.ta > t) break;
          if (Math.abs(e.x - c.x) > hw || Math.abs(e.y - c.y) > hh) continue;
          const a = ease.out(clamp((t - e.ta) / .4)), s = c.z * e.sc * (1 + (1 - a) * .06);
          const co = Math.cos(e.rot) * s, si = Math.sin(e.rot) * s;
          ctx.setTransform(co, si, -si, co, CX + (e.x - c.x) * c.z, CY + (e.y - c.y) * c.z);
          ctx.globalAlpha = a;
          const f = frags[e.v];
          ctx.drawImage(f.img[lvl], -300, -400, 600, 800);
          if (e.red) { const ra = smooth(e.tr, e.tr + .45, t); if (ra > 0) { ctx.globalAlpha = a * ra; ctx.drawImage(f.red[lvl], -300, -400, 600, 800); } }
        }
        ctx.globalAlpha = 1;
      }
      // the plastron
      setWorld(ctx, c);
      ctx.globalAlpha = .75; ctx.drawImage(plShadow, -320 + 10, -420 + 16, 640, 840); ctx.globalAlpha = 1;
      let L = plLv[plLv.length - 1]; for (let i = plLv.length - 1; i >= 0; i--) { L = plLv[i]; if (plLv[i].k >= c.z * .95) break; }
      ctx.drawImage(L.c, -280, -380, 560, 760);
      ctx.save(); ctx.clip(PL);
      // heat from the hollows on the back, char, cracks with their ember line
      CRACKS.forEach((cr, i) => {
        const pre = i === 0 ? smooth(.1, .9, t) * (.55 + .45 * smooth(.9, 2.5, t)) : smooth(cr.tc - .9, cr.tc, t);
        const glow = pre * (1 - smooth(cr.tc + .15, cr.tc + 1.4, t));
        scorch(ctx, cr.J, smooth(cr.tc - (i ? .8 : 2.2), cr.tc + .4, t));
        heatGlow(ctx, cr.J, glow, t, i);
      });
      CRACKS.forEach((cr, i) => {
        const p = clamp((t - cr.tc) / .75); if (p <= 0) return;
        const heat = clamp((t - cr.tc) / .12) * Math.exp(-Math.max(0, t - cr.tc - .45) / .8);
        drawCrack(ctx, cr, p, heat);
      });
      // inscription, carved stroke by stroke, then filled with cinnabar
      let tip = null;
      for (const e of INSC) {
        const p = clamp((t - e.t0) / (e.t1 - e.t0)); if (p <= 0) continue;
        const f = e.num ? 0 : smooth(e.tf, e.tf + .35, t);
        const tp = incise(ctx, GLY[e.name], e.x, e.y, e.S, p, f, e.num ? .09 : .1);
        if (tp && p < 1) tip = tp;
      }
      if (!tip) { // between cuts the knife rests where the last stroke ended
        let last = null; for (const e of INSC) if (e.t0 <= t) last = e;
        if (last) { const st = GLY[last.name], q = st[st.length - 1], z = q[q.length - 1]; tip = [last.x + z[0] * last.S, last.y + z[1] * last.S]; }
      }
      // hero spotlight: the rest of the shell dims around the 卜 crack
      const C1 = CRACKS[0], geoBone = oracleGeo(C1.J[0], C1.J[1] + .15 * C1.L, C1.L, 0);
      const dim = smooth(9.7, 10.6, t) * (1 - smooth(13.5, 14.3, t));
      if (dim > 0) {
        const sg = ctx.createRadialGradient(C1.J[0] + 14, C1.J[1] + 18, 70, C1.J[0] + 14, C1.J[1] + 18, 250);
        sg.addColorStop(0, 'rgba(36,24,12,0)'); sg.addColorStop(1, `rgba(36,24,12,${.62 * dim})`);
        ctx.fillStyle = sg; ctx.fillRect(-300, -400, 600, 800);
      }
      // 刻兆: the hero crack itself is re-cut along its own jagged line, then cinnabar floods the groove
      const kz = clamp((t - 10.3) / .55);
      if (kz > 0) {
        const k1 = ease.out(clamp(kz / .65)), k2 = ease.out(clamp((kz - .45) / .55)), f = smooth(10.55, 10.95, t);
        const cut = (dx, dy, wd, col) => { ctx.save(); ctx.translate(dx, dy); ctx.lineWidth = wd; ctx.strokeStyle = col;
          ctx.beginPath(); partial(ctx, C1.up, k1); partial(ctx, C1.down, k1); partial(ctx, C1.br, k2); ctx.stroke(); ctx.restore(); };
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        cut(1.3, 1.6, 7.5, 'rgba(255,246,226,.55)');            // lit lower lip
        cut(0, 0, 8, 'rgba(58,22,10,.92)');                     // groove wall
        cut(.2, .3, 5.6, mixHex('#4a2a18', CIN, f, 1));          // floor, filling with cinnabar
        cut(-.5, -.6, 1.6, `rgba(120,30,16,${.75 * f})`);        // shaded upper wall inside the pigment
      }
      ctx.restore();
      // the bronze carving knife follows the stroke being cut; bone dust flicks off the tip
      const ka = win(t, 6.15, 9.2, .25, .25);
      if (ka > 0 && tip) {
        const [tx, ty] = tip, dx = .55, dy = -.83, nx = .83, ny = .55, BL = 92, HL = 170;
        const P = (s, o) => [tx + dx * s + nx * o, ty + dy * s + ny * o];
        const blade = (ox, oy) => { ctx.beginPath(); const a = P(0, 0), b = P(BL * .35, 4.2), c = P(BL, 4), d = P(BL, -4), e = P(BL * .35, -3);
          ctx.moveTo(a[0] + ox, a[1] + oy); [b, c, d, e].forEach(q => ctx.lineTo(q[0] + ox, q[1] + oy)); ctx.closePath(); };
        ctx.globalAlpha = ka;
        ctx.fillStyle = 'rgba(30,18,8,.25)'; blade(9, 11); ctx.fill();
        ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(30,18,8,.25)'; ctx.lineWidth = 12;
        ctx.beginPath(); ctx.moveTo(P(BL, 0)[0] + 9, P(BL, 0)[1] + 11); ctx.lineTo(P(HL, 0)[0] + 9, P(HL, 0)[1] + 11); ctx.stroke();
        const bg = ctx.createLinearGradient(...P(0, -4), ...P(0, 4));
        bg.addColorStop(0, '#4f4a32'); bg.addColorStop(.5, '#a99360'); bg.addColorStop(1, '#5e5236');
        ctx.fillStyle = bg; blade(0, 0); ctx.fill();
        ctx.strokeStyle = '#3a2a19'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(...P(BL - 2, 0)); ctx.lineTo(...P(HL, 0)); ctx.stroke();
        ctx.strokeStyle = 'rgba(150,120,80,.55)'; ctx.lineWidth = 1.6;
        for (let k = 0; k < 6; k++) { const s0 = BL + 8 + k * 8, a = P(s0, -5.5), b = P(s0 + 4, 5.5); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
        const fr = Math.floor(t * FPS);
        for (let k = 0; k < 6; k++) {
          const h = hash2(fr * 7 + k, 31), h2 = hash2(fr * 3 + k, 77), age = (k + h) / 6;
          ctx.fillStyle = `rgba(250,240,215,${.8 * (1 - age)})`;
          ctx.beginPath(); ctx.arc(tx + (h - .5) * 18 * (1 + age * 2), ty + 3 + h2 * 10 * (1 + age), .9 + h2 * 1.1, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // ---- the 卜: crack → oracle glyph → modern character (screen space)
      const ga = smooth(10.95, 11.05, t) * (1 - smooth(13.55, 14.15, t));
      if (ga > 0) {
        const hc = camAt(Math.min(t, 11.0));
        const toS = (x, y) => [CX + (x - hc.x) * hc.z, CY + (y - hc.y) * hc.z];
        const wb0 = 6 * hc.z;
        const G0 = geoBone.map(([ax, ay, bx, by], i) => { const a = toS(ax, ay), b = toS(bx, by); return [a[0], a[1], b[0], b[1], wb0 * (i ? .7 : .45), wb0, wb0 * .45]; });
        const B = gBu, cyT = CY;
        const [sx0, sy0, sx1, sy1, sw0, sw1] = B.stem, [dx0, dy0, dx1, dy1, dw0, dw1] = B.dot;
        const mod = [[sx0 + HX, sy0 + cyT, sx1 + HX, sy1 + cyT, sw0 * 1.02, sw0, sw1],
          [dx0 + HX, dy0 + cyT, dx1 + HX, dy1 + cyT, dw0, (dw0 + dw1) * .56, dw1]];
        const Hs = sy1 - sy0, wo = Hs * .05;
        const G1 = oracleGeo(HX + sx0, cyT + (sy0 + sy1) / 2, Hs, 0).map(([ax, ay, bx, by], i) => [ax, ay, bx, by, wo * (i ? .7 : .4), wo, wo * .4]);
        const u = ease.inOut(clamp((t - 11.0) / .85)), m = ease.inOut(clamp((t - 12.0) / .62));
        let geo = lerpGeo(G0, G1, u);
        const arc = Math.sin(Math.PI * u) * 70; geo = geo.map(q => [q[0], q[1] - arc, q[2], q[3] - arc, q[4], q[5], q[6]]);
        geo = lerpGeo(geo, mod, m);
        const lift = Math.sin(Math.PI * Math.min(1, u * 1.2)) * .4 + u * .6;
        const xf = smooth(12.5, 12.8, t);
        const fillGeo = (dx, dy, grow) => { ctx.beginPath(); geo.forEach(([ax, ay, bx, by, wa, wm, wb]) => {
          const mx = (ax + bx) / 2, my = (ay + by) / 2;
          ribbon(ctx, [ax + dx, ay + dy, mx + dx, my + dy, wa + grow, wm + grow]); ribbon(ctx, [mx + dx, my + dy, bx + dx, by + dy, wm + grow, wb + grow]); }); ctx.fill(); };
        ctx.save(); ctx.beginPath(); ctx.rect(0, P0, W, P1 - P0); ctx.clip();
        if (xf < 1) {
          ctx.globalAlpha = ga * (1 - xf);
          ctx.fillStyle = 'rgba(8,14,10,.42)'; fillGeo(9 * lift, 13 * lift, 2);          // shadow on the bronze
          ctx.globalAlpha = ga * (1 - xf) * (1 - m);
          ctx.fillStyle = '#5a170d'; fillGeo(0, 0, 3 + 2 * u);                            // the cut's dark wall
          ctx.globalAlpha = ga * (1 - xf);
          ctx.fillStyle = m < .5 ? mixHex(CIN, '#d39a52', m * 2) : mixHex('#d39a52', IV, m * 2 - 1); fillGeo(0, 0, 0); // cinnabar → bronze gold → ivory type
          // knife-cut V groove: a lit lower wall and a shaded upper wall meeting at a dark floor line
          const vg = ga * (1 - xf) * (1 - m) * u;
          if (vg > 0) {
            ctx.globalAlpha = vg * .75; ctx.fillStyle = '#ec8a68'; fillGeo(wo * .14, wo * .16, -wo * .52);
            ctx.globalAlpha = vg * .55; ctx.fillStyle = '#8c2414'; fillGeo(-wo * .16, -wo * .18, -wo * .6);
            ctx.globalAlpha = vg * .8; ctx.fillStyle = '#6a1a0e'; fillGeo(0, 0, -wo * .86);
          }
        }
        if (xf > 0) {
          const hb = cached('oracle-hero', () => makeCanvas(900, 760)), hg = hb.getContext('2d');
          hg.globalCompositeOperation = 'source-over'; hg.clearRect(0, 0, 900, 760);
          font(hg, HFS, '"Noto Serif SC"', 700); hg.fillStyle = IV; hg.textAlign = 'center';
          hg.fillText('卜', 450 + B.ax, 380 + B.ay);
          const sw = smooth(12.85, 13.55, t);   // a slow light passes across the finished character
          if (sw > 0 && sw < 1) {
            hg.globalCompositeOperation = 'source-atop';
            const lx = 450 - 330 + sw * 660, lg = hg.createLinearGradient(lx - 110, 0, lx + 110, 0);
            lg.addColorStop(0, 'rgba(255,252,238,0)'); lg.addColorStop(.5, 'rgba(255,252,238,.5)'); lg.addColorStop(1, 'rgba(255,252,238,0)');
            hg.fillStyle = lg; hg.fillRect(0, 0, 900, 760); hg.globalCompositeOperation = 'source-over';
          }
          ctx.globalAlpha = ga * xf;
          ctx.shadowColor = 'rgba(6,12,9,.55)'; ctx.shadowBlur = 26; ctx.shadowOffsetX = 9; ctx.shadowOffsetY = 13;
          ctx.drawImage(hb, HX - 450, cyT - 380);
          ctx.shadowColor = 'transparent';
        }
        ctx.restore();
      }

      // ---- frame: cast thunder-pattern bands, calm bronze foot for the subtitle
      ctx.save();
      const sh = (y, dir) => { const g = ctx.createLinearGradient(0, y, 0, y + dir * 26); g.addColorStop(0, 'rgba(5,10,8,.55)'); g.addColorStop(1, 'rgba(5,10,8,0)'); ctx.fillStyle = g; ctx.fillRect(0, Math.min(y, y + dir * 26), W, 26); };
      sh(P0, 1); sh(P1, -1);
      ctx.fillStyle = '#16211c'; ctx.fillRect(0, 0, W, 14); ctx.fillRect(0, P1 + 48, W, H - P1 - 48);
      ctx.globalAlpha = .55; ctx.drawImage(patina, 0, 0, 2112, 260, 0, P1 + 48, W, H - P1 - 48); ctx.globalAlpha = 1;
      const fg = ctx.createLinearGradient(0, P1 + 48, 0, H); fg.addColorStop(0, 'rgba(10,16,13,.5)'); fg.addColorStop(1, 'rgba(10,16,13,.72)');
      ctx.fillStyle = fg; ctx.fillRect(0, P1 + 48, W, H - P1 - 48);
      ctx.drawImage(band, 0, 14); ctx.drawImage(band, 0, P1);
      ctx.restore();

      // ---- title moment, then subtitles
      opener(ctx, t, ch, {
        ink: IV, sub: '#bcd0c0', accent: '#e2694b', x: 520, y: 430,
        title: { family: '"Noto Serif SC"', size: 150, weight: 900, sp: 34 },
        small: { family: '"Noto Serif SC"', size: 32, weight: 600 },
        num: { family: '"Noto Serif SC"', size: 64, weight: 700 },
        shadow: 'rgba(4,10,7,.6)',
        backdrop: (g, b, al) => { const gr = g.createRadialGradient(520, 440, 40, 520, 440, 520);
          gr.addColorStop(0, `rgba(10,18,14,${.5 * al})`); gr.addColorStop(1, 'rgba(10,18,14,0)'); g.fillStyle = gr; g.fillRect(0, P0, 1100, P1 - P0); },
      });
      subs(ctx, t, ch, { ink: IV, body: { family: '"Noto Serif SC"', size: 52, weight: 700 }, shadow: 'rgba(0,0,0,.6)' });
      grain(ctx, t, .05);
    },
  });
})();
