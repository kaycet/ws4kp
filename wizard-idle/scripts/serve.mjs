// Zero-dependency static server for local play: npm start, then open
// http://localhost:8080 (ES modules need http://, not file://).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 8080;
const TYPES = {
	'.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
	const url = new URL(req.url, 'http://localhost');
	const file = path.normalize(path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
	if (!file.startsWith(root) || file.includes(`${path.sep}.`) || file.includes('node_modules')) {
		res.writeHead(403).end();
		return;
	}
	fs.readFile(file, (err, body) => {
		if (err) {
			res.writeHead(404).end('Not found');
			return;
		}
		res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
		res.end(body);
	});
}).listen(port, () => console.log(`Starfall Spire on http://localhost:${port}`));
