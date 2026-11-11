'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../../../data_io/files.cjs');
const P = require('../../pack_index.cjs');
const { validate } = require('../../migration/manifest.cjs');
const { renderMetafile } = require('../../migration/repoint.cjs');
const { resolveSelector } = require('../../migration/fetch.cjs');
const { withLocalPack, localPin, verifyInstalledLocal } = require('../../install/local_source.cjs');

function fixture(t) {
  const scratch = path.resolve(__dirname, '../../../../.tmp'); fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, 'local-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('private fixture');
  const target = { source: 'local', metafile: 'mods/private.pw.toml', filename: 'private.jar', name: 'Private', side: 'both', sha256: sha256(bytes), size: bytes.length };
  const lock = { schema: 1, runtime: { loader: 'neoforge', minecraft: '1.21.1', loaderVersion: '21.1.265', java: 21 }, source: { fingerprint: 'f' }, entries: [{ metafile: target.metafile, action: 'add', rationale: 'private', target }] };
  for (const dir of ['mods', 'tools/packwiz/migration', 'cache/mods']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, 'tools/packwiz/migration/target-lock.json'), JSON.stringify(lock));
  const meta = renderMetafile(target); fs.writeFileSync(path.join(root, target.metafile), meta);
  const index = P.formatIndex({ hashFormat: 'sha256', files: [{ file: target.metafile, hash: sha256(meta), metafile: true }] });
  fs.writeFileSync(path.join(root, 'index.toml'), index);
  fs.writeFileSync(path.join(root, 'pack.toml'), `[index]\nfile = "index.toml"\nhash-format = "sha256"\nhash = "${sha256(index)}"\n`);
  fs.writeFileSync(path.join(root, 'cache/mods', target.sha256 + '.jar'), bytes);
  return { root, bytes, target, lock, meta, cache: path.join(root, 'cache/mods') };
}

test('private lock has only sha256/size identity, resolves by hash without a network request', async t => {
  const f = fixture(t);
  assert.deepEqual(validate(f.lock, []), []);
  assert.doesNotMatch(f.meta, /url|file:\/|https?:/);
  const result = await resolveSelector(f.target, { cacheDir: path.join(f.root, 'cache'), folder: 'mods', api: { json() { throw Error('network'); } } });
  assert.deepEqual(result.bytes, f.bytes);
  f.target.url = 'https://example.com/private.jar';
  assert.match(validate(f.lock, []).join('\n'), /no URL/);
  assert.throws(() => localPin(f.root, f.target.metafile, f.meta + '\n'), /Invalid private pin/);
});

test('overlay serves verified bytes only on loopback, rehashes, leaves source untouched and closes after failure', async t => {
  const f = fixture(t); let url, overlay;
  await assert.rejects(withLocalPack(path.join(f.root, 'pack.toml'), f.cache, async pack => {
    overlay = path.dirname(pack);
    const meta = fs.readFileSync(path.join(overlay, f.target.metafile), 'utf8'); url = P.readMetafileDownload(meta).url;
    assert.equal(new URL(url).hostname, '127.0.0.1');
    assert.deepEqual(Buffer.from(await (await fetch(url)).arrayBuffer()), f.bytes);
    assert.equal((await fetch(new URL('/unknown', url))).status, 404);
    const index = fs.readFileSync(path.join(overlay, 'index.toml'), 'utf8');
    assert.equal(P.parseIndex(index).files[0].hash, sha256(meta));
    assert.equal(P.readPackIndexRef(fs.readFileSync(pack, 'utf8')).hash, sha256(index));
    throw Error('installer failed');
  }), /installer failed/);
  assert.equal(fs.existsSync(overlay), false);
  assert.equal(fs.readFileSync(path.join(f.root, f.target.metafile), 'utf8'), f.meta);
  await assert.rejects(fetch(url));
  fs.writeFileSync(path.join(f.cache, f.target.sha256 + '.jar'), 'corrupt');
  await assert.rejects(withLocalPack(path.join(f.root, 'pack.toml'), f.cache, () => assert.fail('installer must not run')), /differs from lock/);
});

test('a successful installer exit cannot mask missing or corrupt private installed bytes', t => {
  const f = fixture(t), instance = path.join(f.root, 'instance');
  fs.mkdirSync(path.join(instance, 'mods'), { recursive: true });
  assert.throws(() => verifyInstalledLocal(f.root, instance), /ENOENT/);
  fs.writeFileSync(path.join(instance, 'mods/private.jar'), 'wrong');
  assert.throws(() => verifyInstalledLocal(f.root, instance), /differs from lock/);
  fs.writeFileSync(path.join(instance, 'mods/private.jar'), f.bytes);
  assert.doesNotThrow(() => verifyInstalledLocal(f.root, instance));
});
