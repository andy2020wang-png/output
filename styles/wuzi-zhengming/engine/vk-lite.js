/* vk-lite.js —「无字证明 · 竖屏」用的逐帧画布引擎（按原 VK 引擎里这一风格用到的接口重写，接口名不变）。
 * 画面是 t 的纯函数：seek(t) 同步画完一帧；render.js 逐帧截图交给 ffmpeg。同一个 t 永远画出同一张图（颗粒、笔尖火星都按帧号取随机）。
 * 一帧的出图顺序：底色（look.bgo）→ look.under（方格纸）→ 内容层 → 辉光（内容层缩小模糊后 lighter 叠回）→ look.post（淡出黑幕）→ 颗粒（overlay）。
 *
 * VK.film({ dur, w, h, bloom, grain, preload, draw(fr, t) })   注册全片；页面加载完字体后 window.READY = true
 * fr（每帧一个）：fr.x 内容层 2D 上下文；fr.look = { bgo: { color }, under(ctx), post(ctx) }
 *   fr.text(s, x, y, o)   o: font（下表的键）size track align('l'|'c'|'r') color a glow glowColor glowA shadow shadowBlur shadowY base
 *                         —— 竖直方向按中线对齐（textBaseline = middle）；同时给 glow 和 shadow 时 shadow 生效
 *   fr.measure(s, o)      量宽（和 text 的对齐宽度一致）
 *   fr.line(x1, y1, x2, y2, o) / fr.poly(pts, o) / fr.circle(x, y, r, o)   o: color w a dash cap glow glowColor glowA fill fa close k（只画前 k）add（lighter）
 *   fr.glow(x, y, r, color, a)   径向光斑      fr.g({ at, s, rot, a }, fn)   平移 → 旋转 → 缩放，透明度相乘
 * 工具：VK.clamp lerp seg(t, a, b) smooth ss(t, a, b) E（缓动表）hash rng(seed) rgba(hex, a)；VK.T = 正在画的时刻；VK.W / VK.H = 画幅。
 * 字体键（族名在 index.html 的 @font-face 里映射到仓库 fonts/ 下的文件）：
 *   sansm 思源黑体 500 · sansh 思源黑体 900 · sans 700 · sansr 400 · plex / plexm IBM Plex Mono 400 / 500 ·
 *   latinim Cormorant Garamond 斜体 500（数学字母）· latinm Cormorant Garamond 600（上标数字）· latin 400 */
(function () {
'use strict';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smooth = x => x * x * (3 - 2 * x);
const ss = (t, a, b) => smooth(seg(t, a, b));
const E = {
  lin: x => x,
  in2: x => x * x, out2: x => 1 - (1 - x) * (1 - x),
  in3: x => x * x * x, out3: x => 1 - Math.pow(1 - x, 3),
  io3: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  out5: x => 1 - Math.pow(1 - x, 5),
  outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
  outBack: (x, s = 1.4) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
};
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const rng = seed => { let s = (Math.floor(seed) >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
function rgba(c, a = 1) {
  if (typeof c !== 'string') return c;
  if (c[0] !== '#') return c;
  let h = c.slice(1); if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
}

const FONTS = {
  sans: ['700', '"VK Sans"'], sansm: ['500', '"VK Sans"'], sansr: ['400', '"VK Sans"'], sansh: ['900', '"VK Sans"'],
  plex: ['400', '"VK Plex","VK Sans"'], plexm: ['500', '"VK Plex","VK Sans"'],
  latin: ['400', '"VK Latin","VK Serif"'], latinm: ['600', '"VK Latin","VK Serif"'], latinim: ['italic 500', '"VK Latin","VK Serif"'],
  serif: ['700', '"VK Serif"'],
};
const fontOf = (key, size) => { const f = FONTS[key] || FONTS.sansm; return `${f[0]} ${size}px ${f[1]}`; };

class Frame {
  constructor(x) { this.x = x; this.look = {}; }
  _font(o) { const x = this.x; x.font = fontOf(o.font || 'sansm', o.size || 48); x.letterSpacing = (o.track || 0) + 'px'; x.textBaseline = o.base || 'middle'; x.fontKerning = 'normal'; }
  measure(str, o = {}) { const x = this.x; x.save(); this._font(o); const w = x.measureText(str).width - (o.track || 0); x.restore(); return w; }
  text(str, px, py, o = {}) {
    const a = o.a == null ? 1 : o.a; if (a <= 0 || !str) return 0; const x = this.x; x.save(); this._font(o);
    const w = x.measureText(str).width - (o.track || 0), al = o.align || 'c';
    const lx = al === 'c' ? px - w / 2 : al === 'r' ? px - w : px;
    x.textAlign = 'left'; x.globalAlpha *= clamp(a); if (o.add) x.globalCompositeOperation = 'lighter';
    if (o.glow) { x.shadowColor = rgba(o.glowColor || o.color || '#fff', o.glowA == null ? .85 : o.glowA); x.shadowBlur = o.glow; }
    if (o.shadow) { x.shadowColor = rgba('#000', o.shadow); x.shadowBlur = o.shadowBlur || 14; x.shadowOffsetY = o.shadowY || 2; }
    x.fillStyle = rgba(o.color || '#fff', 1);
    x.fillText(str, lx, py);
    x.restore(); return w;
  }
  _stroke(o) {
    const x = this.x, col = o.color || o.stroke || '#fff';
    x.lineWidth = o.w == null ? 2 : o.w; x.strokeStyle = rgba(col, o.a == null ? 1 : o.a);
    x.lineCap = o.cap || 'round'; x.lineJoin = 'round'; x.setLineDash(o.dash || []);
    if (o.glow) { x.shadowColor = rgba(o.glowColor || col, o.glowA == null ? .85 : o.glowA); x.shadowBlur = o.glow; }
    x.stroke();
  }
  _fill(o) {
    const x = this.x, al = o.fa != null ? o.fa : (o.a == null ? 1 : o.a);
    x.fillStyle = rgba(o.fill, al);
    if (o.glow && !o.color) { x.shadowColor = rgba(o.glowColor || o.fill, o.glowA == null ? .85 : o.glowA); x.shadowBlur = o.glow; }
    x.fill();
  }
  _paint(o) { const x = this.x; if (o.fill) { x.save(); this._fill(o); x.restore(); } if (o.color || o.stroke) { x.save(); this._stroke(o); x.restore(); } }
  line(x1, y1, x2, y2, o = {}) { const x = this.x; x.save(); if (o.add) x.globalCompositeOperation = 'lighter'; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); this._stroke(o); x.restore(); }
  poly(pts, o = {}) {
    if (pts.length < 2) return; const x = this.x; x.save(); if (o.add) x.globalCompositeOperation = 'lighter';
    const n = pts.length; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    if (o.k != null && o.k < 1) {
      const f = clamp(o.k) * (n - 1), i = Math.floor(f), r = f - i;
      for (let j = 1; j <= i; j++) x.lineTo(pts[j][0], pts[j][1]);
      if (i < n - 1) x.lineTo(lerp(pts[i][0], pts[i + 1][0], r), lerp(pts[i][1], pts[i + 1][1], r));
    } else { for (let j = 1; j < n; j++) x.lineTo(pts[j][0], pts[j][1]); if (o.close) x.closePath(); }
    this._paint(o); x.restore();
  }
  circle(cx, cy, r, o = {}) { if (r <= 0) return; const x = this.x; x.save(); if (o.add) x.globalCompositeOperation = 'lighter'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); this._paint(o); x.restore(); }
  glow(px, py, r, color = '#fff', a = 1) {
    if (a <= 0 || r <= 0) return; const x = this.x; x.save(); x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, rgba(color, a)); g.addColorStop(.35, rgba(color, a * .35)); g.addColorStop(1, rgba(color, 0));
    x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r); x.restore();
  }
  g(o, fn) {
    const x = this.x; x.save();
    if (o.at) x.translate(o.at[0], o.at[1]); if (o.rot) x.rotate(o.rot); if (o.s != null) x.scale(o.s, o.s);
    if (o.a != null) x.globalAlpha *= clamp(o.a);
    if (x.globalAlpha > 0) fn(); x.restore();
  }
}

function film(o) {
  const W = o.w || VK.W || 1080, H = o.h || VK.H || 1920, dur = o.dur, FPS = 30;
  VK.W = W; VK.H = H; window.VW = W; window.VH = H; window.DUR = dur; window.FPS = FPS; window.META = o.meta || {};
  const stage = document.getElementById('stage'); stage.width = W; stage.height = H;
  const out = stage.getContext('2d');
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const content = mk(W, H), cx = content.getContext('2d');
  const BL = 4, small = mk(Math.ceil(W / BL), Math.ceil(H / BL)), sx = small.getContext('2d');
  const NZ = 256, noise = mk(NZ, NZ), nx = noise.getContext('2d'), nimg = nx.createImageData(NZ, NZ);

  function frame(t) {
    VK.T = t;
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; cx.filter = 'none'; cx.clearRect(0, 0, W, H);
    const fr = new Frame(cx);
    o.draw(fr, t);
    const L = fr.look;
    out.setTransform(1, 0, 0, 1, 0, 0); out.globalAlpha = 1; out.globalCompositeOperation = 'source-over'; out.filter = 'none';
    out.fillStyle = (L.bgo && L.bgo.color) || '#000'; out.fillRect(0, 0, W, H);
    if (L.under) { out.save(); L.under(out); out.restore(); }
    out.drawImage(content, 0, 0);
    if (o.bloom) {                                     // 辉光：内容层缩到 1/4、模糊，再放大用 lighter 叠回
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, small.width, small.height);
      sx.filter = 'blur(3px)'; sx.drawImage(content, 0, 0, small.width, small.height); sx.filter = 'none';
      out.save(); out.globalCompositeOperation = 'lighter'; out.globalAlpha = clamp(o.bloom * .9); out.imageSmoothingQuality = 'high';
      out.drawImage(small, 0, 0, W, H); out.restore();
    }
    if (L.post) { out.save(); L.post(out); out.restore(); }
    if (o.grain) {                                     // 颗粒：按帧号取随机的灰噪声，overlay 叠
      const R = rng(Math.round(t * FPS) * 2654435761 + 97), d = nimg.data;
      for (let i = 0; i < d.length; i += 4) { const v = 128 + (R() - .5) * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      nx.putImageData(nimg, 0, 0);
      out.save(); out.globalCompositeOperation = 'overlay'; out.globalAlpha = clamp(o.grain);
      out.translate(-Math.floor(R() * NZ), -Math.floor(R() * NZ)); out.fillStyle = out.createPattern(noise, 'repeat'); out.fillRect(0, 0, W + NZ, H + NZ); out.restore();
    }
  }
  window.seek = t => { frame(clamp(t, 0, dur)); return true; };

  const faces = ['500 40px "VK Sans"', '900 40px "VK Sans"', '400 40px "VK Plex"', '500 40px "VK Plex"', 'italic 500 40px "VK Latin"', '600 40px "VK Latin"'];
  Promise.all([o.preload || Promise.resolve(), ...faces.map(f => document.fonts.load(f, '无字证明勾股定理a2'))]).then(() => document.fonts.ready).then(() => {
    frame(0); window.READY = true;
    if (/[?&]play\b/.test(location.search)) {          // 浏览器预览：index.html?play
      const t0 = performance.now(); const tick = () => { frame(((performance.now() - t0) / 1000) % dur); requestAnimationFrame(tick); }; tick();
    }
  });
}

window.VK = Object.assign(window.VK || {}, { clamp, lerp, seg, smooth, ss, E, hash, rng, rgba, FONTS, fontOf, Frame, film, T: 0 });
})();
