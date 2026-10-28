'use strict';
// Resolve the exact jar a packwiz metafile pins, from local folders only. Never downloads:
// a candidate counts only when its bytes hash to the metafile's [download] pin.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readMetafileDownload } = require('./pack_index.cjs');

/**
 * Search `dirs` in order for the pinned filename. Returns the first candidate whose bytes match
 * the pin as `{ filename, hash, hashFormat, path, bytes }`; throws on an unsafe filename, when no
 * candidate exists, or when every candidate differs from the pin. `where` names the metafile.
 */
function resolvePinnedJar(metafileText, dirs, where = 'metafile') {
  const pin = readMetafileDownload(metafileText);
  if (!pin.filename || /[\\/]/.test(pin.filename)) throw new Error('Invalid filename in ' + where);
  if (!pin.hash || !pin.hashFormat) throw new Error('Missing download hash in ' + where);
  const present = [];
  for (const dir of dirs) {
    const candidate = path.join(dir, pin.filename);
    if (!fs.existsSync(candidate)) continue;
    const bytes = fs.readFileSync(candidate);
    if (crypto.createHash(pin.hashFormat).update(bytes).digest('hex') === pin.hash) {
      return { filename: pin.filename, hash: pin.hash, hashFormat: pin.hashFormat, path: candidate, bytes };
    }
    present.push(candidate);
  }
  if (present.length) throw new Error('Cached jar differs from pin (no download attempted): ' + present.join(', '));
  throw new Error('Missing pinned jar (no download attempted): ' + pin.filename + ' in ' + dirs.join(', '));
}

module.exports = { resolvePinnedJar };
