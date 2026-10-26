// Deterministic frame renderer.
//   node render.js stills <outDir> <t1,t2,...> [sceneIds]      -> PNG stills at given global times
//   node render.js range  <out.mp4> <f0> <f1> [sceneIds]       -> frames [f0,f1) piped into ffmpeg
//   node render.js info   [sceneIds]                           -> timeline JSON
'use strict';
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const ARGS = ['--disable-accelerated-2d-canvas', '--force-color-profile=srgb', '--force-device-scale-factor=1',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling',
  '--allow-file-access-from-files'];

async function open(ids) {
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, 'engine/index.html') + (ids ? '?ids=' + ids.join(',') : ''));
  if (process.env.NOTEXT) await page.evaluate(() => { window.NOTEXT = true; });
  const info = await page.evaluate(ids => window.setup(ids), ids || null);
  const missing = await page.evaluate(() => window.__missing || []);
  if (missing.length) errors.push('missing scene files: ' + missing.join(','));
  if (errors.length) { console.error(errors.join('\n')); }
  return { browser, page, info, errors };
}

async function shot(page) {
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}

(async () => {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'info') {
    const ids = rest[0] ? rest[0].split(',') : null;
    const { browser, info } = await open(ids);
    console.log(JSON.stringify(info, null, 1)); await browser.close(); return;
  }
  if (mode === 'stills') {
    const [outDir, times, idsArg] = rest;
    const ids = idsArg ? idsArg.split(',') : null;
    fs.mkdirSync(outDir, { recursive: true });
    const { browser, page, errors } = await open(ids);
    for (const t of times.split(',').map(Number)) {
      const t0 = Date.now();
      await page.evaluate(t => window.renderTime(t), t);
      fs.writeFileSync(path.join(outDir, `t${t.toFixed(2).padStart(7, '0')}.png`), await shot(page));
      process.stderr.write(`t=${t} ${Date.now() - t0}ms\n`);
    }
    if (errors.length) console.error('ERRORS:\n' + errors.join('\n'));
    await browser.close(); return;
  }
  if (mode === 'range') {
    const [out, f0s, f1s, idsArg] = rest;
    const ids = idsArg ? idsArg.split(',') : null;
    const f0 = +f0s, f1 = +f1s;
    const { browser, page, errors } = await open(ids);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', out + '.part.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      await page.evaluate(n => window.renderFrame(n), f);
      const buf = await shot(page);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 30 === 0) process.stderr.write(`[${path.basename(out)}] ${f}/${f1} ${((Date.now() - t0) / (f - f0 + 1)).toFixed(0)}ms/f\n`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    fs.renameSync(out + '.part.mp4', out);
    if (errors.length) console.error('ERRORS:\n' + errors.join('\n'));
    await browser.close(); return;
  }
  console.error('usage: render.js stills|range|info ...');
})();
