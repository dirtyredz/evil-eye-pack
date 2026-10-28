'use strict';
// Shared fixtures for the mod map tests (not matched by the tests/*/*.test.cjs glob).
const { categorize } = require('../model/categories.cjs');
const categoryMapping = require('../model/categories.json');

const node = (key, dependencies = []) => ({ key, name: key, mods: [{ id: key, name: key, description: 'A mod', dependencies: [] }], dependencies, bundled: [], side: 'both' });
const registries = keys => ({ items: keys.map(key => key + ':item'), blocks: [], entities: [] });
// Finished page data as run.cjs builds it: family model plus categories.
function pageData(nodes, model, { timing = { mods: {}, warnings: [] }, registries: regs = {} } = {}) {
  const data = { nodes, ...model, timing, registries: regs, boot: { wallSeconds: 1 }, warnings: [], identity: {}, pins: [], created: 'now' };
  data.categories = categorize(data, categoryMapping, nodes, timing);
  return data;
}
module.exports = { node, registries, pageData };
