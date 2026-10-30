// server.js — node server.js   (o: PORT=8090 node server.js)
// Servidor estático + retransmisor WebSocket para Retícula Corporal.
// Requiere: npm install ws

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let url = (req.url || '/').split('?')[0];
  if (url === '/' || url === '')  url = '/reticula-corporal.html';
  if (url === '/sensor')          url = '/sensor-manos.html';

  const safe = path.normalize(url).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safe);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 ' + url);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

wss.on('connection', (ws, req) => {
  const role = (new URL(req.url, 'http://x').searchParams.get('role') || '').toLowerCase();
  ws._role = role === 'sensor' || role === 'desktop' ? role : 'unknown';
  console.log(`[+] ${ws._role} conectado (${wss.clients.size} totales)`);

  ws.on('message', (data) => {
    if (ws._role !== 'sensor') return;
    const msg = data.toString();
    for (const client of wss.clients) {
      if (client._role === 'desktop' && client.readyState === 1) {
        client.send(msg);
      }
    }
  });

  ws.on('close', () => console.log(`[-] ${ws._role} desconectado`));
  ws.on('error', (e) => console.error('[!] WS error:', e.message));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log(`Servidor en http://localhost:${PORT}`);
  console.log(`  Escritorio:   http://localhost:${PORT}/`);
  console.log(`  Sensor móvil: http://<tu-IP>:${PORT}/sensor`);
  console.log('');
  console.log(`HTTPS (necesario para la cámara del móvil fuera de localhost):`);
  console.log(`  ngrok http ${PORT}   o   cloudflared tunnel --url http://localhost:${PORT}`);
  console.log('');
});
