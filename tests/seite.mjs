// Probe der Landingpage im echten Browser (Playwright, Chromium).
//   node tests/seite.mjs
// Misst: Deutsch als Vorgabe · Kapitel-Knöpfe aus den Marken · Wechsel DE/EN/RU
// (Text, Poster, Video, Kapitelnamen) · Kapitel springt an die Stelle · Video lädt
// erst beim Antippen · keine seitliche Überbreite am Handy · Rechtliches verlinkt.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch { console.log('⊘ nicht lauffähig: playwright fehlt'); process.exit(0); } }

let gruen = 0, rot = 0;
const ok = (name, bed, info = '') => { if (bed) gruen++; else { rot++; console.log('✗ ROT:', name, info); } };

// Statischer Server MIT Range-Anfragen (Videos werden in Stücken geholt)
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
const geholt = [];
// Chromium aus Playwright kann kein H.264 (gemessen: canPlayType leer). Für den
// Sprung-Test liefert der Server dann statt jeder MP4 einen WebM-Stellvertreter
// gleicher Länge (240 s, schwarz, 1 fps), gebaut mit ffmpeg in ein Wegwerf-Verzeichnis.
// Gemessen wird damit die SEITE (Quelle, Sprung, Sprache) — nicht das Video selbst.
let STELLV = null;
try {
  const { execFileSync } = await import('node:child_process');
  const os = await import('node:os');
  const FF = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
  STELLV = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'seite-')), 'stellv.webm');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x36:r=1:d=240', '-c:v', 'libvpx-vp9', '-b:v', '20k', STELLV]);
} catch { STELLV = null; }
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(WURZEL, u.endsWith('/') ? u + 'index.html' : u);
  if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  geholt.push(u);
  const echt = u.endsWith('.mp4') && STELLV ? STELLV : f;
  const g = fs.statSync(echt).size, typ = echt === STELLV ? 'video/webm' : (TYP[path.extname(f)] || 'application/octet-stream');
  const r = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (r) {
    const a = r[1] ? +r[1] : 0, b = r[2] ? +r[2] : g - 1;
    res.writeHead(206, { 'Content-Type': typ, 'Content-Range': `bytes ${a}-${b}/${g}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
    return fs.createReadStream(echt, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': typ, 'Content-Length': g, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(echt).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${srv.address().port}/`;

const browser = await chromium.launch();
try {
  // 1 · Deutsch, Schreibtisch
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'de-DE' });
  const p = await ctx.newPage();
  const fehler = []; p.on('pageerror', e => fehler.push(e.message));
  await p.goto(URL0);
  await p.waitForFunction(() => document.querySelectorAll('#kapitel button').length > 0, null, { timeout: 10000 }).catch(() => {});
  ok('Deutsch ist die Vorgabe', await p.getAttribute('[data-sprache="de"]', 'aria-pressed') === 'true');
  ok('Titel deutsch', /Formulare/.test(await p.textContent('h1')));
  const kap = await p.$$eval('#kapitel button', bs => bs.map(b => b.textContent));
  ok('acht Kapitel-Knöpfe (ohne Anfang und Schluss)', kap.length === 8, JSON.stringify(kap));
  ok('Kapitel „Übersetzen" mit Zeit', kap.some(t => /^\d:\d\dÜbersetzen$/.test(t)), JSON.stringify(kap));
  ok('Poster steht da', await p.$eval('#poster', i => i.complete && i.naturalWidth > 0));
  ok('Video lädt NICHT vor dem Antippen', !geholt.some(u => u.endsWith('.mp4')) && !(await p.$('video')));
  ok('für jede Sprache liegen Video, Poster und Marken da', ['', '-en', '-ru'].every(s =>
    fs.existsSync(path.join(WURZEL, `assets/workfloh-pdf-quer${s}.mp4`)) && fs.existsSync(path.join(WURZEL, `assets/kapitel-quer${s}.json`))) &&
    ['de', 'en', 'ru'].every(s => fs.existsSync(path.join(WURZEL, `assets/poster-${s}.jpg`))));

  // 2 · Russisch
  await p.click('[data-sprache="ru"]');
  await p.waitForFunction(() => /Перевод/.test(document.getElementById('kapitel').textContent), null, { timeout: 5000 }).catch(() => {});
  ok('RU: Titel russisch', /формуляр/i.test(await p.textContent('h1')));
  ok('RU: Poster russisch', /poster-ru\.jpg$/.test(await p.getAttribute('#poster', 'src')));
  ok('RU: Kapitel russisch', /Перевод/.test(await p.textContent('#kapitel')));
  ok('RU: <html lang="ru">', await p.getAttribute('html', 'lang') === 'ru');
  ok('RU: Chrome-Tipp russisch', /Chrome/.test(await p.textContent('.tipp')) && /браузере/.test(await p.textContent('.tipp')));

  // 3 · Kapitel springt an die Stelle — im RU-Video
  const marken = JSON.parse(fs.readFileSync(path.join(WURZEL, 'assets/kapitel-quer-ru.json'), 'utf8'));
  const ziel = marken.find(m => m.n === 'uebersetzen').t;
  await p.click('#kapitel button:has-text("Перевод")');
  await p.waitForFunction(() => { const v = document.querySelector('video'); return v && v.readyState >= 1; }, null, { timeout: 15000 }).catch(() => {});
  const v = await p.evaluate(() => { const v = document.querySelector('video'); return v && { src: v.getAttribute('src'), t: v.currentTime, dauer: v.duration }; });
  ok('Kapitel legt das RU-Video an', v && /quer-ru\.mp4$/.test(v.src), JSON.stringify(v));
  ok('… und springt an „Перевод"', v && Math.abs(v.t - ziel) < 1.5, `t=${v && v.t}, soll ${ziel}`);
  if (!STELLV) console.log('⊘ Sprung nicht messbar: kein ffmpeg für den Stellvertreter');
  // Die echte Länge steht in den Marken: Schluss beginnt nach über drei Minuten
  ok('… das Video trägt mehr als drei Minuten Kapitel', marken[marken.length - 1].t > 180);

  // 4 · Wahl bleibt beim Neuladen
  await p.reload();
  await p.waitForTimeout(400);
  ok('Sprachwahl übersteht das Neuladen', await p.getAttribute('[data-sprache="ru"]', 'aria-pressed') === 'true');
  ok('keine Seitenfehler', fehler.length === 0, fehler.join(' | '));

  // 5 · Handy 360 px, Englisch per Browser-Sprache
  const h = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'en-GB', isMobile: true, hasTouch: true });
  const q = await h.newPage();
  await q.goto(URL0);
  await q.waitForTimeout(500);
  ok('Handy: Englisch aus der Browser-Sprache', await q.getAttribute('[data-sprache="en"]', 'aria-pressed') === 'true');
  const breite = await q.evaluate(() => document.documentElement.scrollWidth);
  ok('Handy: keine seitliche Überbreite', breite <= 360, `scrollWidth ${breite}`);
  const knopf = await q.$eval('.abspielen i', e => e.getBoundingClientRect().width);
  ok('Handy: Abspielknopf groß genug', knopf >= 44, `${knopf}`);
  ok('Impressum verlinkt', !!(await q.$('footer a[href="impressum.html"]')));
  const imp = await q.goto(URL0 + 'impressum.html');
  ok('Impressum antwortet und nennt die Musik', imp.ok() && /Pixabay/.test(await q.textContent('body')) && /§ 5 DDG/.test(await q.textContent('body')));
} finally { await browser.close(); srv.close(); }
console.log(`${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
