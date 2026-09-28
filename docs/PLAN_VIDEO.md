# Plan: Erklärvideo und Landingpage für Workfloh PDF

Stand 2026-09-28. Entschieden mit Klaus in der Plansitzung, bevor eine Zeile Code
geschrieben wurde.

## Was entsteht

| | |
|---|---|
| **Video quer** | 16:9, 1920×1080, 30 fps, so lang wie die Musik (2:28) |
| **Video hochkant** | 9:16, 1080×1920, etwa 30 s, fürs Handy (Status, WhatsApp) |
| **Ton** | Musik „Friends" (Pixabay, laut Dateiname von paulyudin), dazu Klick-Geräusche und leise Übergangs-Geräusche. **Keine Stimme** (Klaus: „eigentlich reicht Musik") |
| **Seite** | Landingpage als PWA, Video erst beim Antippen laden, Kapitel-Knöpfe, Impressum und Datenschutz |

## Was es anders macht als die Videos von Mein Rezeptbuch und Mixarium

Gemessen am 2026-09-28: beide alten Videos sind **stumm**, der Zeiger ist ein
oranger Punkt, und die Erklärkästen liegen **über** der App.

1. **Comic-Hand mit weißem Handschuh.** Gleitet weich (Kurve, nicht gerade),
   zeigt mit der Fingerspitze schräg von unten auf den Knopf und verdeckt ihn
   nicht. Beim Klick drückt sie kurz ein, dazu ein Ring und ein Klick-Geräusch.
2. **Nichts deckt die App ab.** Die App läuft in einem Tablet-Rahmen, die
   Erklärzeile steht in einem Band **unter** dem Rahmen.
3. **Musik und Geräusche.** Die Musik wird leiser, wenn etwas Wichtiges
   passiert, und am Schluss ausgeblendet.
4. **Heranzoomen** an den Stellen, auf die es ankommt (Felder erkannt, Text an
   derselben Stelle übersetzt), weich hinein und wieder heraus.
5. **Wechselnde Bildübergänge zwischen den Kapiteln** (Klaus: „einmal so, einmal
   so, wegfließende"):
   - Überblenden
   - Wischen von der Seite
   - Schieben (altes Bild fließt hinaus, neues hinein)
   - Kreis öffnet sich (Iris) um die Stelle der Hand
   - Seite umblättern
   - Durchflug (Zoom in den Knopf, der das nächste Kapitel öffnet)
   Kein Übergang zweimal hintereinander.
6. **Diaschau** für „Was sie noch kann": Bildschirmfotos der übrigen Funktionen
   ziehen langsam vorbei (Ken-Burns-Bewegung), jedes mit einem kurzen Titel.
7. **Vorher und nachher nebeneinander** beim Übersetzen und beim Scannen.
8. **Anfang und Schluss mit dem W-Floh**, Name, Adresse.
9. **Kapitel auf der Seite:** Knöpfe springen an die Stelle im Video.

## Ablauf (quer, 2:28)

| Zeit | Kapitel | Was die Hand tut |
|---|---|---|
| 0:00 | Anfang | W-Floh springt herein, Titel „Workfloh PDF — Formulare einfach erledigen" |
| 0:06 | 1 · Scannen | 📷 Scannen → Kamera → Foto des Formulars (schräg auf dem Tisch) → Ecken werden gefunden, eine Ecke nachziehen (Lupe) → Filter „Dokument" → drehen → Seitengröße → Texterkennung → **Kopie neben Original** → PDF erstellen |
| 0:32 | 2 · Einlesen | PDF / Bild einlesen → „ohne Internet erkennen" → Felder erscheinen (Zoom) |
| 0:46 | 3 · Ausfüllen | Namen tippen, Datum im Kalender, E-Mail wird zum Link, Kästchen ankreuzen, **Unterschrift** zeichnen, Feld verschieben/größer ziehen, Feldart ändern |
| 1:06 | 4 · Ausgeben | ⬇ Ausgeben: festes PDF · ausfüllbares PDF · leere Vorlage · HTML → 📤 Teilen |
| 1:16 | 5 · Übersetzen | Beispiel-Formular → Übersetzen DE → EN (und RU) → vorher/nachher nebeneinander, Text an derselben Stelle → ↩ Einträge zurück ins Original |
| 1:36 | 6 · Suchen | Suchfeld mit 🎤 Spracheingabe (Laufbalken) → Treffer mit Fundstelle gelb markiert → Suche nach Bedeutung |
| 1:50 | 7 · Ordnen | Mehrfachauswahl per langem Druck → auf einen Ordner ziehen → Sortieren (Erstellt von … bis) → Ordner ausgeben als ZIP / ein PDF |
| 2:02 | 8 · Diaschau „Was sie noch kann" | App-Sprachen DE/EN/RU/العربية · große Handbücher in Teilen übersetzen · Mit ChatGPT übersetzen · Arbeitsstand sichern · Handbuch und Beispiel-Formular · installierbar, läuft offline |
| 2:18 | Schluss | W-Floh winkt, Adresse, „kostenlos · ohne Konto · deine Daten bleiben auf dem Gerät" |

Die Zeiten sind der Plan. Die echte Aufnahme richtet sich nach der App; passt es
nicht auf die Musik, wird die Diaschau länger oder kürzer.

## Hochkant (30 s)

Anfang (2 s) → Scannen im Zeitraffer (8 s) → Felder erkannt und ausgefüllt
(8 s) → Übersetzen vorher/nachher (6 s) → Schluss mit Adresse (6 s). Die App
läuft dabei in Handy-Breite (412 px), damit die Handy-Ansicht der App zu sehen
ist. Musik: ein 30-s-Ausschnitt mit Aus-Blende.

## Wie es gebaut wird

- **Bühne** (`video/buehne.html`): eine Seite in Videogröße mit Hintergrund,
  Tablet-Rahmen, Erklärband und Hand. Die App läuft darin in einem `iframe`,
  vom selben lokalen Server, also greifbar. Zoom und Übergänge sind CSS auf der
  Bühne, deshalb flüssig.
- **Drehbuch** (`video/aufnahme.mjs`): Playwright bedient die **echte** App aus
  dem Nachbar-Klon `../Workflow-PDF` (Stand `origin/main`). Klicks sind echte
  Klicks, die Hand fährt vorher sichtbar hin. Jeder Klick wird mit Zeitpunkt
  notiert (für das Klick-Geräusch).
- **Aufnahme:** Einzelbilder über den Browser (CDP-Screencast, JPEG) mit
  Zeitstempel, danach mit gleichmäßigen 30 fps zusammengesetzt. Playwrights
  eigene Videoaufnahme kann nur VP8 und ruckelt.
- **Schnitt** (`video/schnitt.mjs`): `ffmpeg` (volle Fassung aus dem Paket
  `imageio-ffmpeg`, mit H.264 und AAC) legt Musik, Klicks und Blende darunter.
- **Foto** (`video/foto-bauen.mjs`): Seite 1 des Beispiel-Formulars mit pdf.js
  rendern, schräg auf eine Tischfläche legen, mit Schatten — als JPEG.
- **Übersetzung:** Der Übersetzer von Chrome läuft im ferngesteuerten Browser
  nicht (gemessen in Workflow-PDF). Die Sätze des Beispiel-Formulars werden
  **von Hand übersetzt** und als Stellvertreter eingespielt (Klaus'
  Entscheidung 2026-09-28). Das Ergebnis sieht aus wie in der App; es ist nicht
  live übersetzt.

## Stand nach dem Bau (2026-09-28)

- **Länge:** das Video ist **3:38–3:39** (seit 2026-09-28, vorher 3:44), nicht 2:28. Die Musik läuft in einer
  Schleife darunter, das Video wird dafür nicht gekürzt (Klaus: „nur die Musik
  wiederholen, nicht das Video").
- **Drei Sprachen:** `node video/aufnahme.mjs --sprache=de|en|ru`, dann
  `node video/schnitt.mjs quer|quer-en|quer-ru`. Band, Kapitel und Folien
  stehen in `video/texte.json` (deutscher Satz als Schlüssel), die
  App-Oberfläche wechselt über ihre eigene Spracheinstellung. Das
  RU-Video übersetzt das Formular nach Russisch, die anderen nach Englisch.
- **Chrome-Tipp:** im Kapitel Übersetzen zeigt die Hand auf „Mit Chrome
  übersetzen", das Band sagt: Dokumente am besten im Chrome-Browser übersetzen
  (Klaus' Erfahrung). Ein Vergleich mit Edge steht **nicht** im Video — er ist
  nicht gemessen.
- **Seite:** `index.html` mit Knöpfen DE · EN · RU (wechseln Video und
  Seitentext), Kapitel-Knöpfe aus `assets/kapitel-<name>.json` und Poster
  `assets/poster-<sprache>.jpg` — beides schreibt `schnitt.mjs`. Die deutschen
  Kapitelmarken sind einmalig aus den Szenendauern gerechnet (die Aufnahme
  schrieb sie da noch nicht mit), Abweichung unter einer Sekunde.
- **Hochkant gebaut (2026-09-28):** `assets/workfloh-pdf-hoch{,-en,-ru}.mp4`, je
  31–32 s, 1080×1920. `node video/aufnahme.mjs --hoch --sprache=de|en|ru`, dann
  `node video/schnitt.mjs hoch|hoch-en|hoch-ru`. Eigenes, kürzeres Drehbuch
  (Anfang · Scannen · Ausfüllen · Übersetzen · Schluss); Wartezeiten laufen im
  **Zeitraffer**: `tempo(f)` im Drehbuch setzt eine Marke, `schnitt.mjs` rechnet
  die Bildzeiten danach um (Klicks im Zeitraffer fallen weg, sie würden rattern).
  Das Gerät passt jetzt ganz ins Bild: der Zoom wird aus dem Platz zwischen
  Kapitelzeile und Band **gerechnet** (vorher fest 2,05 → Gerät endete bei 1957 px).
  Auf der Seite als „Kurzfassung" mit Herunterladen je Sprache.
- **Kästchen im Video nach Lage getippt:** die Offline-Erkennung der App benennt
  ein Kästchen nach dem Text LINKS davon — „Hauptwohnsitz" hieß das Kästchen neben
  „Nebenwohnsitz". Ein App-Befund in Workflow-PDF, hier nicht behoben. Das
  Querformat-Video tippt noch nach Namen und zeigt deshalb den Haken am falschen
  Kästchen.

## Die Musik liegt NICHT im Repo

Die Pixabay-Lizenz erlaubt die Musik im Video, aber **nicht**, die Datei für
sich weiterzugeben — ein öffentliches Repo wäre genau das. Das Skript liest sie
aus der Umgebungsvariable `MUSIK=/pfad/zur/datei.mp3`. Im Impressum der Seite
steht der Titel trotzdem.

## Reihenfolge

1. **Probeclip** (Anfang + Kapitel Scannen, etwa 25 s) → Klaus prüft Hand,
   Rahmen, Tempo, Übergang.
2. Ganzes Video quer.
3. Hochkant-Video.
4. Seite: `index.html`, `manifest.webmanifest`, `sw.js`, Impressum,
   Datenschutz, Poster-Bild, Kapitel-Knöpfe. Danach Klaus: GitHub Pages
   einschalten (Settings → Pages → Branch `main`, Ordner `/`).

## Grenzen, benannt

- Die Kamera ist gestellt: die Hand tippt „Kamera", danach erscheint das
  gebaute Foto.
- Die Übersetzung ist von Hand geschrieben (siehe oben).
- Die Bedeutungssuche braucht ein Sprachmodell aus dem Netz, das der Behälter
  nicht erreicht. Gezeigt wird sie mit dem Stellvertreter aus der Probe
  `tests/bedeutung.mjs`; das Einschalten und der Ladebalken sind echt.
- Ändert sich die App, wird das Video neu gebaut: `node video/aufnahme.mjs`,
  dann `node video/schnitt.mjs`.
