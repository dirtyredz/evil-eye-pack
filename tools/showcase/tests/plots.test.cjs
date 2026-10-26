'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function fixture() {
  const ctx = vm.createContext({ global: {} });
  for (const f of ['plan.js', 'rigs/create_contraption.js', 'plots.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../../kubejs/server_scripts/showcase', f), 'utf8'), ctx);
  const data = {}, server = { persistentData: { getString: k => data[k] || '', putString: (k, v) => { data[k] = v; } } };
  return { ns: ctx.global.evilEyeShowcase, server };
}
test('plot records round-trip complete rig data independently of the plan and registry', () => {
  const { ns, server } = fixture(), p = ns.plan(4, 5, 6), o = { x: 10, y: 20, z: 30 }, level = { dimension: 'overworld' };
  p.rig = ns.createContraption(); p.rig.glue.push([0, 0, 0, 1, 1, 1]);
  const key = ns.plotKey(level, o); assert.equal(key, 'overworld:10,20,30');
  ns.reservePlot(server, ns.records(server), key, level, p, o, 'test');
  p.rig.glue[0][0] = 2; o.x = 99;
  const r = ns.records(server)[key]; assert.equal(r.rig.glue[0][0], 0); assert.equal(r.origin.x, 10);
  assert.equal(r.rig.type, 'create_contraption'); assert.deepEqual(Array.from(r.rig.motors), []);
});
test('reservation drops intersecting volumes only, preserving touching and other-dimension plots', () => {
  const { ns, server } = fixture(), p = ns.plan(4, 5, 6), level = { dimension: 'overworld' };
  const put = (x, y, z, dimension = 'overworld') => { const o = { x, y, z }, l = { dimension }; ns.reservePlot(server, ns.records(server), ns.plotKey(l, o), l, p, o, 'test'); };
  put(0, 20, 0); put(4, 20, 0); put(0, 27, 0); put(0, 20, 0, 'nether');
  assert.equal(Object.keys(ns.records(server)).length, 4);
  put(1, 20, 0);
  const records = ns.records(server);
  assert.deepEqual(Object.keys(records).sort(), ['nether:0,20,0', 'overworld:0,27,0', 'overworld:1,20,0']);
});
