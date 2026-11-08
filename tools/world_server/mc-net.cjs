#!/usr/bin/env node
'use strict';
// Tiny Minecraft network client (Node built-ins only; runs on Valhalla and on ANU).
//   node mc-net.cjs ping <host> <port>                       server list ping; prints the status JSON
//   node mc-net.cjs rcon <host> <port> <passwordFile> <cmd>  one RCON command; prints the reply
// Exit 0 ok, 1 failure (message on stderr).
const net = require('node:net');
const fs = require('node:fs');

const varint = (n) => { const b = []; do { let t = n & 0x7f; n >>>= 7; if (n) t |= 0x80; b.push(t); } while (n); return Buffer.from(b); };
const lenPrefixed = (buf) => Buffer.concat([varint(buf.length), buf]);
const str = (s) => lenPrefixed(Buffer.from(s, 'utf8'));

function readVarint(buf, off) {
  let v = 0, shift = 0, i = off;
  for (;;) { if (i >= buf.length) return null; const b = buf[i++]; v |= (b & 0x7f) << shift; if (!(b & 0x80)) return { v, next: i }; shift += 7; }
}

function ping(host, port, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port: Number(port) });
    let data = Buffer.alloc(0);
    const fail = (e) => { sock.destroy(); reject(e); };
    sock.setTimeout(timeoutMs, () => fail(new Error(`ping timed out after ${timeoutMs} ms`)));
    sock.on('error', fail);
    sock.on('connect', () => {
      const portBuf = Buffer.alloc(2); portBuf.writeUInt16BE(Number(port));
      sock.write(lenPrefixed(Buffer.concat([varint(0), varint(767), str(host), portBuf, varint(1)])));
      sock.write(lenPrefixed(varint(0)));
    });
    sock.on('data', (d) => {
      data = Buffer.concat([data, d]);
      const len = readVarint(data, 0);
      if (!len || data.length < len.next + len.v) return;
      const id = readVarint(data, len.next);
      const sl = readVarint(data, id.next);
      if (data.length < sl.next + sl.v) return;
      sock.destroy();
      try { resolve(JSON.parse(data.subarray(sl.next, sl.next + sl.v).toString('utf8'))); } catch (e) { reject(e); }
    });
  });
}

function rcon(host, port, password, command, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port: Number(port) });
    let data = Buffer.alloc(0), stage = 'login';
    const fail = (e) => { sock.destroy(); reject(e); };
    sock.setTimeout(timeoutMs, () => fail(new Error('rcon timed out')));
    sock.on('error', fail);
    const send = (id, type, body) => {
      const b = Buffer.from(body, 'utf8'); const p = Buffer.alloc(14 + b.length);
      p.writeInt32LE(10 + b.length, 0); p.writeInt32LE(id, 4); p.writeInt32LE(type, 8); b.copy(p, 12);
      sock.write(p);
    };
    sock.on('connect', () => send(1, 3, password));
    sock.on('data', (d) => {
      data = Buffer.concat([data, d]);
      while (data.length >= 4 && data.length >= 4 + data.readInt32LE(0)) {
        const size = data.readInt32LE(0), id = data.readInt32LE(4);
        const body = data.subarray(12, 4 + size - 2).toString('utf8');
        data = data.subarray(4 + size);
        if (stage === 'login') {
          if (id === -1) return fail(new Error('rcon login refused'));
          stage = 'cmd'; send(2, 2, command);
        } else { sock.destroy(); return resolve(body); }
      }
    });
    // a server that stops answers by closing the socket: treat that as success for `stop`
    sock.on('close', () => { if (stage === 'cmd' && /^stop$/.test(command)) resolve(''); });
  });
}

async function main([mode, host, port, a, b]) {
  if (mode === 'ping') {
    const s = await ping(host, port);
    const players = s.players ? `${s.players.online}/${s.players.max}` : '?';
    console.log(JSON.stringify({ version: s.version && s.version.name, protocol: s.version && s.version.protocol, players, motd: typeof s.description === 'string' ? s.description : (s.description && s.description.text) || '' }));
  } else if (mode === 'rcon') {
    console.log(await rcon(host, port, fs.readFileSync(a, 'utf8').trim(), b));
  } else throw new Error('usage: mc-net.cjs ping <host> <port> | rcon <host> <port> <passwordFile> <command>');
}
main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });
