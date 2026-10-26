// 00 开场 — an exhibition label. Warm label paper, ink and cinnabar. The cover is the question over four material
// swatches mounted like specimens: A a clay tablet with 我在这里 pressed in, B xuan paper with brush calligraphy and a
// seal, C a hard-disk platter whose track carries the UTF-8 bytes of 我在这里, D a slice of a data-centre rack.
// Beats: the swatches pop in turn · 3·2·1 beside the question · the reveal replaces it · each option gets its lifetime
// and a proportional bar · the title card · its cinnabar rule is pulled out into a thread across the paper that
// begins to sag (knot_rope lifts that thread as the khipu's primary cord).
'use strict';
(() => {
  const HK = SCRIPT.hook;
  const DUR = 12.5;
  const INK = '#1B1712', RED = '#B0412E', SUB = '#5B5249', MUTE = '#8A8178';
  const TAU = Math.PI * 2;
  const PHRASE = (HK.question.match(/“([^”]+)”/) || [0, '我在这里'])[1];
  const HEX = [...new TextEncoder().encode(PHRASE)].map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  const COUNT = HK.countdown.split('·').map(s => s.trim());
  const OPT = HK.options.map(s => ({ key: s.slice(0, 1), name: s.slice(1).trim() }));
  const SERIF = '"Noto Serif SC"', SANS = '"Noto Sans SC"';

  // ---------- layout ----------
  const SW = 558, SH = 405;                 // swatch bake size; drawn at 2/3 (same grid as the outro)
  const CW = 372, CHT = 270;
  const X0 = 96, GAP = (W - 2 * X0 - 4 * CW) / 3, ROW_Y = 512;
  const QX = 96, QY1 = 292, QY2 = 400, QS = 80;          // question
  const CDX = 1690, CDY = 322;                            // countdown, beside the question
  const TY = 500, RULE_Y = 632;                           // title card: title baseline, cinnabar rule

  // ---------- baked materials ----------
  const PAPER = `
  void main(){ vec2 px=uv*R; float f=vn(px*vec2(.9,.06))*.5+vn(px*vec2(.05,.8))*.3+fbm(px*.004)*.4;
    vec3 c=vec3(.949,.937,.91)*(.965+.05*f); vec2 q=uv-.5; c*=1.-q.y*q.y*.3-q.x*q.x*.035; O=vec4(c,1.); }`;
  // clay: a height map (16 bit in R,G) of stylus impressions with raised lips, lit from the upper left
  const CLAY = `uniform sampler2D HM; uniform vec3 LD;
  float hm(vec2 o){ vec4 c=texture(HM,uv+o/R); return (c.r*65280.+c.g*255.)/65535.*2.-1.5; }
  float surf(vec2 o){ vec2 p=uv*R+o; vec2 v=vor(p*.075); float cell=h21(floor(p*.075));
    return hm(o)*6.8+fbm3(p*.010)*8.+fbm3(p*.04+7.)*1.4+vn(p*.42)*.24+vn(p*1.4)*.09
      -.7*smoothstep(.2,.0,v.x)*step(.9,cell)
      -1.1*smoothstep(.06,.0,v.y-v.x)*smoothstep(.6,.72,fbm3(p*.006+3.)); }
  void main(){ vec2 px=uv*R;
    float h=hm(vec2(0));
    float dx=surf(vec2(1,0))-surf(vec2(-1,0)), dy=surf(vec2(0,1))-surf(vec2(0,-1));
    vec3 n=normalize(vec3(-dx,-dy,2.));
    float d=clamp(dot(n,normalize(LD)),0.,1.);
    float tone=fbm3(px*.009+4.);
    vec3 base=mix(vec3(.87,.69,.47),vec3(.73,.54,.35),tone);
    base=mix(base,vec3(.64,.58,.49),smoothstep(.58,.8,fbm3(px*.005+9.))*.35);
    base=mix(base,vec3(.76,.54,.38),smoothstep(.55,.75,fbm3(px*.007+21.))*.35);
    float sand=h21(floor(px*.9)); base*=.95+.08*sand; base+=vec3(.10,.09,.07)*step(.985,h21(floor(px*.5)+3.));
    float ao=clamp(-h,0.,1.);
    vec3 c=base*(.36+.78*d)*(1.-.34*ao);
    c=mix(c,vec3(.80,.74,.64),smoothstep(.75,1.15,ao)*.28*smoothstep(.35,.7,vn(px*.21)));   // dust settled in the grooves
    vec2 q=uv-.5; c*=1.-dot(q,q)*.3;
    O=vec4(c,1.); }`;
  // xuan paper with ink: M1 sharp mask, M2 wide blur for the bleed into the fibres
  const XUAN = `uniform sampler2D M1; uniform sampler2D M2;
  void main(){ vec2 px=uv*R;
    float f=vn(px*vec2(.6,.05)+3.)*.4+vn(px*vec2(.07,.5))*.3+vn(px*.3)*.3;
    vec3 paper=vec3(.958,.94,.885)*(.955+.06*f);
    float fib=smoothstep(.74,.95,vn(vec2(px.x*.035+px.y*.012,px.y*.6)))*.05+smoothstep(.76,.97,vn(vec2(px.x*.5,px.y*.03+px.x*.008)))*.045;
    paper-=fib*vec3(.28,.30,.34);
    paper-=vec3(.02,.03,.05)*smoothstep(.55,.9,fbm3(px*.01+2.));
    float m1=texture(M1,uv).r, m2=texture(M2,uv).r;
    float nz=fbm3(px*.17)*.6+vn(px*.9)*.4;
    float ink=smoothstep(.36,.62,m1+(nz-.5)*.34);
    float halo=smoothstep(.02,.5,m2)*(1.-ink)*(.10+.16*nz);
    float dry=smoothstep(.6,.9,vn(vec2(px.x*.10+px.y*.05,px.y*.75)))*smoothstep(.97,.62,m1)*.4;
    float dens=clamp(ink*(.94-dry)+halo,0.,1.);
    vec3 c=mix(paper,vec3(.075,.068,.062),dens);
    vec2 q=uv-.5; c*=1.-dot(q,q)*.12;
    O=vec4(c,1.); }`;
  // hard disk: cast base, mirror platter with concentric brushing and the anisotropic bow-tie highlight, hub clamp
  const PLATTER = `uniform vec2 C; uniform float RAD; uniform float HUB;
  void main(){ vec2 px=uv*R; vec2 q=px-C; float r=length(q), a=atan(q.y,q.x);
    vec3 base=vec3(.30,.31,.33)*(.88+.14*vn(px*1.7)+.08*fbm3(px*.03));
    base*=1.-.35*smoothstep(RAD+16.,RAD+3.,r);
    float br=vn(vec2(r*1.15,a*2.))*.55+vn(vec2(r*.31,a*.7+3.))*.45;
    float c2=max(0.,cos(2.*(a-.95)));
    float spec=pow(c2,10.)*.9+pow(c2,2.)*.2;
    float env=.5+.5*sin(a+.6);
    vec3 pl=vec3(.50,.52,.56)*(.70+.24*br)+vec3(.13,.13,.14)*env+spec*vec3(.96,.97,1.);
    pl*=.92+.08*smoothstep(RAD*.35,RAD,r);
    float rim=smoothstep(RAD-.5,RAD-2.5,r);
    float bevel=smoothstep(RAD-9.,RAD-4.,r);
    pl=mix(pl,pl*.7+.22,bevel*.8);
    vec3 c=mix(base,pl,rim);
    c*=1.-.28*smoothstep(HUB+10.,HUB,r);
    float hub=smoothstep(HUB+1.,HUB-1.,r);
    vec3 hc=vec3(.64,.65,.68)*(.86+.1*vn(vec2(r*2.,a*3.)))+pow(max(0.,cos(a-2.3)),4.)*.28;
    hc*=1.-.32*smoothstep(HUB-7.,HUB-1.,r);
    c=mix(c,hc,hub);
    float cap=smoothstep(HUB*.36+1.,HUB*.36-1.,r);
    c=mix(c,vec3(.42,.43,.46)+.28*pow(max(0.,cos(a-2.3)),3.),cap);
    O=vec4(c,1.); }`;

  // ---------- helpers ----------
  function chamfer(inside, w, h) {          // distance (px) from every inside pixel to the nearest outside pixel
    const d = new Float32Array(w * h), D1 = 1, D2 = 1.4142;
    for (let i = 0; i < w * h; i++) d[i] = inside[i] ? 1e6 : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + D1);
      if (y > 0) { v = Math.min(v, d[i - w] + D1); if (x > 0) v = Math.min(v, d[i - w - 1] + D2); if (x < w - 1) v = Math.min(v, d[i - w + 1] + D2); }
      d[i] = v;
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x; if (!d[i]) continue;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + D1);
      if (y < h - 1) { v = Math.min(v, d[i + w] + D1); if (x < w - 1) v = Math.min(v, d[i + w + 1] + D2); if (x > 0) v = Math.min(v, d[i + w - 1] + D2); }
      d[i] = v;
    }
    return d;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ---------- A: clay ----------
  function bakeClay() {
    const m = makeCanvas(SW, SH), g = m.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    font(g, 116, SERIF, 900); spaced(g, PHRASE, SW / 2, SH / 2 + 8, 8, 'center');
    const r = mulberry(77);
    // two lines of common Sumerian syllable signs (generic text: A AN BA DI E2 EN GAL I IGI KI LA LUGAL MA NI RA RI TI U UD)
    const SIGNS = [0x12000, 0x1202D, 0x12040, 0x12072, 0x1208D, 0x12097, 0x120F2, 0x1213F, 0x12146, 0x121A0, 0x121B7,
      0x12217, 0x12220, 0x1224C, 0x1228F, 0x12291, 0x122FE, 0x1230B, 0x12313];
    font(g, 31, '"Noto Sans Cuneiform"', 400);
    for (const yy of [56, SH - 52]) {
      let s = ''; for (let i = 0; i < 12; i++) s += String.fromCodePoint(SIGNS[Math.floor(r() * SIGNS.length)]);
      g.fillText(s, SW / 2, yy);
    }
    g.fillRect(26, 100, SW - 52, 3); g.fillRect(26, SH - 100, SW - 52, 3);      // ruling pressed with a taut cord
    const src = g.getImageData(0, 0, SW, SH).data, N = SW * SH;
    const ins = new Uint8Array(N), out = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const v = src[i * 4]; ins[i] = v > 127 ? 1 : 0; out[i] = 1 - ins[i]; }
    const dIn = chamfer(ins, SW, SH), dOut = chamfer(out, SW, SH);
    // along-stroke coordinate: run length from the left / top edge of each stroke. The stylus bites deepest where a
    // stroke starts (the wedge head) and the impression shallows towards its tail.
    const runL = new Float32Array(N), runU = new Float32Array(N);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const i = y * SW + x; if (!ins[i]) continue;
      runL[i] = x > 0 && ins[i - 1] ? runL[i - 1] + 1 : 0;
      runU[i] = y > 0 && ins[i - SW] ? runU[i - SW] + 1 : 0;
    }
    const hgt = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (ins[i]) {
        const k = Math.min(dIn[i] / 5, 1), along = Math.max(runL[i], runU[i]);
        const wedge = 1.3 - .55 * smooth(4, 70, along);
        hgt[i] = -(k * (1.15 - .15 * k)) * wedge;                                            // V-shaped stylus groove
      } else hgt[i] = .26 * Math.exp(-dOut[i] / 2.6) - .05 * Math.exp(-dOut[i] / 9);        // displaced clay lip
    }
    const sm = new Float32Array(N);                                                         // 3x3 smoothing
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      let s = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue;
        s += hgt[yy * SW + xx] * (i || j ? 1 : 2); n += i || j ? 1 : 2;
      }
      sm[y * SW + x] = s / n;
    }
    const id = g.createImageData(SW, SH);
    for (let i = 0; i < N; i++) {
      const v = Math.round(clamp((sm[i] + 1.5) / 2) * 65535);
      id.data[i * 4] = v >> 8; id.data[i * 4 + 1] = v & 255; id.data[i * 4 + 2] = 0; id.data[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    return [GL.bake(CLAY, SW, SH, { HM: m, LD: [-.6, .66, .46] }), GL.bake(CLAY, SW, SH, { HM: m, LD: [.62, .6, .5] })];
  }

  // ---------- B: xuan paper, brush and seal ----------
  function bakeXuan() {
    const m1 = makeCanvas(SW, SH), g1 = m1.getContext('2d');
    g1.fillStyle = '#000'; g1.fillRect(0, 0, SW, SH);
    g1.fillStyle = '#fff'; g1.textAlign = 'center'; g1.textBaseline = 'middle';
    g1.save(); g1.translate(SW / 2 - 26, SH / 2 + 4); g1.rotate(-.025);
    font(g1, 134, '"Zhi Mang Xing"', 400); g1.filter = 'blur(.9px)'; spaced(g1, PHRASE, 0, 0, -4, 'center');
    g1.restore(); g1.filter = 'none';
    const m2 = makeCanvas(SW, SH), g2 = m2.getContext('2d');
    g2.filter = 'blur(5px)'; g2.drawImage(m1, 0, 0); g2.filter = 'none';
    const c = GL.bake(XUAN, SW, SH, { M1: m1, M2: m2 }), g = c.getContext('2d');
    // the seal: a square of cinnabar paste with the phrase cut in relief (white characters), worn at the edges
    const s = 58, sx = SW - 112, sy = SH - 128, seal = makeCanvas(s + 8, s + 8), q = seal.getContext('2d');
    q.fillStyle = '#B23A2A'; rr(q, 4, 4, s, s, 3); q.fill();
    q.globalCompositeOperation = 'destination-out';
    q.strokeStyle = '#000'; q.lineWidth = 2.2; q.strokeRect(9, 9, s - 10, s - 10);
    font(q, 23, SERIF, 900); q.textAlign = 'center'; q.textBaseline = 'middle';
    const ch4 = [...PHRASE];
    [[1, 0], [1, 1], [0, 0], [0, 1]].forEach(([cx, cy], k) => q.fillText(ch4[k] || '', 4 + s * (.29 + .42 * cx) + 1, 4 + s * (.29 + .42 * cy) + 1));
    const r = mulberry(31);
    for (let k = 0; k < 150; k++) { const x = r() * (s + 8), y = r() * (s + 8), rad = .4 + r() * 1.3; q.beginPath(); q.arc(x, y, rad, 0, TAU); q.fill(); }
    q.globalCompositeOperation = 'source-over';
    g.save(); g.globalAlpha = .9; g.globalCompositeOperation = 'multiply'; g.translate(sx, sy); g.rotate(.03); g.drawImage(seal, 0, 0); g.restore();
    return c;
  }

  // ---------- C: hard-disk platter, actuator arm ----------
  const PC = { x: 292, y: 218 }, PR = 262, HUB = 60, TRK = 176;
  function bakePlatter() {
    const c = GL.bake(PLATTER, SW, SH, { C: [PC.x, SH - PC.y], RAD: PR, HUB }), g = c.getContext('2d');
    for (let k = 0; k < 6; k++) {                       // clamp screws
      const a = k * TAU / 6 + .3, x = PC.x + Math.cos(a) * HUB * .68, y = PC.y + Math.sin(a) * HUB * .68;
      g.fillStyle = '#3A3D42'; g.beginPath(); g.arc(x, y, 5.2, 0, TAU); g.fill();
      g.fillStyle = '#9A9EA5'; g.beginPath(); g.arc(x - .8, y - .8, 3.2, 0, TAU); g.fill();
      g.strokeStyle = '#3A3D42'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 2.4, y - 2.4); g.lineTo(x + 1.6, y + 1.6); g.stroke();
    }
    return c;
  }
  const PIV = { x: 560, y: 402 }, HEAD_A = -.42;
  function bakeArm() {
    const c = makeCanvas(SW, SH), g = c.getContext('2d');
    const hx = PC.x + Math.cos(HEAD_A) * TRK, hy = PC.y + Math.sin(HEAD_A) * TRK;
    const ang = Math.atan2(hy - PIV.y, hx - PIV.x), L = Math.hypot(hx - PIV.x, hy - PIV.y);
    const arm = new Path2D();
    arm.moveTo(-40, -30); arm.lineTo(L * .55, -13); arm.lineTo(L - 6, -6); arm.lineTo(L + 4, -5); arm.lineTo(L + 4, 5); arm.lineTo(L - 6, 6);
    arm.lineTo(L * .55, 13); arm.lineTo(-40, 30); arm.closePath();
    const hole = new Path2D(); hole.moveTo(L * .2, -9); hole.lineTo(L * .47, -6); hole.lineTo(L * .47, 6); hole.lineTo(L * .2, 9); hole.closePath();
    const coil = new Path2D(); coil.moveTo(-30, -36); coil.lineTo(-120, -64); coil.lineTo(-120, 64); coil.lineTo(-30, 36); coil.closePath();
    g.save(); g.translate(PIV.x + 7, PIV.y + 9); g.rotate(ang);            // shadow on the platter
    g.filter = 'blur(5px)'; g.fillStyle = 'rgba(0,0,0,.42)'; g.fill(arm); g.fill(coil);
    g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); g.restore(); g.filter = 'none';
    g.save(); g.translate(PIV.x, PIV.y); g.rotate(ang);
    g.fillStyle = '#2A2C30'; g.fill(coil);
    let gr = g.createLinearGradient(0, -30, 0, 30);
    gr.addColorStop(0, '#D9DCE0'); gr.addColorStop(.45, '#B4B8BE'); gr.addColorStop(1, '#7D838A');
    g.fillStyle = gr; g.fill(arm);
    g.save(); g.clip(hole); g.fillStyle = 'rgba(20,20,24,.55)'; g.fill(hole); g.restore();
    g.strokeStyle = 'rgba(40,42,46,.6)'; g.lineWidth = 1.2; g.stroke(arm); g.stroke(hole);
    g.fillStyle = '#C9A15A'; g.fillRect(L * .2, -1, L * .74, 2);               // flex lead to the head
    g.fillStyle = '#26282C'; g.fillRect(L - 8, -6.5, 12, 13);                 // slider
    g.fillStyle = '#5A5E66'; g.fillRect(L - 6, -4, 8, 3);
    gr = g.createRadialGradient(-8, -10, 4, 0, 0, 40);
    gr.addColorStop(0, '#E2E4E8'); gr.addColorStop(.6, '#9DA2A9'); gr.addColorStop(1, '#5E636A');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 38, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(30,30,34,.6)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#6C7178'; g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill();
    g.fillStyle = '#B9BDC3'; g.beginPath(); g.arc(-2, -2, 8, 0, TAU); g.fill();
    g.restore();
    return c;
  }
  function platterFrame(g, t) {
    g.drawImage(SWC[2], 0, 0);
    // the bytes of 我在这里 ride their track and pass under the head
    g.save(); g.beginPath(); g.arc(PC.x, PC.y, PR - 4, 0, TAU); g.arc(PC.x, PC.y, HUB + 8, 0, TAU, true); g.clip('evenodd');
    font(g, 19, '"JetBrains Mono"', 500); g.textAlign = 'center'; g.textBaseline = 'middle';
    font(g, 19, '"JetBrains Mono"', 500);
    let a = -Math.PI / 2 - g.measureText(HEX).width / TRK / 2 + t * .3;   // upright at the top on the cover, then it turns
    for (const c of HEX) {
      const w = g.measureText(c).width; a += w / 2 / TRK;
      if (c !== ' ') {
        g.save(); g.translate(PC.x + Math.cos(a) * TRK, PC.y + Math.sin(a) * TRK); g.rotate(a + Math.PI / 2);
        g.fillStyle = 'rgba(24,28,34,.74)'; g.fillText(c, 0, 0); g.restore();
      }
      a += w / 2 / TRK;
    }
    g.strokeStyle = 'rgba(24,28,34,.10)'; g.lineWidth = 1;
    for (const k of [-13, 13]) { g.beginPath(); g.arc(PC.x, PC.y, TRK + k, 0, TAU); g.stroke(); }
    g.restore();
    g.drawImage(ARM, 0, 0);
  }

  // ---------- D: a slice of a data-centre rack ----------
  let LEDS = [];
  function bakeRack() {
    const c = makeCanvas(SW, SH), g = c.getContext('2d');
    const FL = 44, FR = SW - 44;                         // white cabinet frame either side
    g.fillStyle = '#15181C'; g.fillRect(0, 0, SW, SH);
    for (const [x0, x1, dir] of [[0, FL, 1], [FR, SW, -1]]) {
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, dir > 0 ? '#E6E9ED' : '#B9BFC6'); gr.addColorStop(1, dir > 0 ? '#C3C9D0' : '#E3E6EA');
      g.fillStyle = gr; g.fillRect(x0, 0, x1 - x0, SH);
      g.fillStyle = 'rgba(60,66,74,.35)';
      for (let y = 4; y < SH; y += 7) for (let x = x0 + 6 + (Math.floor(y / 7) % 2) * 3; x < x1 - 4; x += 6) g.fillRect(x, y, 2, 2);
    }
    const RL = FL + 4, RR = FR - 4, U = 37;
    for (const x of [RL, RR - 18]) {                      // mounting rails with square holes, three per U
      g.fillStyle = '#4A5059'; g.fillRect(x, 0, 18, SH);
      g.fillStyle = '#0D0F12'; for (let y = -6; y < SH; y += U / 3) g.fillRect(x + 5, y + 4, 8, 8);
    }
    LEDS = [];
    const r = mulberry(12);
    const plate = (y, h) => {
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#3A4049'); gr.addColorStop(.08, '#2C3139'); gr.addColorStop(1, '#22262C');
      g.fillStyle = gr; g.fillRect(RL + 6, y + 1, RR - RL - 12, h - 2);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(RL + 6, y + 1, RR - RL - 12, 1);
      g.fillStyle = '#5C636D'; for (const x of [RL + 9, RR - 15]) { g.beginPath(); g.arc(x + 3, y + h / 2, 3, 0, TAU); g.fill(); }
    };
    const mesh = (x0, y0, x1, y1) => {
      g.fillStyle = '#0E1013';
      for (let y = y0 + 3, k = 0; y < y1 - 2; y += 4.2, k++) for (let x = x0 + 3 + (k % 2) * 2.4; x < x1 - 2; x += 4.8) { g.beginPath(); g.arc(x, y, 1.45, 0, TAU); g.fill(); }
    };
    const units = ['server', 'switch', 'storage', 'server', 'server', 'storage', 'switch', 'server'];
    let y = -20;
    for (const kind of units) {
      const h = kind === 'storage' ? 2 * U : U;
      plate(y, h);
      const x0 = RL + 26, x1 = RR - 26;
      if (kind === 'server') {
        for (let i = 0; i < 8; i++) {                     // 2.5" drive sleds
          const sx = x0 + i * 25; g.fillStyle = '#16191D'; g.fillRect(sx, y + 4, 22, h - 8);
          g.fillStyle = '#3B414A'; g.fillRect(sx + 2, y + 6, 18, h - 16);
          LEDS.push({ x: sx + 6, y: y + h - 7, kind: 'act', s: r() });
        }
        mesh(x0 + 208, y + 5, x1 - 44, y + h - 4);
        g.fillStyle = '#4E555F'; g.beginPath(); g.arc(x1 - 22, y + h / 2, 6, 0, TAU); g.fill();
        LEDS.push({ x: x1 - 8, y: y + h / 2, kind: r() < .2 ? 'warn' : 'blue', s: r() });
      } else if (kind === 'switch') {
        for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) {   // RJ45 ports, link LEDs on each
          const px = x0 + 6 + i * 23 + (i >= 6 ? 8 : 0), py = y + 7 + j * 13;
          g.fillStyle = '#0A0B0D'; g.fillRect(px, py, 15, 10);
          g.fillStyle = '#23272D'; g.fillRect(px + 3, py + 6, 9, 4);
          LEDS.push({ x: px + 13, y: py + 2, kind: r() < .75 ? 'link' : 'off', s: r(), sq: 1 });
        }
        for (let i = 0; i < 4; i++) { g.fillStyle = '#0A0B0D'; g.fillRect(x1 - 100 + i * 24, y + 9, 19, 19); g.fillStyle = '#6B727C'; g.fillRect(x1 - 98 + i * 24, y + 11, 15, 15); g.fillStyle = '#0A0B0D'; g.fillRect(x1 - 96 + i * 24, y + 13, 11, 11); }
      } else if (kind === 'storage') {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {    // twelve 3.5" bays
          const bx = x0 + i * 103, by = y + 5 + j * 22, bw = 98;
          g.fillStyle = '#121418'; g.fillRect(bx, by, bw, 19);
          g.fillStyle = '#353B44'; g.fillRect(bx + 2, by + 2, bw - 4, 15);
          g.fillStyle = '#20242A'; for (let k = 0; k < 7; k++) g.fillRect(bx + 8 + k * 9, by + 5, 5, 9);
          g.fillStyle = '#7A818B'; g.fillRect(bx + bw - 24, by + 4, 3, 11);
          LEDS.push({ x: bx + bw - 12, y: by + 6, kind: 'act', s: r() });
          LEDS.push({ x: bx + bw - 12, y: by + 13, kind: 'ok', s: r() });
        }
      }
      y += h;
    }
    const sh = g.createLinearGradient(0, 0, 0, SH);                  // overhead light falloff
    sh.addColorStop(0, 'rgba(255,255,255,.05)'); sh.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = sh; g.fillRect(FL, 0, FR - FL, SH);
    return c;
  }
  function rackFrame(g, t) {
    g.drawImage(SWC[3], 0, 0);
    const COL = { act: '#46D483', ok: '#46D483', link: '#46D483', blue: '#59A8FF', warn: '#F2A52B' };
    for (const L of LEDS) {
      if (L.kind === 'off') continue;
      let on = 1;
      if (L.kind === 'act') on = hash2(Math.floor(t * 9 + L.s * 50), Math.round(L.x * 7 + L.y)) > .45 ? 1 : .15;
      else if (L.kind === 'link') on = hash2(Math.floor(t * 6 + L.s * 30), Math.round(L.x + L.y * 3)) > .25 ? 1 : .2;
      else if (L.kind === 'warn') on = Math.floor(t * 1.6 + L.s) % 2 ? 1 : .2;
      const col = COL[L.kind];
      g.fillStyle = on > .5 ? col : '#1C2026';
      if (L.sq) g.fillRect(L.x - 2, L.y - 1.5, 4, 3); else { g.beginPath(); g.arc(L.x, L.y, 2.3, 0, TAU); g.fill(); }
      if (on > .5) { g.fillStyle = rgba(col, .22); g.beginPath(); g.arc(L.x, L.y, 6, 0, TAU); g.fill(); }
    }
  }

  // ---------- state baked in init ----------
  let paper, SWC = [], ARM, CLAY_L, CLAY_R, work, shadowSpr;

  // ---------- beats ----------
  const bump = u => u <= 0 || u >= .5 ? 0 : Math.sin(u / .5 * Math.PI) * Math.exp(-u * 3.2) / .62;
  function drawCard(ctx, i, t, x, y, lift, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    // mounted specimen: soft shadow on the paper
    ctx.globalAlpha = alpha * (.75 + .25 * lift);
    ctx.drawImage(shadowSpr, x - 60 + lift * 2, y - 60 + 8 + lift * 12);
    ctx.globalAlpha = alpha;
    const s = 1 + .045 * lift;
    ctx.translate(x + CW / 2, y + CHT / 2 - 12 * lift); ctx.scale(s, s); ctx.translate(-CW / 2, -CHT / 2);
    let src = SWC[i];
    if (i === 0) {                                                 // raking light slowly travels across the clay
      const k = smooth(4.4, 6.9, t);
      if (k > 0 && k < 1) { const g = work[0].getContext('2d'); g.globalAlpha = 1; g.drawImage(CLAY_L, 0, 0); g.globalAlpha = k; g.drawImage(CLAY_R, 0, 0); g.globalAlpha = 1; src = work[0]; }
      else src = k >= 1 ? CLAY_R : CLAY_L;
    } else if (i === 2) { platterFrame(work[2].getContext('2d'), t); src = work[2]; }
    else if (i === 3) { rackFrame(work[3].getContext('2d'), t); src = work[3]; }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, CW, CHT);
    ctx.strokeStyle = 'rgba(27,23,18,.28)'; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, CW - 1, CHT - 1);
    ctx.restore();
  }
  function questionLine(ctx, str, x, y, a) {
    let cx = x;
    for (const part of str.split(/(“[^”]*”)/)) {
      if (!part) continue;
      if (part[0] === '“') {
        const inner = part.slice(1, -1);
        ctx.fillStyle = rgba(INK, a); ctx.fillText('“', cx, y); cx += ctx.measureText('“').width;
        ctx.fillStyle = rgba(RED, a); ctx.fillText(inner, cx, y); cx += ctx.measureText(inner).width;
        ctx.fillStyle = rgba(INK, a); ctx.fillText('”', cx, y); cx += ctx.measureText('”').width;
      } else { ctx.fillStyle = rgba(INK, a); ctx.fillText(part, cx, y); cx += ctx.measureText(part).width; }
    }
  }
  function bet(ctx, t) {
    const exitT = smooth(6.72, 7.12, t);
    if (t >= 7.32) return;                                   // the last swatch (D) finishes leaving at 6.90 + .40
    ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    // question (the cover), leaves as the reveal lands
    const qOut = smooth(3.16, 3.4, t);
    if (qOut < 1) {
      const [l1, l2] = HK.question.split('\n');
      font(ctx, QS, SERIF, 900);
      questionLine(ctx, l1, QX, QY1 - qOut * 26, 1 - qOut);
      questionLine(ctx, l2, QX, QY2 - qOut * 26, 1 - qOut);
    }
    // countdown beside the question
    if (t > 1.0 && t < 3.4) {
      const k = Math.min(2, Math.floor((t - 1.05) / .75)), f = clamp((t - 1.05 - k * .75) / .75);
      const lastOut = smooth(3.16, 3.38, t);
      const inK = ease.out(clamp((t - 1.05 - k * .75) / .22));
      const a = (t < 1.05 ? 0 : 1) * (1 - lastOut) * Math.min(1, inK * 1.4);
      if (a > 0) {
        ctx.save();
        ctx.strokeStyle = rgba(RED, .16 * a); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(CDX, CDY, 108, 0, TAU); ctx.stroke();
        ctx.strokeStyle = rgba(RED, .85 * a); ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(CDX, CDY, 108, -Math.PI / 2 + TAU * f, -Math.PI / 2 + TAU); ctx.stroke();
        const s = 1 + .22 * (1 - inK);
        ctx.translate(CDX, CDY); ctx.scale(s, s);
        font(ctx, 178, SERIF, 900); ctx.textAlign = 'center';
        const m = ctx.measureText(COUNT[k]);
        ctx.fillStyle = rgba(RED, a);
        ctx.fillText(COUNT[k], 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
        ctx.restore();
      }
    }
    // reveal replaces the question
    // the punchline is fully inked on the impact (3.5) and settles from a slight overscale; the lead-in eases in with it
    const rv = smooth(3.34, 3.5, t);
    if (rv > 0) {
      const [r1, r2] = HK.reveal.split('\n');
      const a = 1 - exitT, kL = ease.out(clamp((t - 3.36) / .45));
      font(ctx, 48, SERIF, 700); ctx.fillStyle = rgba(SUB, a * kL);
      ctx.fillText(r1, QX, QY1 - 14 - 10 * (1 - kL) - exitT * 18);
      const land = ease.out(clamp((t - 3.38) / .34)), s = 1 + .07 * (1 - land);
      ctx.save(); ctx.translate(QX, QY2 - 6 - exitT * 18); ctx.scale(s, s);
      font(ctx, 84, SERIF, 900); ctx.fillStyle = rgba(INK, a * rv);
      ctx.fillText(r2, 0, 0);
      ctx.restore();
    }
    // swatches, labels, lifetimes
    for (let i = 0; i < 4; i++) {
      const x = X0 + i * (CW + GAP);
      const ex = smooth(6.72 + i * .06, 7.12 + i * .06, t), a = 1 - ex, dy = -ex * 22;
      if (a <= 0) continue;
      const lift = bump(t - (.45 + i * .15));
      drawCard(ctx, i, t, x, ROW_Y + dy, lift + ex * .7, a);   // they lift off the paper as they leave
      const yb = ROW_Y + CHT + dy;
      font(ctx, 40, SERIF, 900); ctx.fillStyle = rgba(RED, a); ctx.fillText(OPT[i].key, x, yb + 64);
      const kw = ctx.measureText(OPT[i].key).width;
      font(ctx, 36, SERIF, 700); ctx.fillStyle = rgba(INK, a); ctx.fillText(OPT[i].name, x + kw + 14, yb + 63);
      const lv = ease.out(clamp((t - 3.8 - i * .25) / .5));
      if (lv > 0) {
        const life = HK.option_life[i];
        if (i === 3) font(ctx, 46, SERIF, 900); else font(ctx, 30, SANS, 700);
        ctx.fillStyle = rgba(i === 0 ? RED : SUB, a * lv);
        ctx.fillText(life, i === 3 ? x - 6 : x, yb + (i === 3 ? 124 : 118) + (1 - lv) * 8);
        const by = yb + 136, frac = [1, .4, .012, 1][i];
        if (i < 3) {
          ctx.fillStyle = rgba(i === 0 ? RED : INK, a * (i === 0 ? 1 : .72));
          ctx.fillRect(x, by, Math.max(3, CW * frac * lv), 9);
          ctx.fillStyle = rgba(INK, a * .10); ctx.fillRect(x, by + 4, CW, 1);
        } else {
          ctx.save(); ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 14;
          ctx.strokeStyle = rgba(INK, a * .55 * lv); ctx.lineWidth = 1.6;
          ctx.strokeRect(x + .8, by + .8, CW * lv - 1.6, 8.4); ctx.restore();
        }
      }
    }
    ctx.restore();
  }
  function titleCard(ctx, t) {
    const out = smooth(11.3, 11.85, t);
    if (t < 7.15 || out >= 1) return;
    ctx.save(); ctx.textBaseline = 'alphabetic';
    const drift = -out * 16 + (t - 7.2) * 2.2;
    font(ctx, 132, SERIF, 900);
    const chars = [...HK.title], ws = chars.map(c => ctx.measureText(c).width), sp = 20;
    let cx = W / 2 - (ws.reduce((p, q) => p + q, 0) + sp * (chars.length - 1)) / 2;
    chars.forEach((c, i) => {
      const k = ease.out(clamp((t - 7.2 - i * .075) / .6));
      ctx.fillStyle = rgba(INK, k * (1 - out));
      ctx.fillText(c, cx, TY + (1 - k) * 24 + drift);
      cx += ws[i] + sp;
    });
    const k2 = ease.out(clamp((t - 7.85) / .6));
    font(ctx, 40, SERIF, 600); ctx.fillStyle = rgba(SUB, k2 * (1 - out));
    spaced(ctx, HK.subtitle, W / 2, TY + 84 + (1 - k2) * 10 + drift, 12, 'center');
    const k3 = ease.out(clamp((t - 8.45) / .6));
    font(ctx, 26, SANS, 400); ctx.fillStyle = rgba(MUTE, k3 * (1 - out));
    spaced(ctx, HK.series, W / 2, RULE_Y + 58 + drift * .5, 6, 'center');
    ctx.restore();
  }
  // the cinnabar rule under the subtitle; at 11.6 it is pulled out into a thread across the paper, then released
  function thread(ctx, t) {
    if (t < 8.1) return;
    const grow = ease.out(clamp((t - 8.1) / .45));
    const pull = ease.inOut(clamp((t - 11.55) / .6));
    const half = lerp(32 * grow, W / 2 + 140, pull);
    const tau = t - 12.15;
    const sag = tau <= 0 ? 0 : 66 * (1 - Math.exp(-2.6 * tau) * (Math.cos(6.4 * tau) + .4 * Math.sin(6.4 * tau)));
    const wob = pull > 0 && pull < 1 ? Math.sin(pull * Math.PI) * 3 : 0;
    const yAt = x => RULE_Y + (sag + wob) * (1 - Math.pow((x - W / 2) / (W / 2 + 140), 2));
    const lw = lerp(3.2, 5.2, pull);
    const x0 = W / 2 - half, x1 = W / 2 + half;
    if (pull <= 0) { ctx.fillStyle = RED; ctx.fillRect(x0, RULE_Y - 1.6, x1 - x0, 3.2); return; }
    const path = new Path2D();
    for (let x = x0, k = 0; x <= x1 + .1; x += 24, k++) k ? path.lineTo(x, yAt(x)) : path.moveTo(x, yAt(x));
    path.lineTo(x1, yAt(x1));
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(70,40,26,.22)'; ctx.lineWidth = lw * .8; ctx.translate(1, 3.2); ctx.stroke(path); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = RED; ctx.lineWidth = lw; ctx.stroke(path);
    // two-ply twist: short diagonal ply lines along the thread
    if (pull > .15) {
      const tw = new Path2D(), hi = new Path2D(), step = 5.5;
      for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) {
        const y = yAt(x), d = lw * .42;
        tw.moveTo(x - d, y - d); tw.lineTo(x + d, y + d);
        hi.moveTo(x - d + 2.2, y - d * .7); hi.lineTo(x + d * .2 + 2.2, y);
      }
      ctx.globalAlpha = smooth(.15, .6, pull);
      ctx.lineCap = 'butt'; ctx.strokeStyle = 'rgba(128,38,24,.55)'; ctx.lineWidth = 1.1; ctx.stroke(tw);
      ctx.strokeStyle = 'rgba(224,132,108,.5)'; ctx.lineWidth = 1; ctx.stroke(hi);
    }
    ctx.restore();
  }

  scene({
    id: 'hook', dur: DUR, trans: null,
    cues: [
      { t: .45, sfx: 'blip', v: .5 }, { t: .60, sfx: 'blip', v: .5 }, { t: .75, sfx: 'blip', v: .5 }, { t: .90, sfx: 'blip', v: .5 },
      { t: 1.05, sfx: 'tick', v: .75 }, { t: 1.80, sfx: 'tick', v: .75 }, { t: 2.55, sfx: 'tick', v: .75 },
      { t: 3.5, sfx: 'impact', v: .9 },
      { t: 3.8, sfx: 'chime', v: .6 }, { t: 4.05, sfx: 'chime', v: .5 }, { t: 4.3, sfx: 'chime', v: .45 }, { t: 4.55, sfx: 'chime', v: .35 },
      { t: 6.75, sfx: 'whoosh', v: .3 }, { t: 7.2, sfx: 'paper', v: .35 },
      { t: 11.8, sfx: 'rope', v: .8 },
    ],
    init() {
      paper = GL.bake(PAPER, W, H);
      [CLAY_L, CLAY_R] = bakeClay();
      SWC = [CLAY_L, bakeXuan(), bakePlatter(), bakeRack()];
      ARM = bakeArm();
      work = [0, 1, 2, 3].map(() => makeCanvas(SW, SH));
      shadowSpr = makeCanvas(CW + 120, CHT + 120);
      const g = shadowSpr.getContext('2d');
      g.filter = 'blur(13px)'; g.fillStyle = 'rgba(52,38,24,.34)'; g.fillRect(60, 60, CW, CHT); g.filter = 'none';
    },
    draw(ctx, t) {
      ctx.drawImage(paper, 0, 0);
      bet(ctx, t);
      titleCard(ctx, t);
      thread(ctx, t);
      grain(ctx, t, .03);
    },
  });
})();
