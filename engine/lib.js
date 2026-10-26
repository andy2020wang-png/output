// Shared toolkit for every scene: math, seeded randomness, noise, WebGL shader runner,
// text layout and a few compositing helpers. Everything is deterministic: no Date, no Math.random.
'use strict';

const W = 1920, H = 1080, FPS = 30;

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
const ease = {
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  outBack: t => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  expo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
};
// window of activity: 0 before a, ramps to 1 over [a, a+fi], stays, ramps down over [b-fo, b]
function win(t, a, b, fi = .4, fo = .4) {
  if (t < a || t > b) return 0;
  return Math.min(fi > 0 ? smooth(a, a + fi, t) : 1, fo > 0 ? 1 - smooth(b - fo, b, t) : 1);
}

// ---------- seeded random ----------
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct = 4) {
  let s = 0, a = .5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; }
  return s;
}

// ---------- canvases ----------
function makeCanvas(w = W, h = H) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}
const cache = new Map();
function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

// ---------- WebGL shader runner ----------
const GL = (() => {
  const canvas = makeCanvas(W, H);
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: true });
  const progs = new Map();
  const HEAD = `#version 300 es
precision highp float;
uniform vec2 R; uniform float T; uniform float S;
in vec2 uv; out vec4 O;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 h22(vec2 p){float n=h21(p);return vec2(n,h21(p+n));}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<6;i++){s+=a*vn(p);p=m*p;a*=.5;}return s;}
float fbm3(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<3;i++){s+=a*vn(p);p=m*p;a*=.5;}return s;}
float ridge(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){s+=a*(1.-abs(vn(p)*2.-1.));p=m*p;a*=.5;}return s;}
vec2 vor(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y);vec2 o=h22(i+g);float d=length(g+o-f);
 if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return vec2(d1,d2);}
`;
  const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0,1);}`;
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
    return s;
  }
  function program(frag) {
    if (progs.has(frag)) return progs.get(frag);
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HEAD + frag));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    progs.set(frag, p); return p;
  }
  const texCache = new WeakMap();
  function texFor(src, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    let t = texCache.get(src);
    if (!t) { t = gl.createTexture(); texCache.set(src, t); }
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // Run a fragment shader. uniforms: {name: number | [n,n] | [n,n,n] | [n,n,n,n] | canvas(texture)}
  function run(frag, w, h, uniforms = {}) {
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    const p = program(frag); gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(p, 'R'), w, h);
    let unit = 0;
    for (const [k, v] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(p, k); if (!loc) continue;
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (Array.isArray(v)) gl['uniform' + v.length + 'fv'](loc, v);
      else { texFor(v, unit); gl.uniform1i(loc, unit); unit++; }
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return canvas;
  }
  // Run once and copy to a persistent 2D canvas (for static textures).
  function bake(frag, w, h, uniforms = {}) {
    const out = makeCanvas(w, h);
    out.getContext('2d').drawImage(run(frag, w, h, uniforms), 0, 0);
    return out;
  }
  return { run, bake, gl };
})();

// ---------- text ----------
// Draw text with letter spacing; align: 'left' | 'center' | 'right'
function spaced(ctx, str, x, y, sp = 0, align = 'left') {
  const chars = [...str];
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign; ctx.textAlign = 'left';
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + sp; });
  ctx.textAlign = prev;
  return total;
}
// Chinese-aware wrap: breaks between any CJK chars, keeps latin words together, avoids leading punctuation.
function wrap(ctx, str, maxW) {
  if (str.includes('\n')) return str.split('\n');
  const tokens = str.match(/[A-Za-z0-9.,'’\-–%·:/()]+|\s+|./gu) || [];
  const lines = []; let line = '';
  const noLead = '，。、；：！？）》」』”%';
  for (const tk of tokens) {
    const test = line + tk;
    if (ctx.measureText(test).width > maxW && line.trim() && !noLead.includes(tk)) { lines.push(line.trim()); line = tk.trimStart(); }
    else line = test;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
// Typewriter-style reveal by characters with per-char fade; returns number of lines drawn.
function revealText(ctx, str, x, y, maxW, lh, p, opts = {}) {
  // Glyphs are placed one by one at their left edge, so alignment is computed here and the context is held at 'left'.
  const lines = wrap(ctx, str, maxW);
  const total = [...str].length; let shown = p * total, k = 0;
  const align = opts.align || 'left';
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  lines.forEach((ln, li) => {
    const chars = [...ln];
    const ws = chars.map(c => Math.round(ctx.measureText(c).width * 64) / 64);
    const lw = ws.reduce((p_, q) => p_ + q, 0);
    let cx = align === 'center' ? x - lw / 2 : align === 'right' ? x - lw : x;
    chars.forEach((c, i) => {
      const a = clamp(shown - k); k++;
      if (a > 0) { ctx.globalAlpha = (opts.alpha ?? 1) * a; ctx.fillText(c, cx, y + li * lh + (1 - a) * 6); }
      cx += ws[i];
    });
  });
  ctx.textAlign = prevAlign;
  ctx.globalAlpha = 1;
  return lines.length;
}

// ---------- compositing helpers ----------
function grain(ctx, t, amt = .06, scale = 1) {
  const key = 'grain' + scale;
  const tiles = cached(key, () => {
    const arr = [];
    for (let k = 0; k < 6; k++) {
      const c = makeCanvas(512, 512), g = c.getContext('2d'), id = g.createImageData(512, 512), r = mulberry(99 + k);
      for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      g.putImageData(id, 0, 0); arr.push(c);
    }
    return arr;
  });
  const tile = tiles[Math.floor(t * FPS) % tiles.length];
  ctx.save(); ctx.globalAlpha = amt; ctx.globalCompositeOperation = 'overlay';
  for (let y = 0; y < H; y += 512 * scale) for (let x = 0; x < W; x += 512 * scale) ctx.drawImage(tile, x, y, 512 * scale, 512 * scale);
  ctx.restore();
}
function vignette(ctx, amt = .5, color = '0,0,0', inner = .35) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(1, `rgba(${color},${amt})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function rgba(hex, a = 1) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
