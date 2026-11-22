/* 《无字证明：勾股定理》—— 这一风格的参考片。竖屏 1080 × 1920，44 拍（95 BPM）= 27.789 s。
 * 证明（几何形变，全程没有一句解说）：直角三角形 ABC（∠C = 90°，BC = a = 3，CA = b = 4，AB = c = 5），三边上各作一个正方形。
 *   ① 剪切：两个小正方形各以贴着三角形的那条边为底，对边沿着自己所在的直线滑动（等底等高，面积不变），滑到 C 的正上方合拢；
 *   ② 平移：两块一起沿斜边上的高的方向下移 c；
 *   ③ 再剪切：各以大正方形的一条竖边为底，对边沿着高所在的直线滑到垂足，变成两个矩形，正好填满斜边上的正方形。所以 a² + b² = c²。
 * 配乐（原片）：《几何之美 · 二》的配乐从原曲 229.4152 s 剪 27.7895 s：片中第 0–31 拍是高潮，第 32 拍是收束重拍（结论落在这一拍），第 33–44 拍是尾声。
 * 颜色：黄（X）+ 白 + 灰。a² 那一块黄色填充，b² 那一块白色淡填。自检：window.CHECK.run()（两块的面积每一帧都是 9 和 16，最后拼成 5 × 5）。 */
(function () {
'use strict';
const { lerp, seg, ss } = VK;

/* ---------- 几何（世界坐标，y 朝上；斜边 AB 水平，直角顶点 C 在上，大正方形在下） ---------- */
const A = [0, 0], B = [5, 0], Cc = [3.2, 2.4], cL = 5, hL = 2.4;
const D = [5, -5], Eb = [0, -5], Hp = [3.2, -5];              // 大正方形 A、B、D、Eb；Hp = 高的延长线与 D-Eb 的交点
const uA = [2.4, 1.8], uB = [-2.4, 3.2], UP = [0, cL];         // 小正方形向外的边向量；剪切后对边的偏移 = (0, c)
const PEAK = [3.2, 7.4];                                       // 两块合拢的地方（C 的正上方 c 处）
const add = (p, q) => [p[0] + q[0], p[1] + q[1]], mix = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
const cen = P => [(P[0][0] + P[1][0] + P[2][0] + P[3][0]) / 4, (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4];
/* 视图：84 px / 单位；AB 在 y = 1084，A 在 x = 330。图的范围 x 128–952，y 462（合拢点，只在 ① 里到达）–1504（大正方形底边）；小正方形最高到 y = 614 */
const V = GEO.view(84, 330, 1084);

/* ---------- 时间线（拍） ---------- */
const T = {
  sqB: [-2.2, 1.4], sqA: [-1.2, 2.0], sqC: [0.2, 3.0],         // 笔尖画三个正方形（第 0 帧 b² 已画了六成、a² 近四成）
  fillB: [1.2, 2.4], fillA: [1.8, 3.0],
  labB: 2.0, labA: 2.6, labC: 3.3,
  roof: [5, 7], roofOut: [14, 15.5],                           // 两条滑轨（虚线）
  sh1B: [8, 13], sh1A: [8.5, 13.5],                            // ① 剪切
  ghost: [8, 9.5],                                             // 原来两个小正方形留下的虚线轮廓
  alt: [14, 16], labCOut: [15, 17],                            // 高所在的直线（虚线）；c² 让位
  mv: [16, 21.5],                                              // ② 平移
  sh2: [25, 32],                                               // ③ 再剪切，落在第 32 拍（收束重拍）
  res: [31.5, 32.7],                                           // 大正方形变黄（公式在第 32 拍，见下方 formAt）
  pairB: [33, 35.4], pairA: [35, 37.4],                        // 尾声：原来的正方形和它变成的矩形成对亮一下（b² 一对，a² 一对）
};

let K = null;                                                  // PWW.film 返回的工具（beat、kOf …）
const beat = n => K.beat(n), kOf = (t, w) => K.kOf(t, w);

/* 两块在 t 时刻的四个顶点：[C 侧, 底边另一端, 底边另一端 + 偏移, C 侧 + 偏移] */
function shapes(t) {
  const k1a = kOf(t, T.sh1A), k1b = kOf(t, T.sh1B), k2 = kOf(t, T.mv), k3 = kOf(t, T.sh2);
  const d = [0, -cL * k2], s3 = [0, -hL * k3];                 // 平移；③ 里 C 侧那条边沿着高再下滑 h
  const offA = mix(uA, UP, k1a), offB = mix(uB, UP, k1b);
  const Ct = add(add(Cc, d), s3);
  return {
    a: [Ct, add(B, d), add(add(B, d), offA), add(Ct, offA)],
    b: [Ct, add(A, d), add(add(A, d), offB), add(Ct, offB)],
    k: { k1a, k1b, k2, k3 },
  };
}

function draw(fr, t, K) {
  const { C, X, G } = K;
  const S = shapes(t), PA = S.a.map(V.P), PB = S.b.map(V.P);
  const kRes = ss(t, beat(T.res[0]), beat(T.res[1])), breathe = .5 + .5 * Math.sin((t - beat(32)) * 1.3);
  const np = { pen: false };

  /* 原来两个小正方形的位置：虚线轮廓（两块离开后留下）；尾声里和变成的矩形成对亮起 */
  const aG = .5 * ss(t, beat(T.ghost[0]), beat(T.ghost[1]));
  const eB = G.env(seg(t, beat(T.pairB[0]), beat(T.pairB[1]))), eA = G.env(seg(t, beat(T.pairA[0]), beat(T.pairA[1])));   // sin² 包络，升降各 0.75 s
  if (aG > 0) {
    const SB = [Cc, add(Cc, uB), add(A, uB), A], SA = [Cc, add(Cc, uA), add(B, uA), B];
    if (eB > 0) fr.poly(SB.map(V.P), { close: true, fill: C.ink, fa: .13 * eB });
    if (eA > 0) fr.poly(SA.map(V.P), { close: true, fill: X.c, fa: .26 * eA });
    G.path(fr, V, SB, 1, { close: true, color: eB > 0 ? C.wire : C.label, w: 1.6, a: aG + .4 * eB, dash: true, pen: false });
    G.path(fr, V, SA, 1, { close: true, color: C.label, w: 1.6, a: aG * (1 - eA), dash: true, pen: false });
    if (eA > 0) G.path(fr, V, SA, 1, { close: true, color: X.c, w: 1.8, a: .9 * eA, dash: true, pen: false });
  }
  /* 斜边上的正方形：白线 → 第 32 拍变黄（辉光慢慢呼吸） */
  const kC = seg(t, beat(T.sqC[0]), beat(T.sqC[1]));
  if (kRes < 1) G.path(fr, V, [A, Eb, D, B], kC, { color: C.ink, w: 2.6, a: 1 - kRes });
  if (kRes > 0) G.path(fr, V, [A, Eb, D, B], 1, { close: true, color: X.c, w: lerp(2.6, 4.2, kRes), a: kRes, glow: (14 + 5 * breathe) * kRes, pen: false });

  /* 两块：b² 白色淡填，a² 黄色填充；画的过程用笔尖，之后是实线轮廓 */
  const kB = seg(t, beat(T.sqB[0]), beat(T.sqB[1])), kA = seg(t, beat(T.sqA[0]), beat(T.sqA[1]));
  const fB = ss(t, beat(T.fillB[0]), beat(T.fillB[1])), fA = ss(t, beat(T.fillA[0]), beat(T.fillA[1]));
  if (fB > 0) fr.poly(PB, { close: true, fill: C.ink, fa: (.13 + .03 * kRes + .10 * eB) * fB });
  if (fA > 0) fr.poly(PA, { close: true, fill: X.c, fa: (.30 + .06 * kRes + .16 * eA) * fA });
  if (kB < 1) G.path(fr, V, [Cc, add(Cc, uB), add(A, uB), A], kB, { color: C.ink, w: 3 });
  else fr.poly(PB, { close: true, color: C.ink, w: 3 });
  if (kA < 1) G.path(fr, V, [Cc, add(Cc, uA), add(B, uA), B], kA, { color: X.c, w: 3, glow: 8 });
  else fr.poly(PA, { close: true, color: X.c, w: 3, glow: 10 });

  /* 不动的底边加粗提示（等底等高）：① 里是贴着三角形的 CA、CB；③ 里是大正方形的两条竖边 */
  const hi = (b0, b1) => ss(t, beat(b0 - .6), beat(b0 + .4)) * (1 - ss(t, beat(b1), beat(b1 + 1.2)));
  const h1b = hi(...T.sh1B), h1a = hi(...T.sh1A), h3 = hi(...T.sh2);
  if (h1b > 0) G.seg(fr, V, Cc, A, 1, { color: C.ink, w: 6, a: h1b, glow: 10, glowColor: C.ink, glowA: .5, pen: false });
  if (h1a > 0) G.seg(fr, V, Cc, B, 1, { color: X.c, w: 6, a: h1a, glow: 12, pen: false });
  if (h3 > 0) { G.seg(fr, V, A, Eb, 1, { color: C.ink, w: 6, a: h3, glow: 10, glowColor: C.ink, glowA: .5, pen: false }); G.seg(fr, V, B, D, 1, { color: X.c, w: 6, a: h3, glow: 12, pen: false }); }

  /* 高所在的直线：虚线，从 C 画到大正方形底边；平移和第二次剪切都沿着它 */
  const kAlt = seg(t, beat(T.alt[0]), beat(T.alt[1]));
  if (kAlt > 0) G.dashed(fr, V, Cc, Hp, G.S5(kAlt), { color: C.label, w: 1.6, a: .8 * (1 - .6 * kRes) });

  /* 三角形：画在两块上面，一直看得见 */
  G.path(fr, V, [A, B, Cc], 1, Object.assign({ close: true, color: C.ink, w: 3.2 }, np));
  G.rightAngle(fr, V, Cc, A, B, { s: 18, color: C.ink, a: .9 });

  /* 两条滑轨：小正方形的对边所在的直线，延长到 C 正上方合拢的地方 */
  const aR = ss(t, beat(T.roof[0]), beat(T.roof[0] + 1)) * (1 - ss(t, beat(T.roofOut[0]), beat(T.roofOut[1])));
  if (aR > 0) {
    const kR = G.S5(seg(t, beat(T.roof[0]), beat(T.roof[1])));
    G.dashed(fr, V, add(Cc, uB), PEAK, kR, { color: C.label, w: 1.6, a: .85 * aR });
    G.dashed(fr, V, add(Cc, uA), PEAK, kR, { color: C.label, w: 1.6, a: .85 * aR });
    G.dashed(fr, V, Cc, PEAK, kR, { color: C.label, w: 1.4, a: .6 * aR });
  }

  /* 标注：a²、b² 跟着两块走；c² 在两块到来之前让位 */
  K.tag2(fr, V, cen(S.b), 'b', 62, C.ink, t, T.labB);
  K.tag2(fr, V, cen(S.a), 'a', 62, X.hi, t, T.labA);
  K.tag2(fr, V, [2.5, -2.5], 'c', 62, C.wire, t, T.labC, 1 - ss(t, beat(T.labCOut[0]), beat(T.labCOut[1])));
}

K = PWW.film({
  tag: '无字证明', title: '勾股定理', en: 'The Pythagorean Theorem',
  bpm: 95, beats: 44,
  formula: [['s', 'a'], ['o', '+'], ['s', 'b'], ['o', '='], ['s', 'c']], formAt: 32,
  followAt: 37.5, markAt: 39,
  draw,
});

/* 自检：两块的面积每一帧都是 9 和 16，最后正好是 [3.2, 5] × [−5, 0] 和 [0, 3.2] × [−5, 0] 两个矩形 */
const area = P => Math.abs((P[0][0] - P[2][0]) * (P[1][1] - P[3][1]) - (P[1][0] - P[3][0]) * (P[0][1] - P[2][1])) / 2;
window.CHECK = {
  run() {
    let da = 0, db = 0, n = 0;
    for (let t = 0; t <= K.END + 1e-9; t += 1 / 30) { const S = shapes(t); da = Math.max(da, Math.abs(area(S.a) - 9)); db = Math.max(db, Math.abs(area(S.b) - 16)); n++; }
    const S = shapes(K.END), ok = da < 1e-9 && db < 1e-9 && Math.abs(S.a[0][1] + 5) < 1e-9 && Math.abs(S.b[2][1]) < 1e-9;
    return { ok, frames: n, maxErrA: da, maxErrB: db, final: { a: S.a, b: S.b } };
  },
};
})();
