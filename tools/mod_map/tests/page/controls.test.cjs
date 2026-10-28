'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('offline page controls filter descriptions/shared users, sort and expand visible groups', () => {
  const element = props => ({ handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; }, ...props });
  const a = element({ dataset: { name: 'alpha', cost: '10', kind: 'standalone' }, textContent: 'Alpha description piston; shared library users Beta', open: false });
  const b = element({ dataset: { name: 'beta', cost: '50', kind: 'family' }, textContent: 'Beta library', open: false });
  const body = element({ children: [a, b], querySelectorAll: () => body.children, append(...cards) { this.children = cards; } });
  const category = element({ dataset: { name: 'tech & automation' }, querySelectorAll: () => [a, b], open: false });
  const els = {
    '#filter': element({ value: '' }), '#sort': element({}), '#expand': element({}), '#collapse': element({}), '#count': element({})
  };
  const document = { querySelector: selector => els[selector], querySelectorAll: selector => ({
    '.category .entry': [a, b], '.category': [category], '.category-body': [body], '.category, .category .entry': [category, a, b]
  })[selector] };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../page/page.js'), 'utf8'), { document });
  els['#sort'].handlers.change({ target: { value: 'cost' } });
  assert.equal(body.children[0], b);
  els['#sort'].handlers.change({ target: { value: 'name' } });
  assert.equal(body.children[0], a);
  els['#filter'].value = 'piston'; els['#filter'].handlers.input();
  assert.equal(a.hidden, false); assert.equal(b.hidden, true);
  els['#expand'].handlers.click(); assert.equal(category.open, true); assert.equal(a.open, true); assert.equal(b.open, false);
  els['#collapse'].handlers.click(); assert.equal(a.open, false);
  els['#filter'].value = 'tech'; els['#filter'].handlers.input();
  assert.equal(a.hidden, false); assert.equal(b.hidden, false); assert.equal(els['#count'].textContent, '2 mods / families visible');
});
