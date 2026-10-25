'use strict';
// Minimal read-only ZIP reader for inspecting mod jars as data. It never extracts
// to disk and never executes anything; nested jars are read from memory.

const zlib = require('node:zlib');

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

function findEndOfCentralDirectory(buf) {
  const min = Math.max(0, buf.length - 0xffff - 22);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error('not a zip archive (no end-of-central-directory record)');
}

/** Returns [{name, method, compressedSize, size, localOffset}] for every entry. */
function listEntries(buf) {
  const eocd = findEndOfCentralDirectory(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== CEN_SIG) throw new Error('corrupt central directory at ' + off);
    const method = buf.readUInt16LE(off + 10);
    const compressedSize = buf.readUInt32LE(off + 20);
    const size = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOffset = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    entries.push({ name, method, compressedSize, size, localOffset });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Returns the uncompressed bytes of one entry. */
function readEntry(buf, entry, { maxSize } = {}) {
  if (maxSize !== undefined && entry.size > maxSize) throw new Error('entry exceeds byte limit: ' + entry.name);
  const off = entry.localOffset;
  if (buf.readUInt32LE(off) !== LOC_SIG) throw new Error('corrupt local header for ' + entry.name);
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const start = off + 30 + nameLen + extraLen;
  if (start + entry.compressedSize > buf.length) throw new Error('truncated entry: ' + entry.name);
  const raw = buf.subarray(start, start + entry.compressedSize);
  let bytes;
  if (entry.method === 0) bytes = Buffer.from(raw);
  else if (entry.method === 8) bytes = zlib.inflateRawSync(raw, maxSize === undefined ? {} : { maxOutputLength: maxSize });
  else throw new Error('unsupported compression method ' + entry.method + ' for ' + entry.name);
  if (bytes.length !== entry.size) throw new Error('entry size mismatch: ' + entry.name);
  return bytes;
}

module.exports = { listEntries, readEntry };
