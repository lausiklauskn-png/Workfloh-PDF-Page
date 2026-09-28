// Setzt die Aufnahme zu einem MP4 zusammen: Einzelbilder mit ihren echten
// Zeitstempeln → gleichmäßige 30 fps, darunter Musik in Schleife (Ein- und Ausblende)
// und an jedem Klick ein kurzes Klick-Geräusch.
//
//   MUSIK=/pfad/friends.mp3 node video/schnitt.mjs probe|quer|hoch|hochvoll[-en|-ru] [--ab SEK]
//
// ffmpeg: die volle Fassung aus dem Python-Paket imageio-ffmpeg (H.264 + AAC).
// Playwrights eigenes ffmpeg kann nur VP8 ohne Ton.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const NAME = process.argv[2] || 'probe';
const abIdx = process.argv.indexOf('--ab');
const MUSIK_AB = abIdx > 0 ? Number(process.argv[abIdx + 1]) : 0;   // Einstieg in die Musik (Sekunden)
const ROH = path.join(HIER, '_roh', NAME);
const MUSIK = process.env.MUSIK;
if (!MUSIK || !fs.existsSync(MUSIK)) { console.error('MUSIK=/pfad/zur/datei.mp3 fehlt (liegt absichtlich nicht im Repo)'); process.exit(2); }
const FF = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();

const Z = JSON.parse(fs.readFileSync(path.join(ROH, 'zeiten.json'), 'utf8'));
const b = Z.bilder; if (b.length < 2) { console.error('keine Bilder'); process.exit(2); }
const t0 = b[0].t;
// Zeitraffer (Hochkant): tempi = [{t, f}] — ab t läuft das Video f-mal so schnell.
// v(t) rechnet eine echte Zeit in Videozeit um; ohne tempi ist v(t) = t - t0.
// Hochkant-GANZ (hochvoll, Klaus 2026-09-28: „beim Drehen dort weitermachen, wo das Querformat aufgehört hat"):
// jede Szene wird auf die Länge derselben Szene im Querformat gestreckt oder gestaucht. Dann liegt jede
// Szenengrenze bei derselben Sekunde, beide Videos sind gleich lang, und currentTime lässt sich 1:1 übergeben.
// Die Musik beginnt in beiden an derselben Stelle (MUSIK_AB) — auch der Ton läuft beim Drehen weiter.
if (/^hochvoll(-\w+)?$/.test(NAME)) {
  const Q = JSON.parse(fs.readFileSync(path.join(HIER, '_roh', NAME.replace('hochvoll', 'quer'), 'zeiten.json'), 'utf8'));
  const grenzen = (z, ende) => { const g = [z.bilder[0].t, ...z.szenen.map(s => s.t), ende]; return g.slice(1).map((t, i) => t - g[i]); };
  const hs = Z.szenen.map(s => s.n).join(','), qs = Q.szenen.map(s => s.n).join(',');
  if (hs !== qs) { console.error(`Szenen passen nicht zusammen:\n  hoch ${hs}\n  quer ${qs}`); process.exit(2); }
  const dh = grenzen(Z, b[b.length - 1].t), dq = grenzen(Q, Q.bilder[Q.bilder.length - 1].t);
  const anf = [b[0].t, ...Z.szenen.map(s => s.t)];
  // Der Vorlauf (erstes Bild bis erste Szene) ist oft NEGATIV (die Szene startet vor dem ersten Bild) — dann
  // gibt es ihn nicht, und sein Faktor darf nicht mitten in die erste Szene fallen (gemessen: sonst 0,77 s zu kurz).
  const liste = anf.map((t, i) => ({ t, f: dh[i] > 0.05 && dq[i] > 0.05 ? dh[i] / dq[i] : 1, n: i ? Z.szenen[i - 1].n : '(Vorlauf)', h: dh[i], q: dq[i] }));
  liste.forEach(x => console.log(`  ${x.n}: hoch ${x.h.toFixed(2)} s → quer ${x.q.toFixed(2)} s (×${x.f.toFixed(3)})`));
  Z.tempi = liste.filter((x, i) => i > 0 || (x.h > 0.05 && x.q > 0.05)).map(({ t, f }) => ({ t, f }));
}
const tempi = (Z.tempi || []).slice().sort((a, c) => a.t - c.t);
const faktorBei = t => { let f = 1; for (const x of tempi) if (x.t <= t) f = x.f; return f; };
function v(t) {
  let s = 0, von = t0, f = 1;
  for (const x of tempi) { if (x.t >= t) break; if (x.t > von) { s += (x.t - von) / f; von = x.t; } f = x.f; }
  return s + Math.max(0, t - von) / f;
}
const dauer = v(b[b.length - 1].t) + 0.04;

// 1 · Bildfolge mit echten Dauern (concat-Liste), danach fps=30
const liste = [];
for (let i = 0; i < b.length; i++) {
  const d = i + 1 < b.length ? v(b[i + 1].t) - v(b[i].t) : 0.04;
  liste.push(`file '${path.join(ROH, 'bilder', b[i].datei)}'`, `duration ${Math.max(0.001, d).toFixed(4)}`);
}
liste.push(`file '${path.join(ROH, 'bilder', b[b.length - 1].datei)}'`);
fs.writeFileSync(path.join(ROH, 'liste.txt'), liste.join('\n'));

// 2 · Klick-Geräusch (selbst erzeugt: kurzer Holz-„Tock"), 44,1 kHz mono
const RATE = 44100, n = Math.round(RATE * 0.07), pcm = Buffer.alloc(44 + n * 2);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + n * 2, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(RATE, 24); pcm.writeUInt32LE(RATE * 2, 28);
pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(n * 2, 40);
let saat = 7; const zufall = () => ((saat = (saat * 16807) % 2147483647) / 2147483647) * 2 - 1;
for (let i = 0; i < n; i++) {
  const t = i / RATE, huell = Math.exp(-t * 90);
  const v = (Math.sin(2 * Math.PI * 1650 * t) * 0.55 + Math.sin(2 * Math.PI * 820 * t) * 0.35 + zufall() * 0.25 * Math.exp(-t * 400)) * huell;
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 30000), 44 + i * 2);
}
const KLICK = path.join(ROH, 'klick.wav'); fs.writeFileSync(KLICK, pcm);

// Klicks im Zeitraffer fallen weg — dort würden sie rattern (hochvoll: alle bleiben, die Szenen sind nur angeglichen)
const klicks = (Z.klicks || []).filter(k => /^hochvoll/.test(NAME) || faktorBei(k) <= 1.5).map(k => v(k)).filter(k => k >= 0 && k < dauer);
const aus = NAME === 'probe' ? path.join(ROH, 'probe.mp4') : path.join(HIER, '..', 'assets', `workfloh-pdf-${NAME}.mp4`);
fs.mkdirSync(path.dirname(aus), { recursive: true });

// 3 · Ton: Musik (ab MUSIK_AB, 1 s Einblende, 2,5 s Ausblende) + Klicks
const eing = ['-f', 'concat', '-safe', '0', '-i', path.join(ROH, 'liste.txt'), '-stream_loop', '-1', '-ss', String(MUSIK_AB), '-i', MUSIK];   // Musik in Schleife (Klaus 2026-09-28): das Video wird nicht gekürzt
klicks.forEach(() => eing.push('-i', KLICK));
let fil = `[1:a]atrim=0:${dauer.toFixed(3)},asetpts=PTS-STARTPTS,volume=0.75,afade=t=in:d=1,afade=t=out:st=${Math.max(0, dauer - 2.5).toFixed(3)}:d=2.5[m]`;
const mix = ['[m]'];
klicks.forEach((k, i) => { fil += `;[${i + 2}:a]adelay=${Math.round(k * 1000)}|${Math.round(k * 1000)},volume=0.9[k${i}]`; mix.push(`[k${i}]`); });
fil += `;${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=first[a]`;
fil += `;[0:v]fps=30,format=yuv420p[v]`;

execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', ...eing, '-filter_complex', fil,
  '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-tune', 'animation',
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', dauer.toFixed(3), aus], { stdio: 'inherit' });
// 4 · Kapitel-Marken für die Seite (Sekunden im Video), nur wenn die Aufnahme sie trägt
if (/^quer(-\w+)?$/.test(NAME) && Z.szenen && Z.szenen.length) {   // hochkant hat keine Kapitel-Knöpfe
  const km = Z.szenen.map(s => ({ n: s.n, t: Math.max(0, +v(s.t).toFixed(1)) }));
  fs.writeFileSync(path.join(HIER, '..', 'assets', `kapitel-${NAME}.json`), JSON.stringify(km));
}
// 5 · Poster für die Seite: ein Bild aus der Titelkarte (2,5 s), 1280 px breit
if (/^quer(-\w+)?$/.test(NAME)) {
  const sp = NAME === 'quer' ? 'de' : NAME.slice(5);
  execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '2.5', '-i', aus, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '4',
    path.join(HIER, '..', 'assets', `poster-${sp}.jpg`)], { stdio: 'inherit' });
}
// Hochkant: Poster aus der Titelkarte (1,3 s), 720 px breit — es steht auch hochkant auf der großen Bühne (Tablet)
if (/^hoch(voll)?(-\w+)?$/.test(NAME)) {
  const sp = /^hoch(voll)?$/.test(NAME) ? 'de' : NAME.split('-')[1];
  execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '1.3', '-i', aus, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '4',
    path.join(HIER, '..', 'assets', `poster-${NAME.startsWith('hochvoll') ? 'hochvoll' : 'hoch'}-${sp}.jpg`)], { stdio: 'inherit' });
}
console.log(`${aus}: ${dauer.toFixed(1)} s, ${klicks.length} Klicks, ${(fs.statSync(aus).size / 1e6).toFixed(1)} MB`);
