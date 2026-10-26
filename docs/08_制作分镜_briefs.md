# Production briefs — one section per scene

Read `engine/AGENT_GUIDE.md` first. All on-screen words come from `engine/data/script.js` (`CH('<id>')`, `SCRIPT.hook`,
`SCRIPT.outro`); never type subtitle text yourself. Card i is on screen during `ch.segs[i]`.
Global look: every chapter is a different medium and must look like that medium, rendered by code. The series has one
constant: the subtitle position and the title-moment structure. Everything else (palette, texture, font, motion,
composition) switches per chapter. Avoid the generic AI look (dark background + glowing lines + particles) except where
the era genuinely is a screen. Average brightness should stay comfortably readable (no near-black chapters except where
specified). Durations below come from the script data.

Transition rule: each scene owns its INCOMING transition (`trans`). If the transition needs a custom effect, register it
in your own file (`TRANS.<name> = (ctx, A, B, p, o, T) => {...}`; A = previous scene frame, B = yours). It lasts ~1.0–1.3 s.
While it plays, your scene is at local t ∈ [0, d]; keep your title moment starting at ≥ 0.55 s so it lands after the cut.

---

## hook — 开场 · museum label (12.5 s)
Prototype exists: `engine/scenes/hook.js` — rework it to the new rules.
- Style card: warm exhibition-label paper `#F2EFE8`, ink `#1B1712`, cinnabar `#B0412E`; Noto Serif SC 900 for the question,
  Noto Sans SC for small text. Calm, editorial, generous margins. Four option cards are material swatches drawn by code:
  A clay tablet with the characters 我在这里 pressed in (use cuneiform-like wedge relief, not stone), B xuan paper with brush
  calligraphy 我在这里 and a red seal, C a brushed-metal hard-disk platter with the hex `E6 88 91 E5 9C A8 E8 BF 99 E9 87 8C`
  in tiny mono, D a server-rack/cloud swatch (a slice of a data-centre rack with status LEDs) — NOT DNA any more.
- Text: `SCRIPT.hook.question` (2 lines), `options`, `reveal`, `option_life`, `title`, `subtitle`, `series`.
- Beats: frame 0 = cover (question + four cards fully visible; this frame is the thumbnail). 0.45–0.9 s cards pop in turn.
  1.05–3.3 s countdown 3·2·1 (large cinnabar numeral, no corner placement — place it beside the question). 3.5 s the reveal
  replaces the question. 3.8–4.6 s each option shows its `option_life` under it with a proportional bar (A full, B ~40 %,
  C a sliver, D a dashed outline with “？”). Hold to 7.0 s. 7.2–11.6 s title card centred: title, subtitle, and `series`
  (the only place the series label appears). 11.6–12.5 s a single cinnabar thread is drawn across the paper and starts to
  sag — it becomes the rope of the next chapter.
- No subtitles band; the question/reveal are the hero text (Noto Serif SC 900, ~74–84 px).
- Cues: blip on each card pop, tick ×3 countdown, impact at 3.5 (reveal), chime on each lifetime, rope at 11.8.

## knot — 第一章 结绳 · Andean khipu / textile
- Style card: hand-woven camelid textile ground (warp/weft weave shader, slightly uneven, natural undyed browns `#6B4E35`
  `#A68A64` `#D9C7A6`) with an Inca tocapu border band (stepped squares, cochineal red `#A3262A`, indigo `#2C3E6B`, saffron
  `#D9A33A`). Cords are 3D-shaded twisted fibres (render the S/Z twist as diagonal highlights). Title in "Zhi Mang Xing"
  or "Ma Shan Zheng" (brush, evoking the Chinese legend); body Noto Serif SC 600 in cream with a soft dark band.
- Incoming transition `knot_rope`: the hook's cinnabar thread (draw it on A at the same place it ended) drops and thickens into
  the main cord while the textile wipes down from the top with a fibrous edge.
- Beats per card: (0) the Chinese legend — a single knotted cord hangs centre while the quote shows; draw the knot tying
  itself. (1) a full khipu: one horizontal primary cord with 10–14 pendant cords in different dyed colours; knots appear in
  clusters at three heights; show ONE pendant decoded: units / tens / hundreds clusters light up and small numerals appear
  beside them (e.g. 3 knots at hundreds, 0 tens, a long knot of 6 at units → 306). Use real conventions: single overhand
  knots for tens/hundreds, a long knot (multiple turns) for units 2–9, figure-eight for 1, empty space for 0.
  (2) the khipu multiplies into a faint archive grid (rows of khipus) — “nearly 1,400 survive” — then most dim to show
  “undeciphered”. (3) fibres fray and the colours fade; a cord snaps and falls (motivates the next medium).
- Title moment: centre-left over a calm patch of weave; cords enter after 2.6 s.
- Cues: rope at transition, knot on each knot tightening, cord when the khipu unfurls, whoosh at card 3 fade, rope at snap.

## clay — 第二章 泥板 · Mesopotamian clay
- Style card: damp then fired clay. Raw clay `#B78A5C`, shadow `#5A3A22`, fired terracotta `#A4532F`, ash grey; raking light
  from the upper left with a relief normal-mapped shader. Title pressed INTO the clay (inner shadow + lip highlight), font
  Noto Serif SC 900. Cuneiform from "Noto Sans Cuneiform" rendered as embossed impressions (height map → lit relief).
- Incoming transition `clay_press`: a knot (from A) presses into wet clay at frame centre; B is revealed from that impression
  outward with an embossed rim (radial displacement + rim highlight).
- Beats: (0) a reed stylus (simple 3D-ish rod) first DRAWS pictographs (lines incised: an ear of barley, a jar, a head) on a
  small early tablet, then switches to a wedge-tipped stylus that PRESSES wedges — show both stages. (1) an account tablet:
  rows of number impressions (circular and D-shaped number signs pressed with the round end) next to barley/sheep signs.
  (2) fire: firelight sweeps, flames lick from the bottom, the tablet's colour shifts raw → fired (redder, harder), cracks.
  (3) the camera pulls back to a museum-like shelf of many tablets and fragments in rows (procedural, varied shapes).
- Cues: clay on each press, stylus while drawing, fire at card 2, crack as it fires, stamp when the title presses in.

## papyrus — 第三章 莎草纸 · Egyptian (reference implementation exists)
- `engine/scenes/papyrus.js` already follows the API. Polish it: delay ALL painted elements (register ground line too)
  until the title moment has passed; for card (0) show the making of papyrus — strips laid vertically then horizontally
  (two layers sliding in, a mallet pressing) before the painted register appears; for card (1) roll part of the sheet into a
  scroll on one side (cylinder shading) and show a faint damp stain spreading on a corner; for card (2) paint the columns
  and the Khufu cartouche (real spelling already in file). Keep the block-border friezes, winged sun.
- Incoming transition: `burn` (exists) — flames from the clay chapter's fire burn through to papyrus.
- Cues: fire at 0, harp at 0.3, paper when strips are laid, wood for the mallet, brush for each column.

## oracle — 第四章 龟甲 · Shang bronze and plastron (prototype exists: engine/scenes/oracle.js)
- Rework to the new API and timing. Keep: bronze patina shader, thunder-pattern (云雷纹) bands, plastron, heat point,
  crack forming 卜, incised glyphs with cinnabar infill, the 卜 oracle-vs-kaishu comparison.
- Beats: (0) heat point glows on the plastron, the crack runs in the 卜 shape with a bright ember line. (1) inscription
  incised stroke by stroke in vertical columns; a subtle label-free emphasis that this is 甲骨文. (2) the big comparison:
  oracle 卜 (incised, cinnabar) morphs into a modern 卜 (Noto Serif SC) — make this the hero moment of the chapter.
  (3) pull back: many plastrons and scapulae fragments in a grid (16万+ feeling) — procedural shapes, different crack
  patterns, warm ivory against patina.
- Incoming transition `crack` (exists in transitions.js; at:[.62,.62], glow:[1,.55,.2]).
- Cues: fire at 0.3, crack for each crack, carve for each incised stroke group, bell when the 卜 morph completes.

## bamboo — 第五章 竹简 · ink on bamboo slips
- Style card: bamboo yellow-green `#C9B27A` / `#A88D55`, node rings, ink `#1B1712`, hemp cord `#8A7350`, seal red
  `#B83A2B`. Slips are vertical strips with rounded ends and node ridges, bound by two cords that weave over/under.
  Writing with "Ma Shan Zheng" or "LXGW WenKai TC" brush characters written top-to-bottom, slips read right-to-left.
- Incoming transition `bamboo_slats`: bamboo slips drop into place one after another from the top, covering the oracle frame
  (variable delays, slight bounce, each slip a real bamboo slip texture).
- Beats: (0) a slip is planed and dried (a knife shaves, colour warms), then a brush writes 我在这里 down one slip; the
  cords bind ~20 slips into a scroll. (1) the 册 hero moment: the bound slips flatten into the ancient glyph 册 (vertical
  bars with a binding loop), which morphs into the modern character. (2)–(3) the 东方朔 story: a cart-load / a tall stack of
  3,000 boards (wooden 奏牍, slightly wider and lighter than bamboo slips), two silhouetted officials lifting it together
  (simple flat silhouettes in Han tomb-brick style), then a reading bar slowly crawling across the stack (two months).
- Note: the approved note line for card 2 is drawn by `subs` automatically.
- Cues: bamboo on drops, carve on planing, brush on writing, cord on binding, wood when the stack lands.

## paper — 第六章 造纸 · ink wash on xuan paper (Eastern Han)
- Style card: xuan paper `#F1ECE1` with visible long fibres, ink in five tones (焦浓重淡清), a seal red accent. Ink diffusion
  shader for bleeding strokes. Title in "Zhi Mang Xing" or "Long Cang" calligraphy written stroke-by-stroke (reveal mask),
  body Noto Serif SC 600 ink-black (no band needed on paper).
- Incoming transition `ink` (exists, at:[.5,.45]): ink blooms over the bamboo slips and swallows them.
- Beats: (0) a brush writes the 《后汉书》 quote large, then a heavy stack of slips and a costly silk roll appear as ink
  sketches (simple, elegant 白描 lines). (1) papermaking in ink-wash vignettes: bark, hemp, rags and a fishing net drop into
  a vat; a mould screen lifts a wet sheet (water drips); the sheet is pressed and dried on a wall. (2) a faint archaeological
  fragment of rough hemp paper (darker, coarser) beside the finished smooth sheet. (3) a map-like ink line travels west
  along a schematic Silk Road (no country borders, just a horizon line of mountains and dunes) to a small European
  mill-wheel sketch.
- Cues: brush, water and drip during papermaking, paper when sheets lift, ink at bleeds, stamp for the seal.

## print — 第七章 印刷术 · three sub-styles in one chapter
This chapter switches style internally (Tang → Northern Song → Mainz); each switch needs its own short transition.
- Tang woodblock (cards 0–1): Dunhuang palette — mineral blue `#2E6F8E`, green `#3F8F74`, earth red `#A5452C`, ochre
  `#B07A4A`, gold `#C9A24A`, wall `#D8C3A0`; a caisson-ceiling lotus pattern and a frontispiece-like framed print. A pear-
  wood block with characters carved in MIRROR image (render 如是我闻 mirrored, raised relief); brush inks it, paper covers it,
  a brush rubs the back, the sheet peels off showing the printed (non-mirrored) text. Card 1: the Diamond Sutra scroll
  unrolls with a colophon area; show the date characters 咸通九年四月十五日 small on the scroll (true colophon text).
- Song movable type (cards 2–3): internal transition (drawn inside your scene) — the woodblock splits into a grid of small square blocks that become
  individual clay type pieces. Song-dynasty book page aesthetic: 宋刻本 layout (double border 版框, column rules 界栏,
  centre fold 版心 with 鱼尾 marks), celadon `#B7C9C3` background, Noto Serif SC (宋体 lineage). Type pieces fly into an
  iron frame and set 我在这里 (mirror-image faces), print, then are released back into a tray. Card 3: a bound book
  《梦溪笔谈》 opens (title slip on the cover), and an empty tray spot glows where no surviving type exists.
- Mainz (cards 4–5): internal transition — a wooden screw press platen slams down (hard cut on impact). Woodcut/engraving
  hatching style, black `#141210` on cream `#EFE6D2`, rubric red `#B1261C`; a two-column blackletter page in
  "UnifrakturMaguntia" (Latin text from Genesis 1:1 "In principio creavit deus celum et terram" is safe) with a red
  initial; card 5: pages multiply into a towering stack / a fanned wall of incunabula spines.
- Title moment at the start (Tang palette). Cues: carve, ink, paper (peel), type clicks (many), press + impact on the slam,
  paper riffle for the stack.

## punch — 第八章 打孔卡 · engineering blueprint
- Style card: cyanotype blueprint — Prussian blue `#123A6B` with paper texture and faint grid, white linework, dimension
  arrows and leader lines, hand-lettered technical font ("Space Mono" or "Major Mono Display" for small annotations, kept
  secondary). Title in white Noto Sans SC 700 or Space Mono-like display.
- Incoming transition `punch_holes`: rows of rectangular holes punch through the previous frame (staggered), each hole showing
  the blueprint beneath, then the remaining paper falls away.
- Beats: (0) Jacquard loom head as a line drawing; a chain of punched cards feeds through; warp threads lift where holes
  pass (draw needles/hooks rising) and a woven pattern grows. (1) a Hollerith card (proportions of the 1890 card, round
  holes in a field grid, clipped corner) gets punched; a tabulator with clock-face counters spins its dials as cards pass;
  (2) a split counter: "8+ years" bar versus "6 months / 2 years" bars (draw as blueprint dimension lines with tick labels
  in Chinese numerals taken from the card text — or no numbers, just proportional bars). (3) the company lineage as a
  simple blueprint tree ending in the letters IBM (outline). (4) fire: the blueprint scorches — orange edge burns in from
  one side, water streaks run down (the 1921 fire damage was largely water). (5) boxes of forms vanish row by row until a
  tiny remnant stack remains, outlined and dimensioned.
- Also encode 我在这里 subtly on one card in Chinese telegraph code digits 2053 0961 6638 6849 punched in numeric columns.
- Cues: punch on each punched hole group, bell (the tabulator rang a bell per card), relay, fire at card 4, paper.

## tape — 第九章 磁带 · Swiss international typographic style
- Style card: white `#F0EFE9`, black, one signal red `#E2231A`; strict grid, huge numerals, flush-left Inter Display Black /
  Bebas Neue for structural type (the CHINESE title stays Noto Sans SC 700 in black), lots of white space, two big tape
  reels drawn as precise geometric circles with spokes. Motion is mechanical and precise (linear tape travel, reels with
  correct relative angular speeds).
- Incoming transition `tape_slide`: the punched card slides horizontally into frame and is pulled between two capstans,
  becoming the tape strip (simple: A slides out left while B slides in from right, with a red rule line wiping).
- Beats: (0) magnified tape: magnetic domains as tiny arrows/bars flipping N/S to encode bits (left/right orientation),
  with a read head; the human eye icon crossed by a line? (no icons — show a magnifier disc that reveals nothing until a
  head reads it). (1) UNIVAC-era metal tape reel (bronze tint `#8C6A3A` accent permitted) on the grid with the year 1951 as
  a giant numeral. (2) a modern cartridge and a robotic library aisle in flat Swiss diagrams. (3) a cartridge with "40 TB"
  set as a typographic statement (allowed: it is in the approved text) and a 30-year timeline bar. (4) the counter shift:
  draw a vertical rule labelled nothing; to its left the chapter's earlier "proven" years (thin grey bars from previous
  chapters' meters, no text), to its right a dashed bar — preparing the viewer for estimates.
- Cues: tape when reels start, relay clicks at 1951 beat, spin, blip on the domain flips, whoosh at card 4.

## floppy — 第十章 软盘 · DOS / VGA pixel art (prototype exists: engine/scenes/floppy.js)
- Rework to the new API and timing (the prototype's corner labels must go; its era/meter now live in the title moment).
  Keep 320×180 pixel art ×6, VGA 16 colours, MS-DOS terminal, CRT post-process. The title moment can appear as a centred
  DOS dialog box (grey box, title bar) — very fitting.
- Beats: (0) a 3.5-inch disk (shutter opens), terminal formats it showing 1,457,664 bytes; (1) COPY a phone photo: a
  progress bar fills to 100 %, then "Insufficient disk space" (true behaviour for a file > 1.44 MB), then a modern Save icon
  morphs from the disk; (2) a 3.5-inch drive bay graphic goes dark / "Not ready reading drive A" message (real DOS wording:
  `Not ready reading drive A` / `Abort, Retry, Fail?`); (3) a calendar page flips to 2024 in pixel style; a stamp lands.
- Subtitle band: black bar in DOS style (keep the bitmap font WenQuanYi Zen Hei Sharp at an integer pixel size so it stays
  crisp; it must stay readable: ≥ 48 px effective height on the 1080p frame).
- Incoming transition `pixel` (exists). Cues: seek, key (typing), beep for the error, click, stamp at 2024.

## disk — 第十一章 硬盘 · 1950s atomic-age advertising → precision engineering
- Style card: mid-century ad illustration — cream `#F4EAD5`, turquoise `#3FB8AF`, coral `#FF6B57`, mustard `#E0A526`,
  charcoal; halftone dot shading, boomerang shapes, starbursts; "Abril Fatface"/"Playfair Display 900" for the period feel,
  Noto Serif SC 900 for the Chinese title. Later cards shift to a cleaner macro look of a modern platter (brushed metal
  shader with anisotropic highlight) while keeping the palette.
- Incoming transition `disk_crtoff`: the DOS frame collapses vertically into a bright horizontal line, then to a dot, then
  darkness; the platter glints on out of the dark.
- Beats: (0) two dates on a mid-century timeline (1956 before 1971) — simple, the year numerals as big display type.
  (1) IBM 350 cabinet illustration (tall cabinet with a window showing a stack of 50 large platters, an access arm), a
  forklift silhouette lifting it to sell "about a ton". (2) scale comparison: the 24-inch platter stack beside a 5.25-inch
  drive beside a modern 3.5-inch drive (halftone shading), then a stack of "40 TB" set typographically. (3) capacity curve
  rising steeply while a lifespan bar beside it stays tiny; a single platter spins down.
- Cues: spin at the platter reveal, disk whine under card 2, click for arm seeks, whoosh for the curve.

## cloud — 第十二章 云 · isometric data centre
- Style card: clean flat isometric illustration — pale grey-white `#EEF1F4`, slate `#2B3440`, one accent electric blue
  `#2F6BFF`, status LEDs green/amber. Precise isometric racks, cable trays, cooling units. Typography Noto Sans SC.
  It must look calm and engineered, not neon.
- Incoming transition `cloud_zoomout`: pull back from the spinning platter (A) — it shrinks into one drive bay inside a rack,
  then the rack joins rows of racks (B).
- Beats: (0) rows of racks assemble isometrically, data packets (small squares) flow along trays. (1) cut-away of one rack:
  drives, SSD sleds, a tape library robot; power and cooling lines pulse — someone must keep them running. (2) a music
  library shelf of tiny album squares; a migration arrow moves them to new racks — a large fraction blink out and vanish.
  (3) a grid of tiny webpage thumbnails; 38 % of them grey out to broken-page outlines. (4) the lights dim rack by rack;
  everything greys toward a quiet dark-grey (NOT black) "dark age" while the subtitle reads; end on a single amber LED.
- Cues: fan at the start, blip for packets, click/relay for the robot, whoosh when items vanish, a low impact on the
  "数字黑暗时代" card, chime on the last LED.

## outro — 结尾 (37.5 s)
- Use `SCRIPT.outro.cards` and `SCRIPT.outro.end`. Build your own ch-like object for `subs()` with these segs:
  [[1.4,5.8],[6.2,10.4],[10.8,14.6],[15.0,20.0],[20.4,24.4],[24.8,30.6]]; cards 3 and 4 may be set as large centred
  typography instead of subtitles (then do not also show them in subs).
- Look: back to the exhibition-label paper of the hook (`#F2EFE8`, ink, cinnabar) — the film ends where it began.
- Incoming transition `outro_lightsout` from the cloud chapter: remaining LEDs go out one by one, then paper fades up.
- Beats: (0) a lifetime chart drawn by code: x = the 12 chapters in order (small pictogram per chapter in its own accent
  colour, no text labels), y = log scale of years preserved/expected, bars drawn in sequence: 1,000+ / 5,000+ / 4,500+ /
  3,200+ / 2,400+ / 2,000+ / 1,150+ / (punch: a stub) / 30 dashed / 5–15 dashed / 2–5 dashed / ？ outline. Solid bars for
  proven survival, dashed for estimates. (1) the four hook option swatches return; A rises and is outlined in cinnabar.
  (2) swatch D alone with a pulsing “？”. (3) golden line as a large two-line typographic moment (Noto Serif SC 900,
  ~80 px). (4) the phone-photo question: a simple phone outline whose photo slowly pixel-fades. (5) dark panel: the real
  spectrogram from `window.SPECTRO` (w×h bytes, base64, rows low→high frequency, `text_t`, `text_f` give where the hidden
  text is) scrolls from right to left with an inferno-like colour map and a frequency axis; the words 我在这里 emerge from
  the spectrogram itself; frame the panel like a lab instrument. (6) end card 31.0–37.5 s: `end[0]` title large,
  `end[1]` series, `end[2]` next episode, `end[3]` small line at the bottom — these four are the only small texts allowed.
- Cues: chime per bar drawn, impact (soft) on card 3, heartbeat under the golden line, blip as the spectrogram starts,
  chime at the end card.
