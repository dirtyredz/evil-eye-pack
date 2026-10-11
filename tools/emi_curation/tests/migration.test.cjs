'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const m = require('../migrate_rei.cjs');

function tempCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-curation-'));
  for (const g of m.GROUPS) fs.copyFileSync(path.join(m.CURATION_DIR, g.file), path.join(dir, g.file));
  return dir;
}

function mutate(dir, file, fn) {
  const p = path.join(dir, file);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  fn(doc);
  fs.writeFileSync(p, JSON.stringify(doc));
}

test('the five lists equal the 1,759 REI source ids exactly, with expected group counts', () => {
  const r = m.check(m.FIXTURE, m.CURATION_DIR);
  assert.deepEqual(r.problems, []);
  assert.equal(r.sourceCount, 1759);
  assert.equal(r.unionCount, 1759);
  assert.deepEqual(m.GROUPS.map((g) => g.expected), [20, 654, 708, 16, 361]);
});

test('unfamiliar serialized stacks are rejected, not guessed at', () => {
  assert.equal(m.parseStack('{type:"minecraft:item",id:"ae2:creative_item_cell",Count:1b}'), 'ae2:creative_item_cell');
  assert.throws(() => m.parseStack('{type:"minecraft:item",id:"enderio:filled_soul_vial",Count:1b,tag:{a:1b}}'));
  assert.throws(() => m.parseStack('{type:"minecraft:fluid",id:"minecraft:water",Count:1b}'));
  assert.throws(() => m.parseStack('{type:"minecraft:item",id:"minecraft:stone",Count:2b}'));
  assert.throws(() => m.parseStack('{id:"minecraft:stone",type:"minecraft:item",Count:1b}'));
  assert.throws(() => m.parseStack('{type:"minecraft:item",id:"Bad:ID",Count:1b}'));
});

test('a missing id is reported', () => {
  const dir = tempCopy();
  mutate(dir, 'colours.json', (d) => d.items.pop());
  const r = m.check(m.FIXTURE, dir);
  assert.ok(r.problems.some((p) => p.startsWith('missing from curation lists')));
});

test('an extra id is reported', () => {
  const dir = tempCopy();
  mutate(dir, 'creative.json', (d) => d.items.push('minecraft:stone'));
  const r = m.check(m.FIXTURE, dir);
  assert.ok(r.problems.some((p) => p.startsWith('extra id not in REI source: minecraft:stone')));
});

test('a duplicate across lists is reported', () => {
  const dir = tempCopy();
  mutate(dir, 'creative.json', (d) => d.items.push('allthecompressed:acacia_log_4x'));
  const r = m.check(m.FIXTURE, dir);
  assert.ok(r.problems.some((p) => p.startsWith('duplicate id allthecompressed:acacia_log_4x')));
});

test('a wrong schema version is rejected', () => {
  const dir = tempCopy();
  mutate(dir, 'compressed.json', (d) => { d.schema = 2; });
  assert.throws(() => m.check(m.FIXTURE, dir), /schema must be 1/);
});

test('duplicate source entries are rejected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-fixture-'));
  const line = '\t\t\t\t"{type:\\"minecraft:item\\",id:\\"minecraft:stone\\",Count:1b}",\n';
  const fixture = path.join(dir, 'f.json5');
  fs.writeFileSync(fixture, '{\n"filteredStacks": [\n' + line + line + '\t\t\t],\n}\n');
  assert.throws(() => m.readSourceIds(fixture), /duplicate source id/);
});
