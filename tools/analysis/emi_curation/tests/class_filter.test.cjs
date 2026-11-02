'use strict';
// Every class the curation (and other shipped) scripts load must pass the pinned KubeJS's script class
// filter. KubeJS 2101 ships its rules as `kubejs.classfilter.txt` in the jar (`+ prefix` allow,
// `- prefix` deny; the most specific prefix wins; unlisted packages are allowed). The rules are read
// from the verified pinned jar itself; a missing jar is an error, never a skipped test.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { scriptFiles, ROOT } = require('./support/harness.cjs');
const { resolvePinnedJar } = require('../../../packwiz/pinned_jar.cjs');
const { listEntries, readEntry } = require('../../../data_io/zip_reader.cjs');
const { defaultJarDirs } = require('../../dedup/catalog.cjs');

function loadRules() {
  const meta = fs.readFileSync(path.join(ROOT, 'mods/kubejs.pw.toml'), 'utf8');
  const jar = resolvePinnedJar(meta, defaultJarDirs(ROOT), 'mods/kubejs.pw.toml');
  const entry = listEntries(jar.bytes).find((e) => e.name === 'kubejs.classfilter.txt');
  if (!entry) throw new Error(`${jar.filename} has no kubejs.classfilter.txt`);
  return parseRules(readEntry(jar.bytes, entry).toString('utf8'));
}
function parseRules(text) {
  return text.split(/\r?\n/).map((l) => /^([+-])\s*(\S+)\s*$/.exec(l.trim())).filter(Boolean).map((m) => [m[1] === '+' ? 'allow' : 'deny', m[2]]);
}
const RULES = loadRules();

function allowed(name) {
  let best = null;
  for (const [kind, prefix] of RULES) {
    if (name === prefix || name.startsWith(prefix + '.') || name.startsWith(prefix + '$')) {
      if (!best || prefix.length > best[1].length) best = [kind, prefix];
    }
  }
  return !best || best[0] === 'allow';
}

function loadedClasses(files) {
  const names = new Set();
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/(?:cls|loadClass)\('([\w.$]+)'\)/g)) names.add(m[1]);
    for (const m of text.matchAll(/var \w+ = '((?:dev|net|java)\.[\w.$]+)'/g)) names.add(m[1]);
  }
  return names;
}

test('every class loaded by the shipped scripts passes the pinned KubeJS class filter', () => {
  const kubejs = path.join(ROOT, 'kubejs');
  const shipped = fs.readdirSync(kubejs, { recursive: true }).filter((f) => f.endsWith('.js') && !f.startsWith('client_scripts')).map((f) => path.join(kubejs, f));
  const names = loadedClasses([...scriptFiles(), ...shipped]);
  assert.ok(names.size > 10);
  for (const n of names) assert.ok(allowed(n), n + ' is denied by the KubeJS class filter');
});

test('the filter model rejects what KubeJS rejects', () => {
  assert.ok(RULES.length > 20, 'the filter file was read');
  assert.equal(allowed('java.io.StringWriter'), false);
  assert.equal(allowed('java.lang.System'), false);
  assert.equal(allowed('java.util.IdentityHashMap'), true);
  assert.equal(allowed('dev.emi.emi.registry.EmiStackList'), true);
  assert.equal(allowed('net.neoforged.neoforge.capabilities.Capabilities'), true);
  assert.equal(allowed('net.neoforged.fml.loading.FMLLoader'), false);
  assert.deepEqual(parseRules('# c\n+ a.b\n- a.b.c\n'), [['allow', 'a.b'], ['deny', 'a.b.c']]);
});
