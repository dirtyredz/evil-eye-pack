'use strict';
// Minimal 8-bit PNG codec (RGBA output) for the Fusion glass generator: no dependencies.
const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Decodes a non-interlaced 8-bit PNG (greyscale, RGB, palette, grey+alpha or RGBA) from a Buffer. */
function decode(b) {
  let p = 8, w, h, ct, bd, plte, trns;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), t = b.toString('latin1', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    p += 12 + len;
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    else if (t === 'PLTE') plte = d;
    else if (t === 'tRNS') trns = d;
    else if (t === 'IDAT') idat.push(d);
  }
  if (bd !== 8) throw new Error('unsupported PNG bit depth ' + bd);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const u = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= ch && y ? out[(y - 1) * stride + x - ch] : 0;
      let r;
      if (f === 0) r = v;
      else if (f === 1) r = v + a;
      else if (f === 2) r = v + u;
      else if (f === 3) r = v + ((a + u) >> 1);
      else {
        const pp = a + u - c, pa = Math.abs(pp - a), pb = Math.abs(pp - u), pc = Math.abs(pp - c);
        r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? u : c);
      }
      out[y * stride + x] = r & 255;
    }
  }
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * ch;
    let R, G, B, A = 255;
    if (ct === 6) { R = out[o]; G = out[o + 1]; B = out[o + 2]; A = out[o + 3]; }
    else if (ct === 2) { R = out[o]; G = out[o + 1]; B = out[o + 2]; }
    else if (ct === 3) { const k = out[o]; R = plte[k * 3]; G = plte[k * 3 + 1]; B = plte[k * 3 + 2]; A = trns && k < trns.length ? trns[k] : 255; }
    else if (ct === 0) { R = G = B = out[o]; }
    else { R = G = B = out[o]; A = out[o + 1]; }
    data[i * 4] = R; data[i * 4 + 1] = G; data[i * 4 + 2] = B; data[i * 4 + 3] = A;
  }
  return { w, h, data };
}

/** Encodes {w,h,data(RGBA)} to a deterministic PNG Buffer. */
function encode({ w, h, data }) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (t, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t, 'latin1'), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
    return Buffer.concat([l, td, c]);
  };
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { decode, encode, readFile: (f) => decode(fs.readFileSync(f)) };
