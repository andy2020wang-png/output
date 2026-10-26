// Style-switch transitions. Each takes (ctx, A, B, p, opts, T) where A is the outgoing frame,
// B the incoming frame and p runs 0 -> 1. GL-based ones share a two-texture mixer shader.
'use strict';

const MIX_HEAD = `uniform sampler2D A; uniform sampler2D B; uniform float P; uniform vec2 D; uniform vec3 C;`;
const MIX = {
  // ink bleeding into paper: B spreads from blots with soft fibrous edges
  ink: MIX_HEAD + `void main(){vec2 p=uv; float n=fbm(p*vec2(6.,3.4)+3.1)*.75+fbm(p*24.)*.25;
    float d=length((p-D)*vec2(R.x/R.y,1.));
    float m=smoothstep(P*1.9-.08,P*1.9+.04,d*.9+n*.55);
    vec4 a=texture(A,p), b=texture(B,p);
    float edge=smoothstep(.0,.06,abs(d*.9+n*.55-P*1.9));
    vec4 c=mix(b,a,m); c.rgb*=mix(.35,1.,edge*.6+.4*(1.-m)+.0); O=vec4(mix(c.rgb, mix(b,a,m).rgb, edge),1.);}`,
  // paper burning away: glowing ember rim
  burn: MIX_HEAD + `void main(){vec2 p=uv; float n=fbm(p*5.+1.7)*.8+vn(p*40.)*.2;
    float x=n+ (1.-p.y)*.25 - (P*1.45-.2);
    vec4 a=texture(A,p), b=texture(B,p);
    float hole=smoothstep(-.005,.005,-x);
    float rim=smoothstep(.07,.0,abs(x));
    float char_=smoothstep(.16,.0,x)*(1.-hole);
    vec3 col=mix(a.rgb*(1.-char_*.85), b.rgb, hole);
    col+=rim*(1.-hole)*vec3(1.6,.62,.16)*1.4;
    O=vec4(col,1.);}`,
  // cracks propagate from a point, B shows through widening fissures
  crack: MIX_HEAD + `void main(){vec2 p=uv; vec2 asp=vec2(R.x/R.y,1.); vec2 q=(p-D)*asp;
    vec2 w=p*asp*2.6+vec2(fbm(p*3.),fbm(p*3.+7.))*.9;
    vec2 v=vor(w); float e=v.y-v.x;
    vec2 v2=vor(w*2.3+5.); float e2=v2.y-v2.x;
    float r=length(q)+fbm(p*6.)*.12;
    float front=P*1.9;
    float reach=smoothstep(front,front-.18,r);
    float line=smoothstep(.035,.0,e)*reach + smoothstep(.02,.0,e2)*smoothstep(front*.7,front*.7-.15,r)*.8;
    float dis=smoothstep(.0,.25,P*1.6-.55-fbm(p*4.+2.)*.6+(1.-reach)*.0);
    vec4 a=texture(A,p), b=texture(B,p);
    float open=clamp(line*smoothstep(.15,.6,P),0.,1.);
    float m=max(open,dis);
    vec3 col=mix(a.rgb*(1.-line*.75), b.rgb, m);
    col+=C*line*(1.-m)*1.6;
    O=vec4(col,1.);}`,
  // pixel dissolve: both frames pixelate, swap at the coarsest point
  pixel: MIX_HEAD + `void main(){float k=sin(P*3.14159); float cells=mix(1080.,18.,pow(k,.6));
    vec2 g=vec2(cells*R.x/R.y,cells); vec2 p=(floor(uv*g)+.5)/g;
    float sw=step(h21(floor(uv*g)*.37+3.),P*1.4-.2);
    vec4 a=texture(A,p), b=texture(B,p); O=vec4(mix(a.rgb,b.rgb,P<.5? sw*0.:1.-((1.-sw)*step(P,.75))),1.);}`,
  // thin glowing line sweeps, B revealed behind (used for scanner / electric transitions)
  scan: MIX_HEAD + `void main(){vec2 p=uv; float x=dot(p-.5,D)+.5; float f=P*1.2-.1;
    float m=smoothstep(f-.002,f+.002,x); vec4 a=texture(A,p), b=texture(B,p);
    vec3 col=mix(b.rgb,a.rgb,m); col+=C*exp(-abs(x-f)*90.)*1.5; O=vec4(col,1.);}`,
  // chromatic glitch with block displacement
  glitch: MIX_HEAD + `void main(){vec2 p=uv; float k=sin(P*3.14159);
    float row=floor(p.y*28.); float jit=(h21(vec2(row,floor(P*24.)))-.5)*.2*k*step(.55,h21(vec2(row*1.3,floor(P*17.))));
    vec2 q=p+vec2(jit,0.); float sw=step(.5,P+(h21(vec2(row,3.))-.5)*.3);
    vec4 a=texture(A,q), b=texture(B,q);
    vec3 col=mix(a.rgb,b.rgb,sw);
    float r=mix(texture(A,q+vec2(.012*k,0)).r,texture(B,q+vec2(.012*k,0)).r,sw);
    float bb=mix(texture(A,q-vec2(.012*k,0)).b,texture(B,q-vec2(.012*k,0)).b,sw);
    O=vec4(r,col.g,bb,1.);}`,
};

const TRANS = {
  cut(ctx, A, B, p) { ctx.drawImage(p < .5 ? A : B, 0, 0); },
  fade(ctx, A, B, p) { ctx.drawImage(A, 0, 0); ctx.globalAlpha = ease.inOut(p); ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1; },
  dip(ctx, A, B, p, o) { // dip through a color (default black)
    ctx.drawImage(p < .5 ? A : B, 0, 0);
    ctx.fillStyle = o.color || '#000'; ctx.globalAlpha = Math.sin(p * Math.PI); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  },
  flash(ctx, A, B, p, o) { // overexposure flash
    ctx.drawImage(p < .45 ? A : B, 0, 0);
    const k = p < .45 ? ease.in(p / .45) : 1 - ease.out((p - .45) / .55);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = o.color || '#fff8ec';
    ctx.globalAlpha = k; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
  wipe(ctx, A, B, p, o) { // hard or soft directional wipe; o.dir: 'l','r','u','d'
    const e = ease.inOut(p); ctx.drawImage(A, 0, 0);
    ctx.save(); ctx.beginPath();
    const d = o.dir || 'l';
    if (d === 'l') ctx.rect(0, 0, W * e, H); else if (d === 'r') ctx.rect(W * (1 - e), 0, W * e, H);
    else if (d === 'd') ctx.rect(0, 0, W, H * e); else ctx.rect(0, H * (1 - e), W, H * e);
    ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
  },
  blinds(ctx, A, B, p, o) { // vertical slats (bamboo strips) slide in one after another
    ctx.drawImage(A, 0, 0); const n = o.n || 16, sw = W / n;
    for (let i = 0; i < n; i++) {
      const k = ease.out(clamp(p * 1.6 - i / n * .6));
      if (k <= 0) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(i * sw, 0, sw + 1, H); ctx.clip();
      ctx.drawImage(B, 0, (1 - k) * (i % 2 ? -H : H)); ctx.restore();
    }
  },
  iris(ctx, A, B, p, o) { // circular reveal (silent-film iris / lens)
    ctx.drawImage(A, 0, 0); const e = ease.inOut(p);
    ctx.save(); ctx.beginPath(); ctx.arc(o.x ?? W / 2, o.y ?? H / 2, e * Math.hypot(W, H) * .6, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(B, 0, 0); ctx.restore();
  },
  page(ctx, A, B, p) { // page turn: A slides and folds away to the left revealing B
    const e = ease.inOut(p); ctx.drawImage(B, 0, 0);
    const x = W * (1 - e);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, H); ctx.clip(); ctx.drawImage(A, 0, 0); ctx.restore();
    const g = ctx.createLinearGradient(x - 120, 0, x + 40, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.75, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 120, 0, 160, H);
  },
  zoom(ctx, A, B, p, o) { // push into a point of A, B grows out of it
    const e = ease.inOut(p), x = o.x ?? W / 2, y = o.y ?? H / 2;
    const sA = 1 + e * e * 6;
    ctx.save(); ctx.translate(x, y); ctx.scale(sA, sA); ctx.translate(-x, -y); ctx.drawImage(A, 0, 0); ctx.restore();
    ctx.globalAlpha = smooth(.35, .8, p);
    const sB = lerp(.3, 1, ease.out(clamp((p - .3) / .7)));
    ctx.save(); ctx.translate(x, y); ctx.scale(sB, sB); ctx.translate(-x, -y); ctx.drawImage(B, 0, 0); ctx.restore();
    ctx.globalAlpha = 1;
  },
};
// register GL mixers
for (const [k, frag] of Object.entries(MIX)) {
  TRANS[k] = (ctx, A, B, p, o) => {
    const c = GL.run(frag, W, H, { A, B, P: p, D: o.at || [.5, .5], C: o.glow || [1, .8, .5] });
    ctx.drawImage(c, 0, 0);
  };
}
