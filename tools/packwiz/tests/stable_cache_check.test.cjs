'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkCache } = require('../install/stable_cache_check.cjs');
const { sha256 } = require('../../data_io/files.cjs');

const JAR = Buffer.from('pinned jar bytes');
const meta = (filename, side = 'both') => `name = "x"\nfilename = "${filename}"\nside = "${side}"\n\n[download]\nhash-format = "sha256"\nhash = "${sha256(JAR)}"\nurl = "https://example.invalid/${filename}"\n`;

// A tiny pack root (index.toml + metafiles), an empty cache, and a jobs folder with one source jar.
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'stable-cache-'));
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
