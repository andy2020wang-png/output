// 12 云 — clean flat isometric data centre. Pale grey-white floor, slate racks, one electric-blue accent for data,
// green/amber status LEDs. One continuous isometric world filmed by a camera: the hall (rows of racks, cable trays,
// packets), a cut-away of the front row (drawers of HDDs and SSDs, tape-library robot, cooling, power, a technician),
// a migration island (music shelf → new racks, most albums lost on the way), a field of web pages (38 % break),
// then the lights go out rack by rack until one amber LED is left.
'use strict';
(() => {
  const ch = CH('cloud');
  const C30 = Math.cos(Math.PI / 6), TAU = Math.PI * 2, U = 60;
  const BG = '#EEF1F4', SLATE = '#2B3440', BLUE = '#2F6BFF', GREEN = '#36C47F', AMBER = '#F5A524';
  const FONT = '"Noto Sans SC"';

  // ---------- colour with global "dark age" factor ----------
  let DK = 0;                                   // set from t at the start of every draw (pure function of t)
  const RGB = new Map();
  function rgbOf(hex) {
    let v = RGB.get(hex);
    if (!v) { const n = parseInt(hex.slice(1), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; RGB.set(hex, v); }
    return v;
  }
  function cc(hex, a = 1, lit = 0) {             // lit = self-luminous (LEDs): ignores the dimming
    const [r, g, b] = rgbOf(hex);
    if (DK <= 0 || lit) return `rgba(${r},${g},${b},${a})`;
    const L = (.3 * r + .59 * g + .11 * b) / 255, tl = 36 + L * 42;
    return `rgba(${lerp(r, tl * .97, DK) | 0},${lerp(g, tl, DK) | 0},${lerp(b, tl * 1.05, DK) | 0},${a})`;
  }

  // ---------- camera: frontal → isometric blend, anchored zoom ----------
  let CAM = null;
  function setCam(c) {
    const f = c.f ?? 1;
    CAM = { Fx: c.F[0], Fy: c.F[1], Fz: c.F[2], Sx: c.S[0], Sy: c.S[1], k: c.Z * U,
      mxx: lerp(1, C30, f), mxy: lerp(0, .5, f), myx: lerp(0, -C30, f), myy: lerp(.3, .5, f) };
  }
  function P(x, y, z) {
    const c = CAM, dx = x - c.Fx, dy = y - c.Fy, dz = z - c.Fz;
    return [c.Sx + c.k * (c.mxx * dx + c.myx * dy), c.Sy + c.k * (c.mxy * dx + c.myy * dy - dz)];
  }
  // s-space (isometric screen units at zoom 1, f = 1) <-> world on the floor
  const sOf = (x, y, z = 0) => [(x - y) * C30, (x + y) / 2 - z];
  const worldAtS = (sx, sy) => { const a = sx / C30, b = sy * 2; return [(a + b) / 2, (b - a) / 2]; };

  // ---------- primitives ----------
  function poly(g, pts, fill, seam) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath(); g.fillStyle = fill; g.fill();
    if (seam) { g.strokeStyle = fill; g.lineWidth = .7; g.stroke(); }
  }
  // axis-aligned box: x..x+w, y..y+d, z..z+h ; faces: top, +y (front-left), +x (front-right)
  function box(g, x, y, z, w, d, h, ct, cl, cr, seam = true) {
    const a = P(x, y + d, z), b = P(x + w, y + d, z), c = P(x + w, y + d, z + h), e = P(x, y + d, z + h);
    const f = P(x + w, y, z), gg = P(x + w, y, z + h), hh = P(x, y, z + h);
    if (cr) poly(g, [b, f, gg, c], cr, seam);
    if (cl) poly(g, [a, b, c, e], cl, seam);
    if (ct) poly(g, [e, c, gg, hh], ct, seam);
  }
  const frect = (g, x, y, z, w, h, fill) => poly(g, [P(x, y, z), P(x + w, y, z), P(x + w, y, z + h), P(x, y, z + h)], fill);
  const xrect = (g, x, y, z, d, h, fill) => poly(g, [P(x, y + d, z), P(x, y, z), P(x, y, z + h), P(x, y + d, z + h)], fill);
  const trect = (g, x, y, z, w, d, fill) => poly(g, [P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)], fill);
  function fdash(g, x, y, z, w, h, col, lw = 1.2) {   // dashed outline on a +y plane
    const pts = [P(x, y, z), P(x + w, y, z), P(x + w, y, z + h), P(x, y, z + h)];
    g.save(); g.setLineDash([Math.max(2, CAM.k * .02), Math.max(2, CAM.k * .016)]);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath();
    g.strokeStyle = col; g.lineWidth = lw; g.stroke(); g.restore();
  }
  // circle on the +y plane (ellipse in isometric) as a polygon
  function fcircle(g, cx, y, cz, r, fill, n = 22) {
    const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(P(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r)); }
    poly(g, pts, fill);
  }
  // LED dot (screen-space circle) with optional glow
  function led(g, x, y, z, col, on, r = .012) {
    const [px, py] = P(x, y, z), rr = clamp(r * CAM.k, .9, 6);
    if (on > 0) {
      if (rr > 1.6) { g.fillStyle = cc(col, .22 * on, 1); g.beginPath(); g.arc(px, py, rr * 2.6, 0, TAU); g.fill(); }
      g.fillStyle = cc(col, Math.min(1, .35 + on), 1);
    } else g.fillStyle = cc('#1E252E');
    g.beginPath(); g.arc(px, py, rr, 0, TAU); g.fill();
  }
  // screen-space bounding check for culling
  function visible(x0, y0, x1, y1, z1, pad = 40) {
    const a = P(x0, y1, 0), b = P(x1, y0, 0), c = P(x0, y0, z1), d = P(x1, y1, 0);
    const minx = Math.min(a[0], c[0]), maxx = Math.max(b[0], d[0]), miny = Math.min(c[1], b[1] - CAM.k * z1), maxy = d[1];
    return maxx > -pad && minx < W + pad && maxy > -pad && miny < H + pad;
  }

  // ---------- world layout ----------
  const RW = .6, RD = 1.1, RH = 2.0, PITCH = .62, ROWP = 2.25, NROW = 4, NCOL = 9;
  const yFront = r => r * ROWP + RD;
  const TRAYZ = 2.38, TRAYX0 = -.9;
  const trayY = r => r * ROWP + .55;
  // rack types per row: s = servers, d = storage, c = in-row cooler, n = network, t = tape library (double)
  const ROWS = ['sdcsnsdsd', 'dsnsdcsds', 'sdsdcsnds', 'sdcssdttc'];
  const HERO = { r: 3, i: 5 };
  const racks = [];
  for (let r = 0; r < NROW; r++) {
    const row = ROWS[r];
    for (let i = 0; i < NCOL; i++) {
      const ty = row[i];
      if (ty === 't' && row[i - 1] === 't') continue;
      const w = ty === 't' ? PITCH + RW : RW;
      racks.push({ r, i, ty, x: i * PITCH, y: r * ROWP, w, hero: r === HERO.r && i === HERO.i, seed: r * 31 + i * 7 + 3 });
    }
  }
  const hero = racks.find(k => k.hero);
  // storage chassis: 2U-ish, 3 rows x 4 columns of 3.5" bays; the hero bay is where the camera starts
  const CH_H = .11, CH_Z0 = .14, BAY_W = .125, BAY_H = .03;
  const HERO_CH = 11, HERO_COL = 1, HERO_ROW = 1;
  const bayX = (rk, col) => rk.x + .04 + col * (BAY_W + .004);
  const bayZ = (chi, row) => CH_Z0 + chi * CH_H + .006 + row * (BAY_H + .003);
  const BAY = { x: bayX(hero, HERO_COL), z: bayZ(HERO_CH, HERO_ROW), y: yFront(HERO.r) };
  BAY.cx = BAY.x + BAY_W / 2; BAY.cz = BAY.z + BAY_H / 2;
  // drawers in the front row (beat 1)
  const HDD_Z = CH_Z0 + 7 * CH_H, HDD_H = 2 * CH_H;          // hero rack: a 4U top-loading drawer
  const ssdRack = racks.find(k => k.r === 3 && k.i === 4), SSD_Z = CH_Z0 + 12 * .089 / 1;
  const tapeRack = racks.find(k => k.ty === 't');
  const coolEnd = racks.find(k => k.r === 3 && k.i === 8);
  // rank of appearance: distance from the hero rack
  racks.forEach(k => { k.rank = Math.hypot(k.i - HERO.i, (k.r - HERO.r) * 1.6) + hash2(k.r, k.i) * .6; });
  const order = racks.filter(k => !k.hero).sort((a, b) => a.rank - b.rank);
  order.forEach((k, n) => { k.appear = 1.5 + n * .056; });
  hero.appear = -1;
  // lights out (beat 4): from the far corner towards us, hero last
  const outOrder = racks.filter(k => !k.hero).sort((a, b) => (a.r * 3 + a.i * .8 + hash2(a.i, a.r) * 2) - (b.r * 3 + b.i * .8 + hash2(b.i, b.r) * 2));
  outOrder.forEach((k, n) => { k.off = 21.55 + n * .066; });
  hero.off = 23.95;
  const LAST_LED = 24.35;

  const PLATE = { x0: -1.35, y0: -.95, x1: NCOL * PITCH + .75, y1: yFront(NROW - 1) + 1.55 };
  const HALLC = [1.9, 3.3, 0];
  const hallS = sOf(...HALLC);
  // islands placed in screen space so they never share the frame with the hall in a wide shot
  function islandOrigin(dsx, dsy, lc) { const w = worldAtS(hallS[0] + dsx, hallS[1] + dsy); return [w[0] - lc[0], w[1] - lc[1]]; }
  const MIG_LC = [3.75, -.45], MIG = islandOrigin(18.5, 1.2, MIG_LC);
  const PAG_N = 10, PAG_P = .72, PAG_LC = [PAG_N * PAG_P / 2, PAG_N * PAG_P / 2], PAG = islandOrigin(8.5, 14.5, PAG_LC);
  const MIGC = [MIG[0] + MIG_LC[0], MIG[1] + MIG_LC[1], .9], PAGC = [PAG[0] + PAG_LC[0], PAG[1] + PAG_LC[1], .3];
  const LEDP = [bayX(hero, 3) + BAY_W - .012, yFront(HERO.r), bayZ(15, 1) + BAY_H / 2];   // the last amber LED (a real bay LED)

  // ---------- camera timeline ----------
  const FR = {
    WL: { F: HALLC, S: [1250, 445], Z: 1.13 },
    WC: { F: HALLC, S: [960, 425], Z: 1.4 },
    B1: { F: [4.0, yFront(3) + .2, 1.05], S: [975, 362], Z: 2.7 },   // plate's front corner ends above the subtitle zone
    B2: { F: MIGC, S: [960, 450], Z: 1.95 },
    B3: { F: PAGC, S: [960, 455], Z: 1.55 },
    B4: { F: HALLC, S: [960, 440], Z: 1.28 },
    B5: { F: LEDP, S: [960, 440], Z: 3.9 },
  };
  const PATH = [[4.0, 6.7, 'WL', 'WC', 0, 0], [6.7, 7.75, 'WC', 'B1', 0, 1], [11.35, 12.4, 'B1', 'B2', .55, 1],
    [15.9, 16.95, 'B2', 'B3', .5, 1], [20.15, 21.2, 'B3', 'B4', .45, 1], [21.6, 27, 'B4', 'B5', 0, 2]];
  const Z0 = 1240 / (BAY_H * U), OPEN_T = 2.9, PIV = [960, 470];
  function camAt(t) {
    if (t < OPEN_T) {
      setCam({ F: HALLC, S: FR.WL.S, Z: FR.WL.Z, f: 1 });
      const sw = P(BAY.cx, BAY.y, BAY.cz);                    // where the bay sits in the wide framing
      // soft start: the pull-back picks up speed over ~0.15 s instead of jumping to full speed on the first frame
      const u = clamp(t / OPEN_T), KS = .05, us = (u - KS * (1 - Math.exp(-u / KS))) / (1 - KS * (1 - Math.exp(-1 / KS)));
      const ez = 1 - Math.pow(1 - us, 2.2), es = ease.inOut(u);
      return { F: [BAY.cx, BAY.y, BAY.cz], S: [lerp(PIV[0], sw[0], es), lerp(PIV[1], sw[1], es)],
        Z: Math.exp(lerp(Math.log(Z0), Math.log(FR.WL.Z), ez)), f: ease.inOut(clamp((t - .25) / 1.9)) };
    }
    let a = FR.WL, b = FR.WL, u = 0, dip = 0;
    for (const [t0, t1, fa, fb, dp, mode] of PATH) {
      if (t >= t1) { a = b = FR[fb]; u = 0; dip = 0; continue; }
      if (t > t0) { a = FR[fa]; b = FR[fb]; const q = (t - t0) / (t1 - t0); u = mode === 2 ? ease.inOut(q) : mode ? ease.inOut(q) : smooth(0, 1, q); dip = dp; }
      break;
    }
    const lz = lerp(Math.log(a.Z), Math.log(b.Z), u) - dip * Math.sin(Math.PI * u);
    return { F: [0, 1, 2].map(j => lerp(a.F[j], b.F[j], u)), S: [lerp(a.S[0], b.S[0], u), lerp(a.S[1], b.S[1], u)], Z: Math.exp(lz), f: 1 };
  }

  // ---------- packets (data) ----------
  const TX = -.75, RY = -.55, RISE_Z = 7.5, PK_V = 4.2, PK_DT = .42;
  const PK_T0 = 3.25, PK_T1 = 21.3;
  const targetsOf = r => racks.filter(k => k.r === r && k.ty !== 'c');
  const pkLen = (r, tgt) => (RISE_Z - TRAYZ - .06) + (trayY(r) - RY) + (tgt.x + tgt.w / 2 - TX);
  function pkTarget(r, k) { const ts = targetsOf(r); return ts[Math.floor(hash2(k * 7 + 1, r * 13 + 5) * ts.length)]; }
  const pkSpawn = (r, k, ln = 0) => k * PK_DT + r * .105 - 6 + ln * PK_DT / 2;
  const LANE1 = 3.9;
  function pkPos(r, s, tgt) {
    const zt = TRAYZ + .06, la = RISE_Z - zt, lb = trayY(r) - RY;
    if (s < la) return [TX, RY, RISE_Z - s];
    if (s < la + lb) return [TX, RY + (s - la), zt];
    return [TX + (s - la - lb), trayY(r), zt];
  }
  // arrival flashes per rack, precomputed (pure data)
  racks.forEach(k => { k.arr = []; });
  for (let r = 0; r < NROW; r++) for (let k = 0; k < 90; k++) for (let ln = 0; ln < 2; ln++) {
    const kk = k + ln * 500, tg = pkTarget(r, kk), sp = pkSpawn(r, k, ln), ta = sp + pkLen(r, tg) / PK_V;
    if (ln && sp < LANE1) continue;
    if (ta > PK_T0 && ta < PK_T1) tg.arr.push(ta);
  }
  function flashOf(rk, t) { let f = 0; for (const a of rk.arr) if (t >= a && t < a + .35) f = Math.max(f, 1 - (t - a) / .35); return f; }

  // ---------- racks ----------
  const COL = { top: '#4E5A6A', front: '#2B3440', side: '#3B4656', door: '#313B48', chas: '#3A4656', chas2: '#424F60', bay: '#4A576A', vent: '#29323D' };
  function rackOn(rk, t) { return 1 - smooth(rk.off, rk.off + .14, t) * (rk.hero ? 1 : 1); }
  // assembly: each rack rises out of the floor like a lift, fully detailed and opaque (never a blank slab):
  // it is drawn sunk by `sink` and clipped to the silhouette of its final volume, so nothing shows below the floor
  const RISE_D = .5;
  const rackU = (rk, t) => rk.appear < 0 ? 1 : clamp((t - rk.appear) / RISE_D);
  function drawRack(g, rk, t) {
    if (t < rk.appear) return;
    const u = rackU(rk, t), sink = (1 - ease.out(u)) * RH, h = RH;
    const x = rk.x, y = rk.y, w = rk.w, yF = y + RD, k = CAM.k;
    if (!visible(x, y, x + w, yF + (rk.hero ? 1 : 0), RH)) return;
    const fz = CAM.Fz, rising = sink > 1e-4;
    if (rising) {
      const s = [P(x, yF, 0), P(x + w, yF, 0), P(x + w, y, 0), P(x + w, y, RH), P(x, y, RH), P(x, yF, RH)];
      g.save(); g.beginPath(); s.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
      CAM.Fz = fz + sink;                                 // lower the whole rack by `sink`
    }
    const cool = rk.ty === 'c';
    box(g, x, y, 0, w, RD, h, cc(cool ? '#C3CBD4' : COL.top), cc(cool ? '#D5DBE2' : COL.front), cc(cool ? '#AEB8C3' : COL.side));
    const on = rackOn(rk, t);
    if (cool) drawCooler(g, rk, t, on);
    else if (rk.ty === 't') drawTape(g, rk, t, on);
    else {
      frect(g, x + .02, yF, .04, w - .04, RH - .07, cc(COL.door));
      if (rk.ty === 'd') drawStorage(g, rk, t, on);
      else drawServers(g, rk, t, on, rk.ty === 'n');
      // door light strip: pale when powered, blue for a moment when a packet lands
      const fl = flashOf(rk, t);
      const sc = fl > 0 ? BLUE : '#D7E3FF';
      if (on > 0) frect(g, x + .022, yF, .1, .024, RH - .2, cc(sc, .55 + .45 * Math.max(on * .6, fl), 1));
      else frect(g, x + .022, yF, .1, .024, RH - .2, cc('#252C35'));
    }
    g.globalAlpha = 1;
    if (rising) { CAM.Fz = fz; g.restore(); }
  }
  // when the hall is dark, a powered rack still throws a faint cool light onto the floor in front of it;
  // it goes out with the rack, so the lights-out reads rack by rack even in a wide shot
  function floorSpill(g, rk, t) {
    const a = smooth(.3, .8, DK) * rackOn(rk, t);
    if (a < .01 || rk.ty === 'c') return;
    const yF = rk.y + RD, d = .7, p0 = P(rk.x + rk.w / 2, yF, 0), p1 = P(rk.x + rk.w / 2, yF + d, 0);
    const gr = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
    gr.addColorStop(0, cc('#C9DAFF', .2 * a, 1)); gr.addColorStop(.45, cc('#C9DAFF', .07 * a, 1)); gr.addColorStop(1, cc('#C9DAFF', 0, 1));
    poly(g, [P(rk.x + .01, yF, .002), P(rk.x + rk.w - .01, yF, .002), P(rk.x + rk.w + .08, yF + d, .002), P(rk.x - .08, yF + d, .002)], gr);
  }
  function drawServers(g, rk, t, on, net) {
    const x = rk.x, yF = rk.y + RD, k = CAM.k, n = 20, ch_h = .089;
    for (let c = 0; c < n; c++) {
      const z = CH_Z0 + c * ch_h;
      if (rk === ssdRack && c === 12 && t > 7.6) { frect(g, x + .04, yF, z + .004, RW - .08, ch_h - .008, cc('#151B22')); continue; }
      const blank = !net && hash2(rk.seed, c) < .12;
      frect(g, x + .04, yF, z + .005, RW - .08, ch_h - .01, cc(blank ? '#2F3845' : COL.chas));
      if (blank) continue;
      if (k * ch_h > 9) {
        if (net) { for (let p = 0; p < 12; p++) frect(g, x + .15 + p * .031, yF, z + .028, .02, .016, cc('#8C99A8')); }
        else frect(g, x + .3, yF, z + .022, .22, .044, cc(COL.vent));
      }
      if (k > 34) {
        led(g, x + .075, yF, z + .044, GREEN, on);
        const bl = (hash2(rk.seed + c, Math.floor(t * (3 + hash2(c, rk.seed) * 5))) > .55) ? 1 : .0;
        led(g, x + .105, yF, z + .044, BLUE, on * bl * .8);
      }
    }
  }
  function drawStorage(g, rk, t, on) {
    const x = rk.x, yF = rk.y + RD, k = CAM.k;
    for (let c = 0; c < 16; c++) {
      const z = CH_Z0 + c * CH_H;
      if (rk.hero && (c === 7 || c === 8)) { if (c === 7) drawHddFace(g, rk, t, on); continue; }
      frect(g, x + .035, yF, z + .003, RW - .07, CH_H - .006, cc(COL.chas));
      if (k * BAY_H > 2.4) {
        for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
          const bx = bayX(rk, col), bz = bayZ(c, row);
          const isHero = rk.hero && c === HERO_CH && col === HERO_COL && row === HERO_ROW;
          frect(g, bx, yF, bz, BAY_W, BAY_H, cc(isHero ? '#3E4B5E' : COL.bay));
          if (k * BAY_H > 10) {
            frect(g, bx + .006, yF, bz + .006, .012, BAY_H - .012, cc('#5C6A7E'));            // latch
            if (isHero) frect(g, bx + .03, yF, bz + .0035, BAY_W - .06, BAY_H - .007, cc('#1B222B')); // the window the platter shrinks into
            else for (let v = 0; v < 6; v++) frect(g, bx + .03 + v * .012, yF, bz + .009, .006, BAY_H - .018, cc('#3B475A'));
          }
          if (k * .006 > 1) {
            const amber = rk.r === 3 && hash2(c * 5 + col, row + rk.seed) < .015;
            const lit = isHero ? on * smooth(.75, .95, t) : on;
            led(g, bx + BAY_W - .012, yF, bz + BAY_H / 2, amber ? AMBER : GREEN, lit, .0045);
          }
        }
      } else if (k > 34) led(g, x + .08, yF, z + .055, GREEN, on);
    }
    if (rk.hero) { // the last amber LED (top chassis)
      const a = smooth(LAST_LED, LAST_LED + .25, t) * (.75 + .25 * Math.cos((t - LAST_LED) * 2.6));
      if (t > LAST_LED) led(g, LEDP[0], LEDP[1], LEDP[2], AMBER, a, .009);
    }
  }

  // ---------- beat 1: the front row opened up ----------
  const hddSlide = t => .8 * ease.inOut(clamp((t - 7.45) / .65)) * (1 - ease.inOut(clamp((t - 10.95) / .5)));
  const ssdSlide = t => .62 * ease.inOut(clamp((t - 7.95) / .55)) * (1 - ease.inOut(clamp((t - 10.75) / .5)));
  function drawHddFace(g, rk, t) {
    const x = rk.x, yF = rk.y + RD, open = hddSlide(t) > .002;
    frect(g, x + .035, yF, HDD_Z + .003, RW - .07, HDD_H - .006, cc(open ? '#141A21' : COL.chas2));
    if (!open && CAM.k * HDD_H > 10) {
      frect(g, x + .07, yF, HDD_Z + .03, RW - .14, .02, cc('#5C6A7E'));
      for (let v = 0; v < 18; v++) frect(g, x + .08 + v * .025, yF, HDD_Z + .07, .012, .11, cc(COL.vent));
    }
  }
  const tcircle = (g, cx, cy, z, r, fill, n = 18) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(P(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); } poly(g, pts, fill); };
  const FAIL = { col: 2, row: 1 };
  function drawHddDrawer(g, t) {
    const s = hddSlide(t); if (s < .002) return;
    const rk = hero, yF = rk.y + RD, x0 = rk.x + .04, w = RW - .08, z0 = HDD_Z + .006, h = HDD_H - .012, zt = z0 + h;
    box(g, x0, yF, z0, w, s, h, cc('#1C232B'), cc('#3A4656'), cc('#323C49'));
    frect(g, x0 + .03, yF + s, z0 + .03, w - .06, .025, cc('#6B7889'));                       // handle
    for (let j = 0; j < 6; j++) for (let c = 0; c < 5; c++) {
      const fy = yF + s - .02 - j * .155, by = fy - .145;
      if (fy < yF + .01) continue;
      const y0 = Math.max(by, yF), dx = x0 + .012 + c * .102;
      const failing = c === FAIL.col && j === FAIL.row;
      let lift = 0, al = 1, newOne = false;
      if (failing) {
        if (t > 9.65 && t < 10.15) { lift = ease.in(clamp((t - 9.65) / .4)) * .35; al = 1 - smooth(9.9, 10.15, t); }
        else if (t >= 10.15) { newOne = true; lift = (1 - ease.out(clamp((t - 10.15) / .35))) * .35; al = smooth(10.15, 10.3, t); }
      }
      if (al <= 0) continue;
      g.globalAlpha = al;
      if (lift > 0) box(g, dx, y0, zt, .094, fy - y0, lift, null, cc('#8C98A6'), cc('#7A8695'));
      trect(g, dx, y0, zt + lift, .094, fy - y0, cc(lift > 0 ? '#C9D1DA' : '#B7C0CA'));
      if (fy - y0 > .1) {
        tcircle(g, dx + .047, fy - .06, zt + lift + .001, .036, cc('#A3AEBA'));
        tcircle(g, dx + .047, fy - .06, zt + lift + .002, .009, cc('#8B97A5'), 10);
        const st = failing && !newOne ? AMBER : GREEN;
        const blink = failing && !newOne ? (Math.sin(t * 9) > 0 ? 1 : .25) : 1;
        led(g, dx + .08, fy - .01, zt + lift + .002, st, blink * rackOn(hero, t), .006);
      }
      g.globalAlpha = 1;
    }
  }
  function drawSsdDrawer(g, t) {
    const s = ssdSlide(t); if (s < .002) return;
    const rk = ssdRack, yF = rk.y + RD, x0 = rk.x + .04, w = RW - .08, z0 = SSD_Z + .004, h = .081, zt = z0 + h;
    box(g, x0, yF, z0, w, s, h, cc('#1C232B'), cc('#3A4656'), cc('#323C49'));
    for (let j = 0; j < 14; j++) {
      const sx = x0 + .015 + j * .0365;
      trect(g, sx, yF, zt, .028, s - .025, cc('#C3CBD4'));
      trect(g, sx + .004, yF + .02, zt + .0005, .02, Math.max(0, s - .09), cc('#AEB8C3'));
      const act = hash2(j, Math.floor(t * 6)) > .6;
      led(g, sx + .014, yF + s - .012, zt, act ? BLUE : GREEN, rackOn(rk, t) * (act ? .9 : .7), .005);
    }
  }
  // fan angle: spins while powered, coasts down after
  function fanAng(t, off) { const v = 7; return t < off ? t * v : off * v + v * (1 - Math.exp(-(t - off) * 1.1)) / 1.1; }
  function drawCooler(g, rk, t, on) {
    const x = rk.x, yF = rk.y + RD, k = CAM.k;
    frect(g, x + .03, yF, .05, RW - .06, RH - .1, cc('#DCE1E7'));
    frect(g, x + .14, yF, 1.72, .32, .12, cc('#2B3440'));
    if (k > 34) led(g, x + .2, yF, 1.78, GREEN, on, .012);
    for (let f = 0; f < 3; f++) {
      const cz = .42 + f * .5, cx = x + RW / 2;
      fcircle(g, cx, yF, cz, .21, cc('#AEB8C3'));
      fcircle(g, cx, yF, cz, .19, cc('#46525F'));
      if (k * .19 > 9) {
        const a0 = fanAng(t, rk.off) + f * 1.3;
        for (let b = 0; b < 5; b++) {
          const a = a0 + b * TAU / 5, pts = [];
          for (let q = 0; q <= 4; q++) { const aa = a + q * .14, rr = .05 + q * .032; pts.push(P(cx + Math.cos(aa) * rr, yF, cz + Math.sin(aa) * rr)); }
          for (let q = 4; q >= 0; q--) { const aa = a + q * .14 + .42, rr = .05 + q * .032; pts.push(P(cx + Math.cos(aa) * rr * .98, yF, cz + Math.sin(aa) * rr * .98)); }
          poly(g, pts, cc('#8D99A8'));
        }
      }
      fcircle(g, cx, yF, cz, .045, cc('#C3CBD4'), 12);
    }
  }

  // ---------- tape library with a robot picker ----------
  const TP = (() => { const x = tapeRack.x, w = tapeRack.w; return { wx0: x + .1, wx1: x + w - .1, wz0: .36, wz1: 1.86 }; })();
  const TCOLS = 8, TROWS = 29;
  const slotX = c => TP.wx0 + .02 + c * .123 + .05, slotZ = r => .7 + r * .038 + .014;
  const DRIVE_X = j => TP.wx0 + .08 + j * .5 + .2, DRIVE_Z = .52;
  const PICK = { c: 2, r: 21 };
  const ROBO = [[0, slotX(6), slotZ(14)], [8.25, slotX(6), slotZ(14)], [8.85, slotX(PICK.c), slotZ(PICK.r)], [9.2, slotX(PICK.c), slotZ(PICK.r)],
    [9.9, DRIVE_X(0), DRIVE_Z], [10.3, DRIVE_X(0), DRIVE_Z], [10.95, slotX(5), slotZ(10)]];
  function robotAt(t) {
    for (let i = 1; i < ROBO.length; i++) {
      const [t0, x0, z0] = ROBO[i - 1], [t1, x1, z1] = ROBO[i];
      if (t < t1) { const u = ease.inOut(clamp((t - t0) / (t1 - t0))); return [lerp(x0, x1, u), lerp(z0, z1, u)]; }
    }
    const l = ROBO[ROBO.length - 1]; return [l[1], l[2]];
  }
  const TAB = ['#8C99A8', '#8C99A8', '#8C99A8', BLUE, AMBER, GREEN, '#8C99A8', '#5D6B7C'];
  function drawTape(g, rk, t, on) {
    const x = rk.x, yF = rk.y + RD, k = CAM.k;
    const { wx0, wx1, wz0, wz1 } = TP;
    frect(g, x + .03, yF, .05, rk.w - .06, RH - .1, cc('#323C49'));
    frect(g, x + .1, yF, 1.9, .5, .05, cc('#1E252E'));
    if (k > 34) led(g, x + .14, yF, 1.925, GREEN, on, .01);
    // window: everything inside is clipped to the glass
    const wq = [P(wx0, yF, wz0), P(wx1, yF, wz0), P(wx1, yF, wz1), P(wx0, yF, wz1)];
    g.save(); g.beginPath(); wq.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
    const RC = .14, yb = yF - RC, yr = yF - .06;
    frect(g, wx0 - .5, yb, wz0 - .5, wx1 - wx0 + 1, wz1 - wz0 + 1, cc('#1A2029'));
    g.save(); g.translate(...(() => { const a = P(0, 0, 0), b = P(-RC, 0, 0); return [b[0] - a[0], b[1] - a[1]]; })());
    // two tape drives at the bottom of the back wall
    for (let j = 0; j < 2; j++) {
      const dx = TP.wx0 + .08 + j * .5;
      frect(g, dx, yb, .44, .4, .16, cc('#3A4656'));
      frect(g, dx + .1, yb, .5, .2, .03, cc('#10151B'));
      const busy = j === 0 && t > 10.05 ? (Math.sin(t * 14) > 0 ? 1 : .3) : .8;
      if (k > 34) led(g, dx + .35, yb, .52, j === 0 && t > 10.05 ? BLUE : GREEN, on * busy, .008);
    }
    // cartridges: label edges, one column after another
    if (k * .028 > 2.8) {
      for (let c = 0; c < TCOLS; c++) for (let r = 0; r < TROWS; r++) {
        const cx = slotX(c) - .05, cz = slotZ(r) - .014;
        const taken = c === PICK.c && r === PICK.r && t > 9.0;
        if (taken) { frect(g, cx, yb, cz, .1, .028, cc('#0E1217')); continue; }
        frect(g, cx, yb, cz, .1, .028, cc('#D3DAE2'));
        frect(g, cx, yb, cz, .016, .028, cc(TAB[Math.floor(hash2(c * 3 + 1, r) * TAB.length)]));
        if (k * .028 > 6) for (let b = 0; b < 5; b++) frect(g, cx + .03 + b * .013, yb, cz + .007, .005 + (b % 2) * .003, .014, cc('#7C8896'));
      }
    } else {
      for (let c = 0; c < TCOLS; c++) frect(g, slotX(c) - .05, yb, slotZ(0) - .014, .1, TROWS * .038, cc('#8994A2'));
    }
    g.restore();
    // robot: rails, mast, gripper
    const [rx, rz] = robotAt(t);
    frect(g, wx0, yr, wz1 - .07, wx1 - wx0, .035, cc('#7D8999'));
    frect(g, wx0, yr, wz0 + .02, wx1 - wx0, .035, cc('#7D8999'));
    frect(g, rx - .018, yr, wz0 + .02, .036, wz1 - wz0 - .06, cc('#A9B3BF'));
    frect(g, rx - .075, yr, rz - .035, .15, .075, cc('#CBD2DA'));
    frect(g, rx - .06, yr, rz - .022, .12, .045, cc('#5D6A7A'));
    const carry = t > 9.0 && t < 10.05;
    if (carry) { frect(g, rx - .05, yr + .01, rz - .014, .1, .028, cc('#D3DAE2')); frect(g, rx - .05, yr + .01, rz - .014, .016, .028, cc(TAB[Math.floor(hash2(PICK.c * 3 + 1, PICK.r) * TAB.length)])); }
    if (k > 34) led(g, rx + .05, yr, rz + .025, BLUE, on * .9, .007);
    // glass: faint tint and one glare band; once the hall is dark the library's own light is off too
    frect(g, wx0, yF, wz0, wx1 - wx0, wz1 - wz0, cc('#AFC3DA', .08));
    if (DK > 0) frect(g, wx0, yF, wz0, wx1 - wx0, wz1 - wz0, cc('#15191F', .62 * DK * (1 - on * .5), 1));
    poly(g, [P(wx0 + .28, yF, wz1), P(wx0 + .46, yF, wz1), P(wx0 + .02, yF, wz0), P(wx0 - .16, yF, wz0)], cc('#FFFFFF', .05));
    g.restore();
    // frame edge
    const e = wq; g.strokeStyle = cc('#55626F'); g.lineWidth = Math.max(1, k * .006);
    g.beginPath(); e.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke();
  }

  // ---------- overhead power busway and coolant pipes on the front row; the technician ----------
  const PWR_A = t => smooth(6.9, 7.6, t) * (1 - .45 * smooth(11.4, 12, t)) * (1 - smooth(21.3, 21.8, t));
  function drawFrontLines(g, t) {
    const yF = yFront(3), xe = coolEnd.x + RW, k = CAM.k, pa = PWR_A(t);
    const grow = ease.inOut(clamp((t - 2.6) / .7));
    if (grow < .02) return;
    // busway just above the rack tops, with taps
    const bx0 = -.25, bl = (xe + .1 - bx0) * grow;
    box(g, bx0, yF - .2, 2.1, bl, .09, .07, cc('#64717F'), cc('#4B5764'), cc('#3D4855'));
    for (const rk of racks) if (rk.r === 3 && rk.x + .3 < bx0 + bl) box(g, rk.x + .26, yF - .19, 2.0, .08, .07, .1, cc('#64717F'), cc('#4B5764'), cc('#3D4855'));
    if (pa > 0) for (let j = 0; j < 7; j++) {
      const L = xe + .1 - bx0, xp = bx0 + ((t * 1.9 + j * L / 7) % L);
      frect(g, xp, yF - .11, 2.125, Math.min(.22, xe + .1 - xp), .02, cc(AMBER, pa * .95, 1));
    }
    // two coolant pipes: rise at the end of the row, run back above the trays
    const px = xe + .14, py = yF - .62, zA = 2.74, zB = 2.9, pl = (px - (-.3)) * grow;
    for (const [z, c1, c2, c3, dir] of [[zA, '#93A0AE', '#7C8999', '#6B7787', -1], [zB, '#A7B2BE', '#8E9AA8', '#7C8897', 1]]) {
      box(g, px - (z === zB ? .1 : 0), py, .2, .07, .07, z - .2, c3 && cc(c1), cc(c2), cc(c3));
      box(g, px - pl, py, z, pl + .07 - (z === zB ? .1 : 0), .07, .07, cc(c1), cc(c2), cc(c3));
      if (pa > 0) for (let j = 0; j < 9; j++) {
        const L = px + .3, q = ((t * 1.3 * (dir > 0 ? 1 : 1.15) + j * L / 9) % L), xp = dir < 0 ? px - q : -.3 + q;
        frect(g, xp, py + .07, z + .02, .16, .03, cc('#F2F6FB', pa * .9, 1));
      }
    }
    // pipe enters the cooler's side
    box(g, xe, py, .2, px - xe, .07, .07, cc('#93A0AE'), cc('#7C8999'), cc('#6B7787'));
  }
  // technician: walks in along the aisle, swaps the failing drive
  function drawTech(g, t) {
    if (t < 7.0 || t > 11.9) return;
    const yF = yFront(3), wu = clamp((t - 7.15) / 1.35), x = lerp(hero.x - 2.2, hero.x + .2, ease.out(wu)), y = yF + 1.0;
    const walk = wu > 0 && wu < 1 ? Math.sin(t * 11) : 0, al = smooth(7.0, 7.3, t) * (1 - smooth(11.5, 11.9, t));
    g.globalAlpha = al;
    // floor shadow
    tcircle(g, x + .1, y + .07, .002, .2, cc('#CBD3DC'), 16);
    const legC = cc('#2B3440'), shirt = cc('#55657C'), shirtD = cc('#45536A'), shirtS = cc('#3C4A5E');
    box(g, x, y, 0, .08, .08, .44 + walk * .03, legC, legC, cc('#232A33'));
    box(g, x + .12, y, 0, .08, .08, .44 - walk * .03, legC, legC, cc('#232A33'));
    box(g, x - .03, y - .02, .44, .26, .13, .42, shirt, shirtD, shirtS);
    // arm: hangs, then reaches for the failing drive
    const reach = smooth(9.25, 9.6, t) * (1 - smooth(10.35, 10.7, t));
    const s0 = P(x + .25, y + .03, .8);
    const dyF = yF + hddSlide(t) - .02 - FAIL.row * .155 - .07;
    const hand = [lerp(x + .3, hero.x + .04 + .012 + FAIL.col * .102 + .047, reach), lerp(y + .06, dyF, reach), lerp(.5, HDD_Z + HDD_H + .05 + (t > 9.65 && t < 10.15 ? ease.in(clamp((t - 9.65) / .4)) * .3 : 0), reach)];
    const h1 = P(...hand);
    g.strokeStyle = shirtD; g.lineCap = 'round'; g.lineWidth = Math.max(1.5, CAM.k * .06);
    g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(h1[0], h1[1]); g.stroke();
    // head
    const hp = P(x + .1, y + .045, .96), hr = CAM.k * .085;
    g.fillStyle = cc('#D9B597'); g.beginPath(); g.arc(hp[0], hp[1], hr, 0, TAU); g.fill();
    g.fillStyle = cc('#2B3440'); g.beginPath(); g.arc(hp[0], hp[1] - hr * .18, hr * 1.02, Math.PI * .95, Math.PI * 2.05); g.fill();
    g.globalAlpha = 1;
  }

  // ---------- the hall ----------
  function plate(g, x0, y0, x1, y1, grid = .6) {
    box(g, x0, y0, -.18, x1 - x0, y1 - y0, .18, cc('#E3E8EE'), cc('#CDD5DD'), cc('#BBC5CF'));
    if (CAM.k * grid < 9) return;
    g.strokeStyle = cc('#D5DCE3'); g.lineWidth = 1; g.beginPath();
    for (let x = x0 + grid; x < x1 - .01; x += grid) { const a = P(x, y0, 0), b = P(x, y1, 0); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    for (let y = y0 + grid; y < y1 - .01; y += grid) { const a = P(x0, y, 0), b = P(x1, y, 0); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.stroke();
  }
  const trayGrow = (t, r) => ease.inOut(clamp((t - 2.75 - r * .07) / .5));
  function drawHall(g, t) {
    if (!visible(PLATE.x0, PLATE.y0, PLATE.x1, PLATE.y1, 3, 60)) return;
    plate(g, PLATE.x0, PLATE.y0, PLATE.x1, PLATE.y1);
    // riser and trunk (cables arriving from outside)
    const rg = ease.inOut(clamp((t - 2.4) / .5)), tg = ease.inOut(clamp((t - 2.6) / .45));
    const trayC = [cc('#C9D0D8'), cc('#AEB8C3'), cc('#9DA8B5')];
    if (rg > 0) box(g, TX - .15, RY - .15, RISE_Z - rg * (RISE_Z - TRAYZ), .3, .3, rg * (RISE_Z - TRAYZ), ...trayC);
    for (let r = 0; r < NROW; r++) {
      const row = racks.filter(k => k.r === r);
      // contact shadow in front of the row
      for (const rk of row) if (t >= rk.appear) {
        const u = ease.out(rackU(rk, t));
        trect(g, rk.x - .02, rk.y + RD, .001, rk.w + .04, .28 * u, cc('#D9DFE6'));
        if (rk.i + (rk.ty === 't' ? 2 : 1) >= NCOL) trect(g, rk.x + rk.w, rk.y + .1, .001, .3 * u, RD, cc('#D9DFE6'));
        if (DK > 0) floorSpill(g, rk, t);
      }
      for (const rk of row) drawRack(g, rk, t);
    }
    if (tg > 0) box(g, TX - .15, RY - .15, TRAYZ, .3, (trayY(NROW - 1) + .3 - RY) * tg, .06, ...trayC);
    for (let r = 0; r < NROW; r++) {
      const gr = trayGrow(t, r); if (gr <= 0) continue;
      const len = (NCOL * PITCH - .05 - TRAYX0) * gr;
      for (let j = 0; j < 4; j++) { const hx = .35 + j * 1.55; if (hx < TRAYX0 + len) box(g, hx, trayY(r) - .01, RH, .02, .02, TRAYZ - RH, null, cc('#8E9AA8'), cc('#7D8999')); }
      box(g, TRAYX0, trayY(r) - .15, TRAYZ, len, .3, .06, ...trayC);
      trect(g, TRAYX0, trayY(r) - .02, TRAYZ + .061, len, .04, cc('#B5BFCA'));
    }
    // packets
    const pa = smooth(PK_T0, PK_T0 + .4, t) * (1 - smooth(PK_T1 - .7, PK_T1, t));
    if (pa > 0) {
      const pc = [cc(BLUE, pa, 1), cc('#2456D6', pa, 1), cc('#1C45B0', pa, 1)];
      for (let r = 0; r < NROW; r++) {
        const kHi = Math.floor((t + 6 - r * .105) / PK_DT), kLo = kHi - 40;
        for (let k = Math.max(0, kLo); k <= kHi; k++) for (let ln = 0; ln < 2; ln++) {
          const sp = pkSpawn(r, k, ln); if (ln && sp < LANE1) continue;
          const tg2 = pkTarget(r, k + ln * 500), s = (t - sp) * PK_V, L = pkLen(r, tg2);
          if (s < 0 || s > L) continue;
          const [x, y, z] = pkPos(r, s, tg2), q = .12, sh = Math.min(1, (L - s) / .3);
          box(g, x - q / 2, y - q / 2, z, q, q, q * sh, ...pc, false);
        }
      }
    }
    drawFrontLines(g, t);
    drawSsdDrawer(g, t);
    drawHddDrawer(g, t);
    drawTech(g, t);
  }

  // ---------- beat 2: two sites — an old one with the music shelf, a new one with fresh racks ----------
  const AL = .17, AL_COLS = 12, AL_ROWS = 6, AL_STEP = .3, SH_W = 2.55, SH_D = .7, SH_H = 1.95;
  const OLDS = { x0: .75, y0: .45 }, NEWS = { x0: 4.35, y0: -2.3 };
  const ALB_COL = ['#2B3440', '#44556B', '#6E7C8E', '#9CA8B6', '#C9D3E0', '#5B7FD6', '#8FA9E0', '#3D5A99', '#D9DEE5', '#E0B470', '#82B59A', '#B98E74'];
  const albums = (() => {
    const r = mulberry(1212), out = [];
    for (let s = 0; s < AL_ROWS; s++) for (let c = 0; c < AL_COLS; c++) out.push({ s, c, col: ALB_COL[Math.floor(r() * ALB_COL.length)], motif: Math.floor(r() * 5), lost: r() < .66, ord: r() });
    const sorted = [...out].sort((a, b) => a.ord - b.ord);
    sorted.forEach((a, n) => { a.td = 12.75 + n * .03; a.ta = a.td + .95; });
    return out;
  })();
  const slotPos = (S, a) => [MIG[0] + S.x0 + .11 + a.c * ((SH_W - .22) / AL_COLS) + .01, MIG[1] + S.y0 + .56, .085 + a.s * AL_STEP];
  function albumFace(g, x, y, z, a, alpha = 1) {
    g.globalAlpha = alpha;
    frect(g, x, y, z, AL, AL, cc(a.col));
    const L = rgbOf(a.col), lum = (.3 * L[0] + .59 * L[1] + .11 * L[2]) / 255, mc = cc(lum > .6 ? '#2B3440' : '#EEF1F4', .85);
    if (CAM.k * AL > 9) {
      if (a.motif === 0) fcircle(g, x + AL / 2, y, z + AL / 2, AL * .3, mc, 14);
      else if (a.motif === 1) { frect(g, x, y, z + AL * .2, AL, AL * .12, mc); frect(g, x, y, z + AL * .42, AL, AL * .06, mc); }
      else if (a.motif === 2) poly(g, [P(x, y, z), P(x + AL, y, z), P(x, y, z + AL)], mc);
      else if (a.motif === 3) frect(g, x + AL * .55, y, z + AL * .55, AL * .3, AL * .3, mc);
      else frect(g, x + AL * .15, y, z + AL * .15, AL * .12, AL * .7, mc);
    }
    g.globalAlpha = 1;
  }
  function shelf(g, S, modern, level) {
    const x0 = MIG[0] + S.x0, y0 = MIG[1] + S.y0, w = SH_W, x1 = x0 + w;
    const fr = modern ? ['#4E5A6A', '#2B3440', '#3B4656'] : ['#C3CBD4', '#A9B3BF', '#97A2AF'];
    frect(g, x0, y0 + .05, 0, w, SH_H, cc(modern ? '#26303B' : '#DCE2E8'));
    xrect(g, x0 + .05, y0, 0, SH_D, SH_H, cc(modern ? '#323C49' : '#CBD3DB'));
    for (let s = 0; s <= AL_ROWS; s++) {
      box(g, x0, y0, .055 + s * AL_STEP, w, SH_D, .03, cc(fr[0]), cc(fr[1]), cc(fr[2]));
      if (s < AL_ROWS) level(s);
    }
    box(g, x1 - .05, y0, 0, .05, SH_D, SH_H, cc(fr[0]), cc(fr[1]), cc(fr[2]));
    box(g, x0, y0, 0, .05, SH_D, SH_H, cc(fr[0]), cc(fr[1]), null);
    box(g, x0, y0, SH_H, w, SH_D, .05, cc(fr[0]), cc(fr[1]), cc(fr[2]));
  }
  function migRack(g, X, Y, t, legacy) {
    const yF = Y + RD;
    trect(g, X - .02, yF, .001, RW + .04, .25, cc('#D9DFE6'));
    if (legacy) {
      box(g, X, Y, 0, RW, RD, 1.7, cc('#C9D0D8'), cc('#9AA6B4'), cc('#AEB8C3'));
      for (let c = 0; c < 6; c++) {
        frect(g, X + .05, yF, .12 + c * .25, RW - .1, .2, cc('#B7C0CA')); frect(g, X + .1, yF, .2 + c * .25, .3, .03, cc('#8C98A6'));
        led(g, X + .48, yF, .22 + c * .25, c < 4 ? GREEN : AMBER, 1 - smooth(13.2 + c * .45, 13.4 + c * .45, t), .012);
      }
    } else {
      box(g, X, Y, 0, RW, RD, RH, cc(COL.top), cc(COL.front), cc(COL.side));
      frect(g, X + .02, yF, .04, RW - .04, RH - .07, cc(COL.door));
      for (let c = 0; c < 20; c++) { frect(g, X + .04, yF, CH_Z0 + c * .089 + .005, RW - .08, .079, cc(COL.chas)); led(g, X + .075, yF, CH_Z0 + c * .089 + .044, GREEN, 1); }
      frect(g, X + .025, yF, .1, .018, RH - .2, cc('#D7E3FF', .8, 1));
    }
  }
  function drawMig(g, t) {
    const ox = MIG[0], oy = MIG[1];
    if (!visible(ox - .5, oy - 3, ox + 8.6, oy + 2, 3.2, 60)) return;
    // the new site sits further back (smaller y): draw it first
    plate(g, ox + 3.9, oy - 2.85, ox + 8.55, oy - .95);
    const ph = smooth(12.3, 12.8, t);
    shelf(g, NEWS, true, lv => { for (const a of albums) if (a.s === lv) {
      const [x, y, z] = slotPos(NEWS, a);
      if (!a.lost && t >= a.ta) albumFace(g, x, y, z, a);
      else if (ph > 0) fdash(g, x, y, z, AL, AL, cc('#A3AFBC', ph * (a.lost && t > a.ta ? .95 : .5)), 1);
    } });
    for (const x of [7.05, 7.67]) migRack(g, ox + x, oy - 2.55, t, false);
    plate(g, ox - .45, oy - .15, ox + 3.6, oy + 1.95);
    migRack(g, ox, oy + .2, t, true);
    shelf(g, OLDS, false, lv => { for (const a of albums) if (a.s === lv) {
      const [x, y, z] = slotPos(OLDS, a);
      if (t < a.td) albumFace(g, x, y, z, a);
      else fdash(g, x, y, z, AL, AL, cc('#AEB8C3'), 1);
    } });
    // migration arrow: dashed arc from the old site to the new one
    const ag = ease.inOut(clamp((t - 12.3) / .55)), af = 1 - smooth(16.1, 16.6, t);
    const A0 = [ox + OLDS.x0 + SH_W * .7, oy + OLDS.y0 + .35, SH_H + .25], A1 = [ox + NEWS.x0 + SH_W * .3, oy + NEWS.y0 + .35, SH_H + .25];
    if (ag > 0 && af > 0) {
      const n = 40, pts = [];
      for (let i = 0; i <= n * ag; i++) { const u = i / n; pts.push(P(lerp(A0[0], A1[0], u), lerp(A0[1], A1[1], u), A0[2] + Math.sin(Math.PI * u) * .9)); }
      g.save(); g.strokeStyle = cc(BLUE, af); g.lineWidth = Math.max(2, CAM.k * .025); g.lineCap = 'round';
      g.setLineDash([CAM.k * .07, CAM.k * .06]); g.lineDashOffset = -t * CAM.k * .5;
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore();
      if (ag > .98) {
        const a = pts[pts.length - 3], b = pts[pts.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), s = CAM.k * .15;
        g.fillStyle = cc(BLUE, af); g.beginPath(); g.moveTo(b[0] + Math.cos(ang) * s * .7, b[1] + Math.sin(ang) * s * .7);
        g.lineTo(b[0] + Math.cos(ang + 2.4) * s, b[1] + Math.sin(ang + 2.4) * s); g.lineTo(b[0] + Math.cos(ang - 2.4) * s, b[1] + Math.sin(ang - 2.4) * s); g.fill();
      }
    }
    // albums in flight along the same arc family; most blink and vanish on the way
    for (const a of albums) {
      if (t < a.td || t > a.ta) continue;
      const u = (t - a.td) / (a.ta - a.td), e = ease.inOut(u);
      const p0 = slotPos(OLDS, a), p1 = slotPos(NEWS, a);
      const x = lerp(p0[0], p1[0], e), y = lerp(p0[1], p1[1], e) + Math.sin(Math.PI * e) * .5, z = lerp(p0[2], p1[2], e) + Math.sin(Math.PI * e) * (1.3 - a.s * .1);
      if (a.lost) {
        if (u > .6) { const q = clamp((u - .6) / .2); if (q < 1) fdash(g, x - q * .06, y, z - q * .06, AL + q * .12, AL + q * .12, cc(BLUE, (1 - q) * .8), 1.2); continue; }
        const bl = u > .34 ? (Math.floor((u - .34) * 46) % 2 ? .12 : 1) : 1;
        albumFace(g, x, y, z, a, bl);
      } else albumFace(g, x, y, z, a);
    }
  }

  // ---------- beat 3: a field of web pages; 38 of 100 break ----------
  const PG_W = .5, PG_H = .62;
  const pages = (() => {
    const r = mulberry(2013), out = [];
    for (let rr = 0; rr < PAG_N; rr++) for (let c = 0; c < PAG_N; c++) out.push({ c, r: rr, hdr: Math.floor(r() * 4), lay: Math.floor(r() * 3), k: r() });
    const sh = [...out].sort((a, b) => a.k - b.k);
    sh.slice(0, 38).forEach((p, n) => { p.tb = 17.2 + n * .068; });
    return out;
  })();
  const HDR = [BLUE, '#2B3440', '#6E7C8E', '#9CA8B6'];
  function drawPages(g, t) {
    const ox = PAG[0], oy = PAG[1], ext = PAG_N * PAG_P;
    if (!visible(ox - .4, oy - .4, ox + ext + .3, oy + ext + .3, 1, 60)) return;
    plate(g, ox - .4, oy - .4, ox + ext + .2, oy + ext + .2, PAG_P);
    const k = CAM.k;
    for (const p of pages) {
      const x = ox + .1 + p.c * PAG_P, y = oy + .2 + p.r * PAG_P, yF = y + .03;
      const br = p.tb ? smooth(p.tb, p.tb + .35, t) : 0;
      trect(g, x - .02, yF + .02, .001, PG_W + .06, .14, cc('#D9DFE6'));
      box(g, x - .02, y - .04, 0, PG_W + .04, .11, .035, cc('#C3CBD4'), cc('#AEB8C3'), cc('#9DA8B5'));
      const fa = 1 - br * .92;
      g.globalAlpha = fa;
      box(g, x, y, .035, PG_W, .03, PG_H, cc('#E8ECF0'), cc('#FBFCFD'), cc('#C9D0D8'));
      g.globalAlpha = 1;
      const ca = 1 - smooth(0, .6, br);
      if (ca > 0 && k * PG_H > 22) {
        g.globalAlpha = ca;
        const z0 = .035;
        frect(g, x, yF, z0 + PG_H - .08, PG_W, .08, cc(HDR[p.hdr]));
        if (p.lay === 0) { frect(g, x + .04, yF, z0 + .3, .2, .2, cc('#BFD0EC')); for (let l = 0; l < 4; l++) frect(g, x + .27, yF, z0 + .46 - l * .05, .18 - (l % 2) * .05, .024, cc('#A3AEBA')); }
        else if (p.lay === 1) { frect(g, x + .04, yF, z0 + .32, PG_W - .08, .18, cc('#C9D6EA')); for (let l = 0; l < 3; l++) frect(g, x + .04, yF, z0 + .25 - l * .05, PG_W - .1 - (l % 2) * .12, .024, cc('#A3AEBA')); }
        else { for (let l = 0; l < 6; l++) frect(g, x + .04, yF, z0 + .45 - l * .055, PG_W - .1 - ((l * 7) % 3) * .06, .024, cc('#A3AEBA')); }
        frect(g, x + .04, yF, z0 + .05, .14, .04, cc(HDR[p.hdr], .55));
        g.globalAlpha = 1;
      }
      if (br > 0) { // broken: dashed outline and a torn line across the page
        fdash(g, x, yF + .001, .035, PG_W, PG_H, cc('#7F8B99', br), Math.max(1.2, k * .014));
        const zz = .035 + PG_H * .5, pts = [];
        for (let s = 0; s <= 6; s++) pts.push(P(x + .06 + s * (PG_W - .12) / 6, yF + .001, zz + (s % 2 ? .04 : -.03)));
        g.strokeStyle = cc('#7F8B99', br); g.lineWidth = Math.max(1.2, k * .014); g.beginPath();
        pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke();
      }
    }
  }
  function mixHex(a, b, k) {
    const A = rgbOf(a), B = rgbOf(b), h = v => Math.round(v).toString(16).padStart(2, '0');
    return '#' + h(lerp(A[0], B[0], k)) + h(lerp(A[1], B[1], k)) + h(lerp(A[2], B[2], k));
  }

  // Text guards for the shared opener()/subs():
  // - subs() sets textAlign 'center' while revealText() places each glyph at its left-edge advance, so every glyph is
  //   shifted left by half its own width: spaces vanish ("2006年", "S3云") and narrow Latin splits ("M yspace").
  //   Hold the context at 'left' for the call; revealText centres each line itself.
  // - measure multi-glyph strings as the sum of single-glyph advances (the same advances the glyph-by-glyph drawing
  //   uses), so the layout is a pure function of the string and never depends on Chrome's shaping cache.
  const MT = CanvasRenderingContext2D.prototype.measureText;
  function stableText(ctx, left, fn) {
    if (left) { ctx.textAlign = 'left'; Object.defineProperty(ctx, 'textAlign', { configurable: true, get: () => 'left', set: () => {} }); }
    Object.defineProperty(ctx, 'measureText', { configurable: true, value: s => {
      const cs = [...s]; if (cs.length < 2) return MT.call(ctx, s);
      let w = 0; for (const c of cs) w += MT.call(ctx, c).width; return { width: w };
    } });
    try { fn(); } finally { delete ctx.measureText; if (left) delete ctx.textAlign; }
  }

  // ---------- scene ----------
  const TD = 1.1;
  const darkness = t => .78 * ease.inOut(clamp((t - 20.3) / .75)) + .14 * smooth(21.1, 23.6, t);   // power drops during the pan, then settles
  TRANS.cloud_zoomout = (ctx, A, B, p) => {
    ctx.drawImage(B, 0, 0);
    const a = 1 - smooth(.5, .9, p);
    if (a <= 0) return;
    DK = 0; setCam(camAt(p * TD));
    const q = [P(BAY.x, BAY.y, BAY.z), P(BAY.x + BAY_W, BAY.y, BAY.z), P(BAY.x + BAY_W, BAY.y, BAY.z + BAY_H), P(BAY.x, BAY.y, BAY.z + BAY_H)];
    const s = 1 / (Z0 * U), c = CAM, o = P(BAY.cx, BAY.y, BAY.cz);
    const a11 = c.k * c.mxx * s, a12 = c.k * c.mxy * s, a22 = c.k * s;
    ctx.save();
    ctx.beginPath(); q.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])); ctx.closePath(); ctx.clip();
    ctx.setTransform(a11, a12, 0, a22, o[0] - a11 * PIV[0], o[1] - a12 * PIV[0] - a22 * PIV[1]);
    ctx.globalAlpha = a; ctx.drawImage(A, 0, 0);
    ctx.restore();
  };

  scene({
    id: 'cloud', n: ch.n, dur: ch.dur,
    trans: { type: 'cloud_zoomout', d: TD },
    cues: [
      { t: .25, sfx: 'fan', v: .6 }, { t: .95, sfx: 'blip', v: .5 }, { t: 1.6, sfx: 'whoosh', v: .35 },
      { t: 3.6, sfx: 'blip', v: .45 }, { t: 4.5, sfx: 'blip', v: .45 }, { t: 5.4, sfx: 'blip', v: .45 }, { t: 6.3, sfx: 'blip', v: .45 },
      { t: 7.5, sfx: 'click', v: .6 }, { t: 8.0, sfx: 'click', v: .5 }, { t: 8.3, sfx: 'relay', v: .5 }, { t: 9.0, sfx: 'click', v: .6 },
      { t: 9.2, sfx: 'relay', v: .5 }, { t: 10.05, sfx: 'click', v: .6 }, { t: 10.45, sfx: 'click', v: .5 },
      { t: 13.25, sfx: 'whoosh', v: .55 }, { t: 14.2, sfx: 'whoosh', v: .45 },
      { t: 17.25, sfx: 'whoosh', v: .4 }, { t: 18.5, sfx: 'tick', v: .4 },
      { t: 20.65, sfx: 'impact', v: .45 }, { t: LAST_LED, sfx: 'chime', v: .6 },
    ],
    init() {},
    draw(ctx, t) {
      DK = darkness(t);
      setCam(camAt(t));
      ctx.fillStyle = cc(BG); ctx.fillRect(0, 0, W, H);
      drawHall(ctx, t);
      drawMig(ctx, t);
      drawPages(ctx, t);
      if (t > LAST_LED) { // the one light left: a small warm spill on the rack face
        const a = smooth(LAST_LED, LAST_LED + .3, t) * (.8 + .2 * Math.cos((t - LAST_LED) * 2.6));
        const [lx, ly] = P(...LEDP), R = 150 + CAM.k * .25;
        const gr = ctx.createRadialGradient(lx, ly, 0, lx, ly, R);
        gr.addColorStop(0, cc(AMBER, .8 * a, 1)); gr.addColorStop(.08, cc(AMBER, .36 * a, 1)); gr.addColorStop(.3, cc(AMBER, .1 * a, 1)); gr.addColorStop(1, cc(AMBER, 0, 1));
        ctx.fillStyle = gr; ctx.fillRect(lx - R, ly - R, 2 * R, 2 * R);
        ctx.fillStyle = cc('#FFD58A', a, 1); ctx.beginPath(); ctx.arc(lx, ly, 3.2 + CAM.k * .01, 0, TAU); ctx.fill();
      }
      if (t < 3.6) stableText(ctx, false, () => opener(ctx, t, ch, {
        ink: SLATE, sub: '#5B6878', accent: BLUE, x: 170, y: 470, align: 'left', inAt: .9, outAt: 2.95,
        title: { family: FONT, size: 190, weight: 700, sp: 0 },
        small: { family: FONT, size: 32, weight: 400 },
        num: { family: FONT, size: 66, weight: 700 },
      }));
      const late = t > 20.77;
      stableText(ctx, true, () => subs(ctx, t, ch, {
        ink: late ? '#E4E8EC' : SLATE, body: { family: FONT, size: 52, weight: 400 },
        shadow: late ? 'rgba(22,25,30,.9)' : 'rgba(238,241,244,.95)',
      }));
    },
  });
})();
