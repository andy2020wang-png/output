// Information layout shared by every chapter. Rule from the director: no persistent corner labels.
// A chapter shows (1) a short title moment — title, era, preserved-for figure — that leaves after ~3 s,
// then (2) only the approved subtitle cards. Typography, colour and placement come from each style card.
'use strict';

function font(ctx, size, family, weight = 400, style = 'normal') {
  ctx.font = `${style} ${weight} ${Math.round(size * 100) / 100}px ${family}`;
}

// Title moment. ch = CH('<id>') from data/script.js. st = {
//   ink, sub, accent,                      colours (hex)
//   title: {family, size, weight, sp},     chapter title font
//   small: {family, size, weight},         era line + meter label font
//   num:   {family, size, weight},         meter number font
//   x, y, align ('center'|'left'|'right'), position of the title baseline (default centre, y 470)
//   inAt, outAt                            seconds (defaults 0.55 and 3.0)
//   shadow, backdrop: fn(ctx, box, alpha)  optional legibility helpers drawn behind the cluster
// }
function opener(ctx, t, ch, st) {
  if (window.NOTEXT) return;          // art-only renders (covers)
  const inAt = st.inAt ?? .55, outAt = st.outAt ?? 3.0;
  const a = win(t, inAt, outAt + .5, .5, .5);
  if (a <= 0) return;
  const x = st.x ?? W / 2, y = st.y ?? 470, al = st.align || 'center';
  const tt = st.title || { family: '"Noto Serif SC"', size: 140, weight: 900, sp: 24 };
  const sm = st.small || { family: '"Noto Sans SC"', size: 30, weight: 400 };
  const nm = st.num || { family: '"Noto Serif SC"', size: 64, weight: 700 };
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  if (st.backdrop) st.backdrop(ctx, { x, y, al }, a);
  if (st.shadow) { ctx.shadowColor = st.shadow; ctx.shadowBlur = 24; }
  // title: characters settle in one after another
  font(ctx, tt.size, tt.family, tt.weight ?? 900, tt.style || 'normal');
  const chars = [...ch.title];
  const widths = chars.map(c => ctx.measureText(c).width);
  const sp = tt.sp ?? 24, total = widths.reduce((p, q) => p + q, 0) + sp * (chars.length - 1);
  let cx = al === 'center' ? x - total / 2 : al === 'right' ? x - total : x;
  chars.forEach((c, i) => {
    const k = ease.out(clamp((t - inAt - i * .09) / .55));
    ctx.fillStyle = rgba(st.ink, a * k);
    ctx.fillText(c, cx, y + (1 - k) * 22);
    cx += widths[i] + sp;
  });
  // era line
  const k2 = ease.out(clamp((t - inAt - .35) / .6));
  font(ctx, sm.size, sm.family, sm.weight ?? 400);
  ctx.fillStyle = rgba(st.sub || st.ink, a * k2 * .9);
  spaced(ctx, ch.era, x, y + sm.size + 44, 4, al);
  // preserved-for figure: label + counting number + unit on one line
  const m = ch.meter;
  if (m) {
    const k3 = ease.out(clamp((t - inAt - .6) / .6));
    const yy = y + sm.size + 44 + nm.size + 30;
    const num = String(m.value);
    let shown = num;
    const digits = num.replace(/[^0-9]/g, '');
    if (/^[0-9,]+\+?$/.test(num) && digits.length) {
      const end = +digits, start = end >= 10 ? Math.pow(10, digits.length - 1) : 0;   // same digit count → steady width
      const v = Math.round(lerp(start, end, ease.out(clamp((t - inAt - .6) / 1.3))));
      shown = v.toLocaleString('en-US') + (num.endsWith('+') ? '+' : '');
    }
    font(ctx, sm.size, sm.family, sm.weight ?? 400); const wl = ctx.measureText(m.label).width;
    font(ctx, nm.size, nm.family, nm.weight ?? 700); const wn = ctx.measureText(num).width;
    font(ctx, sm.size, sm.family, sm.weight ?? 400); const wu = ctx.measureText(m.unit).width;
    const gap = 18, tw = wl + wn + wu + gap * 2;
    let lx = al === 'center' ? x - tw / 2 : al === 'right' ? x - tw : x;
    ctx.fillStyle = rgba(st.sub || st.ink, a * k3 * .9);
    font(ctx, sm.size, sm.family, sm.weight ?? 400); ctx.fillText(m.label, lx, yy);
    ctx.fillStyle = rgba(st.accent || st.ink, a * k3);
    font(ctx, nm.size, nm.family, nm.weight ?? 700); ctx.fillText(shown, lx + wl + gap, yy);
    ctx.fillStyle = rgba(st.sub || st.ink, a * k3 * .9);
    font(ctx, sm.size, sm.family, sm.weight ?? 400); ctx.fillText(m.unit, lx + wl + gap + wn + gap, yy);
  }
  ctx.restore();
}

// Subtitle cards. st = { ink, body: {family, size, weight}, band: css colour or null, bandA, bandFn(ctx,x,y,w,h,a),
//   y (baseline of the last line, default 1000), shadow, noteInk }
function subs(ctx, t, ch, st) {
  if (window.NOTEXT) return;
  const cards = ch.cards, segs = ch.segs;
  const bd = st.body || { family: '"Noto Serif SC"', size: 52, weight: 600 };
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  cards.forEach((card, i) => {
    const [a0, a1] = segs[i];
    const al = win(t, a0, a1, .3, .3);
    if (al <= 0) return;
    font(ctx, bd.size, bd.family, bd.weight ?? 600);
    const lines = card.split('\n');
    const lh = bd.size * 1.42;
    const yb = (st.y ?? 1000) - (lines.length - 1) * lh;
    const wmax = Math.max(...lines.map(l => ctx.measureText(l).width));
    if (st.band || st.bandFn) {
      const bx = W / 2 - wmax / 2 - 40, by = yb - bd.size - 20, bw = wmax + 80, bh = lh * lines.length + 24;
      if (st.bandFn) st.bandFn(ctx, bx, by, bw, bh, al);
      else { ctx.globalAlpha = al * (st.bandA ?? .8); ctx.fillStyle = st.band; ctx.fillRect(bx, by, bw, bh); ctx.globalAlpha = 1; }
    }
    if (st.shadow) { ctx.shadowColor = st.shadow; ctx.shadowBlur = 16; }
    ctx.fillStyle = rgba(st.ink, al); ctx.textAlign = 'center';
    const pr = clamp((t - a0) / Math.min(1.0, (a1 - a0) * .3));
    revealText(ctx, card, W / 2, yb, W, lh, pr, { align: 'center', alpha: al });
    ctx.shadowBlur = 0;
    const note = ch.notes && ch.notes[String(i)];
    if (note) {
      font(ctx, 24, st.noteFamily || '"Noto Sans SC"', 400);
      ctx.fillStyle = rgba(st.noteInk || st.ink, al * .7);
      ctx.fillText(note, W / 2, (st.y ?? 1000) + 44);
    }
    ctx.textAlign = 'left';
  });
  ctx.restore();
}

// Legacy helper kept so older prototypes still load; new scenes call opener() + subs().
function stageText(ctx, t, dur, spec, st) {
  const ch = { title: spec.title.replace(/\s/g, ''), era: spec.era, meter: spec.meter && { label: spec.meter.label, value: spec.meter.value, unit: spec.meter.unit },
    cards: spec.lines || [], segs: spec.segs || (spec.lines || []).map((_, i, a) => [2.4 + i * (dur - 2.6) / a.length, 2.4 + (i + 1) * (dur - 2.6) / a.length - .2]) };
  opener(ctx, t, ch, { ink: st.ink, sub: st.sub, accent: st.accent, title: st.title, small: { family: st.eraFamily || '"Noto Sans SC"', size: 30 }, num: { family: st.meterNumFamily || '"Noto Serif SC"', size: 64, weight: 700 } });
  subs(ctx, t, ch, { ink: st.bodyInk || st.ink, body: st.body, band: st.band, bandA: st.bandA, shadow: st.shadow });
}
function treeBar() { /* removed by director's note: no persistent progress HUD */ }
