// Probe der Landingpage im echten Browser (Playwright, Chromium).
//   node tests/seite.mjs
// Dazu: das ganze Video hochkant unter dem großen (Poster, Antippen, Herunterladen je Sprache) und die Bühne
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

  // 1b · Das ganze Video hochkant (Klaus 2026-09-28: die 30-s-Fassung ist raus): Poster da, Video erst beim Antippen
  ok('Hochformat: Poster steht da', await p.$eval('#kurzPoster', i => { i.loading = 'eager'; return true; }) &&
    await p.waitForFunction(() => { const i = document.getElementById('kurzPoster'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }).then(() => true, () => false));
  ok('Hochformat: Poster ist das ganze Video, nicht die Kurzfassung', /poster-hochvoll-de\.jpg$/.test(await p.getAttribute('#kurzPoster', 'src')));
  ok('Hochformat: Herunterladen zeigt aufs ganze deutsche Hochkant-Video', /workfloh-pdf-hochvoll\.mp4$/.test(await p.getAttribute('#kurzLaden', 'href')));
  ok('Hochformat: Dauer wie das Querformat', (await p.textContent('#kurzDauer')) === (await p.textContent('#dauer')));
  ok('keine 30-Sekunden-Fassung mehr auf der Seite', !/workfloh-pdf-hoch[.-]|poster-hoch-|30 Sekunden/.test(fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8')));
  const kb = await p.evaluate(() => { const k = document.getElementById('kurz').getBoundingClientRect(), m = document.querySelector('main').getBoundingClientRect(),
    t = document.querySelector('#kurz h2').getBoundingClientRect(), b = document.getElementById('kurzBild').getBoundingClientRect();
    return { breit: k.width, mitte: Math.abs((k.left + k.right) / 2 - (m.left + m.right) / 2), mainBreit: m.width, textUnter: t.top >= b.bottom - 1 }; });
  ok('Hochformat: schmal und mittig, Text darunter', kb.breit <= 400 && kb.breit < kb.mainBreit && kb.mitte < 3 && kb.textUnter, JSON.stringify(kb));
  // Bilder an den Erklärkarten: jede Karte eins, aus dem Hochformat der App, je Sprache
  const BILDER = ['scannen', 'felder', 'ausfuellen', 'ausgeben', 'uebersetzen', 'suchen', 'ordnen', 'hilfe'];
  const karten = await p.$$eval('#kann + .gitter section', s => s.map(x => { const i = x.querySelector('img.bild'); return i && i.getAttribute('src'); }));
  ok('jede Erklärkarte trägt ein Bild', karten.length === 8 && karten.every(Boolean), JSON.stringify(karten));
  ok('für jede Sprache liegen alle Bilder da', ['de', 'en', 'ru'].every(sp => BILDER.every(n => fs.existsSync(path.join(WURZEL, `assets/bilder/${sp}-${n}.jpg`)))));
  await p.$$eval('img.bild', l => l.forEach(i => { i.loading = 'eager'; }));
  ok('die Bilder laden wirklich', await p.waitForFunction(() => [...document.querySelectorAll('img.bild')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).then(() => true, () => false));
  // „Gut zu wissen" trägt ebenfalls Bilder (Klaus 2026-09-28)
  const WISSEN = ['geraet', 'offline', 'ki', 'sprachen'];
  const wk = await p.$$eval('#wissen + .gitter section', s => s.map(x => { const i = x.querySelector('img.bild'); return i && i.dataset.bild; }));
  ok('jede Karte „Gut zu wissen" trägt ein Bild', wk.length === 4 && WISSEN.every((n, i) => wk[i] === n), JSON.stringify(wk));
  ok('für jede Sprache liegen die Wissen-Bilder da', ['de', 'en', 'ru'].every(sp => WISSEN.every(n => fs.existsSync(path.join(WURZEL, `assets/bilder/${sp}-${n}.jpg`)))));
  // Karten wachsen beim Zeigen mit der Maus (ab 600 px), über den Rand hinaus nie
  const masz = (sel) => p.$eval(sel, e => { const r = e.getBoundingClientRect(); return { w: r.width, l: r.left, r: r.right, z: getComputedStyle(e).zIndex }; });
  const erste = '#kann + .gitter section:nth-child(1)', zweite = '#kann + .gitter section:nth-child(2)';
  await p.mouse.move(5, 5); await p.$eval(erste, e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  const vorher = await masz(erste), nachbarVorher = await masz(zweite);
  await p.hover(erste); await p.waitForTimeout(400);
  const nachher = await masz(erste), nachbarNachher = await masz(zweite);
  ok('Maus: die Karte wird größer', nachher.w > vorher.w * 1.12, JSON.stringify({ vorher, nachher }));
  ok('Maus: sie liegt über den Nachbarn', Number(nachher.z) > 0, JSON.stringify(nachher));
  ok('Maus: die Nachbarkarte bleibt, wie sie ist', Math.abs(nachbarNachher.w - nachbarVorher.w) < 1, JSON.stringify({ nachbarVorher, nachbarNachher }));
  ok('Maus: die Randkarte wächst nicht über den linken Rand', nachher.l >= 0, JSON.stringify(nachher));
  const letzteImReihe = await p.$$eval('#kann + .gitter section', l => { const top = l[0].getBoundingClientRect().top; return l.filter(x => Math.abs(x.getBoundingClientRect().top - top) < 2).length; });
  const rechts = `#kann + .gitter section:nth-child(${letzteImReihe})`;
  await p.hover(rechts); await p.waitForTimeout(400);
  const rr = await masz(rechts);
  ok('Maus: die rechte Randkarte wächst nicht über den rechten Rand', rr.r <= 1280 && rr.w > vorher.w * 1.12, JSON.stringify(rr));
  await p.mouse.move(5, 5); await p.waitForTimeout(400);
  ok('Maus: weggezogen ist sie wieder normal', Math.abs((await masz(erste)).w - vorher.w) < 1);
  await p.click(erste); await p.mouse.move(5, 5); await p.waitForTimeout(400);
  ok('Maus: ein Klick hält sie nicht fest groß', Math.abs((await masz(erste)).w - vorher.w) < 1);
  await p.$$eval('#kann + .gitter section', l => l.forEach(k => k.classList.remove('gross')));

  // 2 · Russisch
  await p.click('[data-sprache="ru"]');
  await p.waitForFunction(() => /Перевод/.test(document.getElementById('kapitel').textContent), null, { timeout: 5000 }).catch(() => {});
  ok('RU: Titel russisch', /формуляр/i.test(await p.textContent('h1')));
  ok('RU: Poster russisch', /poster-ru\.jpg$/.test(await p.getAttribute('#poster', 'src')));
  ok('RU: Kapitel russisch', /Перевод/.test(await p.textContent('#kapitel')));
  ok('RU: Überblick russisch', /Что умеет/.test(await p.textContent('#kann')) && /[а-я]/i.test(await p.textContent('.ablauf')) && /Полезно/.test(await p.textContent('#wissen')));
  ok('RU: <html lang="ru">', await p.getAttribute('html', 'lang') === 'ru');
  ok('RU: Chrome-Tipp russisch', /Chrome/.test(await p.textContent('.tipp')) && /браузере/.test(await p.textContent('.tipp')));

  ok('RU: Hochformat — Poster und Herunterladen russisch', /poster-hochvoll-ru\.jpg$/.test(await p.getAttribute('#kurzPoster', 'src')) &&
    /workfloh-pdf-hochvoll-ru\.mp4$/.test(await p.getAttribute('#kurzLaden', 'href')));
  ok('RU: Hochformat — Text russisch', /вертикально/.test(await p.textContent('#kurz')));
  ok('RU: Bilder an den Karten russisch', (await p.$$eval('img.bild', l => l.map(i => i.getAttribute('src')))).every(s => /bilder\/ru-/.test(s)));

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

  // 3b · Hochformat-Video antippen: eigenes Video, russisch, nicht in einem Knopf
  await p.click('#kurzBild');
  await p.waitForFunction(() => { const v = document.querySelector('#kurzVideo video'); return v && v.readyState >= 1; }, null, { timeout: 15000 }).catch(() => {});
  const kv = await p.evaluate(() => { const v = document.querySelector('#kurzVideo video'); return v && { src: v.getAttribute('src'), imKnopf: !!v.closest('button'), controls: v.controls }; });
  ok('Hochformat: Antippen legt das ganze RU-Hochkant-Video an', kv && /hochvoll-ru\.mp4$/.test(kv.src), JSON.stringify(kv));
  ok('Hochformat: Video steht NICHT in einem Knopf, Bedienelemente an', kv && !kv.imKnopf && kv.controls, JSON.stringify(kv));

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
  // Handy: die Karten stehen einzeln, das Bild füllt die Breite, Antippen vergrößert nichts
  const hk = await q.$$eval('#kann + .gitter section', l => l.map(x => { const r = x.getBoundingClientRect(), i = x.querySelector('img.bild').getBoundingClientRect(); return { l: r.left, w: r.width, bild: i.width }; }));
  ok('Handy: die Karten stehen einzeln untereinander', hk.every(k => Math.abs(k.l - hk[0].l) < 1) && new Set(hk.map(k => Math.round(k.l))).size === 1, JSON.stringify(hk.slice(0, 3)));
  ok('Handy: das Bild ist größer als am Bildschirm (über 260 px)', hk.every(k => k.bild > 280), JSON.stringify(hk.map(k => k.bild)));
  await q.$eval('#kann + .gitter section', e => e.scrollIntoView({ block: 'center' }));
  await q.tap('#kann + .gitter section'); await q.waitForTimeout(400);
  const hk1 = await q.$eval('#kann + .gitter section', e => e.getBoundingClientRect().width);
  ok('Handy: Antippen vergrößert nicht über den Rand', Math.abs(hk1 - hk[0].w) < 1 && (await q.evaluate(() => document.documentElement.scrollWidth)) <= 360, `${hk1}`);
  // 5b · Lage des Geräts (Klaus 2026-09-28): hochkant dasselbe GANZE Video hochkant, quer im Querformat —
  // von selbst, beim Laden und beim Drehen, und an DERSELBEN Stelle weiter. Das Handy steht hochkant (360 × 740).
  const lage = () => q.evaluate(() => { const alle = [...document.querySelectorAll('#buehne video')], v = alle.find(x => !x.hidden);
    return { hoch: document.documentElement.classList.contains('hochkant'),
      poster: document.getElementById('poster') && document.getElementById('poster').getAttribute('src'),
      dauer: document.getElementById('dauer') && document.getElementById('dauer').textContent,
      video: v && v.getAttribute('src'), t: v && v.currentTime, laeuft: v && !v.paused, sichtbar: alle.filter(x => !x.hidden).length,
      zweit: (alle.find(x => x.hidden) || {}).src || null, stumm: (alle.find(x => x.hidden) || {}).muted,
      kapitel: getComputedStyle(document.getElementById('kapitel')).display !== 'none' && document.querySelectorAll('#kapitel button').length > 0,
      buehne: (r => ({ w: r.width, h: r.height }))(document.getElementById('buehne').getBoundingClientRect()) }; });
  let L = await lage();
  ok('Hochkant: die Seite erkennt es von selbst', L.hoch, JSON.stringify(L));
  ok('Hochkant: Poster der Hochkant-Fassung, Länge wie das ganze Video', /poster-hochvoll-en\.jpg$/.test(L.poster) && L.dauer === '3:40', JSON.stringify(L));
  ok('Hochkant: die Kapitel stehen auch hochkant da (gleiche Sekunden)', L.kapitel, JSON.stringify(L));
  ok('Hochkant: die Bühne steht hochkant und passt ins Fenster', L.buehne.h > L.buehne.w && L.buehne.h <= 740, JSON.stringify(L.buehne));
  ok('für jede Sprache liegt die ganze Hochkant-Fassung samt Poster da', ['', '-en', '-ru'].every(s => fs.existsSync(path.join(WURZEL, `assets/workfloh-pdf-hochvoll${s}.mp4`))) &&
    ['de', 'en', 'ru'].every(s => fs.existsSync(path.join(WURZEL, `assets/poster-hochvoll-${s}.jpg`))));
  await q.click('#abspielen');
  await q.waitForFunction(() => document.querySelector('#buehne video'), null, { timeout: 5000 }).catch(() => {});
  L = await lage();
  ok('Hochkant: Abspielen legt die ganze Hochkant-Fassung an', /workfloh-pdf-hochvoll-en\.mp4$/.test(L.video || ''), JSON.stringify(L));
  if (STELLV) {
    await q.waitForFunction(() => document.querySelectorAll('#buehne video').length === 2, null, { timeout: 8000 }).catch(() => {});
    L = await lage();
    ok('nach dem Start lädt das Querformat still mit (verborgen, stumm)', /workfloh-pdf-quer-en\.mp4$/.test(L.zweit || '') && L.stumm && L.sichtbar === 1, JSON.stringify(L));
    await q.evaluate(() => { const v = [...document.querySelectorAll('#buehne video')].find(x => !x.hidden); v.currentTime = 60; });
    await q.waitForFunction(() => { const v = [...document.querySelectorAll('#buehne video')].find(x => !x.hidden); return v.currentTime >= 60 && !v.seeking; }, null, { timeout: 5000 }).catch(() => {});
    const vorher = (await lage()).t;
    await q.setViewportSize({ width: 740, height: 360 });
    await q.waitForFunction(() => { const v = [...document.querySelectorAll('#buehne video')].find(x => !x.hidden); return v && /quer-en/.test(v.src); }, null, { timeout: 3000 }).catch(() => {});
    L = await lage();
    ok('Quer gedreht: das Querformat ist zu sehen', /workfloh-pdf-quer-en\.mp4$/.test(L.video || '') && L.sichtbar === 1, JSON.stringify(L));
    ok('Quer gedreht: es geht an DERSELBEN Stelle weiter', L.t != null && Math.abs(L.t - vorher) < 1.5, JSON.stringify({ vorher, nachher: L.t }));
    ok('Quer gedreht: es läuft weiter, und die Hochkant-Fassung wartet verborgen', L.laeuft && /hochvoll-en/.test(L.zweit || ''), JSON.stringify(L));
    const vorher2 = L.t;
    await q.setViewportSize({ width: 360, height: 740 });
    await q.waitForFunction(() => { const v = [...document.querySelectorAll('#buehne video')].find(x => !x.hidden); return v && /hochvoll-en/.test(v.src); }, null, { timeout: 3000 }).catch(() => {});
    L = await lage();
    ok('Zurück hochkant: wieder die Hochkant-Fassung, an derselben Stelle', /hochvoll-en\.mp4$/.test(L.video || '') && Math.abs(L.t - vorher2) < 1.5 && L.laeuft, JSON.stringify({ vorher2, L }));
  } else console.log('⊘ Drehen an derselben Stelle nicht messbar: kein ffmpeg für den Stellvertreter');
  ok('Hochkant: keine Seitenfehler beim Drehen', fehler2.length === 0, fehler2.join(' | '));

  ok('Impressum verlinkt', !!(await q.$('footer a[href="impressum.html"]')));
  const imp = await q.goto(URL0 + 'impressum.html');
  ok('Impressum antwortet und nennt die Musik', imp.ok() && /Pixabay/.test(await q.textContent('body')) && /§ 5 DDG/.test(await q.textContent('body')));

  // 6 · Bühne hochkant: das Gerät und das Band liegen ganz im Bild (1080×1920).
  // Bis 2026-09-28 stand der Zoom fest auf 2,05 — das Gerät endete bei 1957 px.
  // 5b2 · Schmales Fenster 700 px mit Maus: dort stoßen die Karten an den Rand — sie wachsen zur Mitte hin
  const sm = await browser.newContext({ viewport: { width: 700, height: 800 }, locale: 'de-DE' });
  const s7 = await sm.newPage(); await s7.goto(URL0); await s7.waitForTimeout(300);
  const rand = [];
  for (const sel of ['#kann + .gitter section:nth-child(1)', '#kann + .gitter section:nth-child(2)']) {
    await s7.$eval(sel, e => e.scrollIntoView({ block: 'center' })); await s7.hover(sel); await s7.waitForTimeout(400);
    rand.push(await s7.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width }; }));
  }
  ok('700 px: beide Randkarten wachsen und bleiben im Fenster', rand.every(r => r.l >= 0 && r.r <= 700 && r.w > 280), JSON.stringify(rand));
  await sm.close();
  // 5b3 · Großes Handy 560 px: auch dort einzeln untereinander, Bild groß
  const gh = await browser.newContext({ viewport: { width: 560, height: 900 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const g5 = await gh.newPage(); await g5.goto(URL0); await g5.waitForTimeout(300);
  const g5k = await g5.$$eval('#kann + .gitter section', l => l.map(x => ({ l: Math.round(x.getBoundingClientRect().left), b: x.querySelector('img.bild').getBoundingClientRect().width })));
  ok('560 px: die Karten stehen einzeln, das Bild ist groß', new Set(g5k.map(k => k.l)).size === 1 && g5k.every(k => k.b > 300), JSON.stringify(g5k.slice(0, 3)));
  await g5.$eval('#kann + .gitter section', e => e.scrollIntoView({ block: 'center' }));
  const g5w = await g5.$eval('#kann + .gitter section', e => e.getBoundingClientRect().width);
  await g5.tap('#kann + .gitter section'); await g5.waitForTimeout(400);
  ok('560 px: Antippen vergrößert nicht', Math.abs((await g5.$eval('#kann + .gitter section', e => e.getBoundingClientRect().width)) - g5w) < 1);
  await gh.close();

  // 5c · Tablet quer mit dem Finger (Klaus 2026-09-28): Antippen vergrößert, noch einmal verkleinert, eine andere nimmt es mit
  const tab = await browser.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true, isMobile: false, locale: 'de-DE' });
  const t = await tab.newPage();
  await t.goto(URL0); await t.waitForTimeout(400);
  const tk = i => `#kann + .gitter section:nth-child(${i})`;
  const tw = i => t.$eval(tk(i), e => e.getBoundingClientRect().width);
  await t.$eval(tk(1), e => e.scrollIntoView({ block: 'center' })); await t.waitForTimeout(200);
  const t0 = await tw(1);
  // Maus am Tablet (Klaus 2026-09-28: „die Lupe kam, vergrößert hat nichts"): Chrome meldet dort oft (hover: none) —
  // allein das Darüberfahren muss trotzdem vergrößern, ohne Klick und ohne Lupen-Zeiger
  const keinHover = await t.evaluate(() => matchMedia('(hover: none)').matches);
  ok('Tablet: die Probe steht wirklich in einer Lage ohne (hover: hover)', keinHover);
  await t.mouse.move(5, 5); await t.hover(tk(2)); await t.waitForTimeout(400);
  ok('Tablet mit Maus: Darüberfahren vergrößert — ohne Klick', (await tw(2)) > t0 * 1.12, `${await tw(2)}`);
  ok('Tablet mit Maus: kein Lupen-Zeiger', await t.$eval(tk(2), e => getComputedStyle(e).cursor) !== 'zoom-in');
  await t.mouse.move(5, 5); await t.waitForTimeout(400);
  ok('Tablet mit Maus: Wegziehen macht sie wieder klein', Math.abs((await tw(2)) - t0) < 1);
  await t.tap(tk(1)); await t.waitForTimeout(400);
  ok('Tablet: Antippen vergrößert die Karte', (await tw(1)) > t0 * 1.12, `${t0} → ${await tw(1)}`);
  await t.tap(tk(2)); await t.waitForTimeout(400);
  ok('Tablet: eine andere antippen — nur sie ist groß', (await tw(2)) > t0 * 1.12 && Math.abs((await tw(1)) - t0) < 1);
  await t.tap(tk(2)); await t.waitForTimeout(400);
  ok('Tablet: noch einmal antippen macht sie wieder klein', Math.abs((await tw(2)) - t0) < 1);
  await t.tap(tk(3)); await t.waitForTimeout(400);
  await t.tap('h1'); await t.waitForTimeout(400);
  ok('Tablet: Tipp daneben macht sie wieder klein', Math.abs((await tw(3)) - t0) < 1);
  await tab.close();

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
  // 6b · Die Bühne rollt NICHT mit (Klaus 2026-09-28: Band hochkant links abgeschnitten). Rollt die App im iframe
  // ein Element ins Bild, während die Kamera zoomt, rollte #stage (overflow:hidden) mit — samt Band, 915 px.
  await bp.evaluate(() => { const g = document.getElementById('geraet').getBoundingClientRect(); B.zoom({ x: g.x, y: g.y + g.height * 0.5, w: g.width, h: g.height * 0.3 }, 1.5); });
  await bp.waitForTimeout(1300);
  const roll = await bp.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:1500px;top:2600px;width:10px;height:10px';
    document.getElementById('kamera').appendChild(d); d.scrollIntoView({ block: 'center', inline: 'center' });
    const s = document.getElementById('stage'), t = document.getElementById('bandText').getBoundingClientRect();
    return { sl: s.scrollLeft, st: s.scrollTop, links: t.left, rechts: t.right }; });
  ok('Bühne rollt beim Zoom nicht mit, das Band bleibt ganz im Bild', roll.sl === 0 && roll.st === 0 && roll.links >= 0 && roll.rechts <= 1080, JSON.stringify(roll));
  // 6c · Weißer Kreisschatten hinter dem roten Floh (Klaus 2026-09-28: rot auf Rot kaum zu sehen) — wie im Handbuch
  bp.evaluate(() => B.karte('<div class="floh"></div><h1>Workfloh <span>PDF</span></h1>', '', '', 3000)).catch(() => {});
  await bp.waitForSelector('#karte .floh', { timeout: 5000 }).catch(() => {});
  const fl = await bp.evaluate(() => { const f = document.querySelector('#karte .floh'); if (!f) return null;
    const vor = getComputedStyle(f, '::before'), nach = getComputedStyle(f, '::after'), r = f.getBoundingClientRect();
    return { kreis: vor.content !== 'none' ? vor.backgroundImage : 'nicht gezeichnet', kreisIn: vor.inset || vor.top, floh: nach.content !== 'none' ? nach.backgroundImage : 'nicht gezeichnet', b: r.width }; });
  ok('Titelkarte: weißer Kreisschatten hinter dem Floh, der Floh darüber', !!fl && /radial-gradient\(.*rgba\(255, 255, 255/.test(fl.kreis) && /w-floh/.test(fl.floh) && /-/.test(fl.kreisIn), JSON.stringify(fl));
} finally { await browser.close(); srv.close(); }
console.log(`${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
