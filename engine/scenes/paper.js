// 06 造纸 — ink wash on xuan paper, read as one long handscroll unrolled right-to-left.
// Every ink mark is an "element": a mask (ink density) and a deposit-time map drawn in init, passed once through an
// ink-diffusion shader (fibrous capillary halo, edge darkening, granulation). Per frame each pixel appears when its
// deposit time is reached, the wet halo blooming in a moment later, so writing and drawing happen stroke by stroke.
'use strict';
(() => {
  const ch = CH('paper');
  const ICOL = [24, 21, 18];                         // 焦墨 base colour, tones come from density
  const RED = '#b8352b';
  const SUBINK = '#1c1915';

  // ---------------------------------------------------------------- shaders
  // xuan paper: warm off-white, cloudy formation, short fibre streaks (long fibres are added in 2D)
  const PAPER = `uniform vec2 OFF;
  void main(){ vec2 p=vec2(uv.x*R.x,(1.-uv.y)*R.y)+OFF;
    vec3 col=vec3(.945,.925,.882);
    float cl=fbm3(p*.0032), cl2=fbm3(p*.011+5.3);
    float fine=vn(p*.8)*.5+vn(p*.3+3.)*.5;
    float f1=vn(vec2(dot(p,vec2(.96,.28))*.022,dot(p,vec2(-.28,.96))*.55));
    float f2=vn(vec2(dot(p,vec2(.33,-.94))*.022,dot(p,vec2(.94,.33))*.55)+9.);
    float f3=vn(vec2(dot(p,vec2(.8,.6))*.03,dot(p,vec2(-.6,.8))*.6)+21.);
    float fib=smoothstep(.74,.97,max(max(f1,f2),f3));
    col*=.968+.06*cl+.022*cl2;
    col*=.988+.024*fine;
    col=mix(col,min(col*1.025+.012,vec3(1.)),fib*.7);
    col=mix(col,col*vec3(.985,.975,.955),smoothstep(.55,.8,cl2)*.5);
    O=vec4(col,1.); }`;

  // ink diffusion: M = mask (white paper, grey = ink density). Output: ink colour with alpha.
  const INKSH = `uniform sampler2D M; uniform float SEED; uniform float BL; uniform float HA; uniform float GR; uniform vec3 CD; uniform vec3 CL;
  float den(vec2 q){ return 1.-texture(M,q).r; }
  float fib(vec2 q){
    float s=vn(vec2(dot(q,vec2(.94,.34))*.07,dot(q,vec2(-.34,.94))*.75));
    s=max(s,vn(vec2(dot(q,vec2(.2,-.98))*.07,dot(q,vec2(.98,.2))*.75)+7.));
    s=max(s,vn(vec2(dot(q,vec2(.71,.71))*.07,dot(q,vec2(-.71,.71))*.75)+13.));
    return s; }
  void main(){ vec2 px=uv*R; vec2 e=1./R;
    float m=den(uv);
    float b1=0., b2=0.;
    for(int i=0;i<10;i++){ float a=float(i)*.6283+SEED; vec2 o=vec2(cos(a),sin(a));
      b1+=den(uv+o*e*BL*.4); b2+=den(uv+o*e*BL); }
    b1/=10.; b2/=10.;
    vec2 q=px+SEED*41.;
    float f=fib(q);
    float n=fbm3(q*.06);
    // capillary halo: grows out of the blurred density along fibres
    float reach=b2*.75+b1*.25;
    float hal=smoothstep(.02,.22,reach+(f-.62)*.32+(n-.5)*.12)*smoothstep(.004,.05,reach)*(1.-smoothstep(.0,.5,m));
    float halo=hal*HA*clamp(reach*1.6+.25,0.,1.)*(.75+.5*f);
    // body: granulation and darker tide line where the stroke edge dried
    float edge=clamp((m-b1)*1.6,0.,1.);
    float gran=.9+.14*vn(px*.45+SEED)+.06*(n-.5);
    float body=m*gran*(1.+edge*.45*GR);
    float a=clamp(max(body,halo),0.,1.);
    vec3 c=mix(CL,CD,smoothstep(.15,.7,a));
    O=vec4(c,a); }`;

  // ---------------------------------------------------------------- element system
  const gry = v => { const c = Math.round(255 * (1 - clamp(v))); return `rgb(${c},${c},${c})`; };
  const tcol = (e, t) => { const b = Math.round(clamp(t / e.dur) * 254); return `rgb(${b},${b},${b})`; };
  function El(w, h, dur, sc = 1) {
    w = Math.ceil(w * sc); h = Math.ceil(h * sc);
    const m = makeCanvas(w, h), mg = m.getContext('2d');
    mg.fillStyle = '#fff'; mg.fillRect(0, 0, w, h);
    const tc = makeCanvas(w, h), tg = tc.getContext('2d');
    tg.fillStyle = '#fff'; tg.fillRect(0, 0, w, h);
    for (const g of [mg, tg]) { g.globalCompositeOperation = 'darken'; g.lineCap = 'round'; g.lineJoin = 'round'; g.scale(sc, sc); }
    return { w, h, dur, m, mg, tc, tg };
  }
  // Catmull-Rom through control points, resampled about every `step` px
  function spline(pts, step = 3) {
    if (pts.length < 2) return pts.slice();
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(d => .5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    return out;
  }
  // brush stroke: o = {w, tone, t0, t1, taper:[in,out], jit, dry, bristles, fade, seed, margin, smooth}
  function stroke(e, pts, o) {
    const P = o.raw ? pts : spline(pts, 2.5);
    const L = [0];
    for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const tot = L[L.length - 1] || 1, seed = o.seed ?? 1, tone = o.tone ?? .9;
    const [ti, to] = o.taper || [.12, .22];
    const mg = e.mg, tg = e.tg, margin = o.margin ?? 6;
    const nb = o.dry ? (o.bristles || 9) : 1;
    for (let i = 1; i < P.length; i++) {
      const s = L[i] / tot;
      const prof = lerp(o.tin ?? .35, 1, smooth(0, ti, s)) * lerp(1, o.tout ?? .2, smooth(1 - to, 1, s));
      const lw = Math.max(.6, o.w * prof * (1 + (vnoise(L[i] * .018 + seed * 7, seed) - .5) * (o.jit ?? .35)));
      const a = P[i - 1], b = P[i];
      const dens = tone * (1 - (o.fade || 0) * s);
      if (nb === 1) {
        mg.lineWidth = lw; mg.strokeStyle = gry(dens);
        mg.beginPath(); mg.moveTo(a[0], a[1]); mg.lineTo(b[0], b[1]); mg.stroke();
      } else { // dry brush: separate bristles that skip as the brush runs dry
        const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
        for (let k = 0; k < nb; k++) {
          const off = (k / (nb - 1) - .5) * lw;
          const gap = vnoise(L[i] * .03 + k * 13.1, seed + k) + vnoise(L[i] * .11, k * 3.7) * .35;
          if (gap < o.dry * (.25 + s)) continue;
          mg.lineWidth = lw / nb * 1.9; mg.strokeStyle = gry(dens * (.75 + .5 * hash2(k, seed)));
          mg.beginPath(); mg.moveTo(a[0] + nx * off, a[1] + ny * off); mg.lineTo(b[0] + nx * off, b[1] + ny * off); mg.stroke();
        }
      }
      tg.lineWidth = lw + margin * 2; tg.strokeStyle = tcol(e, lerp(o.t0, o.t1, s));
      tg.beginPath(); tg.moveTo(a[0], a[1]); tg.lineTo(b[0], b[1]); tg.stroke();
    }
  }
  // filled ink wash: draw(g) builds the path; time sweeps along dir across bbox [x0,y0,x1,y1]
  function wash(e, draw, o) {
    const mg = e.mg, tg = e.tg;
    mg.save(); if (o.blur) mg.filter = `blur(${o.blur}px)`;
    mg.fillStyle = o.grad ? o.grad(mg) : gry(o.tone ?? .3);
    mg.beginPath(); draw(mg); mg.fill(); mg.restore();
    const [x0, y0, x1, y1] = o.box;
    const d = o.dir || [1, 0];
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2 * d[0], hy = (y1 - y0) / 2 * d[1];
    const gr = tg.createLinearGradient(cx - hx, cy - hy, cx + hx, cy + hy);
    gr.addColorStop(0, tcol(e, o.t0)); gr.addColorStop(1, tcol(e, o.t1));
    tg.save(); tg.fillStyle = gr; tg.beginPath(); draw(tg); tg.lineWidth = (o.blur || 2) * 4; tg.strokeStyle = gr; tg.stroke(); tg.fill(); tg.restore();
  }
  // calligraphy glyph written stroke by stroke: connected components of the font outline are treated as strokes,
  // ordered (by o.key) and swept along their principal axis; ink thins as each stroke runs out.
  function glyph(e, str, cx, by, size, fam, o) {
    const gw = Math.ceil(size * 1.5), gh = Math.ceil(size * 1.5), ox = gw / 2, oy = gh * .8;
    const c = makeCanvas(gw, gh), g = c.getContext('2d');
    font(g, size, fam, o.weight || 400); g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(str, ox, oy);
    const al = g.getImageData(0, 0, gw, gh).data, n = gw * gh;
    const lab = new Int32Array(n).fill(-1), comps = [];
    for (let i = 0; i < n; i++) {
      if (al[i * 4 + 3] < 90 || lab[i] >= 0) continue;
      const id = comps.length, st = [i], pix = []; lab[i] = id;
      while (st.length) {
        const j = st.pop(); pix.push(j); const x = j % gw, y = (j / gw) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
          const k = yy * gw + xx; if (lab[k] < 0 && al[k * 4 + 3] >= 90) { lab[k] = id; st.push(k); }
        }
      }
      comps.push({ pix });
    }
    let main = comps.filter(cp => cp.pix.length > 40);
    for (const cp of main) {
      let sx = 0, sy = 0, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (const j of cp.pix) { const x = j % gw, y = (j / gw) | 0; sx += x; sy += y; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
      const mx = sx / cp.pix.length, my = sy / cp.pix.length;
      let cxx = 0, cyy = 0, cxy = 0;
      for (const j of cp.pix) { const x = j % gw - mx, y = ((j / gw) | 0) - my; cxx += x * x; cyy += y * y; cxy += x * y; }
      const ang = .5 * Math.atan2(2 * cxy, cxx - cyy);
      let dx = Math.cos(ang), dy = Math.sin(ang);
      if (Math.abs(dx) > Math.abs(dy) * .8) { if (dx < 0) { dx = -dx; dy = -dy; } } else if (dy < 0) { dx = -dx; dy = -dy; }
      let p0 = 1e9, p1 = -1e9;
      for (const j of cp.pix) { const pr = (j % gw) * dx + ((j / gw) | 0) * dy; p0 = Math.min(p0, pr); p1 = Math.max(p1, pr); }
      Object.assign(cp, { mx, my, minx, miny, maxx, maxy, dx, dy, p0, p1, len: Math.max(p1 - p0, size * .18) });
    }
    const key = o.key || (cp => cp.miny + cp.minx * .45);
    main.sort((a, b) => key(a, gw, gh) - key(b, gw, gh));
    const gap = size * .12;
    const total = main.reduce((s, cp) => s + cp.len + gap, 0) - gap;
    const mid = new ImageData(gw, gh), tid = new ImageData(gw, gh), md = mid.data, td = tid.data;
    let acc = 0;
    const tone = o.tone ?? .95, fade = o.fade ?? .22;
    for (const cp of main) {
      for (const j of cp.pix) {
        const pr = ((j % gw) * cp.dx + ((j / gw) | 0) * cp.dy - cp.p0) / (cp.p1 - cp.p0 || 1);
        const tt = lerp(o.t0, o.t1, (acc + pr * cp.len) / total);
        const b = Math.round(clamp(tt / e.dur) * 254);
        td[j * 4] = td[j * 4 + 1] = td[j * 4 + 2] = b; td[j * 4 + 3] = 255;
      }
      cp.t = acc; acc += cp.len + gap;
    }
    // density: all outline pixels (incl. anti-aliasing and tiny specks); ink runs out along each stroke
    for (let i = 0; i < n; i++) {
      const a = al[i * 4 + 3]; if (!a) continue;
      const l = lab[i]; let dep = 0;
      if (l >= 0) { const cp = comps[l]; if (cp.len) dep = clamp(((i % gw) * cp.dx + ((i / gw) | 0) * cp.dy - cp.p0) / (cp.p1 - cp.p0 || 1)); }
      const v = 255 - Math.round(255 * tone * (1 - fade * dep) * a / 255);
      md[i * 4] = md[i * 4 + 1] = md[i * 4 + 2] = v; md[i * 4 + 3] = 255;
    }
    const tmp = makeCanvas(gw, gh), tg2 = tmp.getContext('2d');
    const X = Math.round(cx - ox), Y = Math.round(by - oy);
    tg2.putImageData(mid, 0, 0); e.mg.drawImage(tmp, X, Y);
    tg2.clearRect(0, 0, gw, gh); tg2.putImageData(tid, 0, 0); e.tg.drawImage(tmp, X, Y);
  }
  // nearest-set fill for unset (255) deposit times, so halos and specks inherit the time of the ink next to them
  function fillTimes(tm, w, h) {
    const q = new Int32Array(w * h); let qh = 0, qt = 0;
    for (let i = 0; i < tm.length; i++) if (tm[i] < 255) q[qt++] = i;
    if (!qt) return;
    const vis = new Uint8Array(w * h); for (let k = 0; k < qt; k++) vis[q[k]] = 1;
    while (qh < qt) {
      const j = q[qh++], x = j % w, y = (j / w) | 0, v = tm[j];
      if (x > 0 && !vis[j - 1]) { vis[j - 1] = 1; tm[j - 1] = v; q[qt++] = j - 1; }
      if (x < w - 1 && !vis[j + 1]) { vis[j + 1] = 1; tm[j + 1] = v; q[qt++] = j + 1; }
      if (y > 0 && !vis[j - w]) { vis[j - w] = 1; tm[j - w] = v; q[qt++] = j - w; }
      if (y < h - 1 && !vis[j + w]) { vis[j + w] = 1; tm[j + w] = v; q[qt++] = j + w; }
    }
  }
  function fin(e, o = {}) {
    const inked = o.img || GL.bake(INKSH, e.w, e.h, { M: e.m, SEED: o.seed ?? 1.3, BL: o.bl ?? 5, HA: o.ha ?? .32, GR: o.gr ?? 1,
      CD: o.cd || [.094, .082, .07], CL: o.cl || [.12, .12, .125] });
    const rgba = inked.getContext('2d').getImageData(0, 0, e.w, e.h).data;
    const md = e.mg.getImageData(0, 0, e.w, e.h).data, td = e.tg.getImageData(0, 0, e.w, e.h).data;
    const n = e.w * e.h, tm = new Uint8Array(n), cov = new Uint8Array(n);
    for (let i = 0; i < n; i++) { tm[i] = td[i * 4]; cov[i] = o.img || md[i * 4] < 238 ? 1 : 0; }
    fillTimes(tm, e.w, e.h);
    let cnt = 0; for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] > 1) cnt++;
    const idx = new Uint32Array(cnt); cnt = 0;
    for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] > 1) idx[cnt++] = i;
    const sc = makeCanvas(e.w, e.h), sg = sc.getContext('2d'), sid = sg.createImageData(e.w, e.h), d = sid.data;
    for (let k = 0; k < idx.length; k++) { const i = idx[k] * 4; d[i] = rgba[i]; d[i + 1] = rgba[i + 1]; d[i + 2] = rgba[i + 2]; }
    Object.assign(e, { canvas: inked, rgba, tm, cov, idx, sc, sg, sid, fade: o.fade || FADE });
    delete e.m; delete e.mg; delete e.tc; delete e.tg;
    return e;
  }
  const FADE = .07, HALOF = .32, HALOD = .05;
  // draw element e with its top-left at (x, y); tl = seconds since the element started
  function drawEl(ctx, e, x, y, tl, a = 1) {
    if (tl <= 0 || a <= .003) return;
    ctx.globalAlpha = a;
    if (tl >= e.dur + HALOD + Math.max(HALOF, e.fade)) { ctx.drawImage(e.canvas, x, y); ctx.globalAlpha = 1; return; }
    const k = e.dur / 254, src = e.rgba, d = e.sid.data, tm = e.tm, cov = e.cov, idx = e.idx;
    for (let q = 0; q < idx.length; q++) {
      const i = idx[q], c = cov[i];
      const f = c ? (tl - tm[i] * k) / e.fade : (tl - tm[i] * k - HALOD) / HALOF;
      const sa = src[i * 4 + 3];
      d[i * 4 + 3] = f <= 0 ? 0 : f >= 1 ? sa : sa * f;
    }
    e.sg.putImageData(e.sid, 0, 0);
    ctx.drawImage(e.sc, x, y); ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- sheets of paper and the seal
  // TY 0: finished Cai Lun sheet (bright, even, faint laid and chain lines from the bamboo mould)
  // TY 1: excavated Western Han fragment (coarse hemp, clumps, holes, darker torn edges)   TY 2: wet sheet on the mould
  const SHEET = `uniform sampler2D M; uniform float TY; uniform float SEED;
  void main(){ vec2 px=vec2(uv.x*R.x,(1.-uv.y)*R.y)+SEED*97.;
    float m=texture(M,uv).a;
    float n=fbm3(px*.06), n2=vn(px*.35);
    float a; vec3 col;
    if(TY<.5){
      a=smoothstep(.3,.7,m+(n-.5)*.3);
      col=vec3(.975,.962,.93);
      col*=1.-.007*smoothstep(.9,1.,.5+.5*cos(px.x*6.2832/48.+vn(px*.02)*1.5));
      float f1=vn(vec2(dot(px,vec2(.96,.28))*.03,dot(px,vec2(-.28,.96))*.6));
      float f2=vn(vec2(dot(px,vec2(.3,-.95))*.03,dot(px,vec2(.95,.3))*.6)+4.);
      col=mix(col,col*.982,smoothstep(.72,.95,f1));
      col=mix(col,min(col*1.012,vec3(1.)),smoothstep(.7,.95,f2));
      col*=.982+.036*fbm3(px*.012);
      col=mix(col,col*vec3(.965,.95,.91),(1.-smoothstep(.5,1.,m))*.7);
    } else if(TY<1.5){
      float hole=smoothstep(.66,.72,fbm3(px*.03+3.))*smoothstep(.3,.6,m);
      a=smoothstep(.38,.62,m+(n-.5)*.7)*(1.-hole);
      col=vec3(.77,.69,.55)*(.86+.24*fbm3(px*.018+7.));
      vec2 v=vor(px*.085); col*=1.-.2*smoothstep(.32,.0,v.x)*smoothstep(.45,.72,n);
      float fb=vn(vec2(dot(px,vec2(.9,.43))*.035,dot(px,vec2(-.43,.9))*.45));
      col=mix(col,col*.84,smoothstep(.7,.95,fb));
      float fb2=vn(vec2(dot(px,vec2(.3,.95))*.035,dot(px,vec2(-.95,.3))*.45)+5.);
      col=mix(col,min(col*1.15,vec3(1.)),smoothstep(.75,.97,fb2)*.7);
      col=mix(col,col*vec3(.78,.72,.64),(1.-smoothstep(.5,.95,m))*.8);
      col*=.9+.14*n2;
    } else {
      float cl=fbm3(px*.045);
      a=smoothstep(.3,.7,m+(n-.5)*.2)*(.84+.12*cl);
      col=vec3(.95,.948,.93)*(.93+.1*cl)*(.97+.04*n2);
    }
    O=vec4(col,a); }`;
  const SEALSH = `uniform sampler2D M;
  void main(){ vec2 px=vec2(uv.x*R.x,(1.-uv.y)*R.y);
    vec4 s=texture(M,uv);
    float n=fbm3(px*.12), sp=vn(px*.55), sp2=vn(px*1.3+4.);
    float a=s.a*smoothstep(.12,.32,n+.18)*(1.-smoothstep(.78,.9,sp*.55+sp2*.5));
    O=vec4(s.rgb*(.9+.14*n),a*.94); }`;

  function shapeMask(w, h, pts) {
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
    return c;
  }
  // irregular outline around a rectangle: amp = edge wobble, torn = big notches
  function outline(x0, y0, x1, y1, amp, seed, torn = 0) {
    const pts = [], r = mulberry(seed), per = 2 * (x1 - x0 + y1 - y0), N = Math.ceil(per / 7);
    for (let i = 0; i < N; i++) {
      let d = i / N * per, x, y, nx, ny;
      if (d < x1 - x0) { x = x0 + d; y = y0; nx = 0; ny = -1; }
      else if ((d -= x1 - x0) < y1 - y0) { x = x1; y = y0 + d; nx = 1; ny = 0; }
      else if ((d -= y1 - y0) < x1 - x0) { x = x1 - d; y = y1; nx = 0; ny = 1; }
      else { d -= x1 - x0; x = x0; y = y1 - d; nx = -1; ny = 0; }
      const u = i / N * 40;
      let o = (fbm(u * .35 + seed, seed * .3) - .5) * amp + (r() - .5) * amp * .25;
      if (torn) o -= torn * Math.pow(Math.max(0, fbm(u * .12 + 9 + seed, 3) - .45), 1.2) * 3;
      pts.push([x + nx * o, y + ny * o]);
    }
    return pts;
  }
  function bakeSheet(w, h, ty, seed, torn = 0, shadow = .22) {
    const pad = 34, W2 = w + pad * 2, H2 = h + pad * 2;
    const pts = outline(pad, pad, pad + w, pad + h, ty === 1 ? 26 : 5, seed, torn);
    const mk = shapeMask(W2, H2, pts);
    const sh = GL.bake(SHEET, W2, H2, { M: mk, TY: ty, SEED: seed * .37 });
    const c = makeCanvas(W2, H2), g = c.getContext('2d');
    if (shadow) {
      g.save(); g.filter = 'blur(9px)'; g.globalAlpha = shadow; g.drawImage(mk, 5, 9);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = '#4a3d2c'; g.fillRect(0, 0, W2, H2); g.restore();
    }
    g.drawImage(sh, 0, 0);
    c.pad = pad;
    return c;
  }
  function bakeSeal(w, h, txt) {
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = RED; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 4); g.fill();
    g.globalCompositeOperation = 'destination-out';
    const s = (h - 14) / txt.length;
    font(g, s * .92, '"Noto Serif SC"', 900); g.textAlign = 'center'; g.textBaseline = 'middle';
    [...txt].forEach((k, i) => g.fillText(k, w / 2, 8 + s * (i + .5) + 2));
    g.lineWidth = 2.2; g.strokeStyle = '#000'; g.strokeRect(5.5, 5.5, w - 11, h - 11);
    return GL.bake(SEALSH, w, h, { M: c });
  }

  // ---------------------------------------------------------------- line-drawing helpers
  const arcPts = (cx, cy, rx, ry, a0, a1, n = 28) => { const o = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; };
  const spiralPts = (cx, cy, r0, r1, turns, a0 = 0, sy = 1, n = 120) => { const o = []; for (let i = 0; i <= n; i++) { const u = i / n, a = a0 + u * turns * Math.PI * 2, r = lerp(r0, r1, u); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy]); } return o; };
  const Ln = (e, pts, w, tone, t0, t1, o) => stroke(e, pts, Object.assign({ w, tone, t0, t1, taper: [.18, .25], tin: .45, tout: .3, jit: .22, margin: 4 }, o || {}));
  function erase(e, draw) {
    for (const g of [e.mg, e.tg]) { g.save(); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff'; g.beginPath(); draw(g); g.fill(); g.restore(); }
  }
  const poly = pts => g => pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  const Wa = (e, draw, tone, t0, t1, box, o) => wash(e, draw, Object.assign({ tone, t0, t1, box, blur: 2 }, o || {}));
  const dot = (e, x, y, r, tone, t) => Wa(e, g => g.arc(x, y, r, 0, Math.PI * 2), tone, t, t + .02, [x - r, y - r, x + r, y + r], { blur: .6 });

  // ---------------------------------------------------------------- beat 0: slips (简重), silk (缣贵)
  function bakeSlips(sc = 1, tone = 1, dur = 1.1) {
    const S = v => v * sc;
    const e = El(S(770), S(390), dur), T = v => v * dur / 1.1;
    const r = S(52), D = S(96), dl = Math.hypot(1, .36), dx = 1 / dl, dy = -.36 / dl, nx = -dy, ny = dx;
    const an = Math.atan2(ny, nx);
    const rolls = [[70, 318, 0], [176, 318, .1], [282, 318, .2], [123, 226, .3], [229, 226, .38], [176, 134, .46]]
      .map(([x, y, t]) => [S(x), S(y), T(t)]);
    const order = rolls.slice().sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    for (const [cx, cy, t0] of order) {
      const bx = cx + D * dx, by = cy + D * dy;
      erase(e, g => g.arc(cx, cy, r + S(3), 0, Math.PI * 2));
      erase(e, poly([[cx + nx * (r + 3), cy + ny * (r + 3)], [bx + nx * (r + 3), by + ny * (r + 3)], [bx - nx * (r + 3), by - ny * (r + 3)], [cx - nx * (r + 3), cy - ny * (r + 3)]]));
      erase(e, g => g.arc(bx, by, r + S(3), 0, Math.PI * 2));
      const body = poly([[cx + nx * r, cy + ny * r], ...arcPts(bx, by, r, r, an, an - Math.PI, 20), [cx - nx * r, cy - ny * r]]);
      Wa(e, body, .07 * tone, t0 + T(.05), t0 + T(.18), [cx - r, by - r, bx + r, cy + r]);
      Wa(e, g => g.arc(cx, cy, r, 0, Math.PI * 2), .1 * tone, t0, t0 + T(.1), [cx - r, cy - r, cx + r, cy + r]);
      Ln(e, arcPts(cx, cy, r, r, -Math.PI * .6, Math.PI * 1.42, 40), S(3.4), .86 * tone, t0, t0 + T(.1));
      Ln(e, spiralPts(cx, cy, r * .12, r * .8, 3.1, 1.3), S(1.5), .62 * tone, t0 + T(.04), t0 + T(.14), { taper: [.05, .1] });
      Ln(e, [[cx + nx * r, cy + ny * r], [bx + nx * r, by + ny * r]], S(3), .8 * tone, t0 + T(.08), t0 + T(.14));
      Ln(e, [[cx - nx * r, cy - ny * r], [bx - nx * r, by - ny * r]], S(3), .8 * tone, t0 + T(.08), t0 + T(.14));
      Ln(e, arcPts(bx, by, r, r, an, an - Math.PI, 26), S(2.6), .72 * tone, t0 + T(.12), t0 + T(.2));
      for (let k = 1; k <= 4; k++) {
        const a = an - k / 5 * Math.PI, sx0 = cx + Math.cos(a) * r, sy0 = cy + Math.sin(a) * r;
        Ln(e, [[sx0, sy0], [sx0 + D * dx, sy0 + D * dy]], S(1.3), .42 * tone, t0 + T(.12), t0 + T(.18), { margin: 2 });
      }
      for (const f of [.3, .7]) for (const df of [0, S(5)]) {
        const ccx = cx + (f * D + df) * dx, ccy = cy + (f * D + df) * dy;
        Ln(e, arcPts(ccx, ccy, r + S(1), r + S(1), an, an - Math.PI, 24), S(1.6), .75 * tone, t0 + T(.15), t0 + T(.2), { margin: 2 });
      }
    }
    // a partly unrolled 简册 standing in front: rolled bundle on the left, slips with two cords and columns of writing
    const x0 = S(452), top = S(112), bot = S(344), rx = S(26), ry = S(9), t1 = T(.56);
    Wa(e, g => g.rect(x0 - rx, top, rx * 2, bot - top), .07 * tone, t1, t1 + T(.1), [x0 - rx, top, x0 + rx, bot]);
    Ln(e, arcPts(x0, top, rx, ry, 0, Math.PI * 2, 30), S(2.6), .85 * tone, t1, t1 + T(.06));
    Ln(e, spiralPts(x0, top, S(3), rx * .8, 2.4, 0, ry / rx), S(1.2), .6 * tone, t1 + T(.03), t1 + T(.08), { taper: [.05, .1] });
    Ln(e, [[x0 - rx, top], [x0 - rx, bot]], S(2.8), .85 * tone, t1 + T(.04), t1 + T(.1));
    Ln(e, [[x0 + rx, top], [x0 + rx, bot]], S(2.2), .7 * tone, t1 + T(.04), t1 + T(.1));
    Ln(e, arcPts(x0, bot, rx, ry, 0, Math.PI, 16), S(2.6), .85 * tone, t1 + T(.08), t1 + T(.12));
    const ns = 9, sw = S(25), t2 = T(.66);
    const ty = k => top + S(4) + k * S(1.6), byy = k => bot - S(2) - k * S(1.2);
    for (let k = 0; k <= ns; k++) {
      const x = x0 + rx + k * sw;
      Ln(e, [[x, ty(k)], [x, byy(k)]], S(k === ns ? 2.4 : 1.7), (k === ns ? .8 : .6) * tone, t2 + k * T(.022), t2 + k * T(.022) + T(.05), { margin: 2 });
      if (k < ns) {
        Ln(e, [[x, ty(k)], [x + sw * .5, ty(k) - S(3)], [x + sw, ty(k + 1)]], S(1.6), .62 * tone, t2 + k * T(.022), t2 + k * T(.022) + T(.04), { margin: 2 });
        Ln(e, [[x, byy(k)], [x + sw * .5, byy(k) + S(3)], [x + sw, byy(k + 1)]], S(1.6), .62 * tone, t2 + k * T(.022), t2 + k * T(.022) + T(.04), { margin: 2 });
        if (k % 3 !== 1) { // columns of writing: short brush marks
          const r2 = mulberry(31 + k);
          for (let j = 0; j < 9; j++) {
            const yy = ty(k) + S(22) + j * S(21) + r2() * S(4), xx = x + sw / 2 + (r2() - .5) * S(4);
            if (yy > byy(k) - S(18)) break;
            Ln(e, [[xx - S(3), yy], [xx + S(2), yy + S(3 + r2() * 6)]], S(2.6), .8 * tone, T(.86) + j * T(.012), T(.86) + j * T(.012) + T(.02), { margin: 2 });
          }
        }
      }
    }
    const xe = x0 + rx + ns * sw;
    for (const f of [.27, .72]) {
      const y0 = lerp(top, bot, f);
      Ln(e, [[x0 - rx, y0 + S(2)], [x0 + rx, y0 + S(4)], [xe * .5 + x0 * .5, y0 + S(1)], [xe, y0 - S(3)], [xe + S(14), y0 + S(6)], [xe + S(20), y0 + S(26)]], S(2.2), .82 * tone, T(.8), T(.95));
    }
    Ln(e, [[S(16), S(374)], [S(300), S(378)], [S(560), S(372)], [S(740), S(376)]], S(9), .14 * tone, T(.95), T(1.08), { dry: .4, bristles: 6, taper: [.1, .3] });
    return fin(e, { bl: 4.5 * Math.max(sc, .6), ha: .32, seed: 2.7 + sc });
  }

  function bakeSilk(sc = 1, tone = 1, dur = 1.0) {
    const S = v => v * sc;
    const e = El(S(780), S(330), dur), T = v => v * dur;
    const cx = S(664), top = S(64), bot = S(278), rx = S(34), ry = S(11);
    // the sheet of silk leaving the bolt and drifting left in long soft folds
    const N = 60, tp = [], bp = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = cx - rx + S(4) - u * S(600), wv = Math.sin(u * 8.6 + .4);
      const yt = top + S(10) + S(16) * wv + u * S(46) + S(8) * u * u;
      const hh = (bot - top - S(14)) * (1 - .22 * u) * (.9 + .1 * Math.cos(u * 8.6 + .4));
      tp.push([x, yt]); bp.push([x - S(10) * u, yt + hh]);
    }
    Wa(e, poly([...tp, ...bp.slice().reverse()]), .045 * tone, T(.55), T(.9), [S(40), top, cx, bot], { dir: [-1, 0] });
    for (let i = 0; i < N; i++) { // fold shading in the troughs
      const u = i / N, wv = Math.cos(u * 8.6 + .4);
      if (wv > -.15) continue;
      const q = [tp[i], tp[i + 1], bp[i + 1], bp[i]];
      Wa(e, poly(q), .07 * tone * Math.min(1, -wv * 1.4), T(.62) + u * T(.25), T(.66) + u * T(.25), [q[0][0] - 2, q[0][1], q[1][0] + 2, q[2][1]], { blur: 3 });
    }
    Ln(e, tp, S(2.1), .74 * tone, T(.18), T(.62), { taper: [.04, .12], tout: .5 });
    Ln(e, bp, S(2.1), .74 * tone, T(.26), T(.7), { taper: [.04, .12], tout: .5 });
    for (let i = 3; i < N - 2; i++) {
      const u = i / N, d1 = Math.sin(u * 8.6 + .4), d0 = Math.sin((i - 1) / N * 8.6 + .4), d2 = Math.sin((i + 1) / N * 8.6 + .4);
      if (!(d1 >= d0 && d1 >= d2)) continue; // crest: a fold line
      const a = tp[i], b = bp[i];
      Ln(e, [a, [lerp(a[0], b[0], .5) + S(6), lerp(a[1], b[1], .5)], b], S(1.5), .36 * tone, T(.6) + u * T(.2), T(.66) + u * T(.2), { margin: 2 });
    }
    const le = tp[N], lb = bp[N];
    Ln(e, [le, [le[0] - S(12), lerp(le[1], lb[1], .3)], [le[0] + S(6), lerp(le[1], lb[1], .65)], lb], S(1.9), .7 * tone, T(.7), T(.8));
    // the bolt
    Wa(e, g => { g.rect(cx - rx, top, rx * 2, bot - top); g.ellipse(cx, bot, rx, ry, 0, 0, Math.PI * 2); }, .1 * tone, 0, T(.2), [cx - rx, top, cx + rx, bot]);
    erase(e, g => g.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2));
    Ln(e, arcPts(cx, top, rx, ry, 0, Math.PI * 2, 32), S(2.3), .82 * tone, 0, T(.08));
    Ln(e, spiralPts(cx, top, S(4), rx * .82, 2.6, 0, ry / rx), S(1.1), .5 * tone, T(.04), T(.12), { taper: [.05, .1] });
    Ln(e, [[cx - rx, top], [cx - rx, bot]], S(2.4), .8 * tone, T(.06), T(.14));
    Ln(e, [[cx + rx, top], [cx + rx, bot]], S(2.4), .8 * tone, T(.06), T(.14));
    Ln(e, arcPts(cx, bot, rx, ry, 0, Math.PI, 18), S(2.4), .8 * tone, T(.12), T(.18));
    return fin(e, { bl: 4 * Math.max(sc, .6), ha: .3, seed: 4.1 + sc });
  }

  // ---------------------------------------------------------------- beat 1: the vat, raw materials, mould, drying wall
  // vat geometry in beat-1 local coordinates (element placed at VX, VY)
  const VX = 170, VY = 352, WL = VY + 126;   // WL: water line
  // a round stave tub bound with bamboo hoops (element coords; tub centre TCX, rim TCY)
  const TCX = 440, TCY = 132, TRX = 390, TRY = 72, TBY = 404, TBRX = 345;
  function bakeVat() {
    const e = El(900, 500, .9, .9);
    const r = mulberry(303);
    const sideX = (v, s) => TCX + s * lerp(TRX, TBRX, v); // v 0 rim .. 1 base
    // shaded flanks (dry brush), bare paper down the middle where the light falls
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const x0 = sideX(0, s) - s * (14 + k * 26), x1 = sideX(1, s) - s * (14 + k * 24);
      Ln(e, [[x0, TCY + 30], [lerp(x0, x1, .5) - s * 4, (TCY + TBY) / 2], [x1, TBY + 20]], 34 - k * 6, (s > 0 ? .26 : .18) - k * .05, .3 + k * .04, .48 + k * .04, { dry: .5, bristles: 10, taper: [.1, .25], tin: .8, seed: 7 + k * 3 + (s > 0 ? 20 : 0), margin: 12 });
    }
    // water: darkest passage, glints wiped back to paper
    Wa(e, g => g.ellipse(TCX, TCY + 6, TRX - 26, TRY - 16, 0, 0, Math.PI * 2), .4, .45, .8, [TCX - TRX, TCY - TRY, TCX + TRX, TCY + TRY], { blur: 3,
      grad: g => { const gr = g.createLinearGradient(0, TCY - TRY, 0, TCY + TRY); gr.addColorStop(0, gry(.58)); gr.addColorStop(1, gry(.3)); return gr; } });
    for (let i = 0; i < 10; i++) {
      const x = TCX - 250 + r() * 470, y = TCY - 14 + r() * 40, l = 30 + r() * 70;
      e.mg.save(); e.mg.globalCompositeOperation = 'lighten'; e.mg.strokeStyle = gry(.1 + r() * .1); e.mg.lineWidth = 1.5 + r() * 2.5;
      e.mg.beginPath(); e.mg.moveTo(x, y); e.mg.quadraticCurveTo(x + l * .5, y - 2, x + l, y + 1); e.mg.stroke(); e.mg.restore();
    }
    // staves: lines that follow the curve of the tub
    for (let k = 1; k < 12; k++) {
      const a = Math.PI * (k / 12), c = Math.cos(a);
      const xt = TCX - c * TRX, yt = TCY + Math.sin(a) * TRY, xb = TCX - c * TBRX, yb = TBY + Math.sin(a) * 52;
      Ln(e, [[xt, yt + 4], [lerp(xt, xb, .5) - c * 6, lerp(yt, yb, .5)], [xb, yb - 3]], 1.4, .34, .3 + k * .015, .4 + k * .015, { margin: 2, jit: .5 });
    }
    // rim
    Ln(e, arcPts(TCX, TCY, TRX, TRY, Math.PI, Math.PI * 2, 60), 3, .82, 0, .14);
    Ln(e, arcPts(TCX, TCY, TRX, TRY, 0, Math.PI, 60).reverse(), 6.5, .95, .04, .18, { taper: [.08, .12], tin: .6, tout: .5 });
    Ln(e, arcPts(TCX, TCY + 6, TRX - 26, TRY - 16, Math.PI * 1.05, Math.PI * 1.95, 40), 1.6, .6, .1, .2, { margin: 2 });
    // sides and base
    for (const s of [-1, 1]) Ln(e, [[sideX(0, s), TCY], [sideX(.5, s) + s * 6, (TCY + TBY) / 2], [sideX(1, s), TBY]], 5.5, .92, .12, .24, { taper: [.06, .3], tin: .9, tout: .5 });
    Ln(e, arcPts(TCX, TBY, TBRX, 52, Math.PI, 0, 50), 4.5, .88, .2, .3, { taper: [.06, .1] });
    // two bamboo hoops
    for (const [v, t0] of [[.22, .24], [.78, .3]]) {
      const yc = lerp(TCY, TBY, v), rx = lerp(TRX, TBRX, v) + 4, ry = lerp(TRY, 52, v);
      Wa(e, g => { arcPts(TCX, yc, rx, ry, 0, Math.PI, 40).forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); arcPts(TCX, yc + 16, rx, ry, Math.PI, 0, 40).forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); }, .34, t0, t0 + .12, [TCX - rx, yc, TCX + rx, yc + ry + 16], { blur: 1 });
      Ln(e, arcPts(TCX, yc, rx, ry, Math.PI, 0, 50), 2.4, .85, t0, t0 + .1, { margin: 3 });
      Ln(e, arcPts(TCX, yc + 16, rx, ry, Math.PI, 0, 50), 2.4, .85, t0 + .02, t0 + .12, { margin: 3 });
    }
    for (let i = 0; i < 3; i++) Ln(e, arcPts(TCX - 140 + i * 150, TCY + 4 + (i % 2) * 10, 50 - i * 6, 6, Math.PI * .12, Math.PI * .88, 12), 1.3, .12, .72 + i * .03, .78 + i * .03, { margin: 2 });
    Ln(e, [[30, TBY + 60], [300, TBY + 68], [620, TBY + 64], [880, TBY + 50]], 26, .14, .7, .88, { dry: .45, bristles: 10, taper: [.1, .3], seed: 5 });
    return fin(e, { bl: 5, ha: .32, seed: 3.3 });
  }
  function bakePulp() {
    const e = El(900, 500, .5, .9), r = mulberry(19);
    const clip = g => { g.beginPath(); g.ellipse(TCX, TCY + 6, TRX - 30, TRY - 20, 0, 0, Math.PI * 2); g.clip(); };
    for (const g of [e.mg, e.tg]) { g.save(); clip(g); }
    for (let i = 0; i < 46; i++) { // churned fibre: pale clouds rising through the dark water
      const x = TCX - 330 + r() * 660, y = TCY - 40 + r() * 86, rr = 10 + r() * 24;
      e.mg.save(); e.mg.filter = 'blur(5px)'; e.mg.fillStyle = gry(.25 + r() * .25);
      e.mg.beginPath(); e.mg.ellipse(x, y, rr * 1.9, rr * .42, 0, 0, Math.PI * 2); e.mg.fill(); e.mg.restore();
      e.tg.fillStyle = tcol(e, x / 900 * .3); e.tg.beginPath(); e.tg.ellipse(x, y, rr * 2.2, rr * .6, 0, 0, Math.PI * 2); e.tg.fill();
    }
    for (const g of [e.mg, e.tg]) g.restore();
    return fin(e, { bl: 6, ha: .1, seed: 6.6, cd: [.93, .92, .88], cl: [.93, .92, .88] });
  }
  function bakeBark() {
    const e = El(220, 200, .1);
    const c1 = [[18, 132], [70, 118], [118, 92], [158, 74]], c2 = [[24, 160], [76, 146], [126, 120], [168, 104]];
    Wa(e, poly([...spline(c1), ...spline(c2).reverse()]), .32, 0, .1, [18, 70, 170, 160], { blur: 1 });
    Ln(e, c1, 3, .85, 0, .05); Ln(e, c2, 3, .85, 0, .05);
    Ln(e, spiralPts(178, 90, 22, 4, 1.6, 1.9, .9), 3, .85, 0, .06);
    Wa(e, g => g.ellipse(176, 90, 18, 16, 0, 0, Math.PI * 2), .3, 0, .1, [158, 74, 194, 106], { blur: 1 });
    const r = mulberry(5);
    for (let i = 0; i < 16; i++) {
      const u = .05 + i / 16 * .85, p = spline(c1)[Math.floor(u * (spline(c1).length - 1))], q = spline(c2)[Math.floor(u * (spline(c2).length - 1))];
      Ln(e, [[lerp(p[0], q[0], .15 + r() * .2), lerp(p[1], q[1], .15 + r() * .2)], [lerp(p[0], q[0], .55 + r() * .3), lerp(p[1], q[1], .55 + r() * .3)]], 1.5, .62, 0, .1, { margin: 2 });
    }
    return fin(e, { bl: 3.5, seed: 1.9 });
  }
  function bakeHemp() {
    const e = El(220, 200, .1), r = mulberry(12);
    for (let i = 0; i < 30; i++) {
      const ya = 52 + r() * 96, yb = 46 + r() * 110, ym = 96 + (r() - .5) * 10;
      Ln(e, [[16 + r() * 20, ya], [60, lerp(ya, ym, .6) + (r() - .5) * 8], [104, ym], [150, lerp(ym, yb, .6) + (r() - .5) * 8], [196 + r() * 14, yb]], .9 + r() * .9, .4 + r() * .35, 0, .1, { margin: 2, jit: .5 });
    }
    for (let k = 0; k < 3; k++) Ln(e, [[96 + k * 7, 84], [99 + k * 7, 96], [96 + k * 7, 110]], 3.2, .92, 0, .1);
    return fin(e, { bl: 3, seed: 2.4 });
  }
  function bakeRag() {
    const e = El(220, 200, .1);
    const pts = outline(42, 48, 182, 152, 7, 41, 6).map(([x, y]) => { const a = .18, cx = 112, cy = 100; return [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]; });
    Wa(e, poly(pts), .15, 0, .1, [30, 30, 195, 170], { blur: 1 });
    for (const g of [e.mg, e.tg]) { g.save(); g.beginPath(); poly(pts)(g); g.clip(); }
    for (let i = -10; i < 22; i++) Ln(e, [[i * 9, 20], [i * 9 + 120, 190]], .8, .14, 0, .1, { margin: 1, raw: true, taper: [0, 0] });
    for (const g of [e.mg, e.tg]) g.restore();
    Ln(e, [...pts, pts[0]], 2.1, .72, 0, .1, { raw: true, taper: [0, 0], jit: .4 });
    Ln(e, [[70, 70], [120, 112], [150, 150]], 1.8, .45, 0, .1);
    const P = [[118, 74], [156, 82], [150, 112], [112, 104]];
    Wa(e, poly(P), .1, 0, .1, [112, 74, 156, 112], { blur: .5 });
    for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; for (let k = 0; k < 5; k++) { const u = (k + .2) / 5; Ln(e, [[lerp(a[0], b[0], u), lerp(a[1], b[1], u)], [lerp(a[0], b[0], u + .1), lerp(a[1], b[1], u + .1)]], 1.4, .7, 0, .1, { margin: 1, raw: true }); } }
    return fin(e, { bl: 3, seed: 3.1 });
  }
  function bakeNet() {
    const e = El(220, 200, .1);
    const blob = [];
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, rr = 78 + (fbm(i * .3, 2) - .5) * 26; blob.push([110 + Math.cos(a) * rr, 100 + Math.sin(a) * rr * .78]); }
    for (const g of [e.mg, e.tg]) { g.save(); g.beginPath(); poly(blob)(g); g.clip(); }
    for (let i = -12; i < 12; i++) {
      Ln(e, [[i * 19, 0], [i * 19 + 100, 100 + 6], [i * 19 + 200, 200]], 1.3, .72, 0, .1, { margin: 2, taper: [0, 0] });
      Ln(e, [[i * 19 + 220, 0], [i * 19 + 120, 100 + 6], [i * 19 + 20, 200]], 1.3, .72, 0, .1, { margin: 2, taper: [0, 0] });
    }
    for (let i = -12; i < 12; i++) for (let j = -12; j < 12; j++) {
      const x = 110 + (i + j) * 9.5, y = 100 + (j - i) * 9.5;
      dot(e, x, y + 3, 2.1, .9, 0);
    }
    for (const g of [e.mg, e.tg]) g.restore();
    Ln(e, [...blob, blob[0]], 2.6, .82, 0, .1, { raw: false, taper: [0, 0] });
    Wa(e, g => g.ellipse(184, 52, 13, 8, -.5, 0, Math.PI * 2), .35, 0, .1, [170, 42, 198, 62], { blur: .8 });
    Ln(e, arcPts(184, 52, 13, 8, 0, Math.PI * 2, 18).map(([x, y]) => { const a = -.5; return [184 + (x - 184) * Math.cos(a) - (y - 52) * Math.sin(a), 52 + (x - 184) * Math.sin(a) + (y - 52) * Math.cos(a)]; }), 2, .85, 0, .1, { raw: true });
    return fin(e, { bl: 3, seed: 4.4 });
  }
  function bakeMould() {
    const e = El(440, 300, .1, 1.15);
    const x0 = 20, y0 = 16, x1 = 420, y1 = 284;
    for (let y = y0 + 16; y < y1 - 12; y += 5) Ln(e, [[x0 + 12, y], [x1 - 12, y]], .85, .2, 0, .1, { margin: 1, raw: true, taper: [0, 0], jit: .1 });
    for (let k = 1; k < 7; k++) { const x = lerp(x0 + 12, x1 - 12, k / 7); Ln(e, [[x, y0 + 12], [x, y1 - 12]], 1.4, .5, 0, .1, { margin: 2, taper: [0, 0] }); }
    Ln(e, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], 5, .9, 0, .1, { raw: true, taper: [0, 0] });
    Ln(e, [[x0 + 12, y0 + 12], [x1 - 12, y0 + 12], [x1 - 12, y1 - 12], [x0 + 12, y1 - 12], [x0 + 12, y0 + 12]], 2.2, .7, 0, .1, { raw: true, taper: [0, 0] });
    Ln(e, [[2, 150], [x0, 150]], 7, .9, 0, .1); Ln(e, [[x1, 150], [438, 150]], 7, .9, 0, .1);
    return fin(e, { bl: 3, seed: 5.5 });
  }
  // the drying wall: one pale wash; brick courses are only suggested toward its edges and base, the rest left to the paper
  const WALLX = 1060, WALLY = 150;
  function bakeWall() {
    const e = El(820, 640, .7), r = mulberry(91);
    const x0 = 40, x1 = 790, y0 = 70, y1 = 590, bh = 37;
    Wa(e, g => g.rect(x0, y0 + 6, x1 - x0, y1 - y0 - 6), .06, .05, .4, [x0, y0, x1, y1], { dir: [0, 1], blur: 5,
      grad: g => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, gry(.05)); gr.addColorStop(1, gry(.1)); return gr; } });
    for (let row = 0, y = y0 + 6; y < y1 - 4; row++, y += bh) {
      let x = x0 - (row % 2 ? 46 : 0) - r() * 10;
      while (x < x1) {
        const bw = 78 + r() * 26, xa = Math.max(x0 + r() * 6, x + 3), xb = Math.min(x1 - r() * 6, x + bw - 3);
        const u = ((xa + xb) / 2 - x0) / (x1 - x0), v = (y - y0) / (y1 - y0);
        const show = fbm(xa * .007 + 3.1, y * .012 + 1.7, 3) + Math.max(0, Math.abs(u - .5) * 2 - .55) * .9 + v * v * .32 - (1 - v) * .06;
        const rk = r();
        if (xb - xa > 14 && show > .56) {
          const soot = smooth(y0 + 200, y1, y) * .06, tone = .1 + rk * .07 + soot;
          const tt = .1 + row * .035 + (xa - x0) / (x1 - x0) * .12;
          Wa(e, g => g.rect(xa, y + 2.5, xb - xa, bh - 5), tone, tt, tt + .1, [xa, y, xb, y + bh], { blur: 1.4 });
          if (r() < .35) Ln(e, [[xa + 6, y + bh * .5], [xb - 8, y + bh * .5 + (r() - .5) * 4]], 10, tone * .9, tt, tt + .1, { dry: .7, bristles: 5, seed: row * 13 + x, margin: 4 });
        }
        x += bw;
      }
    }
    Ln(e, [[x0 - 16, y0 - 2], [x1 / 2, y0 - 5], [x1 + 16, y0 - 1]], 14, .36, 0, .2, { dry: .3, bristles: 9, taper: [.04, .12], tin: .9, tout: .6, seed: 3 });
    Ln(e, [[x0 - 22, y0 + 6], [x1 + 22, y0 + 4]], 2.2, .7, .02, .2);
    Ln(e, [[x0 - 1, y0 + 8], [x0 + 2, y1]], 2.8, .6, .05, .2, { taper: [.1, .4], tin: .9 });
    Ln(e, [[x1 + 1, y0 + 8], [x1 - 1, y1 - 6]], 2.2, .45, .08, .22, { taper: [.1, .5], tin: .9 });
    Ln(e, [[x0 - 60, y1 + 4], [x1 / 2, y1], [x1 + 40, y1 + 4]], 3, .62, .12, .34);
    Ln(e, [[x0 - 70, y1 + 24], [x1 * .6, y1 + 20], [x1 + 30, y1 + 28]], 18, .1, .3, .5, { dry: .4, bristles: 7 });
    return fin(e, { bl: 4, ha: .25, seed: 7.1 });
  }
  const WSLOT = [[205, 300, -.012], [430, 304, .01], [655, 298, -.008]].map(([x, y, rot]) => ({ x: WALLX + x, y: WALLY + y, s: .82, rot }));

  // ---------------------------------------------------------------- beat 3: a horizon of mountains, dunes and a European mill
  const bump = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
  function ridge(x0, x1, base, peaks, amp, seed, step = 8, fade = 0) {
    const o = [];
    for (let x = x0; x <= x1 + .1; x += step) {
      let y = 0; for (const [c, h, w] of peaks) y = Math.max(y, h * bump(x, c, w));
      y += (fbm(x * .01 + seed, seed) - .5) * .18 + (vnoise(x * .05, seed) - .5) * .05;
      if (fade) y *= smooth(x0, x0 + fade, x) * smooth(x1, x1 - fade, x);
      o.push([x, base - amp * Math.max(0, y)]);
    }
    return o;
  }
  function bakeMountains() {
    const e = El(1150, 560, 1.0), base = 530;
    const far = ridge(0, 1150, 470, [[110, .55, 120], [380, .8, 140], [650, .7, 110], [930, .5, 150], [1100, .45, 120]], 300, 3);
    const near = ridge(0, 1150, 540, [[250, .95, 80], [330, .7, 60], [560, 1.25, 85], [640, .9, 60], [860, .85, 90], [1050, .6, 80]], 330, 7);
    const grad = (t0, t1, y0, y1) => g => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, gry(t0)); gr.addColorStop(.55, gry(t0 * .45)); gr.addColorStop(1, gry(0)); return gr; };
    Wa(e, poly([...far, [1150, base], [0, base]]), .16, 0, .5, [0, 120, 1150, base], { dir: [-1, 0], blur: 6, grad: grad(.17, 0, 150, 480) });
    Ln(e, far, 1.8, .22, .05, .5, { taper: [.02, .05], jit: .6, margin: 6 });
    Wa(e, poly([...near, [1150, base + 6], [0, base + 6]]), .3, .25, .8, [0, 80, 1150, base], { dir: [-1, 0], blur: 4, grad: grad(.4, 0, 120, 540) });
    Ln(e, near, 3, .72, .25, .78, { taper: [.02, .05], jit: .7, margin: 6 });
    const r = mulberry(55);
    for (const [c, h, w] of [[250, .95, 80], [560, 1.25, 85], [860, .85, 90], [330, .7, 60], [640, .9, 60]]) {
      const topY = 540 - 330 * h;
      for (let k = 0; k < 11; k++) { // 披麻皴: long soft strokes running down the slopes
        const side = k % 2 ? 1 : -1, sx = c + side * (8 + r() * w * .5), sy = topY + 30 + r() * 60;
        const len = 60 + r() * 110;
        Ln(e, [[sx, sy], [sx + side * len * .25, sy + len * .5], [sx + side * len * .38, sy + len]], 1.4 + r(), .36 + r() * .2, .55 + k * .02, .62 + k * .02, { margin: 3 });
      }
      for (let k = 0; k < 9; k++) { const x = c + (r() - .5) * w * .9; const y = 540 - 330 * h * bump(x, c, w) + 6 + r() * 8; dot(e, x, y, 1.6 + r() * 1.6, .85, .8 + k * .01); }
    }
    Ln(e, [[0, base + 2], [300, base - 2], [700, base + 3], [1150, base]], 2.6, .5, .6, .95, { margin: 6 });
    return fin(e, { bl: 6, ha: .3, seed: 9.3 });
  }
  function camel(e, x, y, s, t) { // walking left, flat Han-brick-style silhouette
    const P = (px, py) => [x + px * s, y + py * s];
    Wa(e, poly([P(-14, -26), P(-8, -36), P(0, -30), P(6, -37), P(14, -28), P(18, -20), P(14, -14), P(-14, -14), P(-18, -20)]), .85, t, t + .08, [x - 20 * s, y - 40 * s, x + 20 * s, y - 12 * s], { blur: .6 });
    Ln(e, [P(-15, -22), P(-22, -30), P(-27, -40), P(-31, -40)], 3.4 * s, .88, t, t + .06, { taper: [0, .2], tin: 1, tout: .7 });
    Ln(e, [P(-30, -41), P(-35, -38)], 3 * s, .88, t + .04, t + .06);
    for (const [a, b] of [[-11, -14], [-6, -10], [9, 12], [14, 18]]) Ln(e, [P(a, -15), P(b, 0)], 2 * s, .85, t + .04, t + .1, { taper: [0, .1], tin: 1, tout: .6 });
    Ln(e, [P(17, -24), P(21, -16)], 1.4 * s, .7, t + .08, t + .1);
  }
  function bakeDunes() {
    const e = El(1560, 330, 1.2), gy = 250;
    const r = mulberry(23);
    // rounded, wind-shaped sand hills: long windward slope, shorter shaded lee
    const prof = (c, h, wl, wr, x) => { const w = x < c ? wl : wr, d = (x - c) / w; return h * Math.exp(-d * d * (x < c ? 2.2 : 3.2)); };
    const dune = (c, h, wl, wr, base, near, t0) => {
      const P = []; for (let x = c - wl * 1.25; x <= c + wr * 1.15; x += 6) P.push([x, base - prof(c, h, wl, wr, x)]);
      erase(e, poly([...P, [c + wr * 1.15, base + 2], [c - wl * 1.25, base + 2]]));
      const bx = c - wl * .45;
      const shade = g => { g.moveTo(c, base - h); P.filter(p => p[0] > c).forEach(p => g.lineTo(p[0], p[1])); g.lineTo(c + wr * 1.15, base); g.lineTo(bx, base); g.quadraticCurveTo(c - wl * .1, base - h * .45, c, base - h); };
      Wa(e, shade, .1, t0 + .1, t0 + .3, [bx, base - h, c + wr, base], { blur: 6,
        grad: g => { const gr = g.createLinearGradient(bx, 0, c + wr * 1.15, 0); gr.addColorStop(0, gry(.02)); gr.addColorStop(.4, gry(near ? .22 : .13)); gr.addColorStop(1, gry(near ? .05 : .03)); return gr; } });
      Ln(e, P, near ? 2.3 : 1.5, near ? .58 : .32, t0, t0 + .3, { raw: true, taper: [.25, .2], tin: .1, tout: .2, margin: 5 });
      for (let k = 0; k < (near ? 4 : 2); k++) { // wind ripples on the windward slope
        const x = c - wl * (.75 - k * .16), y = base - prof(c, h, wl, wr, x) + 14 + k * 3;
        Ln(e, [[x - 30, y + 7], [x, y], [x + 26, y + 3]], 1, near ? .22 : .14, t0 + .2, t0 + .3, { margin: 2 });
      }
      for (let k = 0; k < (near ? 50 : 22); k++) {
        const x = c - wl * r() * 1.1, y = lerp(base - prof(c, h, wl, wr, x) + 6, base - 3, Math.pow(r(), .7));
        if (y < base - 2) dot(e, x, y, .7 + r() * .8, near ? .3 : .2, t0 + .22 + k * .002);
      }
    };
    [[1250, 62, 220, 110], [900, 56, 220, 100], [560, 70, 240, 110], [210, 54, 200, 90]].forEach(([c, h, wl, wr], i) => dune(c, h, wl, wr, gy - 28, false, .05 + i * .12));
    [[1340, 118, 260, 130], [1010, 88, 220, 110], [690, 138, 290, 140], [350, 98, 250, 120], [80, 72, 200, 100]].forEach(([c, h, wl, wr], i) => dune(c, h, wl, wr, gy, true, .2 + i * .14));
    Ln(e, [[0, gy + 3], [420, gy], [900, gy + 4], [1560, gy + 1]], 2.2, .45, 0, .6, { margin: 6 });
    [[860, 1.6], [940, 1.55], [1018, 1.5]].forEach(([x, s], i) => camel(e, x, gy + 2, s, .9 + i * .08));
    return fin(e, { bl: 5, ha: .28, seed: 2.2 });
  }
  function bakeEurope() {
    const e = El(860, 470, 1.2, 1.3), gy = 410;
    const hill1 = ridge(0, 860, gy, [[180, .62, 230], [620, .78, 260]], 240, 11, 10, 300);
    const hill2 = ridge(0, 860, gy, [[110, .52, 190], [430, .36, 220], [760, .5, 190]], 150, 13, 10, 220);
    const grad = (a, y0, y1) => g => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, gry(a)); gr.addColorStop(1, gry(0)); return gr; };
    Wa(e, poly([...hill1, [860, gy], [0, gy]]), .1, 0, .4, [0, 180, 860, gy], { dir: [1, 0], blur: 6, grad: grad(.11, 180, gy) });
    Ln(e, hill1, 1.6, .25, 0, .4, { margin: 5, jit: .5 });
    Wa(e, poly([...hill2, [860, gy], [0, gy]]), .16, .15, .5, [0, 260, 860, gy], { dir: [1, 0], blur: 5, grad: grad(.17, 270, gy) });
    Ln(e, hill2, 2, .42, .15, .5, { margin: 5, jit: .5 });
    Ln(e, [[0, gy], [300, gy - 2], [600, gy + 2], [860, gy]], 2.4, .5, .2, .55, { margin: 6 });
    // stream running under the wheel
    Ln(e, [[180, gy + 26], [380, gy + 20], [520, gy + 30], [700, gy + 24], [860, gy + 32]], 1.6, .4, .7, 1.0, { margin: 4 });
    Ln(e, [[220, gy + 46], [420, gy + 40], [560, gy + 50], [860, gy + 52]], 1.6, .36, .75, 1.05, { margin: 4 });
    const r = mulberry(8);
    for (let i = 0; i < 12; i++) { const x = 240 + r() * 560, y = gy + 32 + r() * 12; Ln(e, [[x, y], [x + 14 + r() * 14, y + 1]], 1.1, .3, .9 + i * .01, .95 + i * .01, { margin: 2 }); }
    // the mill house: timber frame, gable roof
    const hx = 300, hw = 170, hy = gy - 108;
    Wa(e, g => g.rect(hx, hy, hw, gy - hy), .07, .4, .6, [hx, hy, hx + hw, gy]);
    Wa(e, poly([[hx - 16, hy + 2], [hx + hw / 2, hy - 74], [hx + hw + 16, hy + 2]]), .26, .45, .65, [hx - 16, hy - 74, hx + hw + 16, hy], { dir: [0, 1] });
    Ln(e, [[hx - 18, hy + 4], [hx + hw / 2, hy - 76], [hx + hw + 18, hy + 4]], 3.6, .88, .4, .52, { raw: true, taper: [.05, .05] });
    for (let k = 1; k < 7; k++) { const u = k / 7; Ln(e, [[lerp(hx + hw / 2, hx - 10, u), lerp(hy - 72, hy + 2, u)], [lerp(hx + hw / 2, hx + hw + 10, u), lerp(hy - 72, hy + 2, u)]], 1.1, .35, .55, .6, { margin: 2 }); }
    Ln(e, [[hx, hy], [hx, gy]], 3, .85, .44, .5); Ln(e, [[hx + hw, hy], [hx + hw, gy]], 3, .85, .46, .52);
    Ln(e, [[hx, hy + 40], [hx + hw, hy + 40]], 1.8, .6, .5, .56);
    Ln(e, [[hx, hy], [hx + 50, hy + 40]], 1.6, .55, .52, .56); Ln(e, [[hx + hw, hy], [hx + hw - 50, hy + 40]], 1.6, .55, .52, .56);
    Wa(e, g => g.rect(hx + 64, gy - 50, 34, 50), .55, .56, .6, [hx + 64, gy - 50, hx + 98, gy]);
    Ln(e, [[hx + 120, hy + 54], [hx + 148, hy + 54], [hx + 148, hy + 78], [hx + 120, hy + 78], [hx + 120, hy + 54]], 1.8, .75, .58, .62, { raw: true, taper: [0, 0] });
    Ln(e, [[hx + 134, hy + 54], [hx + 134, hy + 78]], 1.2, .6, .6, .62); Ln(e, [[hx + 120, hy + 66], [hx + 148, hy + 66]], 1.2, .6, .6, .62);
    // trees: two poplars and a round tree
    for (const [tx, th, tw] of [[110, 210, 26], [160, 170, 22], [700, 120, 60]]) {
      Ln(e, [[tx, gy], [tx + 2, gy - th * .4]], 2.4, .7, .6, .66);
      const n = tw > 40 ? 70 : 46;
      for (let k = 0; k < n; k++) {
        const a = r() * Math.PI * 2, rr = Math.sqrt(r());
        const x = tx + Math.cos(a) * rr * tw, y = gy - th * .5 - th * .45 * (tw > 40 ? Math.sin(a) * rr * .8 : Math.sin(a) * rr * 1.1);
        Ln(e, [[x, y], [x + (tw > 40 ? 5 : 1.5), y + (tw > 40 ? 2 : 8)]], 2.2 + r() * 1.6, .35 + r() * .35, .65 + k * .004, .68 + k * .004, { margin: 3 });
      }
    }
    return fin(e, { bl: 5, ha: .3, seed: 6.4 });
  }
  function bakeWheel() {
    const e = El(170, 170, .3, 1.3), c = 85, R0 = 62;
    Ln(e, arcPts(c, c, R0, R0, 0, Math.PI * 2, 44), 3.2, .86, 0, .12);
    Ln(e, arcPts(c, c, R0 - 9, R0 - 9, 0, Math.PI * 2, 40), 1.6, .6, .05, .15, { margin: 2 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; Ln(e, [[c + Math.cos(a) * 8, c + Math.sin(a) * 8], [c + Math.cos(a) * (R0 - 8), c + Math.sin(a) * (R0 - 8)]], 2.2, .78, .12 + k * .01, .18 + k * .01, { margin: 2 }); }
    for (let k = 0; k < 16; k++) { const a = (k + .5) / 16 * Math.PI * 2; Ln(e, [[c + Math.cos(a) * (R0 - 2), c + Math.sin(a) * (R0 - 2)], [c + Math.cos(a) * (R0 + 13), c + Math.sin(a) * (R0 + 13)]], 3.6, .85, .18 + k * .005, .22 + k * .005, { margin: 2, taper: [.05, .05] }); }
    Wa(e, g => g.arc(c, c, 9, 0, Math.PI * 2), .85, .1, .12, [c - 9, c - 9, c + 9, c + 9], { blur: .5 });
    return fin(e, { bl: 3.5, seed: 3.8 });
  }
  // the westward route: dashes of ink that land one after another, with stops marked by dots
  const RX = -740, RY = 560;
  function bakeRoute() {
    const e = El(2560, 150, 2.9);
    const cp = [[1755, 652], [1520, 664], [1290, 650], [1050, 668], [830, 652], [600, 662], [340, 650], [90, 664], [-160, 652], [-420, 662], [-700, 650]]
      .map(([x, y]) => [x - RX, y - RY]);
    const P = spline(cp, 2);
    const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const tot = L[L.length - 1], tt = d => 2.9 * d / tot;
    let i = 0;
    for (let d = 14; d < tot - 14; d += 36) {
      const seg = []; while (i < P.length && L[i] < d) i++;
      let j = i; while (j < P.length && L[j] < d + 22) seg.push(P[j++]);
      if (seg.length > 1) Ln(e, seg, 4.2, .93, tt(d), tt(d + 22), { raw: true, taper: [.2, .3], tin: .6, tout: .5, margin: 5 });
    }
    for (const [d, rr] of [[0, 8], [tot * .33, 5], [tot * .68, 5], [tot, 8]]) {
      const k = L.findIndex(v => v >= d - .5); const p = P[k < 0 ? P.length - 1 : k];
      dot(e, p[0], p[1], rr, .95, tt(d));
    }
    return fin(e, { bl: 4, ha: .35, seed: 5.2 });
  }

  // ---------------------------------------------------------------- camera: the handscroll rolls right-to-left
  // vignettes sit at world x 0, -1920, -3840, -5760 (and the Silk Road beyond); screen x = world x + OX(t)
  function OX(t) {
    return 1920 * ease.inOut(inv(5.45, 6.6, t)) + 1920 * ease.inOut(inv(10.5, 11.55, t))
      + 1920 * ease.inOut(inv(15.2, 16.35, t)) + 1150 * smooth(15.95, 19.9, t) + Math.min(t, 21.5) * 3;
  }

  // ---------------------------------------------------------------- assets
  const TILE = 1920, TILES = [-4, -3, -2, -1, 0];
  const tiles = {}, E = {};

  function bakePaper() {
    const r = mulberry(606);
    const fibres = [];
    for (let i = 0; i < 4200; i++) {
      const x = -4 * TILE - 200 + r() * (5 * TILE + 400), y = -60 + r() * (H + 120);
      const len = 40 + Math.pow(r(), 2) * 300, a = r() * Math.PI, bend = (r() - .5) * 1.1;
      const light = r() < .7;
      fibres.push({ x, y, len, a, bend, w: .4 + r() * .9, light, al: light ? .1 + r() * .2 : .014 + r() * .03 });
    }
    for (const k of TILES) {
      const c = GL.bake(PAPER, TILE, H, { OFF: [k * TILE, 0] });
      const g = c.getContext('2d');
      g.lineCap = 'round';
      for (const f of fibres) {
        const x = f.x - k * TILE;
        if (x < -340 || x > TILE + 340) continue;
        const dx = Math.cos(f.a) * f.len / 2, dy = Math.sin(f.a) * f.len / 2;
        g.strokeStyle = f.light ? `rgba(255,253,247,${f.al})` : `rgba(120,104,82,${f.al})`;
        g.lineWidth = f.w;
        g.beginPath(); g.moveTo(x - dx, f.y - dy);
        g.quadraticCurveTo(x - dy * f.bend, f.y + dx * f.bend, x + dx, f.y + dy); g.stroke();
      }
      tiles[k] = c;
    }
  }

  function bakeTitle() {
    const sw = El(1240, 300, .55);
    stroke(sw, [[90, 172], [330, 160], [640, 151], [930, 142], [1170, 130]], { w: 118, tone: .16, t0: 0, t1: .55, dry: .5, bristles: 26, taper: [.03, .4], tin: .85, tout: .25, jit: .03, fade: .4, seed: 3, margin: 30 });
    E.swash = fin(sw, { bl: 9, ha: .45, seed: 2.2 });
    const tt = El(760, 380, 1.5);
    glyph(tt, '造', 225, 300, 272, '"Zhi Mang Xing"', { t0: 0, t1: .72, tone: .97, key: (cp, gw) => cp.mx > gw * .42 ? cp.miny : 1000 + cp.minx });
    glyph(tt, '纸', 530, 316, 272, '"Zhi Mang Xing"', { t0: .78, t1: 1.5, tone: .97, key: cp => cp.minx * 1.2 + cp.miny * .5 });
    E.title = fin(tt, { bl: 4, ha: .3, seed: 5.1 });
  }
  function bakeQuote() {
    const q = El(330, 640, 2.2);
    const c1 = '缣贵而简重', c2 = '并不便于人', S = 96, step = 112;
    [...c1].forEach((g, i) => glyph(q, g, 250, 100 + i * step, S, '"Ma Shan Zheng"', { t0: i * .22, t1: i * .22 + .2, tone: .93 }));
    [...c2].forEach((g, i) => glyph(q, g, 100, 150 + i * step, S, '"Ma Shan Zheng"', { t0: 1.1 + i * .22, t1: 1.1 + i * .22 + .2, tone: .93 }));
    E.quote = fin(q, { bl: 4, ha: .3, seed: 7.7 });
  }
  function bakeAll() {
    bakePaper(); bakeTitle(); bakeQuote();
    E.slips = bakeSlips(1.2); E.silk = bakeSilk(1.15);
    E.vat = bakeVat(); E.pulp = bakePulp(); E.mats = [bakeBark(), bakeHemp(), bakeRag(), bakeNet()];
    E.mould = bakeMould(); E.wall = bakeWall();
    E.wet = bakeSheet(366, 232, 2, 3, 0, 0);
    E.dry = [bakeSheet(200, 280, 0, 11), bakeSheet(200, 280, 0, 12), bakeSheet(200, 280, 0, 13)];
    E.seal = bakeSeal(40, 108, '蔡侯纸');
    E.frag = bakeSheet(480, 350, 1, 21, 2);
    E.fragEl = (() => { // the fragment emerges from the middle outward, as if soil were brushed away
      const c = E.frag, e = El(c.width, c.height, 1.0), cx = c.width / 2, cy = c.height / 2;
      e.tg.globalCompositeOperation = 'darken';
      for (let k = 40; k >= 0; k--) {
        const u = k / 40, rx = 30 + u * c.width * .62, ry = 22 + u * c.height * .62;
        e.tg.fillStyle = tcol(e, u * .95); e.tg.beginPath();
        for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, w = 1 + (fbm(Math.cos(a) * 1.6 + k * .7, Math.sin(a) * 1.6 + 3) - .5) * .45;
          e.tg.lineTo(cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w); }
        e.tg.fill();
      }
      return fin(e, { img: c, fade: .5 });
    })();
    E.sheetB = bakeSheet(520, 360, 0, 31);
    E.zhi = (() => { const e = El(300, 300, .7); glyph(e, '纸', 150, 232, 230, '"Ma Shan Zheng"', { t0: 0, t1: .7, tone: .95, key: cp => cp.minx * 1.2 + cp.miny * .5 }); return fin(e, { bl: 4.5, ha: .34, seed: 9.9 }); })();
    E.cover = [bakeSheet(370, 268, 0, 41), bakeSheet(370, 268, 0, 42), bakeSheet(370, 268, 0, 43)];
    E.miniSlips = bakeSlips(.52, .75, .55); E.miniSilk = bakeSilk(.48, .75, .5);
    E.mtn = bakeMountains(); E.dunes = bakeDunes(); E.europe = bakeEurope(); E.wheel = bakeWheel(); E.route = bakeRoute();
  }

  // ---------------------------------------------------------------- per-frame helpers
  const inkA = a => `rgba(${ICOL[0]},${ICOL[1]},${ICOL[2]},${a})`;
  function ripple(ctx, x, y, tl, s = 1) { // rings spreading on water after something lands
    if (tl <= 0 || tl > 1.1) return;
    ctx.save(); ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const u = tl - k * .14; if (u <= 0) continue;
      const rr = (16 + u * 120) * s, a = .42 * (1 - smooth(.1, 1, u));
      ctx.strokeStyle = inkA(a); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y, rr, rr * .16, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, rr, rr * .16, 0, Math.PI * .1, Math.PI * .9); ctx.stroke();
    }
    ctx.restore();
  }
  function splash(ctx, x, y, tl, seed) { // a few droplets thrown up
    if (tl <= 0 || tl > .6) return;
    const r = mulberry(seed);
    ctx.save();
    for (let k = 0; k < 7; k++) {
      const vx = (r() - .5) * 260, vy = -160 - r() * 160, px = x + vx * tl, py = y + vy * tl + 900 * tl * tl;
      if (py > y + 4) continue;
      ctx.fillStyle = inkA(.35 * (1 - tl / .6)); ctx.beginPath(); ctx.ellipse(px, py, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drop(ctx, x, y0, y1, tl) { // a falling water drop, then a tiny ring
    if (tl <= 0) return;
    const y = y0 + 1400 * tl * tl;
    if (y < y1) {
      ctx.fillStyle = inkA(.32);
      ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.quadraticCurveTo(x + 4.5, y - 1, x, y + 3); ctx.quadraticCurveTo(x - 4.5, y - 1, x, y - 9); ctx.fill();
    } else ripple(ctx, x, y1, (tl - Math.sqrt((y1 - y0) / 1400)) * 1.6, .35);
  }
  // sheet canvases are drawn centred; s = scale, rot = radians
  function sheetAt(ctx, c, x, y, s = 1, rot = 0, a = 1) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.drawImage(c, -c.width / 2, -c.height / 2); ctx.restore();
  }

  // subs() lays each glyph at its left-edge advance but with textAlign 'center', which pushes narrow glyphs (· and
  // digits) half their width to the left. This view of the context keeps every glyph left-aligned at its advance.
  const LEFTSET = { get: (o, k) => { const v = o[k]; return typeof v === 'function' ? v.bind(o) : v; },
    set: (o, k, v) => { o[k] = k === 'textAlign' && v === 'center' ? 'left' : v; return true; } };
  const leftSet = ctx => new Proxy(ctx, LEFTSET);

  // ---------------------------------------------------------------- incoming transition
  // ink blooms out from the centre and swallows the previous frame, then thins back to bare xuan paper from the
  // middle, leaving a grey wet ring with a fibrous edge where it is still drying
  const BLOOM = `uniform sampler2D A; uniform sampler2D B; uniform float P; uniform vec2 D;
  void main(){ vec2 p=uv; vec2 q=(p-D)*vec2(R.x/R.y,1.);
    float n=fbm(p*vec2(4.6,3.)+2.3);
    float f=vn(vec2(dot(p*R,vec2(.94,.34))*.06,dot(p*R,vec2(-.34,.94))*.7));
    float d=length(q)*.9+(n-.5)*.5+(f-.5)*.035;
    float r1=P*1.9-.05, r2=(P-.2)*1.78;
    float ink=smoothstep(r1+.015,r1-.05,d);
    float pap=smoothstep(r2+.02,r2-.07,d);
    vec3 a=texture(A,p).rgb, b=texture(B,p).rgb;
    vec3 inkc=vec3(.075,.068,.06)*(.82+.36*n);
    vec3 col=mix(a,a*.45,smoothstep(r1+.09,r1,d)*(1.-ink));
    col=mix(col,inkc,ink*.97);
    float wet=smoothstep(r2+.16,r2,d)*(1.-pap);
    col=mix(col,mix(inkc,b,.35+.25*f),wet*.7);
    col=mix(col,b*(1.-.12*smoothstep(r2-.12,r2,d)),pap);
    O=vec4(col,1.); }`;
  TRANS.paper_inkbloom = (ctx, A, B, p, o) => ctx.drawImage(GL.run(BLOOM, W, H, { A, B, P: p, D: o.at || [.5, .6] }), 0, 0);

  // ---------------------------------------------------------------- scene
  scene({
    id: 'paper', n: ch.n, dur: ch.dur,
    trans: { type: 'paper_inkbloom', d: 1.1, at: [.5, .6] },
    cues: [
      { t: .1, sfx: 'ink', v: .55 }, { t: .62, sfx: 'brush' }, { t: 1.4, sfx: 'brush', v: .8 },          // ink bloom, title written
      { t: 2.45, sfx: 'brush', v: .6 }, { t: 3.7, sfx: 'bamboo', v: .6 }, { t: 4.4, sfx: 'brush', v: .5 }, // quote, slips, silk
      { t: 6.95, sfx: 'water', v: .6 }, { t: 7.3, sfx: 'water', v: .5 }, { t: 8.0, sfx: 'water', v: .5 }, // materials hit the vat
      { t: 8.42, sfx: 'water', v: .7 }, { t: 8.7, sfx: 'paper' }, { t: 9.42, sfx: 'drip', v: .6 },        // mould dips, lifts, drips
      { t: 10.0, sfx: 'paper', v: .7 }, { t: 10.4, sfx: 'stamp' },                                         // onto the wall, seal
      { t: 11.35, sfx: 'brush', v: .6 }, { t: 12.4, sfx: 'paper', v: .7 }, { t: 12.95, sfx: 'brush', v: .7 }, // fragment, sheet, 纸
      { t: 14.07, sfx: 'paper', v: .5 }, { t: 14.77, sfx: 'paper', v: .5 },                                // sheets cover slips and silk
      { t: 15.95, sfx: 'ink', v: .6 }, { t: 18.85, sfx: 'water', v: .6 },                                  // route sets out, mill wheel
    ],
    init() { bakeAll(); },
    draw(ctx, t) {
      const ox = Math.round(OX(t));
      for (const k of TILES) { const x = k * TILE + ox; if (x < W && x + TILE > 0) ctx.drawImage(tiles[k], x, 0); }
      ctx.save(); ctx.translate(ox, 0);
      const vis = (x0, x1) => x1 + ox > -40 && x0 + ox < W + 40;

      // ---- beat 0: the title is written, then the 后汉书 quote, a heavy pile of slips and a costly bolt of silk
      if (vis(0, 1920)) {
        const ta = 1 - smooth(3.0, 3.5, t);
        drawEl(ctx, E.swash, 960 - 620, 262, t - .05, ta * .85);
        drawEl(ctx, E.title, 960 - 380, 140, t - .6, ta);
        drawEl(ctx, E.quote, 1460, 150, t - 2.45);
        drawEl(ctx, E.slips, 330, 350, t - 3.62);
        drawEl(ctx, E.silk, 100, 40, t - 4.3);
      }
      // ---- beat 1: bark, hemp, rags and a net drop into the vat; the mould lifts a sheet; it dries on the wall
      const B1 = -1920;
      if (vis(B1, 0)) {
        ctx.save(); ctx.translate(B1, 0);
        drawEl(ctx, E.vat, VX, VY, t - 5.95);
        drawEl(ctx, E.pulp, VX, VY, t - 8.05, .9);
        const mats = [[390, 6.5, -.4], [520, 6.85, .5], [640, 7.2, -.2], [760, 7.55, .3]];
        mats.forEach(([mx, t0, rot], i) => {
          const u = t - t0; if (u <= 0) return;
          const fall = .45, e = E.mats[i];
          const y = u < fall ? lerp(-150, WL - 34, (u / fall) * (u / fall)) : WL - 34 + Math.min(1, (u - fall) / .5) * 30;
          const a = u < fall ? 1 : 1 - smooth(fall, fall + .55, u);
          ctx.save(); ctx.beginPath(); ctx.rect(0, -400, 1920, WL + 400 - 10 + (u < fall ? 400 : 0)); ctx.clip();
          sheetAt(ctx, e.canvas, mx, y, 1.25, rot + u * .9 * (i % 2 ? 1 : -1), a);
          ctx.restore();
          ripple(ctx, mx, WL, u - fall, 1);
          splash(ctx, mx, WL - 8, u - fall, 50 + i);
        });
        // mould: dips edge-on into the vat, lifts tilted toward us with a wet sheet; the sheet is carried to the wall
        const mc = 566, mt0 = 8.05, MY = 214;
        const dip = smooth(mt0, mt0 + .4, t), lift = ease.inOut(inv(mt0 + .55, mt0 + 1.15, t));
        const fly = ease.inOut(inv(9.45, 10.05, t));
        if (t > mt0 - .05 && t < 10.8) {
          const sy = lerp(.12, .78, lift), my = lift > 0 ? lerp(WL + 12, MY, lift) : lerp(WL - 240, WL + 12, dip);
          const ma = smooth(mt0 - .05, mt0 + .15, t) * (1 - smooth(10.25, 10.8, t));
          ctx.save();
          if (lift < .3) { ctx.beginPath(); ctx.rect(0, -400, 1920, WL + 400 - 4); ctx.clip(); }
          ctx.globalAlpha = ma; ctx.translate(mc, my - (1 - ma) * 0); ctx.scale(1, sy); ctx.transform(1, 0, lerp(-.3, -.12, lift), 1, 0, 0);
          ctx.drawImage(E.mould.canvas, -E.mould.w / 2, -E.mould.h / 2);
          if (t > mt0 + .5 && fly <= 0) { ctx.scale(1.15, 1.15); ctx.drawImage(E.wet, -E.wet.width / 2, -E.wet.height / 2); }
          ctx.restore();
        }
        for (let k = 0; k < 8; k++) { // drips from the lifted mould
          const x = mc - 200 + k * 54 + (hash2(k, 3) - .5) * 20;
          drop(ctx, x, MY + 132, WL, t - (mt0 + 1.05 + k * .11 + hash2(k, 9) * .12));
        }
        drawEl(ctx, E.wall, WALLX, WALLY, t - 6.15);
        const S0 = WSLOT[0];
        [1, 2].forEach(k => { const S = WSLOT[k]; sheetAt(ctx, E.dry[k], S.x, S.y, S.s, S.rot, smooth(6.3 + k * .2, 6.7 + k * .2, t)); });
        if (fly > 0) {
          const x = lerp(mc, S0.x, fly), y = lerp(MY, S0.y, fly) - Math.sin(fly * Math.PI) * 80;
          const dryk = smooth(9.9, 10.35, t), rot = lerp(0, -Math.PI / 2, fly);
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(lerp(1.15, .63, fly), lerp(1.15, .63, fly) * lerp(.78, 1, fly));
          sheetAt(ctx, E.wet, 0, 0, 1, 0, 1 - dryk); ctx.restore();
          sheetAt(ctx, E.dry[0], x, y, S0.s, rot + Math.PI / 2 + S0.rot * fly, dryk);
        }
        if (t > 10.4) { // seal pressed into the corner of the new sheet
          const u = t - 10.4, s = 1 + .14 * (1 - ease.out(clamp(u / .12)));
          sheetAt(ctx, E.seal, S0.x - 52, S0.y + 60, s * .9, S0.rot, smooth(0, .06, u));
        }
        ctx.restore();
      }
      // ---- beat 2: an excavated Western Han fragment beside the finished sheet; paper covers slips and silk
      const B2 = -3840;
      if (vis(B2, B2 + 1920)) {
        ctx.save(); ctx.translate(B2, 0);
        ctx.save(); ctx.translate(400, 420); ctx.rotate(-.045);
        drawEl(ctx, E.fragEl, -E.frag.width / 2, -E.frag.height / 2, t - 11.2); ctx.restore();
        const sb = ease.out(inv(12.2, 12.9, t));
        sheetAt(ctx, E.sheetB, 965 + (1 - sb) * 180, 440 + (1 - sb) * 10, 1, .022 + (1 - sb) * .05, smooth(12.2, 12.5, t));
        if (t > 12.9) { ctx.save(); ctx.translate(965, 440); ctx.rotate(.022); drawEl(ctx, E.zhi, -150, -150, t - 12.92); ctx.restore(); } // written on paper
        const fadeOld = 1 - smooth(14.1, 15.0, t);
        drawEl(ctx, E.miniSilk, 1360, 266, t - 13.15, fadeOld);
        drawEl(ctx, E.miniSlips, 1365, 424, t - 13.3, fadeOld);
        [[13.95, 1560, 470, .03], [14.3, 1568, 478, -.025], [14.65, 1556, 474, .012]].forEach(([t0, x, y, rot], i) => {
          const u = ease.out(inv(t0, t0 + .35, t));
          sheetAt(ctx, E.cover[i], x + (1 - u) * 40, y - (1 - u) * 90, 1 + (1 - u) * .06, rot + (1 - u) * .08, smooth(t0, t0 + .12, t));
        });
        ctx.restore();
      }
      // ---- beat 3: the craft travels west across mountains and dunes to a European water mill
      const B3 = -5760;
      if (vis(B3 - 1400, B3 + 1920)) {
        ctx.save(); ctx.translate(B3, 0);
        drawEl(ctx, E.mtn, 900, 120, t - 15.25);
        drawEl(ctx, E.dunes, -420, 400, t - 15.75);
        drawEl(ctx, E.europe, -1350, 117, t - 17.2);
        const wt = t - 17.7;
        if (wt > 0) {
          ctx.save(); ctx.translate(-653, 642);
          ctx.rotate(-Math.max(0, t - 18.7) * (.6 + .5 * smooth(18.7, 19.6, t)));
          drawEl(ctx, E.wheel, -E.wheel.w / 2, -E.wheel.h / 2, wt); ctx.restore();
        }
        drawEl(ctx, E.route, RX, RY, t - 15.95);
        if (t > 15.6) { // a skein of wild geese, the old letter-carriers, flying west with the route
          ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          const lead = 1480 - (t - 15.6) * 430, a = smooth(15.6, 16.2, t);
          [[0, 0], [46, -22], [92, -40], [44, 26], [90, 50], [138, 70]].forEach(([dx, dy], i) => {
            const x = lead + dx, y = 250 + dy + Math.sin(t * 1.3 + i) * 3, f = Math.sin(t * 7.5 + i * 1.1), s = 1 - i * .04;
            ctx.strokeStyle = inkA(.78 * a); ctx.lineWidth = 2.6 * s;
            ctx.beginPath(); ctx.moveTo(x + 15 * s, y - 7 * f * s); ctx.quadraticCurveTo(x + 6 * s, y - 4 * s - 3 * f * s, x, y);
            ctx.quadraticCurveTo(x - 4 * s, y - 5 * s - 4 * f * s, x - 2 * s, y - 13 * f * s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - 7 * s, y + 1); ctx.lineTo(x + 9 * s, y + 1); ctx.stroke();
          });
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.restore();

      opener(ctx, t, Object.assign({}, ch, { title: '' }), {
        ink: SUBINK, sub: '#3a342c', accent: RED, y: 470, inAt: .55, outAt: 3.0,
        small: { family: '"Noto Serif SC"', size: 30, weight: 600 },
        num: { family: '"Noto Serif SC"', size: 64, weight: 700 },
      });
      subs(leftSet(ctx), t, ch, { ink: SUBINK, body: { family: '"Noto Serif SC"', size: 52, weight: 600 } });
      vignette(ctx, .16, '96,80,56', .5);
    },
  });
})();
