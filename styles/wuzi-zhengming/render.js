// 出片（Node + Playwright 自带的 Chromium，ffmpeg）。画面是 t 的纯函数：逐帧 seek → 截图 → 管道进 ffmpeg。
//   node render.js <片目录>                         全片 → <片目录>/renders/raw.mp4；有 audio/music.m4a 就原样拷进去 → renders/<片名>.mp4
//   node render.js <片目录> --jobs 3                全片，分 3 段并行渲、无损拼接（4 核机器用 3）
//   node render.js <片目录> --stills 0 7.4 20.3     只截几帧 → <片目录>/review/s_0007.40.png
//   node render.js <片目录> --sheet 15              全片均匀取 15 帧拼一张（5 列，左上角标时间）→ review/sheet.jpg；也可以 --sheet 0 6.6 12 …
//   node render.js <片目录> --check                 跑片子里的自检 window.CHECK.run()（比如面积守恒）
//   node render.js <片目录> --det                   确定性自检：同一批时刻乱序再截一遍，逐字节比
//   --out <文件名>                                  成片文件名（默认 = 页面标题.mp4）
// 浏览器预览：用 Chromium 打开 <片目录>/index.html?play（需要 --allow-file-access-from-files 才能读到 fonts/）。
'use strict';
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ARGS = ['--force-color-profile=srgb', '--disable-lcd-text', '--allow-file-access-from-files', '--run-all-compositor-stages-before-draw'];
const argv = process.argv.slice(2);
if (!argv[0]) { console.error('用法见 render.js 开头'); process.exit(1); }
const DIR = path.resolve(argv[0]);
const opt = k => { const i = argv.indexOf(k); if (i < 0) return null; const v = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) v.push(argv[j]); return v; };

async function open() {
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto('file://' + path.join(DIR, 'index.html'));
  await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
  const info = await page.evaluate(() => ({ W: window.VW, H: window.VH, dur: window.DUR, fps: window.FPS, title: (window.META || {}).title || document.title }));
  await page.setViewportSize({ width: info.W, height: info.H });
  if (errs.length) console.error('[page]', errs.join('\n'));
  return { browser, page, info };
}
const shot = async (page, t, info) => { await page.evaluate(t => window.seek(t), t); return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: info.W, height: info.H } }); };
const ff = (args, input) => new Promise((res, rej) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
  p.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()); if (input) input(p.stdin);
});
const tname = t => 's_' + t.toFixed(2).padStart(7, '0') + '.png';

async function renderRange(f0, f1, out, tag) {
  const { browser, page, info } = await open();
  await ff(['-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], async stdin => {
    for (let f = f0; f < f1; f++) {
      const buf = await shot(page, f / info.fps, info);
      if (!stdin.write(buf)) await new Promise(r => stdin.once('drain', r));
      if ((f - f0) % 150 === 0) console.log(`${tag} ${f - f0}/${f1 - f0}`);
    }
    stdin.end();
  });
  await browser.close(); return info;
}

(async () => {
  const review = path.join(DIR, 'review'), renders = path.join(DIR, 'renders');
  if (opt('--check')) {
    const { browser, page } = await open();
    const r = await page.evaluate(() => window.CHECK ? window.CHECK.run() : { ok: null, note: '片子里没有 window.CHECK' });
    console.log(JSON.stringify(r, null, 1)); await browser.close(); process.exit(r.ok === false ? 1 : 0);
  }
  if (opt('--det')) {
    const { browser, page, info } = await open();
    const ts = Array.from({ length: 8 }, (_, i) => +(info.dur * (i + .37) / 8).toFixed(3));
    const a = []; for (const t of ts) a.push(await shot(page, t, info));
    const order = ts.map((_, i) => i).sort((x, y) => ((x * 7 + 3) % 8) - ((y * 7 + 3) % 8));
    let same = true; for (const i of order) if (!a[i].equals(await shot(page, ts[i], info))) { same = false; console.log('不一致 @', ts[i]); }
    console.log(same ? 'deterministic' : 'NOT deterministic'); await browser.close(); process.exit(same ? 0 : 1);
  }
  const st = opt('--stills'), sh = opt('--sheet');
  if (st || sh) {
    fs.mkdirSync(review, { recursive: true });
    const { browser, page, info } = await open();
    let ts = (st || sh).map(Number);
    if (sh && ts.length === 1) { const n = ts[0]; ts = Array.from({ length: n }, (_, i) => +(info.dur * i / n).toFixed(2)); }
    const tmp = fs.mkdtempSync(path.join(review, '.sheet_'));
    for (const [i, t] of ts.entries()) {
      const buf = await shot(page, t, info);
      if (st) fs.writeFileSync(path.join(review, tname(t)), buf);
      else {
        fs.writeFileSync(path.join(tmp, 'raw.png'), buf);
        const font = path.resolve(DIR, '../../../fonts/IBMPlexMono-500.ttf').replace(/:/g, '\\:');
        await ff(['-i', path.join(tmp, 'raw.png'), '-vf', `scale=360:-1,drawtext=fontfile=${font}:text='${t.toFixed(2)}':x=10:y=10:fontsize=22:fontcolor=0xFFD52A:box=1:boxcolor=black@0.65:boxborderw=6`, path.join(tmp, String(i).padStart(3, '0') + '.png')]);
      }
    }
    if (sh) {
      const cols = 5, rows = Math.ceil(ts.length / cols);
      await ff(['-framerate', '1', '-i', path.join(tmp, '%03d.png'), '-vf', `tile=${cols}x${rows}:padding=6:margin=6:color=0x202020`, '-frames:v', '1', '-q:v', '3', path.join(review, 'sheet.jpg')]);
      console.log('sheet:', path.join(review, 'sheet.jpg'), ts.length);
    } else console.log('stills:', ts.length, '→', review);
    fs.rmSync(tmp, { recursive: true, force: true }); await browser.close(); return;
  }

  /* 全片 */
  fs.mkdirSync(renders, { recursive: true });
  const probe = await open(); const info = probe.info; await probe.browser.close();
  const N = Math.round(info.dur * info.fps), jobs = Math.max(1, +((opt('--jobs') || [])[0] || 1));
  const raw = path.join(renders, 'raw.mp4');
  if (jobs === 1) await renderRange(0, N, raw, 'frames');
  else {
    const cut = Array.from({ length: jobs + 1 }, (_, i) => Math.round(N * i / jobs)), parts = [];
    await Promise.all(cut.slice(0, -1).map((f0, i) => { const p = path.join(renders, `_part${i}.mp4`); parts.push(p); return renderRange(f0, cut[i + 1], p, `part${i}`); }));
    const list = path.join(renders, '_parts.txt'); fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
    await ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', raw]);
    parts.forEach(p => fs.rmSync(p)); fs.rmSync(list);
  }
  const name = ((opt('--out') || [])[0]) || (info.title.replace(/[\\/:*?"<>|：\s]+/g, '_') + '.mp4');
  const out = path.join(renders, name), music = path.join(DIR, 'audio', 'music.m4a');
  if (fs.existsSync(music)) await ff(['-i', raw, '-i', music, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-t', String(info.dur), '-movflags', '+faststart', out]);
  else { fs.copyFileSync(raw, out); console.log('（没有 audio/music.m4a：成片无声）'); }
  console.log(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,duration', '-of', 'compact=p=0:nk=1', out]).toString().trim());
  console.log('成片：' + out);
})().catch(e => { console.error(e); process.exit(1); });
