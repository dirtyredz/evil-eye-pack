'use strict';
// Test world data: the named stacks and recipes the EMI curation tests drive.

const F = require('./fake_emi.cjs');

const ZOMBIE = { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie' } } } };
const VILLAGER = { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie_villager' } } } };

/** One fake EMI world: items, recipes, and the named stacks/recipes used by the tests. */
function fixture() {
  // One Item object per id, as in the registry, so NBT variants share their key.
  const registry = new Map();
  const S = (id, nbt) => {
    if (!registry.has(id)) registry.set(id, new F.Item(id));
    return new F.EmiStack(registry.get(id), nbt);
  };
  const s = {
    stone: S('minecraft:stone'),
    cell: S('ae2:creative_item_cell'),
    egg: S('minecraft:zombie_spawn_egg'),
    door: S('dramaticdoors:tall_oak_door'),
    zombieVial: S('enderio:filled_soul_vial', ZOMBIE),
    villagerVial: S('enderio:filled_soul_vial', VILLAGER),
    emptyVial: S('enderio:empty_soul_vial'),
    glass: S('enderio:clear_glass_a'),
    c1: S('create:zinc_ingot'),
    water: new F.EmiStack(new F.Fluid('minecraft:water')),
    removed: S('removedmod:thing'),
  };
  const I = F.ingredient;
  const R = (id, ins, outs, cats) => new F.Recipe(id, 'cat', ins, outs, cats);
  const r = {
    visible: R('r:visible', [I(s.stone)], [s.c1]),
    hiddenOut: R('r:hidden_out', [I(s.c1)], [s.glass]),
    hiddenIn: R('r:hidden_in', [I(s.cell)], [s.stone]),
    mixed: R('r:mixed', [I(s.cell, s.stone)], [s.c1]),
    catalyst: R('r:catalyst', [I(s.stone)], [s.c1], [I(s.cell)]),
    intrinsic: R('r:intrinsic', [I(s.removed)], [s.stone]),
    multi: R('r:multi', [I(s.stone)], [s.c1, s.egg]),
    empty: R('r:empty', [I(), I(s.stone)], [s.c1]),
    zombie: R('r:zombie', [I(s.emptyVial)], [s.zombieVial]),
    villager: R('r:villager', [I(s.emptyVial)], [s.villagerVial]),
    fluid: R('r:fluid', [I(s.water)], [s.stone]),
  };
  const items = [s.stone, s.cell, s.egg, s.door, s.zombieVial, s.villagerVial, s.emptyVial, s.glass, s.c1, s.water];
  return { s, r, spec: { items, recipes: Object.values(r) } };
}

module.exports = { fixture };
