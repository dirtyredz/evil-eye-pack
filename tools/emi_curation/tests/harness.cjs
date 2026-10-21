'use strict';
// Loads the production KubeJS client scripts into a Node vm context, the same way
// KubeJS evaluates them: plain scripts sharing one scope, with `global` persisting
// across reloads. Only the environment (Java, ClientEvents, JsonIO, console) is faked.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const F = require('./fake_emi.cjs');
const { fixture } = require('./fixture.cjs');

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
 * The fake KubeJS JsonIO: `files` (path -> text) holds what scripts wrote; a missing
 * decor-local.json reads as "null", like the real JsonIO.readString; `state.failWrites` makes write throw.
 */
function makeJsonIO(base, files, state) {
  return {
    readString(p) {
      if (files.has(p)) return files.get(p);
      if (/decor-local.json$/.test(p)) return 'null';
      return (base && base.readString ? base.readString : readRepoText)(p);
    },
    parseRaw(text) { return JSON.parse(text); },
    write(p, element) {
      if (state.failWrites) throw new Error('java.nio.file.AccessDeniedException: ' + p);
      files.set(p, JSON.stringify(element));
    },
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
    JsonIO: env.JsonIO || makeJsonIO(null, new Map(), {}),
    Platform: env.Platform || { isLoaded: () => false, getInfo: () => null },
    console: makeConsole(env.logs || []),
  };
  const context = vm.createContext(sandbox);
  for (const f of files) {
    const file = path.join(SCRIPT_DIR, f.endsWith('.js') ? f : f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return sandbox;
}

/**
 * Boots the production scripts against a fresh fake world;
 * `opts`: { noReload, jsonIO, fixture (a fixture()-shaped world to use instead of the default) }.
 */
function boot(opts) {
  const fx = (opts && opts.fixture) || fixture();
  const world = F.createWorld(fx.spec);
  const g = {};
  const ctx = { world, fx, g, events: null, files: new Map((opts && opts.files) || []), io: { failWrites: false }, logs: [], loadedMods: new Set(['minecraft', 'ae2', 'create', 'enderio', 'allthecompressed', 'dramaticdoors']),
    modNames: { minecraft: 'Minecraft', ae2: 'Applied Energistics 2', enderio: 'Ender IO', allthecompressed: 'AllTheCompressed', dramaticdoors: 'Dramatic Doors' } };
  ctx.load = (jsonIO) => {
    ctx.events = F.clientEvents();
    loadScripts({
      global: g, Java: world.Java, ClientEvents: ctx.events.api, JsonIO: makeJsonIO(jsonIO, ctx.files, ctx.io), logs: ctx.logs,
      Platform: {
        isLoaded: (id) => ctx.loadedMods.has(id),
        getInfo: (id) => (ctx.loadedMods.has(id) ? { getName: () => ctx.modNames[id] || id } : null),
      },
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

module.exports = { makeJsonIO, ROOT, SCRIPT_DIR, scriptFiles, scriptOrder, readRepoText, loadScripts, boot };
