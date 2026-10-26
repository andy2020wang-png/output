// 01 手印 — Sulawesi cave wall, ochre spray stencils, torch light.
'use strict';
(() => {
  const ROCK = `
  uniform vec2 L;
  float hgt(vec2 p){ vec2 w=vec2(fbm(p*.8+1.3),fbm(p*.8+7.1))*1.4; vec2 q=p+w;
    float b=fbm(q*1.6)*.75+ridge(q*.9+4.)*.35;
    float fr=smoothstep(.035,.0,abs(fbm(q*.55+11.)-.5))*smoothstep(.45,.6,fbm(p*.7+3.));
    return b-fr*.18; }
  void main(){ vec2 p=uv*vec2(R.x/R.y,1.)*1.5;
    float e=.002, h=hgt(p); vec3 n=normalize(vec3(hgt(p-vec2(e,0))-hgt(p+vec2(e,0)), hgt(p-vec2(0,e))-hgt(p+vec2(0,e)), e*4.));
    vec3 ld=normalize(vec3(L,.5)); float dif=clamp(dot(n,ld),0.,1.);
    vec3 base=mix(vec3(.42,.33,.25),vec3(.7,.6,.48),fbm(p*.7+2.));
    base=mix(base,vec3(.78,.72,.62),smoothstep(.6,.78,fbm(p*2.3+5.))*.5);
    base=mix(base,vec3(.32,.22,.16),smoothstep(.55,.7,fbm(p*3.1+8.))*.35);
    base*=.9+.2*vn(p*70.);
    vec3 col=base*(.32+.9*dif)+vec3(.04,.025,.02);
    col*=.8+.35*h;
    O=vec4(col,1.); }`;

  // hand silhouette built from capsules (palm + 5 fingers)
  function hand(g, cx, cy, s, rot, spread) {
    g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(s, s);
    g.beginPath(); g.ellipse(0, 40, 62, 74, 0, 0, Math.PI * 2); g.fill();
    const f = [[-58, 10, -.95 - spread * .3, 26, 92], [-34, -36, -.22 - spread * .12, 22, 118], [-6, -44, -.04, 23, 132], [22, -40, .12 + spread * .1, 22, 122], [46, -22, .32 + spread * .2, 19, 92]];
    for (const [x, y, a, r, l] of f) {
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.moveTo(-r, 0); g.lineTo(-r * .9, -l); g.arc(0, -l, r * .9, Math.PI, 0); g.lineTo(r, 0); g.closePath(); g.fill();
      g.restore();
    }
    g.beginPath(); g.ellipse(0, 120, 46, 70, 0, 0, Math.PI * 2); g.fill(); // wrist
    g.restore();
  }
  // negative stencil: dense pigment spray around the hand, bare rock where the hand was
  function stencil(seed, s, rot, spread, col) {
    const Wc = 560, Hc = 600, c = makeCanvas(Wc, Hc), g = c.getContext('2d'), r = mulberry(seed);
    const m = makeCanvas(Wc, Hc), mg = m.getContext('2d'); mg.fillStyle = '#fff'; hand(mg, Wc / 2, Hc / 2 + 20, s, rot, spread);
    // halo = blurred mask, tinted with pigment; outer spray speckles
    g.filter = 'blur(38px)'; g.drawImage(m, 0, 0); g.drawImage(m, 0, 0); g.filter = 'blur(14px)'; g.drawImage(m, 0, 0); g.filter = 'none';
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, Wc, Hc);
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 2600; i++) {
      const a = r() * 6.283, d = 120 + Math.pow(r(), .7) * 170;
      g.globalAlpha = .15 + .35 * r(); g.fillStyle = col;
      g.beginPath(); g.arc(Wc / 2 + Math.cos(a) * d, Hc / 2 + 20 + Math.sin(a) * d * 1.1, .7 + r() * 2.2, 0, 6.283); g.fill();
    }
    // grainy pigment: knock out tiny specks so it reads as blown powder
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9000; i++) { g.globalAlpha = r() * .6; g.fillRect(r() * Wc, r() * Hc, 1.5, 1.5); }
    g.globalAlpha = 1; g.filter = 'blur(1.5px)'; g.drawImage(m, 0, 0); g.filter = 'none';
    g.globalCompositeOperation = 'source-over';
    return c;
  }
  let rock, hands, pig;
  const HANDS = [ // x, y, scale, rot, spread, seed, appear-time, color
    [1180, 430, .95, -.25, .2, 11, .25, '#b8401f'], [1500, 330, .8, .35, .5, 12, .55, '#c4532a'],
    [880, 640, .75, -.6, .1, 13, .85, '#a83a1e'], [1640, 690, .85, .1, .7, 14, 1.15, '#cc5a2c'],
    [1330, 760, .7, -.1, .3, 15, 1.4, '#9e341c'], [640, 330, .65, .5, .4, 16, 1.65, '#b84826'],
  ];
  function pigFigure() { // Sulawesi warty pig silhouette in ochre line + fill, painted
    const c = makeCanvas(700, 360), g = c.getContext('2d');
    g.fillStyle = 'rgba(150,52,30,.78)'; g.strokeStyle = 'rgba(120,38,22,.9)'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(90, 190); g.bezierCurveTo(120, 110, 260, 70, 400, 85); g.bezierCurveTo(500, 92, 560, 120, 600, 160);
    g.lineTo(650, 175); g.lineTo(640, 200); g.bezierCurveTo(600, 215, 560, 225, 540, 235);
    g.bezierCurveTo(480, 250, 300, 255, 160, 240); g.closePath(); g.fill();
    for (const [x, y] of [[170, 238], [230, 245], [470, 240], [520, 236]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x < 300 ? -8 : 8), y + 80); g.stroke(); }
    g.beginPath(); g.moveTo(92, 190); g.quadraticCurveTo(60, 170, 52, 140); g.stroke();
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(200 + i * 40, 98 - Math.sin(i) * 6); g.lineTo(206 + i * 40, 70 - Math.sin(i) * 6); g.stroke(); }
    g.globalCompositeOperation = 'destination-out';
    const r = mulberry(5); for (let i = 0; i < 900; i++) { g.globalAlpha = r() * .5; g.beginPath(); g.arc(r() * 700, r() * 360, r() * 6, 0, 6.28); g.fill(); }
    return c;
  }

  scene({
    id: 'cave', dur: 7.5, trans: { type: 'dip', d: .8, color: '#000' },
    init() {
      rock = GL.bake(ROCK, W, H, { L: [-.7, -.3] });
      hands = HANDS.map(h => stencil(h[5], h[2], h[3], h[4], h[7]));
      pig = pigFigure();
    },
    draw(ctx, t, info) {
      // slow push-in
      const z = 1.04 + t * .006;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(rock, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
            HANDS.forEach((h, i) => {
        const a = smooth(h[6], h[6] + .5, t);
        if (a <= 0) return;
        ctx.globalAlpha = a * .75; ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(hands[i], h[0] - 280, h[1] - 320);
        ctx.globalAlpha = a; ctx.globalCompositeOperation = 'color';
        ctx.drawImage(hands[i], h[0] - 280, h[1] - 320);
        ctx.globalAlpha = a * .35; ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(hands[i], h[0] - 280, h[1] - 320);
      });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // torch light: warm pool from lower left with flicker
      const fl = .82 + .1 * Math.sin(t * 13.1) + .06 * Math.sin(t * 29.7 + 1) + .05 * (vnoise(t * 9, 3) - .5);
      ctx.globalCompositeOperation = 'multiply';
      const g = ctx.createRadialGradient(560, 900, 80, 820, 640, 1500 * fl);
      g.addColorStop(0, 'rgba(255,214,160,1)'); g.addColorStop(.45, 'rgba(190,120,70,1)'); g.addColorStop(1, 'rgba(26,14,10,1)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      const g2 = ctx.createRadialGradient(420, 1000, 10, 420, 1000, 700);
      g2.addColorStop(0, `rgba(255,140,50,${.22 * fl})`); g2.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      vignette(ctx, .55, '12,6,4');
      stageText(ctx, t, info.dur, {
        era: '距今至少 67800 年 · 印度尼西亚 穆纳岛', title: '手 印', en: 'Hand stencil · ochre on limestone',
        lines: ['人类把手按在岩壁上，\n再将赭石颜料喷吹到手的周围。', '这是已知最古老的岩画之一。\n它的意思，或许就是：我在这里。'],
        meter: { label: '已 保 存', value: 67800, plus: true, unit: '年' },
      }, {
        ink: '#f3e3cc', sub: '#d9b896', accent: '#f0a070',
        title: { family: '"Ma Shan Zheng"', size: 120, weight: 400, sp: 10 },
        body: { family: '"Noto Serif SC"', size: 44, weight: 600 },
        en: { family: '"Cormorant Garamond"', size: 32, style: 'italic' },
        shadow: 'rgba(0,0,0,.6)',
      });
      treeBar(ctx, 1, 25, '#f3e3cc', .5);
      grain(ctx, t, .07);
    },
  });
})();
