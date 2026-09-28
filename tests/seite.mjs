// Probe der Landingpage im echten Browser (Playwright, Chromium).
//   node tests/seite.mjs
// Dazu: Kurzfassung hochkant (Poster, Antippen, Herunterladen je Sprache) und die Bühne
// hochkant (Gerät und Band ganz im Bild).
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
  // Überblick: was die App kann, wie es ineinandergreift, gut zu wissen
  ok('Überblick: acht Werkzeug-Karten', await p.$$eval('#kann + .gitter section', s => s.length) === 8);
  ok('Überblick: fünf Schritte im Ablauf', await p.$$eval('.ablauf li', l => l.length) === 5);
  ok('Überblick: vier Karten „Gut zu wissen"', await p.$$eval('#wissen + .gitter section', s => s.length) === 4);
  ok('Überblick nennt Suchen, Ordnen, Ausgeben',
    /Suchen/.test(await p.textContent('#kann + .gitter')) && /Ordnen/.test(await p.textContent('#kann + .gitter')) && /Ausgeben/.test(await p.textContent('#kann + .gitter')));
  {
    // Jeder Text der Seite hat eine englische UND eine russische Fassung (sonst bliebe Deutsch stehen)
    const html = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
    const schluessel = [...new Set([...html.matchAll(/data-t="([^"]+)"/g)].map(m => m[1]))];
    const block = sp => { const i = html.indexOf(`    ${sp}: {\n      titel`); return html.slice(i, html.indexOf('\n    }', i)); };
    for (const sp of ['en', 'ru']) {
      const b = block(sp), fehlt = schluessel.filter(k => !new RegExp(`[\\s{,]${k}: '`).test(b));
      ok(`${sp.toUpperCase()}: jeder Seitentext hat eine Übersetzung`, fehlt.length === 0, fehlt.join(', '));
    }
  }
  ok('Video lädt NICHT vor dem Antippen', !geholt.some(u => u.endsWith('.mp4')) && !(await p.$('video')));
  ok('für jede Sprache liegen Video, Poster und Marken da', ['', '-en', '-ru'].every(s =>
    fs.existsSync(path.join(WURZEL, `assets/workfloh-pdf-quer${s}.mp4`)) && fs.existsSync(path.join(WURZEL, `assets/kapitel-quer${s}.json`))) &&
    ['de', 'en', 'ru'].every(s => fs.existsSync(path.join(WURZEL, `assets/poster-${s}.jpg`))));

  // 1b · Kurzfassung (hochkant): Poster da, Video erst beim Antippen, Datei zum Weiterschicken
  ok('Kurzfassung: Poster steht da', await p.$eval('#kurzPoster', i => { i.loading = 'eager'; return true; }) &&
    await p.waitForFunction(() => { const i = document.getElementById('kurzPoster'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }).then(() => true, () => false));
  ok('Kurzfassung: Herunterladen zeigt aufs deutsche Video', /workfloh-pdf-hoch\.mp4$/.test(await p.getAttribute('#kurzLaden', 'href')));
  ok('für jede Sprache liegt die Kurzfassung samt Poster da', ['', '-en', '-ru'].every(s => fs.existsSync(path.join(WURZEL, `assets/workfloh-pdf-hoch${s}.mp4`))) &&
    ['de', 'en', 'ru'].every(s => fs.existsSync(path.join(WURZEL, `assets/poster-hoch-${s}.jpg`))));

  // 2 · Russisch
  await p.click('[data-sprache="ru"]');
  await p.waitForFunction(() => /Перевод/.test(document.getElementById('kapitel').textContent), null, { timeout: 5000 }).catch(() => {});
  ok('RU: Titel russisch', /формуляр/i.test(await p.textContent('h1')));
  ok('RU: Poster russisch', /poster-ru\.jpg$/.test(await p.getAttribute('#poster', 'src')));
  ok('RU: Kapitel russisch', /Перевод/.test(await p.textContent('#kapitel')));
  ok('RU: Überblick russisch', /Что умеет/.test(await p.textContent('#kann')) && /[а-я]/i.test(await p.textContent('.ablauf')) && /Полезно/.test(await p.textContent('#wissen')));
  ok('RU: <html lang="ru">', await p.getAttribute('html', 'lang') === 'ru');
  ok('RU: Chrome-Tipp russisch', /Chrome/.test(await p.textContent('.tipp')) && /браузере/.test(await p.textContent('.tipp')));

  ok('RU: Kurzfassung — Poster und Herunterladen russisch', /poster-hoch-ru\.jpg$/.test(await p.getAttribute('#kurzPoster', 'src')) &&
    /workfloh-pdf-hoch-ru\.mp4$/.test(await p.getAttribute('#kurzLaden', 'href')));
  ok('RU: Kurzfassung — Text russisch', /секунд/.test(await p.textContent('#kurz')));

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

  // 3b · Kurzfassung antippen: eigenes Video, russisch, nicht in einem Knopf
  await p.click('#kurzBild');
  await p.waitForFunction(() => { const v = document.querySelector('#kurzVideo video'); return v && v.readyState >= 1; }, null, { timeout: 15000 }).catch(() => {});
  const kv = await p.evaluate(() => { const v = document.querySelector('#kurzVideo video'); return v && { src: v.getAttribute('src'), imKnopf: !!v.closest('button'), controls: v.controls }; });
  ok('Kurzfassung: Antippen legt das RU-Hochkant-Video an', kv && /hoch-ru\.mp4$/.test(kv.src), JSON.stringify(kv));
  ok('Kurzfassung: Video steht NICHT in einem Knopf, Bedienelemente an', kv && !kv.imKnopf && kv.controls, JSON.stringify(kv));

  // 4 · Wahl bleibt beim Neuladen
  await p.reload();
  await p.waitForTimeout(400);
  ok('Sprachwahl übersteht das Neuladen', await p.getAttribute('[data-sprache="ru"]', 'aria-pressed') === 'true');
  ok('keine Seitenfehler', fehler.length === 0, fehler.join(' | '));

  // 5 · Handy 360 px, Englisch per Browser-Sprache
  const h = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'en-GB', isMobile: true, hasTouch: true });
  const q = await h.newPage();
  const fehler2 = []; q.on('pageerror', e => fehler2.push(e.message));
  await q.goto(URL0);
  await q.waitForTimeout(500);
  ok('Handy: Englisch aus der Browser-Sprache', await q.getAttribute('[data-sprache="en"]', 'aria-pressed') === 'true');
  const breite = await q.evaluate(() => document.documentElement.scrollWidth);
  ok('Handy: keine seitliche Überbreite', breite <= 360, `scrollWidth ${breite}`);
  const knopf = await q.$eval('.abspielen i', e => e.getBoundingClientRect().width);
  ok('Handy: Abspielknopf groß genug', knopf >= 44, `${knopf}`);
  // 5b · Lage des Geräts (Klaus 2026-09-28): hochkant die Hochkant-Fassung, quer das ganze Video —
  // von selbst, beim Laden und beim Drehen. Das Handy hier steht hochkant (360 × 740).
  const lage = () => q.evaluate(() => ({ hoch: document.documentElement.classList.contains('hochkant'),
    poster: document.getElementById('poster') && document.getElementById('poster').getAttribute('src'),
    dauer: document.getElementById('dauer') && document.getElementById('dauer').textContent,
    video: document.querySelector('#buehne video') && document.querySelector('#buehne video').getAttribute('src'),
    kapitel: getComputedStyle(document.getElementById('kapitel')).display !== 'none',
    hinweis: !document.getElementById('hochHinweis').hidden && document.getElementById('hochHinweis').getBoundingClientRect().height > 0,
    buehne: (r => ({ w: r.width, h: r.height, unten: r.bottom - window.scrollY }))(document.getElementById('buehne').getBoundingClientRect()) }));
  let L = await lage();
  ok('Hochkant: die Seite erkennt es von selbst', L.hoch, JSON.stringify(L));
  ok('Hochkant: Poster und Länge der Hochkant-Fassung', /poster-hoch-en\.jpg$/.test(L.poster) && L.dauer === '0:31', JSON.stringify(L));
  ok('Hochkant: keine Kapitel, dafür der Hinweis aufs Querhalten', !L.kapitel && L.hinweis, JSON.stringify(L));
  ok('Hochkant: die Bühne steht hochkant und passt ins Fenster', L.buehne.h > L.buehne.w && L.buehne.h <= 740, JSON.stringify(L.buehne));
  await q.click('#abspielen');
  await q.waitForFunction(() => document.querySelector('#buehne video'), null, { timeout: 5000 }).catch(() => {});
  L = await lage();
  ok('Hochkant: Abspielen legt das Hochkant-Video an', /workfloh-pdf-hoch-en\.mp4$/.test(L.video || ''), JSON.stringify(L));
  await q.setViewportSize({ width: 740, height: 360 });
  await q.waitForFunction(() => !document.documentElement.classList.contains('hochkant'), null, { timeout: 3000 }).catch(() => {});
  L = await lage();
  ok('Quer gedreht: das Video wechselt auf das ganze Video', /workfloh-pdf-quer-en\.mp4$/.test(L.video || ''), JSON.stringify(L));
  ok('Quer gedreht: Kapitel da, Hinweis weg', L.kapitel && !L.hinweis, JSON.stringify(L));
  await q.setViewportSize({ width: 360, height: 740 });
  await q.waitForFunction(() => document.documentElement.classList.contains('hochkant'), null, { timeout: 3000 }).catch(() => {});
  L = await lage();
  ok('Zurück hochkant: wieder das Hochkant-Video', /workfloh-pdf-hoch-en\.mp4$/.test(L.video || ''), JSON.stringify(L));
  ok('Hochkant: keine Seitenfehler beim Drehen', fehler2.length === 0, fehler2.join(' | '));

  ok('Impressum verlinkt', !!(await q.$('footer a[href="impressum.html"]')));
  const imp = await q.goto(URL0 + 'impressum.html');
  ok('Impressum antwortet und nennt die Musik', imp.ok() && /Pixabay/.test(await q.textContent('body')) && /§ 5 DDG/.test(await q.textContent('body')));

  // 6 · Bühne hochkant: das Gerät und das Band liegen ganz im Bild (1080×1920).
  // Bis 2026-09-28 stand der Zoom fest auf 2,05 — das Gerät endete bei 1957 px.
  const b = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const bp = await b.newPage();
  await bp.goto(URL0 + 'video/buehne.html?w=1080&h=1920');
  await bp.waitForFunction(() => window.__bereit);
  await bp.evaluate(() => B.text('Gleiches Blatt, <b>neue Sprache</b> — die Felder kommen mit, auch in zwei Zeilen'));
  await bp.waitForTimeout(700);
  const g = await bp.evaluate(() => { const r = document.getElementById('geraet').getBoundingClientRect(), t = document.getElementById('bandText').getBoundingClientRect();
    return { links: r.left, rechts: r.right, unten: r.bottom, bandOben: t.top, bandUnten: t.bottom }; });
  ok('Bühne hochkant: Gerät ganz im Bild', g.links >= 0 && g.rechts <= 1080 && g.unten <= 1920, JSON.stringify(g));
  ok('Bühne hochkant: Band unter dem Gerät und im Bild', g.bandOben > g.unten && g.bandUnten <= 1900, JSON.stringify(g));
} finally { await browser.close(); srv.close(); }
console.log(`${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
