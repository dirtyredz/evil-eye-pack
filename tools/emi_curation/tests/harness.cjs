'use strict';
// Loads the production KubeJS client scripts into a Node vm context, the same way
// KubeJS evaluates them: plain scripts sharing one scope, with `global` persisting
// across reloads. Only the environment (Java, ClientEvents, JsonIO, console) is faked.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT_DIR = path.join(ROOT, 'kubejs', 'client_scripts', 'emi_curation');

// KubeJS order: `// priority: N` header, higher first.
function scriptOrder() {
  return fs.readdirSync(SCRIPT_DIR)
    .filter((f) => f.endsWith('.js'))
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
    console: makeConsole(env.logs || []),
  };
  const context = vm.createContext(sandbox);
  for (const f of files) {
    const file = path.join(SCRIPT_DIR, f.endsWith('.js') ? f : f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return sandbox;
}

module.exports = { ROOT, SCRIPT_DIR, scriptOrder, readRepoText, loadScripts };
