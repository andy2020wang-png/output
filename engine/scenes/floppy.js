// 10 软盘 — MS-DOS / VGA. A 320×180 picture plane scaled ×6 and ordered-dithered (4×4 Bayer) to the 16-colour
// VGA palette, a 640×360 text plane set in the WenQuanYi bitmap strikes (12 px terminal, 1-bit), a 480×270
// subtitle plane (13 px strike ×4 = 52 px, in a black DOS bar), then a CRT pass (curvature, scanlines, aperture
// mask, phosphor bloom). The terminal is cleared (CLS) between beats so it only ever shows the current command.
// Beats: 3.5" disk + FORMAT A: → COPY a phone photo, disk fills, Insufficient disk space, the disk flattens into
// the Save icon → drive bay goes dark, Not ready reading drive A → calendar flips to 2024, a stamp lands.
'use strict';
(() => {
  const ch = CH('floppy');
  const PAL = ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
    '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'];
  const [BLK, BLU, GRN, CYN, RED, MAG, BRN, LGY, DGY, LBL, LGR, LCY, LRD, LMG, YEL, WHT] = PAL;
  const AW = 320, AH = 180, TW = 640, TH = 360, TAU = Math.PI * 2;
  const PIX = '"WenQuanYi Zen Hei Sharp"';
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const PR = new Uint8Array(16), PG = new Uint8Array(16), PB = new Uint8Array(16);
  PAL.forEach((h, i) => { const n = parseInt(h.slice(1), 16); PR[i] = n >> 16 & 255; PG[i] = n >> 8 & 255; PB[i] = n & 255; });

  // ---------- timeline (local seconds) ----------
  const DROP = [.04, .5];
  const CPY = { move: [5.95, 6.4], run: [6.7, 7.7], err: 7.75, drain: [8.05, 8.25] };
  const ICO = { move: [8.3, 8.85], plate: [8.4, 8.7], morph: [8.5, 9.1], cur: [9.0, 9.35], click: 9.42 };
  const BAYT = { in: [10.55, 10.95], dark: [11.5, 12.3], retry: 13.3 };
  const CAL = { term: [14.95, 15.22], in: [15.12, 15.45], flip: [15.45, 16.95], full: [16.95, 17.2], stamp: [17.22, 17.45] };

  // ---------- terminal (text that belongs to the medium: real MS-DOS wording) ----------
  const P = 'C:\\>';
  const TERM = [
    { t: 0, s: P, cmd: 'FORMAT A:', t1: 3.45, d: .42 },
    { t: 3.95, s: 'Insert new diskette for drive A:' },
    { t: 3.98, s: 'and press ENTER when ready...' },
    { t: 4.02, s: '' },
    { t: 4.04, s: 'Formatting 1.44M' },
    { t: 4.08, fn: t => t < 4.72 ? String(Math.min(100, Math.floor((t - 4.08) / .6 * 100))).padStart(3) + ' percent completed.' : 'Format complete.' },
    { t: 4.8, s: '' },
    { t: 4.86, s: '    1,457,664 bytes total disk space', c: YEL },
    { t: 4.92, s: '    1,457,664 bytes available on disk' },
    { t: 5.0, s: '' },
    { t: 5.02, s: P },
    // CLS between beats: the screen only ever holds the one command the current card is about
    { t: 5.82, cls: 1 },
    { t: 5.82, s: P, cmd: 'COPY IMG_0001.JPG A:', t1: 6.0, d: .55 },
    { t: 7.75, s: 'Insufficient disk space', c: LRD },
    { t: 7.82, s: '        0 file(s) copied' },
    { t: 7.9, s: '' },
    { t: 7.92, s: P },
    { t: 10.6, cls: 1 },
    { t: 10.6, s: P, cmd: 'DIR A:', t1: 10.9, d: .3 },
    { t: 12.42, s: '' },
    { t: 12.5, s: 'Not ready reading drive A', c: LRD },
    { t: 12.58, s: 'Abort, Retry, Fail?', cmd: 'r', t1: 13.3, d: .04 },
    { t: 13.52, s: '' },
    { t: 13.6, s: 'Not ready reading drive A', c: LRD },
    { t: 13.68, s: 'Abort, Retry, Fail?' },
  ];
  const TB = { x0: 168, y0: 18, x1: 306, y1: 108 };   // terminal window, picture-plane pixels (11 text rows)
  const LH = 14, MAXL = Math.floor((2 * (TB.y1 - TB.y0) - 20) / LH);

  // ---------- pixel fonts (5×7 and 3×5) ----------
  const F57 = ['01110100011001110101110011000101110', '00100011000010000100001000010001110', '01110100010000100010001000100011111',
    '11111000100010000010000011000101110', '00010001100101010010111110001000010', '11111100001111000001000011000101110',
    '00110010001000011110100011000101110', '11111000010001000100010000100001000', '01110100011000101110100011000101110',
    '01110100011000101111000010001001100'];
  const F35 = ['111101101101111', '010110010010111', '111001111100111', '111001011001111', '101101111001001',
    '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
  function pnum(g, s, x, y, F, cw, chh, ps, c, gap) {
    g.fillStyle = c;
    for (const d of s) {
      const b = F[+d];
      for (let r = 0; r < chh; r++) for (let q = 0; q < cw; q++) if (b[r * cw + q] === '1') g.fillRect(x + q * ps, y + r * ps, ps, ps);
      x += (cw + gap) * ps;
    }
  }

  const ARROW = ['X', 'XX', 'XWX', 'XWWX', 'XWWWX', 'XWWWWX', 'XWWWWWX', 'XWWWWWWX', 'XWWWWWWWX', 'XWWWWWWWWX', 'XWWWWWXXXXX',
    'XWWXWWX', 'XWX XWWX', 'XX  XWWX', 'X    XWWX', '     XWWX', '      XX'];

  let LUT, art, ag, tl, tg, PX, sl, sg4, PXS, sa, sga, sb, sgb, dk, dg, phoneC, pageC, pgg, stampC, PAT;

  // ---------- helpers ----------
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  function poly(g, pts, c) { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function mixHex(a, b, m) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const c = s => Math.round(lerp(x >> s & 255, y >> s & 255, m));
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  }
  function bevelIn(g, x, y, w, h, face = LGY) { R(g, x, y, w, h, face); R(g, x, y, w, 1, DGY); R(g, x, y, 1, h, DGY); R(g, x, y + h - 1, w, 1, WHT); R(g, x + w - 1, y, 1, h, WHT); }
  function bevelOut(g, x, y, w, h, face = LGY) { R(g, x, y, w, h, face); R(g, x, y, w, 1, WHT); R(g, x, y, 1, h, WHT); R(g, x, y + h - 1, w, 1, DGY); R(g, x + w - 1, y, 1, h, DGY); }

  // Draw on a low-res text plane with 1080p coordinates (so opener()/subs() keep the shared layout) while
  // glyphs land on whole pixels at the bitmap strike sizes (×3 plane: 36→12 px; ×4 plane: 52→13 px).
  // The strike's space is half an em, which reads as a missing character between 汉字 and Latin; set it a quarter em.
  function scaled(g, k) {
    const mw = (o, s) => {
      const n = (s.match(/ /g) || []).length;
      if (!n) return o.measureText(s).width;
      return o.measureText(s.replace(/ /g, '')).width + n * Math.max(2, Math.round(o.measureText('中').width / 4));
    };
    return new Proxy(g, {
      get(o, p) {
        if (p === 'fillText') return (s, x, y) => o.fillText(s, Math.round(x / k), Math.round(y / k));
        if (p === 'measureText') return s => ({ width: mw(o, s) * k });
        if (p === 'fillRect') return (x, y, w, h) => o.fillRect(x / k, y / k, w / k, h / k);
        const v = o[p]; return typeof v === 'function' ? v.bind(o) : v;
      },
      set(o, p, v) {
        if (p === 'font') v = String(v).replace(/([\d.]+)px/, (_, n) => Math.round(+n / k) + 'px');
        else if (p === 'shadowBlur') v = v / k;
        o[p] = v; return true;
      },
    });
  }

  // ordered dither of the picture plane to the 16 VGA colours
  function quantArt() {
    const id = ag.getImageData(0, 0, AW, AH), d = id.data;
    for (let y = 0, i = 0; y < AH; y++) for (let x = 0; x < AW; x++, i += 4) {
      const o = (BAY[(y & 3) << 2 | (x & 3)] - 7.5) * 5;
      const r = clamp(d[i] + o, 0, 255), g = clamp(d[i + 1] + o, 0, 255), b = clamp(d[i + 2] + o, 0, 255);
      const k = LUT[(r >> 3) << 10 | (g >> 3) << 5 | (b >> 3)];
      d[i] = PR[k]; d[i + 1] = PG[k]; d[i + 2] = PB[k]; d[i + 3] = 255;
    }
    ag.putImageData(id, 0, 0);
  }
  // text planes: 1-bit alpha (fades become a Bayer dissolve), colours snapped to the palette
  function quantText(g, w, h) {
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
      const a = d[i + 3]; if (!a) continue;
      if (a < BAY[(y & 3) << 2 | (x & 3)] * 16 + 8) { d[i + 3] = 0; continue; }
      const k = LUT[(d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3)];
      d[i] = PR[k]; d[i + 1] = PG[k]; d[i + 2] = PB[k]; d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  }
  // Bayer dissolve between two picture states
  function dissolve(g, fa, fb, t, p) {
    const lv = Math.round(clamp(p) * 16);
    if (lv <= 0) return fa(g, t);
    if (lv >= 16) return fb(g, t);
    sga.clearRect(0, 0, AW, AH); fa(sga, t);
    sga.save(); sga.globalCompositeOperation = 'destination-in'; sga.fillStyle = PAT.a[lv]; sga.fillRect(0, 0, AW, AH); sga.restore();
    sgb.clearRect(0, 0, AW, AH); fb(sgb, t);
    sgb.save(); sgb.globalCompositeOperation = 'destination-in'; sgb.fillStyle = PAT.b[lv]; sgb.fillRect(0, 0, AW, AH); sgb.restore();
    g.drawImage(sa, 0, 0); g.drawImage(sb, 0, 0);
  }

  // ---------- the 3.5-inch disk (front, label side), 86×90 px, drawn into a sprite ----------
  const DW = 86, DH = 90;
  function diskSprite(sh, spin, m) {
    const g = dg; g.clearRect(0, 0, 90, 94);
    const body = mixHex(DGY, BLU, m), edge = mixHex(BLK, BLU, m), fade = 1 - m;
    poly(g, [[0, 0], [DW - 6, 0], [DW, 6], [DW, DH], [0, DH]], edge);
    poly(g, [[1, 1], [DW - 6.5, 1], [DW - 1, 6.5], [DW - 1, DH - 1], [1, DH - 1]], body);
    if (fade > 0) {
      g.globalAlpha = fade;
      R(g, 1, 1, DW - 8, 1, LGY); R(g, 1, 1, 1, DH - 2, LGY);
      R(g, 2, DH - 2, DW - 3, 1, BLK); R(g, DW - 2, 7, 1, DH - 9, BLK);
      poly(g, [[6, 12], [10, 7], [14, 12]], BLK);                             // moulded insertion arrow
      R(g, 3, 79, 6, 8, BLK); R(g, 4, 80, 4, 3, DGY);                          // write-protect window + slider
      R(g, 78, 79, 6, 8, BLK);                                                // HD hole
      g.globalAlpha = 1;
    }
    // shutter recess and the case window under it
    R(g, 20, 1, 58, 33, body);
    if (fade > 0) { g.globalAlpha = fade; R(g, 20, 1, 1, 33, BLK); R(g, 20, 33, 58, 1, LGY); R(g, 77, 1, 1, 33, LGY); g.globalAlpha = 1; }
    if (sh > 0) {
      R(g, 42, 6, 10, 21, BRN);
      for (let y = 6; y < 27; y++) for (let x = 42; x < 52; x++) {
        const v = hash2(x * 3 + Math.floor(spin), y >> 1) * .6 + hash2(Math.floor((x + spin) * .5), 9) * .4;
        if (v < .38) R(g, x, y, 1, 1, '#5a2c00'); else if (v > .86) R(g, x, y, 1, 1, '#d08040');
      }
      R(g, 42, 6, 10, 1, BLK);
    }
    // metal shutter with its slot (slot aligns with the window when open)
    const sx = Math.round(23 + 14 * sh), shc = LGY;
    R(g, sx, 0, 5, 33, shc); R(g, sx + 15, 0, 21, 33, shc); R(g, sx + 5, 0, 10, 6, shc); R(g, sx + 5, 27, 10, 6, shc);
    if (fade > 0) {
      g.globalAlpha = fade;
      R(g, sx, 0, 36, 1, WHT); R(g, sx, 0, 1, 33, WHT); R(g, sx + 35, 0, 1, 33, DGY); R(g, sx, 32, 36, 1, DGY);
      R(g, sx + 5, 6, 10, 1, DGY); R(g, sx + 5, 6, 1, 21, DGY);
      R(g, sx + 22, 10, 9, 1, DGY); R(g, sx + 22, 10, 1, 14, DGY); R(g, sx + 22, 23, 9, 1, WHT); R(g, sx + 30, 10, 1, 14, WHT);
      g.globalAlpha = 1;
    }
    // label
    R(g, 9, 40, 68, 47, WHT);
    if (fade > 0) {
      g.globalAlpha = fade;
      R(g, 9, 40, 68, 5, LBL);
      for (let i = 0; i < 4; i++) R(g, 13, 54 + i * 8, 60, 1, LGY);
      R(g, 9, 86, 68, 1, LGY); R(g, 76, 40, 1, 47, LGY);
      g.strokeStyle = BLU; g.lineWidth = 1; g.beginPath();                    // pen scribble on the first line
      const sc = [[15, 52], [17, 48], [18, 52], [20, 49], [22, 52], [24, 48], [25, 51], [28, 50], [31, 52], [32, 48], [34, 52],
        [38, 51], [40, 48], [41, 52], [44, 50], [47, 52], [49, 49], [51, 52]];
      sc.forEach(([x, y], i) => i ? g.lineTo(x + .5, y + .5) : g.moveTo(x + .5, y + .5)); g.stroke();
      g.globalAlpha = 1;
    }
  }
  function blitDisk(g, x, y, s, shadow = .5) {
    if (shadow) R(g, Math.round(x + 4 * s), Math.round(y + 5 * s), Math.round(DW * s), Math.round(DH * s), `rgba(0,0,0,${shadow})`);
    g.drawImage(dk, 0, 0, DW + 1, DH + 1, Math.round(x), Math.round(y), Math.round((DW + 1) * s), Math.round((DH + 1) * s));
  }

  // ---------- phone with a photo ----------
  function paintPhoto(p, w, h) {
    let gr = p.createLinearGradient(0, 0, 0, 30); gr.addColorStop(0, LBL); gr.addColorStop(1, LCY);
    p.fillStyle = gr; p.fillRect(0, 0, w, 30);
    p.fillStyle = YEL; p.beginPath(); p.arc(21.5, 10.5, 4.6, 0, TAU); p.fill();
    p.fillStyle = WHT; p.beginPath(); p.arc(21.5, 10.5, 2.2, 0, TAU); p.fill();
    poly(p, [[0, 27], [6, 19], [11, 24], [17, 15], [24, 24], [30, 19], [30, 31], [0, 31]], LGY);
    poly(p, [[14.5, 18.5], [17, 15], [19.5, 18.5], [17, 17.5]], WHT); poly(p, [[4.5, 21], [6, 19], [7.5, 21]], WHT);
    poly(p, [[0, 33], [8, 26], [15, 31], [23, 25], [30, 29], [30, 36], [0, 36]], GRN);
    poly(p, [[8, 26], [15, 31], [11, 36], [4, 36]], 'rgb(0,80,0)');
    R(p, 0, 36, w, 8, BLU); R(p, 3, 38, 9, 1, CYN); R(p, 17, 40, 10, 1, CYN); R(p, 20, 37, 4, 1, WHT); R(p, 6, 42, 6, 1, CYN);
    gr = p.createLinearGradient(0, 44, 0, h); gr.addColorStop(0, LGR); gr.addColorStop(1, GRN);
    p.fillStyle = gr; p.fillRect(0, 44, w, h - 44);
    poly(p, [[12, h], [19, h], [16.5, 50], [15.4, 44], [14.8, 44], [14, 50]], BRN);
    poly(p, [[1, 53], [5.5, 38], [10, 53]], 'rgb(0,70,0)'); R(p, 5, 53, 2, 4, BRN);
    const r = mulberry(77);
    for (let i = 0; i < 14; i++) R(p, Math.floor(r() * w), 46 + Math.floor(r() * (h - 47)), 1, 1, [YEL, LRD, LMG, WHT][i % 4]);
  }

  // ---------- calendar page (June 2024 when full) ----------
  const PGW = 102, PGH = 114;
  function calPage(g, year, full) {
    g.clearRect(0, 0, PGW, PGH);
    R(g, 0, 0, PGW, PGH, WHT);
    pnum(g, String(year), 28, 6, F57, 5, 7, 2, BLK, 1);
    R(g, 10, 25, PGW - 20, 1, LGY);
    if (full <= 0) { for (let r = 0; r < 6; r++) R(g, 8, 52 + r * 11, PGW - 16, 1, '#e4e4e4'); return; }
    g.globalAlpha = full;
    g.font = `12px ${PIX}`; g.fillStyle = BLK; g.textAlign = 'center'; g.fillText('6月', 51, 42); g.textAlign = 'left';
    for (let c = 0; c < 7; c++) R(g, 9 + c * 13, 46, 7, 1, c === 0 ? RED : c === 6 ? BLU : LGY);
    for (let d = 1; d <= 30; d++) {
      const idx = d + 5, c = idx % 7, row = Math.floor(idx / 7), s = String(d), w = s.length * 4 - 1;
      pnum(g, s, 9 + c * 13 + 7 - w, 50 + row * 11, F35, 3, 5, 1, c === 0 ? RED : c === 6 ? BLU : DGY, 1);
    }
    g.globalAlpha = 1;
  }

  // ---------- picture states ----------
  function stageA(g, t) {                       // disk → photo copy → Save icon
    const k1 = ease.inOut(inv(CPY.move[0], CPY.move[1], t)), k2 = ease.inOut(inv(ICO.move[0], ICO.move[1], t));
    const s2 = .78;
    let x = lerp(41, 98, k1), y = lerp(30, 24, k1), s = lerp(1, .62, k1);
    x = lerp(x, 84 - DW / 2 * s2, k2); y = lerp(y, 70 - DH / 2 * s2, k2); s = lerp(s, s2, k2);
    if (t < DROP[1] + .3) y -= (1 - ease.outBack(clamp((t - DROP[0]) / (DROP[1] - DROP[0])))) * 140;
    const sh = Math.max(win(t, 3.95, 5.15, .2, .15), win(t, 6.45, 8.2, .15, .15));
    const spin = (t > 4.0 && t < 4.8) || (t > 6.7 && t < CPY.err) ? t * 37 : 0;
    const m = ease.inOut(inv(ICO.morph[0], ICO.morph[1], t));
    // modern toolbar button behind the icon
    const pa = inv(ICO.plate[0], ICO.plate[1], t), pressed = t >= ICO.click && t < ICO.click + .14;
    if (pa > 0) {
      g.save(); g.globalAlpha = pa;
      g.fillStyle = 'rgba(0,0,0,.45)'; rr(g, 45, 34, 84, 84, 12); g.fill();
      g.fillStyle = pressed ? '#9c9c9c' : LGY; rr(g, 42, 30, 84, 84, 12); g.fill();
      const rp = inv(ICO.click, ICO.click + .36, t);
      if (rp > 0 && rp < 1) {
        rr(g, 42, 30, 84, 84, 12); g.clip();
        g.globalAlpha = .85 * (1 - rp); g.fillStyle = WHT; g.beginPath(); g.arc(104, 92, 6 + ease.out(rp) * 76, 0, TAU); g.fill();
      }
      g.restore();
    }
    diskSprite(sh, spin, m);
    blitDisk(g, x + (pressed ? 1 : 0), y + (pressed ? 1 : 0), s, .5 * (1 - pa));
    // phone + copy
    const pha = win(t, 6.05, 8.55, .35, .3);
    if (pha > 0) {
      const px = 20, py = 30;
      g.save(); g.globalAlpha = pha;
      g.drawImage(phoneC, px, py);
      const f = inv(CPY.run[0], CPY.run[1], t), err = t >= CPY.err;
      if (f > 0) {
        const row = Math.floor(f * .34 * 58);
        const blink = err && Math.floor((t - CPY.err) * 8) % 2 === 0;
        R(g, px + 3, py + 6 + row, 30, 1, err ? (blink ? LRD : RED) : WHT);
        R(g, px - 3, py + 6, 2, row + 1, err ? RED : LGR);                         // the part that made it across
      }
      // data in flight: photo pixels arc into the disk window
      if (t > CPY.run[0] && t < CPY.err) {
        const wx = x + 47 * s, wy = y + 16 * s;
        const NP = 34, RATE = 2.4;
        for (let k = 0; k < NP; k++) {
          const ph = (t * RATE + k / NP) % 1, te = t - ph / RATE, gen = Math.floor(t * RATE + k / NP);
          if (te < CPY.run[0] || te > CPY.run[1]) continue;
          const sx = px + 4 + hash2(k, gen) * 28, sy = py + 6 + inv(CPY.run[0], CPY.run[1], te) * .34 * 58;
          const cx = lerp(sx, wx, .5), cy = Math.min(sy, wy) - 24 - hash2(gen, k) * 10;
          const col = [YEL, LCY, LGR, WHT, LBL, LRD][(k + gen) % 6];
          for (const [lag, sz] of [[.07, 1], [0, 2]]) {
            const e = ease.inOut(clamp(ph - lag));
            const bx = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * wx, by = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * wy;
            R(g, Math.round(bx), Math.round(by), sz, sz, col);
          }
        }
      }
      // disk capacity gauge
      const gx = Math.round(98), gy = 86;
      R(g, gx, gy, 56, 8, BLK); R(g, gx, gy, 56, 1, LGY); R(g, gx, gy + 7, 56, 1, LGY); R(g, gx, gy, 1, 8, LGY); R(g, gx + 55, gy, 1, 8, LGY);
      let n = Math.floor(clamp(f / .97) * 13);
      if (t > CPY.drain[0]) n = Math.round(13 * (1 - inv(CPY.drain[0], CPY.drain[1], t)));
      const col = err ? (Math.floor((t - CPY.err) * 8) % 2 === 0 ? LRD : RED) : LGR;
      for (let i = 0; i < n; i++) R(g, gx + 3 + i * 4, gy + 2, 3, 4, col);
      g.restore();
    }
    // mouse pointer clicks the Save button
    const cp = ease.out(inv(ICO.cur[0], ICO.cur[1], t));
    if (cp > 0 && t < BAYT.in[1]) {
      const ax = Math.round(lerp(160, 102, cp)) + (pressed ? 1 : 0), ay = Math.round(lerp(150, 90, cp)) + (pressed ? 1 : 0);
      ARROW.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== ' ') R(g, ax + i, ay + j, 1, 1, row[i] === 'X' ? BLK : WHT); });
    }
  }

  function stageB(g, t) {                       // PC front: the 3.5" bay goes dark; the disk stays intact
    const X = 12, Y = 8, Wd = 144, Ht = 74;
    R(g, X + 4, Y + 5, Wd, Ht, 'rgba(0,0,0,.5)');
    R(g, X - 1, Y - 1, Wd + 2, Ht + 2, BLK);
    bevelOut(g, X, Y, Wd, Ht);
    R(g, X, Y + 50, Wd, 1, DGY); R(g, X, Y + 51, Wd, 1, WHT);                    // panel seam
    // 3.5" floppy drive: slot with flap, busy lamp, eject button
    const bx = X + 14, by = Y + 12, bw = 116, bh = 30;
    bevelIn(g, bx - 2, by - 2, bw + 4, bh + 4, DGY);
    bevelOut(g, bx, by, bw, bh);
    R(g, bx + 12, by + 9, 84, 5, BLK); R(g, bx + 12, by + 10, 84, 1, DGY); R(g, bx + 12, by + 14, 84, 1, WHT);
    R(g, bx + 12, by + 21, 6, 2, '#1f5f1f');
    bevelOut(g, bx + 86, by + 19, 18, 6);
    const dkp = ease.inOut(inv(BAYT.dark[0], BAYT.dark[1], t));
    if (dkp > 0) { g.globalAlpha = dkp; R(g, bx - 2, by - 2, bw + 4, bh + 4, BLK); g.globalAlpha = 1; }
    // power switch, lamp, vents
    bevelOut(g, X + 118, Y + 57, 16, 11);
    R(g, X + 108, Y + 61, 4, 3, LGR);
    for (let i = 0; i < 6; i++) R(g, X + 12 + i * 12, Y + 61, 8, 1, DGY), R(g, X + 12 + i * 12, Y + 65, 8, 1, DGY);
    // the intact disk under the bay
    const s = .52; const dx = 84 - DW / 2 * s; let dy = 86;   // clear of the 2-line subtitle bar
    const tr = t - BAYT.retry; if (tr > 0 && tr < .4) dy -= Math.round(Math.sin(tr / .4 * Math.PI) * 5);
    diskSprite(0, 0, 0);
    blitDisk(g, dx, dy, s);
  }

  function stageC(g, t) {                       // calendar flips to 2024; a stamp lands on the disk
    const sk = t > CAL.stamp[1] && t < CAL.stamp[1] + .16 ? Math.round(Math.sin((t - CAL.stamp[1]) * 120) * 1.4) : 0;
    g.save(); g.translate(0, sk);
    const CX = 66, CY = 8;                        // page + shadow end above the subtitle bar
    R(g, CX + 4, CY + 6, PGW + 4, PGH + 8, 'rgba(0,0,0,.5)');
    R(g, CX - 1, CY + 3, PGW + 4, PGH + 6, BLK);
    R(g, CX, CY + 4, PGW + 2, PGH + 4, LGY);                                   // the stack of pages behind
    R(g, CX, CY + PGH + 6, PGW + 2, 1, DGY);
    const u = ease.out(inv(CAL.flip[0], CAL.flip[1], t));
    const yf = 1996 + u * 28, cur = Math.min(2024, Math.floor(yf)), fr = yf - Math.floor(yf);
    const full = inv(CAL.full[0], CAL.full[1], t);
    calPage(pgg, cur < 2024 ? cur + 1 : 2024, cur < 2024 ? 0 : full);
    g.drawImage(pageC, CX, CY + 6);
    if (cur < 2024) {
      calPage(pgg, cur, 0);
      const h = Math.max(1, Math.round(PGH * Math.cos(fr * Math.PI / 2)));
      g.drawImage(pageC, 0, 0, PGW, PGH, CX, CY + 6, PGW, h);
      g.globalAlpha = .45 * fr; R(g, CX, CY + 6, PGW, h, BLK); g.globalAlpha = 1;
      R(g, CX, CY + 6 + h, PGW, 1, DGY);
    }
    // binding with rings
    R(g, CX - 2, CY, PGW + 6, 7, BLK); R(g, CX - 1, CY + 1, PGW + 4, 5, DGY);
    for (let i = 0; i < 11; i++) { const rx = CX + 6 + i * 9; R(g, rx, CY - 2, 2, 10, LGY); R(g, rx, CY - 2, 1, 10, WHT); }
    // the disk, and the stamp on its label
    const s = .8, dx = 182, dy = 36;
    diskSprite(0, 0, 0);
    blitDisk(g, dx, dy, s);
    const sp = inv(CAL.stamp[0], CAL.stamp[1], t);
    if (sp > 0) {
      const sc = lerp(2.4, 1, ease.in(sp));
      g.save(); g.globalAlpha = t < CAL.stamp[1] ? .55 + .45 * sp : 1;
      g.translate(Math.round(dx + 43 * s), Math.round(dy + 60 * s)); g.scale(sc, sc);
      g.drawImage(stampC, -29, -29);
      g.restore();
    }
    g.restore();
  }

  function picture(g, t) {
    if (t < BAYT.in[0]) return stageA(g, t);
    if (t < BAYT.in[1]) return dissolve(g, stageA, stageB, t, inv(BAYT.in[0], BAYT.in[1], t));
    if (t < CAL.in[0]) return stageB(g, t);
    if (t < CAL.in[1]) return dissolve(g, stageB, stageC, t, inv(CAL.in[0], CAL.in[1], t));
    return stageC(g, t);
  }

  function background(g, t) {
    R(g, 0, 0, AW, AH, BLU);
    const gr = g.createLinearGradient(0, 0, 0, AH);
    gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(.28, 'rgba(0,0,0,0)'); gr.addColorStop(.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
    g.fillStyle = gr; g.fillRect(0, 0, AW, AH);
    const k = ease.inOut(inv(CAL.in[0], CAL.in[1] + .2, t)), cx = lerp(86, 158, k), cy = lerp(70, 74, k);
    const sp = g.createRadialGradient(cx, cy, 6, cx, cy, lerp(96, 120, k));
    sp.addColorStop(0, 'rgba(85,85,255,.36)'); sp.addColorStop(.55, 'rgba(85,85,255,.13)'); sp.addColorStop(1, 'rgba(85,85,255,0)');
    g.fillStyle = sp; g.fillRect(0, 0, AW, AH);
  }

  function termRect(t) {
    const s = 1 - ease.in(inv(CAL.term[0], CAL.term[1], t));
    const cx = (TB.x0 + TB.x1) / 2, cy = (TB.y0 + TB.y1) / 2, hw = (TB.x1 - TB.x0) / 2 * s, hh = (TB.y1 - TB.y0) / 2 * s;
    return s <= .02 ? null : [Math.round(cx - hw), Math.round(cy - hh), Math.round(cx + hw), Math.round(cy + hh)];
  }
  function terminal(t) {
    const r = termRect(t); if (!r) return;
    const [x0, y0, x1, y1] = r;
    R(ag, x0, y0, x1 - x0, y1 - y0, BLK);
    // double-line frame on the text plane
    const X0 = x0 * 2, Y0 = y0 * 2, X1 = x1 * 2, Y1 = y1 * 2;
    tg.fillStyle = LGY;
    for (const k of [3, 5]) { tg.fillRect(X0 + k, Y0 + k, X1 - X0 - 2 * k, 1); tg.fillRect(X0 + k, Y1 - k - 1, X1 - X0 - 2 * k, 1); tg.fillRect(X0 + k, Y0 + k, 1, Y1 - Y0 - 2 * k); tg.fillRect(X1 - k - 1, Y0 + k, 1, Y1 - Y0 - 2 * k); }
    if (t >= CAL.term[0]) return;
    const lines = [];
    for (const L of TERM) {
      if (t < L.t) break;
      if (L.cls) { lines.length = 0; continue; }
      let s = L.fn ? L.fn(t) : L.s;
      if (L.cmd) s += L.cmd.slice(0, Math.floor(clamp((t - L.t1) / L.d) * L.cmd.length));
      lines.push([s, L.c || LGY]);
    }
    const vis = lines.slice(-MAXL);
    tg.font = `12px ${PIX}`; tg.textBaseline = 'alphabetic';
    const tx = TB.x0 * 2 + 11, ty = TB.y0 * 2 + 21;
    vis.forEach(([s, c], i) => { tg.fillStyle = c; tg.fillText(s, tx, ty + i * LH); });
    if (Math.floor(t * 3.6) % 2 === 0) {
      const last = vis[vis.length - 1];
      tg.fillStyle = LGY; tg.fillRect(tx + Math.round(tg.measureText(last[0]).width), ty + (vis.length - 1) * LH + 1, 6, 2);
    }
  }

  // title moment: a DOS dialog that zooms open over the terminal (Turbo-Vision style), drawn on the text plane
  const OPX = 1422, OPY = 393;            // dialog centred in the terminal, just under the C:\> prompt
  let DLGW = 230;
  function dialog(a) {
    const s = ease.out(clamp(a * 1.5)); if (s <= .03) return;
    const cx = OPX / 3, cy = OPY / 3 + 1, w = DLGW * s, h = 138 * s;
    const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2), x1 = Math.round(cx + w / 2), y1 = Math.round(cy + h / 2);
    tg.fillStyle = LGY; tg.fillRect(x0, y0, x1 - x0, y1 - y0);
    tg.fillStyle = WHT; tg.fillRect(x0, y0, x1 - x0, 1); tg.fillRect(x0, y0, 1, y1 - y0);
    tg.fillStyle = DGY; tg.fillRect(x0, y1 - 1, x1 - x0, 1); tg.fillRect(x1 - 1, y0, 1, y1 - y0);
    const bh = Math.round(11 * s);
    tg.fillStyle = BLU; tg.fillRect(x0 + 3, y0 + 3, x1 - x0 - 6, bh);
    if (s > .9) { tg.fillStyle = LGY; tg.fillRect(x0 + 6, y0 + 5, 9, 7); tg.fillStyle = BLK; tg.fillRect(x0 + 8, y0 + 8, 5, 1); }
  }
  const OPST = {
    ink: BLK, sub: BLK, accent: RED, x: OPX, y: OPY, align: 'center', inAt: .55, outAt: 2.9,
    title: { family: PIX, size: 144, weight: 400, sp: 24 },
    small: { family: PIX, size: 36, weight: 400 },
    num: { family: PIX, size: 48, weight: 400 },
    backdrop: (g, b, a) => dialog(a),
  };
  // Subtitles live on their own 480×270 plane: the 13 px bitmap strike ×4 = 52 px, still 1-bit crisp
  // (the font has no strike above 16 px, and 16 ×3 = 48 px is below the body size).
  const SW = 480, SH = 270, SBY = 1000;
  const SBST = {
    ink: WHT, body: { family: PIX, size: 52, weight: 400 }, y: SBY,
    bandFn: (g, bx, by, bw, bh, al) => {     // a black DOS bar sized to the card, in subtitle-plane pixels
      const fb = Math.round((by + 52 + 20) / 4), lb = Math.round(SBY / 4);
      const x0 = Math.floor(bx / 4) - 1, x1 = Math.ceil((bx + bw) / 4) + 1, y0 = fb - 12 - 6, y1 = lb + 2 + 6;
      sg4.save(); sg4.globalAlpha = al;
      sg4.fillStyle = BLK; sg4.fillRect(x0, y0, x1 - x0, y1 - y0);
      sg4.restore();
    },
  };

  const CRT = `
  uniform sampler2D ART; uniform sampler2D TXT; uniform sampler2D SUB; uniform float K;
  vec3 px(vec2 p){
    vec4 tx=texture(TXT,(floor(p*vec2(640.,360.))+.5)/vec2(640.,360.));
    vec4 sb=texture(SUB,(floor(p*vec2(480.,270.))+.5)/vec2(480.,270.));
    vec3 a=texture(ART,(floor(p*vec2(320.,180.))+.5)/vec2(320.,180.)).rgb;
    return mix(mix(a,tx.rgb,tx.a),sb.rgb,sb.a);
  }
  void main(){
    vec2 q=uv-.5; float r2=dot(q,q);
    vec2 p=.5+q*(1.+K*r2);
    vec2 e=min(p,1.-p); float inside=smoothstep(0.,.0025,min(e.x,e.y*1.6));
    vec3 c=px(p);
    vec2 dx=vec2(1.4/320.,0.), dy=vec2(0.,1.4/180.);
    vec3 b=(px(p+dx)+px(p-dx)+px(p+dy)+px(p-dy))*.25;
    c=c*.9+b*.22;
    float sl=.86-.16*cos(p.y*360.*6.2831853);
    float sa=texture(SUB,(floor(p*vec2(480.,270.))+.5)/vec2(480.,270.)).a;
    sl=mix(sl,.93,sa*.75);                      // 4-px subtitle rows beat against the 3-px scanlines: keep them even
    float m=mod(gl_FragCoord.x,3.);
    vec3 mk=m<1.?vec3(1.,.9,.9):m<2.?vec3(.9,1.,.9):vec3(.9,.9,1.);
    c*=sl*mk*1.1;
    c*=1.-r2*.8;
    c+=vec3(.010,.011,.016);
    O=vec4(mix(vec3(.016,.016,.02),c,inside),1.);
  }`;

  scene({
    id: 'floppy', n: ch.n, dur: ch.dur, trans: { type: 'pixel', d: .8 },
    cues: [
      { t: .42, sfx: 'disk' }, { t: .6, sfx: 'blip', v: .5 },
      { t: 3.5, sfx: 'key' }, { t: 3.75, sfx: 'key' }, { t: 3.95, sfx: 'click' }, { t: 4.1, sfx: 'seek' }, { t: 4.45, sfx: 'seek' },
      { t: 4.86, sfx: 'blip', v: .6 },
      { t: 6.1, sfx: 'key' }, { t: 6.4, sfx: 'key' }, { t: 6.75, sfx: 'seek' }, { t: CPY.err, sfx: 'beep' },
      { t: ICO.click, sfx: 'click' },
      { t: 10.95, sfx: 'key' }, { t: 12.5, sfx: 'beep' }, { t: BAYT.retry, sfx: 'key' }, { t: 13.6, sfx: 'beep' },
      { t: 15.5, sfx: 'paper', v: .6 }, { t: 16.85, sfx: 'paper' }, { t: CAL.stamp[1], sfx: 'stamp' },
    ],
    init() {
      LUT = new Uint8Array(32768);
      for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
        const r0 = r * 8 + 4, g0 = g * 8 + 4, b0 = b * 8 + 4; let bi = 0, bd = 1e9;
        for (let i = 0; i < 16; i++) { const d = (r0 - PR[i]) ** 2 + (g0 - PG[i]) ** 2 + (b0 - PB[i]) ** 2; if (d < bd) { bd = d; bi = i; } }
        LUT[r << 10 | g << 5 | b] = bi;
      }
      const c2 = (w, h) => { const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return [c, g]; };
      [art, ag] = c2(AW, AH); [tl, tg] = c2(TW, TH); [sa, sga] = c2(AW, AH); [sb, sgb] = c2(AW, AH);
      [dk, dg] = c2(90, 94); [pageC, pgg] = c2(PGW, PGH);
      PX = scaled(tg, 3);
      [sl, sg4] = c2(SW, SH); PXS = scaled(sg4, 4);
      // Bayer dissolve masks
      PAT = { a: [], b: [] };
      for (let lv = 0; lv <= 16; lv++) for (const [key, ctx2] of [['a', sga], ['b', sgb]]) {
        const [mc, mg] = c2(4, 4);
        for (let i = 0; i < 16; i++) if (key === 'a' ? BAY[i] >= lv : BAY[i] < lv) R(mg, i & 3, i >> 2, 1, 1, '#fff');
        PAT[key][lv] = ctx2.createPattern(mc, 'repeat');
      }
      // phone
      let pg; [phoneC, pg] = c2(36, 70);
      pg.fillStyle = BLK; rr(pg, 0, 0, 36, 70, 6); pg.fill();
      pg.fillStyle = DGY; rr(pg, 1, 1, 34, 68, 5); pg.fill();
      pg.fillStyle = BLK; rr(pg, 2, 2, 32, 66, 4); pg.fill();
      pg.save(); pg.translate(3, 6); pg.beginPath(); pg.rect(0, 0, 30, 58); pg.clip(); paintPhoto(pg, 30, 58); pg.restore();
      R(pg, 16, 3, 4, 1, DGY); R(pg, 14, 66, 8, 1, DGY);
      // stamp: vermilion ring + 廃止, with ink drop-out
      const SS = 58; let sg; [stampC, sg] = c2(SS, SS);
      sg.strokeStyle = RED; sg.lineWidth = 3; sg.beginPath(); sg.arc(29, 29, 26.5, 0, TAU); sg.stroke();
      sg.lineWidth = 1.2; sg.beginPath(); sg.arc(29, 29, 22, 0, TAU); sg.stroke();
      sg.font = `16px ${PIX}`; sg.fillStyle = RED; sg.textAlign = 'center'; sg.fillText('廃止', 29, 35); sg.fillText('廃止', 30, 35);
      const id = sg.getImageData(0, 0, SS, SS), d = id.data;
      for (let i = 0; i < SS * SS; i++) {
        const x = i % SS, y = (i / SS) | 0, h = hash2(x * 7 + 3, y * 5 + 11);
        if (d[i * 4 + 3] < 100 || h < (Math.hypot(x - 29, y - 29) > 19 ? .14 : .02)) { d[i * 4 + 3] = 0; continue; }
        const c = h > .82 ? LRD : RED, n = parseInt(c.slice(1), 16);
        d[i * 4] = n >> 16 & 255; d[i * 4 + 1] = n >> 8 & 255; d[i * 4 + 2] = n & 255; d[i * 4 + 3] = 255;
      }
      sg.putImageData(id, 0, 0);
      // dialog width from the opener's own lines
      tg.font = `12px ${PIX}`;
      const era = tg.measureText(ch.era).width + ([...ch.era].length - 1) * 4 / 3;
      const m = ch.meter; let mw = 0;
      if (m) { mw = tg.measureText(m.label).width + tg.measureText(m.unit).width + 12; tg.font = `16px ${PIX}`; mw += tg.measureText(String(m.value)).width; }
      DLGW = Math.round(Math.max(era, mw, 120) + 56);
    },
    draw(ctx, t) {
      background(ag, t);
      picture(ag, t);
      tg.clearRect(0, 0, TW, TH);
      terminal(t);
      quantArt();
      opener(PX, t, ch, OPST);
      quantText(tg, TW, TH);
      sg4.clearRect(0, 0, SW, SH);
      subs(PXS, t, ch, SBST);
      quantText(sg4, SW, SH);
      ctx.drawImage(GL.run(CRT, W, H, { ART: art, TXT: tl, SUB: sl, K: .1 }), 0, 0);
    },
  });
})();
