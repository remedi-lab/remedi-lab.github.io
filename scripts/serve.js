const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const SITE_DIR = path.join(__dirname, '..', '_site');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  if (reqPath.endsWith('/')) reqPath += 'index.html';

  let filePath = path.join(SITE_DIR, reqPath);

  // Security check: ensure path is within SITE_DIR
  if (!filePath.startsWith(SITE_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // Try adding .html
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else {
      filePath = path.join(SITE_DIR, '404.html');
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n==============================================`);
  console.log(` REMEDI Lab Website Local Preview Server`);
  console.log(` Running at: http://localhost:${PORT}`);
  console.log(`==============================================\n`);
});
