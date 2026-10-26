// 01 结绳 — Andean khipu on a hand-woven camelid textile with an Inca tocapu band.
// Beats: the hook's cinnabar thread drops and thickens into the primary cord while the cloth is lowered over the
// paper (knot_rope) · title over calm weave · one pendant drops and a knot ties itself (the Chinese legend) ·
// the khipu unfurls, one pendant is read as 1·3·0·6 · it multiplies into an archive of ~1,400 that mostly dims ·
// colours fade, fibres fray, the primary cord snaps and the khipu falls away.
'use strict';
(() => {
  const ch = CH('knot');
  const TR = { type: 'knot_rope', d: 1.2 };
  const KX = 1.15, TW = Math.round(W * KX), TH = Math.round(H * KX);

  // ---------- palette (rgb arrays) ----------
  const PAL = {
    dk: [107, 78, 53], md: [166, 138, 100], cr: [217, 199, 166], cot: [229, 216, 189],
    red: [163, 38, 42], ind: [44, 62, 107], saf: [217, 163, 58], brn: [84, 59, 40], cin: [176, 65, 46],
  };
  const PRA = PAL.red, PRB = PAL.brn;      // primary cord: cochineal red plied with dark brown
  const c255 = v => Math.max(0, Math.min(255, v | 0));
  const css = (c, a = 1) => `rgba(${c255(c[0])},${c255(c[1])},${c255(c[2])},${a})`;
  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const lum = c => .3 * c[0] + .59 * c[1] + .11 * c[2];
  const faded = c => { const l = lum(c); return [l * 1.02 + 34, l * .95 + 28, l * .8 + 18]; };

  // ---------- woven ground: weft-faced tapestry, beads sample the design (so motifs look woven) ----------
  const TEXTILE = `
  uniform float K; uniform float DEC;
  const vec3 DK=vec3(.42,.306,.208), MD=vec3(.651,.541,.392), CR=vec3(.851,.78,.651);
  const vec3 RD=vec3(.639,.149,.165), IN=vec3(.173,.243,.42), SF=vec3(.851,.639,.227), BK=vec3(.14,.095,.065);
  vec3 combo(float c,float m){
    vec3 A,B,C;
    if(c<1.){A=RD;B=SF;C=BK;}else if(c<2.){A=IN;B=CR;C=RD;}else if(c<3.){A=SF;B=RD;C=IN;}else if(c<4.){A=CR;B=BK;C=RD;}
    else if(c<5.){A=RD;B=CR;C=IN;}else if(c<6.){A=BK;B=SF;C=CR;}else if(c<7.){A=IN;B=SF;C=CR;}else{A=SF;B=BK;C=RD;}
    return m<.5?A:(m<1.5?B:C);
  }
  vec3 tocapu(vec2 g,float id){
    float pt=floor(h21(vec2(id,9.13))*8.), cb=floor(h21(vec2(id,3.71))*8.), m;
    if(pt<1.){ m=((g.x<4.)==(g.y<4.))?0.:1.; vec2 r=mod(g,4.); if(r.x>.5&&r.x<2.5&&r.y>.5&&r.y<2.5) m=2.; }
    else if(pt<2.){ float s=g.x+g.y; m=s<6.5?0.:(s<8.5?2.:1.); }
    else if(pt<3.){ float r=min(min(g.x,7.-g.x),min(g.y,7.-g.y)); m=mod(r,3.); }
    else if(pt<4.){ m=(abs(g.x-3.5)<1.||abs(g.y-3.5)<1.)?0.:1.; if((g.x<1.||g.x>6.)&&(g.y<1.||g.y>6.)) m=2.; }
    else if(pt<5.){ m=g.y<4.?0.:1.; if(abs(g.x-g.y)<.5||abs(g.x+g.y-7.)<.5) m=2.; }
    else if(pt<6.){ float d=abs(g.x-3.5)+abs(g.y-3.5); m=d<2.?0.:(d<4.?2.:1.); }
    else if(pt<7.){ m=mod(floor(g.x/2.)+floor(g.y/2.),2.); }
    else { float s=floor(g.x/2.)+floor(g.y/2.); m=s<2.5?0.:(s<3.5?2.:1.); }
    return combo(cb,m);
  }
  vec3 design(vec2 b){
    float y=b.y;
    if(y<9.) return DK*.75; if(y<15.) return CR; if(y<21.) return RD;
    if(y<119.){ float per=93., id=floor(b.x/per), lx=b.x-id*per, ly=y-21.;
      if(lx<5.||ly<5.||ly>93.) return BK; return tocapu(floor(vec2((lx-5.)/11.,(ly-5.)/11.)),id); }
    if(y<125.) return RD; if(y<131.) return CR; if(y<142.) return DK*.75;
    if(y>1042.){ if(y<1050.) return DK*.75; if(y<1056.) return CR; if(y<1062.) return SF*.92; if(y<1068.) return CR; return DK*.75; }
    float ab=fbm3(vec2(b.x*.0011,b.y*.017));
    vec3 g=mix(DK,MD,.3+.42*ab);
    if(abs(y-164.)<3.2||abs(y-1022.)<3.2) g=mix(g,CR,.5);
    return g;
  }
  void main(){
    vec2 p=vec2(uv.x,1.-uv.y)*R/K;
    float wob=(fbm3(vec2(p.x*.0024,p.y*.0042))-.5)*8.;
    float rowH=6.1, colW=10.2;
    float ry=(p.y+wob)/rowH, r=floor(ry), fy=fract(ry);
    float xo=mod(r,2.)*.5+(h21(vec2(r,1.9))-.5)*.12;
    float cx=p.x/colW+xo, c=floor(cx), fx=fract(cx);
    vec2 bc=vec2((c+.5-xo)*colW,(r+.5)*rowH-wob);
    vec3 col=design(bc);
    float rowv=h21(vec2(r,4.2));                       // every weft pick is a slightly different hand-spun yarn
    col*=.93+.13*rowv;
    float slub=smoothstep(.8,.95,vn(vec2(p.x*.028,r*1.7)));   // slubs: thick, lighter spots in the yarn
    col=mix(col,col*1.16+.025,slub*.55);
    float hb=h21(vec2(c,r)+.37);
    vec2 d=vec2((fx-.5)*2.,(fy-.5)*2.1);
    float dome=sqrt(max(0.,1.-dot(d,d)*.8));
    float ply=.5+.5*sin((fx*colW*.9-fy*rowH*1.6)*1.35+hb*6.28);
    float fz=vn(p*vec2(.55,1.9))*.6+vn(p*vec2(1.7,.45)+5.)*.4;
    vec3 o=col*(.5+.58*dome)*(.9+.12*ply)*(.88+.2*fz)*(.93+.12*hb);
    o*=1.+.14*(-d.x*.3-d.y*.6)*dome;
    // age: sun-faded colour, worn patches, moth holes with fuzzy rims
    float fdm=DEC*(.55+.45*fbm3(p*.006+4.));
    float l=dot(o,vec3(.3,.59,.11));
    vec3 fdc=vec3(l*1.02+.13,l*.95+.11,l*.8+.07);
    o=mix(o,fdc,clamp(fdm*.9,0.,1.));
    // moths eat whole weft passes (decided per bead, so the hole edge follows the weave) and leave the undyed
    // warp threads standing across the gap, some of them broken
    float hn=fbm(bc*.017+9.)+DEC*.06+vn(bc*.35)*.03+(fbm3(bc*.0016+2.)-.5)*.42;
    float hole=step(.85,hn)*step(.04,DEC);
    float rim=smoothstep(.8,.85,hn)*step(.04,DEC)*(1.-hole);
    o=mix(o,o*1.1+.04*fz,rim*.7);
    vec3 back=vec3(.1,.062,.04)*(.8+.4*fz);
    float wq=p.x/(colW*.5), wk=floor(wq+.5), wd=abs(wq-wk);
    float keep=step(.56,vn(vec2(wk*1.73,p.y*.05+wk*3.1)));
    float wsh=sqrt(max(0.,1.-wd*wd/.09));
    float warp=smoothstep(.3,.2,wd)*keep;
    vec3 wc=vec3(.74,.65,.5)*(.42+.62*wsh)*(.9+.14*sin(p.y*1.3+wk*2.1-p.x*.5));
    back=mix(back*(1.-.35*smoothstep(.6,.3,abs(wq-wk-.2))*keep),wc,warp);
    o=mix(o,back,hole);
    O=vec4(o,1.);
  }`;

  // ---------- geometry (world units = screen px at zoom 1) ----------
  const PW = 11, PRW = 13, PX0 = 150, PX1 = 1770, XS = 905, MID = 6;
  const pcY = x => 205 + 18 * (1 - Math.pow((x - 960) / 810, 2));
  const TIER = [318, 418, 518, 640];   // thousands, hundreds, tens, units
  function knotsFor(v, attachY, w) {
    const d = [Math.floor(v / 1000) % 10, Math.floor(v / 100) % 10, Math.floor(v / 10) % 10, v % 10], out = [];
    for (let k = 0; k < 3; k++) for (let j = 0; j < d[k]; j++)
      out.push({ s: TIER[k] - attachY + (j - (d[k] - 1) / 2) * 1.32 * w, type: 's', tier: k, j });
    if (d[3] === 1) out.push({ s: TIER[3] - attachY, type: 'e', tier: 3, j: 0 });
    else if (d[3] > 1) out.push({ s: TIER[3] - attachY, type: 'l', n: d[3], tier: 3, j: 0 });
    return out;
  }
  function makeKhipu(seed, n, values, cols, prim) {
    const r = mulberry(seed), p = [];
    const span = Math.min(1320, 110 * (n - 1)), x0 = 960 - span / 2;
    for (let i = 0; i < n; i++) {
      const x = n > 1 ? x0 + span * i / (n - 1) : 960, ay = pcY(x);
      const c = cols[i % cols.length];
      p.push({ x, L: 540 + r() * 50, a: c[0], b: c[1] || null, dir: r() < .5 ? 1 : -1, seed: seed * 100 + i,
        knots: knotsFor(values[i], ay, PW) });
    }
    return { p, prim: prim || [PRA, PRB], seed };
  }
  const MAIN = makeKhipu(7, 13, [432, 1251, 87, 316, 205, 2143, 1306, 64, 527, 1180, 341, 26, 703], [
    [PAL.cot], [PAL.brn], [PAL.saf], [PAL.ind], [PAL.cot, PAL.brn], [PAL.red], [PAL.cot],
    [PAL.ind, PAL.cot], [PAL.dk], [PAL.saf, PAL.red], [PAL.red, PAL.cot], [PAL.cr], [PAL.ind]]);
  MAIN.p[MID].L = 545;

  // ---------- drawing primitives ----------
  // Resample a polyline on a grid of arc length `step` aligned to s0 (so a sub-run of a strand keeps the strand's
  // ply phase). F[k] = global grid index of point k (-1 for the two end points).
  function resample(pts, step, s0 = 0) {
    const n = pts.length, cum = new Float64Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const len = cum[n - 1], S = [0], F = [-1];
    let j = Math.floor(s0 / step + 1e-9) + 1;
    for (let s = j * step - s0; s < len - step * .15; s += step, j++) { S.push(s); F.push(j); }
    S.push(len); F.push(-1);
    const m = S.length, P = new Array(m); let q = 0;
    for (let k = 0; k < m; k++) {
      const sk = S[k];
      while (q < n - 2 && cum[q + 1] < sk) q++;
      const sl = cum[q + 1] - cum[q] || 1, f = clamp((sk - cum[q]) / sl);
      P[k] = [lerp(pts[q][0], pts[q + 1][0], f), lerp(pts[q][1], pts[q + 1][1], f)];
    }
    const T = P.map((_, k) => {
      const a = P[Math.max(0, k - 1)], b = P[Math.min(m - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    });
    return { P, T, F, len, st: step };
  }
  // A plied cord, shaded inside its own silhouette: plies separated by helical grooves (S or Z twist),
  // soft creases and crests, cylinder light from the upper left, a cast shadow and loose fibres.
  function tube(ctx, pts, w, st) {
    if (pts.length < 2 || w < .25) return;
    const R = resample(pts, Math.max(.6, w * .475), st.s0 || 0);
    if (R.len < .5) return;
    const P = R.P, T = R.T, n = P.length, hw = w / 2;
    const path = new Path2D(); path.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < n; i++) path.lineTo(P[i][0], P[i][1]);
    const a = st.a, sh = st.shade ?? 1, tw = st.twist ?? 1, dir = st.dir || 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (st.cast !== false && sh > 0) {
      ctx.save(); ctx.translate(w * .26, w * .42); ctx.strokeStyle = `rgba(30,17,8,${(.36 * sh).toFixed(3)})`;
      ctx.lineWidth = w * 1.06; ctx.stroke(path); ctx.restore();
    }
    if (w < 2.4) { ctx.strokeStyle = css(a); ctx.lineWidth = w; ctx.stroke(path); return; }
    // silhouette with round caps
    const ol = new Path2D();
    ol.moveTo(P[0][0] - T[0][1] * hw, P[0][1] + T[0][0] * hw);
    for (let i = 1; i < n; i++) ol.lineTo(P[i][0] - T[i][1] * hw, P[i][1] + T[i][0] * hw);
    const te = Math.atan2(T[n - 1][1], T[n - 1][0]);
    ol.arc(P[n - 1][0], P[n - 1][1], hw, te + Math.PI / 2, te - Math.PI / 2, true);
    for (let i = n - 1; i >= 0; i--) ol.lineTo(P[i][0] + T[i][1] * hw, P[i][1] - T[i][0] * hw);
    const t0 = Math.atan2(T[0][1], T[0][0]);
    ol.arc(P[0][0], P[0][1], hw, t0 - Math.PI / 2, t0 + Math.PI / 2, true);
    ol.closePath();
    ctx.save(); ctx.clip(ol);
    ctx.fillStyle = css(a); ctx.fill(ol);
    if (tw > .02) {
      const r = w * .62, pq = w * .5, F = R.F;
      const pa = new Path2D(), pb = new Path2D(), gv = new Path2D(), gs = new Path2D(), cr = new Path2D();
      const G = (q, k, s0 = -1, s1 = 1, sh0 = 0) => {   // point k (0..4) on the helical groove through P[q], shifted along the axis
        const p = P[q], tt = T[q], u = s0 + (s1 - s0) * k / 4, th = u * Math.PI / 2;
        const lat = r * Math.sin(th), ax = dir * pq * u * .5 + sh0;
        return [p[0] - tt[1] * lat + tt[0] * ax, p[1] + tt[0] * lat + tt[1] * ax];
      };
      const line = (pp, q, s0, s1, sh0) => { let z = G(q, 0, s0, s1, sh0); pp.moveTo(z[0], z[1]); for (let j = 1; j <= 4; j++) { z = G(q, j, s0, s1, sh0); pp.lineTo(z[0], z[1]); } };
      const gi = []; for (let k = 0; k < n; k++) if (F[k] >= 0 && F[k] % 2 === 0) gi.push(k);
      for (let m = 0; m < gi.length; m++) {
        const i = gi[m], tt = T[i], ss = (tt[0] * -.6 + tt[1] * -.8) < 0 ? -1 : 1;   // which side of a crease is in shade
        line(gv, i, -1, 1, 0);
        line(gs, i, -1, 1, ss * w * .17);
        line(cr, i, -ss * .05, -ss * .75, -ss * w * .26);
        if (m < gi.length - 1 && st.b && ((F[i] / 2) | 0) % 2) {
          const i2 = gi[m + 1]; let z = G(i, 0); pb.moveTo(z[0], z[1]);
          for (let j = 1; j <= 4; j++) { z = G(i, j); pb.lineTo(z[0], z[1]); }
          for (let j = 4; j >= 0; j--) { z = G(i2, j); pb.lineTo(z[0], z[1]); }
          pb.closePath();
        }
      }
      ctx.globalAlpha = tw;
      if (st.b) { ctx.fillStyle = css(st.b); ctx.fill(pb); }
      const dk = mul(a, .1);
      ctx.strokeStyle = css(dk, .2); ctx.lineWidth = w * .34; ctx.stroke(gs);
      for (const [wd, al] of [[.3, .16], [.15, .3], [.07, .5]]) { ctx.strokeStyle = css(dk, al); ctx.lineWidth = Math.max(.6, w * wd); ctx.stroke(gv); }
      for (const [wd, al] of [[.24, .1], [.1, .24]]) { ctx.strokeStyle = `rgba(255,249,234,${al})`; ctx.lineWidth = Math.max(.5, w * wd); ctx.stroke(cr); }
      ctx.globalAlpha = 1;
    }
    if (sh > 0) {   // cylinder: dark flanks, light toward the upper left, deep shade on the lower right
      ctx.strokeStyle = `rgba(14,7,2,${(.34 * sh).toFixed(3)})`; ctx.lineWidth = w * 1.05; ctx.stroke(path);
      ctx.save(); ctx.translate(-w * .06, -w * .08);
      ctx.strokeStyle = `rgba(255,244,224,${(.13 * sh).toFixed(3)})`; ctx.lineWidth = w * .78; ctx.stroke(path);
      ctx.strokeStyle = `rgba(255,244,224,${(.12 * sh).toFixed(3)})`; ctx.lineWidth = w * .5; ctx.stroke(path);
      ctx.restore();
      ctx.save(); ctx.translate(-w * .15, -w * .19); ctx.strokeStyle = `rgba(255,250,238,${(.2 * sh).toFixed(3)})`; ctx.lineWidth = w * .16; ctx.stroke(path); ctx.restore();
      ctx.save(); ctx.translate(w * .34, w * .42); ctx.strokeStyle = `rgba(12,6,2,${(.3 * sh).toFixed(3)})`; ctx.lineWidth = w * .5; ctx.stroke(path); ctx.restore();
    }
    ctx.restore();
    if (!st.noLine) { ctx.strokeStyle = css(mul(a, .22), .55 * sh); ctx.lineWidth = Math.max(.5, w * .06); ctx.stroke(ol); }
    if (st.hair > 0 && w > 1.2) {
      const rnd = mulberry(st.seed || 1), hp = new Path2D(), cnt = Math.min(500, Math.round(st.hair));
      for (let k = 0; k < cnt; k++) {
        const q = Math.min(n - 1, Math.floor(rnd() * n)), p = P[q], tt = T[q], sd = rnd() < .5 ? -1 : 1;
        const L = w * (.25 + rnd() * .85) * (st.hairLen || 1), sk = (rnd() - .5) * 1.4;
        const bx = p[0] - tt[1] * w * .4 * sd, by = p[1] + tt[0] * w * .4 * sd;
        const ex = bx - tt[1] * L * sd + tt[0] * L * sk, ey = by + tt[0] * L * sd + tt[1] * L * sk;
        hp.moveTo(bx, by); hp.quadraticCurveTo(bx - tt[1] * L * .6 * sd + tt[0] * L * .45, by + tt[0] * L * .6 * sd + tt[1] * L * .45, ex, ey);
      }
      ctx.strokeStyle = css(mix3(a, [238, 226, 204], .5), .5); ctx.lineWidth = Math.max(.5, w * .045); ctx.stroke(hp);
    }
  }
  // Knot as a strand wrapped round its own cord: helix around the local axis, split into front and back runs.
  function helix(C, T, sp) {
    const n = sp.n, rho = sp.rho, pitch = sp.pitch, prog = sp.prog ?? 1, hand = sp.hand || 1;
    const Nx = -T[1], Ny = T[0], full = Math.PI * 2 * n, thE = full * prog, L = pitch * n;
    const steps = Math.max(5, Math.ceil(24 * n * prog)), front = [], back = [], all = [];
    let cur = null, cf = null, sl = 0, prev = null;
    const tilt = sp.tilt ?? .34;
    for (let k = 0; k <= steps; k++) {
      const u = thE * k / steps, th = Math.PI + u;   // starts and ends behind the cord
      const hs = sp.fig && u > Math.PI * 2 ? -hand : hand;
      const x = rho * Math.sin(th) * hs, zc = Math.cos(th), fr = zc >= 0;
      const a = -L / 2 + pitch * u / (Math.PI * 2) + zc * rho * tilt;   // seen a little from above: the front half sits lower
      const pt = [C[0] + T[0] * a + Nx * x, C[1] + T[1] * a + Ny * x];
      if (prev) sl += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
      prev = pt; all.push(pt);
      if (fr !== cf) { if (cur) cur.pts.push(pt); cur = { pts: [pt], s0: sl }; (fr ? front : back).push(cur); cf = fr; } else cur.pts.push(pt);
    }
    return { front, back, all };
  }
  function knotSpec(kn, w, ks, dir) {
    const lo = ks.loose;
    if (kn.type === 's') return { n: 1, rho: lerp(.58 * w, 2.3 * w, lo), pitch: lerp(1.35 * w, 2.2 * w, lo), Lt: 1.35 * w, prog: ks.prog, hand: dir };
    if (kn.type === 'e') return { n: 2, fig: true, rho: lerp(.52 * w, 2 * w, lo), pitch: lerp(.8 * w, 1.8 * w, lo), Lt: 1.6 * w, prog: ks.prog, hand: dir };
    return { n: kn.n, rho: lerp(.56 * w, 2.1 * w, lo), pitch: lerp(.9 * w, 1.9 * w, lo), Lt: .9 * w * kn.n, prog: ks.prog, hand: dir };
  }
  function tassel(ctx, E, T, w, col, seed, len = 1) {
    const rnd = mulberry(seed), p = new Path2D(), base = Math.atan2(T[1], T[0]);
    for (let k = 0; k < 9; k++) {
      const ang = base + (k / 8 - .5) * .8 + (rnd() - .5) * .16, L = w * (1.2 + rnd() * 1.3) * len;
      const off = (k / 8 - .5) * w * .7, sx = E[0] - T[0] * w * .35 - T[1] * off, sy = E[1] - T[1] * w * .35 + T[0] * off;
      p.moveTo(sx, sy); p.quadraticCurveTo(sx + Math.cos(ang) * L * .5, sy + Math.sin(ang) * L * .5 + w * .1, sx + Math.cos(ang) * L, sy + Math.sin(ang) * L);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(mul(col, .45), .9); ctx.lineWidth = Math.max(.7, w * .22); ctx.stroke(p);
    ctx.strokeStyle = css(mix3(col, [240, 228, 205], .22)); ctx.lineWidth = Math.max(.45, w * .13); ctx.stroke(p);
  }
  const ptAt = (pts, st, s) => {
    const f = st > 0 ? clamp(s / st, 0, pts.length - 1.001) : 0, i = Math.floor(f), q = f - i, a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [[a[0] + dx * q, a[1] + dy * q], [dx / l, dy / l]];
  };

  // ---------- the khipu ----------
  const FULLK = { prog: 1, loose: 0 };
  // S: per-frame state callbacks. Everything optional; default = a fully tied, hanging, fresh khipu.
  function drawKhipu(ctx, K, cam, S = {}) {
    const z = cam.z, cx = cam.cx ?? 960, cy = cam.cy ?? 540;
    const toS = p => [(p[0] - cam.fx) * z + cx, (p[1] - cam.fy) * z + cy];
    const half = S.half || (() => null);
    const xfW = (p, h) => {
      const q = half(h); if (!q) return p;
      const dx = p[0] - q.ax, dy = p[1] - q.ay, c = Math.cos(q.ang), s = Math.sin(q.ang);
      return [q.ax + dx * c - dy * s + (q.dx || 0), q.ay + dx * s + dy * c + q.dy];
    };
    const hOf = x => x < XS ? 0 : 1;
    const colf = S.col || (c => c);
    const wm = S.wm ?? 1, wP = PW * z * wm, wR = PRW * z * wm, sh = S.shade ?? 1;
    const hairK = S.hair ?? 0;
    const tops = [];
    // pendants (under the primary cord)
    K.p.forEach((pd, i) => {
      const ps = S.pend ? S.pend(i) : {}; if (!ps) return;
      const h = hOf(pd.x), A = xfW([pd.x, pcY(pd.x)], h);
      const Lv = pd.L * (ps.u ?? 1); if (Lv < 3) return;
      const nseg = Math.max(2, Math.ceil(Lv / 6)), st = Lv / nseg;
      const wp = [A]; let x = A[0], y = A[1];
      for (let k = 0; k < nseg; k++) { const ph = ps.phi ? ps.phi((k + .5) * st / pd.L) : 0; x += Math.sin(ph) * st; y += Math.cos(ph) * st; wp.push([x, y]); }
      const sp = wp.map(toS), sst = st * z;
      const a = colf(pd.a, i), b = pd.b ? colf(pd.b, i) : null;
      // tassel at the free end
      const [E, ET] = ptAt(sp, sst, Lv * z);
      tassel(ctx, E, ET, wP, a, pd.seed, ps.tassel ?? 1);
      // knots
      const kd = [];
      pd.knots.forEach((kn, k) => {
        const ks = S.knot ? S.knot(i, k) : FULLK; if (!ks || kn.s > Lv - 8) return;
        const [C, T] = ptAt(sp, sst, kn.s * z), spc = knotSpec(kn, wP, ks, pd.dir);
        kd.push({ C, T, spc, H: helix(C, T, spc), tight: clamp(1 - ks.loose) });
      });
      kd.forEach(q => tube(ctx, q.H.all, wP * .94, { a, b, dir: pd.dir, shade: sh, cast: true }));
      tube(ctx, sp, wP, { a, b, dir: pd.dir, shade: sh, hair: hairK * pd.L / 100 * (ps.hair ?? 1), seed: pd.seed, hairLen: S.hairLen });
      kd.forEach(q => {
        if (q.tight > .03) {
          const L = q.spc.Lt / 2 + wP * .12, C = q.C, T = q.T;
          tube(ctx, [[C[0] - T[0] * L, C[1] - T[1] * L], [C[0] + T[0] * L, C[1] + T[1] * L]], lerp(wP, 1.22 * wP, q.tight), { a: mul(a, .78), b: b && mul(b, .78), dir: -pd.dir, shade: sh, cast: false });
        }
        q.H.front.forEach(run => tube(ctx, run.pts, wP * .94, { a, b, dir: pd.dir, shade: sh, cast: true, s0: run.s0, noLine: true }));
      });
      tops.push({ i, A, a, b, dir: pd.dir, h });
    });
    // primary cord
    if (!S.noPrim) {
      const pa = colf(K.prim[0], -1), pb = colf(K.prim[1], -1);
      const gap = S.gap || 0, parts = [];
      if (gap > 0 || S.half) {
        const L = [], Rr = [];
        for (let x = PX0; x <= XS - gap / 2; x += 15) L.push([x, pcY(x)]);
        L.push([XS - gap / 2, pcY(XS - gap / 2)]);
        Rr.push([XS + gap / 2, pcY(XS + gap / 2)]);
        for (let x = Math.ceil((XS + gap / 2) / 15) * 15; x <= PX1; x += 15) Rr.push([x, pcY(x)]);
        parts.push(L.map(p => toS(xfW(p, 0))), Rr.map(p => toS(xfW(p, 1))));
      } else {
        const L = []; for (let x = PX0; x <= PX1 + .1; x += 15) L.push([x, pcY(x)]); parts.push(L.map(toS));
      }
      // right end: frayed tassel; left end: a heavy end knot
      const pr = parts[parts.length - 1], pl = parts[0];
      const rT = (() => { const a = pr[pr.length - 2], b = pr[pr.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; })();
      tassel(ctx, pr[pr.length - 1], rT, wR, pa, K.seed * 7 + 1, 1.3);
      if (S.bridge) S.bridge(ctx, pl[pl.length - 1], pr[0], wR, pa);
      parts.forEach((pp, k) => tube(ctx, pp, wR, { a: pa, b: pb, dir: 1, shade: sh, hair: hairK * 8 * (k ? .5 : .5), seed: K.seed * 13 + k, hairLen: S.hairLen }));
      const lT = (() => { const a = pl[0], b = pl[1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; })();
      const kc = [pl[0][0] + lT[0] * wR * 1.6, pl[0][1] + lT[1] * wR * 1.6];
      const eh = helix(kc, lT, { n: 2, rho: .5 * wR, pitch: .85 * wR, hand: 1 });
      tube(ctx, [[kc[0] - lT[0] * wR * .95, kc[1] - lT[1] * wR * .95], [kc[0] + lT[0] * wR * .95, kc[1] + lT[1] * wR * .95]], 1.45 * wR, { a: pa, b: pb, twist: 0, shade: sh });
      tube(ctx, eh.all, wR * .9, { a: pa, b: pb, dir: 1, shade: sh });
      // attachment hitches: each pendant's loop wraps over the primary cord
      tops.forEach(tp => {
        const pp = parts.length > 1 ? parts[tp.h] : parts[0];
        const C = toS(tp.A);
        let best = 0, bd = 1e18;
        for (let k = 0; k < pp.length; k++) { const d = (pp[k][0] - C[0]) ** 2 + (pp[k][1] - C[1]) ** 2; if (d < bd) { bd = d; best = k; } }
        const a0 = pp[Math.max(0, best - 1)], b0 = pp[Math.min(pp.length - 1, best + 1)], l = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1;
        const T = [(b0[0] - a0[0]) / l, (b0[1] - a0[1]) / l];
        const hh = helix(C, T, { n: 1, rho: .5 * wR, pitch: 1.3 * wP, hand: tp.dir, tilt: 0 });
        hh.front.forEach(run => tube(ctx, run.pts, wP * .95, { a: tp.a, b: tp.b, dir: tp.dir, shade: sh, s0: run.s0 }));
      });
    }
  }

  // ---------- camera ----------
  function camAt(t) {
    let z = 2.8 + .75 * ease.inOut(smooth(3.4, 6.3, t)), fx = lerp(860, 960, ease.inOut(clamp((t - 3.3) / 1.0))), fy = 326.6;
    const k1 = ease.inOut(clamp((t - 6.3) / 1.3));
    z = Math.exp(lerp(Math.log(z), 0, k1)); fx = lerp(fx, 960, k1); fy = lerp(fy, 540, k1);
    const k23 = ease.inOut(clamp((t - 11.0) / 2.2)) * (1 - ease.inOut(clamp((t - 15.35) / 1.25)));
    z = Math.exp(lerp(Math.log(z), Math.log(.1), k23));
    return { z, fx, fy };
  }
  const hasPrev = () => { try { return !!(TL && TL.items.findIndex(it => it.s.id === 'knot') > 0); } catch (e) { return false; } };

  // ---------- per-frame state of the main khipu ----------
  const TS = 18.7;                           // the primary cord snaps
  // the other pendants stay dimmed until the merged "1306" has left (it is set over two of them)
  const dimAt = t => win(t, 8.55, 11.2, .35, .4);
  // how much busy detail runs through the subtitle zone (cords in close-up, the archive grid, the falling halves)
  const busyAt = t => Math.max(win(t, 2.5, 7.7, .4, .6), win(t, 11.0, 16.5, .7, .7), .7 * win(t, 18.7, 20.0, .25, .45));
  // after the khipu has fallen away the camera keeps settling slowly onto the empty, moth-eaten cloth
  const pushAt = t => 1 + .05 * ease.inOut(clamp((t - 19.3) / 3.0));
  const swingTh = tau => tau <= 0 ? 0 : 1.42 * (1 - Math.cos(3.4 * tau) * Math.exp(-1.7 * tau));
  function halfState(h, t) {
    const tau = t - TS - (h ? .06 : 0);
    if (tau <= 0) return null;
    const th = swingTh(tau), tf = h ? .86 : .74, fall = tau > tf ? .5 * 4200 * (tau - tf) ** 2 : 0;
    return { ang: h ? -th : th, ax: h ? PX1 : PX0, ay: h ? pcY(PX1) : pcY(PX0), dy: fall, dx: 0 };
  }
  function mainState(t) {
    const dc = smooth(16.6, 18.6, t), dimK = dimAt(t);
    const S = { noPrim: hasPrev() && t < TR.d, hair: .9 + dc * 9, hairLen: 1 + dc * 1.4, wm: wmAt(camAt(t).z) };
    S.col = (c, i) => {
      let r = c;
      if (dimK > 0 && i !== MID) { const g = lum(r); r = mix3(r, [g * .5, g * .45, g * .38], (i < 0 ? .3 : .62) * dimK); }
      if (dc > 0) r = mix3(r, faded(r), .78 * dc);
      return r;
    };
    S.shade = 1 - .25 * dc;
    const snapped = t >= TS;
    if (snapped) S.half = h => halfState(h, t);
    if (t > 18.05 && !snapped) {
      S.gap = 7 * smooth(18.05, 18.7, t);
      S.bridge = (ctx, a, b, w, col) => {   // fibres stretching across the frayed neck, breaking one by one
        const p = new Path2D(), rnd = mulberry(55);
        for (let k = 0; k < 11; k++) {
          const brk = 18.25 + k * .04 + rnd() * .05, oy = (rnd() - .5) * w * .8, sag = (rnd() - .3) * w * .5;
          if (t > brk) continue;
          p.moveTo(a[0] - w * .3, a[1] + oy); p.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + oy + sag, b[0] + w * .3, b[1] + oy * .8);
        }
        ctx.lineCap = 'round'; ctx.strokeStyle = css(mix3(col, [230, 210, 190], .45)); ctx.lineWidth = Math.max(.6, w * .09); ctx.stroke(p);
      };
    }
    S.pend = i => {
      const pd = MAIN.p[i];
      if (snapped) {
        const h = pd.x < XS ? 0 : 1, tau = t - TS - (h ? .06 : 0), th = swingTh(tau), dth = (swingTh(tau + .02) - swingTh(tau - .02)) / .04;
        const sgn = h ? -1 : 1, top = -sgn * th * .3, lag = sgn * dth * .13;
        return { phi: sn => top * (1 - sn) * (1 - sn) + lag * sn };
      }
      if (i === MID) {
        if (t < 2.6) return null;
        const tau = t - 2.6, u = ease.out(clamp(tau / .8));
        return { u, phi: sn => (.07 * Math.sin(tau * 5.1) * Math.exp(-tau * 1.4) + .012 * Math.sin(t * 1.7)) * sn };
      }
      const t0 = 6.42 + Math.abs(i - MID) * .1 + hash2(i, 3) * .06;
      if (t < t0) return null;
      const tau = t - t0, side = i < MID ? -1 : 1;
      const sw = q => q <= 0 ? side * 1.25 : side * 1.25 * Math.exp(-2.5 * q) * Math.cos(4.6 * q);
      return { u: .3 + .7 * ease.out(clamp(tau / .3)), phi: sn => sw(tau - .14 * sn) + .01 * Math.sin(t * 1.3 + i) * sn };
    };
    S.knot = (i, k) => {
      if (i !== MID) return FULLK;
      const kn = MAIN.p[MID].knots[k];
      if (kn.tier === 0) {               // the knot that ties itself (card 0)
        if (t < 3.6) return null;
        return { prog: ease.inOut(clamp((t - 3.6) / .9)), loose: 1 - ease.outBack(clamp((t - 4.5) / .55)) };
      }
      if (kn.tier === 1) {
        const c0 = 7.5 + kn.j * .2; if (t < c0) return null;
        return { prog: ease.out(clamp((t - c0) / .12)), loose: 1 - ease.outBack(clamp((t - c0 - .05) / .24)) };
      }
      if (kn.tier === 3) {
        if (t < 7.95) return null;
        return { prog: clamp((t - 7.95) / .36), loose: .75 * (1 - ease.outBack(clamp((t - 8.27) / .22))) };
      }
      return FULLK;
    };
    return S;
  }

  // ---------- textures, sprites ----------
  let TEX = [], TEX1 = [], MIP = [], SPR = [], SPRG = [], SPRM = null;
  const SW = 720, SH = 304, SZ = .4, WMF = 1.6;
  const wmAt = z => 1 + (WMF - 1) * smooth(.95, SZ, z);
  function sprite(K, grey) {
    const c = makeCanvas(SW, SH), g = c.getContext('2d');
    drawKhipu(g, K, { z: SZ, fx: 960, fy: 495, cx: SW / 2, cy: SH / 2 }, { hair: 0, wm: WMF });
    if (!grey) return c;
    const d = makeCanvas(SW, SH), dg = d.getContext('2d');
    dg.filter = 'grayscale(.85) brightness(.75)'; dg.drawImage(c, 0, 0); return d;
  }

  function mipFor(px) { return px > 600 ? TEX[0] : px > 300 ? MIP[0] : px > 150 ? MIP[1] : MIP[2]; }
  function drawBg(ctx, t, cam) {
    if (cam.z < .999) {
      ctx.fillStyle = '#20150d'; ctx.fillRect(0, 0, W, H);
      const x = -cam.fx * cam.z + 960, y = -cam.fy * cam.z + 540;
      ctx.fillStyle = 'rgba(8,4,1,.45)'; ctx.fillRect(x + 14 * cam.z, y + 22 * cam.z, W * cam.z, H * cam.z);
      ctx.drawImage(mipFor(W * cam.z), x, y, W * cam.z, H * cam.z);
      return;
    }
    const sb = Math.max(1, 1 + (cam.z - 1) * .1), vw = W / sb, vh = H / sb;
    const cx = clamp(960 + (cam.fx - 960) * .12, vw / 2, W - vw / 2);
    const d = smooth(16.6, 19.8, t) * 3, k = Math.min(2, Math.floor(d)), f = d - k;
    const src = [(cx - vw / 2) * KX, 0, vw * KX, vh * KX];
    const flat = sb < 1.0005;   // at zoom 1 use the pre-scaled 1:1 copies (much cheaper)
    const img = q => flat ? ctx.drawImage(TEX1[q], 0, 0) : ctx.drawImage(TEX[q], ...src, 0, 0, W, H);
    if (f > .998) img(k + 1);
    else { img(k); if (f > .002) { ctx.globalAlpha = f; img(k + 1); ctx.globalAlpha = 1; } }
    const rk = ctx.createRadialGradient(360, -160, 80, 360, -160, 1900);
    rk.addColorStop(0, 'rgba(255,232,190,.13)'); rk.addColorStop(1, 'rgba(255,232,190,0)');
    ctx.fillStyle = rk; ctx.fillRect(0, 0, W, H);
    const dk = .2 * dimAt(t);
    if (dk > 0) { ctx.fillStyle = `rgba(24,14,7,${dk.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  }

  // The archive: the cloth recedes into one tray of a storage grid; every tray holds another khipu.
  const GAP = 230, CWX = W + GAP, CHY = H + GAP;
  function drawArchive(ctx, t, cam) {
    if (cam.z >= .999) return;
    const z = cam.z, toS = p => [(p[0] - cam.fx) * z + 960, (p[1] - cam.fy) * z + 540];
    const i0 = Math.floor((cam.fx - 960 / z) / CWX) - 1, i1 = Math.ceil((cam.fx + 960 / z) / CWX);
    const j0 = Math.floor((cam.fy - 540 / z) / CHY) - 1, j1 = Math.ceil((cam.fy + 540 / z) / CHY);
    const tw = W * z, th = H * z, mip = mipFor(tw), sw = SW * z / SZ, shh = SH * z / SZ;
    ctx.save();
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!i && !j) continue;
      const o = toS([i * CWX, j * CHY]);
      if (o[0] > W || o[1] > H || o[0] + tw < 0 || o[1] + th < 0) continue;
      const h = hash2(i + 101, j + 207), v = Math.floor(h * SPR.length) % SPR.length;
      const d = Math.hypot(i, j * 1.3), ta = 11.15 + d * .17 + h * .3;
      const ap = smooth(ta, ta + .4, t); if (ap <= 0) continue;
      const lit = (i === 2 && j === -1) || (i === -3 && j === 1) || (i === 1 && j === 3) || (i === -1 && j === -3) || hash2(i * 3 + 11, j * 7 + 5) < .04;
      const td = 13.75 + d * .07 + hash2(i + 9, j + 4) * .4, dm = lit ? 0 : smooth(td, td + .6, t);
      ctx.globalAlpha = ap;
      ctx.fillStyle = 'rgba(8,4,1,.45)'; ctx.fillRect(o[0] + 14 * z, o[1] + 22 * z, tw, th);
      ctx.drawImage(mip, o[0], o[1], tw, th);
      if (dm > 0) { ctx.globalAlpha = ap * dm * .62; ctx.fillStyle = '#1a100a'; ctx.fillRect(o[0], o[1], tw, th); }
      const k = toS([i * CWX + 960, j * CHY + 495]);
      if (dm < 1) { ctx.globalAlpha = ap * (1 - dm); ctx.drawImage(SPR[v], k[0] - sw / 2, k[1] - shh / 2, sw, shh); }
      if (dm > 0) { ctx.globalAlpha = ap * dm * .5; ctx.drawImage(SPRG[v], k[0] - sw / 2, k[1] - shh / 2, sw, shh); }
    }
    ctx.restore();
  }

  // ---------- decoding one pendant: 1 · 3 · 0 · 6 ----------
  const DIG = ['1', '3', '0', '6'];
  function decodeGlow(ctx, t, cam) {
    const toS = p => [(p[0] - cam.fx) * cam.z + 960, (p[1] - cam.fy) * cam.z + 540];
    for (let k = 0; k < 4; k++) {
      const tk = 8.75 + k * .4, a = smooth(tk, tk + .25, t) * (1 - smooth(10.7, 11.1, t));
      if (a <= 0) continue;
      const c = toS([960, TIER[k]]), r = (k === 3 ? 70 : k === 1 ? 60 : 42) * cam.z;
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
      g.addColorStop(0, `rgba(255,214,140,${(.42 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g; ctx.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r);
    }
  }
  function decodeDigits(ctx, t, cam) {
    const out = 1 - smooth(10.8, 11.15, t);
    if (t < 8.75 || out <= 0) return;
    const toS = p => [(p[0] - cam.fx) * cam.z + 960, (p[1] - cam.fy) * cam.z + 540];
    const as = ease.inOut(clamp((t - 10.2) / .5));
    ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(16,8,3,.85)'; ctx.shadowBlur = 10;
    for (let k = 0; k < 4; k++) {
      const tk = 8.75 + k * .4, a = smooth(tk, tk + .22, t) * out;
      if (a <= 0) continue;
      const c = toS([960, TIER[k]]);
      const x0 = c[0] + 52, y0 = c[1], x1 = 1068 + k * 40, y1 = 470;
      const x = lerp(x0, x1, as), y = lerp(y0, y1, as) - (1 - ease.out(clamp((t - tk) / .3))) * 10;
      const sz = lerp(40, 66, as);
      if (k === 2 && as < 1) {        // zero = empty space on the cord
        ctx.save(); ctx.globalAlpha = a * (1 - as) * .8; ctx.setLineDash([4, 5]); ctx.strokeStyle = '#f0e2c2'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(c[0], c[1], 20, 30, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      font(ctx, sz, '"Noto Serif SC"', 700);
      ctx.fillStyle = css(as > .5 ? mix3([244, 232, 206], [232, 178, 76], (as - .5) * 2) : [244, 232, 206], a * (k === 2 ? lerp(.75, 1, as) : 1));
      ctx.fillText(DIG[k], x, y);
    }
    ctx.restore();
  }

  // loose fibres drifting down after the snap
  function fibres(ctx, t) {
    if (t < TS) return;
    const rnd = mulberry(901), p = new Path2D(), tau = t - TS;
    for (let k = 0; k < 16; k++) {
      const vx = (rnd() - .5) * 160, vy = -60 - rnd() * 120, L = 8 + rnd() * 16, ph = rnd() * 6.28, g = 70 + rnd() * 50;
      const x = XS + vx * (1 - Math.exp(-tau * 1.6)) / 1.6 + Math.sin(tau * 1.9 + ph) * 14, y = pcY(XS) + vy * (1 - Math.exp(-tau * 1.6)) / 1.6 + .5 * g * tau * tau;
      const an = ph + tau * (rnd() - .5) * 3;
      p.moveTo(x - Math.cos(an) * L / 2, y - Math.sin(an) * L / 2);
      p.quadraticCurveTo(x + Math.sin(an) * 3, y - Math.cos(an) * 3, x + Math.cos(an) * L / 2, y + Math.sin(an) * L / 2);
    }
    ctx.save(); ctx.globalAlpha = 1 - smooth(20.6, 21.6, t); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(214,190,160,.75)'; ctx.lineWidth = 1.3; ctx.stroke(p); ctx.restore();
  }

  // ---------- incoming transition: the hook's thread becomes the primary cord, the cloth is lowered ----------
  function primScreen(cam) {
    const out = []; for (let x = PX0; x <= PX1 + .1; x += 15) out.push([(x - cam.fx) * cam.z + 960, (pcY(x) - cam.fy) * cam.z + 540]); return out;
  }
  function detectThread(A) {
    let d;
    try { d = A.getContext('2d').getImageData(0, 0, W, H).data; } catch (e) { return null; }
    const xs = [], ys = []; let wsum = 0, paper = null;
    for (let k = 0; k <= 32; k++) {
      const x = Math.min(W - 1, Math.round(k * W / 32));
      let sy = 0, n = 0;
      for (let y = 0; y < H; y++) {
        const o = (y * W + x) * 4, r = d[o], g = d[o + 1], b = d[o + 2];
        if (r > 120 && r - g > 60 && r - b > 60) { sy += y; n++; }
      }
      if (n > 0 && n < 30) {
        const yc = sy / n; xs.push(x); ys.push(yc); wsum += n;
        if (!paper) { const o = (Math.max(0, Math.round(yc - 14)) * W + x) * 4; paper = `rgb(${d[o]},${d[o + 1]},${d[o + 2]})`; }
      }
    }
    if (xs.length < 5) return null;
    return { xs, ys, w: wsum / xs.length, paper };
  }
  const interpY = (th, x) => {
    const xs = th.xs, ys = th.ys;
    if (x <= xs[0]) return ys[0]; if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    let i = 0; while (xs[i + 1] < x) i++;
    return lerp(ys[i], ys[i + 1], (x - xs[i]) / (xs[i + 1] - xs[i]));
  };
  TRANS.knot_rope = (ctx, A, B, p) => {
    ctx.drawImage(A, 0, 0);
    const th = detectThread(A);
    const lt = p * TR.d, cam = camAt(lt), SB = primScreen(cam);
    const e = ease.inOut(p), e2 = ease.inOut(clamp((p - .04) / .9));
    if (th) {   // lift the hook's own thread off the paper: ours takes its place
      ctx.save(); ctx.strokeStyle = th.paper; ctx.lineWidth = th.w + 8; ctx.lineCap = 'round'; ctx.beginPath();
      th.xs.forEach((x, k) => k ? ctx.lineTo(x, th.ys[k]) : ctx.moveTo(x, th.ys[k])); ctx.stroke(); ctx.restore();
    }
    const base = lerp(-90, H + 95, e);
    const edgeY = x => base + 9 * Math.sin(x * .0105 + 1.3) + 5 * Math.sin(x * .037 + .4) + 2.5 * Math.sin(x * .13);
    // shadow of the descending cloth on the paper
    const sg = ctx.createLinearGradient(0, base - 10, 0, base + 90);
    sg.addColorStop(0, 'rgba(40,24,12,.32)'); sg.addColorStop(1, 'rgba(40,24,12,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, base - 10, W, 100);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(W + 10, -10);
    for (let x = W + 10; x >= -10; x -= 12) ctx.lineTo(x, edgeY(x));
    ctx.closePath(); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
    // selvedge + hanging warp fringe
    if (base > -60 && base < H + 60) {
      const groups = [new Path2D(), new Path2D(), new Path2D()], cols = [PAL.cr, PAL.md, PAL.dk];
      for (let x = 2; x < W; x += 5) {
        const h = hash2(x, 17), L = 14 + 30 * hash2(x, 5), y0 = edgeY(x) - 2, cv = (hash2(x, 9) - .5) * 9;
        const gp = groups[Math.floor(h * 3)];
        gp.moveTo(x, y0); gp.quadraticCurveTo(x + cv, y0 + L * .55, x + cv * 1.6, y0 + L);
      }
      ctx.lineCap = 'round';
      groups.forEach((gp, k) => { ctx.strokeStyle = 'rgba(30,18,9,.5)'; ctx.lineWidth = 3.4; ctx.stroke(gp); });
      groups.forEach((gp, k) => { ctx.strokeStyle = css(cols[k]); ctx.lineWidth = 2.1; ctx.stroke(gp); });
      ctx.beginPath(); for (let x = -10; x <= W + 10; x += 12) ctx.lineTo(x, edgeY(x) - 3);
      ctx.strokeStyle = css(PAL.brn); ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = 'rgba(232,214,180,.35)'; ctx.lineWidth = 1.5; ctx.translate(0, -4); ctx.stroke(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // the thread drops, thickens and twists into the primary cord
    const xa0 = th ? th.xs[0] : -60, xa1 = th ? th.xs[th.xs.length - 1] : lerp(-60, W + 60, smooth(0, .25, p));
    const lo = lerp(xa0 - 2, -6000, e2), hi = lerp(xa1 + 2, 8000, e2);
    const pts = [];
    SB.forEach(([xb, yb]) => {
      if (xb < lo || xb > hi) return;
      const ya = th ? interpY(th, xb) : 540;
      pts.push([xb, lerp(ya, yb, e2) + Math.sin(Math.PI * e2) * 120 * Math.max(0, 1 - ((xb - 960) / 1300) ** 2)]);
    });
    if (pts.length > 1) {
      const w = lerp(th ? Math.max(2.5, th.w) : 3, PRW * cam.z, Math.pow(e2, 1.3));
      tube(ctx, pts, w, { a: mix3(PAL.cin, PRA, e2), b: mix3(PAL.cin, PRB, e2), dir: 1, shade: smooth(.0, .7, e2), twist: smooth(.15, .85, e2),
        hair: e2 > .5 ? (.9 * 8 * .5) * smooth(.5, 1, e2) : 0, seed: MAIN.seed * 13, hairLen: 1 });
    }
  };

  // ---------- scene ----------
  scene({
    id: 'knot', n: ch.n, dur: ch.dur, trans: TR,
    cues: [
      { t: .15, sfx: 'rope', v: .7 }, { t: 2.6, sfx: 'cord', v: .6 }, { t: 5.0, sfx: 'knot', v: .9 },
      { t: 6.5, sfx: 'cord', v: .8 }, { t: 7.72, sfx: 'knot', v: .55 }, { t: 7.92, sfx: 'knot', v: .55 }, { t: 8.12, sfx: 'knot', v: .55 },
      { t: 8.45, sfx: 'knot', v: .8 }, { t: 8.75, sfx: 'tick', v: .5 }, { t: 9.15, sfx: 'tick', v: .5 }, { t: 9.55, sfx: 'tick', v: .5 },
      { t: 9.95, sfx: 'tick', v: .5 }, { t: 10.3, sfx: 'chime', v: .6 }, { t: 11.25, sfx: 'cord', v: .45 },
      { t: 15.9, sfx: 'whoosh', v: .6 }, { t: TS, sfx: 'rope', v: 1 },
    ],
    init() {
      TEX = [0, .4, .75, 1].map(D => GL.bake(TEXTILE, TW, TH, { K: KX, DEC: D }));
      TEX1 = TEX.map(tx => { const c = makeCanvas(W, H); c.getContext('2d').drawImage(tx, 0, 0, W, H); return c; });
      MIP = []; let src = TEX[0];
      for (const w of [960, 480, 240]) { const c = makeCanvas(w, w * 9 / 16); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); MIP.push(c); src = c; }
      const r = mulberry(31), cl = [[PAL.cot], [PAL.brn], [PAL.saf], [PAL.ind], [PAL.red], [PAL.cr], [PAL.dk],
        [PAL.cot, PAL.brn], [PAL.ind, PAL.cot], [PAL.red, PAL.cot], [PAL.saf, PAL.red]];
      for (let v = 0; v < 10; v++) {
        const n = 8 + Math.floor(r() * 8), vals = [], cols = [];
        for (let i = 0; i < n; i++) {
          vals.push(r() < .1 ? 0 : (r() < .3 ? 1000 * Math.floor(r() * 3) : 0) + 100 * Math.floor(r() * 5) + 10 * Math.floor(r() * 5) + Math.floor(r() * 9));
          cols.push(cl[Math.floor(r() * cl.length)]);
        }
        const prim = [[PRA, PRB], [PAL.cot, PAL.brn], [PAL.brn, PAL.dk], [PAL.cr, PAL.md]][Math.floor(r() * 4)];
        const K = makeKhipu(40 + v, n, vals, cols, prim);
        SPR.push(sprite(K, false)); SPRG.push(sprite(K, true));
      }
      SPRM = sprite(MAIN, false);
    },
    draw(ctx, t) {
      const cam = camAt(t), push = pushAt(t), busy = busyAt(t);
      ctx.save();
      if (push > 1.0001) { ctx.translate(960, 520); ctx.scale(push, push); ctx.translate(-960, -520); }
      drawBg(ctx, t, cam);
      drawArchive(ctx, t, cam);
      decodeGlow(ctx, t, cam);
      if (cam.z >= SZ) drawKhipu(ctx, MAIN, cam, mainState(t));
      else {
        const c = [(960 - cam.fx) * cam.z + 960, (495 - cam.fy) * cam.z + 540], sw = SW * cam.z / SZ, sh = SH * cam.z / SZ;
        ctx.drawImage(SPRM, c[0] - sw / 2, c[1] - sh / 2, sw, sh);
      }
      fibres(ctx, t);
      ctx.restore();
      const cz = smooth(1.3, 2.4, cam.z);   // close-up: the light pools around the knot, the cord's tail sinks into shade
      if (cz > 0) {
        const g = ctx.createLinearGradient(0, 620, 0, H);
        g.addColorStop(0, 'rgba(22,12,6,0)'); g.addColorStop(1, `rgba(22,12,6,${(.62 * cz).toFixed(3)})`);
        ctx.fillStyle = g; ctx.fillRect(0, 620, W, H - 620);
      }
      if (busy > 0) {   // keep the subtitle zone calm while cords or the archive grid run through it
        const g = ctx.createLinearGradient(0, 740, 0, H);
        g.addColorStop(0, 'rgba(22,12,6,0)'); g.addColorStop(.5, `rgba(22,12,6,${(.3 * busy).toFixed(3)})`);
        g.addColorStop(1, `rgba(22,12,6,${(.5 * busy).toFixed(3)})`);
        ctx.fillStyle = g; ctx.fillRect(0, 740, W, H - 740);
      }
      decodeDigits(ctx, t, cam);
      vignette(ctx, .38, '22,12,6', .42);
      opener(ctx, t, ch, {
        ink: '#F3E7CB', sub: '#E6D5B3', accent: '#E8B24C', x: 176, y: 572, align: 'left',
        title: { family: '"Ma Shan Zheng"', size: 214, weight: 400, sp: 22 },
        small: { family: '"Noto Serif SC"', size: 31, weight: 600 },
        num: { family: '"Noto Serif SC"', size: 62, weight: 700 },
        shadow: 'rgba(18,9,3,.6)',
        backdrop: (g, b, al) => {
          g.save(); g.translate(560, 600); g.scale(640, 300);
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
          gr.addColorStop(0, `rgba(30,18,9,${(.52 * al).toFixed(3)})`); gr.addColorStop(.6, `rgba(30,18,9,${(.36 * al).toFixed(3)})`); gr.addColorStop(1, 'rgba(30,18,9,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore();
        },
      });
      subs(ctx, t, ch, {
        ink: '#F4E9D0', body: { family: '"Noto Serif SC"', size: 52, weight: 600 }, y: 1000, shadow: 'rgba(12,6,2,.7)',
        bandFn: (g, x, y, w, h, a) => {
          g.save(); g.translate(x + w / 2, y + h / 2); g.scale(w / 2 + 170, h / 2 + 46);
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
          const k0 = lerp(.74, .86, busy), k1 = lerp(.6, .76, busy);
          gr.addColorStop(0, `rgba(26,15,7,${(k0 * a).toFixed(3)})`); gr.addColorStop(.62, `rgba(26,15,7,${(k1 * a).toFixed(3)})`); gr.addColorStop(1, 'rgba(26,15,7,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore();
        },
      });
      grain(ctx, t, .045);
    },
  });
})();
