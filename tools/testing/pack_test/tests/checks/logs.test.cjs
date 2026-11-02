'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resourceFailures, checkLogs } = require('../../checks/logs.cjs');

const mods = new Set(['minecraft', 'cataclysm', 'thirst', 'cozycafe', 'dramaticdoors']);
const tag = (name, refs) => `[23Oct2026 00:26:51.102] [Worker-Main-3/ERROR] [net.minecraft.tags.TagLoader/]: Couldn't load tag ${name} as it is missing following references: ${refs}`;
const TAG_LOADED = tag('cataclysm:sunken_city_avoid', 'minecraft:monument (from L_Enders_Cataclysm-1.28-1.20.1.jar)');
const TAG_ABSENT = tag('cataclysm:other', 'gone:thing (from x.jar), gone:other (from y.jar)');
const LOOT = [
  "[23Oct2026 00:26:52.957] [Worker-Main-7/ERROR] [net.minecraftforge.common.ForgeHooks/]: Couldn't parse element loot_tables:thirst:chests/bastion_other_bc",
  "com.google.gson.JsonSyntaxException: Expected name to be an item, was unknown string 'brewinandchewin:red_rum'"
].join('\n');
const DATA = "[23Oct2026 00:26:51.264] [Worker-Main-3/ERROR] [net.minecraft.server.packs.resources.SimpleJsonResourceReloadListener/]: Couldn't parse data file cozycafe:vinery/kelp_cider from cozycafe:menu/vinery/kelp_cider.json";
const KUBE = [
  '[00:26:54] [WARN] Error parsing recipe dramaticdoors:tall_lead_door[minecraft:crafting_shaped]: {"type":"minecraft:crafting_shaped","key":{}}: Index 0 out of bounds for length 0',
  "[00:26:54] [WARN] Failed to parse recipe 'dramaticdoors:short_silver_door[minecraft:stonecutting]'! Falling back to vanilla: Ingredient 'ingredient' can't be empty!",
  '[00:27:00] [ERROR] some script error 12',
  '[00:27:01] [ERROR] some script error 34'
].join('\n');

const run = (latest, kube = '') => checkLogs(latest, kube, [], mods);
const by = (r, code) => r.findings.filter((f) => f.code === code);

test('tag failure naming loaded namespaces fails and is recorded as dropped', () => {
  const r = run(TAG_LOADED);
  assert.equal(by(r, 'tag-load-failed')[0].severity, 'fail');
  assert.equal(by(r, 'tag-load-failed')[0].subject, '#cataclysm:sunken_city_avoid');
  assert.deepEqual([...r.droppedTags], ['cataclysm:sunken_city_avoid']);
  assert.equal(r.state, 'findings');
});

test('tag failure naming only absent mods is optional-compat info', () => {
  const r = run(TAG_ABSENT);
  assert.equal(by(r, 'tag-optional-compat')[0].severity, 'info');
  assert.equal(r.state, 'passed');
});

test('loot failure naming an absent mod is optional-compat info', () => {
  const r = run(LOOT);
  assert.equal(by(r, 'loot-optional-compat').length, 1);
  assert.equal(r.lootFailures.get('thirst:chests/bastion_other_bc'), "Expected name to be an item, was unknown string 'brewinandchewin:red_rum'");
});

test('loot failure naming only loaded mods fails', () => {
  const r = run(LOOT.replace('brewinandchewin', 'thirst'));
  assert.equal(by(r, 'loot-parse-error')[0].severity, 'fail');
});

test('data parse failure is reported with its file', () => {
  const f = by(run(DATA), 'data-parse-error')[0];
  assert.equal(f.subject, 'cozycafe:vinery/kelp_cider');
  assert.equal(f.ref, 'cozycafe:menu/vinery/kelp_cider.json');
});

test('KubeJS recipe failures are mapped by id with their messages', () => {
  const r = run('', KUBE);
  assert.equal(r.recipeFailures.get('dramaticdoors:tall_lead_door'), 'Index 0 out of bounds for length 0');
  assert.match(r.recipeFailures.get('dramaticdoors:short_silver_door'), /^fallback: Ingredient/);
  assert.equal(r.stats.recipeFailures, 2);
});

test('kubejs errors dedupe by digit-normalized signature', () => {
  const k = by(run('', KUBE), 'kubejs-error');
  assert.equal(k.length, 1);
  assert.equal(k[0].subject, 'some script error #');
});

test('resourceFailures on empty logs is empty', () => {
  const r = resourceFailures('', '');
  assert.equal(r.tagFailures.length + r.dataFailures.length + r.kubeErrors.length, 0);
});
