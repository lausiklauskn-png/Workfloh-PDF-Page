// Baut das "Kamera-Foto" für das Video: Seite 1 des Beispiel-Formulars aus der
// App, schräg auf einer Tischfläche, mit Schatten. Ergebnis: _roh/foto.jpg
// Aufruf: node video/foto-bauen.mjs   (APP=../Workflow-PDF als Vorgabe)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starteServer } from './server.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(process.env.APP || path.join(HIER, '../../Workflow-PDF'));
fs.mkdirSync(path.join(HIER, '_roh'), { recursive: true });
const { srv, url } = await starteServer(HIER, APP);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
await page.goto(url + '/foto-tisch.html');
await page.waitForFunction(() => window.__fertig === true, null, { timeout: 30000 });
const ziel = path.join(HIER, '_roh/foto.jpg');
await page.screenshot({ path: ziel, type: 'jpeg', quality: 88 });
console.log('Foto:', ziel, fs.statSync(ziel).size, 'Bytes');
await browser.close(); srv.close();
