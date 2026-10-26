// 09 磁带 — Swiss international typographic style. Off-white sheet, black, one signal red; strict 120 px grid,
// flush-left grotesque numerals. The chapter is a strip of five "posters" spliced together like tape:
// reel-to-reel deck + magnified domains → 1951 + bronze metal reel → robotic library aisle →
// 40 TB cartridge + three-decade bar → the proven-vs-estimated rule.
'use strict';
(() => {
  const ch = CH('tape');
  const PAPER_C = '#F0EFE9', INK = '#1A1A19', RED = '#E2231A', GREY = '#B4B2AA', MID = '#8E8B83';
  const BRONZE = '#8C6A3A', BRONZE_D = '#5C4424', BRONZE_L = '#B08A52';
  const SANS = '"Noto Sans SC"', DISP = '"Inter Display"';
  const TAU = Math.PI * 2;

  // mechanical motion: accelerate, cruise at constant speed, decelerate
  function trap(p, a = .22) {
    p = clamp(p); const v = 1 / (1 - a);
    if (p < a) return v * p * p / (2 * a);
    if (p > 1 - a) return 1 - v * (1 - p) * (1 - p) / (2 * a);
    return v * (a / 2 + p - a);
  }
  // ∫ smooth(a,b,x) dx up to t — distance travelled by a transport that spins up between a and b
  function ramp(t, a, b) {
    if (t <= a) return 0; const L = b - a;
    if (t >= b) return L * .5 + (t - b);
    const u = (t - a) / L; return L * (u * u * u - u * u * u * u / 2);
  }
  function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
  // external tangent between two circles; returns both candidates
  function tangents(c1, r1, c2, r2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y, L = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx), b = Math.acos(clamp((r1 - r2) / L, -1, 1));
    return [a + b, a - b].map(ang => {
      const nx = Math.cos(ang), ny = Math.sin(ang);
      return { ang, nx, ny, p1: { x: c1.x + r1 * nx, y: c1.y + r1 * ny }, p2: { x: c2.x + r2 * nx, y: c2.y + r2 * ny } };
    });
  }

  // ---------- the strip of panels (spliced like tape, diagonal splice) ----------
  const PG = 320, PW = W + PG, SK = .22;
  const SLIDES = [[6.55, 7.25], [10.58, 11.28], [14.79, 15.49], [19.58, 20.28]];
  function stripPos(t) { let p = 0; for (const [a, b] of SLIDES) p += trap((t - a) / (b - a), .26); return p; }

  // ================= panel 0: reel-to-reel deck + magnifier =================
  const RA = { x: 1120, y: 330 }, RB = { x: 1590, y: 330 }, RF = 200, RH = 50;
  const G1 = { x: 880, y: 690, r: 22 }, G2 = { x: 1790, y: 690, r: 22 };
  const TY = G1.y + G1.r;                       // the straight tape run
  const HEADX = 1000, CAPX = 1330;
  const R0A = 172, R0B = 84, CPK = 1.4, V0 = 230, SUM = R0A * R0A + R0B * R0B;
  function deck(t) {
    const s = V0 * ramp(t, .25, .9);
    const rB = Math.sqrt(R0B * R0B + CPK * s), rA = Math.sqrt(Math.max(SUM - rB * rB, 3600));
    // θ = ∫ds/r: the full supply reel turns slowly, the near-empty take-up reel quickly
    return { s, rA, rB, thA: 2 * (R0A - rA) / CPK, thB: 2 * (rB - R0B) / CPK };
  }
  function drawReel(g, cx, cy, rp, th) {
    g.save(); g.translate(cx, cy);
    g.fillStyle = rgba(INK, .045); circ(g, 0, 0, RF); g.fill();
    g.fillStyle = INK; circ(g, 0, 0, rp); g.fill();
    g.strokeStyle = 'rgba(240,239,233,.09)'; g.lineWidth = 1;
    for (let r = RH + 12; r < rp - 3; r += 7) { circ(g, 0, 0, r); g.stroke(); }
    g.rotate(-th);
    for (let k = 0; k < 3; k++) {
      g.save(); g.rotate(k * TAU / 3);
      g.fillStyle = PAPER_C; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.beginPath(); g.rect(-15, -RF + 12, 30, RF - 12 - RH + 4); g.fill(); g.stroke();
      g.restore();
    }
    g.fillStyle = PAPER_C; g.strokeStyle = INK; g.lineWidth = 4; circ(g, 0, 0, RH); g.fill(); g.stroke();
    g.fillStyle = INK; circ(g, 0, 0, 17); g.fill();
    for (let k = 0; k < 3; k++) { g.save(); g.rotate(k * TAU / 3); g.fillRect(-4, -26, 8, 12); g.restore(); }
    g.fillStyle = RED; circ(g, 0, -RF + 30, 7); g.fill();
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 5; circ(g, cx, cy, RF); g.stroke();
    g.lineWidth = 1.5; circ(g, cx, cy, RF - 12); g.stroke();
  }
  function drawRoller(g, c, th) {
    g.fillStyle = PAPER_C; g.strokeStyle = INK; g.lineWidth = 3; circ(g, c.x, c.y, c.r); g.fill(); g.stroke();
    g.fillStyle = INK; circ(g, c.x, c.y, 4); g.fill();
    g.save(); g.translate(c.x, c.y); g.rotate(th); g.fillRect(-1, -c.r + 4, 2, 8); g.restore();
  }
  function drawDeck(g, t) {
    const d = deck(t);
    drawReel(g, RA.x, RA.y, d.rA, d.thA);
    drawReel(g, RB.x, RB.y, d.rB, d.thB);
    // tape path: supply pack → G1 → straight run over the head and capstan → G2 → take-up pack
    const ta = tangents(RA, d.rA, G1, G1.r).find(q => q.nx < 0);
    const tb = tangents(G2, G2.r, RB, d.rB).find(q => q.nx > 0);
    g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(ta.p1.x, ta.p1.y); g.lineTo(ta.p2.x, ta.p2.y);
    g.arc(G1.x, G1.y, G1.r, ta.ang, Math.PI / 2, true);
    g.lineTo(G2.x, TY);
    g.arc(G2.x, G2.y, G2.r, Math.PI / 2, tb.ang, true);
    g.lineTo(tb.p2.x, tb.p2.y); g.stroke();
    // the tape wraps the underside of both guides moving right → they turn anticlockwise
    drawRoller(g, G1, -d.s / G1.r); drawRoller(g, G2, -d.s / G2.r);
    // read/write head under the run, its gap marked in red
    g.fillStyle = INK; g.beginPath(); g.roundRect(HEADX - 30, TY + 3, 60, 62, [16, 16, 3, 3]); g.fill();
    g.fillStyle = RED; g.fillRect(HEADX - 1.5, TY + 3, 3, 16);
    g.fillStyle = INK; g.fillRect(HEADX - 46, TY + 70, 92, 6);
    // capstan above, rubber pinch roller below
    circ(g, CAPX, TY - 12, 9.5); g.fill();
    const pr = { x: CAPX, y: TY + 33, r: 30 };
    g.fillStyle = INK; circ(g, pr.x, pr.y, pr.r); g.fill();
    g.fillStyle = PAPER_C; circ(g, pr.x, pr.y, 15); g.fill();
    g.fillStyle = INK; circ(g, pr.x, pr.y, 4); g.fill();
    g.save(); g.translate(pr.x, pr.y); g.rotate(d.s / pr.r);          // tape on top moving right → clockwise
    g.fillStyle = PAPER_C; g.fillRect(-2, -pr.r + 3, 4, 10); g.restore();
  }

  // magnifier: lens on the head, cone of tangents, big disc with the tape seen ×∞
  const LENS = { x: HEADX, y: TY + 6, r: 46 }, DISC = { x: 540, y: 410, r: 292 };
  const TE = 3.95, CW = 64, VM = CW / .375;    // head engages at TE; domain length; magnified tape speed (one domain / 0.375 s)
  const DIR = k => (hash2(k * 3 + 17, 41) < .5 ? 1 : -1);
  const YF0 = 342, YC0 = 368, YC1 = 492, YTR = 286, YBIT = 228;
  function discContent(g, t) {
    const cx = DISC.x, hx = cx, shift = VM * (t - TE);
    g.fillStyle = '#A9A69D'; g.fillRect(cx - 300, YF0, 600, YC0 - YF0);   // base film
    g.fillStyle = INK; g.fillRect(cx - 300, YC0, 600, YC1 - YC0);         // magnetic coating
    const k0 = Math.floor((hx + shift - (cx + 310)) / CW - .5), k1 = Math.ceil((hx + shift - (cx - 310)) / CW);
    const ym = (YC0 + YC1) / 2;
    for (let k = k0; k <= k1; k++) {
      const xc = hx + shift - (k + .5) * CW;
      // oxide particles ride with the tape — the surface moves but shows nothing
      for (let i = 0; i < 12; i++) {
        const px = xc + (hash2(k, i * 7 + 1) - .5) * CW, py = YC0 + 6 + hash2(k, i * 7 + 2) * (YC1 - YC0 - 12);
        g.fillStyle = `rgba(240,239,233,${.05 + .08 * hash2(k, i * 7 + 3)})`;
        g.fillRect(px, py, 2, 2);
      }
      // domain wall on this cell's right edge, once it has passed the gap
      const xb = xc + CW / 2;
      if (k > 0 && xb >= hx && DIR(k - 1) !== DIR(k)) {
        g.fillStyle = `rgba(240,239,233,${.45 * clamp((xb - hx) / 24)})`; g.fillRect(xb - 1, YC0, 2, YC1 - YC0);
      }
      if (k < 0 || xc < hx) continue;
      const a = clamp((xc - hx) / 24), d = DIR(k);
      // the head has read this domain: its magnetisation becomes an arrow, a bit, a domain wall
      g.globalAlpha = a;
      g.strokeStyle = PAPER_C; g.fillStyle = PAPER_C; g.lineWidth = 6;
      g.beginPath(); g.moveTo(xc - 24 * d, ym); g.lineTo(xc + 6 * d, ym); g.stroke();
      g.beginPath(); g.moveTo(xc + 26 * d, ym); g.lineTo(xc + 2 * d, ym - 15); g.lineTo(xc + 2 * d, ym + 15); g.closePath(); g.fill();
      g.fillStyle = INK; font(g, 40, DISP, 800); g.textAlign = 'center';
      g.fillText(d > 0 ? '1' : '0', xc, YBIT);
      g.globalAlpha = 1;
    }
    g.textAlign = 'left';
    // read signal: a pulse at every flux reversal that has passed the gap
    if (t > TE) {
      const xr = Math.min(hx + shift, cx + 300);
      g.strokeStyle = RED; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
      for (let x = hx; x <= xr; x += 3) {
        let s = 0;
        const j0 = Math.max(1, Math.floor((hx + shift - x) / CW) - 1);
        for (let j = j0; j <= j0 + 2; j++) {
          const xb = hx + shift - j * CW;
          if (xb < hx) continue;
          s += (DIR(j) - DIR(j - 1)) / 2 * Math.exp(-Math.pow((x - xb) / 10, 2));
        }
        const y = YTR - s * 52;
        if (x === hx) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = RED; circ(g, hx, YTR, 6); g.fill();
    }
    // magnified ring-core head; it rises onto the coating, then reads
    const lift = (1 - trap(clamp((t - 3.55) / .38))) * 50;
    const hy = YC1 + 3 + lift;
    g.fillStyle = INK; g.beginPath();
    g.moveTo(hx - 24, hy); g.lineTo(hx + 24, hy); g.lineTo(hx + 128, hy + 170); g.lineTo(hx - 128, hy + 170); g.closePath(); g.fill();
    g.fillStyle = PAPER_C; g.beginPath();
    g.moveTo(hx - 22, hy + 52); g.lineTo(hx + 22, hy + 52); g.lineTo(hx + 84, hy + 140); g.lineTo(hx - 84, hy + 140); g.closePath(); g.fill();
    g.fillRect(hx - 2, hy, 4, 54);
    g.fillStyle = RED;
    for (let i = 0; i < 7; i++) g.fillRect(hx - 66 + i * 20, hy + 133, 10, 44);
  }
  function magnifier(g, t) {
    const aL = clamp((t - 2.62) / .3);
    if (aL <= 0) return;
    g.save();
    g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.arc(LENS.x, LENS.y, LENS.r, -Math.PI / 2, -Math.PI / 2 + aL * TAU); g.stroke();
    const rr = DISC.r * ease.out(clamp((t - 2.95) / .55));
    const aT = ease.inOut(clamp((t - 2.9) / .3));
    if (aT > 0) {
      g.lineWidth = 2;
      for (const tg of tangents(LENS, LENS.r, DISC, Math.max(rr, 1))) {
        g.beginPath(); g.moveTo(tg.p1.x, tg.p1.y);
        g.lineTo(lerp(tg.p1.x, tg.p2.x, aT), lerp(tg.p1.y, tg.p2.y, aT)); g.stroke();
      }
    }
    if (rr > 1) {
      g.save(); circ(g, DISC.x, DISC.y, rr); g.clip();
      g.fillStyle = PAPER_C; g.fillRect(DISC.x - rr, DISC.y - rr, rr * 2, rr * 2);
      discContent(g, t);
      g.restore();
      g.strokeStyle = INK; g.lineWidth = 6; circ(g, DISC.x, DISC.y, rr); g.stroke();
    }
    g.restore();
  }
  function P0(g, t) { drawDeck(g, t); magnifier(g, t); }

  // ================= panel 1: 1951 and the UNIVAC metal reel =================
  const YEAR = '1951', YS = 440, YB = 604, YX = 112;
  const MR = { x: 1492, y: 392 }, MRF = 286, MRP = 244;
  let yearCols = null;
  function P1(g, t) {
    const lt = t - 6.4, th = .55 * Math.max(0, lt), v = .55 * MRP;
    // the metal tape runs off the bottom of the pack, under the numerals
    const ty = MR.y + MRP;
    g.fillStyle = BRONZE; g.fillRect(YX + 8, ty - 5, MR.x - YX - 8, 10);
    const off = ((v * Math.max(0, lt)) % 84 + 84) % 84;
    g.fillStyle = BRONZE_D;
    for (let x = YX + 8 - off; x < MR.x; x += 84) {
      const x0 = Math.max(x, YX + 8), x1 = Math.min(x + 58, MR.x);
      if (x1 > x0) g.fillRect(x0, ty - 2, x1 - x0, 4);
    }
    // reel: dark pack seen through six lightening holes in a bronze flange
    g.save(); g.translate(MR.x, MR.y); g.rotate(th);
    g.fillStyle = BRONZE_D; circ(g, 0, 0, MRP); g.fill();
    g.strokeStyle = 'rgba(240,220,180,.10)'; g.lineWidth = 1;
    for (let r = 80; r < MRP; r += 6) { circ(g, 0, 0, r); g.stroke(); }
    g.fillStyle = BRONZE; g.beginPath(); g.arc(0, 0, MRF, 0, TAU);
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; g.moveTo(Math.cos(a) * 172 + 54, Math.sin(a) * 172); g.arc(Math.cos(a) * 172, Math.sin(a) * 172, 54, 0, TAU); }
    g.fill('evenodd');
    g.strokeStyle = BRONZE_L; g.lineWidth = 2;
    circ(g, 0, 0, MRF - 14); g.stroke(); circ(g, 0, 0, 92); g.stroke();
    g.fillStyle = INK; circ(g, 0, 0, 62); g.fill();
    g.fillStyle = PAPER_C; circ(g, 0, 0, 22); g.fill();
    g.fillStyle = INK; for (let k = 0; k < 3; k++) { g.save(); g.rotate(k * TAU / 3); g.fillRect(-5, -30, 10, 12); g.restore(); }
    g.restore();
    // giant year on an odometer: each wheel rolls up and lands with a relay click
    font(g, YS, DISP, 900);
    const cap = YS * .73, pitch = YS * .86;
    yearCols.forEach((col, i) => {
      const land = 7.55 + i * .2, st = 7.05;
      const p = ease.out(clamp((t - st) / (land - st)));
      const v = col.d + (2 + i) * 10 * (p - 1);
      const n = Math.floor(v), f = v - n;
      g.save(); g.beginPath(); g.rect(col.x - 8, YB - cap - 10, col.w + 16, cap + 22); g.clip();
      g.fillStyle = INK; g.textAlign = 'center';
      g.fillText(String(((n % 10) + 10) % 10), col.x + col.w / 2, YB - f * pitch);
      if (f > 0) g.fillText(String((((n + 1) % 10) + 10) % 10), col.x + col.w / 2, YB + (1 - f) * pitch);
      g.restore();
    });
    g.textAlign = 'left';
  }

  // ================= panel 2: robotic tape library aisle =================
  const LW = { x: 120, y: 150, w: 1680, h: 614 };
  const SL = { w: 78, h: 19, px: 90, py: 26, x0: 24, y0: 40, cols: 5, mags: 3, mp: 480, rows: 21 };
  const DRV = { x: 1478, w: 176, h: 84, y0: 92, py: 118, n: 4 };
  const PICK = { m: 1, c: 2, r: 12 }, DRIVE = 2;
  const slotX = (m, c) => SL.x0 + m * SL.mp + c * SL.px, slotY = r => SL.y0 + r * SL.py;
  let wall = null;
  function bakeWall() {
    const c = makeCanvas(LW.w, LW.h), g = c.getContext('2d');
    g.fillStyle = INK;
    g.fillRect(0, 0, LW.w, 14); g.fillRect(0, LW.h - 14, LW.w, 14);
    g.fillRect(0, 0, 8, LW.h); g.fillRect(LW.w - 8, 0, 8, LW.h);
    for (let m = 0; m < SL.mags; m++) {
      const mx = slotX(m, 0) - 12;
      g.fillRect(mx, 14, 3, LW.h - 28); g.fillRect(mx + SL.cols * SL.px + 6, 14, 3, LW.h - 28);
      for (let cc = 0; cc < SL.cols; cc++) for (let r = 0; r < SL.rows; r++) {
        const x = slotX(m, cc), y = slotY(r);
        if (hash2(m * 31 + cc, r + 7) < .06 || (m === PICK.m && cc === PICK.c && r === PICK.r)) {
          g.strokeStyle = rgba(INK, .55); g.lineWidth = 1; g.strokeRect(x + .5, y + .5, SL.w - 1, SL.h - 1); continue;
        }
        cart(g, x, y, m * 1000 + cc * 50 + r);
      }
    }
    for (let i = 0; i < DRV.n; i++) {
      const y = DRV.y0 + i * DRV.py;
      g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(DRV.x, y, DRV.w, DRV.h);
      g.fillStyle = INK; g.fillRect(DRV.x + 28, y + 34, DRV.w - 56, 14);
      g.lineWidth = 2; circ(g, DRV.x + DRV.w - 18, y + 16, 5); g.stroke();
    }
    return c;
  }
  function cart(g, x, y, seed) {
    g.fillStyle = INK; g.fillRect(x, y, SL.w, SL.h);
    g.fillStyle = '#E4E2DA'; g.fillRect(x + 7, y + 4, 50, 11);
    const r = mulberry(seed + 9); g.fillStyle = INK;
    for (let bx = x + 10; bx < x + 54;) { const w = r() < .5 ? 1 : 2; g.fillRect(bx, y + 6, w, 7); bx += w + 1 + Math.floor(r() * 2); }
  }
  function robot(t) {
    const sx = DRV.x + DRV.w / 2, sy = DRV.y0 + 1 * DRV.py + 41;
    const px = slotX(PICK.m, PICK.c) + SL.w / 2, py = slotY(PICK.r) + SL.h / 2;
    const dx = DRV.x + DRV.w / 2, dy = DRV.y0 + DRIVE * DRV.py + 41;
    const a = trap((t - 11.36) / .95, .3), b = trap((t - 12.62) / .95, .3);
    let x = lerp(sx, px, a), y = lerp(sy, py, a);
    if (t > 12.62) { x = lerp(px, dx, b); y = lerp(py, dy, b); }
    return { x, y, held: t >= 12.42 && t < 13.86, insert: clamp((t - 13.62) / .3), grip: smooth(12.22, 12.42, t) * (1 - smooth(13.7, 13.86, t)) };
  }
  function P2(g, t) {
    if (!wall) wall = bakeWall();
    g.drawImage(wall, LW.x, LW.y);
    g.save(); g.translate(LW.x, LW.y);
    const R = robot(t);
    const px = slotX(PICK.m, PICK.c), py = slotY(PICK.r);
    // drive LED lights once the cartridge is loaded
    const ly = DRV.y0 + DRIVE * DRV.py + 16;
    if (t > 13.9) { g.fillStyle = RED; circ(g, DRV.x + DRV.w - 18, ly, 5); g.fill(); }
    // mast on the top and bottom rails, open carriage frame with gripper fingers
    g.fillStyle = INK;
    g.fillRect(R.x - 7, 14, 14, LW.h - 28);
    g.fillRect(R.x - 22, 6, 44, 18); g.fillRect(R.x - 22, LW.h - 24, 44, 18);
    g.strokeStyle = INK; g.lineWidth = 7; g.strokeRect(R.x - 56, R.y - 23, 112, 46);
    const fo = 50 - R.grip * 8;
    g.fillRect(R.x - fo - 4, R.y - 17, 8, 34); g.fillRect(R.x + fo - 4, R.y - 17, 8, 34);
    if (t < 12.42) {
      cart(g, px, py, PICK.m * 1000 + PICK.c * 50 + PICK.r);
      if (t > 12.26) { g.fillStyle = RED; g.globalAlpha = smooth(12.26, 12.42, t); g.fillRect(px, py, SL.w, SL.h); g.globalAlpha = 1; }
    }
    if (R.held || (t >= 13.86 && R.insert < 1)) {
      const k = R.insert;
      g.save(); g.beginPath(); g.rect(R.x - 60, R.y - 30, 120, 60); g.clip();
      g.fillStyle = RED; g.fillRect(R.x - SL.w / 2, R.y - SL.h / 2 + k * 2, SL.w * (1 - k * .15), SL.h * (1 - k));
      g.restore();
    }
    g.restore();
  }

  // ================= panel 3: 40 TB cartridge + three decades =================
  const TBX = 112, TBY = 516, TBS = 360;
  const CART = { x: 1336, y: 150, w: 400, h: 414 };
  function P3(g, t) {
    // rule first, then the type rises from behind it
    const rp = trap((t - 15.3) / .45);
    let tw = 0;
    font(g, TBS, DISP, 900); g.letterSpacing = '-12px';
    tw = g.measureText('40 TB').width;
    g.fillStyle = INK; g.fillRect(120, TBY + 32, (tw - 8) * rp, 12);
    const up = ease.out(clamp((t - 15.5) / .42));
    if (up > 0) {
      g.save(); g.beginPath(); g.rect(0, 0, W, TBY + 30); g.clip();
      g.fillStyle = INK; g.fillText('40 TB', TBX, TBY + (1 - up) * TBS * .8);
      g.restore();
    }
    g.letterSpacing = '0px';
    // LTO-style cartridge, top view: chamfered leader-pin corner, write-protect tab, insertion arrow
    const c = CART;
    g.fillStyle = INK; g.beginPath();
    g.moveTo(c.x + 18, c.y); g.lineTo(c.x + c.w - 70, c.y); g.lineTo(c.x + c.w, c.y + 70);
    g.lineTo(c.x + c.w, c.y + c.h - 18); g.arcTo(c.x + c.w, c.y + c.h, c.x + c.w - 18, c.y + c.h, 18);
    g.lineTo(c.x + 18, c.y + c.h); g.arcTo(c.x, c.y + c.h, c.x, c.y + c.h - 18, 18);
    g.lineTo(c.x, c.y + 18); g.arcTo(c.x, c.y, c.x + 18, c.y, 18); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(240,239,233,.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(c.x + c.w - 92, c.y + 22); g.lineTo(c.x + c.w - 22, c.y + 92); g.stroke();
    circ(g, c.x + c.w / 2 - 10, c.y + c.h / 2 + 14, 150); g.stroke();
    circ(g, c.x + c.w / 2 - 10, c.y + c.h / 2 + 14, 46); g.stroke();
    g.fillStyle = PAPER_C; g.fillRect(c.x + 34, c.y + c.h - 52, 42, 18);
    g.fillStyle = INK; g.fillRect(c.x + 38, c.y + c.h - 48, 16, 10);
    g.fillStyle = RED; g.beginPath();
    g.moveTo(c.x + 50, c.y + 40); g.lineTo(c.x + 92, c.y + 40); g.lineTo(c.x + 71, c.y + 76); g.closePath(); g.fill();
    // thirty one-year cells in three decades, filled at constant speed
    const by = 676, bh = 36, gap = 6, dg = 34, sw = (1680 - 27 * gap - 2 * dg) / 30;
    const f0 = 16.05, dt = .108;
    for (let j = 0; j < 30; j++) {
      const x = 120 + j * (sw + gap) + Math.floor(j / 10) * dg;
      const k = clamp((t - f0) / dt - j);
      g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x + 1, by + 1, sw - 2, bh - 2);
      if (k > 0) { g.fillStyle = RED; g.fillRect(x, by, sw * k, bh); }
      if (j % 10 === 0) { g.fillStyle = INK; g.fillRect(x, by + bh + 8, 3, 18); }
    }
    g.fillStyle = INK; g.fillRect(1797, by + bh + 8, 3, 18);
  }

  // ================= panel 4: proven years | estimates =================
  const PROVEN = SCRIPT.chapters.filter(c => c.n && c.n < ch.n && c.meter && c.meter.unit === '年')
    .map(c => +String(c.meter.value).replace(/[^0-9]/g, ''));
  const RX = 1240, BY0 = 176, BP = 78, BH = 18, SC = 1060 / Math.max(...PROVEN);
  function P4(g, t) {
    const rh = trap((t - 20.18) / .34);
    g.fillStyle = INK; g.fillRect(RX - 4, 130, 8, 680 * rh);
    PROVEN.forEach((yrs, i) => {
      const k = trap((t - 20.5 - i * .13) / .5);
      if (k <= 0) return;
      const L = yrs * SC * k;
      g.fillStyle = GREY; g.fillRect(RX - 12 - L, BY0 + i * BP, L, BH);
    });
    // the estimate: same row height, dashed, red, no end
    const y = BY0 + PROVEN.length * BP, x0 = RX + 12, reach = 560 * trap((t - 21.75) / 1.4, .1);
    g.fillStyle = RED;
    for (let x = x0; x < x0 + reach; x += 44) {
      const w = Math.min(30, x0 + reach - x);
      g.globalAlpha = 1 - smooth(x0 + 220, x0 + 560, x);
      g.fillRect(x, y, w, BH);
    }
    g.globalAlpha = 1;
  }

  const PANELS = [P0, P1, P2, P3, P4];

  // revealText() places each glyph by its left edge, but subs() leaves textAlign at 'center', which shifts every
  // glyph by half its own width and jams narrow Latin letters ("UNIVAC I"). Keep the alignment left for subs.
  function leftAligned(ctx) {
    return new Proxy(ctx, {
      get(o, k) { const v = o[k]; return typeof v === 'function' ? v.bind(o) : v; },
      set(o, k, v) { o[k] = k === 'textAlign' ? 'left' : v; return true; },
    });
  }

  // ---------- incoming transition: the blueprint is squeezed into a strip on the tape path and wound away ----------
  // It leaves to the right, the way the deck's tape travels (supply reel left → head → take-up reel right),
  // with a red splice on its tail.
  TRANS.tape_slide = (ctx, A, B, p) => {
    ctx.drawImage(B, 0, 0);
    const sq = ease.inOut(clamp(p / .58));
    const h = lerp(H, 40, sq), yc = lerp(H / 2, TY, sq);
    const x = (W + 60) * trap(clamp((p - .36) / .64), .35);
    ctx.drawImage(A, 0, 0, W, H, x, yc - h / 2, W, h);
    ctx.fillStyle = INK; ctx.fillRect(x, yc - h / 2 - 2, W, 2); ctx.fillRect(x, yc + h / 2, W, 2);
    ctx.fillStyle = RED; ctx.fillRect(x - 10, yc - h / 2 - 2, 10, h + 4);
  };

  // ---------- paper ----------
  let paper;
  const PAPER = `void main(){ vec2 px=uv*R;
    float f=vn(px*vec2(.9,.35))*.6+vn(px*.18)*.4;
    float m=fbm3(px*.0025+4.);
    vec3 col=vec3(.941,.937,.914)*(.99+.025*(f-.5))*(1.-.025*smoothstep(.45,.85,m));
    O=vec4(col,1.); }`;

  // cue times computed from the drawing itself
  const BLIPS = [];
  for (let j = 1; j < 40 && BLIPS.length < 6; j++) {
    const tj = TE + j * CW / VM;
    if (tj > 6.4) break;
    if (DIR(j) !== DIR(j - 1)) BLIPS.push(+tj.toFixed(2));
  }

  scene({
    id: 'tape', n: ch.n, dur: ch.dur,
    trans: { type: 'tape_slide', d: 1.1 },
    cues: [
      { t: .3, sfx: 'tape' }, { t: 2.95, sfx: 'shutter', v: .6 }, { t: 3.9, sfx: 'click' },
      ...BLIPS.map(x => ({ t: x, sfx: 'blip', v: .7 })),
      { t: 6.6, sfx: 'tape', v: .8 },
      ...[0, 1, 2, 3].map(i => ({ t: +(7.55 + i * .2).toFixed(2), sfx: 'relay' })),
      { t: 7.2, sfx: 'spin', v: .6 },
      { t: 11.38, sfx: 'seek' }, { t: 12.4, sfx: 'click' }, { t: 13.9, sfx: 'click' },
      { t: 15.9, sfx: 'press' }, { t: 19.29, sfx: 'tick', v: .6 },
      { t: 19.62, sfx: 'whoosh' }, { t: 20.5, sfx: 'click' }, { t: 21.8, sfx: 'blip', v: .5 },
    ],
    init() {
      paper = GL.bake(PAPER, W, H);
      const m = makeCanvas(8, 8).getContext('2d'); font(m, YS, DISP, 900);
      let x = YX; yearCols = [...YEAR].map(c => { const w = m.measureText(c).width; const col = { x, w, d: +c }; x += w - 10; return col; });
    },
    draw(ctx, t) {
      ctx.drawImage(paper, 0, 0);
      const pos = stripPos(t);
      for (let i = 0; i < PANELS.length; i++) {
        if (Math.abs(i - pos) >= 1.2) continue;
        const ox = (i - pos) * PW;
        const xl = ox - PG / 2, xr = ox + W + PG / 2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xl - SK * H / 2, 0); ctx.lineTo(xr - SK * H / 2, 0); ctx.lineTo(xr + SK * H / 2, H); ctx.lineTo(xl + SK * H / 2, H);
        ctx.closePath(); ctx.clip();
        ctx.translate(ox, 0);
        PANELS[i](ctx, t);
        ctx.restore();
        // the diagonal splice between two panels
        if (i > 0 && xl > -400 && xl < W + 400) {
          ctx.strokeStyle = RED; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(xl - SK * H / 2, 0); ctx.lineTo(xl + SK * H / 2, H); ctx.stroke();
        }
      }
      opener(ctx, t, ch, {
        ink: INK, sub: '#3B3A37', accent: RED, x: 120, y: 430, align: 'left', inAt: .55, outAt: 2.5,
        title: { family: SANS, size: 210, weight: 700, sp: 8 },
        small: { family: SANS, size: 30, weight: 400 },
        num: { family: DISP, size: 76, weight: 900 },
        backdrop: (g, b, al) => { g.fillStyle = rgba(RED, al); g.fillRect(124, 196, 96 * ease.out(clamp((t - .55) / .5)), 14); },
      });
      subs(leftAligned(ctx), t, ch, { ink: INK, body: { family: SANS, size: 52, weight: 400 }, y: 1000 });
      grain(ctx, t, .03);
    },
  });
})();
