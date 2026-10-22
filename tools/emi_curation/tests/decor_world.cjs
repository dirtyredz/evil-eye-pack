'use strict';
// Shared DECOR test world: named decor and non-decor stacks, EMI tag registries filled, booted.

const { boot } = require('./harness.cjs');
const { fixture } = require('./fixture.cjs');
const F = require('./fake_emi.cjs');

function decorWorld() {
  const fx = fixture();
  const reg = new Map();
  const item = (id) => { if (!reg.has(id)) reg.set(id, new F.Item(id)); return reg.get(id); };
  const S = (id) => new F.EmiStack(item(id));
  const d = {
    table: S('handcrafted:oak_table'),
    roof: S('mcwroofs:oak_roof'),
    armchair: S('herbalwitch:decor/seating/armchair/natural/birch'),
    mortar: S('herbalwitch:mortar'),
    stairs: S('minecraft:oak_stairs'),
    slab: S('minecraft:birch_slab'),
    modStairs: S('somemod:marble_stairs'),
    pane: S('glassmod:clear_pane'),
    faucet: S('supplementaries:faucet'),
    easel: S('xercapaint:item_easel'),
    cog: S('create:cog'),
  };
  fx.spec.items.push(...Object.values(d));
  const I = F.ingredient;
  fx.spec.recipes.push(new F.Recipe('r:decor', 'cat', [I(d.stairs)], [d.cog]), new F.Recipe('r:to_decor', 'cat', [I(d.cog)], [d.table]));
  return { fx, d, item };
}

function bootDecor(opts) {
  const w = decorWorld();
  const c = boot({ fixture: w.fx, noReload: true, files: opts && opts.files });
  c.world.tags.item['minecraft:stairs'] = [w.item('minecraft:oak_stairs')];
  c.world.tags.item['forge:glass_panes'] = [w.item('glassmod:clear_pane')];
  c.world.tags.block['minecraft:slabs'] = [new F.Block(w.item('minecraft:birch_slab'))];
  c.world.tags.block['minecraft:stairs'] = [new F.Block(w.item('minecraft:oak_stairs')), new F.Block(w.item('somemod:marble_stairs'))];
  c.world.reload(); c.world.finishWorker();
  c.d = w.d;
  c.tick();
  return c;
}

const names = (c) => c.ids(c.world.EmiStackList.filteredStacks);
const DECOR_IDS = ['handcrafted:oak_table', 'mcwroofs:oak_roof', 'herbalwitch:decor/seating/armchair/natural/birch', 'minecraft:oak_stairs', 'minecraft:birch_slab', 'somemod:marble_stairs', 'glassmod:clear_pane', 'xercapaint:item_easel'];
const KEPT_IDS = ['herbalwitch:mortar', 'supplementaries:faucet', 'create:cog', 'minecraft:stone'];

module.exports = { decorWorld, bootDecor, names, DECOR_IDS, KEPT_IDS };
