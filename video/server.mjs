// Kleiner Server für die Aufnahme: "/" ist dieser Ordner (Bühne, Hand, Foto),
// "/app/" ist die echte App aus dem Nachbar-Klon. Beides auf EINEM Ursprung,
// damit die Bühne in den iframe greifen kann (Hand fährt zu echten Knöpfen).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf',
  '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.onnx': 'application/octet-stream', '.gz': 'application/gzip' };

export function starteServer(buehneDir, appDir) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let root = buehneDir;
    if (p.startsWith('/app/')) { root = appDir; p = p.slice(4); }
    if (p.endsWith('/')) p += 'index.html';
    const datei = path.join(root, p);
    if (!datei.startsWith(root)) { res.writeHead(403); return res.end(); }
    fs.readFile(datei, (err, data) => {
      if (err) { res.writeHead(404); return res.end('nicht da'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(datei).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, url: `http://127.0.0.1:${srv.address().port}` })));
}
