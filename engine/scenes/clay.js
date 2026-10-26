// 02 泥板 — Mesopotamian clay. Every tablet, wedge, pictograph, numeral and the pressed title live in ONE
// heightfield that a shader lights with a raking lamp from the upper left (normals + self-shadowing).
// The camera travels: wet clay (title) → early tablet (incise, then press) → account tablet → fire → museum shelf.
'use strict';
(() => {
  const ch = CH('clay');
  const CREAM = '#F5E8D2', INKD = '#3b2213';
  // heightmap encoding (one RGBA canvas, uploaded as a texture every frame)
  //   R = distance inside a body / DMAX (body height profile), G = surface detail (200 neutral, lower = impression,
  //   higher = raised lip), B = fired amount (0 raw … .8 fired, 1 = shelf plank)
  const DMAX = 30, HB = 20, HD = 9, HL = 2.5;
  const RS = 1, RW = Math.round(W * RS), RH = Math.round(H * RS);   // relief pass resolution (1 = full)

  // ---------- Euclidean distance transform (Felzenszwalb & Huttenlocher) ----------
  const BIG = 1e20;
  function dt1(f, n, d, v, z) {
    let k = 0; v[0] = 0; z[0] = -BIG; z[1] = BIG;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = BIG;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  }
  // distance from every pixel to the nearest pixel whose mask value equals `target`
  function edt(m, w, h, target) {
    const g = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = m[i] === target ? 0 : BIG;
    const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = g[y * w + x];
      dt1(f, h, d, v, z);
      for (let y = 0; y < h; y++) g[y * w + x] = d[y];
    }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) f[x] = g[y * w + x];
      dt1(f, w, d, v, z);
      for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
    }
    return out;
  }
  function maskOf(c) {
    const w = c.width, h = c.height, a = c.getContext('2d').getImageData(0, 0, w, h).data;
    const m = new Uint8Array(w * h), cov = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { cov[i] = a[i * 4 + 3]; m[i] = cov[i] > 127 ? 1 : 0; }
    return { m, cov, w, h };
  }

  // ---------- impression sprites ----------
  // dark: colour (255,0,255), alpha = depth/HD → draw with 'darken' (lowers G only)
  // light: colour (0,255,0), alpha = lip/HL   → draw with 'lighten' (raises G only)
  function impFromMask(m, w, h, ss, prof) {
    const din = edt(m, w, h, 0), dout = edt(m, w, h, 1);
    const dc = makeCanvas(w, h), lc = makeCanvas(w, h);
    const dk = dc.getContext('2d').createImageData(w, h), lt = lc.getContext('2d').createImageData(w, h);
    let best = -1, hx = 0, hy = 0;
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = (i / w) | 0;
      if (m[i]) {
        const d = (din[i] - .5) / ss;
        let dep = prof.r ? prof.depth * Math.sqrt(clamp(1 - Math.pow(1 - Math.min(d, prof.r) / prof.r, 2)))
          : Math.min(prof.depth, (d + .35) * prof.slope);
        if (prof.mod) dep *= prof.mod((x - w / 2) / ss, (y - h / 2) / ss);
        dk.data[i * 4] = 255; dk.data[i * 4 + 2] = 255; dk.data[i * 4 + 3] = Math.round(clamp(dep / HD) * 255);
        if (din[i] > best) { best = din[i]; hx = x; hy = y; }
      } else {
        const d = (dout[i] - .5) / ss;
        if (d < prof.lipW * 4) { lt.data[i * 4 + 1] = 255; lt.data[i * 4 + 3] = Math.round(clamp(prof.lip * Math.exp(-d / prof.lipW) / HL) * 255); }
      }
    }
    dc.getContext('2d').putImageData(dk, 0, 0); lc.getContext('2d').putImageData(lt, 0, 0);
    return { dark: dc, light: lc, w, h, ss, hx: (hx - w / 2) / ss, hy: (hy - h / 2) / ss };
  }
  function impSprite(bw, bh, ss, draw, prof) {
    const pad = 10, w = Math.ceil((bw + pad * 2) * ss), h = Math.ceil((bh + pad * 2) * ss);
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.setTransform(ss, 0, 0, ss, w / 2, h / 2); g.fillStyle = g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
    draw(g);
    const { m } = maskOf(c);
    return impFromMask(m, w, h, ss, prof);
  }
  // press an impression into the heightmap at world (x, y); k = press depth 0..1
  function stamp(g, sp, x, y, k, rot = 0) {
    if (k <= .002) return;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot);
    const w = sp.w / sp.ss, h = sp.h / sp.ss;
    g.globalAlpha = clamp(k);
    g.globalCompositeOperation = 'darken'; g.drawImage(sp.dark, -w / 2, -h / 2, w, h);
    g.globalCompositeOperation = 'lighten'; g.drawImage(sp.light, -w / 2, -h / 2, w, h);
    g.restore();
  }

  // ---------- body sprites (tablets, slab, fragments) ----------
  // shape(g) fills the outline; shape.edge(X, Y) may return an exact distance (world px) to the outline, or null
  function bodySprite(bw, bh, ss, shape, insc, fired, ip) {
    const pad = 22, w = Math.ceil((bw + pad * 2) * ss), h = Math.ceil((bh + pad * 2) * ss);
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.setTransform(ss, 0, 0, ss, w / 2, h / 2); g.fillStyle = '#fff'; shape(g);
    const { m, cov } = maskOf(c);
    const din = edt(m, w, h, 0);
    let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
    for (let i = 0; i < w * h; i++) if (m[i]) { const x = i % w, y = (i / w) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    let im = null, di = null, dO = null;
    if (insc) {
      const c2 = makeCanvas(w, h), g2 = c2.getContext('2d');
      g2.setTransform(ss, 0, 0, ss, w / 2, h / 2); g2.fillStyle = g2.strokeStyle = '#fff'; g2.lineCap = g2.lineJoin = 'round';
      insc(g2);
      im = maskOf(c2).m; for (let i = 0; i < w * h; i++) im[i] &= m[i];
      di = edt(im, w, h, 0); dO = edt(im, w, h, 1);
    }
    // body distance field, box-blurred twice: removes the stair-step ripples a binary mask leaves on long,
    // nearly straight edges (they read as teeth and creases in the raking light)
    const DF = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) DF[i] = cov[i] ? Math.max(0, din[i] - .5) / ss : 0;
    blurField(DF, w, h, Math.max(1, Math.round(1.6 * ss)), 2);
    if (shape.edge) for (let i = 0; i < w * h; i++) {
      if (!cov[i]) continue;
      const e = shape.edge((i % w + .5 - w / 2) / ss, (((i / w) | 0) + .5 - h / 2) / ss);
      if (e !== null) DF[i] = Math.max(0, e);
    }
    const out = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      if (!cov[i]) continue;
      const d = DF[i];
      let G = 200;
      if (im) {
        if (im[i]) G = 200 - Math.min(ip.depth, ((di[i] - .5) / ss + .35) * ip.slope) / HD * 200;
        else { const dd = (dO[i] - .5) / ss; if (dd < ip.lipW * 4) G = 200 + Math.min(55, ip.lip * Math.exp(-dd / ip.lipW) / HL * 55); }
        G *= .55 + .45 * clamp(d / 14);   // impressions soften toward the rounded edge
        if (G > 200 && d < 14) G = 200 + (G - 200) * clamp(d / 14);
      }
      const o = i * 4;
      out.data[o] = Math.min(255, d / DMAX * 255); out.data[o + 1] = G; out.data[o + 2] = fired * 255; out.data[o + 3] = cov[i];
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.putImageData(out, 0, 0);
    // fire mask (B only) for heating a tablet in place
    const mk = makeCanvas(w, h), mg = mk.getContext('2d'), md = mg.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { md.data[i * 4 + 2] = 255; md.data[i * 4 + 3] = cov[i]; }
    mg.putImageData(md, 0, 0);
    // baked cast shadow (B channel on the ground): mask pushed away from the upper-left lamp and blurred
    const M = Math.ceil(52 * ss), sc = makeCanvas(w + 2 * M, h + 2 * M), sg = sc.getContext('2d');
    sg.filter = `blur(${(9 * ss).toFixed(1)}px)`; sg.globalAlpha = .78;
    sg.drawImage(mk, M + 27 * ss, M + 22 * ss);
    return { c, mask: mk, shadow: sc, sm: M, w, h, ss, bw, bh, box: [(bx0 - w / 2) / ss, (by0 - h / 2) / ss, (bx1 - w / 2) / ss, (by1 - h / 2) / ss] };
  }
  // separable running-sum box blur of a float field, `it` iterations (≈ gaussian)
  function blurField(F, w, h, r, it) {
    const n = Math.max(w, h), tmp = new Float32Array(n);
    for (let k = 0; k < it; k++) {
      for (let y = 0; y < h; y++) {
        let acc = 0; const o = y * w;
        for (let x = -r; x <= r; x++) acc += F[o + clamp(x, 0, w - 1)];
        for (let x = 0; x < w; x++) { tmp[x] = acc / (2 * r + 1); acc += F[o + Math.min(w - 1, x + r + 1)] - F[o + Math.max(0, x - r)]; }
        for (let x = 0; x < w; x++) F[o + x] = tmp[x];
      }
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += F[clamp(y, 0, h - 1) * w + x];
        for (let y = 0; y < h; y++) { tmp[y] = acc / (2 * r + 1); acc += F[Math.min(h - 1, y + r + 1) * w + x] - F[Math.max(0, y - r) * w + x]; }
        for (let y = 0; y < h; y++) F[y * w + x] = tmp[y];
      }
    }
  }
  function drawBody(g, b, x, y, s = 1) {
    const w = b.w / b.ss * s, h = b.h / b.ss * s;
    g.drawImage(b.c, x - w / 2, y - h / 2, w, h);
  }
  function drawShadow(g, b, x, y, s = 1) {
    const w = (b.w + 2 * b.sm) / b.ss * s, h = (b.h + 2 * b.sm) / b.ss * s;
    g.drawImage(b.shadow, x - w / 2, y - h / 2, w, h);
  }
  // wobbly rounded-rectangle outline (hand-formed tablet)
  function pillow(w, h, r, wob, seed, n = 160) {
    return g => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        // superellipse
        const e = 2 / (r || 6);
        const x = Math.sign(ca) * Math.pow(Math.abs(ca), e) * w / 2, y = Math.sign(sa) * Math.pow(Math.abs(sa), e) * h / 2;
        const k = i * 160 / n;   // noise indexed by angle, so a denser outline keeps the same shape
        const nz = (vnoise(k * .07 + seed, seed * .7) - .5) * 2 * wob + (vnoise(k * .16 + seed * 3, 1.3) - .5) * wob * .12;
        const len = Math.hypot(x, y) || 1;
        pts.push([x + x / len * nz, y + y / len * nz]);
      }
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
    };
  }
  // the big wet slab of the title: rounded rectangle whose long lower edge (the only one on screen) is sampled
  // evenly with a slow hand-made undulation, so the lit rim has no polygon creases
  function slabShape(w, h, R, wob, seed) {
    const yb = x => h / 2 + (vnoise(x * .0032 + seed, 2.1) - .5) * 2 * wob + (vnoise(x * .011 + seed * 3, 5.3) - .5) * wob * .35;
    const fill = g => {
      g.beginPath(); g.moveTo(-w / 2, -h / 2 + R);
      g.arcTo(-w / 2, -h / 2, -w / 2 + R, -h / 2, R); g.arcTo(w / 2, -h / 2, w / 2, -h / 2 + R, R);
      g.lineTo(w / 2, h / 2 - R); g.quadraticCurveTo(w / 2, yb(w / 2 - R), w / 2 - R, yb(w / 2 - R));
      for (let x = w / 2 - R; x >= -w / 2 + R; x -= 6) g.lineTo(x, yb(x));
      g.quadraticCurveTo(-w / 2, yb(-w / 2 + R), -w / 2, h / 2 - R);
      g.closePath(); g.fill();
    };
    // exact distance to the lower edge (a binary-mask distance transform leaves 8-bit terraces along it)
    fill.edge = (X, Y) => {
      if (Math.abs(X) > w / 2 - R || Y < h / 2 - 2 * DMAX - 40) return null;
      const sl = (yb(X + 1) - yb(X - 1)) / 2;
      return (yb(X) - Y) / Math.sqrt(1 + sl * sl);
    };
    return fill;
  }
  // broken fragment: a tablet intersected with an angular, jagged polygon (some original rounded edge survives)
  function fragment(w, h, seed) {
    return g => {
      pillow(w, h, 5, 6, seed)(g);
      const r = mulberry(seed), n = 6 + ((r() * 3) | 0), a0 = r() * Math.PI * 2, V = [];
      for (let i = 0; i < n; i++) {
        const a = a0 + (i + (r() - .5) * .55) / n * Math.PI * 2, rr = .78 + r() * .5;
        V.push([Math.cos(a) * w / 2 * rr + (r() - .5) * w * .12, Math.sin(a) * h / 2 * rr + (r() - .5) * h * .12]);
      }
      g.save(); g.globalCompositeOperation = 'destination-in'; g.beginPath();
      V.forEach((p, i) => {
        const q = V[(i + 1) % n], nx = -(q[1] - p[1]), ny = q[0] - p[0], nl = Math.hypot(nx, ny) || 1;
        for (let j = 0; j < 10; j++) {
          const u = j / 10, jag = j ? (vnoise(i * 9 + j * .9, seed) - .5) * 16 : 0;
          const X = lerp(p[0], q[0], u) + nx / nl * jag, Y = lerp(p[1], q[1], u) + ny / nl * jag;
          (i || j) ? g.lineTo(X, Y) : g.moveTo(X, Y);
        }
      });
      g.closePath(); g.fill(); g.restore();
    };
  }
  const POOL = [0x12000, 0x1202d, 0x12038, 0x12040, 0x12041, 0x12049, 0x12055, 0x12072, 0x1207a, 0x1208a, 0x12097, 0x120b5,
    0x12100, 0x12116, 0x12129, 0x1213f, 0x12157, 0x121a0, 0x121aa, 0x121b7, 0x121f7, 0x121fb, 0x12220, 0x12228, 0x1238c,
    0x1222a, 0x1222c, 0x1223e, 0x1224c, 0x12261, 0x1228f, 0x12291, 0x12292, 0x12293, 0x122ad, 0x122d7, 0x122eb, 0x122fe,
    0x12305, 0x1230b, 0x12313, 0x1231d, 0x12326, 0x12328, 0x1235d, 0x12363, 0x12079, 0x120f2, 0x12217, 0x122ba, 0x121b3];
  // lines of neo-Assyrian signs with ruling between lines (decorative, generic)
  function inscribe(w, h, fs, seed, margin = 26) {
    return g => {
      const r = mulberry(seed);
      g.font = `${fs}px "Noto Sans Cuneiform"`; g.textBaseline = 'middle';
      const lh = fs * 1.42, x0 = -w / 2 + margin, x1 = w / 2 - margin;
      for (let y = -h / 2 + margin + lh / 2; y < h / 2 - margin - lh * .3; y += lh) {
        g.fillRect(x0 - 6, y + lh / 2 - .8, x1 - x0 + 12, 1.6);
        let x = x0 + r() * fs * .2;
        const end = r() < .12 ? lerp(x0, x1, .35 + r() * .4) : x1;
        while (x < end) {
          const s = String.fromCodePoint(POOL[(r() * POOL.length) | 0]);
          const adv = g.measureText(s).width;
          if (x + adv > end + fs * .2) break;
          g.fillText(s, x, y); x += adv + fs * (.1 + r() * .12);
        }
      }
    };
  }

  // ---------- world layout ----------
  // Layout rule: every shot keeps its subject above y≈840 on screen so the subtitles always sit on calm, dark ground.
  const SLAB = { x: 0, y: -1120, w: 2500, h: 1100 };   // its lower edge crosses the frame at y≈790 during the title
  const TITLE = { x: 0, y: -888 };          // baseline anchor of the pressed title
  const TA = { x: 0, y: 330, w: 560, h: 430 };
  const TB = { x: 1250, y: 360, w: 600, h: 640 };
  const HERO = { x: 2850, y: 330, w: 560, h: 740 };
  const ROWH = 860, PLANK = 44;
  // from card 2 on, the hero tablet's foot (= the museum's lowest shelf) is pinned on screen
  const FOOT = HERO.y + HERO.h / 2, ANCH = 11.5;
  const footY = z => 200 + 85 * inv(.9, .3, z);
  const heroY = z => FOOT - footY(z) / z;
  const KEYS = [ // t, x, y, zoom, dip
    [0, 0, -820, 1.0, 0],
    [2.45, 0, -826, 1.03, 0],
    [3.35, TA.x, TA.y + 20, 1.3, .36],
    [6.6, TA.x, TA.y + 20, 1.36, 0],
    [7.32, TB.x, TB.y + 150, 1.0, .22],
    [10.8, TB.x, TB.y + 150, 1.04, 0],
    [ANCH, HERO.x, heroY(.84), .84, .2],
    [16.15, HERO.x, heroY(.9), .9, 0],
    [20.3, HERO.x + 220, heroY(.3), .3, 0],
    [23.5, HERO.x + 250, heroY(.285), .285, 0],
  ];
  function cam(t) {
    let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1], e = ease.inOut(clamp((t - a[0]) / (b[0] - a[0])));
    const z = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), e)) * (1 - b[4] * Math.sin(Math.PI * e));
    return { x: lerp(a[1], b[1], e), y: t >= ANCH ? heroY(z) : lerp(a[2], b[2], e), z };
  }

  // ---------- schedules ----------
  // card 0: pointed reed incises three pictographs (barley, jar, head), then a wedge-cut reed presses the same signs
  const PICTO = {
    barley: [[[.5, 1], [.5, .04]], ...[.2, .37, .54, .71].flatMap(y => [[[.5, y + .1], [.22, y - .05]], [[.5, y + .1], [.78, y - .05]]])],
    jar: [[[.3, .07], [.7, .07]], [[.37, .07], [.39, .22], [.21, .37], [.16, .57], [.27, .79], [.5, .95], [.73, .79], [.84, .57], [.79, .37], [.61, .22], [.63, .07]], [[.22, .36], [.78, .36]]],
    head: [[[.3, .98], [.2, .72], [.18, .46], [.27, .22], [.44, .08], [.62, .1], [.74, .21], [.78, .35], [.92, .5], [.8, .55], [.84, .62], [.78, .67], [.8, .77], [.69, .85], [.66, .98]], [[.58, .37], [.68, .37]]],
  };
  const PS = 150, GROOVE = 7;
  const SIGNS = [['barley', -178], ['jar', 0], ['head', 178]].map(([k, dx]) => ({ k, x: TA.x + dx, y: TA.y - 96 }));
  const GLYPHS = [[0x122BA, -178], [0x12081, 0], [0x12295, 178]].map(([cp, dx]) => ({ cp, x: TA.x + dx, y: TA.y + 104 }));
  const INC0 = 3.25, INC1 = 4.78, PR0 = 5.32, PR1 = 6.55;
  let incTL = [];      // [{t0,t1,sign,stroke,pts(world),len}]
  let wedgeTL = [];    // [{t, x, y, sp, hx, hy}]
  let numTL = [];      // card 1 numerals
  const NUM0 = 7.36, NUM1 = 10.42;
  const CASES = [];
  // card 2: fire
  const F0 = 11.25, F1 = 15.9;
  let cracks = [];
  let shelf = [];
  let knot = null;

  // ---------- sprites ----------
  let SPR = {};
  let HM, hg, TMP, tg;

  // ---------- knot (shared with the transition) ----------
  function knotGeom() {
    const P = t => [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t) + 1.15];
    const raw = [];
    const a0 = Math.PI + .5, a1 = 3 * Math.PI - .5, S = P(a0), E = P(a1);
    [[5.6, -1.05], [4.0, -1.25], [2.4, -1.45], [1.1, -1.4], [.3, -1.05], [-.12, -.5]].forEach(([dx, dy]) => raw.push([S[0] + dx, S[1] + dy]));
    for (let i = 0; i <= 240; i++) raw.push(P(lerp(a0, a1, i / 240)));
    [[.12, -.5], [-.3, -1.05], [-1.1, -1.4], [-2.4, -1.45], [-4.0, -1.25], [-5.6, -1.05]].forEach(([dx, dy]) => raw.push([E[0] + dx, E[1] + dy]));
    // catmull-rom resample
    const pts = [];
    for (let i = 0; i < raw.length - 1; i++) {
      const p0 = raw[Math.max(0, i - 1)], p1 = raw[i], p2 = raw[i + 1], p3 = raw[Math.min(raw.length - 1, i + 2)];
      const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / .07));
      for (let j = 0; j < n; j++) {
        const u = j / n, u2 = u * u, u3 = u2 * u;
        const f = (a, b, c, d) => .5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
        pts.push([f(p0[0], p1[0], p2[0], p3[0]) * 36, f(p0[1], p1[1], p2[1], p3[1]) * 36 - 10]);
      }
    }
    pts.push([raw[raw.length - 1][0] * 36, raw[raw.length - 1][1] * 36 - 10]);
    // self-crossings → alternate over/under along the cord
    const X = [];
    const segX = (a, b, c, d) => {
      const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
      if (Math.abs(den) < 1e-9) return false;
      const u = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, v = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
      return u >= 0 && u < 1 && v >= 0 && v < 1;
    };
    for (let i = 0; i < pts.length - 1; i++) for (let j = i + 6; j < pts.length - 1; j++)
      if (segX(pts[i], pts[i + 1], pts[j], pts[j + 1]) && !X.some(c => Math.abs(c[0] - i) < 5 && Math.abs(c[1] - j) < 5)) X.push([i, j]);
    const enc = []; X.forEach((c, ci) => { enc.push([c[0], ci]); enc.push([c[1], ci]); });
    enc.sort((a, b) => a[0] - b[0]);
    const over = {}; enc.forEach(([idx, ci], k) => { if (k % 2 === 0 && over[ci] === undefined) over[ci] = idx; });
    X.forEach((c, ci) => { if (over[ci] === undefined) over[ci] = c[0]; });
    return { pts, X, over, wid: 30 };
  }
  function cordPiece(pts, a, b) {
    const p = new Path2D(); a = Math.max(0, a); b = Math.min(pts.length - 1, b);
    p.moveTo(pts[a][0], pts[a][1]); for (let i = a + 1; i <= b; i++) p.lineTo(pts[i][0], pts[i][1]);
    return p;
  }
  function cordLayers(g, pts, a, b, wid, cap) {
    const path = cordPiece(pts, a, b);
    g.lineCap = cap; g.lineJoin = 'round';
    g.strokeStyle = '#3e0c0e'; g.lineWidth = wid + 5; g.stroke(path);
    g.strokeStyle = '#97222a'; g.lineWidth = wid; g.stroke(path);
    g.save(); g.translate(-wid * .13, -wid * .15); g.strokeStyle = 'rgba(232,118,104,.5)'; g.lineWidth = wid * .34; g.stroke(path); g.restore();
    // S-twist: slanted ply marks
    g.strokeStyle = 'rgba(52,8,10,.55)'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath();
    let acc = 0;
    for (let i = Math.max(1, a); i <= Math.min(pts.length - 2, b); i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc < wid * .5) continue; acc = 0;
      const tx = pts[i + 1][0] - pts[i - 1][0], ty = pts[i + 1][1] - pts[i - 1][1], tl = Math.hypot(tx, ty) || 1;
      const ux = tx / tl, uy = ty / tl, nx = -uy, ny = ux, hw = wid * .42;
      g.moveTo(pts[i][0] + nx * hw - ux * wid * .22, pts[i][1] + ny * hw - uy * wid * .22);
      g.lineTo(pts[i][0] - nx * hw + ux * wid * .22, pts[i][1] - ny * hw + uy * wid * .22);
    }
    g.stroke();
  }
  function drawKnot(g, x, y, s, alpha, sh, blur) {
    const K = knot;
    g.save(); g.translate(x, y); g.scale(s, s);
    // cast shadow on the clay (light from the upper left)
    g.save(); g.globalAlpha = alpha * .45; g.filter = `blur(${(4 + sh * .25).toFixed(1)}px)`;
    g.translate(sh * .8, sh); g.strokeStyle = '#1e0e06'; g.lineWidth = K.wid + 2; g.lineCap = g.lineJoin = 'round';
    g.stroke(cordPiece(K.pts, 0, K.pts.length - 1)); g.restore();
    g.globalAlpha = alpha; if (blur > .3) g.filter = `blur(${blur.toFixed(1)}px)`;
    cordLayers(g, K.pts, 0, K.pts.length - 1, K.wid, 'round');
    const span = Math.ceil(K.wid * 1.25 / (36 * .07));
    K.X.forEach((c, ci) => { const o = K.over[ci]; if (o === c[0]) cordLayers(g, K.pts, o - span, o + span, K.wid, 'butt'); });
    // frayed ends
    g.restore();
  }

  // ---------- reed stylus (2D, drawn over the lit clay) ----------
  function reed(g, x, y, ang, kind, lift, alpha) {
    if (alpha <= 0) return;
    const r = 15, L = 1300, tilt = .3, h0 = 4 + lift * 34;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const sx = .78, sy = .62; // shadow direction (down-right)
    g.save(); g.globalAlpha = alpha;
    // shadow: tip shadow offset by the lift, back end further away (rod is tilted toward the camera)
    g.save(); g.lineCap = 'round';
    const T0 = [x + sx * h0, y + sy * h0], T1 = [x + ca * L + sx * (h0 + L * tilt), y + sa * L + sy * (h0 + L * tilt)];
    for (const [lw, al] of [[r * 3.4, .1], [r * 2.4, .13], [r * 1.5, .16]]) {
      g.strokeStyle = `rgba(28,14,6,${al * (1 - lift * .4)})`; g.lineWidth = lw;
      g.beginPath(); g.moveTo(T0[0], T0[1]); g.lineTo(T1[0], T1[1]); g.stroke();
    }
    g.restore();
    // rod in its own frame: +x from the tip toward the hand
    g.translate(x - sx * lift * 6, y - sy * lift * 6); g.rotate(ang);
    const lit = Math.sign(sa - ca) || 1; // +1 when the rod's +y side faces the upper-left lamp
    const gr = g.createLinearGradient(0, lit * r, 0, -lit * r);
    gr.addColorStop(0, '#f3e4b8'); gr.addColorStop(.18, '#dcc28a'); gr.addColorStop(.55, '#b4965e'); gr.addColorStop(.88, '#6f5630'); gr.addColorStop(1, '#4a3820');
    g.fillStyle = gr;
    const tipL = kind === 'point' ? 52 : kind === 'wedge' ? 26 : r;
    g.beginPath();
    if (kind === 'point') { g.moveTo(0, 0); g.lineTo(tipL, -r); g.lineTo(L, -r); g.lineTo(L, r); g.lineTo(tipL, r); g.closePath(); }
    else if (kind === 'wedge') { g.moveTo(0, -r * .15); g.lineTo(tipL, -r); g.lineTo(L, -r); g.lineTo(L, r); g.lineTo(12, r); g.closePath(); }
    else { g.moveTo(r, -r); g.lineTo(L, -r); g.lineTo(L, r); g.lineTo(r, r); g.arc(r, 0, r, Math.PI / 2, Math.PI * 1.5); g.closePath(); }
    g.fill();
    // reed nodes and fibres
    for (const nx0 of [330, 760]) {
      const ng = g.createLinearGradient(nx0 - 10, 0, nx0 + 10, 0);
      ng.addColorStop(0, 'rgba(70,50,22,0)'); ng.addColorStop(.5, 'rgba(70,50,22,.55)'); ng.addColorStop(1, 'rgba(70,50,22,0)');
      g.fillStyle = ng; g.fillRect(nx0 - 10, -r - .5, 20, r * 2 + 1);
    }
    g.strokeStyle = 'rgba(90,66,30,.22)'; g.lineWidth = 1;
    g.beginPath(); for (const fy of [-.55, -.2, .3, .65]) { g.moveTo(tipL + 8, fy * r); g.lineTo(L, fy * r); } g.stroke();
    if (kind === 'wedge') { // the oblique cut face
      g.fillStyle = '#ead7a4'; g.beginPath(); g.moveTo(0, -r * .15); g.lineTo(tipL, -r); g.lineTo(12, r); g.closePath(); g.fill();
      g.fillStyle = 'rgba(80,58,28,.65)'; g.beginPath(); g.ellipse(12, -1, 5, 3.2, -.6, 0, Math.PI * 2); g.fill();
    }
    if (kind === 'round') { g.fillStyle = 'rgba(255,240,205,.35)'; g.beginPath(); g.arc(r * .8, -r * .35, r * .45, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }

  // ---------- shaders ----------
  const MAIN = `
  uniform sampler2D HM; uniform vec3 CAM; uniform vec4 FX; uniform vec4 FX2; uniform float FL;
  const float HB=${HB}., HD=${HD}., HL=${HL};
  float hd(vec4 c){ float b=c.r; float g=c.g*255.;
    return HB*(1.-(1.-b)*(1.-b))+(g<200.?(g-200.)*(HD/200.):(g-200.)*(HL/55.)); }
  void main(){
    ivec2 ip=ivec2(gl_FragCoord.xy), mx=ivec2(R)-1;
    float z=CAM.z;
    vec4 c=texelFetch(HM,ip,0);
    float h0=hd(c);
    float hx=(hd(texelFetch(HM,min(ip+ivec2(1,0),mx),0))-hd(texelFetch(HM,max(ip-ivec2(1,0),ivec2(0)),0)))*.5*z;
    float hy=(hd(texelFetch(HM,min(ip+ivec2(0,1),mx),0))-hd(texelFetch(HM,max(ip-ivec2(0,1),ivec2(0)),0)))*.5*z;
    vec2 sp=vec2(uv.x,1.-uv.y)*R; vec2 wp=(sp-.5*R)/z+CAM.xy;
    float n1=vn(wp*.0105), n2=vn(wp*vec2(.05,.11)+vec2(0.,sin(wp.x*.004)*3.));
    vec2 mp=wp*.13*max(1.,.5/z);      // grit texture on the clay only, features >= ~7 px (keeps PNG encoding cheap)
    float n3=vn(mp), n4=vn(mp.yx+7.3);
    float body=smoothstep(.0,.07,c.r);
    float rough=.11*body;
    vec3 N=normalize(vec3(-hx+(n3-.5)*rough, -hy+(n4-.5)*rough, 1.));
    vec3 L=normalize(vec3(-.66,.54,.5));
    // soft self-shadow: march the heightfield toward the lamp
    vec2 ld=normalize(L.xy); float tE=L.z/length(L.xy);
    float sh=1., s=1.6;
    for(int i=0;i<3;i++){ float hh=hd(texelFetch(HM,clamp(ip+ivec2(ld*s),ivec2(0),mx),0)); float ray=h0+s/z*tE;
      sh=min(sh, smoothstep(-.12,.12,(ray-hh)/(s/z))); s*=2.4; }
    sh*=1.-.85*c.b*(1.-body);   // baked cast shadow of the bodies on the ground
    // albedo: damp ground / raw clay / fired clay / shelf plank / museum wall
    vec3 raw=vec3(.73,.55,.37)*(.92+.12*n1)*(.95+.08*n2);
    vec3 tab=raw;
    float fired=0.;
    if(c.b>.004 && c.r>.0){
      fired=clamp(c.b/.8,0.,1.);
      float tone=clamp((c.b-.3)/.5,0.,1.);
      vec3 fir=mix(vec3(.6,.49,.38),vec3(.61,.36,.22),tone*(.55+.45*n1));
      fir=mix(fir,vec3(.4,.37,.34),.5*smoothstep(.5,.85,vn(wp*.0065+3.)));
      fir*=.9+.14*n2;
      tab=mix(raw,fir,fired);
      if(c.b>.86) tab=mix(tab,vec3(.42,.31,.21)*(.8+.3*vn(vec2(wp.x*.004,wp.y*.2))),smoothstep(.9,.97,c.b));
    }
    vec3 ground=vec3(.34,.23,.15)*(.78+.32*n1)*(.9+.14*n2);
    ground=mix(ground,vec3(.13,.095,.075)*(.75+.5*n1),FX.z);
    ground=mix(ground,vec3(.29,.27,.25)*(.9+.12*n1)*(.96+.05*n2),FX.w);
    vec3 alb=mix(ground,tab,body);
    float cav=clamp((200.-c.g*255.)/200.,0.,1.);
    float dif=max(dot(N,L),0.);
    vec3 lc=mix(vec3(1.1,.98,.82),vec3(1.02,1.,.98),FX.w);
    vec3 col=alb*(vec3(.36,.34,.33)*(.55+.45*N.z)*(1.-cav*.5) + lc*1.3*dif*sh*(1.-.45*FX.x));
    vec3 Hv=normalize(L+vec3(0.,0.,1.));
    col+=pow(max(dot(N,Hv),0.),42.)*sh*FX2.x*.28*vec3(1.,.93,.8)*(1.-fired)*body;
    // firelight from below the frame
    if(FX.x>0.){
      vec3 Lf=normalize(vec3((FX.y-uv.x)*R.x/R.y,-.3-uv.y,.42));
      float I=FX.x*(.8+.35*FX2.z)*exp(-uv.y*1.5);
      col+=alb*vec3(1.75,.72,.24)*max(dot(N,Lf),0.)*I*1.15+vec3(.42,.13,.02)*I*.3*(1.-uv.y);
      if(FX2.w>0. && uv.y<.55){ float em=smoothstep(.7,.82,fbm3(wp*.035+vec2(0.,T*.05)))*(1.-body)*FX2.w*smoothstep(.55,.25,uv.y);
        col+=vec3(1.,.36,.05)*em*em*(.55+.45*FX2.z)*.7; }
    }
    vec2 q=(uv-.5)*vec2(1.,.82); col*=1.-dot(q,q)*.95;
    col*=1.08-.22*smoothstep(.15,1.25,length((uv-vec2(.25,.9))*vec2(1.78,1.)));   // the lamp's falloff
    col*=1.-.4*smoothstep(.3,.0,uv.y);
    // flames licking up from below (screen-blended), dimmed behind the subtitle
    if(FL>0. && uv.y<.62){
      vec2 p=vec2(uv.x*R.x/R.y,uv.y);
      float d=fbm3(vec2(p.x*3.,p.y*2.2-T*1.7));
      float d2=vn(vec2(p.x*9.,p.y*6.-T*3.6));
      float x=p.x*4.+(d-.5)*1.7;
      float tong=.5+.5*sin(x*2.3+1.7*sin(x*.6+T*1.1)+T*.8);
      float side=1.-.45*smoothstep(.34,.1,abs(uv.x-.5));
      float fh=FL*side*(.14+.34*tong*tong+.16*vn(vec2(p.x*1.3+T*.3,T*.5)));
      float f=clamp(1.-(uv.y-(d-.5)*.09)/max(fh,.001),0.,1.);
      f=smoothstep(.04,.9,f*(.65+.7*d2*d));
      vec3 fc=vec3(.42,.05,.01)*smoothstep(.0,.3,f);
      fc=mix(fc,vec3(1.,.4,.06),smoothstep(.22,.6,f));
      fc=mix(fc,vec3(1.,.82,.42),smoothstep(.66,.97,f));
      float sub=smoothstep(.0,.07,.24-uv.y)*smoothstep(.0,.12,.33-abs(uv.x-.5));
      fc*=1.-.9*sub;
      col=1.-(1.-col)*(1.-fc);
      col*=1.-.38*sub*FL;     // smoke-dark bed under the subtitle while the fire burns
    }
    col*=FX2.y;
    O=vec4(col,1.);
  }`;
  const PRESS = `
  uniform sampler2D A; uniform sampler2D B; uniform float P;
  void main(){
    vec2 asp=vec2(R.x/R.y,1.);
    vec2 q=(uv-.5)*asp; float r=length(q); vec2 dir=q/max(r,1e-4);
    float on=step(.3,P), u=clamp((P-.3)/.7,0.,1.);
    float rad=mix(.13,1.2,1.-pow(1.-u,2.4));
    float w=.03+.035*u, x=(r-rad)/w, amp=on*(1.-u*.55);
    float bump=exp(-x*x*1.7)*amp;
    float db=-3.4*x*exp(-x*x*1.7)/w*amp;
    float wob=1.+.04*(vn(vec2(atan(q.y,q.x)*3.,1.))-.5);
    float m=smoothstep(rad*wob+.003,rad*wob-.003,r)*on;
    vec3 a=texture(A,uv-dir*bump*.01/asp).rgb;
    vec3 b=texture(B,uv-dir*bump*.016/asp).rgb;
    vec3 col=mix(a,b,m);
    vec3 n=normalize(vec3(-dir*db*.03,1.));
    vec3 L=normalize(vec3(-.66,.54,.5));
    float shade=dot(n,L)/L.z;
    col*=mix(1.,clamp(shade,.35,1.9),smoothstep(.0,.25,bump));
    col+=vec3(.9,.78,.6)*max(shade-1.,0.)*.12*bump;
    O=vec4(col,1.);
  }`;

  TRANS.clay_press = (ctx, A, B, p) => {
    ctx.drawImage(GL.run(PRESS, W, H, { A, B, P: p }), 0, 0);
    // the knot falls into the wet clay at frame centre, presses, then lifts away toward the camera
    const fall = ease.in(clamp(p / .3)), lift = ease.in(clamp((p - .5) / .36));
    const s = p < .3 ? lerp(1.85, 1.0, fall) : lerp(.985, 1.75, lift);
    const sh = p < .3 ? lerp(70, 4, fall) : lerp(3, 90, lift);
    const al = clamp(p / .07);
    if (lift < 1) drawKnot(ctx, W / 2 - lift * 140, H / 2 - lift * 900, s, al, sh, p < .3 ? (1 - fall) * 3 : lift * 5);
  };

  // ---------- init ----------
  function init() {
    HM = makeCanvas(RW, RH); hg = HM.getContext('2d');
    TMP = makeCanvas(700, 700); tg = TMP.getContext('2d');
    knot = knotGeom();
    // bodies
    // full resolution + a dense outline: its long lower edge is seen up close during the title
    SPR.slab = bodySprite(SLAB.w, SLAB.h, 1, slabShape(SLAB.w, SLAB.h, 160, 16, 3.1), null, 0);
    SPR.A = bodySprite(TA.w, TA.h, 1.5, pillow(TA.w, TA.h, 4.2, 13, 7.7), g => g.fillRect(-TA.w / 2 + 34, -2, TA.w - 68, 3.2), 0,
      { depth: 3.2, slope: 1.1, lip: .5, lipW: 1.5 });
    SPR.B = bodySprite(TB.w, TB.h, 1.5, pillow(TB.w, TB.h, 4.4, 14, 11.3), g => {
      const x0 = -TB.w / 2 + 32, x1 = TB.w / 2 - 32, y0 = -TB.h / 2 + 34, y1 = TB.h / 2 - 34;
      g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(0, y0 + 6); g.lineTo(2, y1 - 6);
      for (const yy of [-TB.h / 6 + 6, TB.h / 6 + 4]) { g.moveTo(x0 + 4, yy); g.lineTo(x1 - 4, yy + 2); }
      g.stroke();
      CASES.forEach(cs => { // pre-incised commodity signs: barley ear (ŠE) and the sheep sign (UDU, circle with cross)
        const sx = cs.x - TB.x + 82, sy = cs.y - TB.y;
        if (cs.sign === 'barley') {
          g.lineWidth = 4.4; g.beginPath();
          PICTO.barley.forEach(st => st.forEach((p, i) => { const X = sx + (p[0] - .5) * 70, Y = sy + (p[1] - .5) * 104; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }));
          g.stroke();
        } else {
          g.lineWidth = 4.4; g.beginPath(); g.arc(sx, sy, 34, 0, Math.PI * 2); g.moveTo(sx - 34, sy); g.lineTo(sx + 34, sy); g.moveTo(sx, sy - 34); g.lineTo(sx, sy + 34); g.stroke();
        }
      });
    }, 0, { depth: 3.4, slope: 1.1, lip: .55, lipW: 1.5 });
    SPR.hero = bodySprite(HERO.w, HERO.h, 1.25, pillow(HERO.w, HERO.h, 6, 8, 19.9), inscribe(HERO.w, HERO.h, 26, 2600, 30), 0,
      { depth: 3.6, slope: 1.05, lip: .45, lipW: 1.2 });
    // shelf variants: whole tablets and broken fragments, all fired
    const r = mulberry(912);
    const VAR = [];
    const sizes = [[300, 400], [250, 320], [360, 470], [220, 290], [420, 540], [340, 280], [280, 380], [240, 250], [380, 330]];
    sizes.forEach(([w, h], i) => VAR.push(bodySprite(w, h, .7, pillow(w, h, 5 + (i % 3), 7, 30 + i), inscribe(w, h, 19 + (i % 3) * 2, 700 + i, 22), .38 + r() * .42,
      { depth: 3, slope: 1, lip: .4, lipW: 1.2 })));
    for (let i = 0; i < 8; i++) { const w = 240 + r() * 220, h = 260 + r() * 260;
      VAR.push(bodySprite(w, h, .7, fragment(w, h, 50 + i * 7), inscribe(w, h, 19 + (i % 3) * 2, 800 + i, 22), .35 + r() * .45, { depth: 3, slope: 1, lip: .4, lipW: 1.2 })); }
    SPR.var = VAR;
    // shelf layout around the hero tablet (appears only in the museum)
    shelf = [];
    const top0 = HERO.y + HERO.h / 2;
    for (let k = -3; k <= 0; k++) {   // the hero's shelf is the lowest one: the wall below it stays calm for the subtitle
      const py = top0 + k * ROWH;
      const place = (x, dir) => {
        while (Math.abs(x - HERO.x) < 4300) {
          const v = VAR[(r() * VAR.length) | 0], [b0, b1, b2, b3] = v.box;
          const sc = Math.min(.82 + r() * .4, (ROWH - PLANK - 100) / (b3 - b1));
          const cx = dir > 0 ? x - b0 * sc : x - b2 * sc;
          shelf.push({ v, x: cx, y: py - b3 * sc - 1, s: sc });
          x = dir > 0 ? cx + b2 * sc + 30 + r() * 70 : cx + b0 * sc - 30 - r() * 70;
        }
      };
      if (k === 0) { place(HERO.x - HERO.w / 2 - 60, -1); place(HERO.x + HERO.w / 2 + 60, 1); }
      else { const x0 = HERO.x - 260 + r() * 300; place(x0, -1); place(x0 + 40 + r() * 60, 1); }
    }
    SPR.planks = [-3, -2, -1, 0].map(k => top0 + k * ROWH);

    // card 0 pictographs: incised grooves (round section)
    incTL = [];
    const strokesW = SIGNS.map(sg => PICTO[sg.k].map(st => st.map(p => [sg.x + (p[0] - .5) * PS, sg.y + (p[1] - .5) * PS])));
    SIGNS.forEach((sg, i) => {
      sg.sp = impSprite(PS + 20, PS + 20, 2, g => { g.lineWidth = GROOVE; PICTO[sg.k].forEach(st => { g.beginPath(); st.forEach((p, j) => { const X = (p[0] - .5) * PS, Y = (p[1] - .5) * PS; j ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); }); },
        { r: GROOVE / 2, depth: 4.2, lip: 1.0, lipW: 2.2 });
    });
    let total = 0; const items = [];
    strokesW.forEach((sts, si) => sts.forEach((pts, k) => {
      let len = 0; for (let j = 1; j < pts.length; j++) len += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
      items.push({ si, k, pts, len }); total += len;
    }));
    const gap = .055, span = INC1 - INC0 - gap * (items.length - 1);
    let tt = INC0;
    items.forEach(it => { it.t0 = tt; it.t1 = tt + span * it.len / total; tt = it.t1 + gap; incTL.push(it); });
    // card 0 wedges: connected components of real Noto Sans Cuneiform glyphs, pressed one by one
    wedgeTL = [];
    const comps = [];
    GLYPHS.forEach(gl => {
      const ss = 2, fs = 146, w = 220 * ss, h = 220 * ss;
      const c = makeCanvas(w, h), g = c.getContext('2d');
      g.font = `${fs * ss}px "Noto Sans Cuneiform"`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const s = String.fromCodePoint(gl.cp), mw = g.measureText(s).width;
      const sc = Math.min(1, (168 * ss) / mw);
      g.setTransform(sc, 0, 0, sc, w / 2, h / 2); g.fillStyle = '#fff'; g.fillText(s, 0, 0);
      const { m } = maskOf(c);
      const lab = new Int32Array(w * h).fill(-1); let nl = 0; const stack = [];
      for (let i = 0; i < w * h; i++) {
        if (!m[i] || lab[i] >= 0) continue;
        let x0 = w, y0 = h, x1 = 0, y1 = 0, cnt = 0;
        stack.push(i); lab[i] = nl;
        while (stack.length) {
          const j = stack.pop(), x = j % w, y = (j / w) | 0; cnt++;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
            const q = Y * w + X; if (m[q] && lab[q] < 0) { lab[q] = nl; stack.push(q); }
          }
        }
        if (cnt > 30) comps.push({ gl, id: nl, x0, y0, x1, y1, lab, w, h, ss });
        nl++;
      }
    });
    comps.forEach(cp => {
      const pad = 14, bw = cp.x1 - cp.x0 + 1 + pad * 2, bh = cp.y1 - cp.y0 + 1 + pad * 2;
      const m = new Uint8Array(bw * bh);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const X = cp.x0 - pad + x, Y = cp.y0 - pad + y;
        if (X >= 0 && Y >= 0 && X < cp.w && Y < cp.h && cp.lab[Y * cp.w + X] === cp.id) m[y * bw + x] = 1;
      }
      const sp = impFromMask(m, bw, bh, cp.ss, { depth: 5.2, slope: 1.25, lip: .9, lipW: 1.8 });
      const ox = (cp.x0 - pad + bw / 2 - cp.w / 2) / cp.ss, oy = (cp.y0 - pad + bh / 2 - cp.h / 2) / cp.ss;
      wedgeTL.push({ sp, x: cp.gl.x + ox, y: cp.gl.y + oy, hx: cp.gl.x + ox + sp.hx, hy: cp.gl.y + oy + sp.hy, gi: GLYPHS.indexOf(cp.gl) });
    });
    wedgeTL.sort((a, b) => a.gi - b.gi || a.hx - b.hx || a.hy - b.hy);
    wedgeTL.forEach((wd, i) => { wd.t = PR0 + (PR1 - PR0) * i / Math.max(1, wedgeTL.length - 1); });

    // card 1: account tablet cases, numerals pressed with the round end of the stylus
    SPR.numO = impSprite(42, 42, 2, g => { g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill(); }, { r: 18, depth: 7.5, lip: 1.2, lipW: 2.6 });
    SPR.numD = impSprite(36, 50, 2, g => { g.beginPath(); g.moveTo(-9, -22); g.lineTo(-9, 22); g.ellipse(-9, 0, 24, 22, 0, Math.PI / 2, -Math.PI / 2, true); g.closePath(); g.fill(); },
      { r: 14, depth: 6.8, lip: 1.1, lipW: 2.4, mod: (x) => .62 + .38 * clamp((x + 9) / 22) });
    numTL = [];
    CASES.forEach(cs => cs.nums.forEach((k, j) => {
      const col = j % 3, row = (j / 3) | 0;
      numTL.push({ k, x: cs.x - 100 + col * 46, y: cs.y - 30 + row * 58 + (col % 2) * 4 });
    }));
    numTL.forEach((n, i) => { n.t = NUM0 + (NUM1 - NUM0) * Math.pow(i / (numTL.length - 1), .9); });
    // card 2: cracks that open as the tablet fires
    const rc = mulberry(612);
    cracks = [];
    const starts = [[-.5, .3, 1, -.2], [.5, -.12, -1, .1], [.1, .5, -.1, -1], [-.5, -.36, 1, .3], [.5, .38, -1, -.4]];
    starts.forEach(([sx, sy, dx, dy], i) => {
      const pts = [[HERO.x + sx * HERO.w, HERO.y + sy * HERO.h]];
      let a = Math.atan2(dy, dx), len = 150 + rc() * 170;
      for (let d = 0; d < len; d += 12) { a += (rc() - .5) * .9; const p = pts[pts.length - 1]; pts.push([p[0] + Math.cos(a) * 12, p[1] + Math.sin(a) * 12]); }
      cracks.push({ pts, t0: 13.3 + i * .32, d: .55 + rc() * .3, w: 3.4 - i * .25 });
    });
  }
  // account-tablet cases (2 columns × 3 rows): numerals then the pre-incised commodity sign
  [[['O', 'O', 'D', 'D', 'D'], 'barley'], [['O', 'D', 'D', 'D'], 'sheep'], [['O', 'O', 'O', 'D'], 'sheep'],
   [['D', 'D', 'D', 'D', 'D'], 'barley'], [['O', 'O', 'D'], 'barley'], [['O', 'O', 'O', 'D', 'D'], 'sheep']].forEach(([nums, sign], i) => {
    const col = i % 2, row = (i / 2) | 0;
    CASES.push({ nums, sign, x: TB.x + (col ? 150 : -150) - 8, y: TB.y + (row - 1) * (TB.h / 3 - 4) });
  });

  // ---------- per-frame helpers ----------
  function stylusState(t) {
    // returns {x, y (world), kind, lift, alpha}
    const off = (x, y) => [x + 520, y - 380];
    if (t < INC1 + .22) {
      const first = incTL[0];
      if (t < first.t0) { const u = smooth(first.t0 - .4, first.t0, t), [ox, oy] = off(first.pts[0][0], first.pts[0][1]);
        return { x: lerp(ox, first.pts[0][0], u), y: lerp(oy, first.pts[0][1], u), kind: 'point', lift: 1 - u, alpha: smooth(first.t0 - .4, first.t0 - .22, t) }; }
      for (let i = 0; i < incTL.length; i++) {
        const it = incTL[i];
        if (t <= it.t1) {
          if (t >= it.t0) { const p = pathAt(it.pts, (t - it.t0) / (it.t1 - it.t0)); return { x: p[0], y: p[1], kind: 'point', lift: 0, alpha: 1 }; }
          const pv = incTL[i - 1], a = pv.pts[pv.pts.length - 1], b = it.pts[0], u = (t - pv.t1) / (it.t0 - pv.t1);
          return { x: lerp(a[0], b[0], ease.inOut(u)), y: lerp(a[1], b[1], ease.inOut(u)), kind: 'point', lift: Math.sin(Math.PI * u) * .55, alpha: 1 };
        }
      }
      const last = incTL[incTL.length - 1], e = last.pts[last.pts.length - 1], u = smooth(INC1 + .02, INC1 + .22, t), [ox, oy] = off(e[0], e[1]);
      return { x: lerp(e[0], ox, u), y: lerp(e[1], oy, u), kind: 'point', lift: u, alpha: 1 - smooth(INC1 + .1, INC1 + .22, t) };
    }
    if (t < 6.95) return pressState(t, wedgeTL, 'wedge', .03);
    return pressState(t, numTL, 'round', .03);
  }
  function pressState(t, tl, kind, dwell) {
    const f = tl[0], l = tl[tl.length - 1];
    if (t < f.t) { const u = smooth(f.t - .38, f.t, t), [ox, oy] = [(f.hx ?? f.x) + 520, (f.hy ?? f.y) - 380];
      return { x: lerp(ox, f.hx ?? f.x, u), y: lerp(oy, f.hy ?? f.y, u), kind, lift: 1 - u, alpha: smooth(f.t - .38, f.t - .2, t) }; }
    if (t > l.t + dwell) { const u = smooth(l.t + dwell, l.t + .4, t), x = l.hx ?? l.x, y = l.hy ?? l.y;
      return { x: lerp(x, x + 520, u), y: lerp(y, y - 380, u), kind, lift: u, alpha: 1 - smooth(l.t + .2, l.t + .4, t) }; }
    let i = 0; while (i < tl.length - 1 && t > tl[i + 1].t) i++;
    const a = tl[i], b = tl[Math.min(i + 1, tl.length - 1)];
    const ax = a.hx ?? a.x, ay = a.hy ?? a.y, bx = b.hx ?? b.x, by = b.hy ?? b.y;
    if (t < a.t + dwell || a === b) return { x: ax, y: ay, kind, lift: 0, alpha: 1 };
    const u = clamp((t - a.t - dwell) / (b.t - a.t - dwell));
    return { x: lerp(ax, bx, ease.inOut(u)), y: lerp(ay, by, ease.inOut(u)), kind, lift: Math.sin(Math.PI * u) * .6, alpha: 1 };
  }
  function pathAt(pts, u) {
    let L = 0; const seg = [];
    for (let j = 1; j < pts.length; j++) { const l = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); seg.push(l); L += l; }
    let d = clamp(u) * L;
    for (let j = 0; j < seg.length; j++) { if (d <= seg[j]) { const f = d / seg[j]; return [lerp(pts[j][0], pts[j + 1][0], f), lerp(pts[j][1], pts[j + 1][1], f)]; } d -= seg[j]; }
    return pts[pts.length - 1];
  }
  function partialPath(g, pts, u) {
    let L = 0; const seg = [];
    for (let j = 1; j < pts.length; j++) { const l = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); seg.push(l); L += l; }
    let d = clamp(u) * L;
    g.moveTo(pts[0][0], pts[0][1]);
    for (let j = 0; j < seg.length; j++) {
      if (d >= seg[j]) { g.lineTo(pts[j + 1][0], pts[j + 1][1]); d -= seg[j]; }
      else { const f = d / seg[j]; g.lineTo(lerp(pts[j][0], pts[j + 1][0], f), lerp(pts[j][1], pts[j + 1][1], f)); break; }
    }
  }
  // incised sign revealed along its strokes: mask the finished sprite with the strokes drawn so far
  function incise(g, sg, si, t) {
    const its = incTL.filter(it => it.si === si);
    if (t < its[0].t0) return;
    if (t >= its[its.length - 1].t1) { stamp(g, sg.sp, sg.x, sg.y, 1); return; }
    const sp = sg.sp, w = sp.w, h = sp.h;
    for (const layer of ['dark', 'light']) {
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, w, h);
      tg.setTransform(sp.ss, 0, 0, sp.ss, w / 2 - sg.x * sp.ss, h / 2 - sg.y * sp.ss);
      tg.lineWidth = GROOVE + 12; tg.lineCap = tg.lineJoin = 'round'; tg.strokeStyle = '#fff';
      its.forEach(it => { if (t < it.t0) return; tg.beginPath(); partialPath(tg, it.pts, (t - it.t0) / (it.t1 - it.t0)); tg.stroke(); });
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.drawImage(sp[layer], 0, 0);
      g.save(); g.globalCompositeOperation = layer === 'dark' ? 'darken' : 'lighten';
      g.drawImage(TMP, 0, 0, w, h, sg.x - w / 2 / sp.ss, sg.y - h / 2 / sp.ss, w / sp.ss, h / sp.ss); g.restore();
    }
  }

  // rising sparks over the fire (deterministic particles)
  function sparks(g, t, a) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const r0 = hash2(i, 11), r1 = hash2(i, 23), r2 = hash2(i, 37);
      const life = 1.6 + r1 * 1.6, u = ((t + r2 * life) / life) % 1;
      const x = r0 * W + Math.sin(t * (1.5 + r1) + i) * 26 + (u - .5) * 80 * (r2 - .5);
      const y = H + 20 - u * (H * (.45 + .45 * r1));
      const inSub = y > 850 && y < 1030 && Math.abs(x - W / 2) < 640;   // keep sparks out of the subtitle box
      const al = a * Math.sin(Math.PI * u) * (.5 + .5 * r2) * (inSub ? .15 : 1);
      const sz = 1.2 + r1 * 2.2;
      g.fillStyle = `rgba(255,${(150 + 80 * r0) | 0},60,${al * .9})`;
      g.beginPath(); g.arc(x, y, sz, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(255,120,30,${al * .18})`;
      g.beginPath(); g.arc(x, y, sz * 4, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  // ---------- frame ----------
  function draw(ctx, t) {
    const C = cam(t);
    const mus = smooth(15.95, 16.25, t);
    // 1. heightmap
    hg.setTransform(1, 0, 0, 1, 0, 0); hg.globalCompositeOperation = 'source-over'; hg.globalAlpha = 1;
    hg.fillStyle = 'rgb(0,200,0)'; hg.fillRect(0, 0, RW, RH);
    const Z = C.z * RS;
    hg.setTransform(Z, 0, 0, Z, RW / 2 - C.x * Z, RH / 2 - C.y * Z);
    hg.imageSmoothingQuality = C.z < .7 ? 'high' : 'low';
    const vis = (x, y, w, h) => Math.abs(x - C.x) * C.z < W / 2 + w * C.z / 2 && Math.abs(y - C.y) * C.z < H / 2 + h * C.z / 2;
    const bench = mus < .5;
    const bodies = [];
    if (bench && vis(SLAB.x, SLAB.y, SLAB.w, SLAB.h)) bodies.push([SPR.slab, SLAB.x, SLAB.y, 1]);
    if (bench && vis(TA.x, TA.y, TA.w + 80, TA.h + 80)) bodies.push([SPR.A, TA.x, TA.y, 1]);
    if (bench && vis(TB.x, TB.y, TB.w + 80, TB.h + 80)) bodies.push([SPR.B, TB.x, TB.y, 1]);
    if (mus > 0) shelf.forEach(sh => { if (vis(sh.x, sh.y, sh.v.bw * sh.s + 80, sh.v.bh * sh.s + 80)) bodies.push([sh.v, sh.x, sh.y, sh.s]); });
    const heroVis = vis(HERO.x, HERO.y, HERO.w + 80, HERO.h + 80);
    if (heroVis) bodies.push([SPR.hero, HERO.x, HERO.y, 1]);
    hg.save(); hg.globalCompositeOperation = 'lighten';
    bodies.forEach(([b, x, y, k]) => drawShadow(hg, b, x, y, k));
    hg.restore();
    if (mus > 0) SPR.planks.forEach(py => {
      const gr = hg.createLinearGradient(0, py, 0, py + PLANK);
      gr.addColorStop(0, 'rgb(0,200,255)'); gr.addColorStop(.45, 'rgb(108,200,255)'); gr.addColorStop(.6, 'rgb(108,200,255)'); gr.addColorStop(1, 'rgb(0,200,255)');
      hg.fillStyle = gr; hg.fillRect(HERO.x - 4800, py, 9600, PLANK);
    });
    bodies.forEach(([b, x, y, k]) => drawBody(hg, b, x, y, k));
    const fp = smooth(12.0, 14.6, t);
    if (heroVis && fp > 0) { const b = SPR.hero; hg.save(); hg.globalCompositeOperation = 'lighten'; hg.globalAlpha = fp * .8;
      hg.drawImage(b.mask, HERO.x - b.w / b.ss / 2, HERO.y - b.h / b.ss / 2, b.w / b.ss, b.h / b.ss); hg.restore(); }
    // knot imprint left by the transition, flattened when the title is stamped over it
    const ki = 1 - smooth(.9, 1.06, t);
    if (bench && ki > 0) stamp(hg, SPR.knot, 0, -820, smooth(.3, .4, t) * ki);
    // the title, stamped into the wet clay
    const tk = ease.out(clamp((t - .93) / .14));
    if (bench && tk > 0 && vis(TITLE.x, TITLE.y, 700, 300)) stamp(hg, SPR.title, TITLE.x, TITLE.y + SPR.titleOff, tk);
    // card 0
    if (bench && t > INC0 - .1 && vis(TA.x, TA.y, TA.w, TA.h)) {
      SIGNS.forEach((sg, i) => incise(hg, sg, i, t));
      wedgeTL.forEach(wd => stamp(hg, wd.sp, wd.x, wd.y, smooth(wd.t - .015, wd.t + .05, t)));
    }
    if (bench && t > NUM0 - .1 && vis(TB.x, TB.y, TB.w, TB.h))
      numTL.forEach(n => stamp(hg, n.k === 'O' ? SPR.numO : SPR.numD, n.x, n.y, smooth(n.t - .015, n.t + .05, t), n.k === 'D' ? -.2 : 0));
    // fire cracks
    if (heroVis) cracks.forEach(cr => {
      const u = clamp((t - cr.t0) / cr.d); if (u <= 0) return;
      hg.save(); hg.globalCompositeOperation = 'darken'; hg.strokeStyle = 'rgba(255,0,255,.9)'; hg.lineWidth = cr.w; hg.lineCap = hg.lineJoin = 'round';
      hg.beginPath(); partialPath(hg, cr.pts, ease.out(u)); hg.stroke(); hg.restore();
    });
    // 2. light it
    const fire = win(t, F0, F1, .7, 1.4);
    const flick = vnoise(t * 9, 3.3) * .7 + vnoise(t * 23, 7.1) * .3;
    const expo = 1 - .82 * win(t, 15.35, 16.6, .5, .55);
    const out = GL.run(MAIN, RW, RH, {
      HM, CAM: [C.x, C.y, Z], T: t,
      FX: [fire, lerp(.2, .62, smooth(F0, 12.6, t)) + Math.sin(t * 1.3) * .08, smooth(11.8, 14.5, t) * (1 - mus), mus],
      FX2: [lerp(1, .2, smooth(10.8, 12, t)) * (1 - mus), expo, flick, smooth(12.3, 13.5, t) * (1 - smooth(15.2, 15.9, t))],
      FL: win(t, 11.5, 15.1, 1.0, .9) * (.85 + .25 * flick),
    });
    ctx.drawImage(out, 0, 0, W, H);
    // 3. flames lick up from below, crack glow while firing
    const fl = win(t, 11.5, 15.1, 1.0, .9);
    if (fl > 0) sparks(ctx, t, fl * expo);
    if (heroVis && t > 13.2 && t < 16) {
      ctx.save(); ctx.setTransform(C.z, 0, 0, C.z, W / 2 - C.x * C.z, H / 2 - C.y * C.z);
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = ctx.lineJoin = 'round';
      cracks.forEach(cr => {
        const u = clamp((t - cr.t0) / cr.d), glow = u > 0 ? (1 - smooth(cr.t0 + cr.d, cr.t0 + cr.d + 1.2, t)) * expo : 0;
        if (glow <= 0) return;
        ctx.beginPath(); partialPath(ctx, cr.pts, ease.out(u));
        ctx.strokeStyle = `rgba(255,90,20,${.22 * glow})`; ctx.lineWidth = cr.w * 3.2; ctx.stroke();
        ctx.strokeStyle = `rgba(255,150,60,${.8 * glow})`; ctx.lineWidth = cr.w * .6; ctx.stroke();
      });
      ctx.restore();
    }
    // 4. the reed stylus
    if (t > INC0 - .45 && t < NUM1 + .5) {
      const s = stylusState(t);
      if (s.alpha > 0) reed(ctx, W / 2 + (s.x - C.x) * C.z, H / 2 + (s.y - C.y) * C.z, -.62, s.kind, s.lift, s.alpha);
    }
    // 5. title moment: era + preserved-for figure, as fine engraved lines under the stamped title
    const tp = { x: W / 2 + (TITLE.x - C.x) * C.z, y: H / 2 + (TITLE.y - C.y) * C.z };
    ctx.save();
    ctx.shadowColor = 'rgba(255,236,206,.5)'; ctx.shadowOffsetX = 1.2; ctx.shadowOffsetY = 1.5; ctx.shadowBlur = 0;
    opener(ctx, t, { ...ch, title: '' }, {
      ink: INKD, sub: '#33200f', accent: '#74260f', x: tp.x, y: tp.y, inAt: .85, outAt: 2.7,
      small: { family: '"Noto Serif SC"', size: 33, weight: 700 }, num: { family: '"Noto Serif SC"', size: 66, weight: 900 },
    });
    ctx.restore();
    subs(ctx, t, ch, { ink: CREAM, body: { family: '"Noto Serif SC"', size: 52, weight: 700 }, shadow: 'rgba(24,12,5,.9)' });

  }

  scene({
    id: 'clay', n: ch.n, dur: ch.dur,
    trans: { type: 'clay_press', d: 1.1 },
    cues: [],
    init() {
      init();
      // title + knot imprint sprites
      const fs = 210, sp = 34;
      const g0 = makeCanvas(10, 10).getContext('2d'); font(g0, fs, '"Noto Serif SC"', 900);
      const chars = [...ch.title], ws = chars.map(c => g0.measureText(c).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
      SPR.titleOff = -fs * .36;
      SPR.title = impSprite(tw + 20, fs * 1.1, 1.5, g => {
        font(g, fs, '"Noto Serif SC"', 900); g.textBaseline = 'alphabetic';
        let x = -tw / 2; chars.forEach((c, i) => { g.fillText(c, x, fs * .36); x += ws[i] + sp; });
      }, { depth: 7.5, slope: 1.1, lip: 1.6, lipW: 3 });
      SPR.knot = impSprite(470, 240, 1.5, g => { g.lineWidth = knot.wid * .9; g.beginPath(); knot.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); },
        { r: knot.wid * .45, depth: 6, lip: 1.4, lipW: 3, mod: (x, y) => .82 + .18 * Math.sin((x + y) * .55) });
      // cues
      const cues = [{ t: .33, sfx: 'clay' }, { t: .95, sfx: 'stamp' }];
      SIGNS.forEach((sg, i) => { const it = incTL.find(q => q.si === i); cues.push({ t: +it.t0.toFixed(2), sfx: 'stylus', v: .8 }); });
      const pick = (tl, n) => tl.filter((_, i) => i % Math.ceil(tl.length / n) === 0);
      pick(wedgeTL, 5).forEach(w => cues.push({ t: +w.t.toFixed(2), sfx: 'clay', v: .7 }));
      pick(numTL, 5).forEach(w => cues.push({ t: +w.t.toFixed(2), sfx: 'clay', v: .6 }));
      cues.push({ t: 11.3, sfx: 'fire' });
      cracks.slice(0, 2).forEach(c => cues.push({ t: +c.t0.toFixed(2), sfx: 'crack', v: .8 }));
      cues.push({ t: 16.25, sfx: 'whoosh', v: .5 });
      this.cues.splice(0, this.cues.length, ...cues);
    },
    draw,
  });
})();
