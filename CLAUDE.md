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
- **Hochkant (Kurzfassung, ~31 s):** `aufnahme.mjs --hoch`, Zeitraffer über
  `tempo(f)`-Marken, die `schnitt.mjs` umrechnet. Wer das Drehbuch verlängert,
  prüft die Länge wieder gegen 30 s. `tests/seite.mjs` misst, dass Gerät und Band
  hochkant ganz im Bild liegen.
- **Hochkant GANZ (`hochvoll`, Klaus 2026-09-28): „beim Drehen da weitermachen, wo das Querformat aufgehört
  hat, ohne Verzögerung".** `aufnahme.mjs --voll` nimmt dieselben Szenen wie quer hochkant auf;
  `schnitt.mjs hochvoll[-en|-ru]` bringt jede Szene auf die Länge derselben Szene im Querformat (braucht
  `_roh/quer*`). Gleiche Sekunden, gleiche Kapitel, gleiche Musik. Die Bühne (und das Erklärvideo der App)
  zeigt hochkant `workfloh-pdf-hochvoll*.mp4`, quer das Querformat; nach dem Start lädt die andere Lage
  verborgen und stumm mit, Drehen schaltet nur um. Wer das Querformat neu aufnimmt, schneidet `hochvoll`
  NEU, sonst stimmen die Sekunden nicht mehr. `tests/seite.mjs` 5b misst „an derselben Stelle".
  Innerhalb einer Szene ist der Ablauf hochkant etwas anders getaktet — gleich sind die Szenengrenzen.
- **Die App verlinkt direkt auf die Videos** (Workflow PDF, Hilfe → 🎬 Erklärvideo, seit 2026-09-28):
  `assets/workfloh-pdf-quer{,-en,-ru}.mp4` und `assets/poster-{de,en,ru}.jpg`. **Wer eine dieser Dateien
  umbenennt oder verschiebt, bricht den Knopf in der App** (auch `workfloh-pdf-hochvoll*.mp4` und `poster-hochvoll-*.jpg`) — dort `videoFuer()` in `assets/app.js` und
  `tests/video.mjs` mitziehen. Die App zeigt dann nur den Satz „braucht Internet", keinen Fehler.
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
