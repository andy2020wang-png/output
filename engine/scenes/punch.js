// 08 打孔卡 — cyanotype engineering blueprint. One drawing sheet, the camera travels between its views:
// Jacquard head reading a card chain → Hollerith card punched and tabulated → time dimensions →
// company lineage → archive shelving scorched and soaked → the remnant stack, outlined and dimensioned.
'use strict';
(() => {
  const ch = CH('punch');
  const LN = '#E9F1FB', RED = '#F2703E', SUB = '#B9CDE6';
  const SANS = '"Noto Sans SC"', MONO = '"Space Mono"';

  // ---------- sheet layout & camera ----------
  const VIEW = [[0, 0], [2100, 0], [2100, 1200], [4200, 1200], [4200, 0]];
  const PANS = [[5.72, 6.62, 0, 1], [10.02, 10.92, 1, 2], [14.5, 15.4, 2, 3], [18.78, 19.68, 3, 4]];
  const REM = { x: 258, y: 766, w: 32, h: 14 };      // the remnant stack, view-4 local coordinates
  function cam(t) {
    let cx = VIEW[0][0] + 960, cy = VIEW[0][1] + 540, s = 1;
    for (const [a, b, i, j] of PANS) {
      if (t >= b) { cx = VIEW[j][0] + 960; cy = VIEW[j][1] + 540; continue; }
      if (t > a) {
        const p = ease.inOut((t - a) / (b - a));
        cx = lerp(VIEW[i][0], VIEW[j][0], p) + 960; cy = lerp(VIEW[i][1], VIEW[j][1], p) + 540;
        s = 1 - .14 * Math.sin(Math.PI * p);
      }
      break;
    }
    const z = ease.inOut(clamp((t - 26.1) / 2.65));
    if (z > 0) {
      const tx = VIEW[4][0] + REM.x + 110, ty = VIEW[4][1] + REM.y - 50;   // frames remnant + callout as one group
      cx = lerp(cx, tx, z); cy = lerp(cy, ty, z); s = lerp(1, 2.0, z);
    }
    return { cx, cy, s };
  }

  // ---------- textures ----------
  // Tileable cyanotype paper (1024²): Prussian-blue mottling, coating brush streaks, fibres, specks, fold creases.
  const PAPER = `
  float hp(vec2 i, vec2 per){ return h21(mod(i, per) + 17.); }
  float vnp(vec2 p, vec2 per){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hp(i,per),hp(i+vec2(1,0),per),u.x),mix(hp(i+vec2(0,1),per),hp(i+vec2(1,1),per),u.x),u.y); }
  float fbmp(vec2 p, vec2 per){ float s=0.,a=.5; for(int k=0;k<5;k++){ s+=a*vnp(p,per); p*=2.; per*=2.; a*=.5; } return s; }
  void main(){
    vec2 px = uv*R, p = uv;
    float m = fbmp(p*4., vec2(4.)), m2 = fbmp(p*12., vec2(12.));
    float fib = vnp(vec2(p.x*170., p.y*36.), vec2(170., 36.));
    float fib2 = vnp(vec2(p.x*28., p.y*230.), vec2(28., 230.));
    float brush = vnp(vec2(p.x*3., p.y*30.), vec2(3., 30.));
    vec3 deep = vec3(.052,.17,.33), base = vec3(.071,.227,.42), pale = vec3(.14,.32,.53);
    vec3 col = mix(deep, base, smoothstep(.22,.68,m));
    col = mix(col, pale, smoothstep(.56,.86,m2)*.42);
    col *= .95 + .08*brush;
    col += (fib-.5)*.03 + (fib2-.5)*.022;
    col += step(.9988, h21(floor(px/2.)+3.))*.16;
    col -= step(.9993, h21(floor(px/3.)+9.))*.05;
    col += .05*exp(-px.x/2.2) - .035*exp(-(R.x-px.x)/3.) + .035*exp(-px.y/2.2) - .025*exp(-(R.y-px.y)/3.);
    col += .018*(exp(-min(px.x,R.x-px.x)/22.) + exp(-min(px.y,R.y-px.y)/22.))*vnp(p*40., vec2(40.));
    O = vec4(col, 1.); }`;

  // Scorch + water overlay for the archive view (half resolution, mapped into view-4 coordinates).
  const FIRE = `
  uniform vec3 CAM; uniform vec2 OFF; uniform float XF; uniform float ACT; uniform float WT; uniform float FT;
  float off(float y){ return 70.*sin(y*.0062+1.3)+30.*sin(y*.0165+4.1); }
  void main(){
    vec2 sp = vec2(uv.x, 1.-uv.y)*vec2(1920., 1080.);
    vec2 q = (sp - vec2(960., 540.))/CAM.z + CAM.xy - OFF;
    float n = fbm3(q*.0065)*80. + vn(q*.045)*14. - 46.;
    // fire climbs: the front lags below the floor line, which keeps the subtitle zone clear of the rim and char
    float d = q.x + off(q.y) + n - XF - 520.*smoothstep(700., 940., q.y);
    vec3 col = vec3(0.); float a = 0.;
    // scorched band ahead of the char
    float sc = smoothstep(-230., 0., d);
    col = vec3(.4,.24,.11); a = pow(sc, 1.6)*.6;
    // char
    float chr = smoothstep(2., 60., d);
    vec3 charc = mix(vec3(.1,.065,.045), vec3(.24,.16,.1), fbm3(q*.018+3.));
    col = mix(col, charc, chr); a = max(a, chr*.88);
    float edge = exp(-abs(d-5.)/7.)*(1.-ACT*.7);
    col = mix(col, vec3(.05,.03,.02), edge*.8); a = max(a, edge*.85);
    // glowing rim while the fire is alive
    float fl = .75 + .25*vn(vec2(q.y*.05, FT*9.));
    float rim = exp(-abs(d-6.)/9.)*ACT*fl;
    float ember = smoothstep(.8, .97, vn(q*.13 + vec2(0., FT*1.5)))*chr*(1.-smoothstep(25., 110., d))*ACT;
    vec3 glow = vec3(1.,.5,.13)*rim*1.25 + vec3(1.,.42,.1)*ember*.6;
    // water streaks running down
    float cw = 46., id = floor(q.x/cw), h = h21(vec2(id, 7.)), h2 = h21(vec2(id, 13.));
    float wet = 0., tide = 0.;
    if (h > .32 && q.x > 520. && q.x < 1900. && WT > 0.) {
      float cxs = (id + .5 + (h2-.5)*.3)*cw;
      float wob = sin(q.y*.021 + id*1.7)*3. + (vn(vec2(q.y*.03, id))-.5)*5.;
      float wdt = 4.5 + 6.*h2;
      float top = 20. + 160.*h21(vec2(id, 3.));
      float len = max(0., WT - 1.3*h21(vec2(id, 5.)))*(230. + 330.*h);
      float bot = top + len;
      float dx = abs(q.x - cxs - wob);
      float body = smoothstep(wdt, wdt*.5, dx)*step(top, q.y)*smoothstep(bot+2., bot-8., q.y);
      float head = smoothstep(wdt*1.35, wdt*.9, length(vec2(q.x - cxs - wob, (q.y - bot)*.75)))*step(1., len)*step(bot, 1060.);
      wet = max(body, head);
      tide = wet*smoothstep(wdt*.35, wdt*.9, dx);
    }
    float dry = 1. - .35*smoothstep(2.5, 6., WT);
    vec3 wcol = mix(vec3(.03,.12,.25), vec3(.16,.13,.11), chr);
    col = mix(col, wcol, wet*.6*dry); a = max(a, wet*.45*dry);
    col += vec3(.55,.72,.9)*tide*.35*dry; a = max(a, tide*.3*dry);
    O = vec4(col + glow, clamp(a + max(rim, ember)*.9, 0., 1.)); }`;

  let paper, L, Lg, G1, G1g, TA, TAg, HB, HBg, loop;

  // ---------- drawing helpers (all in the current transform of the line layer) ----------
  const S = (g, w, a = 1, col = LN) => { g.lineWidth = w; g.strokeStyle = rgba(col, a); };
  function poly(g, P, p = 1, close = false) {
    if (p <= 0) return;
    const Q = close ? [...P, P[0]] : P;
    let tot = 0; const seg = [];
    for (let i = 1; i < Q.length; i++) { const d = Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]); seg.push(d); tot += d; }
    let rem = tot * clamp(p);
    g.beginPath(); g.moveTo(Q[0][0], Q[0][1]);
    for (let i = 1; i < Q.length && rem > 0; i++) {
      const k = Math.min(1, rem / seg[i - 1]);
      g.lineTo(lerp(Q[i - 1][0], Q[i][0], k), lerp(Q[i - 1][1], Q[i][1], k)); rem -= seg[i - 1];
    }
    g.stroke();
  }
  const line = (g, x0, y0, x1, y1, p = 1) => poly(g, [[x0, y0], [x1, y1]], p);
  const rectP = (g, x, y, w, h, p = 1) => poly(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], p, true);
  function circP(g, x, y, r, p = 1, a0 = -Math.PI / 2) {
    if (p <= 0) return; g.beginPath(); g.arc(x, y, r, a0, a0 + Math.PI * 2 * clamp(p)); g.stroke();
  }
  function arrow(g, x, y, ang, sz = 13, a = 1) {
    const c = Math.cos(ang), s = Math.sin(ang);
    g.fillStyle = rgba(LN, a);
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x - sz * c + sz * .28 * s, y - sz * s - sz * .28 * c);
    g.lineTo(x - sz * c - sz * .28 * s, y - sz * s + sz * .28 * c);
    g.closePath(); g.fill();
  }
  function hatch(g, x, y, w, h, sp = 10) {
    if (w <= 0) return;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.beginPath(); for (let k = -h; k < w; k += sp) { g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); } g.stroke();
    g.restore();
  }
  // subs() sets textAlign 'center' and lib.js revealText() then places each glyph at its left-edge advance, so every
  // glyph is shifted left by half its own width: narrow Latin glyphs collide ("IBM") and spaces vanish ("1924 年").
  // Hold the context at 'left' for the duration of the call; revealText centres the line itself.
  function subsLeft(ctx, t, ch, st) {
    ctx.textAlign = 'left';
    Object.defineProperty(ctx, 'textAlign', { configurable: true, get: () => 'left', set: () => {} });
    try { subs(ctx, t, ch, st); } finally { delete ctx.textAlign; }
  }
  function erase(g, fn) { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; fn(); g.restore(); }
  function label(g, str, x, y, size, a, align = 'center', fam = SANS, w = 400, col = LN) {
    if (a <= 0) return;
    font(g, size, fam, w); g.fillStyle = rgba(col, a); g.textAlign = align; g.fillText(str, x, y); g.textAlign = 'left';
  }

  // ================= view 0: Jacquard head =================
  const NC = 24, P0 = .35, DT = .36, W0 = 7;
  const HX = i => 768 + i * 16;
  const COMB = i => 600 + i * 720 / 23;
  const PAT = j => {
    const r = ((j % 20) + 20) % 20, out = [];
    for (let c = 0; c < NC; c++) { const d = Math.abs(c - 11.5) + Math.abs(r - 9.5); out.push(Math.floor((d - 1) / 2) % 2 === 0 ? 1 : 0); }
    return out;
  };
  function loomState(t) {
    if (t < P0) return { pos: 0, rd: -99, lift: 0, woven: 0, ph: 0, k: -1 };
    const kf = (t - P0) / DT, k = Math.floor(kf), ph = kf - k;
    return { k, ph, pos: k + ease.inOut(clamp(ph / .25)), rd: k + 1,
      lift: smooth(.25, .42, ph) * (1 - smooth(.86, 1, ph)), woven: k + (ph >= .86 ? 1 : 0) };
  }
  function drawJCard(g, j, y, a) {
    const x0 = 734, w = 452, h = 46;
    erase(g, () => g.fillRect(x0, y, w, h));
    const bits = PAT(j);
    const p = new Path2D(); p.rect(x0, y, w, h);
    bits.forEach((b, i) => { if (b) { p.moveTo(HX(i) + 4.5, y + 23); p.arc(HX(i), y + 23, 4.5, 0, Math.PI * 2); } });
    for (const px of [748, 1172]) { p.moveTo(px + 6, y + 23); p.arc(px, y + 23, 6, 0, Math.PI * 2); }
    g.fillStyle = rgba(LN, .1 * a); g.fill(p, 'evenodd');
    S(g, 2, .95 * a); g.strokeRect(x0, y, w, h);
    S(g, 1.1, .8 * a); g.beginPath();
    bits.forEach((b, i) => { if (b) { g.moveTo(HX(i) + 4.5, y + 23); g.arc(HX(i), y + 23, 4.5, 0, Math.PI * 2); } });
    for (const px of [748, 1172]) { g.moveTo(px + 6, y + 23); g.arc(px, y + 23, 6, 0, Math.PI * 2); }
    g.stroke();
    // lacing to the next card above
    S(g, 1, .55 * a); g.beginPath();
    for (const lx of [790, 960, 1130]) { g.moveTo(lx - 8, y); g.lineTo(lx + 8, y - 10); g.moveTo(lx + 8, y); g.lineTo(lx - 8, y - 10); }
    g.stroke();
  }
  function drawLoom(g, t) {
    const st = loomState(t), bits = PAT(st.rd);
    const dA = smooth(0, 1.3, t), dB = smooth(.25, 1.6, t), dC = smooth(.5, 1.9, t);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // construction centre line of the machine
    S(g, 1, .35); g.setLineDash([46, 10, 8, 10]); line(g, 960, 20, 960, 840, dA); g.setLineDash([]);
    // frame
    S(g, 2.6, .95);
    rectP(g, 440, 470, 1040, 24, dA); rectP(g, 470, 494, 30, 296, dA); rectP(g, 1420, 494, 30, 296, dA);
    rectP(g, 450, 790, 1020, 28, dA);
    S(g, 1.4, .6); line(g, 500, 540, 560, 494, dA); line(g, 1420, 540, 1360, 494, dA);
    line(g, 500, 740, 560, 790, dA); line(g, 1420, 740, 1360, 790, dA);
    // head box
    S(g, 2.6, .95); rectP(g, 700, 330, 520, 140, dB);
    S(g, 1.2, .55); line(g, 712, 455, 1208, 455, dB); line(g, 712, 344, 1208, 344, dB);
    g.fillStyle = rgba(LN, .7 * dB);
    for (const [bx, by] of [[712, 340], [1208, 340], [712, 460], [1208, 460]]) { g.beginPath(); g.arc(bx, by, 3.2, 0, Math.PI * 2); g.fill(); }
    // supply chain of cards coming down into the prism
    g.save(); g.beginPath(); g.rect(600, -60, 720, 360); g.clip();
    for (let j = Math.floor(st.pos); j < st.pos + 6; j++) {
      const y = 252 - (j - st.pos) * 56;
      if (y > 300 || y < -60) continue;
      drawJCard(g, j, y, dB);
    }
    g.restore();
    // prism (card cylinder) with rotating square end caps
    S(g, 2.2, .9); rectP(g, 724, 250, 472, 50, dB);
    const ang = st.pos * Math.PI / 2;
    for (const ex of [700, 1220]) {
      g.save(); g.translate(ex, 275); g.rotate(ang); S(g, 2.2, .95 * dB); g.strokeRect(-20, -20, 40, 40);
      S(g, 1, .6 * dB); g.beginPath(); g.moveTo(-20, -20); g.lineTo(20, 20); g.moveTo(20, -20); g.lineTo(-20, 20); g.stroke();
      g.restore();
    }
    // needle board
    S(g, 1.6, .85); rectP(g, 724, 302, 472, 22, dB);
    S(g, 1.1, .7 * dB); g.beginPath();
    for (let i = 0; i < NC; i++) { const up = bits[i] ? st.lift : 0; g.moveTo(HX(i), 320); g.lineTo(HX(i), 306 - up * 14); }
    g.stroke();
    // hooks and griffe
    const lifts = [];
    for (let i = 0; i < NC; i++) lifts.push(bits[i] ? st.lift * 30 : 0);
    S(g, 1.8, .95 * dB); g.beginPath();
    for (let i = 0; i < NC; i++) {
      const dy = -lifts[i];
      g.moveTo(HX(i), 462 + dy); g.lineTo(HX(i), 356 + dy); g.arc(HX(i) - 4.5, 356 + dy, 4.5, 0, -Math.PI, true);
    }
    g.stroke();
    S(g, 4, .95 * dB); line(g, 732, 362 - st.lift * 30, 1188, 362 - st.lift * 30, dB);
    // neck cords fanning out to the comber board, heddles, eyes
    S(g, 1.05, .72); g.beginPath();
    for (let i = 0; i < NC; i++) {
      const dy = -lifts[i];
      const x0 = HX(i), y0 = 470 + dy, x1 = COMB(i);
      const k = dC;
      g.moveTo(x0, y0); g.lineTo(lerp(x0, x1, k), lerp(y0, 556, k));
      if (k >= 1) { g.moveTo(x1, 562); g.lineTo(x1, 606 + dy * .8); }
    }
    g.stroke();
    S(g, 2, .9); rectP(g, 576, 552, 768, 10, dC);
    if (dC >= 1) {
      S(g, 1.3, .9); g.beginPath();
      for (let i = 0; i < NC; i++) { const dy = -lifts[i] * .8; g.rect(COMB(i) - 3, 606 + dy, 6, 11); }
      g.stroke();
      // warp from the eyes down to the fell: the shed opens where hooks rise
      S(g, 1, .5); g.beginPath();
      for (let i = 0; i < NC; i++) { const dy = -lifts[i] * .8; g.moveTo(COMB(i), 617 + dy); g.lineTo(COMB(i), 640); }
      g.stroke();
    }
    // shuttle through the shed
    if (st.k >= 0 && st.ph > .45 && st.ph < .86) {
      const u = ease.inOut((st.ph - .45) / .41), dir = st.k % 2 ? -1 : 1;
      const sx = dir > 0 ? lerp(430, 1490, u) : lerp(1490, 430, u), y = 630;
      S(g, 1.2, .55); line(g, dir > 0 ? 584 : 1336, 633, clamp(sx, 584, 1336), 633);
      erase(g, () => { g.beginPath(); g.ellipse(sx, y, 58, 8, 0, 0, Math.PI * 2); g.fill(); });
      S(g, 2, .95); g.beginPath(); g.moveTo(sx - 62, y); g.quadraticCurveTo(sx, y - 18, sx + 62, y); g.quadraticCurveTo(sx, y + 18, sx - 62, y); g.stroke();
      S(g, 1, .7); g.strokeRect(sx - 20, y - 4, 40, 8);
    }
    // woven cloth: one row per card, pattern grows at the fell
    g.save(); g.beginPath(); g.rect(580, 640, 760, 150); g.clip();
    const cw = 720 / 23;
    S(g, 1, .22 * dA); g.beginPath();
    for (let c = 0; c < NC; c++) { g.moveTo(COMB(c), 640); g.lineTo(COMB(c), 790); }
    g.stroke();
    const top = st.woven;
    for (let j = top; j > top - 14; j--) {
      if (j < -W0 + 1) continue;   // before the pre-woven start: bare warp
      const y = 640 + (top - j) * 12, b = PAT(j);
      g.fillStyle = rgba(LN, .78 * dA); S(g, 1.2, .32 * dA); g.beginPath();
      for (let c = 0; c < NC; c++) {
        if (b[c]) g.fillRect(COMB(c) - cw / 2 + 2, y + 1.5, cw - 4, 9);
        else { g.moveTo(COMB(c) - cw / 2, y + 6); g.lineTo(COMB(c) + cw / 2, y + 6); }
      }
      g.stroke();
    }
    g.restore();
    S(g, 1.6, .85); line(g, 580, 640, 1340, 640, dC);
    // the chain that has been read hangs in a loop on the right
    if (dB > 0) {
      // each card is a separate plate, laced to its neighbours, folding slightly as it hangs
      const sp = 17, hw = 15, off = (st.pos * sp) % sp;
      for (let s0 = off - sp; s0 < loop.len * dB; s0 += sp) {
        const a0 = Math.max(0, s0 + 1.5), a1 = Math.min(loop.len, s0 + sp - 1.5);
        if (a1 <= a0) continue;
        const [x0, y0, t0] = loop.at(a0), [x1, y1, t1] = loop.at(a1);
        const idx = Math.round((s0 - off) / sp), f = idx % 2 ? 1.12 : .88;
        const q = [[x0 - Math.sin(t0) * hw * f, y0 + Math.cos(t0) * hw * f], [x1 - Math.sin(t1) * hw / f, y1 + Math.cos(t1) * hw / f],
          [x1 + Math.sin(t1) * hw / f, y1 - Math.cos(t1) * hw / f], [x0 + Math.sin(t0) * hw * f, y0 - Math.cos(t0) * hw * f]];
        erase(g, () => { g.beginPath(); q.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); });
        g.fillStyle = rgba(LN, .08 * dB); g.beginPath(); q.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
        S(g, 1.5, .9 * dB); g.stroke();
        const [xm, ym] = loop.at((a0 + a1) / 2);
        g.fillStyle = rgba(LN, .6 * dB);
        for (const k of [-.55, -.1, .4]) g.fillRect(xm - Math.sin(t0) * hw * k - 1.3, ym + Math.cos(t0) * hw * k - 1.3, 2.6, 2.6);
      }
    }
  }

  // ================= view 1: Hollerith card + tabulator =================
  const TG = [2, 0, 5, 3, 0, 9, 6, 1, 6, 6, 3, 8, 6, 8, 4, 9];   // 我在这里 in Chinese telegraph code
  const PG = [6.75, 7.17, 7.59, 8.01, 8.43];
  const HP = (c, r) => [70 + c * 34, 52 + r * 31];
  const BIG = [];   // {c, r, tp}
  const SUBC = [];  // later cards: arrays of {c,r}
  const DIAL = (c, r) => [1222 + c * 59.5, 128 + r * 66];
  let dialV0, PRESS;
  const STX = 1250, STY = 470, STS = .51;
  function cardPath() {
    const p = new Path2D();
    p.moveTo(44, 0); p.lineTo(900, 0); p.lineTo(900, 441); p.lineTo(0, 441); p.lineTo(0, 44); p.closePath();
    return p;
  }
  function drawHCard(g, x, y, sc, holes, t, o = {}) {
    const a = o.a ?? 1, draw = o.draw ?? 1, dots = o.dots ?? 1;
    g.save(); g.translate(x, y); g.scale(sc, sc);
    const path = cardPath();
    if (draw >= 1) erase(g, () => g.fill(path));
    const shown = holes.filter(h => h.tp === undefined || t >= h.tp);
    const fp = new Path2D(path);
    for (const h of shown) { const [hx, hy] = HP(h.c, h.r); fp.moveTo(hx + 11, hy); fp.arc(hx, hy, 11, 0, Math.PI * 2); }
    if (draw >= 1) { g.fillStyle = rgba(LN, .11 * a); g.fill(fp, 'evenodd'); }
    S(g, 2.6, a);
    poly(g, [[44, 0], [900, 0], [900, 441], [0, 441], [0, 44]], draw, true);
    if (dots > 0) {
      // field grid: unpunched positions as faint dots, field dividers, printed row digits 0–9
      g.fillStyle = rgba(LN, .3 * a * dots);
      const set = new Set(shown.map(h => h.c * 100 + h.r));
      for (let c = 0; c < 24; c++) for (let r = 0; r < 12; r++) {
        if (set.has(c * 100 + r)) continue;
        const [hx, hy] = HP(c, r); g.fillRect(hx - 1.4, hy - 1.4, 2.8, 2.8);
      }
      S(g, 1, .2 * a * dots); g.beginPath();
      for (const c of [4, 8, 12, 16, 20]) { const xx = 70 + (c - .5) * 34; g.moveTo(xx, 30); g.lineTo(xx, 416); }
      g.stroke();
      if (!o.small) {
        font(g, 15, MONO, 400); g.fillStyle = rgba(LN, .38 * a * dots); g.textAlign = 'center';
        for (let d = 0; d < 10; d++) g.fillText(String(d), 30, HP(0, d + 2)[1] + 5);
        g.textAlign = 'left';
      }
    }
    S(g, 1.8, a); g.beginPath();
    for (const h of shown) { const [hx, hy] = HP(h.c, h.r); g.moveTo(hx + 11, hy); g.arc(hx, hy, 11, 0, Math.PI * 2); }
    g.stroke();
    if (o.pop) for (const h of shown) {
      const age = t - h.tp; if (age < 0 || age > .3) continue;
      const [hx, hy] = HP(h.c, h.r); S(g, 1.6, (1 - age / .3) * .9); circP(g, hx, hy, 11 + age * 70);
    }
    g.restore();
  }
  function dialVal(d, t) {
    let v = dialV0[d];
    for (const pr of PRESS) { const k = ease.out(clamp((t - pr.t - .03) / .2)); if (k > 0) v += pr.inc[d] * k; }
    return v;
  }
  function drawTab(g, t) {
    const dP = smooth(5.6, 6.6, t), dS = smooth(6.2, 7.2, t);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // counter panel with 4 × 10 clock-face dials
    S(g, 2.6, .95); rectP(g, 1180, 84, 620, 280, dP);
    S(g, 1, .45); rectP(g, 1190, 94, 600, 260, dP);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) {
      const d = r * 10 + c, [x, y] = DIAL(c, r);
      const k = smooth(5.85 + (c + r) * .05, 6.35 + (c + r) * .05, t);
      if (k <= 0) continue;
      S(g, 1.8, .95); circP(g, x, y, 23, k);
      if (k < 1) continue;
      S(g, 1, .55); g.beginPath();
      for (let m = 0; m < 20; m++) { const a = m / 20 * Math.PI * 2, l = m % 5 ? 3 : 6; g.moveTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20); g.lineTo(x + Math.cos(a) * (20 - l), y + Math.sin(a) * (20 - l)); }
      g.stroke();
      const v = dialVal(d, t), au = v / 20 * Math.PI * 2 - Math.PI / 2, ah = v / 400 * Math.PI * 2 - Math.PI / 2;
      S(g, 2, .98); line(g, x, y, x + Math.cos(au) * 16, y + Math.sin(au) * 16);
      S(g, 2.6, .8); line(g, x, y, x + Math.cos(ah) * 9, y + Math.sin(ah) * 9);
      g.fillStyle = rgba(LN, .95); g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill();
    }
    // bell on top of the panel
    let ring = 0;
    for (const pr of PRESS) if (t >= pr.t) ring = Math.max(ring, Math.exp(-(t - pr.t) * 7));
    const bx = 1490 + Math.sin(t * 95) * 2.2 * ring;
    S(g, 2.2, .95); g.beginPath(); g.moveTo(bx - 22, 66); g.quadraticCurveTo(bx - 20, 40, bx, 38); g.quadraticCurveTo(bx + 20, 40, bx + 22, 66); g.closePath();
    if (dP > .5) g.stroke();
    line(g, 1490, 66, 1490, 84, dP);
    if (ring > .05) { S(g, 1.6, ring * .9); for (const s of [-1, 1]) for (const rr of [32, 44]) { g.beginPath(); g.arc(bx, 54, rr, s > 0 ? -.5 : Math.PI - .5, s > 0 ? .5 : Math.PI + .5); g.stroke(); } }
    // reading station (plan view) with its grid of contact pins
    S(g, 2.4, .95); rectP(g, STX - 12, STY - 10, 900 * STS + 24, 441 * STS + 20, dS);
    S(g, 1, .45); rectP(g, STX - 5, STY - 4, 900 * STS + 10, 441 * STS + 8, dS);
    if (dS > .3) {
      g.fillStyle = rgba(LN, .45 * smooth(.3, 1, dS));
      for (let c = 0; c < 24; c++) for (let r = 0; r < 12; r++) { const [hx, hy] = HP(c, r); g.fillRect(STX + hx * STS - 1, STY + hy * STS - 1, 2, 2); }
    }
    // wiring bus: one circuit per column of counters
    let lit = new Array(10).fill(0), flash = 0, cur = null;
    for (const pr of PRESS) { const f = t >= pr.t ? 1 - smooth(pr.t + .05, pr.t + .42, t) : 0; if (f > flash) { flash = f; cur = pr; } }
    if (cur) for (let d = 0; d < 40; d++) if (cur.inc[d]) lit[d % 10] = flash;
    for (let c = 0; c < 10; c++) {
      const x = DIAL(c, 0)[0], k = smooth(6.6 + c * .04, 7.2 + c * .04, t);
      S(g, 1.2 + lit[c] * 1.6, .45 + lit[c] * .55);
      poly(g, [[x, 364], [x, 408], [lerp(STX + 30, STX + 430, c / 9), 430], [lerp(STX + 30, STX + 430, c / 9), STY - 10]], k);
    }
    // input hopper: blank cards waiting
    const hp = smooth(9.0, 9.35, t);
    if (hp > 0) { for (let i = 2; i >= 0; i--) { S(g, 1.6, (.85 - i * .25) * hp); rectP(g, 690 - i * 8, STY - i * 8, 900 * STS, 441 * STS, hp); } }
    // cards: the big card is punched, then travels into the station; later cards follow
    const mv = ease.inOut(clamp((t - 8.75) / .5)), ex = ease.in(clamp((t - 9.48) / .22));
    const bx0 = lerp(110, STX, mv) + ex * 760, by0 = lerp(140, STY, mv), bs = lerp(1, STS, mv);
    SUBC.forEach((holes, k) => {
      const te = 9.6 + k * .38;
      if (t < te) return;
      const xin = lerp(690, STX, ease.out(clamp((t - te) / .16))) + ease.in(clamp((t - te - .27) / .14)) * 760;
      if (xin > 2000) return;
      drawHCard(g, xin, STY, STS, holes, t, { small: true });
      if (Math.abs(t - te - .2) < .12) pins(g, holes, 1 - Math.abs(t - te - .2) / .12);
    });
    if (bx0 < 2000) {
      drawHCard(g, bx0, by0, bs, BIG, t, { draw: smooth(5.55, 6.45, t), dots: smooth(6.2, 6.7, t), pop: true, small: mv > .5 });
      if (t > 9.2 && t < 9.5) pins(g, BIG, 1 - Math.abs(t - 9.3) / .2);
    }
    // punch head crosshair travelling over the big card
    const seq = BIG.slice().sort((a, b) => a.tp - b.tp);
    const hv = smooth(6.55, 6.75, t) * (1 - smooth(8.55, 8.75, t));
    if (hv > 0) {
      let px = 900, py = 470;
      if (t >= seq[0].tp) {
        let i = seq.findIndex(h => h.tp > t); if (i < 0) i = seq.length;
        const a = seq[i - 1], b = seq[i] || a;
        const k = b === a ? 0 : ease.inOut(clamp((t - a.tp) / (b.tp - a.tp)));
        const pa = HP(a.c, a.r), pb = HP(b.c, b.r);
        px = lerp(pa[0], pb[0], k); py = lerp(pa[1], pb[1], k);
      } else { const p0 = HP(seq[0].c, seq[0].r), k = ease.inOut(smooth(6.6, PG[0], t)); px = lerp(900, p0[0], k); py = lerp(470, p0[1], k); }
      px += 110; py += 140;
      S(g, 1.6, .95 * hv); circP(g, px, py, 17); line(g, px - 30, py, px - 21, py); line(g, px + 21, py, px + 30, py);
      line(g, px, py - 30, px, py - 21); line(g, px, py + 21, px, py + 30);
      S(g, 1, .5 * hv); g.setLineDash([6, 6]); line(g, px, py - 30, px, 40); g.setLineDash([]);
    }
  }
  function pins(g, holes, f) {
    if (f <= 0) return;
    g.fillStyle = rgba(LN, f);
    for (const h of holes) { const [hx, hy] = HP(h.c, h.r); g.beginPath(); g.arc(STX + hx * STS, STY + hy * STS, 3.6, 0, Math.PI * 2); g.fill(); }
  }

  // ================= view 2: time dimensions =================
  function dimH(g, x0, x1, y, yFrom, a, inside = true) {
    S(g, 1.1, .75 * a); line(g, x0, yFrom, x0, y + 10); line(g, x1, yFrom, x1, y + 10);
    if (inside) { S(g, 1.3, .9 * a); line(g, x0, y, x1, y); arrow(g, x0, y, Math.PI, 14, .95 * a); arrow(g, x1, y, 0, 14, .95 * a); }
    else {
      S(g, 1.3, .9 * a); line(g, x0 - 44, y, x1 + 44, y);
      arrow(g, x0, y, 0, 14, .95 * a); arrow(g, x1, y, Math.PI, 14, .95 * a);
    }
  }
  function drawTime(g, t) {
    const X0 = 420, U = 160;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // year scale (ticks only)
    const pr = smooth(10.35, 11.0, t);
    S(g, 2, .9); line(g, X0, 150, X0 + 8.4 * U, 150, pr);
    S(g, 1.4, .85); g.beginPath();
    for (let q = 0; q <= 33; q++) {
      const x = X0 + q * U / 4; if ((x - X0) / (8.4 * U) > pr) break;
      const l = q % 4 ? 9 : 22; g.moveTo(x, 150); g.lineTo(x, 150 - l);
    }
    g.stroke();
    // row A: the previous census, counted by hand — a long bar filled with tally marks
    const pa = clamp((t - 10.85) / 1.75), wA = 7 * U * pa;
    const iA = smooth(10.5, 10.85, t);
    if (iA > 0) {
      S(g, 2.4, .95); poly(g, [[X0 + wA, 222], [X0, 222], [X0, 292], [X0 + wA, 292]], iA);
      if (pa > 0 && pa < 1) { S(g, 1.4, .8); line(g, X0 + wA, 222, X0 + wA, 292); }
      if (pa >= 1) { S(g, 2.4, .95); line(g, X0 + wA, 222, X0 + wA, 292); }
      // tally strokes
      S(g, 1.5, .8); g.beginPath();
      for (let s = 0; ; s++) {
        const grp = Math.floor(s / 5), m = s % 5, gx = X0 + 14 + grp * 41;
        if (gx + 34 > X0 + wA || gx > X0 + 7 * U - 30) break;
        const j1 = (hash2(s, 3) - .5) * 4, j2 = (hash2(s, 5) - .5) * 4;
        if (m < 4) { g.moveTo(gx + m * 8 + j1, 236); g.lineTo(gx + m * 8 + 2 + j2, 278); }
        else { g.moveTo(gx - 4, 270 + j1); g.lineTo(gx + 31, 242 + j2); }
      }
      g.stroke();
      // pencil icon
      const pi = smooth(10.5, 11, t);
      g.save(); g.translate(X0 - 130, 257); g.rotate(-.5); S(g, 2, .9 * pi);
      poly(g, [[-52, -10], [34, -10], [56, 0], [34, 10], [-52, 10]], pi, true);
      line(g, 34, -10, 34, 10, pi); line(g, -40, -10, -40, 10, pi);
      g.fillStyle = rgba(LN, .9 * pi); g.beginPath(); g.moveTo(49, -3); g.lineTo(56, 0); g.lineTo(49, 3); g.fill();
      g.restore();
    }
    // "more than": dashed continuation and break mark
    const pe = smooth(12.6, 12.95, t);
    if (pe > 0) {
      S(g, 2, .8); g.setLineDash([10, 8]);
      line(g, X0 + 7 * U, 222, X0 + 7 * U + 110, 222, pe); line(g, X0 + 7 * U, 292, X0 + 7 * U + 110, 292, pe);
      g.setLineDash([]);
      if (pe >= 1) { S(g, 2, .9); poly(g, [[X0 + 7 * U + 110, 212], [X0 + 7 * U + 104, 240], [X0 + 7 * U + 122, 268], [X0 + 7 * U + 112, 302]]); }
    }
    const dA = smooth(12.45, 12.85, t);
    if (dA > 0) { dimH(g, X0, X0 + 7 * U, 336, 300, dA); label(g, ch.cards[2].includes('七年以上') ? '七年以上' : '', X0 + 3.5 * U, 382, 28, .85 * dA); }
    // centre line dividing before / after
    const pc = smooth(12.5, 13.0, t);
    S(g, 1.1, .5); g.setLineDash([46, 9, 8, 9]); line(g, 200, 438, 1780, 438, pc); g.setLineDash([]);
    // row B: this census — counting (six months) and compiling (two years), filled with section hatch
    const b1 = ease.out(clamp((t - 12.75) / .18)), b2 = ease.inOut(clamp((t - 12.95) / .45));
    if (b1 > 0) {
      const w1 = .5 * U * b1;
      S(g, 2.4, .95); g.strokeRect(X0, 488, w1, 56); S(g, 1.2, .75); hatch(g, X0, 488, w1, 56, 9);
    }
    if (b2 > 0) {
      const w2 = 2 * U * b2;
      S(g, 2.4, .95); g.strokeRect(X0, 628, w2, 56); S(g, 1.2, .75); hatch(g, X0, 628, w2, 56, 9);
    }
    const ph = smooth(13.6, 14.1, t);
    if (ph > 0) {
      S(g, 1.2, .42); g.setLineDash([22, 6, 5, 6]);
      poly(g, [[X0 + .5 * U, 488], [X0 + 7 * U, 488], [X0 + 7 * U, 544], [X0 + .5 * U, 544]], ph);
      poly(g, [[X0 + 2 * U, 628], [X0 + 7 * U, 628], [X0 + 7 * U, 684], [X0 + 2 * U, 684]], ph);
      g.setLineDash([]);
    }
    const d1 = smooth(12.95, 13.2, t), d2 = smooth(13.4, 13.7, t);
    if (d1 > 0) { dimH(g, X0, X0 + .5 * U, 578, 548, d1, false); label(g, '六个月', X0 + .5 * U + 64, 588, 28, .85 * d1, 'left'); }
    if (d2 > 0) { dimH(g, X0, X0 + 2 * U, 718, 688, d2); label(g, '两年', X0 + U, 762, 28, .85 * d2); }
    // tabulator dial icon spinning while the short bars run
    const di = smooth(12.6, 12.9, t);
    if (di > 0) {
      const x = X0 - 130, y = 586; S(g, 2, .9 * di); circP(g, x, y, 38, di);
      S(g, 1, .55 * di); g.beginPath();
      for (let m = 0; m < 20; m++) { const a = m / 20 * Math.PI * 2, l = m % 5 ? 4 : 8; g.moveTo(x + Math.cos(a) * 34, y + Math.sin(a) * 34); g.lineTo(x + Math.cos(a) * (34 - l), y + Math.sin(a) * (34 - l)); }
      g.stroke();
      const spin = (t - 12.6) * 9 * (1 - smooth(13.35, 13.85, t)) + smooth(13.35, 13.85, t) * 6.75;
      const au = -Math.PI / 2 + spin * 2.2;
      S(g, 2.2, .95 * di); line(g, x, y, x + Math.cos(au) * 27, y + Math.sin(au) * 27);
      S(g, 1.4, .7 * di); g.beginPath(); g.moveTo(X0 - 72, 516); g.lineTo(X0 - 58, 516); g.lineTo(X0 - 58, 656); g.lineTo(X0 - 72, 656); g.stroke();
    }
  }

  // ================= view 3: company lineage =================
  function icon(g, kind, x, y, a) {
    S(g, 2, .95 * a); g.fillStyle = rgba(LN, .9 * a);
    if (kind === 'card') {
      g.beginPath(); g.moveTo(x - 30, y - 18); g.lineTo(x + 38, y - 18); g.lineTo(x + 38, y + 18); g.lineTo(x - 38, y + 18); g.lineTo(x - 38, y - 10); g.closePath(); g.stroke();
      for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(x - 26 + i * 9, y + ((i * 5) % 3 - 1) * 8, 2.4, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 'scale') {
      line(g, x, y - 26, x, y + 22); line(g, x - 34, y - 18, x + 34, y - 18); line(g, x - 14, y + 22, x + 14, y + 22);
      for (const s of [-1, 1]) { line(g, x + s * 34, y - 18, x + s * 26, y + 4); line(g, x + s * 34, y - 18, x + s * 42, y + 4);
        g.beginPath(); g.moveTo(x + s * 22, y + 4); g.quadraticCurveTo(x + s * 34, y + 16, x + s * 46, y + 4); g.closePath(); g.stroke(); }
    } else {
      circP(g, x, y - 6, 24); line(g, x, y - 6, x, y - 22); line(g, x, y - 6, x + 12, y);
      g.strokeRect(x - 16, y + 22, 32, 8);
    }
  }
  function drawLineage(g, t) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const N = [[330, 200, 'card'], [330, 430, 'scale'], [330, 660, 'clock']];
    N.forEach(([x, y, kind], i) => {
      const k = smooth(14.95 + i * .12, 15.45 + i * .12, t);
      S(g, 2.4, .95); circP(g, x, y, 66, k); S(g, 1, .45); circP(g, x, y, 58, k);
      const ic = smooth(15.3 + i * .12, 15.65 + i * .12, t); if (ic > 0) icon(g, kind, x, y, ic);
      const c = smooth(15.55 + i * .1, 16.1 + i * .1, t);
      S(g, 2, .9); poly(g, i === 1 ? [[396, 430], [686, 430]] : [[396, y], [600, y], [600, 430], [686, 430]], c);
    });
    const jn = smooth(16.05, 16.35, t);
    S(g, 2.6, .95); circP(g, 720, 430, 34, jn); S(g, 1.2, .6); circP(g, 720, 430, 26, jn);
    if (jn > .8) { g.fillStyle = rgba(LN, .95); g.beginPath(); g.arc(720, 430, 7, 0, Math.PI * 2); g.fill(); }
    const ln = smooth(16.3, 16.65, t);
    S(g, 2, .9); line(g, 754, 430, 1000, 430, ln);
    if (ln >= 1) { arrow(g, 1004, 430, 0, 18); S(g, 2, .9); line(g, 862, 446, 874, 414); line(g, 872, 446, 884, 414); }
    // IBM: construction lines, outline drafted contour by contour, then section hatch
    const fx = 1050, base = 548, size = 300;
    const cl = smooth(16.4, 16.9, t) * (1 - .55 * smooth(17.9, 18.4, t));
    if (cl > 0) {
      S(g, 1, .4 * cl);
      line(g, 1020, base, 1800, base, cl); line(g, 1020, base - 216, 1800, base - 216, cl); line(g, 1020, base - 108, 1800, base - 108, cl * .7);
      g.setLineDash([30, 8, 6, 8]); for (const xx of [1140, 1360, 1590]) line(g, xx, base + 40, xx, base - 260, cl); g.setLineDash([]);
    }
    font(g, size, MONO, 700); g.textBaseline = 'alphabetic';
    const ol = smooth(16.7, 17.5, t);
    if (ol > 0) {
      const sp = 26, word = 'IBM';
      let x = fx;
      if (ol < 1) g.setLineDash([ol * 2400, 1e5]); S(g, 3, .97);
      for (const c of word) { g.strokeText(c, x, base); x += g.measureText(c).width + sp; }
      g.setLineDash([]);
    }
    const ht = smooth(17.35, 17.9, t);
    if (ht > 0) {
      HBg.setTransform(1, 0, 0, 1, 0, 0); HBg.clearRect(0, 0, HB.width, HB.height);
      font(HBg, size, MONO, 700); HBg.fillStyle = '#fff';
      let x = 20; for (const c of 'IBM') { HBg.fillText(c, x, 330); x += HBg.measureText(c).width + 26; }
      HBg.globalCompositeOperation = 'source-in';
      HBg.strokeStyle = rgba(LN, .7); HBg.lineWidth = 1.6; HBg.beginPath();
      for (let k = -400; k < 900; k += 13) { HBg.moveTo(k, 400); HBg.lineTo(k + 400, 0); }
      HBg.stroke();
      HBg.globalCompositeOperation = 'source-over';
      g.save(); g.beginPath(); g.rect(fx - 20, 0, 900 * ht, 900); g.clip();
      g.drawImage(HB, fx - 20, base - 330); g.restore();
    }
  }

  // ================= view 4: archive shelving, fire, water, the remnant =================
  const LEV = [140, 268, 396, 524, 652, 780];
  const BAY = [240, 720, 1200];
  let BOX;
  const XF = t => 1990 - 830 * ease.out(clamp((t - 19.7) / 2.5));
  const FACT = t => smooth(19.7, 19.95, t) * (1 - smooth(21.5, 22.7, t));
  const offY = y => 70 * Math.sin(y * .0062 + 1.3) + 30 * Math.sin(y * .0165 + 4.1);
  function vanish(b, t) { // 0 = present, 1 = gone; phase .0–.45 phantom lines, then fades
    return clamp((t - b.tv) / .5);
  }
  function drawArchive(g, t) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const dA = smooth(18.85, 19.75, t), dB = smooth(19.1, 19.9, t);
    // floor and shelving uprights with slots
    S(g, 2.6, .95); line(g, 120, 780, 1800, 780, dA);
    S(g, 1, .4); g.setLineDash([2, 10]); line(g, 120, 792, 1800, 792, dA); g.setLineDash([]);
    for (let b = 0; b <= 3; b++) {
      const x = 220 + b * 480;
      S(g, 2.4, .95); rectP(g, x, 120, 20, 660, dA);
      if (dA >= 1) { S(g, 1, .5); g.beginPath(); for (let y = 150; y < 760; y += 34) g.rect(x + 7, y, 6, 14); g.stroke(); }
    }
    for (const y of LEV.slice(0, 5)) { S(g, 2, .9); for (const bx of BAY) rectP(g, bx, y, 460, 8, dA); }
    // boxes of forms
    for (const b of BOX) {
      const k = smooth(19.0 + b.d * .7, 19.35 + b.d * .7, t);
      if (k <= 0) continue;
      const v = vanish(b, t);
      if (v >= 1) continue;
      const a = k * (v < .45 ? 1 - v * .9 : (1 - v) / .55 * .6);
      if (v > 0) g.setLineDash([16, 5, 4, 5]);
      S(g, 1.9, .92 * a); g.strokeRect(b.x, b.y, b.w, b.h);
      S(g, 1.1, .7 * a);
      if (b.kind === 0) { g.strokeRect(b.x + 10, b.y + 14, b.w - 20, 17); circP(g, b.x + b.w / 2, b.y + b.h - 18, 4.5); }
      else { g.beginPath(); for (let i = 1; i < 7; i++) { g.moveTo(b.x + 3, b.y + i * b.h / 7); g.lineTo(b.x + b.w - 3, b.y + i * b.h / 7); } g.moveTo(b.x + b.w / 2, b.y); g.lineTo(b.x + b.w / 2, b.y + b.h); g.stroke(); }
      if (b.tab) { g.beginPath(); g.moveTo(b.x + 8, b.y); g.lineTo(b.x + 8, b.y - 7); g.lineTo(b.x + 26, b.y - 7); g.lineTo(b.x + 26, b.y); g.stroke(); }
      g.setLineDash([]);
    }
    // the remnant stack: revealed when its box is cleared, then outlined, dimensioned and circled in red pencil
    const rb = BOX.find(b => b.rem);
    const rv = smooth(rb.tv + .15, rb.tv + .45, t);
    if (rv > 0) {
      const { x, y, w, h } = REM;
      S(g, 1.3, .95 * rv); g.beginPath(); for (let i = 0; i <= 4; i++) { g.moveTo(x + (i % 2) * 1.5, y + i * h / 4); g.lineTo(x + w - (i % 2) * 1.5, y + i * h / 4); } g.stroke();
      const bo = smooth(26.2, 26.5, t);
      S(g, 2.4, bo); g.strokeRect(x - 2, y - 2, w + 4, h + 4);
      const dm = smooth(26.45, 26.85, t);
      if (dm > 0) {
        S(g, .9, .8 * dm); line(g, x - 2, y - 6, x - 2, y - 30); line(g, x + w + 2, y - 6, x + w + 2, y - 30);
        S(g, 1, .9 * dm); line(g, x - 14, y - 24, x + w + 14, y - 24);
        arrow(g, x - 2, y - 24, 0, 7, .9 * dm); arrow(g, x + w + 2, y - 24, Math.PI, 7, .9 * dm);
        S(g, .9, .8 * dm); line(g, x + w + 6, y - 2, x + w + 30, y - 2); line(g, x + w + 6, y + h + 2, x + w + 30, y + h + 2);
        S(g, 1, .9 * dm); line(g, x + w + 24, y - 14, x + w + 24, y + h + 14);
        arrow(g, x + w + 24, y - 2, Math.PI / 2, 7, .9 * dm); arrow(g, x + w + 24, y + h + 2, -Math.PI / 2, 7, .9 * dm);
      }
      // red-pencil revision cloud + leader to the surviving count
      const rc = smooth(26.75, 27.35, t);
      if (rc > 0) {
        const cx = x + w / 2 + 6, cy = y + h / 2 - 8, rx = 58, ry = 44, n = 13;
        g.strokeStyle = rgba(RED, .95); g.lineWidth = 2.6; g.beginPath();
        const m = Math.floor(n * rc + 1e-6), frac = n * rc - m;
        for (let i = 0; i < n; i++) {
          if (i > m || (i === m && frac <= 0)) break;
          const a0 = i / n * Math.PI * 2 - 2.2, a1 = (i + 1) / n * Math.PI * 2 - 2.2;
          const p0 = [cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry], p1 = [cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry];
          const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
          const r = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 2;
          const sa = Math.atan2(p0[1] - my, p0[0] - mx), ea = sa + Math.PI * (i === m ? frac : 1);
          g.moveTo(mx + Math.cos(sa) * r, my + Math.sin(sa) * r); g.arc(mx, my, r, sa, ea, false);
        }
        g.stroke();
      }
      // leader runs into the clear bay between the bottom shelf (y 660) and the floor, never across a shelf line
      const ld = smooth(27.2, 27.6, t);
      if (ld > 0) {
        g.strokeStyle = rgba(RED, .95); g.lineWidth = 2.2;
        poly(g, [[x + w + 56, y - 22], [x + w + 92, y - 58], [x + w + 236, y - 58]], ld);
        g.fillStyle = rgba(RED, .95); g.beginPath(); g.arc(x + w + 56, y - 22, 3.4 * ld, 0, Math.PI * 2); g.fill();
        label(g, ch.meter.value, x + w + 98, y - 66, 26, smooth(27.4, 27.75, t), 'left', MONO, 700, RED);
      }
    }
  }
  function sparks(ctx, t, c) {
    const act = FACT(t); if (act <= 0) return;
    ctx.save(); ctx.setTransform(c.s, 0, 0, c.s, 960 - c.cx * c.s, 540 - c.cy * c.s); ctx.translate(VIEW[4][0], VIEW[4][1]);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const tb = 19.75 + (i / 90) * 2.6 + hash2(i, 1) * .2, age = t - tb, life = .6 + hash2(i, 2) * .6;
      if (age < 0 || age > life) continue;
      const y0 = 60 + hash2(i, 3) * 720, x0 = XF(tb) + 520 * smooth(700, 940, y0) - offY(y0) + 10;   // same lean as FIRE
      const x = x0 - 30 * age + Math.sin(age * 9 + i) * 8, y = y0 - (90 + 120 * hash2(i, 4)) * age;
      const a = (1 - age / life) * act;
      ctx.fillStyle = `rgba(255,${140 + 60 * hash2(i, 5) | 0},60,${a})`;
      ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
    }
    ctx.restore();
  }

  // ================= incoming transition: holes punched through the previous page, then it falls away =================
  const HOLES = [];
  for (let r = 0; r < 13; r++) for (let c = 0; c < 60; c++) {
    if (hash2(c * 7 + 1, r * 13 + 5) > .78) continue;
    HOLES.push({ x: c * 32 + 6, y: r * 83 + 14, w: 20, h: 54, p: .03 + r * .033 + c / 60 * .08 });
  }
  TRANS.punch_holes = (ctx, A, B, p) => {
    ctx.drawImage(B, 0, 0);
    const fall = ease.in(clamp((p - .55) / .45));
    if (fall >= 1) return;
    TAg.globalCompositeOperation = 'copy'; TAg.drawImage(A, 0, 0);
    TAg.globalCompositeOperation = 'destination-out'; TAg.fillStyle = '#000'; TAg.beginPath();
    for (const h of HOLES) if (p >= h.p) TAg.rect(h.x, h.y, h.w, h.h);
    TAg.fill();
    TAg.globalCompositeOperation = 'source-over';
    // cut edges catch light at the bottom, shade at the top
    TAg.fillStyle = 'rgba(255,250,235,.3)'; TAg.beginPath();
    for (const h of HOLES) if (p >= h.p) TAg.rect(h.x, h.y + h.h, h.w, 1.5);
    TAg.fill();
    ctx.save();
    ctx.translate(W / 2, H / 2 + fall * H * 1.15); ctx.rotate(fall * .1); ctx.scale(1 - fall * .04, 1 - fall * .04); ctx.translate(-W / 2, -H / 2);
    ctx.shadowColor = `rgba(3,12,28,${.3 + .25 * fall})`; ctx.shadowBlur = 6 + 20 * fall; ctx.shadowOffsetY = 3 + 12 * fall;
    ctx.drawImage(TA, 0, 0);
    ctx.restore();
    // chads tumbling out of the fresh holes
    for (const h of HOLES) {
      const age = (p - h.p) * 1.2; if (age < 0 || age > .2) continue;
      const dy = 3600 * age * age + 40 * age, k = 1 - age / .2;
      ctx.save(); ctx.globalAlpha = k; ctx.translate(h.x + h.w / 2 + (hash2(h.x, h.y) - .5) * 60 * age, h.y + h.h / 2 + dy);
      ctx.rotate((hash2(h.y, h.x) - .5) * 14 * age);
      ctx.drawImage(A, h.x, h.y, h.w, h.h, -h.w / 2, -h.h / 2, h.w, h.h);
      ctx.restore();
    }
  };

  // ================= scene =================
  scene({
    id: 'punch', n: ch.n, dur: ch.dur,
    trans: { type: 'punch_holes', d: 1.2 },
    cues: [
      { t: .05, sfx: 'punch' }, { t: .72, sfx: 'paper' },
      { t: P0 + 8 * DT, sfx: 'wood', v: .5 },
      ...PG.map(x => ({ t: x, sfx: 'punch' })),
      { t: 9.25, sfx: 'relay' }, { t: 9.3, sfx: 'bell' }, { t: 9.8, sfx: 'bell', v: .6 },
      { t: 12.75, sfx: 'relay' }, { t: 13.4, sfx: 'bell' },
      { t: 16.15, sfx: 'click' }, { t: 17.4, sfx: 'press' },
      { t: 19.7, sfx: 'fire' }, { t: 21.0, sfx: 'water', v: .7 },
      { t: 23.75, sfx: 'paper', v: .6 }, { t: 24.9, sfx: 'paper', v: .5 }, { t: 26.45, sfx: 'tick' },
    ],
    init() {
      paper = GL.bake(PAPER, 1024, 1024);
      L = makeCanvas(W, H); Lg = L.getContext('2d');
      G1 = makeCanvas(480, 270); G1g = G1.getContext('2d'); G1g.imageSmoothingQuality = 'high';
      TA = makeCanvas(W, H); TAg = TA.getContext('2d');
      HB = makeCanvas(900, 400); HBg = HB.getContext('2d');
      // the draped card loop on the loom
      const pts = [];
      for (let i = 0; i <= 160; i++) {
        const u = i / 160;
        pts.push([lerp(1222, 1392, u) + 70 * Math.sin(Math.PI * u), 300 + 330 * Math.sin(Math.PI * u) - 360 * u]);
      }
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      loop = { len: cum[cum.length - 1], at(s) {
        let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
        const k = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
        return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])];
      } };
      // Hollerith card holes: columns 1–16 carry the telegraph digits, the rest are census answers
      BIG.length = 0; SUBC.length = 0;
      const r = mulberry(1890);
      TG.forEach((d, c) => BIG.push({ c, r: d + 2, tp: PG[c >> 2] + (c & 3) * .07 }));
      let n = 0;
      for (let c = 16; c < 24; c++) {
        const k = 1 + (r() < .4 ? 1 : 0), used = new Set();
        for (let i = 0; i < k; i++) { let rr = Math.floor(r() * 12); while (used.has(rr)) rr = (rr + 5) % 12; used.add(rr); BIG.push({ c, r: rr, tp: PG[4] + n * .035 }); n++; }
      }
      for (let k = 0; k < 4; k++) {
        const holes = [];
        for (let c = 0; c < 24; c++) if (r() < .75) holes.push({ c, r: Math.floor(r() * 12) });
        SUBC.push(holes);
      }
      dialV0 = []; for (let d = 0; d < 40; d++) dialV0.push(Math.floor(r() * 20));
      PRESS = [{ t: 9.28 }, ...SUBC.map((_, k) => ({ t: 9.6 + k * .38 + .2 }))].map(p => {
        const inc = []; for (let d = 0; d < 40; d++) inc.push(r() < .45 ? 1 + (r() < .3 ? 1 : 0) : 0);
        return { ...p, inc };
      });
      // archive boxes
      BOX = [];
      const rb = mulberry(1921);
      for (let s = 0; s < 5; s++) for (let bi = 0; bi < 3; bi++) for (let i = 0; i < 8; i++) {
        const x = BAY[bi] + 9 + i * 56, h = 90 + Math.floor(rb() * 10), y = LEV[s + 1] - h;
        const gx = (x - 240) / 1420;
        BOX.push({ x, y, w: 50, h, kind: rb() < .72 ? 0 : 1, tab: rb() < .35, d: (s * .15 + gx * .5),
          tv: 23.75 + s * .58 + gx * .42, rem: s === 4 && bi === 0 && i === 0 });
      }
    },
    draw(ctx, t) {
      const c = cam(t), s = c.s;
      const vx0 = c.cx - 960 / s, vx1 = c.cx + 960 / s, vy0 = c.cy - 540 / s, vy1 = c.cy + 540 / s;
      // paper (tiles in sheet space)
      const T = 1024;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      for (let iy = Math.floor(vy0 / T); iy * T < vy1; iy++) for (let ix = Math.floor(vx0 / T); ix * T < vx1; ix++) {
        ctx.drawImage(paper, (ix * T - c.cx) * s + 960, (iy * T - c.cy) * s + 540, T * s + 1, T * s + 1);
      }
      // faint drafting grid
      ctx.setTransform(s, 0, 0, s, 960 - c.cx * s, 540 - c.cy * s);
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(200,222,250,.05)'; ctx.beginPath();
      for (let x = Math.ceil(vx0 / 40) * 40; x <= vx1; x += 40) if (x % 200) { ctx.moveTo(x, vy0); ctx.lineTo(x, vy1); }
      for (let y = Math.ceil(vy0 / 40) * 40; y <= vy1; y += 40) if (y % 200) { ctx.moveTo(vx0, y); ctx.lineTo(vx1, y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,222,250,.1)'; ctx.beginPath();
      for (let x = Math.ceil(vx0 / 200) * 200; x <= vx1; x += 200) { ctx.moveTo(x, vy0); ctx.lineTo(x, vy1); }
      for (let y = Math.ceil(vy0 / 200) * 200; y <= vy1; y += 200) { ctx.moveTo(vx0, y); ctx.lineTo(vx1, y); }
      ctx.stroke();
      ctx.restore();
      // line work
      Lg.setTransform(1, 0, 0, 1, 0, 0); Lg.clearRect(0, 0, W, H);
      const views = [drawLoom, drawTab, drawTime, drawLineage, drawArchive];
      views.forEach((fn, i) => {
        const [ox, oy] = VIEW[i];
        if (ox > vx1 || ox + 1920 < vx0 || oy > vy1 || oy + 1080 < vy0) return;
        Lg.save(); Lg.setTransform(s, 0, 0, s, 960 - c.cx * s, 540 - c.cy * s); Lg.translate(ox, oy);
        fn(Lg, t);
        Lg.restore();
      });
      // cyanotype bleed: a soft halo under crisp lines. While the title plate is up the machine stays
      // a step behind it, then comes forward as the plate leaves.
      const back = 1 - .58 * win(t, .7, 3.35, .45, .5);
      G1g.clearRect(0, 0, 480, 270); G1g.drawImage(L, 0, 0, 480, 270);
      ctx.save();
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .55 * back; ctx.drawImage(G1, 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .93 * back; ctx.drawImage(L, 0, 0);
      ctx.restore();
      // fire and water damage on the archive sheet
      const ox4 = VIEW[4][0], oy4 = VIEW[4][1];
      if (t > 19.6 && !(ox4 > vx1 || ox4 + 1920 < vx0 || oy4 > vy1 || oy4 + 1080 < vy0)) {
        const fc = GL.run(FIRE, 960, 540, { CAM: [c.cx, c.cy, s], OFF: [ox4, oy4], XF: XF(t), ACT: FACT(t), WT: Math.max(0, t - 21.0), FT: t });
        ctx.drawImage(fc, 0, 0, W, H);
        sparks(ctx, t, c);
      }
      vignette(ctx, .5, '4,16,36', .42);
      // title moment inside a drawing title block
      opener(ctx, t, ch, {
        ink: LN, sub: SUB, accent: RED, y: 470, inAt: .85, outAt: 2.85,
        title: { family: SANS, size: 140, weight: 700, sp: 40 },
        small: { family: SANS, size: 30, weight: 400 },
        num: { family: MONO, size: 54, weight: 700 },
        backdrop: (g, b, al) => {
          const x0 = 560, x1 = 1360, y0 = 304, y1 = 672, p = smooth(.6, 1.5, t);
          g.save();
          g.fillStyle = `rgba(14,48,92,${.94 * al})`; g.fillRect(x0, y0, x1 - x0, y1 - y0);
          g.lineCap = 'square';
          S(g, 2.6, .95 * al); rectP(g, x0, y0, x1 - x0, y1 - y0, p);
          S(g, 1, .6 * al); rectP(g, x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20, p);
          line(g, x0 + 10, 506, x1 - 10, 506, p); line(g, x0 + 10, 572, x1 - 10, 572, p);
          S(g, 1.4, .7 * al);
          for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { line(g, cx - 22, cy, cx + 22, cy, p); line(g, cx, cy - 22, cx, cy + 22, p); }
          g.restore();
        },
      });
      subsLeft(ctx, t, ch, {
        ink: '#F2F6FB', body: { family: SANS, size: 50, weight: 400 }, y: 1000,
        bandFn: (g, x, y, w, h, a) => {
          g.save();
          g.fillStyle = `rgba(9,34,68,${.8 * a})`; g.fillRect(x, y, w, h);
          g.strokeStyle = `rgba(233,241,251,${.55 * a})`; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x, y + .5); g.lineTo(x + w, y + .5); g.moveTo(x, y + h - .5); g.lineTo(x + w, y + h - .5);
          g.moveTo(x + .5, y - 8); g.lineTo(x + .5, y + h + 8); g.moveTo(x + w - .5, y - 8); g.lineTo(x + w - .5, y + h + 8); g.stroke();
          g.restore();
        },
      });
      grain(ctx, t, .045);
    },
  });
})();
