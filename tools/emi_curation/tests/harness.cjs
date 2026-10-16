'use strict';
// Loads the production KubeJS client scripts into a Node vm context, the same way
// KubeJS evaluates them: plain scripts sharing one scope, with `global` persisting
// across reloads. Only the environment (Java, ClientEvents, JsonIO, console) is faked.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const F = require('./fake_emi.cjs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT_DIR = path.join(ROOT, 'kubejs', 'client_scripts', 'emi_curation');

// KubeJS order: `// priority: N` header, higher first.
// Scripts live in emi_curation/ and its subfolders; KubeJS sorts them all in one pack, so
// the order is global across folders. Names are paths relative to SCRIPT_DIR.
function scriptFiles(dir) {
  dir = dir || SCRIPT_DIR;
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? scriptFiles(p) : d.name.endsWith('.js') ? [p] : [];
  });
}

function scriptOrder() {
  return scriptFiles()
    .map((p) => path.relative(SCRIPT_DIR, p).split(path.sep).join('/'))
    .map((f) => {
      const head = fs.readFileSync(path.join(SCRIPT_DIR, f), 'utf8').split('\n', 1)[0];
      const m = /^\/\/ priority: (-?\d+)/.exec(head);
      return { f, p: m ? Number(m[1]) : 0 };
    })
    .sort((a, b) => b.p - a.p)
    .map((x) => x.f);
}

function readRepoText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function makeConsole(sink) {
  return {
    log: (...a) => sink.push(['info', a.join(' ')]),
    info: (...a) => sink.push(['info', a.join(' ')]),
    warn: (...a) => sink.push(['warn', a.join(' ')]),
    error: (...a) => sink.push(['error', a.join(' ')]),
  };
}

/**
 * Runs the named scripts (default: all, in KubeJS priority order) in a fresh context.
 * env: { global, Java, ClientEvents, JsonIO, logs }
 */
function loadScripts(env, names) {
  const files = names || scriptOrder();
  const sandbox = {
    global: env.global,
    Java: env.Java,
    ClientEvents: env.ClientEvents,
    JsonIO: env.JsonIO || { readString: readRepoText },
    Platform: env.Platform || { isLoaded: () => false },
    console: makeConsole(env.logs || []),
  };
  const context = vm.createContext(sandbox);
  for (const f of files) {
    const file = path.join(SCRIPT_DIR, f.endsWith('.js') ? f : f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return sandbox;
}

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
    c4: S('allthecompressed:cobblestone_4x'),
    c1: S('allthecompressed:cobblestone_1x'),
    water: new F.EmiStack(new F.Fluid('minecraft:water')),
    removed: S('removedmod:thing'),
  };
  const I = F.ingredient;
  const R = (id, ins, outs, cats) => new F.Recipe(id, 'cat', ins, outs, cats);
  const r = {
    visible: R('r:visible', [I(s.stone)], [s.c1]),
    hiddenOut: R('r:hidden_out', [I(s.c1)], [s.c4]),
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
  const items = [s.stone, s.cell, s.egg, s.door, s.zombieVial, s.villagerVial, s.emptyVial, s.c4, s.c1, s.water];
  return { s, r, spec: { items, recipes: Object.values(r) } };
}

/** Boots the production scripts against a fresh fake world; `opts`: { noReload, jsonIO }. */
function boot(opts) {
  const fx = fixture();
  const world = F.createWorld(fx.spec);
  const g = {};
  const ctx = { world, fx, g, events: null, logs: [], loadedMods: new Set(['ae2', 'create', 'enderio']) };
  ctx.load = (jsonIO) => {
    ctx.events = F.clientEvents();
    loadScripts({
      global: g, Java: world.Java, ClientEvents: ctx.events.api, JsonIO: jsonIO, logs: ctx.logs,
      Platform: { isLoaded: (id) => ctx.loadedMods.has(id) },
    });
  };
  ctx.tick = () => { for (const h of ctx.events.handlers.tick) h(); };
  ctx.logout = () => { for (const h of ctx.events.handlers.loggedOut) h(); };
  ctx.ns = () => g.emiCuration;
  ctx.ids = (list) => list.a.map((x) => x.key.id + (x.nbt ? '#' + x.nbt.BlockEntityTag.EntityStorage.Entity.id : ''));
  ctx.load(opts && opts.jsonIO);
  if (!(opts && opts.noReload)) { world.reload(); world.finishWorker(); }
  return ctx;
}

module.exports = { ROOT, SCRIPT_DIR, scriptFiles, scriptOrder, readRepoText, loadScripts, fixture, boot };
