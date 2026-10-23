'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkMachines } = require('../checks/machines.cjs');

const recs = (type, n) => Array.from({ length: n }, (_, i) => ({ id: `${type}/${i}`, type, ings: [], out: 'a:o' }));
const run = (recipes, config, tags = new Map()) => checkMachines(recipes, tags, { types: {}, assertions: [], ...config });
const codes = (r) => r.findings.map((f) => `${f.code}:${f.severity}`);

test('type counts: missing, below floor, changed and steady', () => {
  const types = { 'm:gone': { min: 1 }, 'm:low': { min: 5 }, 'm:chg': { min: 1, observed: 10 }, 'm:ok': { min: 1, observed: 3 } };
  const r = run([...recs('m:low', 2), ...recs('m:chg', 12), ...recs('m:ok', 3)], { types });
  assert.deepEqual(codes(r), ['type-missing:fail', 'type-below-floor:fail', 'type-count-changed:info']);
  assert.equal(r.counts['m:chg'], 12);
  assert.equal(r.state, 'findings');
});

test('count change alone is info and the run passes', () => {
  const r = run(recs('m:t', 4), { types: { 'm:t': { min: 1, observed: 3 } } });
  assert.equal(r.state, 'passed');
});

test('a type marked varies reports no count change but still enforces its floor', () => {
  const types = { 'm:v': { min: 5, observed: 10, varies: 'boot-dependent' } };
  assert.deepEqual(codes(run(recs('m:v', 7), { types })), []);
  assert.deepEqual(codes(run(recs('m:v', 4), { types })), ['type-below-floor:fail']);
});

const tags = new Map([['c:t', ['a:i']]]);
const rule = (a, recipes = []) => codes(run(recipes, { assertions: [a] }, tags));

test('tag-contains passes and fails', () => {
  assert.deepEqual(rule({ kind: 'tag-contains', tag: 'c:t', item: 'a:i' }), []);
  assert.deepEqual(rule({ kind: 'tag-contains', tag: 'c:t', item: 'a:x' }), ['assert-tag-contains:fail']);
});

test('recipe-loaded and recipe-not-loaded', () => {
  const r = [{ id: 'r:1', type: 't', ings: [] }];
  assert.deepEqual(rule({ kind: 'recipe-loaded', id: 'r:1' }, r), []);
  assert.deepEqual(rule({ kind: 'recipe-loaded', id: 'r:2' }, r), ['assert-recipe-loaded:fail']);
  assert.deepEqual(rule({ kind: 'recipe-not-loaded', id: 'r:2' }, r), []);
  assert.deepEqual(rule({ kind: 'recipe-not-loaded', id: 'r:1' }, r), ['assert-recipe-not-loaded:fail']);
});

test('recipe-uses-tag reads ingredient JSON', () => {
  const r = [{ id: 'r:1', type: 't', ings: [{ j: '{"tag":"c:t"}' }] }];
  assert.deepEqual(rule({ kind: 'recipe-uses-tag', id: 'r:1', tag: 'c:t' }, r), []);
  assert.deepEqual(rule({ kind: 'recipe-uses-tag', id: 'r:1', tag: 'c:other' }, r), ['assert-recipe-uses-tag:fail']);
  assert.deepEqual(rule({ kind: 'recipe-uses-tag', id: 'missing', tag: 'c:t' }, r), ['assert-recipe-uses-tag:fail']);
});

test('recipe-output checks r.out and nested JSON outputs', () => {
  const r = [{ id: 'r:1', type: 't', out: 'a:direct', json: { results: [{ item: { item: 'a:nested', count: 1 } }] } }];
  assert.deepEqual(rule({ kind: 'recipe-output', id: 'r:1', item: 'a:direct' }, r), []);
  assert.deepEqual(rule({ kind: 'recipe-output', id: 'r:1', item: 'a:nested' }, r), []);
  assert.deepEqual(rule({ kind: 'recipe-output', id: 'r:1', item: 'a:nope' }, r), ['assert-recipe-output:fail']);
});

test('a failed assertion carries its why; unknown kinds fail', () => {
  const r = run([], { assertions: [{ kind: 'recipe-loaded', id: 'r:9', why: 'because' }, { kind: 'bogus', id: 'x' }] });
  assert.match(r.findings[0].message, /\(because\)/);
  assert.match(r.findings[1].message, /unknown assertion kind/);
});
