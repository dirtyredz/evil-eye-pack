'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkCache } = require('../../install/checks/stable_cache_check.cjs');
const { sha256 } = require('../../../data_io/files.cjs');

const JAR = Buffer.from('pinned jar bytes');
const meta = (filename, side = 'both') => `name = "x"\nfilename = "${filename}"\nside = "${side}"\n\n[download]\nhash-format = "sha256"\nhash = "${sha256(JAR)}"\nurl = "https://example.invalid/${filename}"\n`;

// A tiny pack root (index.toml + metafiles), an empty cache, and a jobs folder with one source jar.
function fixture(t) {
  const scratch = path.resolve(__dirname, '../../../../.tmp');
  fs.mkdirSync(scratch, { recursive: true });
  const base = fs.mkdtempSync(path.join(scratch, 'stable-cache-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'pack'), cache = path.join(base, 'cache'), jobs = path.join(base, 'jobs');
  fs.mkdirSync(path.join(root, 'mods'), { recursive: true });
  fs.mkdirSync(path.join(cache, 'mods'), { recursive: true });
  const files = { 'mods/a.pw.toml': meta('a.jar'), 'mods/b.pw.toml': meta('b.jar'), 'mods/srv.pw.toml': meta('srv.jar', 'server') };
  let index = 'hash-format = "sha256"\n';
  for (const [rel, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, rel), text);
    index += `\n[[files]]\nfile = "${rel}"\nhash = "${sha256(Buffer.from(text))}"\nmetafile = true\n`;
  }
  fs.writeFileSync(path.join(root, 'index.toml'), index);
  fs.writeFileSync(path.join(root, 'pack.toml'), `[index]\nfile = "index.toml"\nhash-format = "sha256"\nhash = "${sha256(index)}"\n`);
  return { root, cache, jobs };
}

test('lists every pinned client/both jar missing or differing, ignoring server-only ones', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.cache, 'mods/a.jar'), JAR);
  fs.writeFileSync(path.join(f.cache, 'mods/b.jar'), 'tampered');
  const r = checkCache(f.root, f.cache, { jobs: f.jobs });
  assert.deepEqual(r.missing.map((m) => m.name), ['b.jar']);
  assert.match(r.missing[0].reason, /differs from pin/);
  fs.rmSync(path.join(f.cache, 'mods/a.jar'));
  assert.deepEqual(checkCache(f.root, f.cache, { jobs: f.jobs }).missing.map((m) => m.name), ['a.jar', 'b.jar']);
});

test('--stock copies only hash-verified jars from local sources and never overwrites', (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.jobs, '2026-01-01-x/jars'), { recursive: true });
  fs.writeFileSync(path.join(f.jobs, '2026-01-01-x/jars/a.jar'), JAR);
  fs.writeFileSync(path.join(f.jobs, '2026-01-01-x/jars/b.jar'), 'wrong bytes');
  const r = checkCache(f.root, f.cache, { stock: true, jobs: f.jobs });
  assert.deepEqual(r.stocked, ['a.jar']);
  assert.deepEqual(r.missing.map((m) => m.name), ['b.jar']);
  assert.deepEqual(fs.readFileSync(path.join(f.cache, 'mods/a.jar')), JAR);
  assert.equal(fs.existsSync(path.join(f.cache, 'mods/b.jar')), false);
  // a differing cached file is reported, not replaced
  fs.writeFileSync(path.join(f.cache, 'mods/a.jar'), 'tampered');
  fs.rmSync(path.join(f.cache, 'mods/b.jar'), { force: true });
  const again = checkCache(f.root, f.cache, { stock: true, jobs: f.jobs });
  assert.deepEqual(again.missing.map((m) => m.name), ['a.jar', 'b.jar']);
  assert.equal(fs.readFileSync(path.join(f.cache, 'mods/a.jar'), 'utf8'), 'tampered');
});

for (const target of ['pack.toml', 'mods/srv.pw.toml']) {
  test('cache guard rejects stale ' + target + ' just like the installer', t => {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.cache, 'mods/a.jar'), JAR);
    fs.writeFileSync(path.join(f.cache, 'mods/b.jar'), JAR);
    if (target === 'pack.toml') fs.writeFileSync(path.join(f.root, target), '[index]\nhash = "stale"\n');
    else fs.appendFileSync(path.join(f.root, target), '\n');
    const { prepareFiles } = require('../../install/install_pack.cjs');
    assert.throws(() => prepareFiles(f.root, f.cache), /Stale/);
    assert.throws(() => checkCache(f.root, f.cache), /Stale/);
  });
}

test('dev cache check reports a missing mods jar and --stock fills it from the Stable cache', (t) => {
  const f = fixture(t);
  const dev = path.join(path.dirname(f.cache), 'dev');
  fs.mkdirSync(path.join(dev, 'mods'), { recursive: true });
  fs.writeFileSync(path.join(f.cache, 'mods/a.jar'), JAR);
  fs.writeFileSync(path.join(f.cache, 'mods/b.jar'), JAR);
  const { checkDevCache } = require('../../install/checks/stable_cache_check.cjs');
  const opts = { cache: dev, stable: f.cache, jobs: f.jobs };
  assert.deepEqual(checkDevCache(f.root, opts).missing.map((m) => m.name), ['a.jar', 'b.jar']);
  const r = checkDevCache(f.root, { ...opts, stock: true });
  assert.deepEqual(r.stocked.sort(), ['a.jar', 'b.jar']);
  assert.deepEqual(fs.readFileSync(path.join(dev, 'mods/a.jar')), JAR);
  assert.equal(checkDevCache(f.root, opts).missing.length, 0);
});

test('Stable cache default comes from the fixed machine environment', () => {
  const env = require('../../../runtime_env/env.cjs');
  assert.equal(require('../../install/checks/stable_cache_check.cjs').DEFAULT_CACHE, env.FIXED.STABLE_CACHE);
});
