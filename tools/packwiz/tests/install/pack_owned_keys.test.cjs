'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadEntries, applyOwnedKeys, setToml } = require('../../install/pack_owned_keys.cjs');
const ROOT = path.resolve(__dirname, '../../../..');

test('pack-owned keys that target a shipped file match the shipped bytes', () => {
  for (const e of loadEntries().filter(x => x.format === 'json' && fs.existsSync(path.join(ROOT, x.file)))) {
    let node = JSON.parse(fs.readFileSync(path.join(ROOT, e.file), 'utf8'));
    for (const s of e.section) node = node[s];
    assert.equal(node[e.key], e.value, `${e.file} ${e.key} must equal the owned value`);
  }
});

test('sync never creates retired IPN configs or changes owner-local data', () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owned-retired-'));
 try {
  const file=path.join(dir,'config/inventoryprofilesnext/inventoryprofiles.json');applyOwnedKeys(dir);assert.equal(fs.existsSync(file),false);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'{"owner":true}');applyOwnedKeys(dir);
  assert.equal(fs.readFileSync(file,'utf8'),'{"owner":true}');assert.deepEqual(applyOwnedKeys(dir),[]);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('TOML setter replaces in place and keeps other tables', () => {
  const out = setToml('[general]\n\ta = 1\n[misc]\n\t#c\n\thotbar_slot_animation_speed = 2.5\n\tb = 2\n',
    { section: ['misc'], key: 'hotbar_slot_animation_speed', value: 0.0 });
  assert.equal(out, '[general]\n\ta = 1\n[misc]\n\t#c\n\thotbar_slot_animation_speed = 0.0\n\tb = 2\n');
});

test('TOML setter handles top-level keys (empty section) without touching tables', () => {
  const stale = '#c\nbackend = "INSTANCING"\nlimitUpdates = true\n\n[flw_backends]\n\tbackend = "x"\n';
  const out = setToml(stale, { section: [], key: 'backend', value: 'DEFAULT' });
  assert.equal(out, '#c\nbackend = "DEFAULT"\nlimitUpdates = true\n\n[flw_backends]\n\tbackend = "x"\n');
  assert.equal(setToml('[t]\n\ta = 1\n', { section: [], key: 'k', value: 'v' }), 'k = "v"\n[t]\n\ta = 1\n');
});

test('Flywheel backend is a registered Flywheel 1.0 id in the shipped config and the owned keys', () => {
  const owned = loadEntries().find(x => x.file === 'config/flywheel-client.toml' && x.key === 'backend');
  assert.equal(owned.value, 'DEFAULT');
  const shipped = fs.readFileSync(path.join(ROOT, 'config/flywheel-client.toml'), 'utf8');
  assert.match(shipped, /^backend = "DEFAULT"$/m, 'legacy "INSTANCING" parses as minecraft:INSTANCING and is not registered');
});

test('preserved client configuration enables all owned inventory actions', () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owned-inventory-'));
 try {applyOwnedKeys(dir);const client=fs.readFileSync(path.join(dir,'config/evileye_client-client.toml'),'utf8');
  for(const section of ['sorting','transfer','refill']) assert.match(client,new RegExp('\\['+section+'\\]\\n\\s*enabled = true'));
  assert.deepEqual(applyOwnedKeys(dir),[]);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('integer owned TOML values retain their type on insertion and replacement', () => {
  const entry = { section: ['actionRail'], key: 'offsetX', value: 0, tomlType: 'integer' };
  assert.match(setToml('', entry), /offsetX = 0\n/);
  assert.equal(setToml('[actionRail]\n  offsetX = 12\n', entry), '[actionRail]\n  offsetX = 0\n');
});

test('Stable preserved configs receive the rail and left effects without resetting personal settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owned-rail-'));
  const file = path.join(dir, 'config/evileye_client-client.toml');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '[effects.hud]\n screenSideRight = true\n[effects.inventory]\n screenSideRight = true\n[sidebar]\n enabled = false\n[actionRail]\n enabled = false\n side = "LEFT"\n offsetX = 12\n offsetY = -8\n');
    applyOwnedKeys(dir);
    const installed = fs.readFileSync(file, 'utf8');
    for (const [section, key, value] of [
      ['effects.inventory', 'screenSideRight', 'false'],
      ['actionRail', 'enabled', 'true'], ['actionRail', 'side', '"RIGHT"'],
      ['actionRail', 'offsetX', '0'], ['actionRail', 'offsetY', '0']
    ]) {
      const table = text => text.split(`[${section}]`)[1]?.split(/\n\s*\[/)[0];
      const expected = new RegExp(`^\\s*${key} = ${value}$`, 'm');
      assert.match(table(installed), expected);
      assert.match(table(fs.readFileSync(path.join(ROOT, 'config/evileye_client-client.toml'), 'utf8')), expected);
    }
    assert.match(installed, /\[effects.hud\]\n screenSideRight = true/);
    assert.match(installed, /\[sidebar\]\n enabled = false/);
    assert.deepEqual(applyOwnedKeys(dir), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Stable preserved configs get the pink second heart row and the shipped colours match', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owned-hearts-'));
  const file = path.join(dir, 'config/evileye_client-client.toml');
  const colors = text => JSON.parse(text.split('[health.hearts]')[1].match(/^\s*colors = (\[.*\])$/m)[1]);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '[health]\n\t[health.hearts]\n\t\tvanillaHearts = true\n\t\tcolors = ["#F06E14", "#F5DC23"]\n\t\tpoisonedColors = ["#739B00"]\n');
    applyOwnedKeys(dir);
    const installed = fs.readFileSync(file, 'utf8');
    const shipped = colors(fs.readFileSync(path.join(ROOT, 'config/evileye_client-client.toml'), 'utf8'));
    assert.equal(shipped[0], '#FA7DEB');
    assert.equal(shipped[5], '#F06E14');
    assert.deepEqual(colors(installed), shipped);
    assert.match(installed, /poisonedColors = \["#739B00"\]/);
    assert.deepEqual(applyOwnedKeys(dir), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
