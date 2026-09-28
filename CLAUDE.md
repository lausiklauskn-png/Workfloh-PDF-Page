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
