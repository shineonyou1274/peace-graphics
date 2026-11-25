// peace-class 렌더러 — 페이지가 내보내는 window.READY · window.seek(t) · window.DUR 로 프레임을 찍는다.
// Shiny Peace Studio 의 videointro2 render_dom.mjs 를 바탕으로 수업 영상에 맞게 고쳤다.
//
//   node render.mjs --html lesson.html --info                 # build/info.json (길이 · 소리 자리 · 장면 · 화면 글자 · 점검)
//   node render.mjs --html lesson.html --at 1.2,5,9           # 정지 화면 → build/at_T.png
//   node render.mjs --html lesson.html --out build/s0.mp4 --from 0 --to 20 --fps 30 --sub 2   # 영상(소리 없이 구간)
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const HTML = arg('html', 'lesson.html'), OUT = arg('out', 'build/out.mp4'), FPS = +arg('fps', 30), SUB = +arg('sub', 2);
const FF = process.env.FFMPEG || 'ffmpeg';
mkdirSync('build', { recursive: true });

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { const g = process.env.PW_ROOT || execSync('npm root -g').toString().trim(); ({ chromium } = await import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href)); }

const root = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  let body;
  try { body = await readFile(f); } catch { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(body);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1920, height: 1920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(() => { window.__RENDER_MODE__ = true; });
await page.goto(`http://127.0.0.1:${server.address().port}/${HTML}`);
try { await page.evaluate(() => window.READY); } catch (e) { console.error('페이지 오류:', errors.join('\n') || e); process.exit(1); }
if (errors.length) { console.error('페이지 오류:', errors.join('\n')); process.exit(1); }
const size = await page.evaluate(() => { const s = document.getElementById('stage'); return { width: s.offsetWidth, height: s.offsetHeight }; });
await page.setViewportSize(size);
const DUR = await page.evaluate(() => window.DUR);
const shot = async (t, type = 'png') => { await page.evaluate(t => window.seek(t), t); return page.screenshot({ type, quality: type === 'jpeg' ? 92 : undefined, clip: { x: 0, y: 0, ...size } }); };

if (arg('info')) {
  const info = await page.evaluate(() => ({ DUR: window.DUR, HITS: window.HITS, SCENES: window.SCENES, TEXTS: window.TEXTS, QA: window.QA() }));
  info.size = size;
  writeFileSync('build/info.json', JSON.stringify(info, null, 1));
  console.log(`길이 ${info.DUR.toFixed(1)}초 · 장면 ${info.SCENES.length}개 · 소리 자리 ${info.HITS.length}개 · 점검 ${info.QA.length ? info.QA.length + '건' : '이상 없음'}`);
} else if (arg('at')) {
  for (const t of String(arg('at')).split(',').map(Number)) writeFileSync(`build/at_${t.toFixed(2)}.png`, await shot(t));
} else {
  const F0 = arg('from') ? Math.round(+arg('from') * FPS) : 0, F1 = arg('to') ? Math.min(Math.round(DUR * FPS), Math.round(+arg('to') * FPS)) : Math.round(DUR * FPS);
  const rate = FPS * SUB, scale = arg('scale') ? `,scale=-2:${arg('scale')}` : '';
  // tmix 로 SUB 장을 섞어 한 프레임(움직임 잔상), SUB 장마다 하나를 남긴다
  const vf = (SUB > 1 ? `tmix=frames=${SUB},select='not(mod(n+1\\,${SUB}))',` : '') + `setpts=N/(${FPS}*TB)${scale}`;
  const ff = spawn(FF, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(rate), '-i', '-', '-vf', vf, '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-an', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = F0; f < F1; f++) {
    for (let k = 0; k < SUB; k++) {
      const buf = await shot((f + k / SUB) / FPS, 'jpeg');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    if ((f - F0) % 150 === 0) console.log(`${OUT}: ${f - F0}/${F1 - F0}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', OUT);
}
await browser.close();
server.close();
