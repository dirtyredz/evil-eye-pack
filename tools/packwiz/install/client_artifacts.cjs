'use strict';
// Client inventory shared by installation and cache checks. Yield before duplicate checking
// so the installer retains its original resolution and error order. Resolvers accept a cache subdirectory.
const fs = require('node:fs');
const path = require('node:path');
const P = require('../pack_index.cjs');
const { sha256 } = require('../../data_io/files.cjs');
const { localPin, cachedLocal } = require('./local_source.cjs');
const { resolvePinnedJar } = require('../pinned_jar.cjs');

function* clientArtifacts(root) {
  const indexText = fs.readFileSync(path.join(root, 'index.toml'), 'utf8');
  if (P.readPackIndexRef(fs.readFileSync(path.join(root, 'pack.toml'), 'utf8')).hash !== sha256(indexText)) throw Error('Stale pack index');
  const paths = new Set();
  for (const f of P.parseIndex(indexText).files) {
    if (path.isAbsolute(f.file) || f.file.split(/[\\/]/).includes('..')) throw Error('Unsafe index path');
    let file = f.file;
    const bytes = fs.readFileSync(path.join(root, file));
    let name, resolve = () => ({ bytes });
    if (sha256(bytes) !== f.hash) throw Error('Stale index: ' + file);
    if (f.metafile) {
      const text = bytes.toString('utf8'), pin = P.readMetafileDownload(text);
      if (P.readMetafileSide(text) === 'server') continue;
      if (pin.mode === 'metadata:local') {
        const t = localPin(root, file, text);
        name = t.sha256 + '.jar';
        resolve = d => ({ path: path.join(d, name), bytes: cachedLocal(t, d) });
      } else {
        name = pin.filename;
        resolve = d => resolvePinnedJar(text, [d], f.file);
      }
      file = path.posix.join(path.posix.dirname(file), pin.filename);
    }
    yield { file: f.file, dir: path.dirname(f.file), name, installedFile: file, resolve, preserve: f.preserve, sourceMetafile: f.metafile };
    if (paths.has(file.toLowerCase())) throw Error('Duplicate installed path: ' + file);
    paths.add(file.toLowerCase());
  }
}

module.exports = { clientArtifacts };
