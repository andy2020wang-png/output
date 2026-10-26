// 结尾 — back to the exhibition-label paper of the hook. A lifetime chart of the twelve media, the four swatches of the
// opening bet (A wins, D stays a question), the golden line set large, a phone photo that decays into a broken-image
// placeholder, and a lab spectrogram of this film's own soundtrack in which the words 我在这里 appear. End card.
'use strict';
(() => {
  const O = SCRIPT.outro;
  const DUR = 37.5;
  const PAPER_C = '#F2EFE8', INK = '#1B1712', RED = '#B0412E', SUB = '#5B5249', MUTE = '#8A8178';
  const SEGS = [[1.4, 5.8], [6.2, 10.4], [10.8, 14.6], [15.0, 20.0], [20.4, 24.4], [24.8, 30.6]];
  const SUBCH = { cards: [0, 1, 2, 4, 5].map(i => O.cards[i]), segs: [0, 1, 2, 4, 5].map(i => SEGS[i]), notes: {} };
  const TAU = Math.PI * 2;
  // draw a glyph with its ink (not its em box) centred on (x, y): the full-width ？ sits in the left half of its box
  function inkCentre(g, ch, x, y) {
    const pa = g.textAlign, pb = g.textBaseline; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const m = g.measureText(ch);
    g.fillText(ch, x + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2, y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    g.textAlign = pa; g.textBaseline = pb;
  }

  // ---------- incoming transition: the data centre's last lights go out, then the paper is lit ----------
  const LIGHTSOUT = `uniform sampler2D A; uniform sampler2D B; uniform float P;
  void main(){ vec2 p=uv, px=uv*R;
    vec3 a=texture(A,p).rgb, b=texture(B,p).rgb;
    float mx=max(a.r,max(a.g,a.b)), mn=min(a.r,min(a.g,a.b));
    float warm=smoothstep(.02,.10,a.r-a.b)*smoothstep(.08,.2,mx);                 // the amber status light and its spill
    float led=max(smoothstep(.10,.28,mx-mn)*smoothstep(.22,.45,mx), warm);       // any coloured light
    float ws=step(.001,warm);
    vec2 cell=floor(px/40.), key=mix(cell,vec2(7.,3.),ws);
    float tOff=mix(.04+.16*h21(cell*.71+3.1), .32, ws);                            // the others go first, the warm one last
    float flick=step(.4,h21(key+floor(P*80.)));
    float on=(1.-step(tOff,P))*mix(1.,flick,smoothstep(tOff-.08,tOff,P));
    vec3 col=a;
    if(led*(1.-on)>0.){                                                             // unlit: the darkest surface around it
      vec3 off=a;
      for(int i=0;i<8;i++){ float an=float(i)*.7854; off=min(off,texture(A,p+vec2(cos(an),sin(an))*40./R).rgb); }
      col=mix(a,off,led*(1.-on));
    }
    col*=1.-.55*smoothstep(.16,.46,P);                                        // the hall dims (to ~45 %), never black
    float r=length((p-.5)*vec2(R.x/R.y,1.));
    float n=fbm3(px*.002+2.);
    float k=smoothstep(.40,.72,P-r*.10+(n-.5)*.05);                          // the label paper takes over, centre a beat first
    float up=mix(.42,1.,smoothstep(.42,.98,P-r*.06));                         // and the gallery light comes up on it
    O=vec4(mix(col, b*up, k),1.); }`;
  TRANS.outro_lightsout = (ctx, A, B, p) => {
    ctx.drawImage(GL.run(LIGHTSOUT, W, H, { A, B, P: p }), 0, 0);
  };

  // ---------- baked materials (the swatches are the hook's own, so the bet returns exactly as it was shown) ----------
  const HK = SCRIPT.hook;
  const PHRASE = (HK.question.match(/“([^”]+)”/) || [0, '我在这里'])[1];
  const HEX = [...new TextEncoder().encode(PHRASE)].map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  const SERIF = '"Noto Serif SC"';
  const PAPER = `
  void main(){ vec2 px=uv*R; float f=vn(px*vec2(.9,.06))*.5+vn(px*vec2(.05,.8))*.3+fbm(px*.004)*.4;
    vec3 c=vec3(.949,.937,.91)*(.965+.05*f); vec2 q=uv-.5; c*=1.-q.y*q.y*.3-q.x*q.x*.035; O=vec4(c,1.); }`;
  // clay: a height map (16 bit in R,G) of stylus impressions with raised lips, lit from LD
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
    c=mix(c,vec3(.80,.74,.64),smoothstep(.75,1.15,ao)*.28*smoothstep(.35,.7,vn(px*.21)));
    vec2 q=uv-.5; c*=1.-dot(q,q)*.3;
    O=vec4(c,1.); }`;
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

  const SW = 558, SH = 405;           // swatch bake size (drawn at 2/3 in the row, as in the hook)
  let paper, SWC = [], ARM, CLAY_L, CLAY_R, work = [], shadowSpr, LEDS = [], spec, specGlow, photo, LUT;

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
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // A: clay tablet, 我在这里 pressed with a stylus between two lines of generic Sumerian syllable signs
  function bakeClay() {
    const m = makeCanvas(SW, SH), g = m.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    font(g, 116, SERIF, 900); spaced(g, PHRASE, SW / 2, SH / 2 + 8, 8, 'center');
    const r = mulberry(77);
    const SIGNS = [0x12000, 0x1202D, 0x12040, 0x12072, 0x1208D, 0x12097, 0x120F2, 0x1213F, 0x12146, 0x121A0, 0x121B7,
      0x12217, 0x12220, 0x1224C, 0x1228F, 0x12291, 0x122FE, 0x1230B, 0x12313];
    font(g, 31, '"Noto Sans Cuneiform"', 400);
    for (const yy of [56, SH - 52]) {
      let s = ''; for (let i = 0; i < 12; i++) s += String.fromCodePoint(SIGNS[Math.floor(r() * SIGNS.length)]);
      g.fillText(s, SW / 2, yy);
    }
    g.fillRect(26, 100, SW - 52, 3); g.fillRect(26, SH - 100, SW - 52, 3);
    const src = g.getImageData(0, 0, SW, SH).data, N = SW * SH;
    const ins = new Uint8Array(N), out = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const v = src[i * 4]; ins[i] = v > 127 ? 1 : 0; out[i] = 1 - ins[i]; }
    const dIn = chamfer(ins, SW, SH), dOut = chamfer(out, SW, SH);
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
        hgt[i] = -(k * (1.15 - .15 * k)) * wedge;
      } else hgt[i] = .26 * Math.exp(-dOut[i] / 2.6) - .05 * Math.exp(-dOut[i] / 9);
    }
    const sm = new Float32Array(N);
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
  // B: xuan paper, brush and a cinnabar seal cut with the phrase
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
    const s = 58, sx = SW - 112, sy = SH - 128, seal = makeCanvas(s + 8, s + 8), q = seal.getContext('2d');
    q.fillStyle = '#B23A2A'; rrect(q, 4, 4, s, s, 3); q.fill();
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
  // C: hard-disk platter whose track carries the UTF-8 bytes of the phrase, with the actuator arm
  const PC = { x: 292, y: 218 }, PR = 262, HUB = 60, TRK = 176;
  function bakePlatter() {
    const c = GL.bake(PLATTER, SW, SH, { C: [PC.x, SH - PC.y], RAD: PR, HUB }), g = c.getContext('2d');
    for (let k = 0; k < 6; k++) {
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
    g.save(); g.translate(PIV.x + 7, PIV.y + 9); g.rotate(ang);
    g.filter = 'blur(5px)'; g.fillStyle = 'rgba(0,0,0,.42)'; g.fill(arm); g.fill(coil);
    g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); g.restore(); g.filter = 'none';
    g.save(); g.translate(PIV.x, PIV.y); g.rotate(ang);
    g.fillStyle = '#2A2C30'; g.fill(coil);
    let gr = g.createLinearGradient(0, -30, 0, 30);
    gr.addColorStop(0, '#D9DCE0'); gr.addColorStop(.45, '#B4B8BE'); gr.addColorStop(1, '#7D838A');
    g.fillStyle = gr; g.fill(arm);
    g.save(); g.clip(hole); g.fillStyle = 'rgba(20,20,24,.55)'; g.fill(hole); g.restore();
    g.strokeStyle = 'rgba(40,42,46,.6)'; g.lineWidth = 1.2; g.stroke(arm); g.stroke(hole);
    g.fillStyle = '#C9A15A'; g.fillRect(L * .2, -1, L * .74, 2);
    g.fillStyle = '#26282C'; g.fillRect(L - 8, -6.5, 12, 13);
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
    g.save(); g.beginPath(); g.arc(PC.x, PC.y, PR - 4, 0, TAU); g.arc(PC.x, PC.y, HUB + 8, 0, TAU, true); g.clip('evenodd');
    font(g, 19, '"JetBrains Mono"', 500); g.textAlign = 'center'; g.textBaseline = 'middle';
    let a = -Math.PI / 2 - g.measureText(HEX).width / TRK / 2 + t * .3;
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
  // D: a slice of a data-centre rack
  function bakeRack() {
    const c = makeCanvas(SW, SH), g = c.getContext('2d');
    const FL = 44, FR = SW - 44;
    g.fillStyle = '#15181C'; g.fillRect(0, 0, SW, SH);
    for (const [x0, x1, dir] of [[0, FL, 1], [FR, SW, -1]]) {
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, dir > 0 ? '#E6E9ED' : '#B9BFC6'); gr.addColorStop(1, dir > 0 ? '#C3C9D0' : '#E3E6EA');
      g.fillStyle = gr; g.fillRect(x0, 0, x1 - x0, SH);
      g.fillStyle = 'rgba(60,66,74,.35)';
      for (let y = 4; y < SH; y += 7) for (let x = x0 + 6 + (Math.floor(y / 7) % 2) * 3; x < x1 - 4; x += 6) g.fillRect(x, y, 2, 2);
    }
    const RL = FL + 4, RR = FR - 4, U = 37;
    for (const x of [RL, RR - 18]) {
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
        for (let i = 0; i < 8; i++) {
          const sx = x0 + i * 25; g.fillStyle = '#16191D'; g.fillRect(sx, y + 4, 22, h - 8);
          g.fillStyle = '#3B414A'; g.fillRect(sx + 2, y + 6, 18, h - 16);
          LEDS.push({ x: sx + 6, y: y + h - 7, kind: 'act', s: r() });
        }
        mesh(x0 + 208, y + 5, x1 - 44, y + h - 4);
        g.fillStyle = '#4E555F'; g.beginPath(); g.arc(x1 - 22, y + h / 2, 6, 0, TAU); g.fill();
        LEDS.push({ x: x1 - 8, y: y + h / 2, kind: r() < .2 ? 'warn' : 'blue', s: r() });
      } else if (kind === 'switch') {
        for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) {
          const px = x0 + 6 + i * 23 + (i >= 6 ? 8 : 0), py = y + 7 + j * 13;
          g.fillStyle = '#0A0B0D'; g.fillRect(px, py, 15, 10);
          g.fillStyle = '#23272D'; g.fillRect(px + 3, py + 6, 9, 4);
          LEDS.push({ x: px + 13, y: py + 2, kind: r() < .75 ? 'link' : 'off', s: r(), sq: 1 });
        }
        for (let i = 0; i < 4; i++) { g.fillStyle = '#0A0B0D'; g.fillRect(x1 - 100 + i * 24, y + 9, 19, 19); g.fillStyle = '#6B727C'; g.fillRect(x1 - 98 + i * 24, y + 11, 15, 15); g.fillStyle = '#0A0B0D'; g.fillRect(x1 - 96 + i * 24, y + 13, 11, 11); }
      } else if (kind === 'storage') {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
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
    const sh = g.createLinearGradient(0, 0, 0, SH);
    sh.addColorStop(0, 'rgba(255,255,255,.05)'); sh.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = sh; g.fillRect(FL, 0, FR - FL, SH);
    LEDS.forEach(L => { L.o = hash2(Math.round(L.x * 3 + 7), Math.round(L.y * 5 + 11)); });   // the order they will fail in
    return c;
  }
  // fail 0..1: that share of the lights has gone out (each flickers briefly first)
  function rackFrame(g, t, fail) {
    g.drawImage(SWC[3], 0, 0);
    const COL = { act: '#46D483', ok: '#46D483', link: '#46D483', blue: '#59A8FF', warn: '#F2A52B' };
    for (const L of LEDS) {
      if (L.kind === 'off') continue;
      let on = 1;
      if (L.kind === 'act') on = hash2(Math.floor(t * 9 + L.s * 50), Math.round(L.x * 7 + L.y)) > .45 ? 1 : .15;
      else if (L.kind === 'link') on = hash2(Math.floor(t * 6 + L.s * 30), Math.round(L.x + L.y * 3)) > .25 ? 1 : .2;
      else if (L.kind === 'warn') on = Math.floor(t * 1.6 + L.s) % 2 ? 1 : .2;
      if (fail > 0) {
        if (L.o < fail - .05) on = 0;
        else if (L.o < fail) on = hash2(Math.floor(t * 16), Math.round(L.x * 13 + L.y)) > .5 ? 1 : 0;
      }
      const col = COL[L.kind];
      g.fillStyle = on > .5 ? col : '#1C2026';
      if (L.sq) g.fillRect(L.x - 2, L.y - 1.5, 4, 3); else { g.beginPath(); g.arc(L.x, L.y, 2.3, 0, TAU); g.fill(); }
      if (on > .5) { g.fillStyle = rgba(col, .22); g.beginPath(); g.arc(L.x, L.y, 6, 0, TAU); g.fill(); }
    }
  }
  // a family snapshot: sunset over the sea, a grown-up and a child waving at the camera
  function bakePhoto(w, h) {
    const c = makeCanvas(w, h), g = c.getContext('2d');
    const hz = h * .56;
    let gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, '#3D5A8C'); gr.addColorStop(.45, '#B47A8E'); gr.addColorStop(.8, '#EFA06A'); gr.addColorStop(1, '#F8CB82');
    g.fillStyle = gr; g.fillRect(0, 0, w, hz);
    g.fillStyle = '#FFE9B0'; g.beginPath(); g.arc(w * .62, hz - 4, 46, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(255,233,176,.25)'; g.beginPath(); g.arc(w * .62, hz - 4, 80, Math.PI, 0); g.fill();
    const cl = mulberry(5);
    g.fillStyle = 'rgba(250,210,190,.45)';
    for (let i = 0; i < 6; i++) { const y = 60 + cl() * hz * .55, x = cl() * w, l = 60 + cl() * 120; g.beginPath(); g.ellipse(x, y, l, 6 + cl() * 6, 0, 0, TAU); g.fill(); }
    gr = g.createLinearGradient(0, hz, 0, h * .8);
    gr.addColorStop(0, '#5F6F93'); gr.addColorStop(1, '#2C3956');
    g.fillStyle = gr; g.fillRect(0, hz, w, h * .8 - hz);
    for (let i = 0; i < 46; i++) {
      const y = hz + 4 + Math.pow(cl(), 1.6) * (h * .24), sp = 6 + (y - hz) * .35;
      g.fillStyle = `rgba(255,214,150,${.7 - (y - hz) / (h * .3)})`;
      g.fillRect(w * .62 - sp / 2 + (cl() - .5) * sp * 1.6, y, 4 + cl() * sp * .6, 2);
    }
    gr = g.createLinearGradient(0, h * .78, 0, h);
    gr.addColorStop(0, '#C79B72'); gr.addColorStop(1, '#7E5B42');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, h * .8); g.quadraticCurveTo(w * .5, h * .77, w, h * .81); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    // silhouettes
    g.fillStyle = '#1F1A1D';
    const fig = (x, base, s, wave) => {
      g.beginPath(); g.arc(x, base - 172 * s, 15 * s, 0, TAU); g.fill();
      g.beginPath(); g.roundRect(x - 17 * s, base - 154 * s, 34 * s, 78 * s, 12 * s); g.fill();
      g.fillRect(x - 13 * s, base - 84 * s, 11 * s, 84 * s); g.fillRect(x + 2 * s, base - 84 * s, 11 * s, 84 * s);
      g.lineCap = 'round'; g.strokeStyle = '#1F1A1D'; g.lineWidth = 9 * s;
      g.beginPath(); g.moveTo(x - 13 * s, base - 146 * s); g.lineTo(x - 22 * s, base - 96 * s); g.stroke();
      g.beginPath(); g.moveTo(x + 13 * s, base - 146 * s);
      if (wave) { g.lineTo(x + 34 * s, base - 182 * s); g.lineTo(x + 30 * s, base - 222 * s); }
      else g.lineTo(x + 22 * s, base - 96 * s);
      g.stroke();
    };
    fig(w * .36, h * .93, 1.0, false);
    fig(w * .55, h * .935, .62, true);
    g.strokeStyle = '#1F1A1D'; g.lineWidth = 7; g.beginPath();                  // holding hands
    g.moveTo(w * .36 + 22, h * .93 - 96); g.quadraticCurveTo(w * .45, h * .93 - 70, w * .55 - 14, h * .935 - 80); g.stroke();
    return c;
  }
  const INFERNO = ['#000004', '#160b39', '#420a68', '#6a176e', '#932667', '#bc3754', '#dd513a', '#f37819', '#fca50a', '#f6d746', '#fcffa4'];
  function bakeSpectro() {
    const S = window.SPECTRO, w = S.w, h = S.h;
    const bin = atob(S.b64);
    const st = INFERNO.map(hx => { const n = parseInt(hx.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; });
    LUT = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const f = i / 255 * 10, k = Math.min(9, Math.floor(f)), u = f - k;
      for (let j = 0; j < 3; j++) LUT[i * 3 + j] = Math.round(lerp(st[k][j], st[k + 1][j], u));
    }
    const c = makeCanvas(w, h), g = c.getContext('2d'), id = g.createImageData(w, h);
    for (let r = 0; r < h; r++) for (let x = 0; x < w; x++) {
      const v = bin.charCodeAt(r * w + x) / 255;
      const floor = .07 + .015 * hash2(x * 7 + 3, r * 13 + 1) + .05 * vnoise(x * .21, r * .13);   // instrument noise floor
      const q = clamp(Math.max(Math.pow(v, .7), floor));
      const L = Math.round(q * 255) * 3, o = ((h - 1 - r) * w + x) * 4;     // rows low→high: flip so high is up
      id.data[o] = LUT[L]; id.data[o + 1] = LUT[L + 1]; id.data[o + 2] = LUT[L + 2]; id.data[o + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    spec = c;
    // glow layer: only the strong parts of the signal, blurred
    const hiC = makeCanvas(w, h), hg = hiC.getContext('2d'), hid = hg.createImageData(w, h);
    for (let i = 0; i < w * h * 4; i += 4) {
      const lum = id.data[i] * .3 + id.data[i + 1] * .59 + id.data[i + 2] * .11, k = clamp((lum - 70) / 90);
      hid.data[i] = id.data[i] * k; hid.data[i + 1] = id.data[i + 1] * k; hid.data[i + 2] = id.data[i + 2] * k; hid.data[i + 3] = 255;
    }
    hg.putImageData(hid, 0, 0);
    specGlow = makeCanvas(w / 2, h / 2);
    const gg = specGlow.getContext('2d'); gg.filter = 'blur(3px)'; gg.drawImage(hiC, 0, 0, w / 2, h / 2); gg.filter = 'none';
  }

  // ---------- pictograms: one per chapter, in that chapter's own colour ----------
  const PCOL = ['#C48A2C', '#A4532F', '#2B62A6', '#C4402B', '#9C8048', '#4A443C', '#3F8F74', '#123A6B', '#E2231A', '#0000AA', '#2E9E95', '#2F6BFF'];
  function pict(g, i, cx, cy, s, a) {
    const col = PCOL[i];
    g.save(); g.translate(cx, cy); g.scale(s, s); g.globalAlpha = a;
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 3; g.lineJoin = 'round'; g.lineCap = 'round';
    const tint = () => { g.globalAlpha = a * .16; g.fill(); g.globalAlpha = a; };
    const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
    if (i === 0) {                                   // khipu: top cord, pendant cords with knots
      g.beginPath(); g.moveTo(-24, -20); g.lineTo(24, -20); g.stroke();
      [[-15, 20], [-4, 24], [7, 16], [17, 22]].forEach(([x, l], k) => {
        g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, -20); g.quadraticCurveTo(x + 2, -20 + l / 2, x - 1, -20 + l + 18); g.stroke();
        for (let j = 0; j < 2 + (k % 2); j++) { g.beginPath(); g.ellipse(x + .5, -8 + j * 10 + k * 2, 3.6, 2.8, 0, 0, TAU); g.fill(); }
      });
    } else if (i === 1) {                            // clay tablet with wedges
      rr(-18, -24, 36, 48, 7); g.fill();
      g.fillStyle = PAPER_C;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const x = -10 + c * 10 + (r % 2) * 2, y = -15 + r * 10;
        g.beginPath(); g.moveTo(x - 3.5, y - 3); g.lineTo(x + 3.5, y - 3); g.lineTo(x, y + 4); g.fill();
      }
    } else if (i === 2) {                            // papyrus scroll
      rr(-12, -17, 36, 34, 2); tint(); g.stroke();
      rr(-24, -22, 13, 44, 6.5); g.fill();
      g.lineWidth = 2.2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-4, -8 + k * 8); g.lineTo(16 - (k === 2) * 8, -8 + k * 8); g.stroke(); }
    } else if (i === 3) {                            // plastron with the 卜 crack
      g.beginPath(); g.moveTo(0, -25); g.bezierCurveTo(20, -25, 22, -4, 18, 10); g.bezierCurveTo(14, 22, 6, 25, 0, 25);
      g.bezierCurveTo(-6, 25, -14, 22, -18, 10); g.bezierCurveTo(-22, -4, -20, -25, 0, -25); g.closePath(); tint(); g.stroke();
      g.lineWidth = 2.6; g.beginPath(); g.moveTo(-1, -15); g.lineTo(1, -4); g.lineTo(-1, 16); g.moveTo(1, -4); g.lineTo(11, -11); g.stroke();
    } else if (i === 4) {                            // bamboo slips bound with two cords
      for (let k = 0; k < 4; k++) { rr(-19 + k * 10, -25, 8, 50, 4); g.fill(); }
      g.strokeStyle = INK; g.lineWidth = 2; g.globalAlpha = a * .8;
      for (const y of [-12, 12]) { g.beginPath(); g.moveTo(-23, y); g.lineTo(23, y + 1); g.stroke(); }
    } else if (i === 5) {                            // a sheet of paper, a brush stroke and a seal
      g.save(); g.rotate(-.06); rr(-18, -24, 36, 48, 1); g.fillStyle = '#FBF8F1'; g.fill(); g.stroke();
      g.fillStyle = col; g.beginPath(); g.moveTo(-6, -16); g.quadraticCurveTo(0, -4, -3, 12); g.lineTo(-8, 13); g.quadraticCurveTo(-5, -2, -9, -15); g.fill();
      g.fillStyle = '#B8352B'; g.fillRect(4, 8, 9, 9); g.restore();
    } else if (i === 6) {                            // movable type tray
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { rr(-22 + c * 15.5, -22 + r * 15.5, 13, 13, 1.5); g.fill(); }
      g.fillStyle = PAPER_C; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.fillRect(-18 + c * 15.5, -17 + r * 15.5, 5, 3);
    } else if (i === 7) {                            // punched card
      g.beginPath(); g.moveTo(-17, -16); g.lineTo(25, -16); g.lineTo(25, 16); g.lineTo(-25, 16); g.lineTo(-25, -8); g.closePath(); tint(); g.stroke();
      const r = mulberry(8);
      for (let c = 0; c < 9; c++) for (let k = 0; k < 4; k++) if (r() < .42) g.fillRect(-20 + c * 5, -10 + k * 6, 2.4, 4);
    } else if (i === 8) {                            // reel-to-reel tape
      for (const x of [-12, 12]) {
        g.beginPath(); g.arc(x, -6, 11, 0, TAU); tint(); g.stroke();
        g.beginPath(); g.arc(x, -6, 2.6, 0, TAU); g.fill();
        g.lineWidth = 2; g.beginPath();
        for (let k = 0; k < 3; k++) { const an = k * TAU / 3 + (x > 0 ? .5 : 0); g.moveTo(x + Math.cos(an) * 3, -6 + Math.sin(an) * 3); g.lineTo(x + Math.cos(an) * 10, -6 + Math.sin(an) * 10); }
        g.stroke(); g.lineWidth = 3;
      }
      g.lineWidth = 2.4; g.beginPath(); g.moveTo(-12, 5); g.lineTo(12, 5); g.stroke();
      g.fillRect(-25, 14, 50, 3.2);
    } else if (i === 9) {                            // 3.5-inch floppy
      g.beginPath(); g.moveTo(-21, -22); g.lineTo(15, -22); g.lineTo(21, -16); g.lineTo(21, 22); g.lineTo(-21, 22); g.closePath(); tint(); g.stroke();
      g.fillRect(-9, -22, 20, 14); g.fillStyle = PAPER_C; g.fillRect(3, -19, 5, 8);
      g.fillStyle = col; g.lineWidth = 2; g.strokeRect(-14, 4, 28, 15);
    } else if (i === 10) {                           // hard-disk platter and head arm
      g.beginPath(); g.arc(-3, -2, 20, 0, TAU); tint(); g.stroke();
      g.beginPath(); g.arc(-3, -2, 4.5, 0, TAU); g.fill();
      g.lineWidth = 3.4; g.beginPath(); g.moveTo(19, 21); g.lineTo(5, -9); g.stroke();
      g.beginPath(); g.arc(19, 21, 4, 0, TAU); g.fill();
    } else {                                         // cloud
      g.beginPath(); g.moveTo(-16, 14); g.arc(-14, 5, 9, Math.PI * .5, Math.PI * 1.45); g.arc(-2, -5, 12.5, Math.PI * 1.1, Math.PI * 1.9);
      g.arc(13, 3, 10, Math.PI * 1.35, Math.PI * .5); g.closePath(); tint(); g.stroke();
    }
    g.restore();
  }

  // ---------- beat 0: lifetime chart ----------
  const X0 = 330, X1 = 1650, BASE = 735, TOPY = 190;
  const ly = v => BASE - Math.log10(v) / 4 * (BASE - TOPY);
  const BARS = [
    { v: 1000 }, { v: 5000 }, { v: 4500 }, { v: 3200 }, { v: 2400 }, { v: 2000 }, { v: 1150 },
    { k: 'stub', v: 4.2 }, { k: 'est', v: 30 }, { k: 'est', lo: 5, v: 15 }, { k: 'est', lo: 2, v: 5 }, { k: 'unk', v: 9000 }];
  const SLOT = (X1 - X0) / 12, BW = 46;
  const barT = i => 1.25 + i * .29;
  function hatch(g, x, y, w, h, a) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.strokeStyle = rgba(INK, .32 * a); g.lineWidth = 1.4; g.beginPath();
    for (let k = -h; k < w + h; k += 9) { g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); }
    g.stroke(); g.restore();
  }
  function chart(g, t) {
    const a = 1 - smooth(5.65, 6.05, t);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a; g.translate(0, -26 * smooth(5.65, 6.05, t));
    // grid: decades of years on a log scale
    const ga = smooth(.5, 1.3, t);
    for (let e = 0; e <= 4; e++) {
      const y = ly(Math.pow(10, e)), k = ease.out(clamp((t - .45 - e * .1) / .8));
      if (e > 0) {
        g.strokeStyle = rgba(INK, .13 * ga); g.lineWidth = 1.2; g.setLineDash([2, 7]);
        g.beginPath(); g.moveTo(X0 - 10, y); g.lineTo(X0 - 10 + (X1 - X0 + 20) * k, y); g.stroke(); g.setLineDash([]);
      }
      font(g, 22, '"Noto Sans SC"', 400); g.fillStyle = rgba(INK, .42 * ga); g.textAlign = 'right';
      g.fillText(e === 4 ? '10,000 年' : Math.pow(10, e).toLocaleString('en-US'), X0 - 26, y + 8);
    }
    g.textAlign = 'left';
    g.fillStyle = INK; g.fillRect(X0 - 10, BASE, (X1 - X0 + 20) * ease.out(smooth(.25, 1.1, t)), 2.5);
    BARS.forEach((b, i) => {
      const cx = X0 + SLOT * (i + .5), x = cx - BW / 2, t0 = barT(i);
      const pa = smooth(t0 - .12, t0 + .12, t);
      if (pa > 0) pict(g, i, cx, BASE + 52 + (1 - ease.out(pa)) * 10, .92, pa);
      const k = ease.out(clamp((t - t0) / .5));
      if (k <= 0) return;
      const top = ly(b.v), hgt = (BASE - top) * k;
      if (!b.k) {
        g.fillStyle = '#2B251F'; g.fillRect(x, BASE - hgt, BW, hgt);
        g.fillStyle = PCOL[i]; g.fillRect(x, BASE - hgt, BW, 5);
      } else if (b.k === 'stub') {                   // the census cards: almost all lost — a broken stub
        const hh = hgt;
        g.fillStyle = rgba(INK, .9); g.beginPath(); g.moveTo(x, BASE); g.lineTo(x, BASE - hh * .8);
        const r = mulberry(31);
        for (let s = 1; s <= 6; s++) g.lineTo(x + BW * s / 6, BASE - hh * (.55 + r() * .45));
        g.lineTo(x + BW, BASE); g.closePath(); g.fill();
        g.fillStyle = PCOL[i]; g.fillRect(x, BASE - 4, BW, 4);
      } else if (b.k === 'est') {                    // estimates: dashed outline, range hatched
        const lo = b.lo ? BASE - (BASE - ly(b.lo)) * k : BASE - hgt;
        hatch(g, x, BASE - hgt, BW, hgt, 1);
        g.fillStyle = rgba(INK, .14); g.fillRect(x, lo, BW, BASE - lo);
        g.strokeStyle = INK; g.lineWidth = 2.4; g.setLineDash([8, 6]); g.lineDashOffset = -Math.max(0, t - 4.7) * 14;
        g.strokeRect(x, BASE - hgt, BW, hgt); g.setLineDash([]); g.lineDashOffset = 0;
        if (b.lo) { g.fillStyle = INK; g.fillRect(x - 6, lo - 1.5, BW + 12, 3); }
        g.fillStyle = PCOL[i]; g.fillRect(x, BASE - hgt, BW, 4);
      } else {                                       // the cloud: an outline with no known top
        const gr = g.createLinearGradient(0, BASE, 0, BASE - hgt);
        gr.addColorStop(0, rgba(INK, .8)); gr.addColorStop(1, rgba(INK, 0));
        g.strokeStyle = gr; g.lineWidth = 2.4; g.setLineDash([3, 6]); g.lineDashOffset = -Math.max(0, t - 4.7) * 14;
        g.beginPath(); g.moveTo(x, BASE); g.lineTo(x, BASE - hgt); g.moveTo(x + BW, BASE); g.lineTo(x + BW, BASE - hgt); g.stroke();
        g.setLineDash([]); g.lineDashOffset = 0;
        const qa = smooth(t0 + .25, t0 + .6, t), pulse = 1 + .06 * Math.max(0, Math.sin((t - t0) * 3.6));
        font(g, 64 * pulse, '"Noto Serif SC"', 900); g.fillStyle = rgba(RED, qa);
        inkCentre(g, '？', cx, BASE - 92);
      }
    });
    g.restore();
  }

  // ---------- beats 1–2: the four swatches of the opening bet ----------
  const CW = 372, CHT = 270, RX0 = 96, RGAP = (W - 2 * RX0 - 4 * CW) / 3, ROW_Y = 292, DS = 642 / CW;
  function cardSrc(i, t, fail) {
    if (i === 0) {                                   // the raking light travels back across the clay (the hook left it on the right)
      const k = smooth(7.4, 9.9, t);
      if (k <= 0) return CLAY_R;
      if (k >= 1) return CLAY_L;
      const g = work[0].getContext('2d'); g.globalAlpha = 1; g.drawImage(CLAY_R, 0, 0); g.globalAlpha = k; g.drawImage(CLAY_L, 0, 0); g.globalAlpha = 1;
      return work[0];
    }
    if (i === 2) { platterFrame(work[2].getContext('2d'), t); return work[2]; }
    if (i === 3) { rackFrame(work[3].getContext('2d'), t, fail); return work[3]; }
    return SWC[1];
  }
  // a mounted specimen at (x, y), s = scale of the 372×270 card
  function card(g, i, t, x, y, s, a, dim, fail = 0) {
    if (a <= 0) return;
    const w = CW * s, h = CHT * s;
    g.save(); g.globalAlpha = a * .9;
    g.drawImage(shadowSpr, x - 60 * s, y - 52 * s, (CW + 120) * s, (CHT + 120) * s);
    g.globalAlpha = a; g.imageSmoothingQuality = 'high';
    g.drawImage(cardSrc(i, t, fail), x, y, w, h);
    if (dim > 0) { g.fillStyle = rgba(PAPER_C, dim * .55); g.fillRect(x, y, w, h); }
    g.strokeStyle = 'rgba(27,23,18,.28)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
    g.restore();
  }
  function letter(g, i, x, y, a, red, dim) {
    font(g, 40, SERIF, 900); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = red > 0 ? `rgba(${Math.round(lerp(27, 176, red))},${Math.round(lerp(23, 65, red))},${Math.round(lerp(18, 46, red))},${a})` : rgba(INK, a * (1 - .5 * dim));
    g.fillText('ABCD'[i], x, y);
  }
  function swatches(g, t) {
    if (t < 5.8 || t > 15.0) return;
    const out = smooth(10.35, 10.9, t);             // A, B, C leave; D comes forward
    const rise = ease.outBack(clamp((t - 7.0) / .6));
    const pick = smooth(7.0, 7.5, t);
    for (let i = 0; i < 4; i++) {
      const xr = RX0 + i * (CW + RGAP);
      const k = ease.out(clamp((t - 6.0 - i * .09) / .6));
      if (i < 3) {
        const a = k * (1 - out);
        if (a <= 0) continue;
        const dy = (1 - k) * 40 + out * 30 - (i === 0 ? rise * 44 : 0);
        const dim = i === 0 ? 0 : pick;
        card(g, i, t, xr, ROW_Y + dy, 1, a, dim);
        letter(g, i, xr, ROW_Y + CHT + dy + 64, a, i === 0 ? pick : 0, dim);
        if (i === 0) {                               // cinnabar outline drawn around the winner
          const p = ease.inOut(clamp((t - 7.25) / .7));
          if (p > 0) {
            const bx = xr - 12, by = ROW_Y + dy - 12, bw = CW + 24, bh = CHT + 24, per = 2 * (bw + bh);
            g.save(); g.globalAlpha = a; g.strokeStyle = RED; g.lineWidth = 5;
            g.setLineDash([per * p, per]); g.beginPath();
            g.moveTo(bx, by); g.lineTo(bx + bw, by); g.lineTo(bx + bw, by + bh); g.lineTo(bx, by + bh); g.closePath(); g.stroke();
            g.restore();
          }
        }
      } else {
        // D: in the row, then alone at the centre with a pulsing question mark while its lights go out
        const m = ease.inOut(smooth(10.4, 11.1, t));
        const s = lerp(1, DS, m), x = lerp(xr, W / 2 - CW * DS / 2, m), y = lerp(ROW_Y + (1 - k) * 40, 440 - CHT * DS / 2, m);
        const a = k * (1 - smooth(14.55, 15.0, t));
        const dim = pick * (1 - m);
        card(g, 3, t, x, y, s, a, dim, .8 * smooth(11.4, 14.3, t));
        letter(g, 3, xr, ROW_Y + CHT + (1 - k) * 40 + 64, a * (1 - smooth(10.35, 10.7, t)), 0, dim);
        const qa = smooth(11.0, 11.4, t) * a;
        if (qa > 0) {
          const ph = ((t - 11.0) % 1.1) / 1.1, beat = Math.exp(-Math.pow(ph / .12, 2)) + .55 * Math.exp(-Math.pow((ph - .26) / .1, 2));
          const qs = 1 + .07 * beat;
          g.save(); g.translate(x + CW * s / 2, y + CHT * s / 2 - 6); g.scale(qs, qs);
          g.fillStyle = rgba(PAPER_C, qa); g.beginPath(); g.arc(0, 0, 112, 0, TAU); g.fill();
          g.strokeStyle = rgba(RED, qa * (.55 + .45 * beat)); g.lineWidth = 4; g.stroke();
          font(g, 170, SERIF, 900); g.fillStyle = rgba(RED, qa);
          inkCentre(g, '？', 0, 0);
          g.restore();
        }
      }
    }
  }

  // ---------- beat 3: the golden line, set large ----------
  function golden(g, t) {
    const a = win(t, 14.9, 20.25, .25, .45);
    if (a <= 0) return;
    const lines = O.cards[3].split('\n');
    const HL = [['记录', lines[0].indexOf('记录')], ['人', lines[1].indexOf('人')]];
    font(g, 80, '"Noto Serif SC"', 900);
    const sp = 6, lh = 136, y0 = 470 - lh / 2 + 28;
    const ph = t > 16 ? ((t - 15.9) % 1.0) / 1.0 : 1, beat = t > 15.9 ? Math.exp(-Math.pow(ph / .09, 2)) + .5 * Math.exp(-Math.pow((ph - .22) / .08, 2)) : 0;
    lines.forEach((ln, li) => {
      const chars = [...ln], ws = chars.map(c => g.measureText(c).width);
      const tot = ws.reduce((p, q) => p + q, 0) + sp * (chars.length - 1);
      let cx = W / 2 - tot / 2;
      const t0 = 15.05 + li * 1.55, [hw, hi] = HL[li];
      chars.forEach((c, i) => {
        const k = ease.out(clamp((t - t0 - i * .055) / .5));
        const isHL = i >= hi && i < hi + hw.length;
        if (k > 0) {
          if (isHL) {
            const s = 1 + .035 * beat;
            g.save(); g.translate(cx + ws[i] / 2, y0 + li * lh - 28); g.scale(s, s);
            g.fillStyle = rgba(RED, a * k); g.fillText(c, -ws[i] / 2, 28 + (1 - k) * 18); g.restore();
          } else { g.fillStyle = rgba(INK, a * k); g.fillText(c, cx, y0 + li * lh + (1 - k) * 18); }
        }
        cx += ws[i] + sp;
      });
    });
  }

  // ---------- beat 4: the phone photo decays ----------
  const PW = 330, PH = 660, PCX = 960, PCY = 455;
  const SCX = PCX - PW / 2 + 15, SCY = PCY - PH / 2 + 15, SCW = PW - 30, SCH = PH - 30;
  const pixC = makeCanvas(SCW, SCH);
  function phone(g, t) {
    const a = win(t, 20.25, 24.55, .4, .35);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    const d = clamp((t - 20.9) / 3.1);              // decay 0..1
    // photo
    g.save(); g.beginPath(); g.roundRect(SCX, SCY, SCW, SCH, 34); g.clip();
    const steps = [1, 2, 3, 5, 8, 12, 17, 24, 32], bs = steps[Math.min(steps.length - 1, Math.floor(Math.pow(d, .8) * steps.length))];
    if (bs === 1) g.drawImage(photo, SCX, SCY);
    else {
      const w = Math.ceil(SCW / bs), h = Math.ceil(SCH / bs);
      const pg = pixC.getContext('2d'); pixC.width = w; pixC.height = h;
      pg.drawImage(photo, 0, 0, w, h);
      g.imageSmoothingEnabled = false; g.drawImage(pixC, 0, 0, w, h, SCX, SCY, w * bs, h * bs); g.imageSmoothingEnabled = true;
    }
    // block dropouts: corrupted, then gone
    const CB = 30, nc = Math.ceil(SCW / CB), nr = Math.ceil(SCH / CB);
    for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
      const h = hash2(c * 3 + 11, r * 7 + 5), thr = .2 + h * .72;
      if (d < thr - .07) continue;
      const x = SCX + c * CB, y = SCY + r * CB;
      if (d < thr) {                                 // glitch: smeared stripe from a neighbouring row
        const sy = SCY + ((r + 3 + Math.floor(h * 9)) % nr) * CB;
        g.drawImage(photo, x - SCX + 8, sy - SCY, CB, CB / 3, x, y, CB, CB);
      } else {
        g.fillStyle = h > .5 ? '#D8D3CB' : '#D2CDC4'; g.fillRect(x, y, CB, CB);
      }
    }
    // broken-image placeholder
    const ba = smooth(23.3, 23.9, t);
    if (ba > 0) {
      g.fillStyle = rgba('#D8D3CB', ba); g.fillRect(SCX, SCY, SCW, SCH);
      g.save(); g.translate(PCX, PCY); g.globalAlpha = a * ba;
      g.strokeStyle = '#8F887E'; g.lineWidth = 5; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-60, -46); g.lineTo(60, -46); g.lineTo(60, 8); g.lineTo(38, 20); g.lineTo(14, 4); g.lineTo(-8, 22);
      g.lineTo(-30, 8); g.lineTo(-60, 22); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(-60, 38); g.lineTo(-30, 26); g.lineTo(-8, 40); g.lineTo(14, 22); g.lineTo(38, 38); g.lineTo(60, 26); g.lineTo(60, 54); g.lineTo(-60, 54); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(-44, -6); g.lineTo(-20, -30); g.lineTo(4, -6); g.stroke();
      g.beginPath(); g.arc(30, -26, 8, 0, TAU); g.stroke();
      g.restore();
    }
    g.restore();
    // phone body, drawn as an ink outline
    const dk = ease.inOut(clamp((t - 20.25) / .6));
    g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round';
    const per = 2 * (PW + PH);
    g.setLineDash([per * dk, per]);
    g.beginPath(); g.roundRect(PCX - PW / 2, PCY - PH / 2, PW, PH, 50); g.stroke(); g.setLineDash([]);
    g.globalAlpha = a * dk;
    g.lineWidth = 2; g.strokeStyle = rgba(INK, .5); g.beginPath(); g.roundRect(SCX, SCY, SCW, SCH, 34); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.roundRect(PCX - 46, SCY + 14, 92, 26, 13); g.fill();
    g.fillRect(PCX + PW / 2, PCY - 190, 5, 90); g.fillRect(PCX - PW / 2 - 5, PCY - 220, 5, 50); g.fillRect(PCX - PW / 2 - 5, PCY - 150, 5, 50);
    g.restore();
  }

  // ---------- beat 5: a lab spectrogram of this film's own sound ----------
  const DX0 = 340, DX1 = 1600, DY0 = 206, DY1 = 718, WS = 5.0, S0 = 24.8, SFREEZE = 5.3;
  function spectrogram(g, t) {
    const a = win(t, 24.5, 31.2, .4, .55);
    if (a <= 0) return;
    const lift = (1 - ease.out(smooth(24.5, 24.95, t))) * 40;
    g.save(); g.globalAlpha = a; g.translate(0, lift);
    // instrument body
    const bx = DX0 - 118, by = DY0 - 52, bw = DX1 - DX0 + 118 + 56, bh = DY1 - DY0 + 52 + 74;
    g.shadowColor = 'rgba(30,22,14,.35)'; g.shadowBlur = 40; g.shadowOffsetY = 16;
    let gr = g.createLinearGradient(0, by, 0, by + bh);
    gr.addColorStop(0, '#2C2824'); gr.addColorStop(1, '#1D1A17');
    g.fillStyle = gr; g.beginPath(); g.roundRect(bx, by, bw, bh, 22); g.fill(); g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(255,240,220,.10)'; g.lineWidth = 2; g.beginPath(); g.roundRect(bx + 6, by + 6, bw - 12, bh - 12, 17); g.stroke();
    for (const [sx, sy] of [[bx + 24, by + 24], [bx + bw - 24, by + 24], [bx + 24, by + bh - 24], [bx + bw - 24, by + bh - 24]]) {
      g.fillStyle = '#3A3530'; g.beginPath(); g.arc(sx, sy, 7, 0, TAU); g.fill();
      g.strokeStyle = '#191613'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx - 4, sy - 4); g.lineTo(sx + 4, sy + 4); g.stroke();
    }
    // screen
    g.fillStyle = '#05030C'; g.fillRect(DX0 - 4, DY0 - 4, DX1 - DX0 + 8, DY1 - DY0 + 8);
    const sNow = clamp(t - S0, 0, SFREEZE);
    const S = window.SPECTRO, cps = S.w / S.dur, pps = (DX1 - DX0) / WS;
    g.fillStyle = 'rgb(16,8,40)'; g.fillRect(DX0, DY0, DX1 - DX0, DY1 - DY0);
    const sA = Math.max(0, sNow - WS);
    if (sNow > 0) {
      const c0 = sA * cps, c1 = sNow * cps;
      const xA = DX1 - (sNow - sA) * pps;
      g.drawImage(spec, c0, 0, c1 - c0, S.h, xA, DY0, (sNow - sA) * pps, DY1 - DY0);
      const glow = .25 + .45 * smooth(29.4, 30.2, t);
      g.globalCompositeOperation = 'screen'; g.globalAlpha = a * glow;
      g.drawImage(specGlow, c0 / 2, 0, (c1 - c0) / 2, S.h / 2, xA, DY0, (sNow - sA) * pps, DY1 - DY0);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = a;
    }
    // graticule: every 2 kHz, every second (moving with the data)
    g.strokeStyle = 'rgba(255,236,210,.07)'; g.lineWidth = 1;
    g.beginPath();
    for (let f = 2000; f < 12000; f += 2000) { const y = DY1 - f / S.fmax * (DY1 - DY0); g.moveTo(DX0, y); g.lineTo(DX1, y); }
    for (let s = Math.ceil(sNow - WS); s <= sNow; s++) { const x = DX1 - (sNow - s) * pps; if (x > DX0) { g.moveTo(x, DY0); g.lineTo(x, DY1); } }
    g.stroke();
    // frequency axis on the bezel
    g.fillStyle = 'rgba(236,226,210,.55)'; g.strokeStyle = 'rgba(236,226,210,.45)'; g.lineWidth = 1.5;
    font(g, 20, '"JetBrains Mono"', 500); g.textAlign = 'right';
    for (let f = 0; f <= 12000; f += 1000) {
      const y = DY1 - f / S.fmax * (DY1 - DY0), major = f % 4000 === 0;
      g.beginPath(); g.moveTo(DX0 - 8, y); g.lineTo(DX0 - (major ? 22 : 14), y); g.stroke();
      if (major) g.fillText(f === 12000 ? '12 kHz' : String(f / 1000), DX0 - 30, y + 7);
    }
    g.textAlign = 'left';
    // time ticks under the screen, scrolling
    g.strokeStyle = 'rgba(236,226,210,.38)';
    g.beginPath();
    for (let q = Math.ceil((sNow - WS) * 4); q <= sNow * 4; q++) {
      const x = DX1 - (sNow - q / 4) * pps; if (x < DX0) continue;
      g.moveTo(x, DY1 + 8); g.lineTo(x, DY1 + (q % 4 === 0 ? 22 : 14));
    }
    g.stroke();
    // write head at the right edge
    const live = t < S0 + SFREEZE ? 1 : .35;
    g.fillStyle = `rgba(255,214,140,${.75 * live})`; g.fillRect(DX1 - 1, DY0, 2, DY1 - DY0);
    g.restore();
  }

  // ---------- end card ----------
  function endCard(g, t) {
    const a = smooth(30.95, 31.4, t);
    if (a <= 0) return;
    const E = O.end;
    g.save(); g.textBaseline = 'alphabetic';
    g.save(); g.translate(0, -Math.max(0, t - 31.2) * 1.6);   // the card breathes: a slow upward drift while it holds
    // the twelve media as a branch of the tech tree
    const tx0 = W / 2 - 11 * 46, ty = 300;
    const lk = ease.inOut(clamp((t - 31.1) / 1.3));
    g.strokeStyle = rgba(INK, .3 * a); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(tx0 - 30, ty); g.lineTo(tx0 - 30 + (22 * 46 + 60) * lk, ty); g.stroke();
    for (let i = 0; i < 12; i++) {
      const k = smooth(31.1 + i * .1, 31.4 + i * .1, t);
      if (k <= 0) continue;
      const x = tx0 + i * 92;
      g.fillStyle = rgba(PAPER_C, 1); g.beginPath(); g.arc(x, ty, 30, 0, TAU); g.fill();
      pict(g, i, x, ty, .62 * (.8 + .2 * ease.outBack(k)), k * a);
    }
    // title
    font(g, 128, '"Noto Serif SC"', 900);
    const chars = [...E[0]], ws = chars.map(c => g.measureText(c).width), sp = 18;
    let cx = W / 2 - (ws.reduce((p, q) => p + q, 0) + sp * (chars.length - 1)) / 2;
    chars.forEach((c, i) => {
      const k = ease.out(clamp((t - 31.2 - i * .08) / .55));
      g.fillStyle = rgba(INK, a * k); g.fillText(c, cx, 520 + (1 - k) * 22); cx += ws[i] + sp;
    });
    const rk = ease.out(clamp((t - 32.0) / .5));
    g.fillStyle = RED; g.fillRect(W / 2 - 32 * rk, 572, 64 * rk, 3);
    const k2 = smooth(32.1, 32.6, t);
    font(g, 32, '"Noto Sans SC"', 400); g.fillStyle = rgba('#6B6258', a * k2);
    spaced(g, E[1], W / 2, 636, 6, 'center');
    const k3 = smooth(32.8, 33.3, t);
    font(g, 42, '"Noto Serif SC"', 700); g.fillStyle = rgba(INK, a * k3);
    spaced(g, E[2], W / 2, 790 + (1 - k3) * 10, 6, 'center');
    g.restore();
    const k4 = smooth(33.4, 33.9, t);
    font(g, 22, '"Noto Sans SC"', 400); g.fillStyle = rgba(MUTE, a * k4);
    spaced(g, E[3], W / 2, 1006, 5, 'center');
    g.restore();
  }

  scene({
    id: 'outro', dur: DUR,
    trans: { type: 'outro_lightsout', d: 1.3 },
    cues: [
      { t: .38, sfx: 'click', v: .35 },
      ...BARS.map((b, i) => ({ t: +(barT(i) + .3).toFixed(2), sfx: 'chime', v: b.k ? .32 : .5 })),
      { t: 7.3, sfx: 'stamp', v: .5 },
      { t: 15.0, sfx: 'impact', v: .4 },
      { t: 15.9, sfx: 'heartbeat', v: .55 }, { t: 16.9, sfx: 'heartbeat', v: .55 }, { t: 17.9, sfx: 'heartbeat', v: .5 },
      { t: 24.8, sfx: 'blip', v: .5 },
      { t: 31.2, sfx: 'chime', v: .6 },
    ],
    init() {
      paper = GL.bake(PAPER, W, H);
      [CLAY_L, CLAY_R] = bakeClay();
      SWC = [CLAY_L, bakeXuan(), bakePlatter(), bakeRack()];
      ARM = bakeArm();
      work = [0, 1, 2, 3].map(() => makeCanvas(SW, SH));
      shadowSpr = makeCanvas(CW + 120, CHT + 120);
      const sg = shadowSpr.getContext('2d');
      sg.filter = 'blur(13px)'; sg.fillStyle = 'rgba(52,38,24,.34)'; sg.fillRect(60, 60, CW, CHT); sg.filter = 'none';
      photo = bakePhoto(SCW, SCH);
      bakeSpectro();
    },
    draw(ctx, t) {
      ctx.drawImage(paper, 0, 0);
      chart(ctx, t);
      swatches(ctx, t);
      golden(ctx, t);
      phone(ctx, t);
      spectrogram(ctx, t);
      endCard(ctx, t);
      subs(ctx, t, SUBCH, { ink: INK, body: { family: '"Noto Serif SC"', size: 52, weight: 600 } });
      grain(ctx, t, .035);
      const fo = smooth(36.8, 37.5, t);
      if (fo > 0) { ctx.fillStyle = rgba('#17130F', fo); ctx.fillRect(0, 0, W, H); }
    },
  });
})();
