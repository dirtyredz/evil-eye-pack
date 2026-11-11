'use strict';
// options.txt owned-key format: forces key_key.modernui.zoom to Z and nothing else.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadEntries, applyOwnedKeys, previewOwnedKeys, setOptions } = require('../../install/pack_owned_keys.cjs');

const entry = { key: 'key_key.modernui.zoom', value: 'key.keyboard.z' };
const WANT = 'key_key.modernui.zoom:key.keyboard.z';

function withOptions(content, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owned-options-'));
  const file = path.join(dir, 'options.txt');
  try {
    if (content !== null) fs.writeFileSync(file, content);
    fn(dir, file);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('the shipped owned-key list forces exactly the Modern UI zoom key in options.txt', () => {
  const owned = loadEntries().filter(e => e.format === 'options');
  assert.deepEqual(owned.map(e => [e.file, e.key, e.value]), [['options.txt', 'key_key.modernui.zoom', 'key.keyboard.z']]);
});

test('absent options.txt is not created (fresh instances get Z from defaultoptions)', () => {
  withOptions(null, (dir, file) => {
    assert.ok(!applyOwnedKeys(dir).includes('options.txt'));
    assert.equal(fs.existsSync(file), false);
    assert.equal(previewOwnedKeys(dir).some(l => l.startsWith('options.txt')), false);
  });
});

test('absent key is appended, honouring the final newline and the file line ending', () => {
  assert.equal(setOptions('fov:70\n', entry), `fov:70\n${WANT}\n`);
  assert.equal(setOptions('fov:70', entry), `fov:70\n${WANT}`);
  assert.equal(setOptions('fov:70\r\nlang:en_us\r\n', entry), `fov:70\r\nlang:en_us\r\n${WANT}\r\n`);
});

test('saved C binding becomes Z; unrelated lines and CRLF stay byte-identical on disk', () => {
  const before = 'fov:70\r\nkey_key.modernui.zoom:key.keyboard.c\r\nkey_key.jump:key.keyboard.space\r\nlastServer:\r\n';
  withOptions(before, (dir, file) => {
    assert.deepEqual(previewOwnedKeys(dir).filter(l => l.startsWith('options.txt')), ['options.txt key_key.modernui.zoom']);
    assert.equal(fs.readFileSync(file, 'utf8'), before, 'preview must not write');
    assert.ok(applyOwnedKeys(dir).includes('options.txt'));
    assert.deepEqual(fs.readFileSync(file), Buffer.from(`fov:70\r\n${WANT}\r\nkey_key.jump:key.keyboard.space\r\nlastServer:\r\n`));
  });
});

test('saved modifier variants are replaced whole; similarly named keys are untouched', () => {
  for (const saved of ['key.keyboard.c:SHIFT', 'key.keyboard.z:CONTROL', 'key.keyboard.c:CONTROL,SHIFT', 'key.keyboard.unknown']) {
    const out = setOptions(`key_key.modernui.zoom:${saved}\nkey_key.modernui.zoom_out:key.keyboard.x\nxkey_key.modernui.zoom:key.keyboard.c\n`, entry);
    assert.equal(out, `${WANT}\nkey_key.modernui.zoom_out:key.keyboard.x\nxkey_key.modernui.zoom:key.keyboard.c\n`, saved);
  }
});

test('duplicate key lines are all forced in place', () => {
  const out = setOptions(`a:1\nkey_key.modernui.zoom:key.keyboard.c\nb:2\nkey_key.modernui.zoom:key.keyboard.v:SHIFT\n`, entry);
  assert.equal(out, `a:1\n${WANT}\nb:2\n${WANT}\n`);
});

test('a second run is a no-op', () => {
  for (const start of ['fov:70\n', 'key_key.modernui.zoom:key.keyboard.c\r\nfov:70\r\n', `${WANT}\n`]) {
    withOptions(start, (dir, file) => {
      applyOwnedKeys(dir);
      const once = fs.readFileSync(file);
      assert.ok(!applyOwnedKeys(dir).includes('options.txt'));
      assert.deepEqual(previewOwnedKeys(dir).filter(l => l.startsWith('options.txt')), []);
      assert.deepEqual(fs.readFileSync(file), once);
    });
  }
});
