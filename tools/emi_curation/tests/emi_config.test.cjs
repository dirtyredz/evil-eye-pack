'use strict';
// Guards config/emi.css: it must parse with EMI 1.1.24's QDCSS regexes (copied from
// dev.emi.emi.com.unascribed.qdcss.QDCSS) and use only keys and values that EMI
// 1.1.24's EmiConfig defines, otherwise EMI silently keeps it as "unparsed".

const test = require('node:test');
const assert = require('node:assert/strict');
const { readRepoText } = require('./harness.cjs');

const JUNK = /^(\s*(\/\*[\s\S]*?\*\/)?\s*)*$/;
const RULESET = /[#.]?(\w+?)\s*\{([\s\S]*?)\}/g;
const RULE = /(\S+?)\s*:\s*(".*?"|'.*?'|.+?)\s*(;|$)/g;

function parseQdcss(text) {
  const out = [];
  let m;
  let last = 0;
  RULESET.lastIndex = 0;
  while ((m = RULESET.exec(text))) {
    assert.match(text.slice(last, m.index), JUNK, 'junk before #' + m[1]);
    let r;
    let lastRule = 0;
    RULE.lastIndex = 0;
    while ((r = RULE.exec(m[2]))) {
      assert.match(m[2].slice(lastRule, r.index), JUNK, 'junk before ' + m[1] + '.' + r[1]);
      out.push([m[1] + '.' + r[1], r[2]]);
      lastRule = RULE.lastIndex;
    }
    assert.match(m[2].slice(lastRule), JUNK, 'junk at end of #' + m[1]);
    last = RULESET.lastIndex;
  }
  assert.match(text.slice(last), JUNK, 'junk at end of file');
  return out;
}

const BOOL = /^(true|false)$/;
const BIND = /^"(?:(?:ctrl|alt|shift) )*key\.(?:keyboard|mouse)\.[a-z0-9._]+"$/;
// Keys and value shapes from EMI 1.1.24 EmiConfig / its ConfigEnum names.
const KNOWN = {
  'general.enabled': BOOL,
  'general.cheat-mode': /^(true|false|creative)$/,
  'general.index-source': /^(creative|registered|creative-plus-registered)$/,
  'general.search-sidebar': /^(none|left|right|top|bottom)$/,
  'general.search-tooltip-by-default': BOOL,
  'general.search-mod-name-by-default': BOOL,
  'general.search-tags-by-default': BOOL,
  'ui.append-mod-id': BOOL,
  'ui.append-item-mod-id': BOOL,
  'ui.center-search-bar': BOOL,
  'ui.maximum-recipe-screen-height': /^\d+$/,
  'ui.left-sidebar-pages': /^(none|(index|craftables|favorites|lookup-history|craft-history|empty|chess)(, (index|craftables|favorites|lookup-history|craft-history|empty|chess))*)$/,
  'ui.right-sidebar-pages': /^(none|(index|craftables|favorites|lookup-history|craft-history|empty|chess)(, (index|craftables|favorites|lookup-history|craft-history|empty|chess))*)$/,
  'ui.right-sidebar-header': /^(visible|invisible)$/,
  'binds.toggle-visibility': BIND,
  'binds.view-recipes': BIND,
  'binds.view-uses': BIND,
  'binds.favorite': BIND,
  'binds.back': BIND,
  'binds.copy-recipe-id': BIND,
};

test('config/emi.css parses with EMI QDCSS and uses only known keys and values', () => {
  const rules = parseQdcss(readRepoText('config/emi.css'));
  assert.ok(rules.length >= 20);
  for (const [key, value] of rules) {
    assert.ok(KNOWN[key], 'unknown EMI config key ' + key);
    assert.match(value, KNOWN[key], key + ' has an invalid value ' + value);
  }
});

test('the mapped REI behaviour is present', () => {
  const map = new Map();
  for (const [k, v] of parseQdcss(readRepoText('config/emi.css'))) map.set(k, (map.get(k) || []).concat(v));
  assert.deepEqual(map.get('general.cheat-mode'), ['false']);
  assert.deepEqual(map.get('ui.center-search-bar'), ['true']);
  assert.deepEqual(map.get('ui.right-sidebar-pages'), ['index, craftables']);
  assert.deepEqual(map.get('ui.maximum-recipe-screen-height'), ['300']);
  assert.deepEqual(map.get('binds.view-recipes'), ['"key.keyboard.r"', '"key.mouse.left"']);
  assert.deepEqual(map.get('binds.toggle-visibility'), ['"ctrl key.keyboard.o"']);
});
