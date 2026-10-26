# Scene authoring guide (for every agent that builds a chapter)

The video is rendered frame by frame in headless Chromium. Every pixel comes from code: Canvas 2D,
WebGL2 fragment shaders, and text set in local fonts. No image, video or audio files may be loaded or
embedded (no data URIs of bitmaps either). Procedural textures are fine and expected.

## Files you may touch
- Your own scene file `engine/scenes/<id>.js` (create it, or rework the prototype if one exists).
- Reference implementation of the layout API: `engine/scenes/papyrus.js`.
- Scratch output anywhere under `/tmp/claude-0/-home-user/18bc3977-43ba-588f-8be5-99bb7b1f733c/scratchpad/`.
- Do NOT edit `lib.js`, `stage.js`, `transitions.js`, `index.html`, `scenes.js`, `render/*`. If you need a helper,
  define it inside your IIFE. If you need a new transition, register it from your file with your scene id as prefix:
  `TRANS.<id>_<name> = (ctx, A, B, p, opts, T) => {...}` (A = outgoing frame canvas, B = incoming, p 0→1), e.g.
  `TRANS.clay_press`. Generic ones already available: cut, fade, dip, flash, wipe, blinds, iris, page, zoom, ink, burn,
  crack, pixel, scan, glitch.

## Scene contract
```js
'use strict';
(() => {
  const ch = CH('<id>');   // approved text + timing
  // module-level caches only (textures baked in init); NO state that changes between frames
  scene({
    id: '<id>',             // must equal the file name
    dur: ch.dur,            // from data/script.js (hook/outro: given in the brief)
    n: ch.n,                // chapter number (omit for hook/outro)
    trans: { type: 'ink', d: 1.0, at: [.5, .5] },   // INCOMING transition from the previous chapter
    cues: [ { t: 0.4, sfx: 'knot' }, ... ],         // local times of visual events the score must hit
    init() { /* bake static textures with GL.bake(...) */ },
    draw(ctx, t, info) { /* t = local seconds, may run slightly past dur during the next transition */ },
  });
})();
```

## Determinism rules (hard)
- A frame must be a pure function of `t`. No `Math.random`, `Date`, `performance.now`, timers, rAF, CSS animation,
  or state mutated across frames. Use `mulberry(seed)` / `hash2` / `vnoise` / `fbm` from lib.js, or GLSL `h21/vn/fbm/ridge/vor`.
- Bake static textures once in `init()` (`GL.bake(frag, w, h, uniforms)` returns a 2D canvas). Per-frame shaders
  are allowed (`GL.run(frag, w, h, uniforms)` returns the shared GL canvas; draw it immediately with drawImage).
- In GLSL the header already declares `uniform vec2 R; uniform float T; uniform float S;`, `in vec2 uv; out vec4 O;`
  and helpers `h21 h22 vn fbm fbm3 ridge vor`. Do not redeclare `R`, `T`, `S` (name samplers e.g. `SRC`).
- Budget: about 1 s per frame on 4 CPU cores with SwiftShader. Keep per-frame full-screen shaders cheap
  (≤ 3 fbm calls per pixel) or run them at half resolution and upscale.
- Draw past `dur` gracefully (the outgoing scene keeps rendering during the next scene's incoming transition).

## Information layout (director's rule: no corner labels)
All approved text and timing live in `engine/data/script.js` (generated; never edit). In your scene:
```js
const ch = CH('<id>');            // {id, n, title, en, era, cards:[...], segs:[[a,b],...], dur, meter:{label,value,unit}, notes}
scene({ id: ch.id, n: ch.n, dur: ch.dur, trans: {...}, cues: [...], init() {...}, draw(ctx, t) {
  ...art...
  opener(ctx, t, ch, style);      // title moment ≈ 0.55–3.5 s: title, era line, preserved-for figure, then it leaves
  subs(ctx, t, ch, style);        // the subtitle cards at ch.segs, bottom centre, baseline y≈1000
}});
```
- The ONLY persistent text is the subtitle. Do not add corner labels, captions, HUDs, progress bars, chapter numbers,
  watermarks, English taglines or source notes (the one approved note is drawn by `subs` itself).
- Text that physically belongs to the medium (the strokes on a tablet, glyphs on papyrus, a DOS prompt, dimension
  lines on a blueprint, a printed page) is part of the art, not a label — keep it secondary in contrast and size, keep it
  away from the subtitle zone, and never let it state facts that are not in the approved script.
- `opener` style: `{ink, sub, accent, title:{family,size,weight,sp}, small:{family,size,weight}, num:{family,size,weight},
  x, y, align, inAt, outAt, shadow, backdrop(ctx, box, alpha)}`. Compose the art so the title moment reads cleanly
  (empty area, a backdrop, or the title integrated into the material), then let the art take over.
- `subs` style: `{ink, body:{family,size,weight}, band, bandA, bandFn(ctx,x,y,w,h,alpha), y, shadow, noteInk}`.
  Body 50–54 px. Keep the bottom ~180 px calm, or give the text a band in the era's idiom (a paper strip, a terminal bar…).
- Each card has a window `ch.segs[i]`; the picture should show what card i talks about while it is on screen.
- `win`, `smooth`, `ease`, `clamp`, `lerp`, `font`, `spaced`, `wrap`, `revealText`, `grain`, `vignette`, `rgba`,
  `mulberry`, `hash2`, `vnoise`, `fbm`, `makeCanvas`, `cached`, `GL.bake`, `GL.run` come from lib.js.

## Sound cues
List visual events the score must hit in `cues: [{t, sfx, v}]` (local seconds, optional volume 0–1). Use only these
names: knot, rope, clay, stylus, fire, crack, brush, reed, harp, bamboo, cord, ink, drip, water, paper, carve, wood, type,
press, punch, bell, tape, relay, beep, seek, key, click, spin, disk, fan, blip, shutter, chime, stamp, tick, whoosh,
impact (at most once per chapter), heartbeat. 6–20 cues per chapter is typical. The music itself is composed separately.

## Fonts available (family names for ctx.font)
Chinese: "Noto Serif SC" (400/700/900), "Noto Sans SC" (300/400/700), "Ma Shan Zheng" (brush kai), "Zhi Mang Xing"
(running script), "Long Cang" (cursive), "ZCOOL XiaoWei", "LXGW WenKai TC", "WenQuanYi Zen Hei Sharp" (bitmap).
Latin/other: Cinzel, "Cormorant Garamond", "EB Garamond", "IM Fell English", "IM Fell English SC", UnifrakturMaguntia,
"Uncial Antiqua", "Playfair Display", "Abril Fatface", "Bebas Neue", "Special Elite", VT323, "Press Start 2P",
Silkscreen, "Space Mono", "JetBrains Mono", Inter, "Inter Display", "Major Mono Display", Rye, Smokum, Ewert,
"Noto Sans Egyptian Hieroglyphs", "Noto Sans Cuneiform", "Noto Sans Phoenician".
Use `font(ctx, size, family, weight, style)` (rounds size to 0.01 px).

## Aesthetic rules
- The chapter's style card (palette, texture, typography, motion) must be unmistakable and historically grounded.
  Avoid the generic "dark background + glowing lines + particles" look unless the era calls for it.
- One background, one foreground, one accent; accent ≤ 10 % of the frame. Avoid pure #000 / #fff.
- Something meaningful moves within the first 0.5 s of the chapter; a new visual event every 2–4 s.
- Motion is motivated (writing, pressing, carving, punching, spinning), not idle floating.
- Authentic details are the point: real glyphs from the fonts, real formats (card columns, DOS output, hex), real
  proportions. Do not invent facts in on-screen labels; decorative labels must be true or generic.

## Render & check loop
```bash
cd /home/user/vibe-info-history/render
NODE_PATH=$(npm root -g) node render.js stills <outDir> 0.3,2,4,6,8,10 <id>        # local == global when rendering one id
NODE_PATH=$(npm root -g) node render.js stills <outDir> 0.2,0.5,0.8 <prevId>,<id>   # check your incoming transition (times = prevDur + x)
```
Read the PNGs (downscale or tile with ffmpeg first to save context, e.g.
`ffmpeg -i a.png -i b.png -filter_complex "[0]scale=960:-1[a];[1]scale=960:-1[b];[a][b]hstack" s.png`).
Fix anything wrong and re-render. Stderr prints ms/frame and any page errors — there must be no errors.
