'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, loadScripts, readRepoText } = require('./support/harness.cjs');
const { fixture } = require('./support/fixture.cjs');
const F = require('./support/fake_emi.cjs');

// ---- the pure policy ----

function policyOf(doc) {
  const g = {};
  loadScripts({ global: g, Java: { loadClass() { throw new Error('no Java here'); } }, ClientEvents: { tick() {}, loggedOut() {} } },
    ['diagnostics', 'collections', 'decor/decor_policy']);
  return { P: g.emiCuration.decorPolicy, policy: g.emiCuration.decorPolicy.compile(Object.assign({ schema: 1 }, doc)) };
}

test('decor policy: manual exceptions beat mods, mods beat tags, tags are asked last and lazily', () => {
  const { P, policy } = policyOf({
    mods: ['handcrafted', 'createdeco'],
    modPrefixes: ['mcw'],
    pathPrefixes: { herbalwitch: ['decor/'] },
    forceDecor: ['xercapaint:item_easel', 'handcrafted:ignored'],
    forceNotDecor: ['handcrafted:hammer', 'handcrafted:ignored'],
  });
  let asked = 0;
  const tags = (answer) => () => { asked++; return answer; };
  assert.equal(P.classify(policy, 'handcrafted:oak_table', tags(false)), true, 'whole mod');
  assert.equal(P.classify(policy, 'handcrafted:hammer', tags(true)), false, 'force-not-decor beats the mod');
  assert.equal(P.classify(policy, 'handcrafted:ignored', tags(false)), false, 'force-not-decor beats force-decor');
  assert.equal(P.classify(policy, 'mcwroofs:oak_roof', tags(false)), true, 'mod prefix');
  assert.equal(P.classify(policy, 'mcwtrpdoors:oak_barn', tags(false)), true, "Macaw's Trapdoors really is mcwtrpdoors");
  assert.equal(P.classify(policy, 'notmcw:thing', tags(false)), false, 'a prefix matches the start only');
  assert.equal(P.classify(policy, 'herbalwitch:decor/seating/armchair/natural/birch', tags(false)), true, 'path prefix');
  assert.equal(P.classify(policy, 'herbalwitch:mortar', tags(false)), false, 'other herbalwitch items stay');
  assert.equal(P.classify(policy, 'xercapaint:item_easel', tags(false)), true, 'force-decor');
  assert.equal(asked, 2, 'tags consulted only for the two ids no earlier layer decided (notmcw, mortar)');
  assert.equal(P.classify(policy, 'minecraft:oak_stairs', tags(true)), true, 'tag layer');
  assert.equal(P.classify(policy, 'minecraft:oak_stairs'), false, 'no tag callback means no tag layer');
});

test('decor policy: rejects a wrong schema and malformed entries', () => {
  const { P } = policyOf({});
  assert.throws(() => P.compile({ schema: 2 }), /schema/);
  assert.throws(() => P.compile({ schema: 1, mods: 'x' }), /mods must be an array/);
  assert.throws(() => P.compile({ schema: 1, forceDecor: ['no-colon'] }), /forceDecor\[0\]/);
  assert.throws(() => P.compile({ schema: 1, itemTags: ['Bad:Tag'] }), /itemTags\[0\]/);
  assert.throws(() => P.compile({ schema: 1, pathPrefixes: [] }), /pathPrefixes/);
  assert.equal(P.compile({ schema: 1 }).defaultHidden, true, 'default when unspecified');
  assert.equal(P.compile({ schema: 1, defaultHidden: false }).defaultHidden, false);
});

test('the shipped decor.json compiles and names the verified mod ids and the required tags', () => {
  const { P } = policyOf({});
  const policy = P.load(readRepoText);
  // Ids verified from the jars' META-INF/mods.toml (Evil Eye Trial Cozy and Stable mods folders).
  for (const id of ['handcrafted', 'cluttered', 'domum_ornamentum', 'createdeco', 'interiors', 'roundwood', 'connectedglass', 'friendly_furnishings', 'refurbished_furniture']) {
    assert.equal(policy.mods[id], true, id);
  }
  assert.ok(policy.modPrefixes.includes('mcw'));
  assert.equal(JSON.stringify(policy.pathPrefixes.herbalwitch), JSON.stringify(['decor/']));
  for (const tag of ['minecraft:stairs', 'minecraft:slabs', 'minecraft:walls', 'minecraft:fences', 'minecraft:wool_carpets', 'minecraft:banners', 'minecraft:candles', 'minecraft:signs', 'minecraft:beds', 'forge:fence_gates', 'forge:glass_panes']) {
    assert.ok(policy.itemTags.includes(tag) || policy.blockTags.includes(tag), tag);
  }
  assert.ok(policy.blockTags.includes('minecraft:flower_pots'));
  assert.equal(policy.forceNotDecor['supplementaries:faucet'], true);
  assert.equal(P.classify(policy, 'supplementaries:faucet', () => true), false);
  assert.equal(P.classify(policy, 'minecraft:oak_door', () => false), false, 'doors and trapdoors are not decor');
  assert.equal(policy.defaultHidden, false, 'DECOR starts SHOWN');
});

// ---- the session ----

const { decorWorld, bootDecor, names, DECOR_IDS, KEPT_IDS } = require('./support/decor_world.cjs');


test('DECOR hides all three layers from the index, in CLEAN and in ALL, keeping the functional exceptions', () => {
  const c = bootDecor();
  const s = c.ns().session;
  assert.equal(c.ns().decorState.label(), 'DECOR: SHOWN');
  for (const id of DECOR_IDS.concat(KEPT_IDS)) if (id !== 'minecraft:stone') assert.ok(names(c).includes(id), 'shown at first: ' + id);
  assert.equal(s.toggleDecor(), true);
  assert.equal(c.ns().decorState.label(), 'DECOR: HIDDEN');
  for (const id of DECOR_IDS) assert.ok(!names(c).includes(id), 'hidden in CLEAN: ' + id);
  for (const id of KEPT_IDS) assert.ok(names(c).includes(id), 'kept in CLEAN: ' + id);
  s.toggle(); // ALL
  assert.equal(s.label(), 'EMI: ALL');
  for (const id of DECOR_IDS) assert.ok(!names(c).includes(id), 'hidden in ALL too: ' + id);
  assert.ok(names(c).includes('minecraft:zombie_spawn_egg'), 'ALL still shows what only CLEAN hides');
  for (const id of KEPT_IDS) assert.ok(names(c).includes(id), 'kept in ALL: ' + id);
  s.toggleDecor();
  assert.equal(c.world.EmiStackList.filteredStacks, c.ns().state.index.baseline, 'ALL + SHOWN is EMI\'s own list again');
  s.toggle(); // CLEAN
  assert.ok(names(c).includes('minecraft:oak_stairs') && !names(c).includes('minecraft:zombie_spawn_egg'), 'CLEAN + SHOWN is the old CLEAN view');
});

test('DECOR combines with CLEAN: hidden = CLEAN set plus decor set, and the master list is untouched', () => {
  const c = bootDecor();
  const s = c.ns().session;
  const clean = names(c);
  s.toggleDecor();
  const both = names(c);
  assert.deepEqual(both, clean.filter((id) => !DECOR_IDS.includes(id)));
  assert.equal(c.world.EmiStackList.stacks.size(), c.fx.spec.items.length, 'master untouched');
  assert.equal(c.world.counters.persistentSaves + c.world.counters.configWrites, 0, 'nothing written');
  assert.equal(c.world.userHidden.size, 0, "EMI's own hidden set untouched");
});

test('DECOR hides from the index only: recipes, uses and lookups still work', () => {
  const c = bootDecor();
  const s = c.ns().session;
  s.toggleDecor();
  const m = c.world.EmiRecipes.manager;
  const ids = m.getRecipes().a.map((r) => r.id);
  assert.ok(ids.includes('r:decor') && ids.includes('r:to_decor'), 'recipes with decor inputs or outputs stay: ' + ids);
  assert.equal(m.getRecipesByInput(c.d.stairs).a.length, 1);
  assert.equal(m.getRecipesByOutput(c.d.table).a.length, 1);
  s.toggle(); // ALL
  assert.equal(c.world.EmiRecipes.manager.getRecipes().a.length, c.fx.spec.recipes.length);
});

test('DECOR persists like CLEAN: kept over a script reload and a new EMI generation, reset on logout', () => {
  const c = bootDecor();
  const s = () => c.ns().session;
  s().toggleDecor();
  c.load(); // /kubejs reload client_scripts
  c.tick();
  assert.equal(c.ns().decorState.label(), 'DECOR: HIDDEN');
  assert.ok(!names(c).includes('handcrafted:oak_table'));
  c.world.reload(); c.world.finishWorker(); // EMI reloads (F3+T): new generation
  c.tick();
  assert.equal(c.ns().decorState.label(), 'DECOR: HIDDEN');
  assert.ok(!names(c).includes('minecraft:oak_stairs'), 'tag set rebuilt for the new generation');
  s().toggle(); // ALL: independent of CLEAN
  assert.equal(c.ns().decorState.label(), 'DECOR: HIDDEN');
  c.logout();
  c.tick();
  assert.equal(s().label(), 'EMI: CLEAN');
  assert.equal(c.ns().decorState.label(), 'DECOR: SHOWN', 'back to the decor.json default');
  assert.ok(names(c).includes('handcrafted:oak_table'));
});

test('decor.json defaultHidden: true starts HIDDEN', () => {
  const real = JSON.parse(readRepoText('config/emi-curation/decor.json'));
  real.defaultHidden = true;
  const w = decorWorld();
  const c = boot({ fixture: w.fx, jsonIO: { readString: (p) => (p.endsWith('decor.json') ? JSON.stringify(real) : readRepoText(p)) } });
  c.tick();
  assert.equal(c.ns().decorState.label(), 'DECOR: HIDDEN');
  assert.ok(!names(c).includes('handcrafted:oak_table'));
});

test('tags are read from the live registries; a failing tag read is logged and the mod layers still work', () => {
  const c = bootDecor();
  assert.ok(c.logs.filter((l) => l[0] === 'error').length === 0);
  const broken = boot({ fixture: decorWorld().fx });
  broken.world.failTags = true;
  broken.tick();
  broken.ns().session.toggleDecor();
  assert.ok(!names(broken).includes('handcrafted:oak_table'), 'mod layer unaffected');
  assert.ok(names(broken).includes('minecraft:oak_stairs'), 'tag layer empty');
  assert.ok(broken.logs.some((l) => l[0] === 'error' && /decor tag/.test(l[1])), 'failure logged');
  assert.equal(broken.ns().session.label(), 'EMI: CLEAN', 'the session keeps working');
});

test('a broken decor.json disables only the DECOR button, not CLEAN', () => {
  const c = boot({ jsonIO: { readString: (p) => (p.endsWith('decor.json') ? '{ nope' : readRepoText(p)) } });
  c.tick();
  const s = c.ns().session;
  assert.equal(s.label(), 'EMI: CLEAN');
  assert.equal(c.ns().decorState.label(), 'DECOR: N/A');
  assert.equal(s.canPressDecor(), false);
  assert.equal(s.toggleDecor(), false);
  assert.ok(c.logs.some((l) => l[0] === 'error' && /decor\.json/.test(l[1])));
});

test('a failed DECOR toggle keeps the previous view and returns to the previous mode', () => {
  const c = bootDecor();
  const s = c.ns().session;
  const before = c.world.EmiStackList.filteredStacks;
  c.world.failFreeze = true;
  assert.equal(s.toggleDecor(), false);
  assert.equal(c.world.EmiStackList.filteredStacks, before);
  assert.equal(s.label(), 'EMI: ERROR');
  assert.equal(c.ns().decorState.label(), 'DECOR: SHOWN');
});

// ---- the button ----

function screenWith(c, W, H) {
  const screen = new F.AbstractContainerScreen(W, H, Math.floor((W - 176) / 2), Math.floor((H - 166) / 2), 176, 166);
  const added = [];
  c.world.EmiScreenManager.search.y = H - 21;
  c.world.EmiScreenManager.search.x = Math.floor((W - 160) / 2);
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  const render = () => c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => screen, getMouseX: () => 0, getMouseY: () => 0 });
  render(); render();
  return { screen, added, render, clean: added[0], mods: added[1], decor: added[2] };
}

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('the DECOR button toggles, relabels, and sits on the search row without covering CLEAN or Mods', () => {
  for (const [W, H] of [[427, 240], [854, 480], [320, 240], [1920, 1080]]) {
    const c = bootDecor();
    const t = screenWith(c, W, H);
    assert.equal(t.decor.msg.getString(), 'DECOR: SHOWN');
    assert.equal(t.decor.visible, true);
    assert.equal(t.decor.active, true);
    // A 320 px wide window has no room for three buttons beside the search bar; placement then
    // falls back (the same limit CLEAN and Mods already had), so only wider windows must not overlap.
    if (W >= 427) assert.equal(hit(t.decor, t.clean) || hit(t.decor, t.mods), false, W + 'x' + H + ' no overlap');
    assert.ok(t.decor.x >= 0 && t.decor.x + t.decor.w <= W, W + 'x' + H + ' on screen');
    t.decor.press();
    assert.equal(t.decor.msg.getString(), 'DECOR: HIDDEN');
    assert.equal(c.ns().decorState.label(), 'DECOR: HIDDEN');
    assert.equal(t.clean.msg.getString(), 'EMI: CLEAN', 'CLEAN is independent');
    t.decor.press();
    assert.equal(t.decor.msg.getString(), 'DECOR: SHOWN');
  }
  const c = bootDecor();
  const t = screenWith(c, 427, 240);
  assert.equal(t.decor.y, t.clean.y, 'the standard window fits all three buttons on the search row');
});

test('the DECOR button hides with the EMI overlay and is inactive while EMI loads', () => {
  const c = bootDecor();
  const t = screenWith(c, 427, 240);
  c.world.EmiConfig.enabled = false;
  t.render();
  assert.equal(t.decor.visible, false);
  c.world.EmiConfig.enabled = true;
  c.world.EmiReloadManager.loaded = false;
  c.tick();
  t.render();
  assert.equal(t.decor.active, false);
});

test('the Mods menu follows DECOR: a fully decor mod leaves the list while decor is hidden', () => {
  const c = bootDecor();
  c.loadedMods.add('handcrafted');
  c.modNames.handcrafted = 'Handcrafted';
  const t = screenWith(c, 427, 240);
  const labels = () => { t.mods.press(); const g = F.fakeGraphics(); c.world.fireEvent('ScreenEvent$Render$Post', { getScreen: () => t.screen, getGuiGraphics: () => g, getMouseX: () => 0, getMouseY: () => 0 }); t.mods.press(); return g.strings.map((s) => s.s); };
  assert.ok(labels().includes('Handcrafted'));
  t.decor.press();
  assert.ok(!labels().includes('Handcrafted'));
  t.decor.press();
  assert.ok(labels().includes('Handcrafted'));
});

test('the Mods search filter still works with DECOR hidden (search text is set exactly as before)', () => {
  const c = bootDecor();
  const t = screenWith(c, 427, 240);
  t.decor.press();
  t.mods.press();
  const rows = c.ns().modsUi.rows;
  const g = F.fakeGraphics();
  c.world.fireEvent('ScreenEvent$Render$Post', { getScreen: () => t.screen, getGuiGraphics: () => g, getMouseX: () => 0, getMouseY: () => 0 });
  const i = g.strings.findIndex((s) => s.s === 'Ender IO');
  const r = rows[i].rect;
  c.world.fireEvent('ScreenEvent$MouseButtonPressed$Pre', { getMouseX: () => r.x + 1, getMouseY: () => r.y + 1, getButton: () => 0, setCanceled() {} });
  assert.equal(c.world.EmiScreenManager.search.value, '@enderio');
});
