// Zusatzfilm „Versteckte Befehle erkennen" (Klaus 2026-10-06) — wird an das Erklärvideo angehängt.
// Bewegungsgrafik aus video/neu-befehle.html, Bild für Bild fotografiert, dann mit ffmpeg zu H.264 + AAC.
//
//   node video/neu-befehle.mjs --lage=quer|hoch --sprache=de|en|ru          baut assets/neu-befehle-<lage>[-en|-ru].mp4
//   node video/neu-befehle.mjs --alle                                        alle sechs
//   node video/neu-befehle.mjs --standbilder                                 nur Standbilder nach video/_roh/neu-standbild/
//   MUSIK=/pfad/musik.mp3 [MUSIK_AB=sek] node video/neu-befehle.mjs …        mit Musik darunter (liegt NICHT im Repo)
//   Musik seit 2026-10-06: „Risk" von studiokolomna (Pixabay, Audio-ID 136788) — der Film ist so lang wie sie (72,5 s).
//
// Ohne MUSIK liegen nur die Geräusche darunter (Wusch beim Szenenwechsel, Strahl, Stempel) — und das sagt die Ausgabe.
// ffmpeg: das System-ffmpeg reicht (libx264 + aac); FFMPEG=… überstimmt.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.dirname(HIER);
const FF = process.env.FFMPEG || 'ffmpeg';
const FPS = 30;
const arg = (n) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : null; };
const hat = (n) => process.argv.includes('--' + n);

const AUFTRAEGE = hat('alle')
  ? ['quer', 'hoch'].flatMap(l => ['de', 'en', 'ru'].map(s => ({ lage: l, sprache: s })))
  : [{ lage: arg('lage') || 'quer', sprache: arg('sprache') || 'de' }];
for (const a of AUFTRAEGE) {
  if (!['quer', 'hoch'].includes(a.lage) || !['de', 'en', 'ru'].includes(a.sprache)) { console.error('unbekannt:', a); process.exit(2); }
}
const MUSIK = process.env.MUSIK || null;
if (MUSIK && !fs.existsSync(MUSIK)) { console.error('MUSIK zeigt auf keine Datei:', MUSIK); process.exit(2); }

const browser = await chromium.launch();
try {
  for (const { lage, sprache } of AUFTRAEGE) {
    const [w, h] = lage === 'hoch' ? [1080, 1920] : [1920, 1080];
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const url = pathToFileURL(path.join(HIER, 'neu-befehle.html')).href + `?lage=${lage}&sprache=${sprache}`;
    await page.goto(url);
    await page.evaluate(() => window.bereit);
    const { dauer, schnitte, toene, kapitel } = await page.evaluate(() => ({ dauer: window.DAUER, schnitte: window.SCHNITTE, toene: window.TOENE, kapitel: window.KAPITEL }));
    fs.writeFileSync(path.join(WURZEL, 'assets', 'kapitel-neu-befehle.json'), JSON.stringify(kapitel.map(k => ({ n: k.n, t: Math.round(k.t * 10) / 10 }))));
    const roh = path.join(HIER, '_roh', hat('standbilder') ? 'neu-standbild' : `neu-${lage}-${sprache}`);
    const nurSchnitt = hat('nur-schnitt') && fs.existsSync(path.join(roh, 'b00000.jpg'));   // Bilder vom letzten Lauf wiederverwenden
    if (!nurSchnitt) { fs.rmSync(roh, { recursive: true, force: true }); fs.mkdirSync(roh, { recursive: true }); }

    const zeiten = hat('standbilder') ? (process.env.ZEITEN || '2.6,7.5,9.8,13.5,15.5,18.5,20.5,23.5,27.5,29,31.5,36,40,44.5,46.5,50,53.5,58.5,60.5,67').split(',').map(Number) : Array.from({ length: Math.round(dauer * FPS) }, (_, i) => i / FPS);
    const t0 = Date.now();
    for (let i = 0; i < (nurSchnitt ? 0 : zeiten.length); i++) {
      await page.evaluate(t => window.render(t), zeiten[i]);
      const name = hat('standbilder') ? `${lage}-${sprache}-${String(zeiten[i]).replace('.', '_')}.jpg` : `b${String(i).padStart(5, '0')}.jpg`;
      await page.screenshot({ path: path.join(roh, name), type: 'jpeg', quality: 92 });
    }
    await page.close();
    console.log(`${lage}/${sprache}: ${zeiten.length} Bilder in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${roh}`);
    if (hat('standbilder')) continue;

    // ── Ton: Geräusche aus ffmpeg-Generatoren, zeitgenau gesetzt ──
    // Wusch an jedem Szenenwechsel, ein Strahl-Ton beim Scannen, ein Schlag bei jedem Stempel, Plopp bei den Chips.
    const { stempel, plopp, strahl, tippen } = toene;   // Zeitpunkte aus der Szene selbst (window.TOENE)
    const quellen = [], filter = [];
    let n = 1;   // Eingang 0 sind die Bilder
    const marken = [];
    const setze = (src, t, vol) => { quellen.push('-f', 'lavfi', '-i', src); filter.push(`[${n}:a]volume=${vol},adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)}[s${n}]`); marken.push(`[s${n}]`); n++; };
    for (const t of schnitte) setze('anoisesrc=d=0.7:c=pink:a=0.6,highpass=f=300,lowpass=f=4000,afade=t=in:d=0.35,afade=t=out:st=0.35:d=0.35,aformat=channel_layouts=stereo', Math.max(0, t - .35), 0.55);
    for (const t of stempel) setze('sine=f=70:d=0.35,afade=t=out:d=0.35,aformat=channel_layouts=stereo', t, 1.4), setze('anoisesrc=d=0.06:c=white:a=0.5,afade=t=out:d=0.06,aformat=channel_layouts=stereo', t, 0.5);
    for (const t of plopp) setze("aevalsrc='0.6*sin(2*PI*(600+900*t)*t)*exp(-18*t)':d=0.25,aformat=channel_layouts=stereo", t, 0.6);
    for (const t of strahl) setze("aevalsrc='0.25*sin(2*PI*(300+500*t)*t)*(0.6+0.4*sin(2*PI*12*t))':d=2.2,afade=t=in:d=0.3,afade=t=out:st=1.7:d=0.5,aformat=channel_layouts=stereo", t, 0.35);
    for (const t of tippen) for (let k = 0; k < 9; k++) setze("aevalsrc='0.4*sin(2*PI*2400*t)*exp(-90*t)':d=0.05,aformat=channel_layouts=stereo", t + k * 0.11 + (k % 3) * 0.02, 0.5);
    let mixEin = marken.join('');
    let musikIdx = -1;
    if (MUSIK) { musikIdx = n; quellen.push('-stream_loop', '-1', '-ss', String(Number(process.env.MUSIK_AB || 0)), '-i', MUSIK); n++;
      filter.push(`[${musikIdx}:a]atrim=0:${dauer},asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,volume=0.9,afade=t=in:d=0.3,afade=t=out:st=${dauer - 2}:d=2[mu]`); mixEin += '[mu]'; }
    const anz = marken.length + (MUSIK ? 1 : 0);
    filter.push(`${mixEin}amix=inputs=${anz}:normalize=0:duration=longest,atrim=0:${dauer},alimiter=limit=0.9[ton]`);
    const ziel = path.join(WURZEL, 'assets', `neu-befehle-${lage}${sprache === 'de' ? '' : '-' + sprache}.mp4`);
    execFileSync(FF, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(roh, 'b%05d.jpg'), ...quellen,
      '-filter_complex', filter.join(';'), '-map', '0:v', '-map', '[ton]',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '160k', '-t', String(dauer), ziel], { stdio: 'inherit' });
    // Vorschaubild: das Titelbild bei 2,6 s
    const poster = path.join(WURZEL, 'assets', `poster-neu-befehle-${lage}-${sprache}.jpg`);
    execFileSync(FF, ['-y', '-loglevel', 'error', '-ss', '3.0', '-i', ziel, '-frames:v', '1', '-vf', lage === 'hoch' ? 'scale=540:-2' : 'scale=960:-2', '-q:v', '4', poster]);
    console.log(`→ ${path.relative(WURZEL, ziel)} (${(fs.statSync(ziel).size / 1e6).toFixed(1)} MB) · Ton: ${MUSIK ? 'Musik + Geräusche' : 'NUR Geräusche (MUSIK fehlt)'}`);
    if (!hat('behalten')) fs.rmSync(roh, { recursive: true, force: true });
  }
} finally { await browser.close(); }
