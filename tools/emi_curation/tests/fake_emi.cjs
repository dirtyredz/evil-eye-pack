'use strict';
// Fake Java/EMI/Forge surfaces for the session tests. They model only what the
// production scripts touch, with EMI 1.1.24's reference semantics: bake() creates new
// master/filtered lists, bakeFiltered() a new filtered list, reload() a new manager.

class JList {
  constructor(src) { this.a = !src ? [] : Array.isArray(src) ? src.slice() : src.toArray(); }
  size() { return this.a.length; }
  get(i) { return this.a[i]; }
  add(x) { this.a.push(x); return true; }
  contains(x) { return this.a.includes(x); }
  toArray() { return this.a.slice(); }
}
class FrozenList extends JList {
  add() { throw new Error('UnsupportedOperationException'); }
}
// Models java.util.ImmutableCollections$ListN: Rhino cannot reflect on the concrete
// class, so every direct member call fails. The ArrayList constructor (toArray) works.
const opaque = { on: false };
class OpaqueList extends JList {
  size() { return deny('size'); }
  get() { return deny('get'); }
  contains() { return deny('contains'); }
  add() { return deny('add'); }
  iterator() { return deny('iterator'); }
}
function deny(m) {
  throw new Error('java.lang.IllegalAccessException: cannot access a member of class java.util.ImmutableCollections$ListN (' + m + ')');
}
const mk = (arr) => (opaque.on ? new OpaqueList(arr) : new JList(arr));

class IdentityHashMap {
  constructor() { this.m = new Map(); }
  put(k, v) { this.m.set(k, v); return null; }
  get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  containsKey(k) { return this.m.has(k); }
  clear() { this.m.clear(); }
}
class HashSet {
  constructor() { this.s = new Set(); }
  add(x) { this.s.add(x); return true; }
  contains(x) { return this.s.has(x); }
}

// ---- Minecraft-ish ----
class Item { constructor(id) { this.id = id; } }
class Fluid { constructor(id) { this.id = id; } }
class Block { constructor(item) { this.item = item; } asItem() { return this.item; } }

// Plain value -> fake NBT tag (compound / string / list).
function tag(v) {
  if (typeof v === 'string') return { getId: () => 8, getAsString: () => v };
  if (Array.isArray(v)) return { getId: () => 9, size: () => v.length, get: (i) => tag(v[i]) };
  if (typeof v === 'number') return { getId: () => 3, getAsNumber: () => v, getAsString: () => String(v) };
  const keys = Object.keys(v);
  return {
    getId: () => 10,
    getAllKeys: () => { let i = 0; return { iterator: () => ({ hasNext: () => i < keys.length, next: () => keys[i++] }) }; },
    get: (k) => tag(v[k]),
  };
}

class EmiStack {
  constructor(key, nbt) { this.key = key; this.nbt = nbt === undefined ? null : nbt; }
  getId() { const id = this.key.id; return { toString: () => id }; }
  getKey() { return this.key; }
  getNbt() { return this.nbt === null ? null : tag(this.nbt); }
  isEmpty() { return false; }
  getEmiStacks() { return mk([this]); }
  getName() { return Component.literal(this.key.id.split(':')[1]); }
  toString() { return this.key.id; }
}
const EMPTY_STACK = { isEmpty: () => true, getEmiStacks: () => new JList([]), getKey: () => null };

function ingredient(...stacks) {
  return { isEmpty: () => stacks.length === 0, getEmiStacks: () => mk(stacks) };
}

class Recipe {
  constructor(id, category, inputs, outputs, catalysts) {
    this.id = id; this.category = category;
    this.inputs = mk(inputs); this.outputs = mk(outputs); this.catalysts = new JList(catalysts || []);
  }
  getId() { return this.id; }
  getCategory() { return this.category; }
  getInputs() { return this.inputs; }
  getOutputs() { return this.outputs; }
  getCatalysts() { return this.catalysts; }
}

// Baseline manager: returns the same list object for the same key, like EMI's Manager.
class Manager {
  constructor(categories, recipes) {
    this.categories = mk(categories);
    this.all = mk(recipes);
    this.byCat = new Map(); this.byIn = new Map(); this.byOut = new Map(); this.byId = new Map();
    const push = (map, k, r) => { if (!map.has(k)) map.set(k, new JList()); if (!map.get(k).contains(r)) map.get(k).add(r); };
    for (const r of recipes) {
      push(this.byCat, r.category, r);
      this.byId.set(r.id, r);
      for (const list of [r.inputs, r.catalysts]) for (const ing of list.a) for (const s of ing.getEmiStacks().a) push(this.byIn, s.key.id, r);
      for (const s of r.outputs.a) push(this.byOut, s.key.id, r);
    }
    if (opaque.on) for (const map of [this.byCat, this.byIn, this.byOut]) for (const [k, v] of map) map.set(k, mk(v.a));
    this.empty = new JList();
  }
  getCategories() { return this.categories; }
  getWorkstations() { return this.empty; }
  getRecipes(category) { return category === undefined ? this.all : (this.byCat.get(category) || this.empty); }
  getRecipe(id) { return this.byId.get(id) || null; }
  getRecipesByInput(stack) { return this.byIn.get(stack.key.id) || this.empty; }
  getRecipesByOutput(stack) { return this.byOut.get(stack.key.id) || this.empty; }
}

// ---- GUI ----
class Component {
  constructor(s) { this.s = s; }
  getString() { return this.s; }
  static literal(s) { return new Component(s); }
}
class FakeButton {
  constructor(msg, onPress, x, y, w, h) {
    Object.assign(this, { msg, onPress, x, y, w, h, visible: true, active: true });
  }
  setX(x) { this.x = x; }
  setY(y) { this.y = y; }
  setWidth(w) { this.w = w; }
  getX() { return this.x; }
  getY() { return this.y; }
  getWidth() { return this.w; }
  getHeight() { return this.h; }
  getMessage() { return this.msg; }
  setMessage(m) { this.msg = m; }
  press() { this.onPress(this); }
}
const Button = {
  builder: (msg, onPress) => ({
    bounds: (x, y, w, h) => ({ build: () => new FakeButton(msg, onPress, x, y, w, h) }),
  }),
};
class Screen { constructor(w, h) { this.width = w; this.height = h; } }
class AbstractContainerScreen extends Screen {
  constructor(w, h, gx, gy, xs, ys) { super(w, h); Object.assign(this, { gx, gy, xs, ys }); }
  getGuiLeft() { return this.gx; }
  getGuiTop() { return this.gy; }
  getXSize() { return this.xs; }
  getYSize() { return this.ys; }
  getFocused() { return this.focused || null; }
  getSlotUnderMouse() { return this.slot || null; }
}
class EditBox { constructor(focused) { this.focused = focused; } isFocused() { return this.focused; } }

class CreativeModeInventoryScreen extends AbstractContainerScreen {}

/**
 * Mirrors the runtime in KubeJS 2001.6.5 (verified in game, client.log): the plain name of an
 * overloaded method is ambiguous by argument type (String/Component/FormattedCharSequence are
 * interchangeable), and neither SRG names nor explicit signatures resolve (they read undefined).
 */
function fakeFont() {
  return { width() { throw new Error('InternalError: The choice of Java method Font.m_92895_ is ambiguous'); } };
}

/** Records what the Mods menu draws in Render$Post. */
function fakeGraphics() {
  const g = { fills: [], strings: [], flushes: 0, z: 0, stack: 0, seq: 0 };
  g.pose = () => ({
    pushPose() { g.stack++; }, popPose() { g.stack--; }, translate(x, y, z) { g.z += z; },
  });
  g.fill = (x1, y1, x2, y2, c) => g.fills.push({ x1, y1, x2, y2, c, z: g.z, seq: g.seq++ });
  // Same member-table reality as fakeFont: plain drawString is ambiguous, SRG names and explicit
  // signatures do not exist. drawWordWrap(Font, FormattedText, x, y, maxWidth, color) has one
  // overload, so it resolves.
  const ambiguous = () => { throw new Error('InternalError: The choice of Java method GuiGraphics.m_280488_ matching JavaScript argument types is ambiguous'); };
  g.drawString = ambiguous;
  g.drawWordWrap = function (font, text, x, y, maxWidth, color) {
    if (typeof text !== 'object' || typeof text.getString !== 'function') throw new Error('drawWordWrap needs a FormattedText');
    if (!(maxWidth > 0)) throw new Error('maxWidth must be positive');
    g.strings.push({ s: text.getString(), x, y, c: color, z: g.z, seq: g.seq++ });
  };
  g.flush = () => { g.flushes++; };
  return g;
}

/** Builds a complete fake world. `spec` = { items: [EmiStack], recipes: [Recipe] }. */
function createWorld(spec) {
  const counters = { reloads: 0, searchUpdates: 0, recalcs: 0, persistentSaves: 0, configWrites: 0, listeners: [] };
  const userHidden = new Set();
  const favorites = ['minecraft:stone'];

  const EmiStackList = {
    stacks: null, filteredStacks: null,
    bake(items) {
      this.stacks = opaque.on ? new OpaqueList(items) : new FrozenList(items);
      this.bakeFiltered();
    },
    bakeFiltered() {
      const kept = this.stacks.a.filter((s) => !userHidden.has(s));
      this.filteredStacks = opaque.on ? new OpaqueList(kept) : new FrozenList(kept);
    },
  };
  const EmiRecipes = { manager: null, activeWorker: null };
  const EmiReloadManager = { loaded: false, isLoaded() { return this.loaded; } };
  const search = {
    x: 133, y: 219, w: 160, h: 18, visible: true,
    getX() { return this.x; }, getY() { return this.y; }, getWidth() { return this.w; },
    getHeight() { return this.h; }, isVisible() { return this.visible; },
    value: '', sets: [], focused: false, isFocused() { return this.focused; },
    getValue() { return this.value; },
    // EditBox.setValue runs EMI's responder, which refilters.
    setValue(v) { this.value = v; this.sets.push(v); counters.searchUpdates++; },
  };
  const panels = [];
  const EmiScreenManager = {
    search,
    forceRecalculate() { counters.recalcs++; },
    // world.hover: the stack or ingredient EMI reports under the mouse (null = nothing).
    getHoveredStack() { const h = world.hover; return h ? { isEmpty: () => false, getStack: () => (h.getEmiStacks ? h : ingredient(h)) } : { isEmpty: () => true }; },
    getHoveredPanel(x, y) {
      return panels.find((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) || null;
    },
  };
  const EmiSearch = { update() { counters.searchUpdates++; } };
  const EmiHidden = {
    isHidden(stack) { return userHidden.has(stack); },
    // EMI's own user hide path: persists and re-bakes the filtered list.
    setVisibility(stack, hide) {
      if (hide) userHidden.add(stack); else userHidden.delete(stack);
      EmiPersistentData.save();
      EmiStackList.bakeFiltered();
    },
  };
  const EmiPersistentData = { save() { counters.persistentSaves++; } };
  const EmiConfig = { enabled: true, writeConfig() { counters.configWrites++; } };
  // Tag registries: world.tags.item / .block map 'ns:tag' -> [Item | Block]. Read through the same
  // Optional / HolderSet shape the scripts use (size(), get(i).value()); no iterator exists.
  const tags = { item: {}, block: {} };
  const registry = (kind) => ({
    getTag(key) {
      if (world.failTags) throw new Error('injected tag failure');
      const list = tags[kind][key.id];
      if (!list) return { isPresent: () => false };
      return { isPresent: () => true, get: () => ({ size: () => list.length, get: (i) => ({ value: () => list[i] }) }) };
    },
  });
  const toasts = [];
  const actionbar = [];
  const player = { displayClientMessage: (c, overlay) => actionbar.push({ text: c.getString(), overlay }) };
  const instance = {
    get player() { return world.inWorld ? player : null; }, font: fakeFont(),
    getWindow: () => ({ getGuiScaledWidth: () => 427, getScreenWidth: () => 854, getGuiScaledHeight: () => 240, getScreenHeight: () => 480 }),
    mouseHandler: { xpos: () => 2 * world.mouse.x, ypos: () => 2 * world.mouse.y },
    getToasts: () => 'toasts',
  };
  const Minecraft = { getInstance: () => instance };
  const SystemToast = {
    addOrUpdate: (box, id, title, msg) => { if (world.failToast) throw new Error('toast failure'); toasts.push({ box, id, title: title.getString(), msg: msg.getString() }); },
  };

  const classes = {
    'java.util.IdentityHashMap': IdentityHashMap,
    'java.util.ArrayList': JList,
    'java.util.HashSet': HashSet,
    'java.util.Collections': {
      unmodifiableList: (l) => { if (world.failFreeze) throw new Error('injected failure'); return new FrozenList(l.a); },
      synchronizedMap: (m) => m,
    },
    'net.minecraft.world.item.Item': Item,
    'net.minecraft.core.registries.Registries': { ITEM: 'item', BLOCK: 'block' },
    'net.minecraft.core.registries.BuiltInRegistries': { ITEM: Object.assign(registry('item'), { getKey: (item) => ({ toString: () => item.id }) }), BLOCK: registry('block') },
    'net.minecraft.client.gui.components.EditBox': EditBox,
    'net.minecraft.client.gui.components.toasts.SystemToast': SystemToast,
    'net.minecraft.client.gui.components.toasts.SystemToast$SystemToastIds': { PERIODIC_NOTIFICATION: 'PERIODIC' },
    'net.minecraft.tags.TagKey': { create: (reg, loc) => ({ reg, id: loc.id }) },
    'net.minecraft.resources.ResourceLocation': { tryParse: (s) => (/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(s) ? { id: s } : null) },
    'net.minecraft.client.Minecraft': Minecraft,
    'net.minecraft.network.chat.Component': Component,
    'net.minecraft.client.gui.components.Button': Button,
    'net.minecraft.client.gui.screens.inventory.AbstractContainerScreen': AbstractContainerScreen,
    'net.minecraft.client.gui.screens.inventory.CreativeModeInventoryScreen': CreativeModeInventoryScreen,
    'dev.emi.emi.registry.EmiStackList': EmiStackList,
    'dev.emi.emi.registry.EmiRecipes': EmiRecipes,
    'dev.emi.emi.runtime.EmiReloadManager': EmiReloadManager,
    'dev.emi.emi.runtime.EmiHidden': EmiHidden,
    'dev.emi.emi.runtime.EmiPersistentData': EmiPersistentData,
    'dev.emi.emi.screen.EmiScreenManager': EmiScreenManager,
    'dev.emi.emi.search.EmiSearch': EmiSearch,
    'dev.emi.emi.config.EmiConfig': EmiConfig,
    'net.minecraftforge.common.MinecraftForge': {
      EVENT_BUS: { addListener: (prio, recv, cls, fn) => counters.listeners.push({ cls, fn }) },
    },
    'net.minecraftforge.eventbus.api.EventPriority': { NORMAL: 'NORMAL' },
    'net.minecraftforge.client.event.ScreenEvent$Init$Post': 'ScreenEvent$Init$Post',
    'net.minecraftforge.client.event.ScreenEvent$Render$Pre': 'ScreenEvent$Render$Pre',
    'net.minecraftforge.client.event.RenderTooltipEvent$Pre': 'RenderTooltipEvent$Pre',
    'net.minecraftforge.client.event.ScreenEvent$Render$Post': 'ScreenEvent$Render$Post',
    'net.minecraftforge.client.event.ScreenEvent$MouseButtonPressed$Pre': 'ScreenEvent$MouseButtonPressed$Pre',
    'net.minecraftforge.client.event.ScreenEvent$KeyPressed$Pre': 'ScreenEvent$KeyPressed$Pre',
  };

  const world = {
    counters, userHidden, favorites, panels, tags, toasts, actionbar, hover: null, mouse: { x: 100, y: 100 }, failToast: false, inWorld: true, failFreeze: false, failTags: false,
    classes, EmiStackList, EmiRecipes, EmiReloadManager, EmiHidden, EmiConfig, EmiScreenManager,
    Java: { loadClass: (name) => { if (!(name in classes)) throw new Error('ClassNotFound ' + name); return classes[name]; } },
    // EMI reload: new master/filtered lists, then a provisional manager while the worker
    // bakes, then the worker's final manager.
    reload(nextSpec) {
      const s = nextSpec || spec;
      counters.reloads++;
      EmiReloadManager.loaded = false;
      EmiStackList.bake(s.items);
      EmiRecipes.manager = new Manager(['cat'], s.recipes);
      EmiRecipes.activeWorker = {};
      EmiReloadManager.loaded = true;
    },
    finishWorker(nextSpec) {
      const s = nextSpec || spec;
      EmiRecipes.manager = new Manager(['cat'], s.recipes);
      EmiRecipes.activeWorker = null;
    },
    fireEvent(cls, event) {
      for (const l of counters.listeners) if (l.cls === cls) l.fn(event);
    },
  };
  return world;
}

/** A fresh ClientEvents registry per script load (KubeJS replaces handlers on reload). */
function clientEvents() {
  const handlers = { tick: [], loggedOut: [] };
  return {
    handlers,
    api: { tick: (fn) => handlers.tick.push(fn), loggedOut: (fn) => handlers.loggedOut.push(fn) },
  };
}

module.exports = {
  fakeGraphics,
  JList, OpaqueList, opaque, Item, Fluid, Block, EmiStack, EMPTY_STACK, ingredient, Recipe, Manager,
  Screen, AbstractContainerScreen, CreativeModeInventoryScreen, EditBox, createWorld, clientEvents,
};
