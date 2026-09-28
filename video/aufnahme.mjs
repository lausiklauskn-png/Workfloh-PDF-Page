// Nimmt das Erklärvideo auf: die ECHTE App (Nachbar-Klon Workflow-PDF) läuft auf
// der Bühne (buehne.html), die Comic-Hand fährt zu echten Knöpfen, und jeder
// Klick ist ein echter Mausklick an genau dieser Stelle.
//
//   node video/aufnahme.mjs --probe          # Probeclip (Anfang + Scannen)
//   node video/aufnahme.mjs                  # ganzes Video quer
//   node video/aufnahme.mjs --hoch           # Hochkant-Fassung
//
// Ergebnis: video/_roh/<name>/bilder/*.jpg + zeiten.json (Bild-Zeitstempel, Klicks).
// Danach: node video/schnitt.mjs <name>
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starteServer } from './server.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(process.env.APP || path.join(HIER, '../../Workflow-PDF'));
const probe = process.argv.includes('--probe'), hoch = process.argv.includes('--hoch');
const NAME = probe ? 'probe' : hoch ? 'hoch' : 'quer';
const W = hoch ? 1080 : 1920, H = hoch ? 1920 : 1080;
const ZIEL = path.join(HIER, '_roh', NAME);
fs.rmSync(ZIEL, { recursive: true, force: true }); fs.mkdirSync(path.join(ZIEL, 'bilder'), { recursive: true });
const FOTO = path.join(HIER, '_roh/foto.jpg');
if (!fs.existsSync(FOTO)) { console.error('Erst das Foto bauen: node video/foto-bauen.mjs'); process.exit(2); }

const { srv, url } = await starteServer(HIER, APP);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'de-DE' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('  [Seitenfehler]', String(e).slice(0, 160)));
await page.goto(`${url}/buehne.html?w=${W}&h=${H}`);
await page.waitForFunction(() => window.__bereit);
await page.evaluate(u => B.laden(u), `${url}/app/index.html`);
const app = page.frames().find(f => f.url().includes('/app/'));
await app.waitForSelector('#btnScan');

// ── Aufnahme: CDP-Screencast, jedes Bild mit seinem Zeitstempel ──
const cdp = await ctx.newCDPSession(page);
const bilder = []; let nr = 0, laeuft = false;
cdp.on('Page.screencastFrame', async f => {
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  if (!laeuft) return;
  const datei = `b${String(nr++).padStart(6, '0')}.jpg`;
  fs.writeFileSync(path.join(ZIEL, 'bilder', datei), Buffer.from(f.data, 'base64'));
  bilder.push({ datei, t: f.metadata.timestamp });
});
const start = async () => { laeuft = true; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 }); };
const stop = async () => { await cdp.send('Page.stopScreencast'); laeuft = false; };
const t0 = () => page.evaluate(() => performance.timeOrigin + performance.now());

// ── Werkzeuge fürs Drehbuch ──
const warte = ms => page.waitForTimeout(ms);
const text = html => page.evaluate(h => B.text(h), html);
const kapitel = (n, t) => page.evaluate(([n, t]) => B.kapitel(n, t), [n, t]);
const rect = sel => page.evaluate(s => B.rect(s), sel);
async function warteAuf(sel, ms = 30000) { await app.waitForSelector(sel, { state: 'visible', timeout: ms }); }
// Liegt das Ziel außerhalb seines Rollbereichs, rollt die App es erst sichtbar herein (weich)
async function insBild(sel) {
  const bewegt = await app.evaluate(s => {
    const el = document.querySelector(s); const r = el.getBoundingClientRect();
    let p = el.parentElement, aussen = r.top < 0 || r.bottom > innerHeight;
    while (p && !aussen) { const q = p.getBoundingClientRect(); if (p.scrollHeight > p.clientHeight + 2 && (r.top < q.top || r.bottom > q.bottom)) aussen = true; p = p.parentElement; }
    if (aussen) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return aussen;
  }, sel);
  if (bewegt) await warte(900);
}
// Hand fährt hin (Fingerspitze etwas unter die Mitte, damit die Beschriftung frei bleibt), drückt, echter Klick
async function tippe(sel, { vorher = 250, nachher = 700, dx = 0, dy = 0 } = {}) {
  await warteAuf(sel);
  await insBild(sel);
  const r = await rect(sel);
  const x = r.x + r.w / 2 + dx, y = r.y + r.h * 0.62 + dy;
  await page.evaluate(([x, y]) => B.handZu(x, y), [x, y]);
  await warte(vorher);
  await page.evaluate(() => B.druck());
  await page.mouse.click(x, y);
  await warte(nachher);
}
async function ziehe(sel, ddx, ddy) {
  const r = await rect(sel); const x = r.x + r.w / 2, y = r.y + r.h / 2;
  await page.evaluate(([x, y]) => B.handZu(x, y), [x, y]); await warte(250);
  await page.evaluate(() => B.druck()); await page.mouse.move(x, y); await page.mouse.down();
  const n = 24;
  for (let i = 1; i <= n; i++) {
    const nx = x + ddx * i / n, ny = y + ddy * i / n;
    await page.evaluate(([x, y]) => B.handZu(x, y, 30), [nx, ny]);
    await page.mouse.move(nx, ny);
  }
  await warte(500); await page.mouse.up(); await warte(500);
}
const karte = (html, rein, raus, halten) => page.evaluate(a => B.karte(...a), [html, rein, raus, halten]);
const kartenWeg = raus => page.evaluate(r => B.kartenWeg(r), raus);

// ── Drehbuch ──
const ANFANG = `<div class="floh hopst"></div><h1 class="auf">Workfloh <span>PDF</span></h1>
  <p class="auf">Formulare einfach erledigen — fotografieren, ausfüllen, übersetzen</p>`;

async function szeneAnfang() {
  await karte(ANFANG, 'blende', null, 2600);
  await kartenWeg('fliessen');
}

async function szeneScannen() {
  await kapitel('1', 'Scannen');
  await text('Ein Formular auf Papier? <b>Einfach fotografieren.</b>');
  await warte(1400);
  await tippe('#btnScan', { nachher: 900 });
  await warteAuf('.scan [data-kamera]');
  const [wahl] = await Promise.all([page.waitForEvent('filechooser'), tippe('.scan [data-kamera]', { nachher: 200 })]);
  await wahl.setFiles(FOTO);
  await page.evaluate(() => B.handWeg());
  await text('Die App <b>findet das Blatt</b> auf dem Foto von selbst');
  await app.waitForFunction(() => window.__wfpdfScan && window.__wfpdfScan.seiten[0] && window.__wfpdfScan.seiten[0].erkennung, null, { timeout: 90000 });
  await warte(1800);
  await text('Passt eine Ecke nicht, zieht man sie einfach nach — <b>mit Lupe</b>');
  await ziehe('.scan .scan-griff', -26, -18);
  await warte(600);
  await tippe('.scan [data-auto]', { nachher: 900 });
  await text('Gerade gezogen, Schatten weg: <b>Filter „Dokument"</b>');
  await tippe('.scan .scan-weiter', { nachher: 900 });
  await warteAuf('.scan [data-ergebnis]');
  await warte(700);
  const r = await rect('.scan [data-ergebnis]');
  await tippe('.scan [data-filter="dokument"]', { nachher: 400 });
  await page.evaluate(() => B.handWeg());
  await page.evaluate(r => B.zoom(r, 1.45), r);
  await warte(2600);
  await page.evaluate(() => B.zoom(null));
  await warte(1200);
  await text('Ein Tipp — und das Foto ist ein <b>sauberes PDF</b>');
  await tippe('.scan [data-fertig]', { nachher: 400 });
  await app.waitForSelector('#sc-ed.on .seite canvas', { timeout: 60000 });
  await page.evaluate(() => B.handWeg());
  await warte(2400);
}

async function szeneSchluss() {
  await text('');
  await kapitel('', '');
  await karte(`<div class="floh winkt"></div><h1 class="auf">Workfloh <span>PDF</span></h1>
    <p class="auf">kostenlos · ohne Konto · deine Daten bleiben auf dem Gerät</p>
    <div class="adresse auf">lausiklauskn-png.github.io/Workflow-PDF</div>`, 'irisMitte', null, 3500);
}

// ── Lauf ──
const klickBasis = await t0();
await start();
const beginn = Date.now();
try {
  await szeneAnfang();
  await szeneScannen();
  await szeneSchluss();
} catch (e) { console.error('Drehbuch abgebrochen:', e); }
await warte(400);
await stop();
const klicks = await page.evaluate(() => (window.__klicks || []).map(k => performance.timeOrigin + k));
fs.writeFileSync(path.join(ZIEL, 'zeiten.json'), JSON.stringify({ W, H, bilder, klicks: klicks.map(k => k / 1000), beginn: klickBasis / 1000 }, null, 1));
console.log(`${NAME}: ${bilder.length} Bilder in ${((Date.now() - beginn) / 1000).toFixed(1)} s, ${klicks.length} Klicks → ${ZIEL}`);
await browser.close(); srv.close();
