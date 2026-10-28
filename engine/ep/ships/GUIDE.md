# Scene authoring guide — 科技树 02 · 造船

The film is rendered frame by frame in headless Chromium. Every pixel comes from code: Canvas 2D, WebGL2 shaders,
and text set in local fonts. No image, video or audio files may be loaded or embedded (no bitmap data URIs).

## The director's rules for this film
- **One shot per ship.** Each ship is ONE continuous camera move lasting exactly 10 s (two 八拍 at 96 BPM). No cuts,
  no dissolves inside the shot. The camera never fully stops.
- **On the beat.** One beat = 0.625 s; beat k starts at local t = (k - 1) * 0.625. Your shot's picture events are
  listed in `CH('<id>').events` (and in your brief). The music and sound effects already hit those exact times, so
  the picture must too (a paddle enters the water on the frame of its beat, a broadside flashes on its beat, …).
- **Transitions are built later, separately.** They run in the LAST beat of the outgoing shot (local 9.375-10 s) and land
  on the next shot's first downbeat. So: (a) no new events after 9.25 s; keep the last beat stable with the brief's
  anchor element clearly visible; (b) your `draw` must also render sensibly for **negative t down to -0.7 s**
  (the incoming shot is drawn during the previous shot's last beat) — continue the motion backwards or clamp it.
- **Text timing.** Title moment: `opener(ctx, t, ch, {..., inAt: SCRIPT.open[0], outAt: SCRIPT.open[1]})` (title + era,
  gone by 2.25 s). The one subtitle card: `subs(ctx, t, ch, style)` (window 2.5-9.25 s). Body 50-54 px. No other text,
  except text that physically belongs to the medium and states nothing new. **No corner labels**, no captions,
  watermarks, progress bars, chapter numbers, English taglines.
- **Nothing harsh, nothing cheap.** Avoid the generic "dark background + glowing lines + particles" look; avoid bloom
  soup, lens flares and Shadertoy clichés. The style card in your brief must be unmistakable and historically grounded.
- Avoid episode 1's style cards: museum label, Andean textile, Mesopotamian clay, Egyptian papyrus scroll/ochre wall,
  Shang bronze, bamboo-slip ink, ink wash on xuan paper, woodblock/movable type/blackletter, engineering blueprint,
  Swiss typographic poster, DOS/VGA pixel art, 1950s atomic-age advert, isometric data centre.

## Files
- Write ONLY `engine/ep/ships/scenes/<id>.js`. Read your brief `engine/ep/ships/briefs/<id>.md` first.
- Do NOT edit `engine/lib.js`, `engine/stage.js`, `engine/transitions.js`, `engine/index.html`, any `ep/ships/*.js` manifest,
  `ep/ships/data/*`, `render/*`, or any other scene. Define helpers inside your IIFE.
- API references: `engine/lib.js` (math, noise, `GL.run/GL.bake`, `revealText`, `grain`, `vignette`, `rgba`, `font`,
  `spaced`, `win`, `smooth`, `ease`), `engine/stage.js` (`opener`, `subs`). Episode 1 scenes in `engine/scenes/*.js` show
  idioms (e.g. `papyrus.js`, `print.js`, `cloud.js`), but follow THIS guide's timing.
- Scratch files: `/tmp/claude-0/-home-user-output/18bc3977-43ba-588f-8be5-99bb7b1f733c/scratchpad/ships/<id>/`.

## Scene contract
```js
'use strict';
(() => {
  const ch = CH('<id>');      // {id, n, title, era, cards:[...], segs:[[2.5, 9.25]], dur: 10, events:[{beat, t, what}]}
  // module-level caches only (textures baked in init); NO state that changes between frames
  scene({
    id: '<id>', n: ch.n, dur: ch.dur,
    init() { /* bake static textures: GL.bake(frag, w, h, uniforms) returns a 2D canvas */ },
    draw(ctx, t) {            // t = local seconds, from -0.7 to dur + 0.1
      /* ... the art ... */
      opener(ctx, t, ch, { ink, sub, title: {family, size, weight, sp}, small: {family, size, weight}, x, y, align,
                           inAt: SCRIPT.open[0], outAt: SCRIPT.open[1], shadow, backdrop });
      subs(ctx, t, ch, { ink, body: {family, size: 52, weight}, band, bandA, bandFn, y: 1000, shadow });
    },
  });
})();
```
Hook and outro use `CH('hook')` / `CH('outro')` (see their briefs; `dur` 15 and 17.5).

## Determinism and budget (hard)
- A frame is a pure function of t. No `Math.random`, `Date`, `performance.now`, timers, rAF, CSS animation, or state mutated
  across frames. Use `mulberry(seed)`, `hash2`, `vnoise`, `fbm` (JS) or GLSL `h21 h22 vn fbm fbm3 ridge vor`.
- GLSL header already declares `uniform vec2 R; uniform float T; uniform float S;`, `in vec2 uv; out vec4 O;` — never
  redeclare R, T, S (name samplers e.g. `SRC`).
- Budget: **≤ 1.2 s per frame** on this 4-core machine with SwiftShader (other agents render at the same time). Bake
  everything static in `init()`; keep per-frame full-screen shaders cheap (≤ 3 fbm per pixel) or run them at half
  resolution and upscale; prefer canvas 2D drawing of baked layers for parallax.

## Render and check
```bash
cd /home/user/output
python3 render/qa_ships.py <id>                    # default times: title, events, card, last beat; prints ms/frame + errors
python3 render/qa_ships.py <id> 0.2,5.0,9.6        # custom local times
```
It writes PNGs and a contact sheet under `/tmp/claude-0/-home-user-output/18bc3977-43ba-588f-8be5-99bb7b1f733c/scratchpad/ships/<id>/`.
Read the sheet image, fix, re-render. Stderr must show no page errors. Also check t = -0.6 renders sensibly.

## Fonts (family names for ctx.font)
Chinese: "Noto Serif SC" (400/700/900), "Noto Sans SC" (300/400/700), "Ma Shan Zheng" (brush kai), "Zhi Mang Xing",
"Long Cang", "ZCOOL XiaoWei", "LXGW WenKai TC". Latin/other: Cinzel, "Cormorant Garamond", "EB Garamond",
"IM Fell English", "IM Fell English SC", "Uncial Antiqua", "Playfair Display", "Abril Fatface", "Bebas Neue",
"Special Elite", "Space Mono", "JetBrains Mono", Inter, "Inter Display", Rye, Smokum, Ewert,
"Noto Sans Egyptian Hieroglyphs". Use `font(ctx, size, family, weight, style)`.

## Aesthetic rules
- One background, one foreground, one accent (accent ≤ 10 % of the frame). Avoid pure #000 / #fff.
- Something meaningful moves within the first 0.5 s; the beat events give a new visual event every 1-4 s.
- Motion is motivated (rowing, sailing, firing, rotating, rising), not idle floating.
- Authentic details are the point (hull shapes, rigs, gun counts, proportions). Never invent facts in on-screen text.
- Keep the bottom ~200 px calm enough for the subtitle, or give it a band in the style's idiom.
