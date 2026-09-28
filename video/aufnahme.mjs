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
const probe = process.argv.includes('--probe') || process.argv.some(a => a.startsWith('--nur=')), hoch = process.argv.includes('--hoch');
const SPRACHE = ((process.argv.find(a => a.startsWith('--sprache=')) || '').slice(10)) || 'de';
if (!['de', 'en', 'ru'].includes(SPRACHE)) { console.error('--sprache=de|en|ru'); process.exit(2); }
const NAME = (probe ? 'probe' : hoch ? 'hoch' : 'quer') + (SPRACHE === 'de' ? '' : '-' + SPRACHE);
const W = hoch ? 1080 : 1920, H = hoch ? 1920 : 1080;
const ZIEL = path.join(HIER, '_roh', NAME);
fs.rmSync(ZIEL, { recursive: true, force: true }); fs.mkdirSync(path.join(ZIEL, 'bilder'), { recursive: true });
const FOTO = path.join(HIER, '_roh/foto.jpg');
const FORM = path.join(APP, 'beispiele/Beispiel-Amtsformular-Bewohnerparkausweis.pdf');
if (!fs.existsSync(FOTO)) { console.error('Erst das Foto bauen: node video/foto-bauen.mjs'); process.exit(2); }

const { srv, url } = await starteServer(HIER, APP);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'de-DE' });
await ctx.addInitScript(() => {
  window.__geteilt = [];
  Object.defineProperty(navigator, 'canShare', { configurable: true, get: () => d => !!(d && d.files) });
  navigator.share = async d => { window.__geteilt.push({ title: d.title, files: d.files.map(f => f.name) }); };
});
// Band, Kapitel und Folien: deutscher Satz ist der Schlüssel (texte.json)
const TEXTE = JSON.parse(fs.readFileSync(path.join(HIER, 'texte.json'), 'utf8'))[SPRACHE] || {};
const L = t => (TEXTE[t] != null ? TEXTE[t] : (SPRACHE !== 'de' && t && console.log('  [ohne Übersetzung]', t), t));
if (SPRACHE !== 'de') await ctx.addInitScript(l => { try { localStorage.setItem('wfpdf_sprache_v1', JSON.stringify({ lang: l, tipps: true })); } catch (_) {} }, SPRACHE);
const UE = JSON.parse(fs.readFileSync(path.join(HIER, 'uebersetzung.json'), 'utf8'));
await ctx.addInitScript(W => {
  // Chromes Übersetzer gibt es headless nicht: die Übersetzungen sind von Hand geschrieben (Klaus 2026-09-28)
  self.Translator = {
    availability: async ({ sourceLanguage: a, targetLanguage: b }) => a === b ? 'unavailable' : 'available',
    create: async ({ sourceLanguage: a, targetLanguage: b }) => ({
      translate: async t => { await new Promise(r => setTimeout(r, 45)); const w = W[a + '>' + b] || {}; return w[t] != null ? w[t] : t; },
      destroy() {} }) };
  // Spracherkennung: das Drehbuch „spricht" über window.__sag
  window.__rec = [];
  class Erk { constructor() { window.__rec.push(this); } start() {} stop() { setTimeout(() => this.onend && this.onend(), 20); } abort() {} }
  window.SpeechRecognition = Erk; window.webkitSpeechRecognition = Erk;
  window.__sag = (t, fertig) => { const r = window.__rec[window.__rec.length - 1]; const a = [{ transcript: t }]; a.isFinal = !!fertig; r.onresult({ resultIndex: 0, results: [a] }); };
  window.__ereignis = n => { const r = window.__rec[window.__rec.length - 1]; r['on' + n] && r['on' + n]({}); };
}, UE);
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
const text = html => page.evaluate(h => B.text(h), L(html));
const kapitel = (n, t) => page.evaluate(([n, t]) => B.kapitel(n, t), [n, L(t)]);
const rect = sel => page.evaluate(s => B.rect(s), sel);
async function warteAuf(sel, ms = 30000) { await app.waitForSelector(sel, { state: 'visible', timeout: ms }); }
// Liegt das Ziel außerhalb seines Rollbereichs, rollt die App es erst sichtbar herein (weich)
async function insBild(sel) {
  const bewegt = await app.evaluate(s => {
    const el = document.querySelector(s); const r = el.getBoundingClientRect();
    let p = el.parentElement, aussen = r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth;
    while (p && !aussen) {
      const q = p.getBoundingClientRect();
      if (p.scrollHeight > p.clientHeight + 2 && (r.top < q.top || r.bottom > q.bottom)) aussen = true;
      if (p.scrollWidth > p.clientWidth + 2 && (r.left < q.left || r.right > q.right)) aussen = true;   // waagrecht rollende Leisten (Ordner)
      p = p.parentElement;
    }
    if (aussen) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
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
  await warteAuf(sel); await insBild(sel);
  const r = await rect(sel); const x = r.x + r.w / 2, y = r.y + r.h / 2;
  await page.evaluate(([x, y]) => B.handZu(x, y), [x, y]); await warte(250);
  await page.evaluate(() => B.druck()); await page.mouse.move(x, y); await page.mouse.down();
  const n = 24;
  for (let i = 1; i <= n; i++) {
    const nx = x + ddx * i / n, ny = y + ddy * i / n;
    await page.evaluate(([x, y]) => B.handZu(x, y, 30, true), [nx, ny]);   // Ziehen ist eine Aktion: Handrücken bleibt
    await page.mouse.move(nx, ny);
  }
  await warte(500); await page.mouse.up(); await warte(500);
}
// Ziehen von einem Element auf ein anderes (ohne Nachrollen dazwischen)
async function zieheZu(von, nach) {
  const r = await rect(von), z = await rect(nach);
  const x = r.x + r.w / 2, y = r.y + r.h / 2, zx = z.x + z.w / 2, zy = z.y + z.h / 2;
  await page.evaluate(([x, y]) => B.handZu(x, y), [x, y]); await warte(250);
  await page.evaluate(() => B.druck()); await page.mouse.move(x, y); await page.mouse.down();
  const n = 30;
  for (let i = 1; i <= n; i++) {
    const e = i / n, nx = x + (zx - x) * e, ny = y + (zy - y) * e;
    await page.evaluate(([x, y]) => B.handZu(x, y, 30, true), [nx, ny]);
    await page.mouse.move(nx, ny);
  }
  await warte(600); await page.mouse.up(); await warte(700);
}
const karte = (html, rein, raus, halten, klasse) => page.evaluate(a => B.karte(...a), [html, rein, raus, halten, klasse]);
// Feld der App nach Bezeichnung (und optional Lage) finden → CSS-Selektor
async function feld(re, { x } = {}) {
  const id = await app.evaluate(([q, x]) => {
    const r = new RegExp(q); const fs = window.__wfpdf.S.doc.fields.filter(f => r.test(f.label));
    fs.sort((a, b) => x == null ? 0 : Math.abs(a.x - x) - Math.abs(b.x - x));
    return fs[0] && fs[0].id;
  }, [re.source, x]);
  if (!id) throw new Error('Feld fehlt: ' + re + ' — da sind: ' + JSON.stringify(await app.evaluate(() => window.__wfpdf.S.doc.fields.map(f => f.label))));
  return `.feld[data-id="${id}"]`;
}
// Kästchen nach LAGE in seiner Zeile (n = 0 ist das erste von links). Die Offline-Erkennung
// benennt ein Kästchen nach dem Text LINKS davon — beim Formular gehört die Beschriftung aber
// rechts daneben. Nach Namen getippt, trifft der Haken das falsche Kästchen (gemessen 2026-09-28).
async function kaestchen(re, n) {
  const id = await app.evaluate(([q, n]) => {
    const fs = window.__wfpdf.S.doc.fields; const a = fs.find(f => new RegExp(q).test(f.label));
    if (!a) return null;
    const zeile = fs.filter(f => f.type === 'check' && f.page === a.page && Math.abs(f.y - a.y) < 1.2).sort((x, y) => x.x - y.x);
    return zeile[n] && zeile[n].id;
  }, [re.source, n]);
  if (!id) throw new Error('Kästchen fehlt: ' + re + ' #' + n);
  return `.feld[data-id="${id}"]`;
}
async function dok(re) {
  const id = await app.evaluate(q => { const r = new RegExp(q); const d = [...document.querySelectorAll('#dokGitter .dok')].find(k => r.test(k.querySelector('.dok-name').textContent)); return d && d.dataset.id; }, re.source);
  if (!id) throw new Error('Karte fehlt: ' + re);
  return `#dokGitter .dok[data-id="${id}"]`;
}
async function zurBibliothek() { if (await app.$('#sc-ed.on')) await tippe('#edZurueck', { nachher: 700 }); await app.waitForSelector('#sc-bib.on'); }
async function tippeText(sel, wort) {
  await tippe(sel, { nachher: 250 });
  for (const z of wort) { await page.keyboard.type(z); await warte(40); }
  await warte(450);
}
const kartenWeg = raus => page.evaluate(r => B.kartenWeg(r), raus);

// ── Drehbuch ──
const ANFANG = `<div class="floh hopst"></div><h1 class="auf">Workfloh <span>PDF</span></h1>
  <p class="auf">${L('Formulare einfach erledigen — fotografieren, ausfüllen, übersetzen')}</p>`;

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


async function szeneEinlesen() {
  await kapitel('2', 'Einlesen');
  await text('Ein Formular als PDF? <b>Einfach einlesen.</b>');
  if (await app.$('#sc-ed.on')) await tippe('#edZurueck', { nachher: 900 });
  await app.waitForSelector('#sc-bib.on');
  await warte(700);
  const [wahl] = await Promise.all([page.waitForEvent('filechooser'), tippe('.import-leiste label:has(#inDatei)', { nachher: 200 })]);
  await wahl.setFiles(FORM);
  await page.evaluate(() => B.handWeg());
  await app.waitForSelector('#sc-ed.on .seite canvas', { timeout: 60000 });
  await warte(1400);
  await text('Die App <b>findet die Felder</b> — ohne Internet');
  await tippe('#edErkennen', { nachher: 700 });
  await tippe('.dlg [data-off]', { nachher: 300 });
  await page.evaluate(() => B.handWeg());
  await app.waitForFunction(() => window.__wfpdf.S.doc.fields.some(f => !f.geprueft), null, { timeout: 60000 });
  await app.waitForFunction(() => !document.querySelector('.fortschritt'));
  await warte(1800);
  await text('Passt alles? <b>Ein Tipp</b> übernimmt die Vorschläge');
  await tippe('#vorschlagBand [data-alle]', { nachher: 1200 });
}

async function szeneAusfuellen() {
  await kapitel('3', 'Ausfüllen');
  await text('Beschriftung falsch erkannt? <b>Feldart einfach umstellen</b>');
  const us = await feld(/Ich versichere/, { x: 49 });
  await tippe(us, { nachher: 700 });
  await tippe('#eigTyp', { nachher: 300 });
  await app.selectOption('#eigTyp', 'unterschrift');
  await warte(500);
  await tippe('#eigLabel', { nachher: 200 });
  await page.keyboard.press('Control+A');
  for (const z of 'Unterschrift') { await page.keyboard.type(z); await warte(55); }
  await warte(900);
  await text('Felder <b>verschieben</b> — mit dem Finger');
  const fn = await feld(/^Familienname/);
  await ziehe(fn, 0, -14);
  await warte(500);
  await text('Jetzt <b>ausfüllen</b>');
  await tippe('#mAusfuellen', { nachher: 900 });
  await tippeText((await feld(/^Familienname/)) + ' input', 'Musterfrau');
  await tippeText((await feld(/^Vorname/)) + ' input', 'Erika');
  await text('Datum mit <b>Kalender</b>');
  const gd = (await feld(/^Geburtsdatum/)) + ' input';
  await tippe(gd, { nachher: 300 });
  await page.keyboard.type('24051970', { delay: 90 });
  await warte(600);
  await text('E-Mail wird zum <b>Link</b>');
  await tippeText((await feld(/^E-Mail/)) + ' input', 'erika@beispiel.de');
  await app.evaluate(() => document.activeElement && document.activeElement.blur());
  await warte(700);
  await text('Kästchen: <b>ein Tipp</b>');
  await tippe(await feld(/^Hauptwohnsitz/), { nachher: 500 });
  await tippe(await feld(/^auf mich zugelassen/), { nachher: 600 });
  await text('Und <b>unterschreiben</b> — direkt auf dem Bildschirm');
  await tippe(await feld(/^Unterschrift$/), { nachher: 700 });
  await warteAuf('#usFlaeche');
  const r = await rect('#usFlaeche');
  const x0 = r.x + r.w * 0.15, y0 = r.y + r.h * 0.6;
  await page.evaluate(([x, y]) => B.handZu(x, y), [x0, y0]); await warte(200);
  await page.evaluate(() => B.art('tippen'));
  await page.mouse.move(x0, y0); await page.mouse.down();
  const n = 26;
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = x0 + r.w * 0.7 * t, y = y0 - Math.sin(t * Math.PI * 5) * r.h * 0.22 - t * r.h * 0.1;
    await page.evaluate(([x, y]) => B.handZu(x, y, 25, true), [x, y]); await page.mouse.move(x, y);
  }
  await page.mouse.up(); await warte(500);
  await tippe('.dlg [data-ok]', { nachher: 600 });
  await page.evaluate(() => B.handWeg());
  await warte(700);
}

async function szeneAusgeben() {
  await kapitel('4', 'Ausgeben');
  await text('Fertig? <b>Als PDF ausgeben</b>');
  await tippe('#edExport', { nachher: 900 });
  await warteAuf('.dlg [data-m="fest"]');
  await text('Fest, <b>ausfüllbar</b>, leere Vorlage oder als Webseite');
  const opt = ['fest', 'ausfuellbar', 'vorlage', 'html'];
  for (const m of opt) { const r = await rect(`.dlg [data-m="${m}"]`); await page.evaluate(([x, y]) => B.handZu(x, y, 450), [r.x + r.w * 0.2, r.y + r.h * 0.62]); await warte(500); }
  await tippe('.dlg [data-m="fest"]', { nachher: 1200 });
  for (let i = 0; i < 4 && await app.$('.dlg'); i++) { await page.keyboard.press('Escape'); await warte(250); }
  await text('Oder direkt <b>teilen</b> — per Mail, Messenger, Cloud');
  await tippe('#edTeilen', { nachher: 500 });
  await app.waitForFunction(() => window.__geteilt && window.__geteilt.length > 0, null, { timeout: 20000 });
  await page.evaluate(() => B.handWeg());
  await warte(1500);
}

const ZIEL_UE = SPRACHE === 'ru' ? 'ru' : 'en';   // die russische Fassung übersetzt ins Russische
async function szeneUebersetzen() {
  await kapitel('5', 'Übersetzen');
  await text('Formular in fremder Sprache? <b>Übersetzen — mit Aufbau</b>');
  await zurBibliothek();
  await app.evaluate(() => { window.__wfpdf.S.aktOrdner = 'alle'; window.__wfpdf.suche.zeichneBibliothek(); });
  await warte(300);
  await tippe('#ordnerAktionen [data-ueb]', { nachher: 700 });
  await app.waitForSelector('.dlg [data-dok]', { timeout: 60000 });
  // nur das eben ausgefüllte Formular übersetzen: anhaken bzw. die anderen abwählen
  const umschalten = await app.evaluate(() => [...document.querySelectorAll('.dlg [data-dok]')]
    .filter(c => c.checked !== /Amtsformular/.test(c.parentNode.textContent)).map(c => c.dataset.dok));
  for (const id of umschalten) await tippe(`.dlg [data-dok="${id}"]`, { nachher: 250 });
  await app.waitForSelector('.dlg [data-weg="browser"]:not([disabled])', { timeout: 60000 });
  await tippe('.dlg [data-nach]', { nachher: 200 });
  await app.selectOption('.dlg [data-nach]', ZIEL_UE);
  await warte(400);
  if (await app.isChecked('.dlg [data-rueck]')) await tippe('.dlg [data-rueck]', { nachher: 200 });
  // Klaus 2026-09-28: das Video soll zeigen, dass die Übersetzung im Chrome-Browser die gute ist
  await text('Tipp: Dokumente am besten im <b>Chrome-Browser</b> übersetzen');
  if (await app.$('.dlg [data-weg="chrome"]')) {
    await insBild('.dlg [data-weg="chrome"]');
    const rc = await rect('.dlg [data-weg="chrome"]');
    await page.evaluate(([x, y]) => B.handZu(x, y), [rc.x + rc.w * 0.3, rc.y + rc.h * 0.6]);
  }
  await warte(2600);
  await text('Deutsch · English · Русский — <b>auf dem Gerät</b>');
  await tippe('.dlg [data-weg="browser"]', { nachher: 300 });
  await page.evaluate(() => B.handWeg());
  await app.waitForSelector('.dlg [data-oeffne]', { timeout: 90000 });
  await warte(700);
  await tippe('.dlg [data-oeffne]', { nachher: 300 });
  await app.waitForSelector('#sc-ed.on .seite canvas', { timeout: 60000 });
  await page.evaluate(() => B.handWeg());
  await warte(800);
  const r = await rect('.seite[data-i="0"]');
  await text('Gleiches Blatt, <b>neue Sprache</b> — die Felder kommen mit');
  await page.evaluate(r => B.zoom({ x: r.x, y: r.y, w: r.w, h: r.h * 0.45 }, 1.5), r);
  await warte(3000);
  await page.evaluate(() => B.zoom(null));
  await warte(900);
  await text('Auf Englisch ausfüllen — <b>Einträge zurück ins deutsche Original</b>');
  await tippe(await feld(/^(Main residence|Hauptwohnsitz|Основное место жительства)/), { nachher: 400 });
  await tippe('#edExport', { nachher: 700 });
  await tippe('.dlg [data-rueckweg]', { nachher: 300 });
  await app.waitForSelector('.dlg [data-weg="browser"]:not([disabled])', { timeout: 30000 });
  await tippe('.dlg [data-weg="browser"]', { nachher: 300 });
  await page.evaluate(() => B.handWeg());
  await app.waitForFunction(() => window.__wfpdfRueckweg, null, { timeout: 60000 });
  await app.waitForSelector('#sc-ed.on .seite canvas', { timeout: 60000 });
  await warte(2200);
}

async function szeneSuchen() {
  await kapitel('6', 'Suchen');
  await text('Wo war das nochmal? <b>Einfach fragen</b>');
  await zurBibliothek();
  await app.waitForFunction(() => window.__wfpdf.S.docs.every(d => window.__wfpdf.suche.TEXTE.has(d.id)), null, { timeout: 60000 }).catch(() => {});
  await tippe('#bibMic', { nachher: 300 });
  await page.evaluate(() => B.handWeg());
  await app.evaluate(() => window.__ereignis('speechstart'));
  for (const t of ['Park', 'Parkaus', 'Parkausweis', 'Parkausweis Gebühr']) { await app.evaluate(t => window.__sag(t, false), t); await warte(380); }
  await app.evaluate(() => { window.__sag('Parkausweis Gebühr', true); window.__ereignis('speechend'); });
  await text('Die App zeigt, <b>wo es steht</b>');
  await app.waitForSelector('#dokGitter .dok [data-fundzeilen]', { timeout: 15000 });
  await warte(1800);
  await tippe('#dokGitter .dok [data-fundzeilen]', { nachher: 300 });
  await app.waitForSelector('#sc-ed.on .seite .fund', { timeout: 30000 });
  await page.evaluate(() => B.handWeg());
  await warte(600);
  await insBild('#sc-ed .seite .fund');
  const f = await rect('#sc-ed .seite .fund');
  await page.evaluate(f => B.zoom(f, 2.2), f);
  await warte(2600);
  await page.evaluate(() => B.zoom(null));
  await warte(900);
}

async function szeneOrdnen() {
  await kapitel('7', 'Ordnen');
  await text('Ordnung mit <b>einem Handgriff</b>');
  await zurBibliothek();
  await app.evaluate(() => { const s = document.getElementById('bibSuche'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); window.__wfpdf.S.aktOrdner = 'alle'; window.__wfpdf.suche.zeichneBibliothek(); });
  await warte(600);
  await tippe('.ordner-chip[data-neu]', { nachher: 500 });
  await warteAuf('.dlg [data-e]');
  for (const z of L('Anträge')) { await page.keyboard.type(z); await warte(45); }
  await tippe('.dlg [data-j]', { nachher: 600 });
  await tippe('.ordner-chip[data-o="alle"]', { nachher: 600 });
  await text('Mehrere wählen — und <b>auf den Ordner ziehen</b>');
  const a = await dok(/^(?!Beispiel-Amtsformular)/), b = await dok(/^Beispiel-Amtsformular-Bewohnerparkausweis$/);
  await tippe(a + ' [data-haken]', { nachher: 300 });
  await tippe(b + ' [data-haken]', { nachher: 400 });
  const ziel = await app.evaluate(n => window.__wfpdf.S.ordner.find(o => o.name === n).id, L('Anträge'));
  // Karte und Ordner müssen zugleich zu sehen sein: erst ganz nach oben, Ziel erst DANACH messen
  await app.evaluate(z => { window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelector(`.ordner-chip[data-o="${z}"]`).scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }, ziel);
  await warte(900);
  await zieheZu(b + ' .dok-bild', `.ordner-chip[data-o="${ziel}"]`);
  await page.evaluate(() => B.handWeg());
  await warte(700);
  await text('Sortieren — auch nach <b>Erstellungsdatum</b>');
  await tippe('[data-sortbox] summary', { nachher: 400 });
  await tippe('[data-sortbox] [data-sort]', { nachher: 200 });
  await app.selectOption('[data-sortbox] [data-sort]', 'erstellt');
  // „Erstellungsdatum" öffnet sofort den Kalender (natives Fenster). Offen gelassen,
  // hängt die Bildaufnahme danach: Diaschau und Schluss kamen unscharf oder gar nicht an.
  await warte(600);
  await page.keyboard.press('Escape');
  await app.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  await page.keyboard.press('Escape');
  await page.evaluate(() => B.handWeg());
  await warte(2200);
}

const FOLIEN = [
  ['🗣️', 'Vier Sprachen', 'Deutsch · English · Русский · العربية', 'wisch'],
  ['🧠', 'Suche nach Bedeutung', 'findet auch, was ganz anders formuliert ist', 'schieben'],
  ['📚', 'Dicke Handbücher', 'in Teile zerlegen und Stück für Stück übersetzen', 'blaettern'],
  ['🎨', 'Mit ChatGPT übersetzen', 'Foto hin, fertiges Bild zurück — ein Tipp', 'wischHoch'],
  ['💾', 'Arbeitsstand sichern', 'läuft offline · deine Daten bleiben auf dem Gerät', 'iris'],
];
async function szeneDiaschau() {
  await text('');
  await kapitel('8', 'Und noch mehr');
  for (let i = 0; i < FOLIEN.length; i++) {
    const [sym, t, u, art] = FOLIEN[i];
    if (process.env.DIAG) {
      setTimeout(async () => {
        try {
          const d = await page.evaluate(() => { const k = document.getElementById('karte'), c = getComputedStyle(k);
            const r = k.getBoundingClientRect();
            const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { vis: c.visibility, op: c.opacity, fil: c.filter, tr: c.transform, clip: c.clipPath, z: c.zIndex,
              anim: k.getAnimations().map(a => a.playState + ':' + a.currentTime), oben: oben && (oben.id || oben.className || oben.tagName),
              alle: document.getAnimations().length };
          });
          console.log('DIAG', i, JSON.stringify(d));
          await page.screenshot({ path: `/tmp/claude-0/-home-user/bae2be67-8dce-51e3-98b6-cdd958b627d8/scratchpad/diag${i}.jpg`, type: 'jpeg', quality: 60 });
        } catch (e) { console.log('DIAG-Fehler', e.message); }
      }, 1500);
    }
    await karte(`<div class="sym auf">${sym}</div><h1 class="auf">${L(t)}</h1><p class="auf">${L(u)}</p><div class="zaehler">${i + 1} / ${FOLIEN.length}</div>`, art, null, 1900, 'folie');
  }
  await kartenWeg('blende');
}

async function szeneSchluss() {
  await text('');
  await kapitel('', '');
  await karte(`<div class="floh winkt"></div><h1 class="auf">Workfloh <span>PDF</span></h1>
    <p class="auf">${L('kostenlos · ohne Konto · deine Daten bleiben auf dem Gerät')}</p>
    <div class="adresse auf">lausiklauskn-png.github.io/Workflow-PDF</div>`, 'irisMitte', null, 3500);
}

// ── Hochkant (etwa 30 s): dieselben Handgriffe, gekürzt; Wartezeiten laufen im Zeitraffer ──
// tempo(f): ab hier läuft das Video f-mal so schnell (schnitt.mjs rechnet die Zeiten um).
const tempi = [];
const tempo = f => { tempi.push({ t: Date.now() / 1000, f }); };
async function hochAnfang() { tempo(1); await karte(ANFANG, 'blende', null, 800); await kartenWeg('fliessen'); }
async function hochScannen() {
  tempo(1);
  await kapitel('1', 'Scannen');
  await text('Ein Formular auf Papier? <b>Einfach fotografieren.</b>');
  await tippe('#btnScan', { nachher: 500 });
  tempo(4.5);
  await warteAuf('.scan [data-kamera]');
  const [wahl] = await Promise.all([page.waitForEvent('filechooser'), tippe('.scan [data-kamera]', { nachher: 200 })]);
  await wahl.setFiles(FOTO);
  await page.evaluate(() => B.handWeg());
  await app.waitForFunction(() => window.__wfpdfScan && window.__wfpdfScan.seiten[0] && window.__wfpdfScan.seiten[0].erkennung, null, { timeout: 90000 });
  await warte(900);
  await tippe('.scan .scan-weiter', { nachher: 600 });
  await warteAuf('.scan [data-ergebnis]');
  await tippe('.scan [data-filter="dokument"]', { nachher: 300 });
  await page.evaluate(() => B.handWeg());
  tempo(1);
  await text('Ein Tipp — und das Foto ist ein <b>sauberes PDF</b>');
  await warte(1300);
  tempo(3);
  await tippe('.scan [data-fertig]', { nachher: 300 });
  await app.waitForSelector('#sc-ed.on .seite canvas', { timeout: 60000 });
  await page.evaluate(() => B.handWeg());
  await warte(900);
}
async function hochFelder() {
  tempo(1);
  await kapitel('2', 'Ausfüllen');
  await text('Die App <b>findet die Felder</b> — ohne Internet');
  tempo(3.5);
  if (await app.$('#sc-ed.on')) await tippe('#edZurueck', { nachher: 500 });
  await app.waitForSelector('#sc-bib.on');
  const [wahl] = await Promise.all([page.waitForEvent('filechooser'), tippe('.import-leiste label:has(#inDatei)', { nachher: 200 })]);
  await wahl.setFiles(FORM);
  await page.evaluate(() => B.handWeg());
  await app.waitForSelector('#sc-ed.on .seite canvas', { timeout: 60000 });
  await tippe('#edErkennen', { nachher: 500 });
  await tippe('.dlg [data-off]', { nachher: 300 });
  await page.evaluate(() => B.handWeg());
  await app.waitForFunction(() => window.__wfpdf.S.doc.fields.some(f => !f.geprueft), null, { timeout: 60000 });
  await app.waitForFunction(() => !document.querySelector('.fortschritt'));
  tempo(1);
  await warte(1500);
  tempo(4);
  await tippe('#vorschlagBand [data-alle]', { nachher: 700 });
  await text('Jetzt <b>ausfüllen</b>');
  await tippe('#mAusfuellen', { nachher: 600 });
  await tippeText((await feld(/^Familienname/)) + ' input', 'Musterfrau');
  await tippeText((await feld(/^Vorname/)) + ' input', 'Erika');
  await app.evaluate(() => document.activeElement && document.activeElement.blur());
  await tippe(await kaestchen(/^Hauptwohnsitz/, 0), { nachher: 400 });
  await page.evaluate(() => B.handWeg());
  tempo(1);
  await warte(1200);
}
async function hochUebersetzen() {
  tempo(1);
  await kapitel('3', 'Übersetzen');
  await text('Formular in fremder Sprache? <b>Übersetzen — mit Aufbau</b>');
  tempo(6);
  await zurBibliothek();
  await app.evaluate(() => { window.__wfpdf.S.aktOrdner = 'alle'; window.__wfpdf.suche.zeichneBibliothek(); });
  await tippe('#ordnerAktionen [data-ueb]', { nachher: 500 });
  await app.waitForSelector('.dlg [data-dok]', { timeout: 60000 });
  const umschalten = await app.evaluate(() => [...document.querySelectorAll('.dlg [data-dok]')]
    .filter(c => c.checked !== /Amtsformular/.test(c.parentNode.textContent)).map(c => c.dataset.dok));
  for (const id of umschalten) await tippe(`.dlg [data-dok="${id}"]`, { nachher: 200 });
  await app.waitForSelector('.dlg [data-weg="browser"]:not([disabled])', { timeout: 60000 });
  await tippe('.dlg [data-nach]', { nachher: 200 });
  await app.selectOption('.dlg [data-nach]', ZIEL_UE);
  if (await app.isChecked('.dlg [data-rueck]')) await tippe('.dlg [data-rueck]', { nachher: 200 });
  await tippe('.dlg [data-weg="browser"]', { nachher: 300 });
  await page.evaluate(() => B.handWeg());
  await app.waitForSelector('.dlg [data-oeffne]', { timeout: 90000 });
  await tippe('.dlg [data-oeffne]', { nachher: 300 });
  await app.waitForSelector('#sc-ed.on .seite canvas', { timeout: 60000 });
  await page.evaluate(() => B.handWeg());
  tempo(1);
  await text('Gleiches Blatt, <b>neue Sprache</b> — die Felder kommen mit');
  await warte(500);
  const r = await rect('.seite[data-i="0"]');
  await kapitel('', '');                                 // hochkant: die Plakette stünde sonst mitten in der vergrößerten App
  await page.evaluate(r => B.zoom({ x: r.x, y: r.y, w: r.w, h: r.h * 0.4 }, 1.6), r);
  await warte(3000);
  await page.evaluate(() => B.zoom(null));
  await kapitel('3', 'Übersetzen');
  await warte(700);
}
async function hochSchluss() { tempo(1); await szeneSchluss(); }

// ── Lauf ──
const klickBasis = await t0();
await start();
const beginn = Date.now();
const szenen = [];   // Start je Szene (Sekunden seit 1970) → Kapitel-Knöpfe der Seite
try {
  const NUR = (process.argv.find(a => a.startsWith('--nur=')) || '').slice(6).split(',').filter(Boolean);
  const SZENEN = { anfang: szeneAnfang, scannen: szeneScannen, einlesen: szeneEinlesen, ausfuellen: szeneAusfuellen,
    ausgeben: szeneAusgeben, uebersetzen: szeneUebersetzen, suchen: szeneSuchen, ordnen: szeneOrdnen,
    diaschau: szeneDiaschau, schluss: szeneSchluss };
  Object.assign(SZENEN, { hochAnfang, hochScannen, hochFelder, hochUebersetzen, hochSchluss });
  const HOCH = ['hochAnfang', 'hochScannen', 'hochFelder', 'hochUebersetzen', 'hochSchluss'];
  const folge = NUR.length ? NUR : probe ? ['anfang', 'scannen', 'schluss'] : hoch ? HOCH : Object.keys(SZENEN).filter(n => !n.startsWith('hoch'));
  for (const n of folge) { const t = Date.now(); szenen.push({ n, t: t / 1000 }); await SZENEN[n](); console.log(`  ${n}: ${((Date.now() - t) / 1000).toFixed(1)} s`); }
} catch (e) { console.error('Drehbuch abgebrochen:', e); }
await warte(400);
await stop();
const klicks = await page.evaluate(() => (window.__klicks || []).map(k => performance.timeOrigin + k));
fs.writeFileSync(path.join(ZIEL, 'zeiten.json'), JSON.stringify({ W, H, bilder, klicks: klicks.map(k => k / 1000), szenen, tempi, beginn: klickBasis / 1000 }, null, 1));
console.log(`${NAME}: ${bilder.length} Bilder in ${((Date.now() - beginn) / 1000).toFixed(1)} s, ${klicks.length} Klicks → ${ZIEL}`);
await browser.close(); srv.close();
