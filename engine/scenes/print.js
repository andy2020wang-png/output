// 07 印刷术 — three media in one chapter, each with its own look:
//   Tang woodblock on a Dunhuang wall (cards 0-1) → Northern Song clay type on a celadon 宋刻本 page (cards 2-3)
//   → Mainz screw press in woodcut hatching (cards 4-5). Every texture and figure is procedural.
'use strict';
(() => {
  const ch = CH('print');
  const TA = { blue: '#2E6F8E', green: '#3F8F74', red: '#A5452C', ochre: '#B07A4A', gold: '#C9A24A', wall: '#D8C3A0',
    ink: '#2A1D15', sub: '#5B3B24' };
  const SO = { cel: '#B7C9C3', ink: '#1F2B28', cin: '#B23A2A' };
  const MZ = { blk: '#141210', cream: '#EFE6D2', rub: '#B1261C' };
  const KAI = '"LXGW WenKai TC"', SONG = '"Noto Serif SC"', FRAK = 'UnifrakturMaguntia';
  const TAU = Math.PI * 2;

  // ---------- timeline (local seconds) ----------
  const CARVE0 = .12, CARVE1 = 2.3, INK0 = 2.45, INK1 = 3.3, PAP0 = 3.4, PAP1 = 3.85, RUB0 = 3.9, RUB1 = 5.05,
    PEEL0 = 5.2, PEEL1 = 6.2, OUT0 = 6.62, SCR0 = 6.9, SCR1 = 8.6, ZOOM0 = 8.85, ZOOM1 = 10.15, LIFT0 = 10.25,
    LIFT1 = 10.8, SPLIT = 10.85, SLAM = 20.3;

  // ---------- shaders (baked once) ----------
  const WALL = `void main(){ vec2 px=uv*R;
    float a=fbm3(px*.0021), b=fbm3(px*.009+7.), c=vn(px*.35);
    vec3 col=vec3(.847,.765,.627)*(.9+.17*a)*(.965+.06*b)*(.985+.03*c);
    col=mix(col,col*vec3(.86,.77,.66),smoothstep(.56,.84,fbm3(px*.0032+3.))*.5);
    vec2 v=vor(px*.0052+vec2(fbm3(px*.01),fbm3(px*.01+4.))*.8);
    col*=1.-smoothstep(.03,.0,v.y-v.x)*smoothstep(.42,.68,fbm3(px*.0024+11.))*.16;
    vec2 q=uv-.5; col*=1.-dot(q,q)*.42; O=vec4(col,1.);}`;
  const WOOD = `uniform vec3 C; void main(){ vec2 p=uv*R;
    float w=fbm3(vec2(p.x*.0035,p.y*.02)+2.)*5.;
    float ring=sin(p.y*.12+w*2.4+sin(p.x*.005)*1.2)*.5+.5;
    float fib=vn(vec2(p.x*.02,p.y*.8));
    vec3 col=C*(.82+.2*ring*ring+.08*fib)*(.95+.07*fbm3(p*.02));
    O=vec4(col,1.);}`;
  const PAPER = `uniform vec3 C; void main(){ vec2 p=uv*R;
    float f=fbm3(p*.012), g=vn(vec2(p.x*.9,p.y*.05)+3.)*.5+vn(vec2(p.x*.05,p.y*.9))*.5;
    vec3 col=C*(.94+.08*f)*(.975+.045*g);
    col=mix(col,col*vec3(.9,.83,.7),smoothstep(.6,.86,fbm3(p*.006+4.))*.45);
    O=vec4(col,1.);}`;
  const CELA = `void main(){ vec2 px=uv*R; float a=fbm3(px*.0018);
    vec3 col=vec3(.718,.788,.765)*(.93+.11*a);
    vec2 v=vor(px*.011); float c1=smoothstep(.035,.0,v.y-v.x);
    vec2 v2=vor(px*.027+7.); float c2=smoothstep(.03,.0,v2.y-v2.x);
    col*=1.-c1*.06-c2*.03;
    vec2 q=uv-.5; col*=1.-dot(q,q)*.38; O=vec4(col,1.);}`;
  const CREAM = `uniform vec3 C; void main(){ vec2 px=uv*R; float a=fbm3(px*.003);
    vec3 col=C*(.955+.06*a);
    col*=1.-.016*smoothstep(.55,1.,abs(sin(px.y*.5236)));
    col*=1.-.028*smoothstep(.9,1.,abs(sin(px.x*.0175)));
    col=mix(col,vec3(.72,.56,.36),smoothstep(.8,.9,vn(px*.018+9.))*.07);
    vec2 q=uv-.5; col*=1.-dot(q,q)*.3; O=vec4(col,1.);}`;
  const WEAR = `uniform float K; uniform float F; void main(){ vec2 p=uv*R;
    float n=fbm3(p*F)*.7+vn(p*F*7.)*.3; O=vec4(0.,0.,0.,smoothstep(K,K+.06,n));}`;
  const IRON = `void main(){ vec2 p=uv*R; float n=fbm3(p*.02), m=vn(p*.35);
    vec3 col=vec3(.25,.26,.265)*(.82+.3*n)*(.94+.1*m);
    col=mix(col,vec3(.45,.27,.15),smoothstep(.6,.8,fbm3(p*.03+4.))*.55);
    O=vec4(col,1.);}`;
  // incoming transition: a rubbing brush passes over the sheet in four strokes and the next era comes through
  const RUB = `uniform sampler2D A; uniform sampler2D B; uniform float P;
  void main(){ vec2 p=uv; float y=1.-p.y;
    float rows=4.; float yy=y*rows+(fbm3(vec2(p.x*4.,3.))-.5)*.35; float row=floor(yy); float fy=fract(yy);
    float k=P*(rows+.7)-row*1.;
    float x=mod(row,2.)<.5?p.x:1.-p.x;
    float fib=fbm3(vec2(p.x*2.5,p.y*90.))*.22+vn(vec2(p.x*9.,p.y*300.))*.08;
    float f=k*1.3-.15, bow=.07*sin(fy*3.14159);
    float d=x+fib-bow-f;
    float m=smoothstep(.04,-.04,d);
    float streak=smoothstep(.3,.6,fbm3(vec2(p.x*1.5,p.y*140.))+k*.25);
    float g=smoothstep(.72,1.,P);
    float mm=max(m*mix(.55,1.,streak), g);
    vec4 a=texture(A,p), b=texture(B,p);
    vec3 col=mix(a.rgb,b.rgb,clamp(mm,0.,1.));
    col*=1.-.22*exp(-abs(d)*38.)*step(0.,k)*step(k,1.2)*(1.-g);
    O=vec4(col,1.);}`;

  // ---------- small helpers ----------
  const C2 = (w, h) => { const c = makeCanvas(Math.ceil(w), Math.ceil(h)); return [c, c.getContext('2d')]; };
  function flipH(src) { const [c, g] = C2(src.width, src.height); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c; }
  function tint(src, col) { const [c, g] = C2(src.width, src.height); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return c; }
  function clipTo(src, tex) { const [c, g] = C2(src.width, src.height); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.drawImage(tex, 0, 0, src.width, src.height); return c; }
  function wear(cnv, k, f) { const m = GL.bake(WEAR, cnv.width, cnv.height, { K: k, F: f }); const g = cnv.getContext('2d'); g.save(); g.globalCompositeOperation = 'destination-out'; g.drawImage(m, 0, 0); g.restore(); return cnv; }
  function poly(pts) { const seg = []; let L = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; } return { pts, seg, L }; }
  function polyAt(P, u) {
    let d = clamp(u) * P.L;
    for (let i = 0; i < P.seg.length; i++) {
      if (d <= P.seg[i] || i === P.seg.length - 1) { const k = P.seg[i] ? Math.min(1, d / P.seg[i]) : 0, a = P.pts[i], b = P.pts[i + 1]; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), i]; }
      d -= P.seg[i];
    }
  }
  function polyPath(g, P, u) { const e = polyAt(P, u); g.moveTo(P.pts[0][0], P.pts[0][1]); for (let i = 1; i <= e[2]; i++) g.lineTo(P.pts[i][0], P.pts[i][1]); g.lineTo(e[0], e[1]); }
  function hatchRect(g, x, y, w, h, ang, sp, lw, col) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.strokeStyle = col; g.lineWidth = lw;
    const cx = x + w / 2, cy = y + h / 2, R = Math.hypot(w, h) / 2 + sp, ca = Math.cos(ang), sa = Math.sin(ang);
    g.beginPath();
    for (let d = -R; d <= R; d += sp) { const px = cx - sa * d, py = cy + ca * d; g.moveTo(px - ca * R, py - sa * R); g.lineTo(px + ca * R, py + sa * R); }
    g.stroke(); g.restore();
  }
  function vcol(g, str, x, y0, size, step, fam, wt = 400) {
    font(g, size, fam, wt); g.textAlign = 'center'; g.textBaseline = 'middle';
    [...str].forEach((c, i) => g.fillText(c, x, y0 + i * step + step / 2));
  }
  let scr, sg; // scratch canvas, fully redrawn whenever used (no state carried between frames)
  function revealAlong(ctx, img, x, y, P, u, lw) {
    if (u <= 0) return;
    const w = img.width, h = img.height;
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, w + 2, h + 2);
    sg.lineCap = 'round'; sg.lineJoin = 'round'; sg.lineWidth = lw; sg.strokeStyle = '#000';
    sg.beginPath(); polyPath(sg, P, u); sg.stroke();
    sg.globalCompositeOperation = 'source-in'; sg.drawImage(img, 0, 0); sg.globalCompositeOperation = 'source-over';
    ctx.drawImage(scr, 0, 0, w, h, x, y, w, h);
  }
  function softShadow(ctx, x, y, w, h, a, blur = 18, ox = 8, oy = 12) {
    ctx.save(); ctx.shadowColor = `rgba(40,22,8,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetX = ox; ctx.shadowOffsetY = oy;
    ctx.fillStyle = `rgba(40,22,8,${a})`; ctx.fillRect(x, y, w, h); ctx.restore();
  }

  // ---------- geometry ----------
  const BW = 600, BH = 430;                       // pear-wood block
  const BX = 1100, BY = 240;                      // block on the Tang bench (right)
  const SPW = 560, SPH = 396;                     // printing sheet
  const CAX = 190, CAY = 128, CAS = 660;          // caisson square (left)
  const SCW = 1440, SCH = 440, SCX = (W - 1440) / 2, SCY = 200;  // Diamond Sutra scroll
  const SBX = 660, SBY = 235;                     // block before it splits (centre)
  const GC = 10, GR = 7, CELL = 66, TX = 228, TY = 226;          // type tray
  const FX = 1193, FY0 = 270, SLOT = 70;          // iron frame slots (centres)
  const BKX = 1000, BKY = 175, LW_ = 760, LH_ = 500;             // 梦溪笔谈 spread
  const MPW = 590, MPH = 790, MPX = 352, MPY = 40;               // Mainz page
  const PRX = 1190, PRY = 46, PRW = 540, PRH = 790;              // woodcut press

  const SUTRA = '如是我聞一時佛在舍衛國祇樹給孤獨園與大比丘眾千二百五十人俱爾時世尊食時著衣持鉢入舍衛大城乞食於其城中次第乞已還至本處飯食訖收衣鉢洗足已敷座而坐時長老須菩提在大眾中即從座起偏袒右肩右膝著地合掌恭敬而白佛言希有世尊如來善護念諸菩薩善付囑諸菩薩';
  const MXBT = '慶曆中有布衣畢昇又為活板其法用膠泥刻字薄如錢唇每字為一印火燒令堅先設一鐵板其上以松脂蠟和紙灰之類冒之欲印則以一鐵範置鐵板上乃密布字印滿鐵範為一板持就火煬之藥稍鎔則以一平板按其面則字平如砥若止印三二本未為簡易若印數十百千本則極為神速常作二鐵板一板印刷一板已自布字此印者纔畢則第二板已具更互用之瞬息可就每一字皆有數印如之也等字每字有二十餘印以備一板內有重複者不用則以紙帖之每韻為一帖木格貯之';
  const GEN = 'n principio creavit deus celum et terram. Terra autem erat inanis et vacua: et tenebre erant super faciem abissi: et spiritus domini ferebatur super aquas. Dixitq; deus. Fiat lux. Et facta est lux. Et vidit deus lucem q esset bona: et divisit lucem a tenebris. Appellavitq; lucem diem et tenebras noctem. Factumq; est vespere et mane dies unus. Dixit quoq; deus. Fiat firmamentum in medio aquarum: et dividat aquas ab aquis. Et fecit deus firmamentum: divisitq; aquas que erant sub firmamento ab hiis que erant super firmamentum: et factum est ita. Vocavitq; deus firmamentum celum: et factum est vespere et mane dies secundus. Dixit vero deus. Congregentur aque que sub celo sunt in locum unum et appareat arida. Et factum est ita. Et vocavit deus aridam terram: congregationesq; aquarum appellavit maria. Et vidit deus q esset bonum: et ait. Germinet terra herbam virentem et facientem semen: et lignum pomiferum faciens fructum iuxta genus suum: cuius semen in semetipso sit super terram. Et factum est ita. Et protulit terra herbam virentem et facientem semen iuxta genus suum: lignumq; faciens fructum et habens unumquodq; sementem secundum speciem suam. Et vidit deus q esset bonum: et factum est vespere et mane dies tercius. Dixit autem deus. Fiant luminaria in firmamento celi: et dividant diem ac noctem: et sint in signa et tempora et dies et annos: ut luceant in firmamento celi et illuminent terram. Et factum est ita. Fecitq; deus duo luminaria magna: luminare maius ut preesset diei et luminare minus ut preesset nocti: et stellas.';

  // ---------- baked assets ----------
  let wallTex, frieze, caisson, celTex, creamTex, songFrame;
  let blkDraft, blkCarved, blkInkTop, blkInked, patches = [];
  let shFront, shBack, shBackRub, inkP, rubP;
  let scroll, colo = [0, 0];
  const typeImg = {};
  let pieces = [], tray, plate, ssFront, ssBack, ssBackRub, ssInkP, ssRubP;
  let cover, leaf, marks = [];
  let mPage, mInit, mPen, mInc, mCaps, mFull, press, platen, board, shelves;

  function bakeFrieze() { // Dunhuang hanging valance (垂幔): layered triangles, bead strings and bells
    const [c, g] = C2(W, 124);
    g.fillStyle = TA.blue; g.fillRect(0, 0, W, 26);
    for (let x = 10; x < W; x += 20) { g.fillStyle = TA.gold; g.beginPath(); g.arc(x, 13, 5, 0, TAU); g.fill(); g.strokeStyle = TA.ink; g.lineWidth = 1; g.stroke(); }
    g.fillStyle = TA.ink; g.fillRect(0, 26, W, 3); g.fillStyle = TA.red; g.fillRect(0, 29, W, 10); g.fillStyle = TA.ink; g.fillRect(0, 39, W, 2);
    const tw = 76, top = 41, cols = [[TA.green, '#62A98B', '#B2D3BF'], [TA.blue, '#5291AE', '#A6C8D5'], [TA.red, '#C46E52', '#E6B49A'], [TA.ochre, '#CB9D6E', '#EACFAA']];
    const tri = (x, w, h) => { g.beginPath(); g.moveTo(x, top); g.lineTo(x + w, top); g.lineTo(x + w / 2, top + h); g.closePath(); };
    for (let i = 0, x = -30; x < W + tw; i++, x += tw) {
      const [c0, c1, c2] = cols[i % 4];
      tri(x, tw, 58); g.fillStyle = c0; g.fill(); g.strokeStyle = TA.ink; g.lineWidth = 2; g.stroke();
      tri(x + 10, tw - 20, 40); g.fillStyle = c1; g.fill();
      tri(x + 20, tw - 40, 22); g.fillStyle = c2; g.fill();
      g.strokeStyle = TA.ink; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x + tw / 2, top + 58); g.lineTo(x + tw / 2, top + 66); g.stroke();
      g.fillStyle = TA.gold; g.beginPath(); g.arc(x + tw / 2, top + 70, 4.5, 0, TAU); g.fill(); g.stroke();
      // bead string between the triangles
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + 64); g.stroke();
      for (const [yy, rr, col] of [[top + 18, 3.5, '#EADFC6'], [top + 34, 3.5, TA.red], [top + 50, 3.5, '#EADFC6']]) { g.fillStyle = col; g.beginPath(); g.arc(x, yy, rr, 0, TAU); g.fill(); g.stroke(); }
      g.fillStyle = TA.gold; g.beginPath(); g.moveTo(x - 5, top + 74); g.lineTo(x - 3, top + 64); g.lineTo(x + 3, top + 64); g.lineTo(x + 5, top + 74); g.closePath(); g.fill(); g.stroke();
    }
    return wear(c, .64, .03);
  }
  function petal(g, m, ang, r0, r1, hw) {
    const p = (r, a) => [m + Math.cos(a) * r, m + Math.sin(a) * r], dr = r1 - r0, da = hw / ((r0 + r1) / 2);
    const b = p(r0, ang);
    g.beginPath(); g.moveTo(b[0], b[1]);
    g.bezierCurveTo(...p(r0 + dr * .3, ang - da * 1.25), ...p(r0 + dr * .85, ang - da * .7), ...p(r1, ang));
    g.bezierCurveTo(...p(r0 + dr * .85, ang + da * .7), ...p(r0 + dr * .3, ang + da * 1.25), b[0], b[1]);
    g.closePath();
  }
  function bakeCaisson() { // 藻井: banded square well with a lotus at its heart
    const S = CAS, m = S / 2, [c, g] = C2(S, S), IN = 62;
    g.fillStyle = TA.ink; g.fillRect(0, 0, S, S);
    g.fillStyle = TA.blue; g.fillRect(3, 3, S - 6, S - 6);
    const lz = [TA.red, TA.green, TA.gold, TA.ochre];
    for (let side = 0; side < 4; side++) for (let s = 18, k = 0; s < S - 8; s += 32, k++) {
      const [x, y] = [[s, 18], [S - 18, s], [S - s, S - 18], [18, S - s]][side];
      g.fillStyle = lz[(k + side) % 4]; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 12, y); g.lineTo(x, y + 12); g.lineTo(x - 12, y); g.closePath(); g.fill();
      g.strokeStyle = TA.ink; g.lineWidth = 1.3; g.stroke();
    }
    g.fillStyle = TA.gold; g.fillRect(33, 33, S - 66, S - 66);
    g.fillStyle = TA.ink; g.fillRect(37, 37, S - 74, S - 74);
    g.fillStyle = TA.red; g.fillRect(39, 39, S - 78, S - 78);
    for (let side = 0; side < 4; side++) for (let s = 49; s < S - 45; s += 22) {
      const [x, y] = [[s, 49], [S - 49, s], [S - s, S - 49], [49, S - s]][side];
      g.fillStyle = '#EADFC6'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.strokeStyle = TA.ink; g.lineWidth = 1.1; g.stroke();
    }
    g.fillStyle = TA.ink; g.fillRect(IN - 3, IN - 3, S - 2 * IN + 6, S - 2 * IN + 6);
    g.clearRect(IN, IN, S - 2 * IN, S - 2 * IN);
    for (const [qx, qy, a0] of [[IN, IN, 0], [S - IN, IN, Math.PI / 2], [S - IN, S - IN, Math.PI], [IN, S - IN, Math.PI * 1.5]]) {
      for (let k = 0; k < 3; k++) {
        g.save(); g.translate(qx - m, qy - m);
        petal(g, m, a0 + (k + 1) * Math.PI / 8, 8, 70, 17); g.fillStyle = k === 1 ? TA.red : TA.green; g.fill(); g.strokeStyle = TA.ink; g.lineWidth = 1.5; g.stroke();
        g.restore();
      }
    }
    g.lineWidth = 6; g.strokeStyle = TA.ochre; g.beginPath(); g.arc(m, m, 216, 0, TAU); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = TA.ink; g.beginPath(); g.arc(m, m, 220, 0, TAU); g.stroke(); g.beginPath(); g.arc(m, m, 212, 0, TAU); g.stroke();
    const ring = (n, r0, r1, hw, fill, inner, off) => {
      for (let i = 0; i < n; i++) {
        const a = off + i * TAU / n;
        petal(g, m, a, r0, r1, hw); g.fillStyle = fill; g.fill(); g.strokeStyle = TA.ink; g.lineWidth = 1.8; g.stroke();
        petal(g, m, a, r0 + (r1 - r0) * .18, r1 - (r1 - r0) * .2, hw * .45); g.fillStyle = inner; g.fill();
      }
    };
    ring(16, 112, 206, 40, TA.blue, '#7FAFC0', 0);
    ring(12, 70, 140, 34, TA.green, '#86BBA0', TAU / 24);
    ring(8, 40, 92, 28, TA.red, '#D58A6E', 0);
    g.fillStyle = TA.gold; g.beginPath(); g.arc(m, m, 42, 0, TAU); g.fill(); g.strokeStyle = TA.ink; g.lineWidth = 2; g.stroke();
    for (let i = 0; i < 7; i++) { const a = i * TAU / 7, r = i ? 24 : 0; g.fillStyle = TA.ochre; g.beginPath(); g.arc(m + Math.cos(a) * r, m + Math.sin(a) * r, 6, 0, TAU); g.fill(); g.lineWidth = 1.2; g.stroke(); }
    return wear(c, .66, .025);
  }
  function blockPage(g, col) { // the page as it should print (right column read first: 如是 / 我聞)
    g.fillStyle = col; g.strokeStyle = col;
    g.lineWidth = 9; g.strokeRect(26, 26, BW - 52, BH - 52);
    font(g, 162, KAI, 400); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.lineJoin = 'round';
    const put = (c, x, y) => { g.fillText(c, x, y); g.strokeText(c, x, y); };
    put('如', BW / 2 + 130, BH / 2 - 92); put('是', BW / 2 + 130, BH / 2 + 92);
    put('我', BW / 2 - 130, BH / 2 - 92); put('聞', BW / 2 - 130, BH / 2 + 92);
  }
  function bakeBlock() {
    const wood = GL.bake(WOOD, BW, BH, { C: [.82, .64, .44] });
    const [P, pg] = C2(BW, BH); blockPage(pg, '#000');
    const M = flipH(P);
    const [d, dg] = C2(BW, BH); dg.drawImage(wood, 0, 0);
    dg.globalAlpha = .62; dg.filter = 'blur(.7px)'; dg.drawImage(tint(M, TA.ink), 0, 0); dg.filter = 'none'; dg.globalAlpha = 1;
    blkDraft = d;
    const [cv, cg] = C2(BW, BH); cg.drawImage(wood, 0, 0);
    cg.fillStyle = 'rgba(70,38,16,.42)'; cg.fillRect(0, 0, BW, BH);
    const r = mulberry(77);
    for (let i = 0; i < 1100; i++) {
      const x = r() * BW, y = r() * BH, a = (r() - .5) * 1.6, l = 7 + r() * 16;
      cg.strokeStyle = r() < .55 ? 'rgba(40,20,8,.28)' : 'rgba(240,205,160,.2)'; cg.lineWidth = 1 + r() * 2;
      cg.beginPath(); cg.moveTo(x, y); cg.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); cg.stroke();
    }
    cg.filter = 'blur(3px)'; cg.globalAlpha = .8; cg.drawImage(tint(M, '#22110A'), 6, 7); cg.filter = 'none';
    cg.globalAlpha = .75; cg.drawImage(tint(M, '#F4E0BC'), -2, -2); cg.globalAlpha = 1;
    cg.drawImage(clipTo(M, wood), 0, 0);
    cg.globalAlpha = .55; cg.drawImage(tint(M, TA.ink), 0, 0); cg.globalAlpha = 1;
    blkCarved = cv;
    const [it, ig] = C2(BW, BH); ig.drawImage(tint(M, '#140E0A'), 0, 0);
    const sh = ig.createLinearGradient(0, 0, BW, BH); sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,.06)');
    ig.globalCompositeOperation = 'source-atop'; ig.fillStyle = sh; ig.fillRect(0, 0, BW, BH);
    blkInkTop = it;
    const [bi, bg] = C2(BW, BH); bg.drawImage(cv, 0, 0); bg.globalAlpha = .96; bg.drawImage(it, 0, 0); blkInked = bi;
    // carving order: one character after another, gouge by gouge
    const rr = mulberry(31); patches = [];
    for (let j = 0; j < 18; j++) for (let i = 0; i < 24; i++) {
      const x = (i + .5) * BW / 24 + (rr() - .5) * 12, y = (j + .5) * BH / 18 + (rr() - .5) * 12;
      const q = (x < BW / 2 ? 0 : 2) + (y < BH / 2 ? 0 : 1);
      const xl = (x % (BW / 2)) / (BW / 2), yl = (y % (BH / 2)) / (BH / 2);
      patches.push({ x, y, a: (rr() - .5) * 1.1 + .4, l: 36 + rr() * 14, w: 22 + rr() * 8, key: q + (yl * .75 + xl * .25) * .9 + rr() * .08, s: rr() });
    }
    patches.sort((a, b) => a.key - b.key);
    // printing sheet: back (mirror image soaking through) and printed front
    const pap = GL.bake(PAPER, SPW, SPH, { C: [.93, .87, .72] });
    const ox = (SPW - BW) / 2, oy = (SPH - BH) / 2;
    const [b0, b0g] = C2(SPW, SPH); b0g.drawImage(pap, 0, 0); b0g.globalAlpha = .07; b0g.drawImage(tint(M, TA.ink), ox, oy); shBack = b0;
    const [b1, b1g] = C2(SPW, SPH); b1g.drawImage(pap, 0, 0); b1g.filter = 'blur(1.4px)'; b1g.globalAlpha = .4; b1g.drawImage(tint(M, '#3A2A1E'), ox, oy);
    b1g.filter = 'none'; b1g.globalAlpha = .14; b1g.drawImage(tint(M, '#FFFFFF'), ox - 1.5, oy - 1.5); shBackRub = b1;
    const [f, fg] = C2(SPW, SPH); fg.drawImage(pap, 0, 0);
    const ink = wear(tint(P, '#1C1410'), .6, .05); fg.globalAlpha = .93; fg.drawImage(ink, ox, oy); shFront = f;
    inkP = poly([[-30, 72], [630, 72], [630, 215], [-30, 215], [-30, 358], [630, 358]]);
    rubP = poly([[-20, 56], [580, 56], [580, 160], [-20, 160], [-20, 262], [580, 262], [580, 352], [-20, 352]]);
  }
  function frontis(g, w, h) { // frontispiece: the Buddha preaching under a canopy (woodcut line print)
    const I = TA.ink, P = '#E7D19E';
    g.save(); g.strokeStyle = I; g.fillStyle = I; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.lineWidth = 1.5; g.strokeRect(11, 11, w - 22, h - 22);
    g.beginPath(); g.rect(13, 13, w - 26, h - 26); g.clip();
    const cx = w / 2, fy = h * .8;
    g.lineWidth = 1;
    for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(cx + i * 16, fy); g.lineTo(cx + i * 44, h); g.stroke(); }
    for (let j = 1; j < 5; j++) { const y = fy + (h - fy) * Math.pow(j / 5, 1.25); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, fy); g.lineTo(w, fy); g.stroke();
    const tree = (x, y, s) => {
      g.lineWidth = 2; g.beginPath();
      g.moveTo(x - 5 * s, fy); g.bezierCurveTo(x - 4 * s, y + 60 * s, x - 9 * s, y + 30 * s, x - 2 * s, y);
      g.moveTo(x + 5 * s, fy); g.bezierCurveTo(x + 6 * s, y + 60 * s, x + 2 * s, y + 30 * s, x + 4 * s, y); g.stroke();
      const rr = mulberry(Math.round(x * 3));
      for (let k = 0; k < 18; k++) {
        const a = rr() * TAU, d = rr() * 34 * s, px = x + Math.cos(a) * d * 1.3, py = y - 8 * s + Math.sin(a) * d * .8;
        g.fillStyle = P; g.beginPath(); g.arc(px, py, (10 + rr() * 6) * s, 0, TAU); g.fill(); g.lineWidth = 1.3; g.stroke();
        g.fillStyle = I; for (let q = 0; q < 3; q++) { g.beginPath(); g.arc(px + (rr() - .5) * 10 * s, py + (rr() - .5) * 10 * s, 1.5, 0, TAU); g.fill(); }
      }
    };
    tree(w * .12, h * .24, 1.1); tree(w * .88, h * .24, 1.1);
    const fig = (x, y, s, crown) => {
      g.lineWidth = 1.2; g.fillStyle = P;
      g.beginPath(); g.arc(x, y, 12 * s, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x - 9 * s, y + 10 * s); g.quadraticCurveTo(x - 16 * s, y + 40 * s, x - 15 * s, y + 62 * s); g.lineTo(x + 15 * s, y + 62 * s);
      g.quadraticCurveTo(x + 16 * s, y + 40 * s, x + 9 * s, y + 10 * s); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x - 4 * s, y + 18 * s); g.quadraticCurveTo(x - 8 * s, y + 40 * s, x - 6 * s, y + 60 * s);
      g.moveTo(x + 4 * s, y + 18 * s); g.quadraticCurveTo(x + 8 * s, y + 40 * s, x + 6 * s, y + 60 * s); g.stroke();
      g.beginPath(); g.moveTo(x - 6 * s, y + 30 * s); g.lineTo(x, y + 24 * s); g.lineTo(x + 6 * s, y + 30 * s); g.stroke();
      g.beginPath(); g.arc(x, y + 1 * s, 6.5 * s, 0, TAU); g.fill(); g.stroke();
      if (crown) { g.fillStyle = I; g.beginPath(); g.moveTo(x - 7 * s, y - 2 * s); g.lineTo(x - 5 * s, y - 11 * s); g.lineTo(x, y - 6 * s); g.lineTo(x + 5 * s, y - 11 * s); g.lineTo(x + 7 * s, y - 2 * s); g.closePath(); g.fill(); }
    };
    // canopy (華蓋)
    const cy0 = h * .1;
    g.lineWidth = 1.8; g.fillStyle = P;
    g.beginPath(); g.ellipse(cx, cy0 + 18, 92, 22, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.rect(cx - 96, cy0 + 18, 192, 12); g.fill(); g.stroke();
    hatchRect(g, cx - 96, cy0 + 18, 192, 12, Math.PI / 4, 4, 1, I);
    for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(cx - 84 + k * 24, cy0 + 30, 12, 0, Math.PI); g.stroke(); }
    for (let k = 0; k < 9; k++) { const x = cx - 96 + k * 24; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, cy0 + 30); g.lineTo(x, cy0 + 56); g.stroke(); g.fillStyle = I; g.beginPath(); g.arc(x, cy0 + 58, 2.4, 0, TAU); g.fill(); }
    g.beginPath(); g.moveTo(cx, cy0 - 20); g.lineTo(cx - 7, cy0 - 3); g.lineTo(cx + 7, cy0 - 3); g.closePath(); g.fill();
    fig(cx - 104, h * .3, 1, true); fig(cx + 104, h * .3, 1, true);
    fig(cx - 140, h * .44, 1.1, false); fig(cx + 140, h * .44, 1.1, false);
    // mandorla + nimbus
    const by = h * .53;
    g.fillStyle = P; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, by, 66, 100, 0, 0, TAU); g.fill(); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.ellipse(cx, by, 58, 92, 0, 0, TAU); g.stroke();
    for (let a = 0; a < TAU; a += TAU / 56) { g.beginPath(); g.moveTo(cx + Math.cos(a) * 58, by + Math.sin(a) * 92); g.lineTo(cx + Math.cos(a) * 66, by + Math.sin(a) * 100); g.stroke(); }
    const sy = h * .37;
    g.lineWidth = 1.6; g.beginPath(); g.arc(cx, sy, 28, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, sy, 23, 0, TAU); g.stroke();
    // the Buddha
    g.fillStyle = P; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(cx - 7, sy + 13); g.quadraticCurveTo(cx - 30, sy + 18, cx - 36, sy + 36);
    g.quadraticCurveTo(cx - 44, sy + 70, cx - 60, sy + 94); g.quadraticCurveTo(cx, sy + 108, cx + 60, sy + 94);
    g.quadraticCurveTo(cx + 44, sy + 70, cx + 36, sy + 36); g.quadraticCurveTo(cx + 30, sy + 18, cx + 7, sy + 13); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(cx, sy + 96, 64, 14, 0, 0, TAU); g.fill(); g.stroke();
    g.lineWidth = 1.1;
    for (const k of [-1, 1]) {
      g.beginPath(); g.moveTo(cx + k * 10, sy + 20); g.quadraticCurveTo(cx + k * 28, sy + 50, cx + k * 22, sy + 88); g.stroke();
      g.beginPath(); g.moveTo(cx + k * 24, sy + 30); g.quadraticCurveTo(cx + k * 38, sy + 60, cx + k * 42, sy + 90); g.stroke();
    }
    g.beginPath(); g.moveTo(cx - 40, sy + 96); g.quadraticCurveTo(cx, sy + 86, cx + 40, sy + 96); g.stroke();
    g.beginPath(); g.arc(cx, sy + 58, 6, 0, TAU); g.stroke();
    g.lineWidth = 1.6; g.beginPath(); g.arc(cx, sy, 13, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = I; g.beginPath(); g.arc(cx, sy, 13, Math.PI, 0); g.fill(); g.beginPath(); g.arc(cx, sy - 15, 6.5, 0, TAU); g.fill();
    const ty = sy + 108;
    g.fillStyle = P; g.lineWidth = 1.4;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(cx + k * 18 - 10, ty + 16); g.quadraticCurveTo(cx + k * 18 - 9, ty - 2, cx + k * 18, ty - 6); g.quadraticCurveTo(cx + k * 18 + 9, ty - 2, cx + k * 18 + 10, ty + 16); g.fill(); g.stroke(); }
    g.beginPath(); g.rect(cx - 58, ty + 16, 116, 12); g.fill(); g.stroke(); hatchRect(g, cx - 58, ty + 16, 116, 12, Math.PI / 2, 5, 1, I);
    // guardians at the front, Subhuti kneeling, altar with censer
    fig(cx - 168, h * .56, 1.25, true); fig(cx + 168, h * .56, 1.25, true);
    const kx = cx - 92, ky = fy + 10;
    g.fillStyle = P; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(kx - 22, ky + 30); g.quadraticCurveTo(kx - 26, ky + 4, kx - 8, ky - 14); g.quadraticCurveTo(kx + 8, ky - 20, kx + 14, ky - 6); g.lineTo(kx + 20, ky + 30); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(kx + 6, ky - 24, 7, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(kx + 12, ky - 10); g.lineTo(kx + 27, ky - 19); g.stroke();
    g.beginPath(); g.ellipse(kx - 2, ky + 31, 30, 5, 0, 0, TAU); g.stroke();
    const ax = cx + 20, ay = fy + 6;
    g.beginPath(); g.rect(ax - 34, ay, 68, 9); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(ax - 28, ay + 9); g.lineTo(ax - 30, ay + 30); g.moveTo(ax + 28, ay + 9); g.lineTo(ax + 30, ay + 30); g.stroke();
    g.beginPath(); g.arc(ax, ay - 6, 8, 0, Math.PI); g.fill(); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.moveTo(ax, ay - 8); g.bezierCurveTo(ax - 8, ay - 20, ax + 8, ay - 28, ax, ay - 40); g.stroke();
    g.restore();
  }
  function bakeScroll() {
    const [c, g] = C2(SCW, SCH);
    g.drawImage(GL.bake(PAPER, SCW, SCH, { C: [.91, .8, .58] }), 0, 0);
    for (let x = 210; x < SCW; x += 410) { g.fillStyle = 'rgba(110,70,25,.12)'; g.fillRect(x, 0, 3, SCH); }
    const eg = g.createLinearGradient(0, 0, 0, SCH); eg.addColorStop(0, 'rgba(110,70,25,.22)'); eg.addColorStop(.06, 'rgba(110,70,25,0)'); eg.addColorStop(.94, 'rgba(110,70,25,0)'); eg.addColorStop(1, 'rgba(110,70,25,.25)');
    g.fillStyle = eg; g.fillRect(0, 0, SCW, SCH);
    const [L, lg] = C2(SCW, SCH);
    lg.fillStyle = TA.ink; lg.fillRect(20, 28, SCW - 20, 3); lg.fillRect(20, SCH - 31, SCW - 20, 3);
    const fw = 430, fx = SCW - 34 - fw;
    lg.save(); lg.translate(fx, 40); frontis(lg, fw, SCH - 80); lg.restore();
    lg.fillStyle = TA.ink;
    let x = fx - 52;
    vcol(lg, '金剛般若波羅蜜經', x, 48, 31, 34, KAI); x -= 50;
    for (let i = 0; i < SUTRA.length; i += 11) { vcol(lg, SUTRA.slice(i, i + 11), x, 48, 29, 32.4, KAI); x -= 44; }
    x -= 26; vcol(lg, '金剛般若波羅蜜經', x, 48, 31, 34, KAI);
    x -= 72; vcol(lg, '咸通九年四月十五日', x, 96, 23, 26, KAI);
    colo = [x, 96 + 9 * 13];
    wear(L, .66, .045);
    g.globalAlpha = .94; g.drawImage(L, 0, 0); g.globalAlpha = 1;
    return c;
  }
  function bakeType(chr, inked) { // a fired clay type, seen from above: square face with a raised mirrored character
    const [c, g] = C2(64, 72);
    g.fillStyle = '#7A654F'; g.fillRect(2, 8, 60, 62);
    const gr = g.createLinearGradient(0, 0, 60, 60); gr.addColorStop(0, '#C9B395'); gr.addColorStop(1, '#A58D70');
    g.fillStyle = gr; g.fillRect(2, 2, 60, 60);
    const r = mulberry(chr.codePointAt(0));
    for (let i = 0; i < 90; i++) { g.fillStyle = r() < .5 ? 'rgba(90,65,40,.25)' : 'rgba(240,225,200,.25)'; g.fillRect(2 + r() * 58, 2 + r() * 58, 1.5, 1.5); }
    g.fillStyle = 'rgba(255,242,220,.4)'; g.fillRect(2, 2, 60, 2); g.fillRect(2, 2, 2, 60);
    g.fillStyle = 'rgba(60,40,22,.4)'; g.fillRect(2, 60, 60, 2); g.fillRect(60, 2, 2, 60);
    g.save(); g.translate(32, 34); g.scale(-1, 1); font(g, 44, SONG, 700); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(58,38,20,.6)'; g.fillText(chr, -2, 2.5);
    g.fillStyle = 'rgba(252,240,218,.75)'; g.fillText(chr, 1.2, -1.2);
    g.fillStyle = inked ? '#16120F' : '#7A6146'; g.fillText(chr, 0, 0);
    g.restore();
    return c;
  }
  function bakeTray() {
    const w = GC * CELL + 32, h = GR * CELL + 32, [c, g] = C2(w, h + 12);
    g.fillStyle = 'rgba(40,30,22,.35)'; g.fillRect(6, 10, w, h);
    g.drawImage(GL.bake(WOOD, w, h, { C: [.5, .36, .24] }), 0, 0);
    for (let j = 0; j < GR; j++) for (let i = 0; i < GC; i++) {
      const x = 16 + i * CELL, y = 16 + j * CELL;
      g.fillStyle = 'rgba(25,14,6,.55)'; g.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
      g.fillStyle = 'rgba(255,230,190,.12)'; g.fillRect(x + 3, y + CELL - 5, CELL - 6, 2);
    }
    g.strokeStyle = '#2B1A0E'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.strokeStyle = 'rgba(255,225,180,.25)'; g.lineWidth = 1.5; g.strokeRect(5, 5, w - 10, h - 10);
    return c;
  }
  function bakePlate() { // iron plate with the iron frame (铁范) and the resin-wax bed
    const w = 220, h = 420, [c, g] = C2(w + 10, h + 12);
    g.fillStyle = 'rgba(20,25,24,.35)'; g.fillRect(8, 10, w, h);
    g.drawImage(GL.bake(IRON, w, h), 0, 0);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4);
    const fx = FX - 1083, fy = FY0 - 198;
    g.fillStyle = '#5A4632'; g.fillRect(fx - 40, fy - 40, 80, 4 * SLOT + 10);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(fx - 40, fy - 40, 80, 6);
    g.strokeStyle = '#1A1C1D'; g.lineWidth = 12; g.strokeRect(fx - 46, fy - 46, 92, 4 * SLOT + 22);
    g.strokeStyle = 'rgba(200,205,205,.28)'; g.lineWidth = 2; g.strokeRect(fx - 52, fy - 52, 104, 4 * SLOT + 34);
    return c;
  }
  function bakeSongSheet() {
    const w = 136, h = 316, pap = GL.bake(PAPER, w, h, { C: [.95, .93, .86] });
    const [P, pg] = C2(w, h); pg.fillStyle = '#000';
    vcol(pg, '我在这里', w / 2, 53 - 35, 44, 70, SONG, 700);
    const M = flipH(P);
    const [b0, g0] = C2(w, h); g0.drawImage(pap, 0, 0); g0.globalAlpha = .06; g0.drawImage(tint(M, SO.ink), 0, 0); ssBack = b0;
    const [b1, g1] = C2(w, h); g1.drawImage(pap, 0, 0); g1.filter = 'blur(1.2px)'; g1.globalAlpha = .38; g1.drawImage(tint(M, '#2A2A26'), 0, 0); ssBackRub = b1;
    const [f, fg] = C2(w, h); fg.drawImage(pap, 0, 0); fg.globalAlpha = .94; fg.drawImage(wear(tint(P, '#151311'), .63, .06), 0, 0); ssFront = f;
    ssInkP = poly([[0, -20], [0, 340]]);
    ssRubP = poly([[-10, 30], [146, 30], [146, 110], [-10, 110], [-10, 190], [146, 190], [146, 280], [-10, 280]]);
  }
  function fishtail(g, x, y, dir) { // 鱼尾 mark in the 版心
    g.beginPath(); g.moveTo(x - 17, y); g.lineTo(x + 17, y); g.lineTo(x + 17, y + 20 * dir); g.lineTo(x, y + 10 * dir); g.lineTo(x - 17, y + 20 * dir); g.closePath(); g.fill();
  }
  function bakeSongFrame() { // the screen as a Song-edition block page: double border, column rules, centre fold
    const [c, g] = C2(W, H); g.strokeStyle = SO.ink; g.fillStyle = SO.ink;
    const x0 = 120, y0 = 60, x1 = 1800, y1 = 832;
    g.globalAlpha = .6; g.lineWidth = 5; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    g.lineWidth = 1.6; g.strokeRect(x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20);
    g.beginPath(); g.moveTo(924, y0 + 10); g.lineTo(924, y1 - 10); g.moveTo(996, y0 + 10); g.lineTo(996, y1 - 10); g.stroke();
    fishtail(g, 960, 150, 1); fishtail(g, 960, 742, -1);
    g.lineWidth = 3; g.beginPath(); g.moveTo(960, y0 + 10); g.lineTo(960, 150); g.moveTo(960, 742); g.lineTo(960, y1 - 10); g.stroke();
    g.globalAlpha = .16; g.lineWidth = 1.3; g.beginPath();
    for (let x = 924 - 72; x > x0 + 20; x -= 72) { g.moveTo(x, y0 + 10); g.lineTo(x, y1 - 10); }
    for (let x = 996 + 72; x < x1 - 20; x += 72) { g.moveTo(x, y0 + 10); g.lineTo(x, y1 - 10); }
    g.stroke();
    return c;
  }
  function bakeBook() {
    const pap = GL.bake(PAPER, LW_, LH_, { C: [.93, .89, .79] });
    const [c, g] = C2(LW_, LH_); g.drawImage(pap, 0, 0);
    const gr = g.createLinearGradient(LW_ / 2 - 50, 0, LW_ / 2 + 50, 0);
    gr.addColorStop(0, 'rgba(70,50,30,0)'); gr.addColorStop(.5, 'rgba(70,50,30,.2)'); gr.addColorStop(1, 'rgba(70,50,30,0)');
    g.fillStyle = gr; g.fillRect(LW_ / 2 - 50, 0, 100, LH_);
    const [L, lg] = C2(LW_, LH_); lg.strokeStyle = SO.ink; lg.fillStyle = SO.ink;
    const bx = 34, by = 40, bw = LW_ - 68, bh = LH_ - 80;
    lg.lineWidth = 3.5; lg.strokeRect(bx, by, bw, bh);
    lg.lineWidth = 1.2; lg.beginPath(); lg.moveTo(bx + 6, by); lg.lineTo(bx + 6, by + bh); lg.moveTo(bx + bw - 6, by); lg.lineTo(bx + bw - 6, by + bh);
    const vl = LW_ / 2 - 17, vr = LW_ / 2 + 17;
    lg.moveTo(vl, by); lg.lineTo(vl, by + bh); lg.moveTo(vr, by); lg.lineTo(vr, by + bh); lg.stroke();
    lg.save(); lg.translate(0, 0); fishtail(lg, LW_ / 2, by + 70, 1); fishtail(lg, LW_ / 2, by + bh - 70, -1); lg.restore();
    lg.lineWidth = 2.4; lg.beginPath(); lg.moveTo(LW_ / 2, by); lg.lineTo(LW_ / 2, by + 70); lg.moveTo(LW_ / 2, by + bh - 70); lg.lineTo(LW_ / 2, by + bh); lg.stroke();
    vcol(lg, '筆談十八', LW_ / 2, by + 104, 15, 18, SONG, 400);
    const pitch = 40.5, rows = 15, step = bh / rows;
    const colsX = [];
    for (let i = 0; i < 8; i++) colsX.push(bx + bw - 6 - pitch / 2 - i * pitch);
    for (let i = 0; i < 8; i++) colsX.push(vl - pitch / 2 - i * pitch);
    lg.globalAlpha = .55; lg.lineWidth = 1; lg.beginPath();
    colsX.forEach((x, i) => { if (i % 8 !== 7) { lg.moveTo(x - pitch / 2, by); lg.lineTo(x - pitch / 2, by + bh); } });
    lg.stroke(); lg.globalAlpha = 1;
    vcol(lg, '夢溪筆談卷第十八', colsX[0], by, 25, step, SONG, 700);
    vcol(lg, '技藝', colsX[1], by + step * 2, 25, step, SONG, 700);
    marks = [];
    for (let k = 0; k < MXBT.length; k++) {
      const col = 2 + Math.floor(k / rows), row = k % rows;
      if (col >= colsX.length) break;
      const cx = colsX[col], cy = by + row * step + step / 2;
      font(lg, 24, SONG, 400); lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillText(MXBT[k], cx, cy);
      if (/[畢昇活板]/.test(MXBT[k]) && k < 14) marks.push([cx + 16, cy]);
    }
    wear(L, .67, .07);
    g.globalAlpha = .95; g.drawImage(L, 0, 0); g.globalAlpha = 1;
    leaf = c;
    const cw = LW_ / 2, [cc, cg] = C2(cw, LH_);
    cg.drawImage(GL.bake(PAPER, cw, LH_, { C: [.24, .31, .42] }), 0, 0);
    const sg2 = cg.createLinearGradient(cw - 30, 0, cw, 0); sg2.addColorStop(0, 'rgba(0,0,0,0)'); sg2.addColorStop(1, 'rgba(0,0,0,.35)');
    cg.fillStyle = sg2; cg.fillRect(cw - 30, 0, 30, LH_);
    cg.fillStyle = '#EDE6D2'; cg.fillRect(26, 30, 64, 270);
    cg.strokeStyle = SO.ink; cg.lineWidth = 1.5; cg.strokeRect(31, 35, 54, 260); cg.lineWidth = .8; cg.strokeRect(34, 38, 48, 254);
    cg.fillStyle = SO.ink; vcol(cg, '夢溪筆談', 58, 50, 40, 58, SONG, 700);
    cover = cc;
  }
  // ---- Mainz ----
  function bakeMainz() {
    const [c, g] = C2(MPW, MPH);
    g.drawImage(GL.bake(CREAM, MPW, MPH, { C: [.965, .935, .86] }), 0, 0);
    const ml = 52, mt = 58, gut = 24, cw = (MPW - 2 * ml - gut) / 2, lh = 24.6, NL = 28;
    font(g, 21.5, FRAK, 400); g.fillStyle = MZ.blk; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    const words = GEN.split(/\s+/), sp = g.measureText(' ').width, caps = [];
    let wi = 0;
    for (let col = 0; col < 2; col++) for (let ln = 0; ln < NL; ln++) {
      if (col === 0 && ln < 2) continue;
      const ind = (col === 0 && ln >= 2 && ln < 10) ? 62 : 0;
      const x0 = ml + col * (cw + gut) + ind, w = cw - ind, y = mt + ln * lh + 18;
      const line = []; let lw = 0;
      while (wi < words.length) {
        const ww = g.measureText(words[wi]).width;
        if (line.length && lw + sp + ww > w) {
          const room = w - lw - sp, wd = words[wi];
          if (room > 34 && wd.length > 5) for (let k = wd.length - 3; k >= 3; k--) {
            const head = wd.slice(0, k) + '-', hw = g.measureText(head).width;
            if (hw <= room && !/[.:;]/.test(wd[k - 1])) { line.push([head, hw]); words[wi] = wd.slice(k); break; }
          }
          break;
        }
        lw += (line.length ? sp : 0) + ww; line.push([words[wi], ww]); wi++;
      }
      const fill = line.reduce((a, b) => a + b[1], 0), gap = line.length > 1 ? (w - fill) / (line.length - 1) : 0;
      let x = x0;
      for (const [wd, ww] of line) { g.fillText(wd, x, y); if (/^[A-Z]/.test(wd)) caps.push([x, y]); x += ww + gap; }
    }
    mPage = c;
    const R = MZ.rub;
    const [ic, ig] = C2(MPW, MPH); // painted initial I
    ig.fillStyle = R; ig.strokeStyle = R;
    const ix = ml + 26, iy0 = mt + 2 * lh + 2, iy1 = mt + 10 * lh - 2;
    ig.beginPath(); ig.moveTo(ix - 9, iy0 + 10); ig.lineTo(ix + 9, iy0 + 10); ig.lineTo(ix + 7, iy1 - 10); ig.lineTo(ix - 7, iy1 - 10); ig.closePath(); ig.fill();
    ig.fillRect(ix - 24, iy0, 48, 12); ig.fillRect(ix - 24, iy1 - 12, 48, 12);
    for (const yy of [iy0 + 6, iy1 - 6]) for (const s of [-1, 1]) { ig.beginPath(); ig.arc(ix + s * 26, yy, 7, 0, TAU); ig.fill(); }
    ig.fillStyle = MZ.cream; ig.beginPath(); ig.moveTo(ix, (iy0 + iy1) / 2 - 22); ig.lineTo(ix + 4, (iy0 + iy1) / 2); ig.lineTo(ix, (iy0 + iy1) / 2 + 22); ig.lineTo(ix - 4, (iy0 + iy1) / 2); ig.closePath(); ig.fill();
    mInit = ic;
    const [pc, pgc] = C2(MPW, MPH); // pen flourishes running down the margin
    pgc.strokeStyle = R; pgc.fillStyle = R; pgc.lineWidth = 1.4; pgc.lineCap = 'round';
    const mx = ml - 20;
    pgc.beginPath(); pgc.moveTo(ix - 20, iy0 + 16); pgc.quadraticCurveTo(mx - 6, iy0 + 30, mx, iy0 + 60); pgc.lineTo(mx, mt + 24 * lh); pgc.stroke();
    for (let k = 0; k < 9; k++) {
      const yy = iy0 + 70 + k * 46, s = k % 2 ? 1 : -1;
      pgc.beginPath(); for (let a = 0; a < 9.5; a += .25) { const rr = 2 + a * 1.35; const px = mx + s * (8 + Math.cos(a) * rr), py = yy + Math.sin(a) * rr; a ? pgc.lineTo(px, py) : pgc.moveTo(mx, yy); } pgc.stroke();
      pgc.beginPath(); pgc.arc(mx - s * 7, yy + 12, 2, 0, TAU); pgc.fill();
    }
    for (let k = 0; k < 7; k++) { pgc.beginPath(); pgc.moveTo(ix + 26, iy0 + 30 + k * 26); pgc.quadraticCurveTo(ix + 34, iy0 + 40 + k * 26, ix + 28, iy0 + 50 + k * 26); pgc.stroke(); }
    mPen = pc;
    const [nc, ng] = C2(MPW, MPH); // rubricated incipit
    // two rubricated lines that must stay inside the left column (no spill into the right one)
    const INC = ['Incipit liber bresith quem', 'nos genesim dicimus.'];
    font(ng, 21.5, FRAK, 400);
    const incW = Math.max(...INC.map(s => ng.measureText(s).width));
    font(ng, Math.min(21.5, 21.5 * (cw - 4) / incW), FRAK, 400); ng.fillStyle = R; ng.textBaseline = 'alphabetic';
    INC.forEach((s, i) => ng.fillText(s, ml, mt + i * lh + 18));
    mInc = nc;
    const [kc, kg] = C2(MPW, MPH); kg.strokeStyle = R; kg.lineWidth = 2.2; kg.lineCap = 'round';
    caps.forEach(([x, y]) => { kg.beginPath(); kg.moveTo(x + 4, y - 15); kg.lineTo(x + 2, y + 1); kg.stroke(); });
    mCaps = kc;
    const [fc, fgc] = C2(MPW, MPH); fgc.drawImage(mPage, 0, 0); [mInit, mPen, mInc, mCaps].forEach(l => fgc.drawImage(l, 0, 0)); mFull = fc;
  }
  function beam(g, x, y, w, h, vert, seed) {
    const B = MZ.blk; g.fillStyle = '#E8DDC4'; g.fillRect(x, y, w, h);
    const r = mulberry(seed); g.strokeStyle = B; g.lineWidth = 1.1;
    if (vert) for (let gx = x + 6 + r() * 4; gx < x + w * .7; gx += 7 + r() * 5) { g.beginPath(); g.moveTo(gx, y + 2); for (let yy = y; yy <= y + h; yy += 18) g.lineTo(gx + Math.sin(yy * .03 + gx) * 1.6, yy); g.stroke(); }
    else for (let gy = y + 5 + r() * 3; gy < y + h * .62; gy += 6 + r() * 4) { g.beginPath(); g.moveTo(x + 2, gy); for (let xx = x; xx <= x + w; xx += 18) g.lineTo(xx, gy + Math.sin(xx * .025 + gy) * 1.4); g.stroke(); }
    if (vert) hatchRect(g, x + w * .7, y, w * .3, h, Math.PI * .3, 3.4, 1.2, B);
    else hatchRect(g, x, y + h * .64, w, h * .36, Math.PI * .2, 3.4, 1.2, B);
    g.lineWidth = 3; g.strokeStyle = B; g.strokeRect(x, y, w, h);
  }
  function bakePress() { // a wooden screw press, as a woodcut
    const [c, g] = C2(PRW, PRH), B = MZ.blk, w = PRW, h = PRH;
    hatchRect(g, 0, h - 26, w, 26, Math.PI * .08, 5, 1, B);
    beam(g, 56, 24, 62, h - 74, true, 11); beam(g, w - 118, 24, 62, h - 74, true, 12);
    beam(g, 0, h - 64, w, 40, false, 13);
    beam(g, 16, 72, w - 32, 64, false, 14); beam(g, 36, 22, w - 72, 30, false, 15);
    g.fillStyle = '#E8DDC4'; g.fillRect(240, 136, 60, 168); g.strokeStyle = B; g.lineWidth = 1.6;
    g.save(); g.beginPath(); g.rect(240, 136, 60, 168); g.clip();
    for (let yy = 120; yy < 320; yy += 13) { g.beginPath(); g.moveTo(240, yy); g.lineTo(300, yy + 10); g.stroke(); }
    hatchRect(g, 282, 136, 18, 168, Math.PI / 2, 3, 1.1, B); g.restore();
    g.lineWidth = 3; g.strokeRect(240, 136, 60, 168);
    beam(g, 210, 304, 120, 62, true, 16);
    // the platen and bar live on their own sprite so the press can pull again
    const [pc, pg] = C2(PRW, PRH);
    pg.strokeStyle = B; pg.lineWidth = 1.5; pg.beginPath(); pg.moveTo(232, 330); pg.lineTo(178, 388); pg.moveTo(308, 330); pg.lineTo(362, 388); pg.stroke();
    pg.fillStyle = '#E8DDC4'; pg.fillRect(250, 300, 40, 70); pg.lineWidth = 3; pg.strokeRect(250, 300, 40, 70); hatchRect(pg, 276, 300, 14, 70, Math.PI / 2, 3, 1, B);
    beam(pg, 150, 386, 240, 34, false, 17);
    pg.lineWidth = 13; pg.lineCap = 'round'; pg.strokeStyle = B; pg.beginPath(); pg.moveTo(270, 340); pg.lineTo(404, 418); pg.stroke();
    pg.lineWidth = 8; pg.strokeStyle = '#E8DDC4'; pg.beginPath(); pg.moveTo(272, 341); pg.lineTo(401, 416); pg.stroke();
    pg.fillStyle = B; pg.beginPath(); pg.arc(408, 421, 11, 0, TAU); pg.fill();
    platen = pc;
    beam(g, 118, 470, 304, 30, false, 18);
    g.fillStyle = B; g.fillRect(150, 462, 240, 8);
    beam(g, 118, 500, w - 118, 22, false, 19);
    beam(g, 118, 572, w - 236, 46, false, 20);
    return c;
  }
  function bakeBoard() { // the platen, close up: woodcut grain on a heavy board
    const [c, g] = C2(W, H), B = MZ.blk;
    g.fillStyle = '#E4D7BB'; g.fillRect(0, 0, W, H);
    const r = mulberry(5150); g.strokeStyle = B;
    for (let y = 6; y < H - 50; y += 7 + r() * 7) {
      g.lineWidth = .8 + r() * 2.6; g.beginPath(); const ph = r() * 10, am = 2 + r() * 6;
      for (let x = -10; x <= W + 30; x += 24) { const yy = y + Math.sin(x * .004 + ph) * am + Math.sin(x * .017 + ph * 2) * 1.3; x < 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
      g.stroke();
    }
    for (const [kx, ky] of [[620, 380], [1310, 640], [1500, 260]]) for (let k = 1; k < 7; k++) { g.lineWidth = 1.6; g.beginPath(); g.ellipse(kx, ky, k * 14, k * 5, 0, 0, TAU); g.fillStyle = '#E4D7BB'; g.fill(); g.stroke(); }
    for (const sx of [300, W - 360]) {
      g.fillStyle = '#E4D7BB'; g.fillRect(sx, 0, 60, H - 46);
      hatchRect(g, sx, 0, 60, H - 46, .7, 3, 1.2, B); hatchRect(g, sx, 0, 60, H - 46, -.7, 3, 1.2, B);
      g.lineWidth = 3; g.strokeRect(sx, -4, 60, H - 42);
      for (let y = 80; y < H - 80; y += 180) { g.fillStyle = '#E4D7BB'; g.beginPath(); g.arc(sx + 30, y, 10, 0, TAU); g.fill(); g.stroke(); }
    }
    g.fillStyle = B; g.fillRect(0, H - 40, W, 40); g.fillStyle = '#E4D7BB'; g.fillRect(0, H - 50, W, 4);
    return c;
  }
  function spine(g, x, y, w, h, r) {
    const B = MZ.blk, dark = r() < .3;
    g.fillStyle = '#EDE3CC'; g.fillRect(x, y, w, h);
    if (dark) { hatchRect(g, x, y, w, h, .75, 2.8, 1.1, B); hatchRect(g, x, y, w, h, -.75, 2.8, 1.1, B); }
    else hatchRect(g, x + w * .7, y, w * .3, h, Math.PI / 2, 2.6, 1, B);
    const nb = 3 + (r() < .5 ? 1 : 0);
    for (let k = 0; k < nb; k++) {
      const by = y + h * (.16 + k * .64 / (nb - 1));
      g.fillStyle = '#EDE3CC'; g.fillRect(x, by - 3, w, 6); g.lineWidth = 1.2; g.strokeStyle = B;
      g.beginPath(); g.moveTo(x, by - 3); g.lineTo(x + w, by - 3); g.moveTo(x, by + 3); g.lineTo(x + w, by + 3); g.stroke();
    }
    if (r() < .1) { g.fillStyle = MZ.rub; g.fillRect(x + 3, y + h * .3, w - 6, h * .14); }
    g.lineWidth = 1.8; g.strokeStyle = B; g.strokeRect(x, y, w, h);
  }
  const SHH = 842, ROWH = 138;
  function bakeShelves() { // a wall of incunabula, as a woodcut
    const [c, g] = C2(W, SHH), r = mulberry(1500), B = MZ.blk;
    g.fillStyle = '#E2D6BA'; g.fillRect(0, 0, W, SHH);
    hatchRect(g, 0, 0, W, SHH, -Math.PI * .25, 7, 1, rgba(B, .4));
    for (let ri = 0; ri < 6; ri++) {
      const yb = SHH - ri * ROWH - 14;
      let x = -r() * 20;
      while (x < W) {
        if (r() < .045) { // a few volumes lying flat
          let yy = yb;
          for (let k = 0; k < 3; k++) { const bw = 100 + r() * 20, bh = 18 + r() * 6; yy -= bh; g.fillStyle = '#EDE3CC'; g.fillRect(x, yy, bw, bh); hatchRect(g, x, yy + bh * .6, bw, bh * .4, 0, 2.6, 1, B); g.lineWidth = 1.8; g.strokeStyle = B; g.strokeRect(x, yy, bw, bh); }
          x += 124; continue;
        }
        const bw = 20 + r() * 26, bh = ROWH - 24 - r() * 30;
        spine(g, x, yb - bh, bw, bh, r); x += bw + 1 + r() * 2;
      }
      g.fillStyle = '#E8DDC4'; g.fillRect(0, yb, W, 14); hatchRect(g, 0, yb + 8, W, 6, 0, 2.5, 1, B);
      g.lineWidth = 2.5; g.strokeStyle = B; g.beginPath(); g.moveTo(0, yb); g.lineTo(W, yb); g.moveTo(0, yb + 14); g.lineTo(W, yb + 14); g.stroke();
    }
    return c;
  }

  // ---------- per-frame drawing ----------
  function knife(ctx, x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(40,20,8,.25)'; ctx.fillRect(40, 4, 130, 14);
    ctx.fillStyle = '#A9B0B2'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(40, -6); ctx.lineTo(40, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E6EAEA'; ctx.fillRect(10, -2, 28, 2);
    ctx.fillStyle = '#5E3F24'; ctx.beginPath(); ctx.roundRect(40, -8, 128, 16, 7); ctx.fill();
    ctx.fillStyle = TA.ink; ctx.fillRect(40, -9, 9, 18); ctx.fillRect(56, -9, 4, 18);
    ctx.restore();
  }
  function roundBrush(ctx, x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(30,15,5,.25)'; ctx.beginPath(); ctx.ellipse(14, 16, 52, 40, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4A3424'; ctx.fillRect(-10, -120, 20, 110);
    const gr = ctx.createRadialGradient(-10, -10, 4, 0, 0, 50); gr.addColorStop(0, '#3a2a20'); gr.addColorStop(1, '#0E0A08');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, 48, 38, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,60,.5)'; ctx.lineWidth = 1;
    for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(k * 9, -30); ctx.lineTo(k * 10, 30); ctx.stroke(); }
    ctx.restore();
  }
  function flatBrush(ctx, x, y, ang, len = 150) { // palm-fibre rubbing brush
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(30,15,5,.22)'; ctx.fillRect(-len / 2 + 10, -14, len, 46);
    ctx.fillStyle = '#7A5636'; ctx.fillRect(-len / 2, -26, len, 22);
    ctx.fillStyle = '#5B3E25'; ctx.fillRect(-len / 2, -8, len, 6);
    ctx.fillStyle = '#9C7748'; ctx.fillRect(-len / 2 + 2, -2, len - 4, 22);
    ctx.strokeStyle = 'rgba(60,40,20,.55)'; ctx.lineWidth = 1;
    for (let k = 0; k < len - 6; k += 5) { ctx.beginPath(); ctx.moveTo(-len / 2 + 4 + k, -1); ctx.lineTo(-len / 2 + 5 + k, 20); ctx.stroke(); }
    ctx.restore();
  }
  function blockSide(ctx, x, y, w, h, a = 1) { // thickness + shadow of a block lying on the bench
    ctx.save(); ctx.globalAlpha = a;
    softShadow(ctx, x, y + 6, w, h + 20, .35, 26, 10, 18);
    ctx.fillStyle = '#7D5634'; ctx.fillRect(x, y + h, w, 24);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + h + 16, w, 8);
    ctx.restore();
  }
  function drawSheetFlip(ctx, back, front, cx, cy, q, sc0, sc1, lift, dark) {
    const c = Math.cos(q * Math.PI), s = Math.sin(q * Math.PI), sc = lerp(sc0, sc1, q) * (1 + .08 * s);
    const img = c >= 0 ? back : front, w = img.width, h = img.height;
    ctx.save(); ctx.translate(cx, cy - lift * s);
    ctx.save(); ctx.globalAlpha *= .3 * (1 - .4 * s); ctx.fillStyle = dark; ctx.filter = `blur(${8 + 14 * s}px)`;
    ctx.fillRect((-w / 2) * sc * Math.abs(c) + 12 + 30 * s, -h / 2 * sc + 14 + 46 * s, w * sc * Math.abs(c), h * sc); ctx.restore();
    ctx.scale(sc * Math.max(.02, Math.abs(c)), sc * (1 - .03 * s));
    ctx.drawImage(img, -w / 2, -h / 2);
    if (s > .02) { ctx.fillStyle = `rgba(60,40,20,${.25 * s * (1 - Math.abs(c))})`; ctx.fillRect(-w / 2, -h / 2, w, h); }
    ctx.restore();
  }

  function drawTang(ctx, t) {
    const out = 1 - smooth(OUT0, OUT0 + .35, t);
    // caisson + title backdrop
    if (out > 0) {
      ctx.save(); ctx.globalAlpha = out * smooth(-.1, .5, t);
      ctx.drawImage(caisson, CAX, CAY);
      ctx.restore();
    }
    // the block on the bench (right)
    if (out > 0) {
      ctx.save(); ctx.globalAlpha = out;
      ctx.translate(0, (1 - out) * 30);
      blockSide(ctx, BX, BY, BW, BH);
      if (t < CARVE1) {
        const n = Math.floor(clamp((t - CARVE0) / (CARVE1 - CARVE0)) * patches.length);
        ctx.drawImage(blkDraft, BX, BY);
        if (n > 0) {
          ctx.save(); ctx.beginPath(); ctx.rect(BX, BY, BW, BH); ctx.clip(); ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const p = patches[i], ca = Math.cos(p.a), sa = Math.sin(p.a), hx = p.l / 2, hy = p.w / 2;
            const px = BX + p.x, py = BY + p.y;
            ctx.moveTo(px - ca * hx + sa * hy, py - sa * hx - ca * hy); ctx.lineTo(px + ca * hx + sa * hy, py + sa * hx - ca * hy);
            ctx.lineTo(px + ca * hx - sa * hy, py + sa * hx + ca * hy); ctx.lineTo(px - ca * hx - sa * hy, py - sa * hx + ca * hy); ctx.closePath();
          }
          ctx.clip(); ctx.drawImage(blkCarved, BX, BY); ctx.restore();
        }
      } else ctx.drawImage(blkCarved, BX, BY);
      // ink on the raised strokes
      if (t > INK0) revealAlong(ctx, blkInkTop, BX, BY, inkP, ease.inOut(clamp((t - INK0) / (INK1 - INK0))), 170);
      // carving knife + chips
      if (t > CARVE0 && t < CARVE1 + .5) {
        const ip = clamp((t - CARVE0) / (CARVE1 - CARVE0)) * (patches.length - 1), i0 = Math.floor(ip);
        for (let i = Math.max(0, i0 - 16); i <= i0; i++) {
          const p = patches[i], ti = CARVE0 + (i / (patches.length - 1)) * (CARVE1 - CARVE0), dt = t - ti;
          if (dt < 0 || dt > .5 || i % 2) continue;
          const a = -Math.PI / 2 + (p.s - .5) * 2.4, v = 260 + p.s * 220;
          const x = BX + p.x + Math.cos(a) * v * dt, y = BY + p.y + Math.sin(a) * v * dt + 900 * dt * dt;
          ctx.save(); ctx.translate(x, y); ctx.rotate(dt * 18 + p.s * 6); ctx.globalAlpha = out * (1 - dt / .5);
          ctx.strokeStyle = '#E2BF8E'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, 0, 5 + p.s * 4, 0, 3.6); ctx.stroke();
          ctx.strokeStyle = 'rgba(90,55,25,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 3 + p.s * 4, 0, 3.4); ctx.stroke();
          ctx.restore();
        }
        if (t < CARVE1 + .25) {
          const p = patches[Math.min(patches.length - 1, i0)], k = (ip - i0);
          const lift = t > CARVE1 ? smooth(CARVE1, CARVE1 + .25, t) * 120 : 0;
          knife(ctx, BX + p.x + Math.cos(p.a) * (k - .5) * p.l * .6, BY + p.y + Math.sin(p.a) * (k - .5) * p.l * .6 - lift, -.95 + p.a * .2);
        }
      }
      if (t > INK0 && t < INK1 + .3) {
        const u = ease.inOut(clamp((t - INK0) / (INK1 - INK0))), e = polyAt(inkP, u), a = smooth(INK0, INK0 + .12, t) * (1 - smooth(INK1, INK1 + .3, t));
        ctx.save(); ctx.globalAlpha = a * out; roundBrush(ctx, BX + e[0], BY + e[1] - (1 - a) * 60, .5); ctx.restore();
      }
      ctx.restore();
    }
    // the sheet: laid, rubbed, peeled and flipped to the left
    if (t > PAP0 && out > 0) {
      const sx = BX + (BW - SPW) / 2, sy = BY + (BH - SPH) / 2;
      ctx.save(); ctx.globalAlpha = out;
      if (t < PEEL0) {
        const k = ease.out(smooth(PAP0, PAP1, t)), sc = 1 + (1 - k) * .14;
        ctx.save(); ctx.translate(sx + SPW / 2 - (1 - k) * 90, sy + SPH / 2 - (1 - k) * 40); ctx.scale(sc, sc);
        ctx.globalAlpha = out * .35; ctx.fillStyle = '#2a1608'; ctx.filter = `blur(${4 + 16 * (1 - k)}px)`;
        ctx.fillRect(-SPW / 2 + 4 + 40 * (1 - k), -SPH / 2 + 6 + 50 * (1 - k), SPW, SPH); ctx.filter = 'none'; ctx.globalAlpha = out;
        ctx.drawImage(shBack, -SPW / 2, -SPH / 2);
        ctx.restore();
        if (t > RUB0) revealAlong(ctx, shBackRub, sx, sy, rubP, ease.inOut(clamp((t - RUB0) / (RUB1 - RUB0))), 120);
        if (t > RUB0 - .1 && t < RUB1 + .3) {
          const u = ease.inOut(clamp((t - RUB0) / (RUB1 - RUB0))), e = polyAt(rubP, u), a = smooth(RUB0 - .1, RUB0 + .05, t) * (1 - smooth(RUB1, RUB1 + .3, t));
          ctx.save(); ctx.globalAlpha = a * out; flatBrush(ctx, sx + e[0], sy + e[1] - (1 - a) * 50, -.08); ctx.restore();
        }
      } else {
        const q = ease.inOut(clamp((t - PEEL0) / (PEEL1 - PEEL0)));
        const cx = lerp(sx + SPW / 2, CAX + CAS / 2, q), cy = lerp(sy + SPH / 2, CAY + CAS / 2, q);
        drawSheetFlip(ctx, shBackRub, shFront, cx, cy, q, 1, .86, 90, '#2a1608');
      }
      ctx.restore();
    }
    // the Diamond Sutra scroll
    if (t > SCR0 - .25 && t < LIFT1 + .05) drawScroll(ctx, t);
  }
  function drawRoll(ctx, x, y, h, rr) {
    ctx.save();
    const knob = (yy) => { ctx.fillStyle = '#6B2A1A'; ctx.beginPath(); ctx.roundRect(x - rr - 6, yy, rr * 2 + 12, 16, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,220,180,.25)'; ctx.fillRect(x - rr - 2, yy + 3, rr * 2 + 4, 3); };
    knob(y - 22); knob(y + h + 6);
    ctx.fillStyle = '#4E2C17'; ctx.fillRect(x - 5, y - 8, 10, h + 16);
    const gr = ctx.createLinearGradient(x - rr, 0, x + rr, 0);
    gr.addColorStop(0, '#8E7446'); gr.addColorStop(.35, '#EAD7A6'); gr.addColorStop(.7, '#CDB27A'); gr.addColorStop(1, '#7B6038');
    ctx.fillStyle = gr; ctx.fillRect(x - rr, y - 3, rr * 2, h + 6);
    ctx.strokeStyle = 'rgba(80,55,25,.35)'; ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - rr + k * rr * .5, y); ctx.lineTo(x - rr + k * rr * .5, y + h); ctx.stroke(); }
    ctx.restore();
  }
  function drawScroll(ctx, t) {
    const u = ease.out(smooth(SCR0, SCR1, t));
    const xr = SCX + SCW * (1 - u) + (1 - smooth(SCR0 - .25, SCR0, t)) * 160;
    const z = ease.inOut(smooth(ZOOM0, ZOOM1, t)), s = lerp(1, 1.8, z);
    const fx = lerp(W / 2, SCX + colo[0], z), fy = lerp(SCY + SCH / 2, SCY + colo[1], z);
    const lift = ease.in(smooth(LIFT0, LIFT1, t));
    ctx.save();
    ctx.globalAlpha = smooth(SCR0 - .25, SCR0, t);
    ctx.translate(lerp(W / 2, 880, z) + lift * 120, 425 + 7 * z - lift * 1500); ctx.rotate(-lift * .08); ctx.scale(s, s); ctx.translate(-fx, -fy);
    const vis = SCX + SCW - xr;
    if (vis > 1) {
      softShadow(ctx, xr, SCY, vis, SCH, .3 + lift * .2, 22 + lift * 40, 8 + lift * 40, 14 + lift * 70);
      ctx.drawImage(scroll, xr - SCX, 0, vis, SCH, xr, SCY, vis, SCH);
    }
    drawRoll(ctx, xr, SCY, SCH, lerp(10, 30, Math.sqrt(1 - u)));
    ctx.restore();
  }

  // pieces: the block splits into a 10×7 grid that becomes clay type in the tray
  const SPECIAL = { '4,3': 0, '7,1': 1, '1,5': 2, '8,5': 3 }, WORD = '我在这里';
  function trayXY(i, j) { return [TX + CELL / 2 + i * CELL, TY + CELL / 2 + j * CELL]; }
  function pieceDraw(ctx, p, t) {
    const cw = BW / GC, chh = BH / GR;
    const c0 = [SBX + (p.i + .5) * cw, SBY + (p.j + .5) * chh], bc = [SBX + BW / 2, SBY + BH / 2];
    const sep = ease.out(smooth(SPLIT + .28, SPLIT + .55, t));
    const p0 = [c0[0] + (c0[0] - bc[0]) * .09 * sep + (p.r1 - .5) * 8 * sep, c0[1] + (c0[1] - bc[1]) * .09 * sep + (p.r2 - .5) * 8 * sep];
    const f = ease.inOut(clamp((t - p.s) / .58));
    const tc = trayXY(p.i, p.j);
    let x = lerp(p0[0], tc[0], f), y = lerp(p0[1], tc[1], f) - Math.sin(f * Math.PI) * (90 + p.r1 * 80), rot = Math.sin(f * Math.PI) * (p.r2 - .5) * 1.4, sc = 1 + Math.sin(f * Math.PI) * .12;
    let inked = false, alpha = 1, ghost = 0;
    if (p.k >= 0) {
      const k = p.k, h0 = 12.4 + k * .24, b0 = 15.2 + k * .13, slot = [FX, FY0 + k * SLOT];
      const ho = ease.inOut(clamp((t - h0) / .42)), hb = ease.inOut(clamp((t - b0) / .4));
      if (ho > 0 && hb <= 0) { x = lerp(tc[0], slot[0], ho); y = lerp(tc[1], slot[1], ho) - Math.sin(ho * Math.PI) * 120; sc = 1 + Math.sin(ho * Math.PI) * .25; rot = Math.sin(ho * Math.PI) * .3; }
      if (hb > 0) { x = lerp(slot[0], tc[0], hb); y = lerp(slot[1], tc[1], hb) - Math.sin(hb * Math.PI) * 100; sc = 1 + Math.sin(hb * Math.PI) * .2; rot = -Math.sin(hb * Math.PI) * .25; }
      inked = t > 13.45 + .4 * (k + .5) / 4;
    }
    const g0 = 17.9 + 1.1 * p.rank;
    if (t > g0) { ghost = smooth(g0, g0 + .4, t); alpha = 1 - ghost; }
    if (alpha > 0) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha = alpha;
      const fw = smooth(.2, .62, f);
      if (fw < 1) { // still a fragment of the pear-wood block
        ctx.globalAlpha = alpha * (1 - fw);
        ctx.fillStyle = '#6B4628'; ctx.fillRect(-cw / 2, -chh / 2 + 5, cw, chh);
        ctx.drawImage(blkInked, p.i * cw, p.j * chh, cw, chh, -cw / 2, -chh / 2, cw, chh);
        if (sep > 0) { ctx.strokeStyle = 'rgba(30,15,5,.6)'; ctx.lineWidth = 1.5; ctx.strokeRect(-cw / 2, -chh / 2, cw, chh); }
      }
      if (fw > 0) { ctx.globalAlpha = alpha * fw; ctx.drawImage(typeImg[p.c][inked ? 1 : 0], -32, -32); }
      ctx.restore();
    }
    if (ghost > 0) { // nothing survives: the type crumbles to a dashed outline
      ctx.save(); ctx.globalAlpha = .55 * ghost; ctx.strokeStyle = '#E6DAC2'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.strokeRect(tc[0] - 27, tc[1] - 27, 54, 54); ctx.restore();
      const gf = clamp((t - g0) / .6);
      if (gf < 1) for (let d = 0; d < 6; d++) {
        const dx = (hash2(p.i * 7 + d, p.j * 3) - .5) * 50, dy = hash2(p.i + d * 5, p.j * 11 + d) * 20;
        ctx.fillStyle = rgba('#8F785C', (1 - gf) * .8); ctx.fillRect(x + dx, y + dy + 70 * gf * gf, 2.5, 2.5);
      }
    }
  }
  function drawSplitBlock(ctx, t) { // the inked block, then saw lines cut it into a grid
    blockSide(ctx, SBX, SBY, BW, BH, 1 - smooth(SPLIT + .2, SPLIT + .4, t));
    ctx.drawImage(blkInked, SBX, SBY);
    const cw = BW / GC, chh = BH / GR;
    ctx.save(); ctx.lineCap = 'round';
    for (let l = 0; l < GC - 1 + GR - 1; l++) {
      const k = clamp((t - SPLIT - (l % 5) * .03 - (l > 8 ? .06 : 0)) / .2);
      if (k <= 0) continue;
      ctx.beginPath();
      if (l < GC - 1) { const x = SBX + (l + 1) * cw; ctx.moveTo(x, SBY); ctx.lineTo(x, SBY + BH * k); }
      else { const y = SBY + (l - GC + 2) * chh; ctx.moveTo(SBX, y); ctx.lineTo(SBX + BW * k, y); }
      ctx.strokeStyle = 'rgba(20,10,4,.85)'; ctx.lineWidth = 2.6; ctx.stroke();
    }
    ctx.restore();
  }
  function drawSong(ctx, t) {
    const fr = smooth(11.5, 12.2, t) * (1 - .62 * smooth(15.9, 16.5, t));
    if (fr > 0) { ctx.globalAlpha = fr; ctx.drawImage(songFrame, 0, 0); ctx.globalAlpha = 1; }
    const ta = smooth(11.1, 11.45, t);
    if (ta > 0) { ctx.globalAlpha = ta; ctx.drawImage(tray, TX - 16, TY - 16); ctx.globalAlpha = 1; }
    // iron plate, inking, paper, printing
    const pa = smooth(12.0, 12.35, t) * (1 - smooth(15.85, 16.2, t));
    if (pa > 0) { ctx.globalAlpha = pa; ctx.drawImage(plate, 1083, 198); ctx.globalAlpha = 1; }
    if (t < SPLIT + .3) drawSplitBlock(ctx, t);
    else for (const p of pieces) if (!(p.k >= 0 && t > 12.4 + p.k * .24 && t < 15.2 + p.k * .13)) pieceDraw(ctx, p, t);
    for (const p of pieces) if (p.k >= 0 && t > 12.4 + p.k * .24 && t < 15.2 + p.k * .13) pieceDraw(ctx, p, t); // pieces in the frame on top
    if (t > 13.4 && t < 14.0) {
      const u = ease.inOut(clamp((t - 13.45) / .4)), a = smooth(13.4, 13.5, t) * (1 - smooth(13.85, 14.0, t));
      ctx.save(); ctx.globalAlpha = a; roundBrush(ctx, FX + 6, FY0 - 50 + u * (3 * SLOT + 100), .2); ctx.restore();
    }
    const sw = 136, shh = 316, scx = FX, scy = FY0 + 1.5 * SLOT;
    if (t > 13.9 && t < 16.25) {
      const fade = 1 - smooth(15.85, 16.2, t);
      ctx.save(); ctx.globalAlpha = fade;
      if (t < 14.6) {
        const k = ease.out(smooth(13.9, 14.15, t)), sc = 1 + (1 - k) * .16;
        ctx.save(); ctx.translate(scx - (1 - k) * 50, scy - (1 - k) * 30); ctx.scale(sc, sc);
        ctx.globalAlpha = fade * .3; ctx.fillStyle = '#0d1a17'; ctx.filter = `blur(${3 + 12 * (1 - k)}px)`; ctx.fillRect(-sw / 2 + 4 + 30 * (1 - k), -shh / 2 + 6 + 40 * (1 - k), sw, shh); ctx.filter = 'none';
        ctx.globalAlpha = fade; ctx.drawImage(ssBack, -sw / 2, -shh / 2); ctx.restore();
        if (t > 14.15) revealAlong(ctx, ssBackRub, scx - sw / 2, scy - shh / 2, ssRubP, ease.inOut(clamp((t - 14.15) / .4)), 90);
        if (t > 14.1 && t < 14.7) { const e = polyAt(ssRubP, ease.inOut(clamp((t - 14.15) / .4))), a = smooth(14.1, 14.18, t) * (1 - smooth(14.55, 14.7, t)); ctx.globalAlpha = a * fade; flatBrush(ctx, scx - sw / 2 + e[0], scy - shh / 2 + e[1], -.05, 110); }
      } else {
        const q = ease.inOut(clamp((t - 14.6) / .55));
        drawSheetFlip(ctx, ssBackRub, ssFront, lerp(scx, 1560, q), lerp(scy, 392, q), q, 1, 1.18, 70, '#0d1a17');
      }
      ctx.restore();
    }
    // 《梦溪笔谈》: a butterfly-bound book opens on the right
    if (t > 15.9) {
      const k = ease.out(smooth(15.95, 16.5, t)), dx = (1 - k) * 380;
      ctx.save(); ctx.globalAlpha = smooth(15.95, 16.3, t); ctx.translate(dx, 0);
      const th = ease.inOut(smooth(16.55, 17.3, t)), c = Math.cos(th * Math.PI), hinge = BKX + LW_ / 2;
      softShadow(ctx, BKX, BKY, LW_ / 2 + (c < 0 ? -c * LW_ / 2 : 0), LH_, .3, 22, 10, 14);
      if (th > 0) ctx.drawImage(leaf, 0, 0, LW_ / 2, LH_, BKX, BKY, LW_ / 2, LH_);
      if (c >= 0) {
        ctx.drawImage(cover, hinge - (LW_ / 2) * c, BKY, (LW_ / 2) * c, LH_);
        ctx.fillStyle = `rgba(0,0,0,${.3 * (1 - c)})`; ctx.fillRect(hinge - (LW_ / 2) * c, BKY, (LW_ / 2) * c, LH_);
      } else {
        ctx.drawImage(leaf, LW_ / 2, 0, LW_ / 2, LH_, hinge, BKY, (LW_ / 2) * -c, LH_);
        ctx.fillStyle = `rgba(40,25,10,${.25 * (1 + c)})`; ctx.fillRect(hinge, BKY, (LW_ / 2) * -c, LH_);
      }
      // a reader's cinnabar circles beside 畢昇 and 活板
      marks.forEach(([mx, my], i) => {
        const a = clamp((t - 17.5 - i * .14) / .25);
        if (a <= 0 || (mx > LW_ / 2 && c > -.98)) return;
        ctx.strokeStyle = SO.cin; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(BKX + mx + 2, BKY + my, 6, -Math.PI / 2, -Math.PI / 2 + TAU * a); ctx.stroke();
      });
      ctx.restore();
    }
    // the empty place in the tray glows
    if (t > 18.8) { // lamplight pooled in one empty slot: warm and low, no white hot spot
      const [gx, gy] = trayXY(4, 3), a = smooth(18.8, 19.7, t) * (.92 + .08 * Math.sin(t * 4.2));
      ctx.save();
      const halo = ctx.createRadialGradient(gx, gy, 20, gx, gy, 92);
      halo.addColorStop(0, `rgba(214,168,92,${.32 * a})`); halo.addColorStop(1, 'rgba(214,168,92,0)');
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = halo; ctx.fillRect(gx - 96, gy - 96, 192, 192);
      ctx.globalCompositeOperation = 'source-over';
      const pool = ctx.createRadialGradient(gx, gy + 6, 2, gx, gy, 34);
      pool.addColorStop(0, `rgba(226,186,110,${.88 * a})`); pool.addColorStop(1, `rgba(176,122,74,${.6 * a})`);
      ctx.fillStyle = pool; ctx.fillRect(gx - 27, gy - 27, 54, 54);
      ctx.strokeStyle = rgba(TA.gold, a); ctx.lineWidth = 2.5; ctx.strokeRect(gx - 28, gy - 28, 56, 56);
      ctx.restore();
    }
  }
  function drawPlatenDown(ctx, t) {
    const k = ease.in(clamp((t - 19.9) / (SLAM - 19.9))), yb = H * k;
    const g = ctx.createLinearGradient(0, yb, 0, yb + 260);
    g.addColorStop(0, `rgba(10,12,10,${.55 * k})`); g.addColorStop(1, 'rgba(10,12,10,0)');
    ctx.fillStyle = g; ctx.fillRect(0, yb, W, 260);
    ctx.drawImage(board, 0, yb - H);
  }
  function drawMainz(ctx, t) {
    const sh = clamp(1 - (t - SLAM) / .45);
    ctx.save();
    if (sh > 0) ctx.translate(Math.sin(t * 97) * 14 * sh * sh, Math.cos(t * 73) * 10 * sh * sh);
    ctx.drawImage(creamTex, -20, -20, W + 40, H + 40);
    const M0 = 24.1, M1 = 24.75;
    // card 5: the wall of incunabula spreads out from the stack
    if (t > 25.8) for (let ri = 0; ri < 6; ri++) {
      const st = 25.85 + ri * .3, e = ease.out(clamp((t - st) / .95));
      if (e <= 0) continue;
      const y0 = SHH - (ri + 1) * ROWH - 14, hh = ROWH, cx = 900, half = (W * .62) * e;
      ctx.save(); ctx.beginPath(); ctx.rect(cx - half, y0 + 14, half * 2, hh); ctx.clip();
      ctx.globalAlpha = .92; ctx.drawImage(shelves, 0, y0 + 14, W, hh, 0, y0 + 14, W, hh); ctx.restore();
    }
    // the press
    const pa = 1 - smooth(25.5, 26.0, t);
    if (pa > 0) { // a second pull of the bar: the platen bites and lifts
      const dy = 26 * (ease.inOut(smooth(23.15, 23.45, t)) - ease.inOut(smooth(23.75, 24.1, t)));
      ctx.globalAlpha = pa; ctx.drawImage(platen, PRX, PRY + dy); ctx.drawImage(press, PRX, PRY); ctx.globalAlpha = 1;
    }
    if (t < M0) {
      softShadow(ctx, MPX, MPY, MPW, MPH, .28, 20, 8, 12);
      ctx.drawImage(mPage, MPX, MPY);
      const r0 = 21.2;
      const kI = clamp((t - r0) / .5), kP = clamp((t - r0 - .5) / .45), kN = clamp((t - r0 - .95) / .5), kC = smooth(r0 + 1.4, r0 + 1.9, t);
      const clipDraw = (img, x, y, w, h) => { if (w <= 0 || h <= 0) return; ctx.save(); ctx.beginPath(); ctx.rect(MPX + x, MPY + y, w, h); ctx.clip(); ctx.drawImage(img, MPX, MPY); ctx.restore(); };
      clipDraw(mInit, 0, 0, MPW, 100 + 200 * kI);
      clipDraw(mPen, 0, 0, MPW, 118 + 580 * kP);
      clipDraw(mInc, 0, 0, 52 + 240 * kN, MPH);
      if (kC > 0) { ctx.globalAlpha = kC; ctx.drawImage(mCaps, MPX, MPY); ctx.globalAlpha = 1; }
      // the rubricator's quill
      const qa = smooth(r0 - .2, r0, t) * (1 - smooth(r0 + 1.45, r0 + 1.75, t));
      if (qa > 0) {
        let qx, qy;
        if (kI < 1) { qx = 78; qy = 110 + 200 * kI; } else if (kP < 1) { qx = 32 + Math.sin(kP * 30) * 8; qy = 300 + 400 * kP; } else { qx = 52 + 240 * kN; qy = 70 + (kN > .55 ? 25 : 0); }
        quill(ctx, MPX + qx, MPY + qy, qa);
      }
    } else {
      // card 5: the page becomes the top of a stack that keeps growing, then the camera pulls back to the wall
      const k = ease.inOut(smooth(M0, M1, t));
      const SW = 360, OX = 90, OY = 130, X0 = 560;
      const Hs = 6 + 500 * ease.inOut(smooth(M1 - .05, 26.2, t));
      const yTop = 836 - Hs;
      const pb = ease.inOut(smooth(25.9, 27.4, t)), ss = lerp(1, .62, pb), ax = X0 + SW / 2 + OX / 2, ay = 836;
      const PB = [ss, 0, 0, ss, ax - ss * ax + (960 - ax) * pb, ay - ss * ay];
      const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
      if (pb > 0) { // a pool of paper-light behind the stack keeps it legible against the wall
        const gx = PB[0] * (X0 + SW / 2 + OX / 2) + PB[4], gy = PB[3] * (yTop + Hs / 2 - OY / 2) + PB[5];
        const gr = ctx.createRadialGradient(gx, gy, 40, gx, gy, 380);
        gr.addColorStop(0, rgba('#EFE6D2', .9 * pb)); gr.addColorStop(1, rgba('#EFE6D2', 0));
        ctx.fillStyle = gr; ctx.fillRect(gx - 400, gy - 400, 800, 800);
      }
      const A = [1, 0, 0, 1, MPX, MPY], Bm = [SW / MPW, 0, -OX / MPH, OY / MPH, X0 + OX, yTop - OY];
      const mtx = mul(PB, A.map((v, i) => lerp(v, Bm[i], k)));
      ctx.save(); ctx.setTransform(...PB); ctx.globalAlpha = smooth(.45, .95, k);
      if (k > .45) { // front face (sheet edges) + side face
        const hh = Hs * k;
        ctx.fillStyle = '#F1E9D6'; ctx.fillRect(X0, yTop, SW, hh);
        ctx.strokeStyle = rgba(MZ.blk, .42); ctx.lineWidth = .8; ctx.beginPath();
        for (let y = yTop + 4; y < yTop + hh; y += 4.6) { const j = hash2(Math.round(y), 3) * 6; ctx.moveTo(X0 + j, y); ctx.lineTo(X0 + SW - j * .5, y + Math.sin(y * .7) * .6); }
        ctx.stroke();
        const side = () => { ctx.beginPath(); ctx.moveTo(X0 + SW, yTop); ctx.lineTo(X0 + SW + OX, yTop - OY); ctx.lineTo(X0 + SW + OX, yTop - OY + hh); ctx.lineTo(X0 + SW, yTop + hh); ctx.closePath(); };
        side(); ctx.fillStyle = '#DCD0B3'; ctx.fill();
        ctx.save(); ctx.clip(); hatchRect(ctx, X0 + SW, yTop - OY, OX, hh + OY, Math.PI * .5, 5.5, 1, MZ.blk); ctx.restore();
        side(); ctx.strokeStyle = MZ.blk; ctx.lineWidth = 2.5; ctx.stroke(); ctx.strokeRect(X0, yTop, SW, hh);
      }
      ctx.restore();
      ctx.save(); ctx.setTransform(...mtx); ctx.drawImage(mFull, 0, 0); ctx.lineWidth = 2.5 / Math.max(.2, mtx[3]); ctx.strokeStyle = MZ.blk; if (k > .5) ctx.strokeRect(0, 0, MPW, MPH); ctx.restore();
      // fresh sheets keep landing
      if (t > M1 && t < 26.3) for (let n = 0; n < 4; n++) {
        const ph = ((t - M1) * (2.5 + 5 * smooth(M1, 25.6, t)) + n / 4) % 1, f = ease.in(ph);
        const yy = yTop - 260 * (1 - f), xx = (n % 2 ? 40 : -50) * (1 - f);
        ctx.save(); ctx.globalAlpha = smooth(0, .2, ph) * (1 - smooth(.9, 1, ph)) * (1 - smooth(26.0, 26.3, t));
        ctx.setTransform(...mul(PB, [SW / MPW, 0, -OX / MPH + Math.sin(ph * 6 + n) * .06 * (1 - f), OY / MPH, X0 + OX + xx, yy - OY]));
        ctx.drawImage(mFull, 0, 0); ctx.restore();
      }
    }
    ctx.restore();
    // the platen lifts off the fresh impression
    if (t < SLAM + .6) {
      const yb = H * (1 - ease.inOut(clamp((t - SLAM - .05) / .48)));
      ctx.drawImage(board, 0, yb - H);
    }
  }
  function quill(ctx, x, y, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(-.75);
    ctx.fillStyle = MZ.blk; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, -3); ctx.lineTo(16, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#F2EAD8'; ctx.strokeStyle = MZ.blk; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.quadraticCurveTo(90, -26, 230, -12); ctx.quadraticCurveTo(120, 18, 14, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(228, -12); ctx.stroke();
    for (let k = 40; k < 220; k += 7) { ctx.beginPath(); ctx.moveTo(k, -k * .055 - 1); ctx.lineTo(k + 10, -k * .055 - 10 + k * .02); ctx.stroke(); }
    ctx.restore();
  }

  scene({
    id: 'print', n: ch.n, dur: ch.dur,
    trans: { type: 'print_rub', d: 1.15 },
    cues: [
      { t: .2, sfx: 'carve', v: .7 }, { t: .9, sfx: 'carve', v: .6 }, { t: 1.7, sfx: 'carve', v: .6 },
      { t: 2.5, sfx: 'ink', v: .6 }, { t: 3.5, sfx: 'paper', v: .5 }, { t: 4.0, sfx: 'brush', v: .6 },
      { t: 5.25, sfx: 'paper', v: .8 }, { t: 6.95, sfx: 'paper', v: .5 }, { t: 10.3, sfx: 'whoosh', v: .4 },
      { t: 10.88, sfx: 'crack', v: .7 }, { t: 11.8, sfx: 'type', v: .8 },
      { t: 12.62, sfx: 'click', v: .7 }, { t: 12.86, sfx: 'click', v: .7 }, { t: 13.1, sfx: 'click', v: .7 }, { t: 13.34, sfx: 'click', v: .7 },
      { t: 13.5, sfx: 'ink', v: .5 }, { t: 14.6, sfx: 'paper', v: .7 }, { t: 15.5, sfx: 'type', v: .6 },
      { t: 16.6, sfx: 'paper', v: .6 }, { t: 18.9, sfx: 'chime', v: .4 },
      { t: 19.9, sfx: 'press', v: .8 }, { t: SLAM, sfx: 'impact', v: 1 },
      { t: 21.2, sfx: 'brush', v: .4 }, { t: 23.45, sfx: 'press', v: .5 }, { t: 24.75, sfx: 'paper', v: .7 }, { t: 25.5, sfx: 'paper', v: .7 }, { t: 25.9, sfx: 'whoosh', v: .4 },
    ],
    init() {
      [scr, sg] = C2(640, 820);
      wallTex = GL.bake(WALL, W, H);
      celTex = GL.bake(CELA, W, H);
      creamTex = GL.bake(CREAM, W, H, { C: [.937, .902, .824] });
      frieze = bakeFrieze(); caisson = bakeCaisson();
      bakeBlock(); scroll = bakeScroll();
      const chars = [...new Set([...MXBT])].filter(c => !WORD.includes(c));
      const r = mulberry(808); pieces = []; let n = 0;
      for (let j = 0; j < GR; j++) for (let i = 0; i < GC; i++) {
        const k = SPECIAL[i + ',' + j] ?? -1;
        const c = k >= 0 ? WORD[k] : chars[n++ % chars.length];
        pieces.push({ i, j, k, c, r1: r(), r2: r(), rank: r(), s: 11.24 + .03 * i + .02 * j + .06 * r() });
      }
      for (const p of pieces) if (!typeImg[p.c]) typeImg[p.c] = [bakeType(p.c, false), bakeType(p.c, true)];
      tray = bakeTray(); plate = bakePlate(); bakeSongSheet(); songFrame = bakeSongFrame(); bakeBook();
      bakeMainz(); press = bakePress(); board = bakeBoard(); shelves = bakeShelves();
    },
    draw(ctx, t) {
      if (t < SLAM) {
        const kS = smooth(SPLIT + .1, SPLIT + .8, t);
        if (kS < 1) {
          ctx.drawImage(wallTex, 0, 0);
          ctx.globalAlpha = .9 * (1 - smooth(SPLIT, SPLIT + .4, t)); ctx.drawImage(frieze, 0, 0); ctx.globalAlpha = 1;
        }
        if (kS > 0) { ctx.globalAlpha = kS; ctx.drawImage(celTex, 0, 0); ctx.globalAlpha = 1; }
        if (t < SPLIT) {
          if (t > LIFT0 - .1) drawSplitBlock(ctx, t);
          drawTang(ctx, t);
        } else drawSong(ctx, t);
        if (t > 19.85) drawPlatenDown(ctx, t);
      } else drawMainz(ctx, t);
      opener(ctx, t, ch, {
        ink: TA.ink, sub: TA.sub, accent: TA.red, x: CAX + CAS / 2, y: 428,
        title: { family: SONG, size: 130, weight: 900, sp: 26 },
        small: { family: SONG, size: 27, weight: 700 },
        num: { family: SONG, size: 52, weight: 900 },
        backdrop: (g, b, al) => {
          const gr = g.createRadialGradient(CAX + CAS / 2, CAY + CAS / 2, 40, CAX + CAS / 2, CAY + CAS / 2, 300);
          gr.addColorStop(0, rgba('#DCC9A6', .94 * al)); gr.addColorStop(.75, rgba('#DCC9A6', .88 * al)); gr.addColorStop(1, rgba('#DCC9A6', 0));
          g.fillStyle = gr; g.fillRect(CAX + 62, CAY + 62, CAS - 124, CAS - 124);
        },
      });
      const ink = t < 11.25 ? TA.ink : t < SLAM ? SO.ink : MZ.blk;
      subs(ctx, t, ch, { ink, body: { family: SONG, size: 52, weight: 700 } });
      grain(ctx, t, .045);
    },
  });

  TRANS.print_rub = (ctx, A, B, p) => { ctx.drawImage(GL.run(RUB, W, H, { A, B, P: p }), 0, 0); };
})();
