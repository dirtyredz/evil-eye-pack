'use strict';
// Every class the curation scripts load must pass KubeJS 2001.6.5's script class filter
// (BuiltinKubeJSPlugin / BuiltinKubeJSForgePlugin.registerClasses: most specific prefix
// wins, unlisted packages are allowed). A denied class fails at runtime only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SCRIPT_DIR } = require('./harness.cjs');

const RULES = [
  ['deny', 'java.lang'], ['allow', 'java.lang.Number'], ['allow', 'java.lang.String'], ['allow', 'java.lang.Object'],
  ['allow', 'java.lang.Integer'], ['allow', 'java.lang.Long'], ['allow', 'java.lang.Double'], ['allow', 'java.lang.Boolean'],
  ['allow', 'java.lang.StringBuilder'], ['allow', 'java.math.BigInteger'], ['allow', 'java.math.BigDecimal'],
  ['deny', 'java.io'], ['allow', 'java.io.Closeable'], ['allow', 'java.io.Serializable'],
  ['deny', 'java.nio'], ['allow', 'java.nio.ByteOrder'],
  ['allow', 'java.util'], ['deny', 'java.util.jar'], ['deny', 'java.util.zip'],
  ['allow', 'it.unimi.dsi.fastutil'], ['allow', 'net.minecraft'], ['allow', 'dev.architectury'], ['allow', 'mezz.jei'],
  ['deny', 'java.net'], ['deny', 'sun'], ['deny', 'com.sun'], ['deny', 'io.netty'],
  ['deny', 'org.objectweb.asm'], ['deny', 'org.spongepowered.asm'],
  ['allow', 'net.minecraftforge'], ['deny', 'net.minecraftforge.fml'], ['deny', 'net.minecraftforge.accesstransformer'],
  ['deny', 'net.minecraftforge.coremod'], ['deny', 'cpw.mods.modlauncher'],
];

function allowed(name) {
  let best = null;
  for (const [kind, prefix] of RULES) {
    if (name === prefix || name.startsWith(prefix + '.') || name.startsWith(prefix + '$')) {
      if (!best || prefix.length > best[1].length) best = [kind, prefix];
    }
  }
  return !best || best[0] === 'allow';
}

test('every class loaded by the curation scripts passes the KubeJS class filter', () => {
  const names = new Set();
  for (const f of fs.readdirSync(SCRIPT_DIR)) {
    const text = fs.readFileSync(path.join(SCRIPT_DIR, f), 'utf8');
    for (const m of text.matchAll(/(?:cls|loadClass)\('([\w.$]+)'\)/g)) names.add(m[1]);
    for (const m of text.matchAll(/var \w+ = '((?:dev|net|java)\.[\w.$]+)'/g)) names.add(m[1]);
  }
  assert.ok(names.size > 10);
  for (const n of names) assert.ok(allowed(n), n + ' is denied by the KubeJS class filter');
});

test('the filter model rejects what KubeJS rejects', () => {
  assert.equal(allowed('java.io.StringWriter'), false);
  assert.equal(allowed('java.lang.System'), false);
  assert.equal(allowed('java.util.IdentityHashMap'), true);
  assert.equal(allowed('dev.emi.emi.registry.EmiStackList'), true);
});
