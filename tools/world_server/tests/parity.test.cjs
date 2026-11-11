'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { serverMods, compareMods, verifyStagedMods } = require('../../server_stage/mod-set.cjs');
const { checkParity, readDeployed } = require('../check-parity.cjs');

// Synthetic packwiz fixture: no jars downloaded, no stage installer or JVM invoked.
function fixture(t) {
  const base = path.resolve(__dirname, '../../../.tmp');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'parity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'mods'));
  const entries = [];
  for (const [name, side] of [['shared', 'both'], ['dedicated', 'server'], ['visual', 'client'], ['default', null]]) {
    const bytes = Buffer.from(name), hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const text = `filename = "${name}.jar"\n${side ? `side = "${side}"\n` : ''}[download]\nhash-format = "sha256"\nhash = "${hash}"\nmode = "metadata:local"\n`;
    fs.writeFileSync(path.join(root, 'mods', name + '.pw.toml'), text);
    entries.push(`[[files]]\nfile = "mods/${name}.pw.toml"\nhash = "${crypto.createHash('sha256').update(text).digest('hex')}"\nmetafile = true\n`);
  }
  fs.writeFileSync(path.join(root, 'index.toml'), 'hash-format = "sha256"\n' + entries.join('\n'));
  fs.writeFileSync(path.join(root, 'pack.toml'), '[index]\nfile = "index.toml"\nhash-format = "sha256"\n');
  const stage = path.join(root, 'stage');
  fs.mkdirSync(path.join(stage, 'mods'), { recursive: true });
  for (const name of ['shared', 'dedicated', 'default']) fs.writeFileSync(path.join(stage, 'mods', name + '.jar'), name);
  const manifest = path.join(root, 'deployed.json');
  function deploy(mods = serverMods(root)) { fs.writeFileSync(manifest, JSON.stringify({ version: 1, built: 'fixture', mods })); }
  return { root, stage, manifest, deploy };
}

test('staging and parity share both/server/default selection, including private pins', t => {
  const f = fixture(t);
  const expected = serverMods(f.root);
  assert.deepEqual(expected.map(m => m.file), ['dedicated.jar', 'default.jar', 'shared.jar']);
  assert.deepEqual(verifyStagedMods(f.root, f.stage), expected);
  f.deploy();
  assert.equal(checkParity(f.root, { manifest: f.manifest }).code, 0);
});
test('Connected Glass left deployed is removed; new server jar is added', t => {
  const f = fixture(t), expected = serverMods(f.root);
  f.deploy([...expected.filter(m => m.file !== 'dedicated.jar'), { ...expected[0], file: 'connected-glass.jar' }]);
  assert.deepEqual(checkParity(f.root, { manifest: f.manifest }), {
    code: 1, message: 'server needs Deploy: added dedicated.jar / removed connected-glass.jar'
  });
});
test('same filename with changed pin is a replacement, client-only change is ignored', t => {
  const f = fixture(t);
  f.deploy();
  fs.appendFileSync(path.join(f.root, 'mods/visual.pw.toml'), '# client edit\n');
  assert.equal(checkParity(f.root, { manifest: f.manifest }).code, 0);
  const deployed = serverMods(f.root);
  deployed[0].hash = 'f'.repeat(64);
  assert.deepEqual(compareMods(serverMods(f.root), deployed), { added: ['dedicated.jar'], removed: ['dedicated.jar'] });
});
test('stage rejects extra jars, missing jars and wrong bytes before manifest publication', t => {
  const f = fixture(t), extra = path.join(f.stage, 'mods/connected-glass.jar');
  fs.writeFileSync(extra, 'stale');
  assert.throws(() => verifyStagedMods(f.root, f.stage), /Unexpected staged server jars: connected-glass.jar/);
  fs.unlinkSync(extra);
  fs.writeFileSync(path.join(f.stage, 'mods/shared.jar'), 'changed');
  assert.throws(() => verifyStagedMods(f.root, f.stage), /differs from pin: shared.jar/);
  fs.unlinkSync(path.join(f.stage, 'mods/shared.jar'));
  assert.throws(() => verifyStagedMods(f.root, f.stage), /ENOENT/);
});
test('missing manifest and unreachable ANU skip explicitly; malformed evidence fails', t => {
  const f = fixture(t);
  assert.match(checkParity(f.root, { manifest: f.manifest }).message, /^SKIP server parity: deployed manifest unavailable/);
  assert.match(checkParity(f.root, { run: () => ({ status: 255 }) }).message, /^SKIP server parity: ANU unavailable/);
  assert.match(readDeployed({ run: () => ({ status: 0, stdout: 'EVIL_EYE_DEPLOY_MANIFEST_MISSING' }) }).skip, /manifest unavailable/);
  assert.match(readDeployed({ run: () => ({ error: Error('timeout') }) }).skip, /ANU unavailable/);
  fs.writeFileSync(f.manifest, '{');
  assert.throws(() => checkParity(f.root, { manifest: f.manifest }), SyntaxError);
  fs.writeFileSync(f.manifest, JSON.stringify({ version: 1, mods: null }));
  assert.throws(() => checkParity(f.root, { manifest: f.manifest }), /mods must be an array/);
  f.deploy([{ file: '../bad.jar', hashFormat: 'sha256', hash: '0'.repeat(64) }]);
  assert.throws(() => checkParity(f.root, { manifest: f.manifest }), /Invalid server mod manifest entry/);
});
test('SSH probe is bounded, read-only and returns the deployed receipt', t => {
  const f = fixture(t); f.deploy();
  const result = checkParity(f.root, { run: (exe, args, options) => {
    assert.equal(exe, 'ssh');
    assert.ok(args.includes('BatchMode=yes'));
    assert.equal(options.timeout, 8000);
    const script = Buffer.from(args.at(-1).split(' ').at(-1), 'base64').toString('utf16le');
    assert.match(script, /deployed-mods\.json/);
    assert.doesNotMatch(script, /server-ctl|anu-world-server|Set-Content|Copy-Item/);
    return { status: 0, stdout: fs.readFileSync(f.manifest, 'utf8') };
  } });
  assert.equal(result.code, 0);
});
