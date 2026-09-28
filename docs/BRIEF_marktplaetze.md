# Brief: Workfloh PDF samt Video in beide Marktplätze, Marktplätze angleichen

Stand 2026-09-28, geschrieben gegen `origin/main` (PWA-Toolpoint `03476b5`, family-project `f2dc681`).

## Auftrag (Klaus 2026-09-28)

1. **Workfloh PDF samt Erklärvideo** auf **PWA Toolpoint** und auf **family-projekt.de** setzen.
2. **Angleichen:** jede App, die in PWA Toolpoint steht, soll auch auf family-projekt.de zu sehen sein.
3. **Jeder Markt behält sein eigenes Design.** Die neuen Einträge werden in den jeweiligen Markt eingepasst,
   mit dessen Container und dessen Funktionen. Es wird nichts vereinheitlicht.
   - PWA Toolpoint: kompakte Karte, Skill `app-container-kompakt`, `assets/karte.js`
   - family-projekt.de: Schaufenster-Karte, Skill `app-container-schaufenster`, `markt.html`

## Pflichtlektüre, in dieser Reihenfolge

1. `PWA-Toolpoint/CLAUDE.md`, besonders:
   - Stufe 1 (keine Preise)
   - `seit` und `text_en` für eigene Einträge
   - Wartung
   - Detailseiten S7–S9
   - `tools/statische-listen.mjs` und `tools/detailseiten.mjs` gemeinsam bauen
2. `family-project/CLAUDE.md`, besonders:
   - „DIE KENNUNG IST DIE IDENTITÄT DER MESSREIHE“: `eigen-…` statt `markt-…`, wenn es in `forschung/messziele.json` schon eine Reihe gibt
   - Positivliste in `markteintraege()`
   - `vorstellung`/`besonders`
   - Prüf-es-selbst-Knopf
   - `messung-nachziehen`
3. Die Skills `app-container-kompakt`, `app-container-schaufenster` und `seiten-bauregeln`.
4. `Workflow-PDF/CLAUDE.md` (was die App kann) und `Workfloh-PDF-Page/CLAUDE.md` (Video, Dateinamen).

## Was schon feststeht (gemessen, nicht vermutet)

**Workfloh PDF steht in KEINEM der beiden Märkte.** Beide `listings.js` nennen es nicht.

| | Adresse |
|---|---|
| App | https://lausiklauskn-png.github.io/Workflow-PDF/ |
| Symbol | `Workflow-PDF/icons/icon-512.png` (aus dem Manifest) |
| Webseite | https://lausiklauskn-png.github.io/Workfloh-PDF-Page/ |
| Video quer | `Workfloh-PDF-Page/assets/workfloh-pdf-quer.mp4` · `-en` · `-ru`, Poster `poster-de/en/ru.jpg` |
| Video hochkant | `workfloh-pdf-hochvoll.mp4` · `-en` · `-ru`, Poster `poster-hochvoll-*.jpg` |
| Länge | DE 3:39 · EN 3:40 · RU 3:38 |
| Kapitel | `assets/kapitel-quer[-en\|-ru].json` |

⚠ **Die Videos NICHT kopieren**, nur verlinken bzw. von der Webseite einbetten (je rund 10–20 MB).
Der Service-Worker des jeweiligen Markts darf `.mp4` **nicht** in den Vorrat legen.
Das ist dieselbe Regel wie in `Workflow-PDF/sw.js`. Wer ein Video auf der Webseite umbenennt,
bricht jeden Link darauf. Das steht in `Workfloh-PDF-Page/CLAUDE.md`.

**Vergleich nach ADRESSE**, nicht nach Kennung, denn die Präfixe unterscheiden sich (`eigen-` gegen `markt-`).
Die Zählung ergibt 29 Einträge in PWA Toolpoint und 20 auf family-projekt.de.

In PWA Toolpoint, aber nicht auf family-projekt.de:

| Kennung (PT) | App | Hinweis |
|---|---|---|
| eigen-sbkim-demo | SBKIM-Demo | |
| eigen-kimtool-point | SB·KIMTool·Point | |
| eigen-sage-suchtool | Sage-Protokol · Such-Werkzeug | |
| eigen-sage-pinnwand | Sage-Protokol · Pinnwand | |
| eigen-family-projekt | Family Projekt | ⚠ ist der Markt selbst, gehört nicht in seine eigene Liste |
| eigen-workfloh-page | Muster Werbetechnik | |
| eigen-company-brain | Company Brain | |
| eigen-alis-moderaum | Alis Moderaum | ⚠ steht in PT auf **Wartung**, Klaus fragen |
| eigen-alis-warenwirtschaft | Alis Moderaum · Warenwirtschaft | ⚠ ebenso auf Wartung |
| eigen-kuechenzettel | Küchenzettel | |
| eigen-ki-schulung | KI-Schulung | ⚠ family-projekt.de hat eine **eigene** Fassung (`markt-ki-schulung`, andere Adresse), also kein Neueintrag, nur prüfen |

Umgekehrt steht nur `markt-pwa-toolpoint` allein auf family-projekt.de. Das ist richtig so, denn es ist der andere Markt.

**Neu dazukommen sollen auf family-projekt.de also rund 7–9 Einträge, plus Workfloh PDF in beiden Märkten.**
Die genaue Zahl ist zu klären: Alis ja oder nein, solange Wartung gilt.

## Vorgehen

1. **Zuerst die Tabelle oben selbst nachmessen.** Ein Parallel-Merge kann sie verändert haben.
2. **Plan an Klaus, bevor gebaut wird.** Zu klären:
   - ob Alis (Wartung) mitkommt
   - wo das Video sitzt: auf der Detailseite als Poster mit Abspielen, auf der Karte nur ein Hinweis bzw. Link
3. **Kennungen:** für family-projekt.de zuerst in `forschung/messziele.json` nachsehen, ob die App schon eine
   Messreihe unter `eigen-…` hat. Wenn ja, diese Kennung nehmen. Sonst reißt der Verlauf ab
   (Präzedenzfall `markt-auslieferungspruefer`).
4. **Texte:**
   - family-projekt.de braucht `vorstellung` + `besonders`, im Ton der vorhandenen 18 Einträge: kurz, stichwortartig, ohne Gedankenstriche.
   - PWA Toolpoint braucht `text_en` und `seit` (Repo-Anlage laut GitHub-API).
   - `text` bleibt der Such-Korpus.
5. **Bauen mit den Werkzeugen des Repos**, nie von Hand:
   - statische Liste
   - Detailseiten
   - Sitemap (PT)
   - Cache-Bump **gegen `origin/main`** geprüft
6. **Prüfen:**
   - PWA Toolpoint: `node tests/smoke.mjs`, `smoke_detail.mjs`, Gegenprobe **in einer Kopie**.
   - family-project: alle `tests/smoke_*.mjs`. `smoke_all` allein reicht nicht.
   - Neue Wächter mit Gegenprobe.
   - Nie eine Zahl festnageln („N Karten“). Gemessen wird die Übereinstimmung.
7. **Klaus die Adressen im Chat geben**, zum Sichttest in beiden Märkten.

## Fallen, die schon Zeit gekostet haben

- Eine Positivliste beschneidet neue Felder still (`markteintraege()` in family-project, `wacheLesen()` in PWA Toolpoint).
- Ein Wächter, der eine **Zahl** misst, legt beim ersten Neueintrag die Veröffentlichung still, weil der Arbeitsablauf vor dem Commit prüft.
- Ein deutsches „…“ in einem JS-String beendet den String. `node --check` fährt über alle Dateien.
- PWA Toolpoint ist privat. Gelesen wird über `pwa-toolpoint.de`, nicht über `raw.githubusercontent.com`.
- family-projekt.de läuft auf Hetzner (Caddy), nicht auf GitHub Pages.

## Abschluss-Befehl

`PULS`/`CLAUDE.md` der beiden Repos nachziehen. Das Forschungs-Eintragen folgt der Kimhub-Regel.
Am Schluss gehören in den Chat: Abschlussbrief mit **gemessenem** Stundennachweis, nächster Brief als Codeblock
und die Adressen zum Ansehen.
