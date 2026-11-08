#!/usr/bin/env node
'use strict';
// Appends one entry to a Minecraft servers.dat (uncompressed NBT) without re-encoding the rest: the bytes
// of the existing list are kept and only the list length and the new compound are changed. Backs the file
// up first (servers.dat.bak-<stamp>), is idempotent (an entry with the same name is left alone) and refuses
// any layout it does not recognise (a root compound holding only the `servers` list of compounds, >= 1 entry).
//   node add-server-entry.cjs <servers.dat> <name> <ip> [--dry-run]
const fs = require('node:fs');

const HEADER = Buffer.concat([Buffer.from([0x0a, 0x00, 0x00, 0x09, 0x00, 0x07]), Buffer.from('servers'), Buffer.from([0x0a])]);
const nbtString = (tag, key, value) => {
  const k = Buffer.from(key), v = Buffer.from(value, 'utf8');
  const b = Buffer.alloc(1 + 2 + k.length + 2 + v.length);
  let o = 0; b[o++] = tag; b.writeUInt16BE(k.length, o); o += 2; k.copy(b, o); o += k.length;
  b.writeUInt16BE(v.length, o); o += 2; v.copy(b, o);
  return b;
};

function addEntry(buf, name, ip) {
  if (!buf.subarray(0, HEADER.length).equals(HEADER)) throw new Error('unrecognised servers.dat layout (header)');
  const count = buf.readInt32BE(HEADER.length);
  if (count < 1) throw new Error('unrecognised servers.dat layout (empty list)');
  if (buf[buf.length - 1] !== 0x00 || buf[buf.length - 2] !== 0x00) throw new Error('unrecognised servers.dat layout (trailer)');
  if (buf.includes(Buffer.from(name, 'utf8'))) return null; // already present
  const entry = Buffer.concat([nbtString(0x08, 'name', name), nbtString(0x08, 'ip', ip), Buffer.from([0x00])]);
  const out = Buffer.concat([buf.subarray(0, buf.length - 1), entry, Buffer.from([0x00])]);
  out.writeInt32BE(count + 1, HEADER.length);
  return out;
}

function main(argv) {
  const dry = argv.includes('--dry-run');
  const [file, name, ip] = argv.filter((a) => a !== '--dry-run');
  if (!file || !name || !ip) throw new Error('usage: add-server-entry.cjs <servers.dat> <name> <ip> [--dry-run]');
  const out = addEntry(fs.readFileSync(file), name, ip);
  if (!out) { console.log(`"${name}" already in ${file}; nothing to do`); return; }
  if (dry) { console.log(`DryRun: would add "${name}" (${ip}) to ${file}`); return; }
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  fs.copyFileSync(file, `${file}.bak-${stamp}`);
  fs.writeFileSync(file, out);
  console.log(`added "${name}" (${ip}) to ${file}; backup ${file}.bak-${stamp}`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { addEntry };
