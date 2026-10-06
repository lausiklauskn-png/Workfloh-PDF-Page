# Workfloh PDF · Landingpage — Sitzungs-Anker

Landingpage mit Erklärvideo für die App **Workfloh PDF** (Repo `Workflow-PDF`).
Hier liegt **nicht** die App — wer an der App baut, ist im falschen Repo.

**Zuerst lesen:** [`docs/PLAN_VIDEO.md`](docs/PLAN_VIDEO.md) — was entsteht,
Ablauf, Bauweise, benannte Grenzen.

## Was hier leicht kaputtgeht

- **Die Musik liegt NICHT im Repo.** Pixabay erlaubt sie im Video, aber nicht
  als Datei zum Weitergeben. Das Skript liest sie aus `MUSIK=…`. Kein `*.mp3`
  committen (`.gitignore` sperrt es).
- **Das Video wird gebaut, nicht von Hand geschnitten.** Ändert sich die App:
  `node video/aufnahme.mjs`, dann `node video/schnitt.mjs`. Die App kommt aus
  dem Nachbar-Klon `../Workflow-PDF`, **Stand `origin/main`**.
- **Die Übersetzung im Video ist von Hand geschrieben** (Chromes Übersetzer
  läuft headless nicht). Klaus hat das so entschieden (2026-09-28).
- **Cache-Bump:** `CACHE_VERSION` in `sw.js` erhöhen, wenn eine Datei aus
  `CORE` sich ändert — auch Poster und `kapitel-*.json` nach einem neuen
  Video. Die MP4s liegen bewusst nicht im Vorrat.
- **Drei Sprachen:** wer das Drehbuch ändert, baut alle drei Videos neu
  (`--sprache=de|en|ru`); ein neuer Satz im Band braucht einen Eintrag in
  `video/texte.json`, sonst meldet die Aufnahme „[ohne Übersetzung]“.
- **Die 30-Sekunden-Kurzfassung ist von der Seite genommen** (Klaus 2026-09-28: „zu kurz und sagt zu wenig
  aus"). Unter dem großen Video steht jetzt das GANZE Video hochkant (`#kurz`: schmal, mittig, Text darunter,
  Quelle `workfloh-pdf-hochvoll*.mp4`). `aufnahme.mjs --hoch` gibt es noch; die Dateien liegen nicht mehr im Repo.
- **Jede Erklärkarte trägt ein Bild aus der App, hochkant** (`assets/bilder/<de|en|ru>-<thema>.jpg`, 540×760,
  wechselt mit der Sprache). Sieben sind Standbilder aus `workfloh-pdf-hochvoll*.mp4` (Sekunde 18 · 54 · 78 ·
  104 · 120 · 162 · 186, `crop=1080:1520:0:120,scale=540:-2`), „Hilfe" ist ein Bildschirmfoto des Hilfe-Dialogs.
  **Wer das Hochformat-Video neu schneidet, zieht die Bilder mit** — sonst zeigen sie eine alte App.
- **Hochkant GANZ (`hochvoll`, Klaus 2026-09-28): „beim Drehen da weitermachen, wo das Querformat aufgehört
  hat, ohne Verzögerung".** `aufnahme.mjs --voll` nimmt dieselben Szenen wie quer hochkant auf;
  `schnitt.mjs hochvoll[-en|-ru]` bringt jede Szene auf die Länge derselben Szene im Querformat (braucht
  `_roh/quer*`). Gleiche Sekunden, gleiche Kapitel, gleiche Musik. Die Bühne (und das Erklärvideo der App)
  zeigt hochkant `workfloh-pdf-hochvoll*.mp4`, quer das Querformat; nach dem Start lädt die andere Lage
  verborgen und stumm mit, Drehen schaltet nur um. Wer das Querformat neu aufnimmt, schneidet `hochvoll`
  NEU, sonst stimmen die Sekunden nicht mehr. `tests/seite.mjs` 5b misst „an derselben Stelle".
  Innerhalb einer Szene ist der Ablauf hochkant etwas anders getaktet — gleich sind die Szenengrenzen.
- **Das Test-Foto (`video/foto-tisch.html`) muss alle vier Blattecken im Bild haben** (Klaus 2026-09-28: das
  Ergebnis stand schief). Vorher lag die linke untere Ecke außerhalb des Fotos (y 1245 bei 1200 px), die App
  setzte sie an den Rand, und das Ergebnis kippte; der Stift lag auf dem Blatt und kam als schwarzer Strich mit.
  Jetzt: Blatt 640 px, Stift links auf dem Tisch. Die Aufnahme druckt die erkannten Ecken
  („Erkannte Ecken: …"); gemessen weichen sie höchstens ~8 px von den wahren ab.
- **Die App verlinkt direkt auf die Videos** (Workflow PDF, Hilfe → 🎬 Erklärvideo, seit 2026-09-28):
  `assets/workfloh-pdf-quer{,-en,-ru}.mp4` und `assets/poster-{de,en,ru}.jpg`. **Wer eine dieser Dateien
  umbenennt oder verschiebt, bricht den Knopf in der App** (auch `workfloh-pdf-hochvoll*.mp4` und `poster-hochvoll-*.jpg`) — dort `videoFuer()` in `assets/app.js` und
  `tests/video.mjs` mitziehen. Die App zeigt dann nur den Satz „braucht Internet", keinen Fehler.
- **Auch die zwei Marktplätze betten die Videos ein** (seit 2026-09-28, Brief `docs/BRIEF_marktplaetze.md`):
  PWA Toolpoint und family-projekt.de zeigen auf der Detailseite `apps/eigen-workflow-pdf/` das Erklärvideo aus
  `assets/workfloh-pdf-quer.mp4`, hochkant `assets/workfloh-pdf-hochvoll.mp4`, Vorschaubild `assets/poster-de.jpg`.
  **Wer diese Dateien umbenennt, zieht dort das Feld `video` in `assets/config/listings.js` nach** (beide Depots) —
  sonst steht auf den Marktplätzen ein Video, das nicht lädt. Kopiert wird nichts.
- Ladezeit-Regeln: Skill `seiten-bauregeln`. Beide Videos laden erst beim Antippen.
- **🛡 Angeheftet: „Versteckte Befehle erkennen" (Klaus 2026-10-06: „ein zweites Video anheften … Wow-Effekt …
  Graphic Motion … mit Musikuntermalung" · „deutlich zu erkennen, welche Methoden die Gangster anwenden" · „so lange
  wie die Musik … wie der Befehl hineinkommt in die Datei und dann eine KI dazu veranlasst, falsche Befehle auszuführen").**
  Kein Mitschnitt der App, sondern Bewegungsgrafik: `video/neu-befehle.html` zeichnet jedes Bild auf einem Canvas
  (`render(t)`, ohne Uhr und ohne Zufall), `node video/neu-befehle.mjs --alle` fotografiert Bild für Bild (30 fps,
  **72,5 s = so lang wie die Musik**) und legt `assets/neu-befehle-{quer,hoch}[-en|-ru].mp4`,
  `assets/poster-neu-befehle-<lage>-<sprache>.jpg` und `assets/kapitel-neu-befehle.json` ab (System-ffmpeg).
  Ablauf, auf die gemessenen Höhepunkte der Musik gelegt (16 s und 48 s): Titel · der Täter (Kapuze, Gaunermaske)
  tippt den Befehl in eine Rechnung und macht ihn weiß und winzig · die Datei kommt per E-Mail, man gibt sie einer
  KI · **die KI gehorcht** und schickt die Dateien weg · Trick 1/2/3 (je erst „TRICK" mit Werkzeugkasten des Täters,
  dann „ERKANNT": weiß auf weiß · blass im Foto mit Kontrast-Spreizung wie `kontrastStrecken` · Bits in den
  Bildpunkten wie die LSB-Prüfung) · **mit Workfloh PDF fällt es auf** · Überblick mit den weiteren Funden
  (außerhalb der Seite, Bild-Metadaten, unsichtbare Zeichen, Datei im PDF — alle in `pruefer-anhang.js` gemeldet) · Schluss.
  Die Zeiten stehen EINMAL oben in `neu-befehle.html` (`ZT`, `ZK`, `Z1` …); Geräusche (`TOENE`) und Kapitel
  (`KAPITEL`) werden daraus gerechnet. **Die App trägt die Kapitel-Sekunden als `KAPITEL_NEU` in `assets/app.js`
  — wer hier die Zeiten schiebt, zieht dort nach.**
  **Musik:** „Risk" von studiokolomna (Pixabay, Audio-ID 136788, Lizenz-Beleg bei Klaus). Darf im Video laufen, die
  Datei wird nicht weitergegeben — `MUSIK=/pfad/risk.mp3 node video/neu-befehle.mjs --alle`. Ohne `MUSIK` nur
  Geräusche, und die Ausgabe sagt das. Genannt im Impressum und unter dem Video.
  `--behalten` lässt die Einzelbilder in `video/_roh/`, dann baut `--nur-schnitt` nur den Ton neu (Sekunden statt Minuten).
  **Die App verlinkt die sechs Dateien** (Erklärvideo-Dialog: Knopf „▶ Neu: Versteckte Befehle" mit 7 Kapiteln, und
  nach dem Ende des Erklärvideos läuft der Film von selbst) — umbenennen bricht dort `videoFuer(…, 'neu')`.
  Auf dieser Seite: Abschnitt `#neu` unter dem großen Video, erst auf Tipp, hochkant die Hochformat-Fassung, Kapitel darunter.
  ⚠ Nicht gemessen: wie es am Tablet wirkt (Tempo, Lesbarkeit der kleinen Schrift hochkant) — Klaus' Sichttest.

## Prüfen

```bash
node tests/seite.mjs    # Seite im echten Browser: Sprachen, Kapitel, Handy, Rechtliches
```

⚠ Chromium aus Playwright kann kein H.264. Für den Kapitel-Sprung liefert die
Probe einen WebM-Stellvertreter gleicher Länge — gemessen wird die Seite, nicht
das Video. Ob das MP4 spielt, sieht man im echten Chrome (Klaus' Sichttest).

## Netzweit

Freibrief zum Selbst-Mergen · frisch von `origin/main` vor jeder Arbeit · Ton ·
kein PII · Ehrlichkeit:
**[`Sage-Protokol/docs/NETZWEIT.md`](https://github.com/lausiklauskn-png/Sage-Protokol/blob/main/docs/NETZWEIT.md)**

```bash
git fetch origin --quiet && git checkout -B <branch> origin/main
git push -u origin refs/heads/<branch>:refs/heads/<branch>
git diff --stat origin/main origin/<branch>     # leer = der PR wäre leer
```
