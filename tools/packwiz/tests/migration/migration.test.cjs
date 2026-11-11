'use strict';
// NeoForge migration lock tooling: lock validation, dependency closure, deterministic re-point,
// all-or-nothing apply, and publisher verification of downloads (injected HTTP, no network).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { validate, fingerprint, serialize, sourceMetafiles } = require('../../migration/manifest.cjs');
const { compareVersions, inRange, parseRange, checkClosure } = require('../../migration/dependencies.cjs');
const { renderMetafile, plan, apply } = require('../../migration/repoint.cjs');
const { client, resolveSelector } = require('../../migration/fetch.cjs');
const { oldIdentity, packSelector } = require('../../migration/resolve.cjs');

const REPO = path.resolve(__dirname, '../../../..');
const h = (a, b) => crypto.createHash(a).update(b).digest('hex');
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };

function target(over = {}) {
  const b = Buffer.from('jar');
  return { metafile: 'mods/a.pw.toml', name: 'A', side: 'both', source: 'modrinth', project: 'P', version: 'V', filename: 'a.jar',
    url: 'https://cdn.modrinth.com/data/P/versions/V/a.jar', size: 3, sha1: h('sha1', b), sha256: h('sha256', b), sha512: h('sha512', b), ...over };
}
const old = { name: 'A', filename: 'a-old.jar', side: 'both', source: 'modrinth', project: 'P', version: 'OLD' };
const lockOf = (entries, fp = 'f') => ({ schema: 1, runtime: { minecraft: '1.21.1', loader: 'neoforge', loaderVersion: '21.1.265', java: 21 }, source: { fingerprint: fp }, entries });

function fixturePack(t) {
  const root = tmp(t);
  fs.mkdirSync(path.join(root, 'mods'));
  fs.writeFileSync(path.join(root, 'pack.toml'), 'name = "X"\n\n[index]\nfile = "index.toml"\n\n[versions]\nforge = "47.4.10"\nminecraft = "1.20.1"\n');
  fs.writeFileSync(path.join(root, 'mods/a.pw.toml'), renderMetafile(target({ filename: 'a-old.jar', version: 'OLD' })));
  fs.writeFileSync(path.join(root, 'mods/gone.pw.toml'), renderMetafile(target({ metafile: 'mods/gone.pw.toml', filename: 'g.jar' })));
  return root;
}

test('every source metafile must be accounted for exactly once, with per-action fields', () => {
  const sources = ['mods/a.pw.toml', 'mods/b.pw.toml'];
  const good = lockOf([{ metafile: 'mods/a.pw.toml', action: 'repoint', old, target: target(), rationale: 'r' },
    { metafile: 'mods/b.pw.toml', action: 'defer', old, target: null, rationale: 'port' }]);
  assert.deepEqual(validate(good, sources), []);
  const missing = lockOf([good.entries[0]]);
  assert.match(validate(missing, sources).join('\n'), /mods\/b.pw.toml: accounted for 0 times/);
  const twice = lockOf([...good.entries, good.entries[1]]);
  assert.match(validate(twice, sources).join('\n'), /accounted for 2 times/);
  const noTarget = lockOf([{ ...good.entries[0], target: null }, good.entries[1]]);
  assert.match(validate(noTarget, sources).join('\n'), /repoint needs a target/);
  const badHash = lockOf([{ ...good.entries[0], target: target({ sha512: 'abc' }) }, good.entries[1]]);
  assert.match(validate(badHash, sources).join('\n'), /invalid sha512/);
  const cfUrl = lockOf([{ ...good.entries[0], target: target({ source: 'curseforge', project: '1', file: '2' }) }, good.entries[1]]);
  assert.match(validate(cfUrl, sources).join('\n'), /metadata mode carries no download url/);
  const direct = lockOf([{ ...good.entries[0], target: target({ source: 'direct', project: 'P' }) }, good.entries[1]]);
  assert.match(validate(direct, sources).join('\n'), /no update table/);
  const badSide = lockOf([{ ...good.entries[0], target: target({ side: 'Client' }) }, good.entries[1]]);
  assert.match(validate(badSide, sources).join('\n'), /invalid side/);
  const moved = lockOf([{ ...good.entries[0], target: target({ metafile: 'mods/z.pw.toml' }) }, good.entries[1]]);
  assert.match(validate(moved, sources).join('\n'), /repoint must keep its metafile/);
});

test('Maven ranges and version order follow (Neo)Forge semantics', () => {
  assert.ok(compareVersions('6.0.10', '6.0.9') > 0);
  assert.ok(compareVersions('1.0-beta', '1.0') < 0);
  assert.ok(compareVersions('1.0.0', '1') === 0);
  assert.ok(compareVersions('2.0.0-beta.2', '2.0.0-beta.10') < 0);
  assert.ok(inRange('21.1.265', '[21.1.0,)'));
  assert.ok(!inRange('1.20.1', '[1.21,1.21.2)'));
  assert.ok(inRange('6.0.10', '[6.0.0,6.1)'));
  assert.ok(inRange('3.0', '[1,2),[3,4]'));
  assert.ok(inRange('9.9', '1.0'), 'a bare version is only a recommendation');
  assert.ok(inRange('9.9', '*'));
  assert.ok(inRange('1.5', '[1.5]') && !inRange('1.6', '[1.5]'));
  assert.throws(() => parseRange('[1.0,2.0'), /Malformed/);
  // Maven sublists: a hyphen opens a list that ranks below a number at the same position.
  assert.ok(compareVersions('1.21.1-3.7.2', '1.21-2.20.0') > 0);
  assert.ok(inRange('1.21.1-3.7.2', '[1.21-2.20.0,]'));
  assert.ok(compareVersions('1.21', '1.21z') < 0 && compareVersions('1.21.1', '1.21z') > 0);
  assert.ok(compareVersions('1.0-alpha-1', '1.0-beta') < 0 && compareVersions('1.0-rc1', '1.0') < 0 && compareVersions('1.0-sp', '1.0') > 0);
  assert.equal(compareVersions('1.0.0-ga', '1'), 0);
});

const unit = (mods, { loader = 'neoforge', bundled = false, source = 'x.jar' } = {}) => ({ source, loader, bundled, mods });
const mod = (id, version, dependencies = []) => ({ id, version, dependencies });
const dep = (id, type, range = '', side = 'BOTH') => ({ id, type, mandatory: type === 'required', range, side });
const rt = { minecraft: '1.21.1', neoforge: '21.1.265', java: 21 };

test('closure: missing, out of range, wrong loader, duplicate providers, client-only and incompatible', () => {
  const ok = checkClosure([
    { key: 'mods/a', side: 'both', units: [unit([mod('a', '1.0', [dep('lib', 'required', '[2,3)'), dep('neoforge', 'required', '[21.1,)'), dep('minecraft', 'required', '[1.21.1,1.21.2)')])])] },
    { key: 'mods/lib', side: 'both', units: [unit([mod('lib', '2.5')])] }
  ], rt);
  assert.deepEqual(ok.errors, []);
  const bad = checkClosure([
    { key: 'mods/a', side: 'both', units: [unit([mod('a', '1.0', [dep('missing', 'required'), dep('lib', 'required', '[3,)'), dep('opt', 'optional', '[2,)'), dep('bad', 'incompatible'), dep('cl', 'required')])])] },
    { key: 'mods/lib', side: 'both', units: [unit([mod('lib', '2.5')])] },
    { key: 'mods/lib2', side: 'both', units: [unit([mod('lib', '2.6')])] },
    { key: 'mods/opt', side: 'both', units: [unit([mod('opt', '1.0')])] },
    { key: 'mods/bad', side: 'both', units: [unit([mod('bad', '1')])] },
    { key: 'mods/cl', side: 'client', units: [unit([mod('cl', '1')])] },
    { key: 'mods/old', side: 'both', units: [unit([mod('old', '1')], { loader: 'forge' })] },
    { key: 'mods/unknown', side: 'both', units: [unit([mod('u', '1', [dep('lib3', 'required', '[1,)')])])] },
    { key: 'mods/lib3', side: 'both', units: [unit([mod('lib3', null)])] }
  ], rt);
  const text = bad.errors.join('\n');
  assert.match(text, /required missing \*: missing/);
  assert.match(text, /required lib \[3,\): unsatisfied/);
  assert.match(text, /installed optional dependency out of range/);
  assert.match(text, /incompatible mod is installed/);
  assert.match(text, /provided only by client-side jars/);
  assert.match(text, /lib: provided by more than one jar/);
  assert.match(text, /mods\/old: Forge-only metadata/);
  assert.match(text, /provider version unknown/);
  const matrix = checkClosure([{ key: 'mods/m', side: 'both', units: [unit([mod('m', '1', [dep('minecraft', 'required', '[1.21,1.21.1)'), dep('neoforge', 'required', '[21.0.100,21.1)')])])] }], rt);
  assert.deepEqual(matrix.errors, [], 'FML VersionSupportMatrix: 1.21.1 also satisfies 1.21 and 21.0.166 ranges');
  assert.equal(checkClosure([{ key: 'mods/m', side: 'both', units: [unit([mod('m', '1', [dep('minecraft', 'required', '[1.20,1.21)')])])] }], rt).errors.length, 1);
  const waived = checkClosure([{ key: 'mods/a', side: 'both', units: [unit([mod('a', '1', [dep('gone', 'required')])])] }], rt, { waivers: { 'a -> gone': 'reviewed' } });
  assert.deepEqual(waived.errors, []);
  assert.match(waived.warnings[0], /waived: reviewed/);
  const bundledDup = checkClosure([
    { key: 'mods/a', side: 'both', units: [unit([mod('a', '1')]), unit([mod('lib', '2')], { bundled: true })] },
    { key: 'mods/lib', side: 'both', units: [unit([mod('lib', '2.1')])] }], rt);
  assert.deepEqual(bundledDup.errors, [], 'a jar-in-jar copy beside the external jar is not a duplicate provider');
});

test('rendered metafiles keep packwiz layout for real pack files of each source', () => {
  for (const f of ['mods/amendments.pw.toml', 'mods/additional-lanterns.pw.toml', 'mods/culllessleaves-neoforge.pw.toml']) {
    const text = fs.readFileSync(path.join(REPO, f), 'utf8');
    const o = oldIdentity(REPO, f);
    const t = { ...o, sha1: o.hash, sha256: o.hash, sha512: o.hash };
    assert.equal(renderMetafile(t), text, f);
  }
});

test('re-point plan is deterministic, refuses a stale lock and applies all-or-nothing', (t) => {
  const root = fixturePack(t);
  const lock = lockOf([
    { metafile: 'mods/a.pw.toml', action: 'repoint', old, target: target(), rationale: 'r' },
    { metafile: 'mods/gone.pw.toml', action: 'defer', old, target: null, rationale: 'port' },
    { metafile: 'mods/new.pw.toml', action: 'add', old: null, target: target({ metafile: 'mods/new.pw.toml', filename: 'n.jar' }), rationale: 'dep' }
  ], fingerprint(root));
  assert.equal(serialize(lock), serialize(JSON.parse(serialize(lock))));
  const first = plan(root, lock);
  assert.deepEqual(first, plan(root, lock));
  assert.deepEqual(first.deletes, ['mods/gone.pw.toml']);
  assert.deepEqual(first.writes.map(w => w.rel), ['mods/a.pw.toml', 'mods/new.pw.toml', 'pack.toml']);
  assert.match(first.writes[2].text, /\[versions\]\nminecraft = "1\.21\.1"\nneoforge = "21\.1\.265"\n/);
  assert.doesNotMatch(first.writes[2].text, /forge = "47/);
  const before = fs.readdirSync(path.join(root, 'mods')).map(f => [f, fs.readFileSync(path.join(root, 'mods', f), 'utf8')]);
  const failing = { ...fs, renameSync: (a, b) => { if (b.endsWith('new.pw.toml')) throw new Error('disk full'); return fs.renameSync(a, b); } };
  assert.throws(() => apply(root, first, { fsImpl: failing }), /rolled back: disk full/);
  assert.deepEqual(fs.readdirSync(path.join(root, 'mods')).map(f => [f, fs.readFileSync(path.join(root, 'mods', f), 'utf8')]), before);
  apply(root, first);
  assert.deepEqual(sourceMetafiles(root), ['mods/a.pw.toml', 'mods/new.pw.toml']);
  assert.throws(() => plan(root, lock), /lock is invalid|stale lock/, 'the applied pack no longer matches the source fingerprint');
  const stale = fixturePack(t);
  fs.appendFileSync(path.join(stale, 'mods/a.pw.toml'), '# edited\n');
  assert.throws(() => plan(stale, { ...lock, source: { fingerprint: fingerprint(fixturePack(t)) } }), /stale lock/);
});

function fakeHttp(routes) {
  return async (url) => {
    const r = routes[url];
    if (!r) return { ok: false, status: 404, text: async () => '' };
    const body = Buffer.isBuffer(r.body) ? r.body : Buffer.from(typeof r.body === 'string' ? r.body : JSON.stringify(r.body));
    return { ok: true, status: 200, url: r.final || url, headers: { get: (k) => (k === 'etag' ? r.etag || null : null) },
      text: async () => body.toString('utf8'), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length) };
  };
}

test('downloads are verified against the publisher and wrong tags are rejected', async (t) => {
  const dir = tmp(t);
  const jar = Buffer.from('real jar bytes');
  const mrVersion = (hashes, loaders = ['neoforge']) => ({ project_id: 'P', version_number: '1', version_type: 'release', loaders, game_versions: ['1.21.1'],
    files: [{ primary: true, filename: 'a.jar', url: 'https://cdn.modrinth.com/a.jar', size: jar.length, hashes }] });
  const good = { sha1: h('sha1', jar), sha512: h('sha512', jar) };
  const run = (routes, sel, name) => resolveSelector(sel, { api: client({ rawDir: path.join(dir, name), http: fakeHttp(routes) }), cacheDir: path.join(dir, `${name}-cache`), folder: 'mods', tags: { minecraft: '1.21.1', loader: 'neoforge' } });
  const r = await run({ 'https://api.modrinth.com/v2/version/V': { body: mrVersion(good) }, 'https://cdn.modrinth.com/a.jar': { body: jar } }, { source: 'modrinth', project: 'P', version: 'V' }, 'ok');
  assert.equal(r.fields.sha256, h('sha256', jar));
  await assert.rejects(run({ 'https://api.modrinth.com/v2/version/V': { body: mrVersion({ ...good, sha512: '0'.repeat(128) }) }, 'https://cdn.modrinth.com/a.jar': { body: jar } }, { source: 'modrinth', project: 'P', version: 'V' }, 'hash'), /hash mismatch/);
  await assert.rejects(run({ 'https://api.modrinth.com/v2/version/V': { body: mrVersion(good, ['forge']) } }, { source: 'modrinth', project: 'P', version: 'V' }, 'loader'), /not tagged neoforge/);
  const cfInfo = (len) => ({ data: { projectId: 9, fileName: 'c.jar', fileLength: len, gameVersions: ['1.21.1', 'NeoForge'], releaseType: 1, displayName: 'C' } });
  const cfRoutes = (len, etag) => ({ 'https://www.curseforge.com/api/v1/mods/9/files/7': { body: cfInfo(len) },
    'https://www.curseforge.com/api/v1/mods/9/files/7/download': { body: jar, etag, final: 'https://mediafilez.forgecdn.net/files/7/c.jar' } });
  const cf = await run(cfRoutes(jar.length, `"${h('md5', jar)}"`), { source: 'curseforge', project: '9', file: '7' }, 'cf');
  assert.equal(cf.fields.publisher.md5, h('md5', jar));
  await assert.rejects(run(cfRoutes(jar.length + 1), { source: 'curseforge', project: '9', file: '7' }, 'cfsize'), /size mismatch/);
  await assert.rejects(run(cfRoutes(jar.length, `"${'0'.repeat(32)}"`), { source: 'curseforge', project: '9', file: '7' }, 'cfmd5'), /MD5 mismatch/);
});

test('resource packs keep a pin already tagged for the target, else take the newest tagged release', () => {
  const versions = [{ id: 'A', game_versions: ['1.20.1'], version_type: 'release', date_published: '1' },
    { id: 'B', game_versions: ['1.21.1'], version_type: 'release', date_published: '2', version_number: '2' },
    { id: 'C', game_versions: ['1.21.1'], version_type: 'beta', date_published: '3' }];
  assert.equal(packSelector({ source: 'modrinth', project: 'P', version: 'B' }, versions, '1.21.1').action, 'retain');
  assert.deepEqual(packSelector({ source: 'modrinth', project: 'P', version: 'A' }, versions, '1.21.1').selector, { source: 'modrinth', project: 'P', version: 'B' });
  assert.equal(packSelector({ source: 'modrinth', project: 'P', version: 'A' }, versions.slice(0, 1), '1.21.1'), null);
});

test('the committed target lock covers this checkout exactly while its source is current', (t) => {
  const file = path.join(REPO, 'tools/packwiz/migration/target-lock.json');
  if (!fs.existsSync(file)) return t.skip('no lock yet');
  const lock = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (lock.source.fingerprint !== fingerprint(REPO)) {
    // Applied (Phase 5 onward): the checkout must be exactly the lock's target state.
    assert.deepEqual(require('../../migration/repoint.cjs').appliedDifferences(REPO, lock), []);
    assert.equal(fs.readFileSync(file, 'utf8'), serialize(lock));
    return;
  }
  const sources = sourceMetafiles(REPO);
  assert.deepEqual(validate(lock, sources), []);
  assert.equal(lock.entries.filter(e => e.action !== 'add' && e.metafile.startsWith('mods/')).length, sources.filter(s => s.startsWith('mods/')).length);
  assert.equal(lock.closure.errors, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), serialize(lock), 'the lock is stored in its canonical serialization');
});

test('a bundled Forge-metadata game library is ignored like NeoForge ignores it; other bundled Forge jars warn', () => {
  const lib = { source: 'host.jar!lib.jar', loader: 'forge', bundled: true, modType: 'GAMELIBRARY', mods: [mod('mixinsquared', '0.3.7', [dep('forge', 'required', '[47,)')])] };
  const odd = { ...lib, source: 'host.jar!odd.jar', modType: null, mods: [mod('odd', '1')] };
  const r = checkClosure([{ key: 'mods/host', side: 'both', units: [unit([mod('host', '1')]), lib] }], rt);
  assert.deepEqual([r.errors, r.warnings], [[], []]);
  assert.equal(r.providers.has('mixinsquared'), false, 'NeoForge does not register a mods.toml mod id');
  const w = checkClosure([{ key: 'mods/host', side: 'both', units: [unit([mod('host', '1')]), odd] }], rt);
  assert.match(w.warnings[0], /bundled host\.jar!odd\.jar carries Forge-only metadata/);
});

test('after apply, an updated lock re-resolves from its recorded source commit and applies as an update', (t) => {
  const { execFileSync } = require('node:child_process');
  const { exportSource, sourceRoot } = require('../../migration/source_tree.cjs');
  const { planApplied } = require('../../migration/repoint.cjs');
  const root = fixturePack(t);
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q'); git('add', '.'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'source');
  const commit = String(git('rev-parse', 'HEAD')).trim();
  const lock = lockOf([
    { metafile: 'mods/a.pw.toml', action: 'repoint', old, target: target(), rationale: 'r' },
    { metafile: 'mods/gone.pw.toml', action: 'defer', old, target: null, rationale: 'port' }
  ], fingerprint(root));
  lock.source.commit = commit;
  apply(root, plan(root, lock));
  // Resolving now reads the source from git, not the applied checkout.
  const src = sourceRoot({ root, lock, scratch: path.join(tmp(t), 'src') });
  assert.equal(src.commit, commit);
  assert.equal(fingerprint(src.root), lock.source.fingerprint);
  assert.deepEqual(sourceMetafiles(src.root), ['mods/a.pw.toml', 'mods/gone.pw.toml']);
  assert.deepEqual(sourceRoot({ root: src.root, lock }), { root: src.root, commit: null }, 'a checkout that is still the source resolves in place');
  assert.throws(() => sourceRoot({ root, lock: { ...lock, source: { fingerprint: 'x', commit } }, scratch: path.join(tmp(t), 's2') }), /not the lock's x/);
  assert.throws(() => sourceRoot({ root, lock: { ...lock, source: { fingerprint: 'x' } } }), /records no source commit/);
  exportSource(root, commit, path.join(tmp(t), 'again'));
  // The port returns: defer becomes a direct pin; only that metafile is written on the applied checkout.
  const ported = target({ metafile: 'mods/gone.pw.toml', source: 'direct', project: undefined, version: undefined, sha512: undefined,
    url: 'https://github.com/o/r/releases/download/v1/g.jar', filename: 'g.jar' });
  const updated = { ...lock, entries: [lock.entries[0], { ...lock.entries[1], action: 'repoint', target: ported }] };
  const changes = planApplied(root, updated);
  assert.deepEqual(changes.writes.map((w) => w.rel), ['mods/gone.pw.toml']);
  assert.doesNotMatch(changes.writes[0].text, /\[update/);
  assert.deepEqual(changes.deletes, []);
  fs.writeFileSync(path.join(root, 'mods/stray.pw.toml'), 'x');
  assert.throws(() => planApplied(root, updated), /does not account for:\n {2}mods\/stray\.pw\.toml/);
});
