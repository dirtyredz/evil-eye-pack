#!/usr/bin/env node
'use strict';
// Serves this worktree read-only on 127.0.0.1 so a test MultiMC instance can install
// uncommitted pack changes:
//
//   node tools/packwiz/serve.cjs [--port 8080]
//   pre-launch: "$INST_JAVA" -jar ".../packwiz-installer-bootstrap.jar" http://127.0.0.1:8080/pack.toml
//
// Bytes are served exactly as they are on disk (the same bytes the hashes cover).

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const i = process.argv.indexOf('--port');
const PORT = i === -1 ? 8080 : Number(process.argv[i + 1]);

http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '');
  } catch {
    res.writeHead(400).end();
    return;
  }
  const file = path.resolve(ROOT, rel);
  if (req.method !== 'GET' || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end();
    console.log('404 ' + rel);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
  console.log('200 ' + rel);
}).listen(PORT, '127.0.0.1', () => console.log('serving ' + ROOT + ' at http://127.0.0.1:' + PORT + '/pack.toml'));
