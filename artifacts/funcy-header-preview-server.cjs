const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const allowed = {
  '/artifacts/funcy-header-preview.html': 'text/html; charset=utf-8',
  '/css/content_styles.css': 'text/css',
  '/icons/icon48.png': 'image/png'
};
http.createServer((req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname;
  if (!allowed[file]) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', allowed[file]);
  fs.createReadStream(path.join(root, file)).pipe(res);
}).listen(4178, '127.0.0.1', () => console.log('Funcy preview: http://127.0.0.1:4178/artifacts/funcy-header-preview.html'));
