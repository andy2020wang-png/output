/* geo-lite.js — 共用件（NS：色板、方格纸、四角括号）+ 平面几何画法（GEO：视图、笔尖描线、虚线、直角记号、缓动）。
 * 取自原 VK 系列的 common.js / geo.js 里这一风格用到的部分，接口名不变。载入顺序：vk-lite.js → geo-lite.js → style.js → 片子的 proof.js。
 *
 * NS.C 色板（底是偏冷的墨黑；灰一律 B 比 R/G 高 2–6）：bg ink label wire wireDim ghost mute old gridFine gridBold
 * NS.grid(fr, a)   方格纸：细格 40 px、粗格 200 px、四周轻暗角；画在 look.under（不进辉光）。a = 整体透明度
 * NS.hud(fr)       画面四角的 L 形括号（离边 34 px，臂长 26 px）
 *
 * GEO：世界坐标 y 朝上；视图 V 把世界坐标映到屏幕。
 *   view(s, ox, oy, box) → V { s, P(p) 世界→屏幕, L(d) 长度, W(q) 屏幕→世界 }（s = 每单位多少 px，(ox, oy) = 世界原点的屏幕位置）
 *   path(fr, V, pts, k, o) 折线（k = 画到几成，k < 1 时线头有笔尖：白核 + 强调色晕 + 小火星）；o.close 闭合；o.pen === false 不要笔尖
 *   seg(fr, V, a, b, k, o) 线段    dashed(fr, V, a, b, k, o) 灰细虚线（默认 label 色、1.4 px、a .85、无笔尖）
 *   rightAngle(fr, V, P, A, B, o) 直角记号（o.s 边长 px，默认 16）
 *   S5(u) 五次平滑（两端一、二阶导为 0）   env(u) = sin²(πu)（0 → 1 → 0 的包络）   mix(a, b, k)   add(a, b)
 *   GEO.ACC = 当前强调色 { c, hi, lo }（笔尖晕色取它）
 *   线条通用选项 o：color w a glow glowColor glowA dash（true = 默认虚线 [8, 7]）cap add penColor penR */
(function () {
'use strict';
const { clamp, lerp, rgba, rng } = VK;

/* ---------- NS ---------- */
const C = {
  bg: '#07080A', panel: '#0E1013', wire: '#C9CCD1', wireDim: '#5D6168', ghost: '#373B41',
  ink: '#F3F5F7', label: '#878C93', mute: '#555960', ghostInk: '#8A8F96', old: '#8E939A',
  gridFine: '#9AA3B0', gridBold: '#A9B3C2',
};
function grid(fr, a = 1) {
  if (a <= 0) { fr.look.under = null; return; }
  const W = VK.W, H = VK.H;
  fr.look.under = ctx => {
    ctx.save(); ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(C.gridFine, .035 * a); ctx.beginPath();
    for (let x = 0; x <= W; x += 40) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); }
    for (let y = 20; y <= H; y += 40) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); }
    ctx.stroke();
    ctx.strokeStyle = rgba(C.gridBold, .055 * a); ctx.beginPath();
    for (let x = 160; x <= W; x += 200) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); }
    for (let y = 140; y <= H; y += 200) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); }
    ctx.stroke();
    const R = Math.max(W, H), g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .42, W / 2, H / 2, R * .72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };
}
function hud(fr, t, o = {}) {
  const a = o.a == null ? 1 : o.a; if (a <= 0) return; const m = 34, L = 26, W = VK.W, H = VK.H;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => fr.poly([[x + sx * L, y], [x, y], [x, y + sy * L]], { color: C.label, w: 1.4, a: .7 * a }));
}
window.NS = { C, grid, hud, preload: Promise.resolve() };

/* ---------- GEO ---------- */
const PI = Math.PI, DASH = [8, 7];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
const len = v => Math.hypot(v[0], v[1]), unit = v => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const S5 = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 + u * (6 * u - 15));
const env = u => (u <= 0 || u >= 1) ? 0 : Math.pow(Math.sin(PI * u), 2);
const ACC0 = { c: '#FFD52A', hi: '#FFF2B8', lo: '#A88A0E' };
const acc = () => GEO.ACC || ACC0;

function view(s, ox, oy, box) { return { s, ox, oy, box, P: p => [ox + s * p[0], oy - s * p[1]], L: d => d * s, W: q => [(q[0] - ox) / s, (oy - q[1]) / s] }; }

const strokeOpt = (o, def) => ({ color: o.color || def.color, w: o.w == null ? def.w : o.w, a: o.a == null ? 1 : o.a, glow: o.glow || 0, glowColor: o.glowColor, glowA: o.glowA,
  dash: o.dash === true ? DASH : o.dash || undefined, cap: o.cap || (o.dash ? 'butt' : 'round'), add: o.add });

/* 笔尖：白核 + 强调色晕 + 几粒火星（按帧号取随机：seek 到哪一帧都一样） */
function pen(fr, x, y, o = {}) {
  const a = o.a == null ? 1 : o.a, r = o.r || 1, col = o.color || acc().c; if (a <= 0) return;
  fr.glow(x, y, 30 * r, col, .55 * a);
  fr.circle(x, y, 3.4 * r, { fill: '#FFFFFF', a });
  const R = rng(Math.round((VK.T || 0) * 30) * 7919 + Math.round(x) * 31 + Math.round(y) * 17 + 13);
  for (let i = 0; i < 4; i++) {
    const ang = (o.dir || 0) + (R() - .5) * 1.7, d = (6 + R() * 18) * r;
    fr.circle(x + Math.cos(ang) * d, y + Math.sin(ang) * d, (.7 + R() * 1.3) * r, { fill: i % 2 ? '#FFFFFF' : col, a: a * (.3 + .5 * R()) });
  }
}
/* 屏幕折线按长度截到 k：返回截下的点和线头 [x, y, 前进方向角] */
function cutScreen(S, k) {
  let L = 0; const acc0 = [0]; for (let i = 1; i < S.length; i++) { L += Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]); acc0.push(L); }
  const target = clamp(k) * L, pts = [S[0]];
  for (let i = 1; i < S.length; i++) {
    if (acc0[i] <= target) { pts.push(S[i]); continue; }
    const r = (target - acc0[i - 1]) / Math.max(1e-9, acc0[i] - acc0[i - 1]), p = mix(S[i - 1], S[i], r); pts.push(p);
    return { pts, tip: [p[0], p[1], Math.atan2(S[i][1] - S[i - 1][1], S[i][0] - S[i - 1][0])] };
  }
  const n = S.length; return { pts, tip: [S[n - 1][0], S[n - 1][1], Math.atan2(S[n - 1][1] - S[n - 2][1], S[n - 1][0] - S[n - 2][0])] };
}
function strokeScreen(fr, S, k, o, def) {
  if (k <= 0 || S.length < 2) return;
  const { pts, tip } = cutScreen(S, k);
  if (pts.length > 1) fr.poly(pts, Object.assign(strokeOpt(o, def), { close: k >= 1 && !!o.close }));
  if (k < 1 && o.pen !== false) pen(fr, tip[0], tip[1], { a: o.a == null ? 1 : o.a, dir: tip[2] + PI, color: o.penColor, r: o.penR });
}
function seg(fr, V, a, b, k = 1, o = {}) { strokeScreen(fr, [V.P(a), V.P(b)], k, o, { color: C.ink, w: 2.2 }); }
const dashed = (fr, V, a, b, k = 1, o = {}) => seg(fr, V, a, b, k, Object.assign({ color: C.label, w: 1.4, a: .85, dash: true, pen: false }, o));
function path(fr, V, pts, k = 1, o = {}) { const S = pts.map(V.P); if (o.close) S.push(S[0]); strokeScreen(fr, S, k, Object.assign({}, o, { close: false }), { color: C.ink, w: 2.2 }); }
function rightAngle(fr, V, P, A, B, o = {}) {
  const q = V.P(P), u = unit(sub(V.P(A), q)), v = unit(sub(V.P(B), q)), s = o.s || 16;
  fr.poly([add(q, mul(u, s)), add(q, add(mul(u, s), mul(v, s))), add(q, mul(v, s))], strokeOpt(o, { color: C.ink, w: 1.5 }));
}

window.GEO = { ACC: null, view, path, seg, dashed, rightAngle, pen, S5, env, mix, add, sub, mul, len, unit };
})();
