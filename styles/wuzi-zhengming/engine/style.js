/* style.js —「无字证明 · 竖屏」的外壳：版式、标题区、结论公式、片尾两行、方格纸、四角括号、结尾淡出。新片不用改这个文件。
 * 一部片只写一个 proof.js：PWW.film({ ...配置, draw(fr, t, K) { 只画图 } })。
 *
 * 配置：
 *   tag '无字证明'（标签，强调色）· title（标题，思源黑体 900，默认 112 px，超过 900 px 宽自动缩小）· en（英文名，Plex Mono 22 px 灰）
 *   bpm · beats（全片拍数；END = beats × 60/bpm）· formAt（结论公式弹出的拍）· followAt / markAt（片尾两行出现的拍）
 *   formula：[[种类, 文字], …]，种类 s = 斜体字母带上标 2（如 a²），v = 斜体字母，n = 直立数字，o = 运算符（= + − × …）
 *   accent（可选，默认黄 { c: '#FFD52A', hi: '#FFF2B8', lo: '#A88A0E' }）
 * draw(fr, t, K) 拿到的 K：W H C（灰阶色板）X（强调色）G（GEO）beat(n) END LAY（版式表）
 *   kOf(t, [b0, b1]) = 从第 b0 拍到第 b1 拍的 S5 进度（0 → 1）
 *   sq(fr, cx, cy, 字母, 字号, 颜色, a, { glow, exp })   斜体字母 + 上标（默认 2）
 *   tag2(fr, V, 世界坐标点, 字母, 字号, 颜色, t, 弹出的拍, a)   图里的面积标注：0.45 s 内从 1.4 倍缩到 1 倍弹出
 *
 * 版式（1080 × 1920；y 是文字中线）：标签 192 · 标题 284 · 英文名 364 · 公式 492 · 图区 y 440–1520、x 70–1010 · 「如果喜欢，请点个关注吧」1580 · 「— @Vegavis」1640。
 * 时间：第 0 帧就有内容（标题区 55 % 亮度，0.9 s 内亮满）；公式 0.55 s 内从 1.22 倍缩到 1 倍；片尾两行各 0.6 s 淡入；最后 1.5 s 整个画面淡到黑。 */
(function () {
'use strict';
const { C, grid, hud } = NS, G = GEO;
const { lerp, seg, ss, E } = VK;
const W = 1080, H = 1920, FADE = 1.5;
const YELLOW = { c: '#FFD52A', hi: '#FFF2B8', lo: '#A88A0E' };
const LAY = { tag: 192, title: 284, en: 364, formula: 492, fig: [70, 440, 1010, 1520], follow: 1580, mark: 1640 };

/* ---------- 数学字：斜体字母 + 右上角的上标，居中在 cx；sqW 只量宽 ---------- */
function sqW(fr, ch, S, exp = '2') { return fr.measure(ch, { font: 'latinim', size: S }) + S * .05 + fr.measure(exp, { font: 'latinm', size: S * .56 }); }
function sq(fr, cx, cy, ch, S, col, a = 1, o = {}) {
  if (a <= 0) return; const exp = o.exp || '2', wb = fr.measure(ch, { font: 'latinim', size: S }), x0 = cx - sqW(fr, ch, S, exp) / 2;
  const base = { color: col, align: 'l', a, shadow: .9, shadowBlur: 10, shadowY: 0, glow: o.glow || 0, glowColor: col, glowA: .45 };
  fr.text(ch, x0, cy, Object.assign({ font: 'latinim', size: S }, base));
  fr.text(exp, x0 + wb + S * .05, cy - S * .30, Object.assign({ font: 'latinm', size: S * .56 }, base));
}

/* ---------- 结论公式（整行强调色、带辉光），居中在 (cx, cy)；a 透明度，sc 缩放 ---------- */
function formula(fr, parts, cx, cy, S, a, sc, X) {
  if (a <= 0 || !parts) return;
  const gap = S * .26, oo = { font: 'sansm', size: S * .78 }, vo = { font: 'latinim', size: S }, no = { font: 'latinm', size: S * .92 };
  const wOf = ([k, v]) => k === 's' ? sqW(fr, v, S) : fr.measure(v, k === 'v' ? vo : k === 'n' ? no : oo);
  const ws = parts.map(wOf), total = ws.reduce((x, y) => x + y, 0) + gap * (parts.length - 1);
  const look = { align: 'l', color: X.c, shadow: .9, shadowBlur: 10, shadowY: 0, glow: 12, glowColor: X.c, glowA: .4 };
  fr.g({ at: [cx, cy], s: sc, a }, () => {
    let x = -total / 2;
    parts.forEach(([k, v], i) => {
      if (k === 's') sq(fr, x + ws[i] / 2, 0, v, S, X.c, 1, { glow: 16 });
      else fr.text(v, x, k === 'o' ? -S * .02 : 0, Object.assign({}, look, k === 'v' ? vo : k === 'n' ? no : oo));
      x += ws[i] + gap;
    });
  });
}

/* ---------- 上方：标签（两侧短横线）/ 标题 / 英文名 ---------- */
function header(fr, t, cfg, X) {
  const a = .55 + .45 * ss(t, 0, .9), cx = W / 2, y0 = LAY.tag;      // 第 0 帧就在（稍淡），0.9 s 内亮到正常
  const tag = cfg.tag || '无字证明', to = { font: 'sansm', size: 36, track: 12, align: 'l' }, tw = fr.measure(tag, to), x0 = cx - tw / 2 + 6, L = 84, m = 28;
  fr.text(tag, x0, y0, Object.assign({ color: X.c, a, glow: 10, glowColor: X.c, glowA: .4 }, to));
  fr.line(x0 - 6 - m - L, y0, x0 - 6 - m, y0, { color: X.c, w: 2, a: .8 * a }); fr.line(x0 - 6 + tw + m, y0, x0 - 6 + tw + m + L, y0, { color: X.c, w: 2, a: .8 * a });
  const S0 = cfg.titleSize || 112, tw0 = fr.measure(cfg.title, { font: 'sansh', size: S0, track: -2 }), S = tw0 > 900 ? S0 * 900 / tw0 : S0;
  fr.text(cfg.title, cx, LAY.title, { font: 'sansh', size: S, track: -2, color: C.ink, a, shadow: .6, shadowBlur: 18 });
  if (cfg.en) fr.text(cfg.en, cx, LAY.en, { font: 'plex', size: 22, track: 3, color: C.label, a });
}

/* ---------- 片尾两行（图的下方）：「如果喜欢，请点个关注吧」（「关注」强调色）/「— @Vegavis」 ---------- */
function footer(fr, t, cfg, beat, X) {
  const aFo = ss(t, beat(cfg.followAt), beat(cfg.followAt) + .6), aMk = ss(t, beat(cfg.markAt), beat(cfg.markAt) + .6);
  if (aFo > 0) {
    const o = { font: 'sansm', size: 46, align: 'l' }, s1 = '如果喜欢，请点个', s2 = '关注', s3 = '吧';
    const w1 = fr.measure(s1, o), w2 = fr.measure(s2, o), w3 = fr.measure(s3, o), x0 = W / 2 - (w1 + w2 + w3) / 2, y = LAY.follow + 10 * (1 - E.out3(aFo));
    fr.text(s1, x0, y, Object.assign({ color: C.ink, a: aFo }, o));
    fr.text(s2, x0 + w1, y, Object.assign({ color: X.c, a: aFo, glow: 10, glowColor: X.c, glowA: .4 }, o));
    fr.text(s3, x0 + w1 + w2, y, Object.assign({ color: C.ink, a: aFo }, o));
  }
  if (aMk > 0) {
    const o = { font: 'plexm', size: 28, align: 'l', track: 1 }, wa = fr.measure('@', o), wv = fr.measure('Vegavis', o), L = 34, g = 14, x0 = W / 2 - (L + g + wa + wv) / 2, y = LAY.mark;
    fr.line(x0, y, x0 + L, y, { color: X.c, w: 2, a: .8 * aMk });
    fr.text('@', x0 + L + g, y, Object.assign({ color: X.c, a: .9 * aMk }, o));
    fr.text('Vegavis', x0 + L + g + wa, y, Object.assign({ color: C.wire, a: .85 * aMk }, o));
  }
}

function film(cfg) {
  const X = cfg.accent || YELLOW, BEAT = 60 / cfg.bpm, beat = n => n * BEAT, END = cfg.beats * BEAT;
  const K = {
    W, H, C, X, G, beat, END, LAY,
    kOf: (t, [b0, b1]) => G.S5(seg(t, beat(b0), beat(b1))),
    sq,
    tag2(fr, V, p, ch, S, col, t, b, a = 1) {
      const k = seg(t, beat(b), beat(b) + .45); if (k <= 0) return; const q = V.P(p), sc = lerp(1.4, 1, E.out3(k));
      fr.g({ at: q, s: sc, a: a * ss(k, 0, .6) }, () => sq(fr, 0, 0, ch, S, col, 1));
    },
  };
  VK.film({
    dur: END, w: W, h: H, bloom: .5, grain: .05, preload: NS.preload, meta: { title: `${cfg.tag || '无字证明'}：${cfg.title}` },
    draw(fr, t) {
      fr.look.bgo = { color: C.bg };
      grid(fr, .35 + .65 * ss(t, 0, 1.2));
      G.ACC = X;
      header(fr, t, cfg, X);
      cfg.draw(fr, t, K);
      const kF = seg(t, beat(cfg.formAt), beat(cfg.formAt) + .55);
      formula(fr, cfg.formula, W / 2, LAY.formula, cfg.formulaSize || 88, ss(kF, 0, .7), lerp(1.22, 1, E.out3(kF)), X);
      footer(fr, t, cfg, beat, X);
      hud(fr, t);
      const kE = ss(t, END - FADE, END);                         // 最后 1.5 s 整个画面淡到黑（辉光之后、颗粒之前）
      if (kE > 0) fr.look.post = out => { out.setTransform(1, 0, 0, 1, 0, 0); out.globalAlpha = 1; out.globalCompositeOperation = 'source-over'; out.fillStyle = `rgba(0,0,0,${kE})`; out.fillRect(0, 0, W, H); };
    },
  });
  return K;
}

window.PWW = { film, sq, sqW, formula, LAY, YELLOW, W, H, FADE };
})();
