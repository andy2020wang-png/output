// 06 竹简 — bamboo slips on a black lacquer table. A raw green slip is planed and dried, a brush writes 我在这里 down it,
// two hemp cords twine over and under the whole row; the bound row collapses into the oracle-bone glyph 册 and morphs
// into the modern character; then the 3,000 wooden boards of 东方朔, lifted by two officials (Han tomb-brick rubbing
// silhouettes) and read row by row while the moon turns twice.
'use strict';
(() => {
  const ch = CH('bamboo');
  const INK = '#1B1712', HEMP = '#8A7350', SEAL = '#B83A2B', CREAM = '#F2E7CC', RUB = '#DCD0B3';
  const BRUSHF = '"Ma Shan Zheng"', SERIF = '"Noto Serif SC"';

  // ---------- the row of slips, in world units (i = 0 is the rightmost slip, read first) ----------
  const N = 26, SW = 60, PITCH = 64, L = 860, HERO = 9, CORDY = [118, 742], TS = 1.75;
  const TW = Math.round(SW * TS), TH = Math.round(L * TS);
  const sx = i => (N / 2 - .5 - i) * PITCH;
  const charY = k => 166 + k * 53.5;
  // 《周易·系辞下》 — the passage that ends with “上古结绳而治，后世圣人易之以书契”, already written on the slips to the right
  const TEXT = [...'上古穴居而野处后世圣人易之以宫室上栋下宇以待风雨盖取诸大壮古之葬者厚衣之以薪葬之中野不封不树丧期无数后世圣人易之以棺椁盖取诸大过上古结绳而治后世圣人易之以书契百官以治万民以察盖取诸夬'];
  const HERO_TXT = [...'我在这里'];

  // ---------- timeline (local seconds) ----------
  const K1 = [1.0, 1.6], K2 = [1.7, 2.3];      // two knife strokes down the green slip
  const DRY = [2.3, 3.2];                      // heat passes up the slip: it sweats and turns yellow
  const WR = 3.3, WD = .3, WC = .26;           // brush: char k from WR + k*WD, lasting WC
  const PULL = [4.45, 5.75], BIND = [4.7, 5.95];
  const Z0 = 1.6, Z1 = 790 / L, CY0 = 300, CYE = 430 + 105 / Z1;

  function cam(t) {
    const z0 = Z0 + .05 * smooth(1.0, 4.4, t), x0 = sx(HERO) - 290 / z0;
    const e = ease.inOut(clamp((t - PULL[0]) / (PULL[1] - PULL[0])));
    return { z: Math.exp(lerp(Math.log(z0), Math.log(Z1), e)), x: lerp(x0, 0, e), y: lerp(CY0, CYE, e) };
  }
  const shaved = t => t < K2[0] ? lerp(4, 430, smooth(K1[0], K1[1], t)) : lerp(430, L + 30, smooth(K2[0], K2[1], t));
  const heatY = t => lerp(L + 40, -40, inv(DRY[0], DRY[1], t));

  // ---------- textures ----------
  const LACQ = `void main(){ vec2 px=uv*R;
    float g=fbm3(vec2(px.x*.0012,px.y*.02))*.65+vn(vec2(px.x*.003,px.y*.18))*.35;
    vec3 c=mix(vec3(.058,.039,.031),vec3(.118,.076,.054),g);
    vec2 q=(uv-vec2(.5,.56))*vec2(1.2,1.65);
    float pool=exp(-dot(q,q)*2.1);
    c*=.6+.66*pool;
    c+=vec3(.05,.028,.016)*smoothstep(.55,.9,fbm3(px*.0021+7.))*pool;
    O=vec4(c,1.); }`;
  // one slip: rounded ends, longitudinal fibres, node ridges, cylinder shading. MODE 0 cured yellow, 1 raw green skin, 2 freshly planed
  const SLIP = `uniform float SEED; uniform float MODE; uniform float N1; uniform float N2; uniform float SC;
  void main(){ vec2 px=uv*R; float u=uv.x;
    float rc=R.x*.46;
    vec2 d=abs(px-R*.5)-(R*.5-vec2(rc));
    float sd=length(max(d,0.))+min(max(d.x,d.y),0.)-rc;
    float a=clamp(.5-sd,0.,1.);
    vec2 w=vec2(px.x/SC,(R.y-px.y)/SC);
    float f1=vn(vec2(w.x*.5+SEED*13.1,w.y*.004));
    float f2=vn(vec2(w.x*1.7+SEED*3.7,w.y*.03+SEED));
    float f3=vn(vec2(w.x*5.,w.y*.15+SEED*5.));
    float bl=fbm3(vec2(w.x*.01+SEED*2.3,w.y*.0035+SEED*7.));
    float e=abs(u-.5)*2.;
    vec3 yel=mix(vec3(.82,.715,.48),vec3(.67,.54,.32),smoothstep(.35,.8,bl));
    yel*=.9+.12*f1+.06*f2-.05*f3;
    vec3 grn=mix(vec3(.25,.35,.14),vec3(.42,.5,.21),f1*.6+bl*.5)*(.9+.12*f2);
    grn+=vec3(.12,.14,.07)*pow(1.-e,5.)*.8;
    vec3 frs=mix(vec3(.85,.86,.63),vec3(.75,.78,.52),bl)*(.93+.08*f1+.04*f2-.03*f3);
    vec3 col=MODE<.5?yel:(MODE<1.5?grn:frs);
    for(int k=0;k<2;k++){ float dn=w.y-(k==0?N1:N2);
      col*=1.-.15*exp(-dn*dn/26.);
      col+=.055*exp(-(dn+3.5)*(dn+3.5)/3.)-.06*exp(-(dn-3.5)*(dn-3.5)/3.); }
    col*=1.-.26*pow(e,2.5); col*=1.03-.08*u;
    col*=1.-.38*smoothstep(-4.,0.,sd);
    O=vec4(col,a); }`;

  let LAQ, SHADOW, SPECK, SPECKPAT = null, T = [], T_GREEN, T_FRESH, BUND = [];
  const NODES = [];

  function notch(c) { // 契口: small notches on the right edge where the cords sit
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'destination-out';
    for (const y of CORDY) { g.beginPath(); g.moveTo(TW + 1, (y - 7) * TS); g.lineTo(TW - 6 * TS, y * TS); g.lineTo(TW + 1, (y + 7) * TS); g.fill(); }
    return c;
  }

  // ---------- 東方朔's boards: bundles of wooden 牍 on a carrying litter ----------
  const PL = { cx: 960, floor: 846, plat: 716, rows: 6, cols: 5, bw: 136, gap: 8, bh: 8.5, per: 8, platW: 395, legX: 352, poleX: 522, S: 4.6 };
  const BH = PL.per * PL.bh;
  const ROWT = [10.45, 10.85, 11.22, 11.56, 11.87, 12.15];
  const READ0 = 15.1, READ_ROW = .36;
  function bakeBundle(seed) {
    const r = mulberry(seed), w = PL.bw + 14, h = Math.ceil(BH) + 4;
    const c = makeCanvas(w, h), g = c.getContext('2d');
    for (let j = 0; j < PL.per; j++) {
      const y = 2 + j * PL.bh, len = PL.bw - r() * 10, x = 7 + (r() - .5) * 12;
      const tn = .8 + r() * .24, warm = r() * 14;
      g.fillStyle = `rgb(${(222 * tn + warm) | 0},${(202 * tn) | 0},${(156 * tn - warm) | 0})`; g.fillRect(x, y, len, PL.bh - 1);
      g.fillStyle = 'rgba(255,246,222,.4)'; g.fillRect(x, y, len, 1);
      g.fillStyle = 'rgba(66,46,28,.6)'; g.fillRect(x, y + PL.bh - 1.6, len, 1.6);
      g.fillStyle = 'rgba(112,80,46,.75)'; g.fillRect(x, y, 3, PL.bh - 1); g.fillRect(x + len - 3, y, 3, PL.bh - 1);
      g.fillStyle = 'rgba(150,118,78,.28)';
      for (let s = 0; s < 3; s++) g.fillRect(x + r() * len * .5, y + 1 + r() * (PL.bh - 3), len * (.3 + r() * .4), .8);
    }
    for (const f of [.24, .76]) {
      const cx = 7 + PL.bw * f + (r() - .5) * 6;
      g.fillStyle = 'rgba(36,22,12,.6)'; g.fillRect(cx - 3.5, 0, 7, h);
      g.fillStyle = HEMP; g.fillRect(cx - 2.5, 0, 5, h);
      g.fillStyle = 'rgba(212,188,138,.5)'; for (let y = 1; y < h; y += 4) g.fillRect(cx - 2.5, y, 5, 1.4);
    }
    return c;
  }

  // ---------- shavings ----------
  const CURLS = [];
  {
    const r = mulberry(77);
    for (const [a, b] of [K1, K2]) for (let k = 0; k < 6; k++) {
      const tb = a + (k + .3 + r() * .4) / 6 * (b - a);
      const sd = k % 3 === 2 ? 1 : -1;
      CURLS.push({ tb, dx: sd * (40 + r() * 50), dy: (r() - .2) * 70, rot: r() * 6.28, spin: (r() - .5) * 3, size: 9 + r() * 7, open: 1.1 + r() * .9, asp: .5 + r() * .35 });
    }
  }
  function curl(g, x, y, R, rot, a, open, asp) { // a curved sliver of green rind thrown off by the blade
    if (a <= 0) return;
    g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a;
    const l = R * (1.6 + open), c = R * (asp + .25) * (open > 1.5 ? 1 : -1), w = R * .55;
    const body = () => { g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(-l * .2, -c * 2, l, -c * .4); g.quadraticCurveTo(0, -c * 2 + w * 2, -l, 0); g.closePath(); };
    body(); g.fillStyle = 'rgba(12,10,4,.25)'; g.save(); g.translate(2.5, 3.5); g.fill(); g.restore();
    g.fillStyle = '#CFD096'; g.fill();
    g.strokeStyle = 'rgba(40,48,16,.7)'; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(-l * .2, -c * 2, l, -c * .4); g.strokeStyle = '#5A6D2B'; g.lineWidth = R * .22; g.lineCap = 'round'; g.stroke();
    g.restore();
  }
  function shavings(g, t) {
    for (const cu of CURLS) {
      const age = t - cu.tb; if (age < 0 || age > 1.7) continue;
      const fly = ease.out(clamp(age / .55)), y0 = shaved(cu.tb);
      curl(g, sx(HERO) + cu.dx * fly, y0 + 4 + cu.dy * fly, cu.size * (.35 + .65 * clamp(age / .14)), cu.rot + cu.spin * fly, 1 - smooth(1.1, 1.7, age), cu.open, cu.asp);
    }
  }

  // ---------- tools ----------
  function knife(g, t) {
    const a = win(t, K1[0] - .2, K2[1] + .25, .15, .2);
    if (a <= 0) return;
    let y = shaved(t);
    if (t < K1[0]) y = lerp(-260, -30, ease.out(clamp((t - K1[0] + .2) / .2)));
    const lift = t > K1[1] && t < K2[0] ? Math.sin(Math.PI * inv(K1[1], K2[0], t)) : 0;
    const ex = ease.in(clamp((t - K2[1]) / .25));
    const cx = sx(HERO) + ex * 160 + lift * 8, cy = y + ex * 120 - lift * 16;
    const shape = (g2, dx, dy) => {
      g2.save(); g2.translate(cx + dx, cy + dy); g2.rotate(-.6);
      g2.beginPath(); g2.moveTo(-84, 0); g2.quadraticCurveTo(-30, 5, 60, 2); g2.lineTo(150, -1); g2.lineTo(150, -21);
      g2.lineTo(40, -23); g2.quadraticCurveTo(-46, -22, -84, 0); g2.closePath();
      return g2;
    };
    g.save(); g.globalAlpha = a;
    // shadow on the slips
    shape(g, 12 + lift * 12, 12 + lift * 12); g.fillStyle = 'rgba(8,5,2,.35)'; g.fill();
    g.fillRect(150, -19, 125, 16); g.beginPath(); g.arc(296, -11, 21, 0, 6.283); g.lineWidth = 8; g.strokeStyle = 'rgba(8,5,2,.35)'; g.stroke(); g.restore();
    // blade
    shape(g, 0, 0);
    const gr = g.createLinearGradient(0, -23, 0, 3);
    gr.addColorStop(0, '#3e372f'); gr.addColorStop(.55, '#6b6152'); gr.addColorStop(.9, '#8b826f'); gr.addColorStop(1, '#d8d0b9');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(20,14,8,.7)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(240,232,210,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-78, .5); g.quadraticCurveTo(-30, 4.5, 60, 1.5); g.lineTo(148, -1.5); g.stroke();
    // grip wrapped in cord, ring pommel (环首)
    g.fillStyle = '#3a291b'; g.fillRect(150, -19, 125, 16);
    g.strokeStyle = 'rgba(176,146,98,.75)'; g.lineWidth = 2;
    for (let u = 156; u < 272; u += 7) { g.beginPath(); g.moveTo(u, -19); g.lineTo(u + 4, -3); g.stroke(); }
    g.beginPath(); g.arc(296, -11, 21, 0, 6.283); g.lineWidth = 8; g.strokeStyle = '#5c5244'; g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(214,204,178,.6)'; g.beginPath(); g.arc(296, -11, 23, 3.6, 5.2); g.stroke();
    g.restore(); g.restore();
  }
  function brushTip(t) { // where the brush tip is and whether it touches
    const x0 = sx(HERO);
    if (t < WR) { const e = ease.out(clamp((t - WR + .3) / .3)); return [lerp(x0 + 260, x0, e), lerp(charY(0) - 300, charY(0) - 22, e), 1 - e]; }
    const k = Math.min(3, Math.floor((t - WR) / WD)), lt = t - WR - k * WD;
    if (k === 3 && lt > WC) { const e = ease.in(clamp((lt - WC) / .3)); return [x0 + e * 300, charY(3) + 22 - e * 260, e]; }
    if (lt <= WC) { const p = lt / WC; return [x0 + Math.sin(p * Math.PI * 4.5) * 13, charY(k) - 22 + p * 46, 0]; }
    const e = smooth(WC, WD, lt); return [x0 + Math.sin(e * Math.PI) * 6, lerp(charY(k) + 24, charY(k + 1) - 22, e), Math.sin(e * Math.PI) * .5];
  }
  function brush(g, t) {
    const a = win(t, WR - .3, WR + 3 * WD + WC + .3, .12, .15);
    if (a <= 0) return;
    const [bx, by, lift] = brushTip(t);
    const draw = (dx, dy, sh) => {
      g.save(); g.translate(bx + dx, by + dy); g.rotate(-1.18);
      if (sh) { g.fillStyle = 'rgba(8,5,2,.3)'; g.fillRect(30, -5, 270, 10); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(6, 6, 14, 7.5, 34, 5.5); g.lineTo(34, -5.5); g.bezierCurveTo(14, -7.5, 6, -6, 0, 0); g.fill(); g.restore(); return; }
      const gr = g.createLinearGradient(0, -5, 0, 5);
      gr.addColorStop(0, '#e4cf98'); gr.addColorStop(.45, '#c7a96b'); gr.addColorStop(1, '#7e6538');
      g.fillStyle = gr; g.fillRect(30, -5, 270, 10);
      g.fillStyle = 'rgba(90,64,30,.7)'; g.fillRect(150, -5, 3, 10); g.fillRect(262, -5, 3, 10);
      g.fillStyle = '#2b1e12'; g.fillRect(28, -5.5, 8, 11);
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(6, 6, 14, 7.5, 31, 5.5); g.lineTo(31, -5.5); g.bezierCurveTo(14, -7.5, 6, -6, 0, 0);
      g.fillStyle = '#17110c'; g.fill();
      g.strokeStyle = 'rgba(200,190,170,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(6, -2.5); g.quadraticCurveTo(16, -5, 28, -4); g.stroke();
      g.restore();
    };
    g.save(); g.globalAlpha = a;
    draw(8 + lift * 26, 9 + lift * 26, true);
    draw(0, 0, false);
    g.restore();
  }

  // ---------- the slips' surface details ----------
  function heroLayers(g, t) {
    const x = sx(HERO) - SW / 2, s = shaved(t), fe = Math.min(s, heatY(t));
    if (fe > 0 && t < DRY[1] + .1) { g.save(); g.beginPath(); g.rect(x - 2, -10, SW + 4, fe + 10); g.clip(); g.drawImage(T_FRESH, x, 0, SW, L); g.restore(); }
    if (s < L) {
      g.save(); g.beginPath(); g.rect(x - 2, s, SW + 4, L - s + 12); g.clip(); g.drawImage(T_GREEN, x, 0, SW, L); g.restore();
      if (s > 0) { g.fillStyle = 'rgba(30,38,12,.45)'; g.fillRect(x + 3, s - 1, SW - 6, 3); }
    }
  }
  const BEADS = [];
  { const r = mulberry(31); for (let j = 0; j < 54; j++) BEADS.push({ x: (r() - .5) * 44, y: 20 + r() * 800, r: 2.4 + r() * 3.2 }); }
  function beads(g, t) {
    if (t < DRY[0] || t > DRY[1] + .9) return;
    for (const b of BEADS) {
      const tp = lerp(DRY[0], DRY[1], (L + 40 - b.y) / (L + 80)), age = t - tp;
      if (age < 0 || age > .7) continue;
      const k = smooth(0, .12, age) * (1 - smooth(.35, .7, age)), r = b.r * k;
      if (r < .2) continue;
      const x = sx(HERO) + b.x;
      g.fillStyle = 'rgba(92,60,22,.5)'; g.beginPath(); g.ellipse(x + .8, b.y + 1.1, r * 1.05, r * 1.15, 0, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(250,236,196,.75)'; g.beginPath(); g.ellipse(x, b.y, r, r * 1.1, 0, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(255,255,248,.95)'; g.beginPath(); g.arc(x - r * .35, b.y - r * .42, r * .32, 0, 6.283); g.fill();
    }
  }
  function heat(g, t) {
    const a = win(t, DRY[0] - .1, DRY[1] + .15, .15, .2);
    if (a <= 0) return;
    const y = heatY(t), x = sx(HERO);
    g.save(); g.globalCompositeOperation = 'screen';
    g.translate(x, y); g.scale(1.5, .8);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 130);
    gr.addColorStop(0, `rgba(255,160,70,${.8 * a})`); gr.addColorStop(.45, `rgba(230,100,35,${.35 * a})`); gr.addColorStop(1, 'rgba(160,50,10,0)');
    g.fillStyle = gr; g.fillRect(-130, -130, 260, 260);
    g.restore();
  }
  function writing(g, t, a) {
    if (a <= 0) return;
    g.save(); font(g, 45, BRUSHF); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgba(84,62,38,${.34 * a})`;
    for (let i = 0; i < 9; i++) for (let k = 0; k < 11; k++) { const c = TEXT[i * 11 + k]; if (c) g.fillText(c, sx(i), charY(k) + 3); }
    for (let k = 0; k < 4; k++) {
      const p = clamp((t - WR - k * WD) / WC); if (p <= 0) continue;
      g.save();
      if (p < 1) { g.beginPath(); g.rect(sx(HERO) - 40, charY(k) - 32, 80, 64 * p + 4); g.clip(); }
      font(g, 49, BRUSHF); g.fillStyle = `rgba(18,12,8,${.97 * a})`; g.fillText(HERO_TXT[k], sx(HERO), charY(k) + 3);
      g.restore();
    }
    g.restore();
  }

  // ---------- binding cords: two twined hemp cords, over one slip and under the next ----------
  function strokeRope(g, path, w, col) {
    g.lineCap = 'butt';
    g.save(); g.translate(1.5, 2.5); g.strokeStyle = 'rgba(20,12,6,.35)'; g.lineWidth = w + 2; g.stroke(path); g.restore();
    g.strokeStyle = 'rgba(30,18,9,.85)'; g.lineWidth = w + 3.5; g.stroke(path);
    g.strokeStyle = col || HEMP; g.lineWidth = w; g.stroke(path);
    g.setLineDash([w * .5, w * .6]); g.strokeStyle = 'rgba(214,188,136,.55)'; g.lineWidth = w * .45; g.stroke(path);
    g.setLineDash([]);
  }
  function cords(g, t, alpha) {
    if (t < BIND[0] || alpha <= 0) return;
    const xr = sx(0) + SW / 2, xl = sx(N - 1) - SW / 2;
    g.save(); g.globalAlpha = alpha;
    for (let c = 0; c < 2; c++) {
      const f = clamp((t - BIND[0] - c * .12) / (BIND[1] - BIND[0] - .12));
      if (f <= 0) continue;
      const xf = lerp(xr + 10, xl - 10, ease.inOut(f)), y0 = CORDY[c], yy = x => y0 + Math.sin(x * .05 + c * 2) * 1.3;
      const p = new Path2D(), sh = new Path2D();
      // tail where the binding started
      const ts = smooth(0, .08, f), dir = c ? 1 : -1;
      p.moveTo(xr + 4, yy(xr)); p.bezierCurveTo(xr + 30, yy(xr), xr + 34 * ts, y0 + dir * 30 * ts, xr + 30 * ts, y0 + dir * 62 * ts);
      for (let i = 0; i < N; i++) {
        const a0 = sx(i) - SW / 2, a1 = sx(i) + SW / 2;
        if (a1 <= xf) break;
        const from = Math.max(a0, xf);
        if (i > 0) { p.moveTo(a1 - 1, yy(a1)); p.lineTo(a1 + PITCH - SW + 1, yy(a1 + 4)); }
        if ((i + c) % 2 === 0) { p.moveTo(from - 1, yy(from) - 1.5); p.lineTo(a1 + 1, yy(a1) + 1.5); }
        else { sh.rect(a1 - 3, y0 - 5, 3, 10); if (from === a0) sh.rect(a0, y0 - 5, 3, 10); }
      }
      // free end, then the tied-off tail once the row is bound
      p.moveTo(xf + 6, yy(xf)); p.lineTo(xf - 4, yy(xf) - 3);
      const te = smooth(1, 1.3, (t - BIND[0] - c * .12) / (BIND[1] - BIND[0] - .12));
      if (te > 0) { p.moveTo(xl, yy(xl)); p.bezierCurveTo(xl - 24, yy(xl), xl - 30 * te, y0 + dir * 30 * te, xl - 22 * te, y0 + dir * 70 * te); }
      g.fillStyle = 'rgba(30,20,10,.45)'; g.fill(sh);
      strokeRope(g, p, 10);
      if (te > 0) { g.fillStyle = HEMP; g.strokeStyle = 'rgba(22,13,7,.65)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(xl - 4, y0, 7 * te, 6 * te, 0, 0, 6.283); g.fill(); g.stroke(); }
    }
    g.restore();
  }

  // ---------- 册: the bound row becomes the ancient glyph, then the modern one ----------
  const BARS = [{ x: 792.2, top: 196, bot: 704 }, { x: 899.5, top: 262, bot: 650 }, { x: 1010.3, top: 184, bot: 716 }, { x: 1121.6, top: 270, bot: 642 }];
  const BW = 54, LOOP = { yu: 412, yl: 466, xl: 662, xr: 1262 };
  const GF = 565, GB = 679;   // modern 册 in Noto Serif SC 900: size and baseline (measured stroke positions below)
  const MOD = [
    [[792.2, 254], [792.2, 430], [792.2, 626], [724, 712]],
    [[899.5, 249], [899.5, 430], [899.5, 600], [899.5, 682]],
    [[1010.3, 254], [1010.3, 420], [1010.3, 610], [951, 712]],
    [[1121.6, 243], [1121.6, 430], [1121.6, 600], [1121.6, 698]],
  ];
  const TOPS = [[756.6, 953.2], [972.4, 1177]], TOPY = 250.7, HY = 439, HX = [693.3, 1239];
  const group = i => 3 - Math.floor(i * 4 / N);
  const toS = (wx, wy) => [wx * Z1 + 960, (wy - CYE) * Z1 + 540];

  const drawShadow = g => g.drawImage(SHADOW, sx(N - 1) - SW / 2 - 70 + 18, -70 + 24, (N * PITCH) + 140, L + 140);
  function glyphPhase(ctx, t) {
    const out = 1 - smooth(9.8, 10.25, t), rise = -36 * ease.in(clamp((t - 9.8) / .45));
    if (out <= 0) return;
    ctx.save(); ctx.translate(0, rise);
    // writing fades as the row lets go of its words
    const ta = 1 - smooth(6.3, 6.55, t);
    const texA = (1 - smooth(8.3, 8.6, t)) * out;
    if (texA > 0) {
      const sa = 1 - smooth(6.3, 6.75, t);
      if (sa > 0) { ctx.save(); ctx.globalAlpha = sa; ctx.translate(960, 540); ctx.scale(Z1, Z1); ctx.translate(0, -CYE); drawShadow(ctx); ctx.restore(); }
      ctx.globalAlpha = texA;
      for (let i = 0; i < N; i++) {
        const m = ease.inOut(clamp((t - 6.55 - hash2(i, 3) * .15) / .8)), b = BARS[group(i)];
        const [x0, y0] = toS(sx(i) - SW / 2, 0);
        ctx.drawImage(T[i], lerp(x0, b.x - BW / 2, m), lerp(y0, b.top, m), lerp(SW * Z1, BW, m), lerp(L * Z1, b.bot - b.top, m));
      }
      ctx.globalAlpha = 1;
      const ca = 1 - smooth(6.3, 6.6, t);
      if (ca > 0) { ctx.save(); ctx.translate(960, 540); ctx.scale(Z1, Z1); ctx.translate(0, -CYE); writing(ctx, 99, ta); cords(ctx, t, ca); ctx.restore(); }
    }
    // flat strokes: the four slips → four strokes of 册
    const fa = smooth(8.3, 8.6, t) * (1 - smooth(9.08, 9.24, t)) * out;
    const e2 = ease.inOut(clamp((t - 8.45) / .7));
    if (fa > 0) {
      ctx.save(); ctx.globalAlpha = fa; ctx.strokeStyle = CREAM; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      BARS.forEach((b, k) => {
        const anc = [0, .33, .66, 1].map(f => [b.x, lerp(b.top + BW / 2, b.bot - BW / 2, f)]);
        ctx.lineWidth = lerp(BW, 66, e2);
        ctx.beginPath(); anc.forEach((p, j) => { const q = MOD[k][j]; ctx.lineTo(lerp(p[0], q[0], e2), lerp(p[1], q[1], e2)); }); ctx.stroke();
      });
      if (e2 > 0) {
        ctx.lineWidth = 17; ctx.lineCap = 'butt'; ctx.globalAlpha = fa * smooth(0, .4, e2);
        for (const [a, b] of TOPS) { const m = (a + b) / 2, h = (b - a) / 2 * e2; ctx.beginPath(); ctx.moveTo(m - h, TOPY); ctx.lineTo(m + h, TOPY); ctx.stroke(); }
      }
      ctx.restore();
    }
    // the real glyph
    const ga = smooth(8.96, 9.1, t) * out;
    if (ga > 0) { ctx.save(); ctx.globalAlpha = ga; font(ctx, GF, SERIF, 900); ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('册', 960, GB); ctx.restore(); }
    // the binding cord → the oracle loop → the horizontal stroke, in seal red
    const ra = smooth(6.3, 6.6, t) * out;
    if (ra > 0) {
      const mc = ease.inOut(clamp((t - 6.6) / .85));
      const [xa] = toS(sx(N - 1) - SW / 2 - 8, 0), [xb] = toS(sx(0) + SW / 2 + 8, 0);
      const yu0 = toS(0, CORDY[0])[1], yl0 = toS(0, CORDY[1])[1];
      let yu = lerp(yu0, LOOP.yu, mc), yl = lerp(yl0, LOOP.yl, mc), xl = lerp(xa, LOOP.xl, mc), xr = lerp(xb, LOOP.xr, mc);
      yu = lerp(yu, HY, e2); yl = lerp(yl, HY, e2); xl = lerp(xl, HX[0], e2); xr = lerp(xr, HX[1], e2);
      const w = lerp(lerp(10 * Z1, 12, mc), 16.5, e2), rr = (yl - yu) / 2;
      ctx.save(); ctx.globalAlpha = ra; ctx.strokeStyle = SEAL; ctx.lineWidth = w; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(xr, yu); ctx.lineTo(xl, yu); ctx.moveTo(xl, yl); ctx.lineTo(xr, yl); ctx.stroke();
      const arcA = smooth(.55, 1, mc);
      if (arcA > 0 && rr > .5) { ctx.globalAlpha = ra * arcA; ctx.beginPath(); ctx.arc(xl, (yu + yl) / 2, rr, -Math.PI / 2, Math.PI / 2, true); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- Han tomb-brick rubbing figures (units: standing height 100, feet at 0, facing +x) ----------
  const FIG = {
    stand: {
      robe: [['M', -3, -79], ['C', -9, -77, -12, -70, -12, -60], ['C', -12, -46, -15, -30, -22, -15], ['C', -27, -6, -36, -2, -46, 0], ['L', 15, 0],
        ['C', 16, -7, 12, -20, 10, -32], ['C', 9, -44, 12, -58, 11, -68], ['C', 10, -74, 7, -78, 3, -80], ['Z']],
      cap: [['M', -4.5, -90.5], ['L', 0, -98], ['L', 10.5, -103.5], ['L', 9.5, -99.5], ['L', 5.5, -92], ['Z']],
      head: [2.5, -86, 6.6], knot: [-4, -88.5, 2.6], shoulder: [1, -71],
      lines: [[['M', 3, -79], ['L', -1, -71], ['L', 7, -64]], [['M', -13, -45], ['L', 10, -43]], [['M', -16, -26], ['C', -6, -20, 4, -14, 12, -12]]],
      clasp: [['M', 1, -72], ['C', 10, -71, 20, -64, 20, -55], ['C', 20, -47, 15, -41, 7, -40], ['C', 1, -42, -2, -52, -2, -62], ['Z']],
      present: [['M', -1, -73], ['C', 8, -75, 16, -76, 20, -72], ['L', 22, -63], ['C', 16, -57, 8, -52, 1, -54], ['Z']],
      board: [['M', 19.5, -93], ['L', 24.5, -93], ['L', 24.5, -61], ['L', 19.5, -61], ['Z']],
    },
    seat: {
      robe: [['M', -24, 0], ['C', -25, -12, -19, -22, -13, -28], ['C', -11, -38, -12, -48, -9, -55], ['C', -6, -59, -1, -60, 3, -59],
        ['C', 8, -55, 10, -47, 9, -40], ['C', 10, -30, 20, -20, 25, -8], ['C', 27, -3, 26, 0, 23, 0], ['Z']],
      cap: [['M', -10, -77.5], ['L', 14, -75.5], ['L', 14, -73.5], ['L', -10, -75], ['Z'], ['M', -3, -75], ['L', 5, -74.5], ['L', 4.5, -71], ['L', -2.5, -71], ['Z']],
      head: [2.5, -65.5, 6.4], knot: [-3.5, -68, 2.4], shoulder: [0, -53],
      lines: [[['M', 3, -59], ['L', -1, -51], ['L', 6, -45]], [['M', -12, -33], ['L', 9, -32]]],
      read: [['M', -2, -55], ['C', 6, -56, 13, -54, 16, -51], ['L', 16, -44], ['C', 11, -38, 4, -37, -2, -40], ['Z']],
      board: [['M', 15, -64], ['L', 19, -64], ['L', 19, -41], ['L', 15, -41], ['Z']],
      tassels: [[13.5, -75], [12, -75], [-9, -76.5], [-7.5, -76.3]],
    },
  };
  function figure(g, fx, fy, s, dir, o, alpha) {
    if (alpha <= 0) return;
    const D = o.seat ? FIG.seat : FIG.stand, lean = o.lean || 0;
    const X = (px, py) => {
      let x = px, y = py;
      if (lean) { const w = smooth(-38, -56, py), a = lean * w, dy = y + 40; x = px * Math.cos(a) - dy * Math.sin(a); y = px * Math.sin(a) + dy * Math.cos(a) - 40; }
      return [fx + dir * x * s, fy + y * s];
    };
    const path = (cmds, p = new Path2D()) => {
      for (const c of cmds) {
        if (c[0] === 'Z') { p.closePath(); continue; }
        const v = []; for (let k = 1; k < c.length; k += 2) v.push(...X(c[k], c[k + 1]));
        if (c[0] === 'M') p.moveTo(v[0], v[1]); else if (c[0] === 'L') p.lineTo(v[0], v[1]); else p.bezierCurveTo(...v);
      }
      return p;
    };
    const all = new Path2D();
    path(D.robe, all); path(D.cap, all);
    for (const [cx, cy, r] of [D.head, D.knot]) { const [hx, hy] = X(cx, cy); all.moveTo(hx + r * s, hy); all.arc(hx, hy, r * s, 0, 6.283); }
    if (o.arm === 'grip') {
      const [ax, ay] = X(...D.shoulder), [hx, hy] = o.hand;
      const dx = hx - ax, dy = hy - ay, len = Math.hypot(dx, dy), nx = -dy / len * dir, ny = dx / len * dir;
      const n = ny < 0 ? [-nx, -ny] : [nx, ny];
      all.moveTo(ax - n[0] * 5 * s, ay - n[1] * 5 * s); all.lineTo(hx - n[0] * 2.4 * s, hy - n[1] * 2.4 * s);
      all.lineTo(hx + n[0] * 2.8 * s, hy + n[1] * 2.8 * s);
      all.quadraticCurveTo((ax + hx) / 2 + n[0] * 13 * s, (ay + hy) / 2 + n[1] * 13 * s, ax + n[0] * 7 * s, ay + n[1] * 7 * s); all.closePath();
      all.moveTo(hx + 3 * s, hy); all.arc(hx, hy, 3 * s, 0, 6.283);
    } else if (o.arm) { path(D[o.arm], all); if (D.board && o.arm !== 'clasp') path(D.board, all); }
    g.save(); g.globalAlpha = alpha;
    g.fillStyle = RUB; g.fill(all);
    g.save(); g.clip(all);
    if (SPECKPAT) { g.fillStyle = SPECKPAT; g.fillRect(fx - 80 * s, fy - 110 * s, 160 * s, 112 * s); }
    g.restore();
    g.strokeStyle = 'rgba(38,26,16,.6)'; g.lineWidth = 1.3 * s / 3.6; g.lineCap = 'round';
    for (const ln of D.lines) g.stroke(path(ln));
    if (D.tassels) for (const [tx, ty] of D.tassels) { const [ax, ay] = X(tx, ty); g.strokeStyle = RUB; g.lineWidth = 1.2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax, ay + 7 * s); g.stroke(); }
    g.restore();
  }

  function moon(g, x, y, r, ph, a) {
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    g.fillStyle = 'rgba(221,208,180,.13)'; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    const k = Math.cos(ph * 2 * Math.PI), sg = ph < .5 ? 1 : -1, rx = Math.max(.01, r * Math.abs(k));
    g.beginPath(); g.moveTo(x, y - r);
    g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, sg < 0);
    if (sg * k > 0) g.ellipse(x, y, rx, r, 0, Math.PI / 2, -Math.PI / 2, true); else g.ellipse(x, y, rx, r, 0, Math.PI / 2, Math.PI * 1.5, false);
    g.fillStyle = '#E8DDC2'; g.fill();
    g.restore();
  }

  function hanPhase(ctx, t) {
    const a = smooth(9.95, 10.4, t);
    if (a <= 0) return;
    const S = PL.S, cx = PL.cx, rowW = PL.cols * (PL.bw + PL.gap) - PL.gap;
    const liftE = ease.inOut(clamp((t - 13.88) / .45)) - ease.inOut(clamp((t - 14.62) / .28));
    const lift = -60 * liftE + Math.sin(t * 47) * 1.8 * win(t, 14.25, 14.66, .1, .1);
    // ground line of the brick panel
    ctx.save(); ctx.globalAlpha = a;
    const gl = ctx.createLinearGradient(150, 0, 1770, 0);
    gl.addColorStop(0, 'rgba(220,208,180,0)'); gl.addColorStop(.12, 'rgba(220,208,180,.5)'); gl.addColorStop(.88, 'rgba(220,208,180,.5)'); gl.addColorStop(1, 'rgba(220,208,180,0)');
    ctx.fillStyle = gl; ctx.fillRect(150, PL.floor, 1620, 3);
    ctx.restore();
    // the litter: platform, legs, carrying pole
    ctx.save(); ctx.globalAlpha = a; ctx.translate(0, lift);
    ctx.fillStyle = '#4c3626';
    for (const sd of [-1, 1]) ctx.fillRect(cx + sd * PL.legX - 6, PL.plat + 12, 12, PL.floor - PL.plat - 12);
    ctx.fillStyle = '#5e4330'; ctx.fillRect(cx - PL.platW, PL.plat, PL.platW * 2, 14);
    ctx.fillStyle = 'rgba(232,200,150,.25)'; ctx.fillRect(cx - PL.platW, PL.plat, PL.platW * 2, 2);
    // bundles fall in rows
    for (let r = 0; r < PL.rows; r++) for (let c = 0; c < PL.cols; c++) {
      const tl = ROWT[r] + c * .035 + hash2(r, c) * .03;
      if (t < tl - .32) continue;
      const u = clamp((t - tl + .32) / .32), bt = t - tl;
      let dy = -(700 + r * 40) * (1 - u * u);
      if (bt > 0 && bt < .3) dy -= 8 * Math.sin(bt / .3 * Math.PI) * (1 - bt / .3);
      const x = cx - rowW / 2 + c * (PL.bw + PL.gap) + (hash2(c, r + 9) - .5) * 10 - 7, y = PL.plat - (r + 1) * BH - 2 + dy;
      ctx.drawImage(BUND[r * PL.cols + c], x, y);
    }
    // reading: a lamp-lit bar crawls along each row from the top, right to left; rows already read dim
    if (t > READ0 - .1) {
      for (let j = 0; j < PL.rows; j++) {
        const r = PL.rows - 1 - j, p = ease.inOut(clamp((t - READ0 - j * READ_ROW) / (READ_ROW - .04)));
        if (p <= 0) continue;
        const y = PL.plat - (r + 1) * BH, x1 = cx + rowW / 2 + 6, x0 = cx - rowW / 2 - 6, bx = lerp(x1, x0, p);
        ctx.fillStyle = 'rgba(28,16,8,.4)'; ctx.fillRect(bx, y, x1 - bx, BH);
        if (p < 1) {
          ctx.save(); ctx.globalCompositeOperation = 'screen';
          const gr = ctx.createRadialGradient(bx, y + BH / 2, 0, bx, y + BH / 2, 90);
          gr.addColorStop(0, 'rgba(255,190,110,.6)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = gr; ctx.fillRect(bx - 90, y - 40, 180, BH + 80); ctx.restore();
          ctx.fillStyle = 'rgba(255,226,170,.95)'; ctx.fillRect(bx - 2, y - 4, 4, BH + 8);
        }
      }
    }
    // front carrying pole
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(18,10,5,.7)'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(cx - PL.poleX, PL.plat + 7); ctx.lineTo(cx + PL.poleX, PL.plat + 7); ctx.stroke();
    ctx.strokeStyle = '#6e5038'; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = 'rgba(236,206,160,.3)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - PL.poleX + 2, PL.plat + 3); ctx.lineTo(cx + PL.poleX - 2, PL.plat + 3); ctx.stroke();
    ctx.restore();
    // dust where each row lands
    ctx.save(); ctx.globalAlpha = a;
    ROWT.forEach((tl, r) => {
      const age = t - tl - .05; if (age < 0 || age > .7) return;
      const y = PL.plat - r * BH, k = ease.out(age / .7);
      for (let q = 0; q < 12; q++) {
        const sd = q < 6 ? -1 : 1, h = hash2(r * 13 + q, 4);
        const x = cx + sd * (rowW / 2 + 8 + k * (40 + 80 * h)), yy = y - 5 - k * 24 * hash2(q, r + 2);
        ctx.fillStyle = `rgba(222,204,166,${.3 * (1 - k)})`; ctx.beginPath(); ctx.arc(x, yy, 4 + 11 * k * h, 0, 6.283); ctx.fill();
      }
    });
    ctx.restore();
    // 東方朔 presents his memorial; two officials lift it; the emperor reads by two moons
    const hx = cx - PL.poleX + 4, hy = PL.plat + 7 + lift;
    figure(ctx, 250, PL.floor, S, 1, { arm: 'present' }, a * win(t, 10.05, 13.85, .45, .35));
    const offA = win(t, 13.5, 15.2, .35, .32);
    if (offA > 0) {
      const lean = lerp(.46, .2, liftE), fx = hx - 24 * S;
      figure(ctx, fx, PL.floor, S, 1, { arm: 'grip', lean, hand: [hx, hy] }, offA);
      figure(ctx, 2 * cx - fx, PL.floor, S, -1, { arm: 'grip', lean, hand: [2 * cx - hx, hy] }, offA);
    }
    const read = clamp((t - READ0) / (PL.rows * READ_ROW));
    figure(ctx, 1680, PL.floor, S, -1, { seat: 1, arm: 'read' }, smooth(14.95, 15.35, t));
    moon(ctx, 1690, 236, 34, (.5 + 2 * read) % 1, smooth(14.95, 15.35, t));
  }

  // ---------- incoming transition: slips drop into place one after another, right to left ----------
  const TR = { type: 'bamboo_slats', d: 1.2 };
  TRANS.bamboo_slats = (ctx, A, B, p) => {
    const c = cam(p * TR.d), w = SW * c.z, r = w * .46, top0 = (0 - c.y) * c.z + 540;
    ctx.drawImage(A, 0, 0);
    const fade = smooth(.78, 1, p);
    if (fade > 0) { ctx.globalAlpha = fade; ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1; }
    const vis = [];
    for (let i = 0; i < N; i++) { const x = (sx(i) - c.x) * c.z + 960; if (x > -w && x < W + w) vis.push(x); }
    vis.forEach((x, k) => {
      const d0 = k / vis.length * .46 + (hash2(k, 7) - .5) * .1 + .02;
      const u = clamp((p - d0) / .32);
      if (u <= 0) return;
      let dy;
      if (u < .62) dy = -(H + 160) * (1 - (u / .62) ** 2);
      else { const b = (u - .62) / .38; dy = -16 * Math.abs(Math.sin(b * Math.PI * 2)) * (1 - b) ** 1.5; }
      const x0 = x - w / 2, top = dy + top0, len = H + r - top0;
      // shadow cast on the frame below
      ctx.fillStyle = `rgba(10,6,3,${.4 * clamp(u * 2)})`;
      ctx.beginPath(); ctx.roundRect(x0 + 10, top + 14, w, len, r); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(x0, top, w, len, r); ctx.clip();
      ctx.drawImage(B, x0, 0, w, H, x0, dy, w, H);
      ctx.drawImage(B, x0, H - 2, w, 2, x0, dy + H - 1, w, r + 2);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,26,12,.55)'; ctx.stroke();
      ctx.restore();
    });
  };

  // subs(): revealText() places each glyph by its left edge while textAlign is 'center'; draw single glyphs left-aligned
  function subsCtx(ctx) {
    return new Proxy(ctx, {
      get(o, k) {
        if (k === 'fillText') return (s, x, y) => {
          if (o.textAlign === 'center' && [...s].length === 1) { o.textAlign = 'left'; o.fillText(s, x, y); o.textAlign = 'center'; } else o.fillText(s, x, y);
        };
        const v = o[k]; return typeof v === 'function' ? v.bind(o) : v;
      },
      set(o, k, v) { o[k] = v; return true; },
    });
  }

  scene({
    id: 'bamboo', n: ch.n, dur: ch.dur, trans: TR,
    cues: [
      { t: .28, sfx: 'bamboo', v: .7 }, { t: .55, sfx: 'bamboo', v: .8 }, { t: .82, sfx: 'bamboo' },
      { t: 1.05, sfx: 'carve' }, { t: 1.75, sfx: 'carve' }, { t: 2.35, sfx: 'fire', v: .5 },
      { t: 3.32, sfx: 'brush' }, { t: 3.62, sfx: 'brush' }, { t: 3.92, sfx: 'brush' }, { t: 4.22, sfx: 'brush' },
      { t: 4.75, sfx: 'cord' }, { t: 5.5, sfx: 'cord', v: .7 }, { t: 7.3, sfx: 'bamboo', v: .8 }, { t: 8.5, sfx: 'brush', v: .8 },
      ...ROWT.map((tl, r) => ({ t: tl, sfx: 'wood', v: +(.6 + r * .08).toFixed(2) })),
      { t: 13.95, sfx: 'wood', v: .5 }, { t: 14.88, sfx: 'wood', v: .7 },
    ],
    init() {
      LAQ = GL.bake(LACQ, W, H);
      const r = mulberry(5150);
      for (let i = 0; i < N; i++) {
        const n1 = 250 + r() * 90, n2 = n1 + 330 + r() * 100, seed = r() * 50;
        NODES.push([n1, n2]);
        const u = { SEED: seed, N1: n1, N2: n2, SC: TS };
        T.push(notch(GL.bake(SLIP, TW, TH, { ...u, MODE: 0 })));
        if (i === HERO) { T_GREEN = notch(GL.bake(SLIP, TW, TH, { ...u, MODE: 1 })); T_FRESH = notch(GL.bake(SLIP, TW, TH, { ...u, MODE: 2 })); }
      }
      SHADOW = makeCanvas(500, 300);
      { const g = SHADOW.getContext('2d'); g.filter = 'blur(26px)'; g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(70, 70, 360, 160); }
      SPECK = makeCanvas(256, 256);
      { const g = SPECK.getContext('2d'), rr = mulberry(808);
        for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(30,20,12,${(.15 + rr() * .5).toFixed(2)})`; g.beginPath(); g.arc(rr() * 256, rr() * 256, .4 + rr() * 1.5, 0, 6.283); g.fill(); }
        for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(30,20,12,.18)'; g.fillRect(rr() * 256, rr() * 256, 6 + rr() * 22, 1 + rr() * 1.5); } }
      for (let k = 0; k < PL.rows * PL.cols; k++) BUND.push(bakeBundle(900 + k * 17));
    },
    draw(ctx, t) {
      if (!SPECKPAT) SPECKPAT = ctx.createPattern(SPECK, 'repeat');
      ctx.drawImage(LAQ, 0, 0);
      if (t < 6.3) {
        const c = cam(t);
        ctx.save();
        ctx.translate(960, 540); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y);
        drawShadow(ctx);
        for (let i = 0; i < N; i++) {
          const X = (sx(i) - c.x) * c.z + 960; if (X < -SW * c.z || X > W + SW * c.z) continue;
          ctx.drawImage(T[i], sx(i) - SW / 2, 0, SW, L);
        }
        heroLayers(ctx, t);
        writing(ctx, t, 1);
        beads(ctx, t);
        heat(ctx, t);
        cords(ctx, t, 1);
        shavings(ctx, t);
        knife(ctx, t);
        brush(ctx, t);
        ctx.restore();
      } else {
        glyphPhase(ctx, t);
        hanPhase(ctx, t);
      }
      vignette(ctx, .42, '12,7,4', .42);
      opener(ctx, t, ch, {
        ink: INK, sub: '#46351f', accent: SEAL, x: 150, y: 470, align: 'left', inAt: 1.0, outAt: 3.0,
        title: { family: BRUSHF, size: 220, weight: 400, sp: 26 },
        small: { family: SERIF, size: 30, weight: 700 },
        num: { family: SERIF, size: 62, weight: 900 },
        backdrop: (g, b, al) => {
          g.save(); g.translate(470, 520); g.scale(560, 270);
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
          gr.addColorStop(0, `rgba(236,222,184,${(.7 * al).toFixed(3)})`); gr.addColorStop(.6, `rgba(232,216,174,${(.45 * al).toFixed(3)})`); gr.addColorStop(1, 'rgba(228,210,166,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 6.283); g.fill(); g.restore();
        },
      });
      subs(subsCtx(ctx), t, ch, {
        ink: CREAM, body: { family: SERIF, size: 52, weight: 700 }, y: 1000, shadow: 'rgba(12,7,3,.75)', noteInk: '#D8C8A4',
        bandFn: (g, x, y, w, h, al) => {
          g.save(); g.translate(x + w / 2, y + h / 2 + 10); g.scale(w / 2 + 160, h / 2 + 52);
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
          gr.addColorStop(0, `rgba(20,12,7,${(.72 * al).toFixed(3)})`); gr.addColorStop(.6, `rgba(20,12,7,${(.55 * al).toFixed(3)})`); gr.addColorStop(1, 'rgba(20,12,7,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 6.283); g.fill(); g.restore();
        },
      });
      grain(ctx, t, .045);
    },
  });
})();
