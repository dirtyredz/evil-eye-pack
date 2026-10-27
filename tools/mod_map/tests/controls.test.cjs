'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('offline page controls filter descriptions/shared users, sort and expand visible groups', () => {
  const element = props => ({ handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; }, ...props });
  const a = element({ dataset: { name: 'alpha', cost: '10', kind: 'utility' }, textContent: 'Alpha description piston', open: false });
  const b = element({ dataset: { name: 'beta', cost: '50', kind: 'content' }, textContent: 'Beta library', open: false });
  const shared = element({ textContent: 'Shared library users Alpha', open: false });
  const els = {
    '#groups': element({ children: [a, b], append(...cards) { this.children = cards; } }),
    '#filter': element({ value: '' }), '#sort': element({}), '#expand': element({}), '#collapse': element({}), '#count': element({})
  };
  const document = { querySelector: selector => els[selector], querySelectorAll: () => [a, b, shared] };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../page.js'), 'utf8'), { document });
  els['#sort'].handlers.change({ target: { value: 'cost' } });
  assert.equal(els['#groups'].children[0], b);
  els['#sort'].handlers.change({ target: { value: 'name' } });
  assert.equal(els['#groups'].children[0], a);
  els['#filter'].value = 'piston'; els['#filter'].handlers.input();
  assert.equal(a.hidden, false); assert.equal(b.hidden, true);
  els['#expand'].handlers.click(); assert.equal(a.open, true); assert.equal(b.open, false);
  els['#collapse'].handlers.click(); assert.equal(a.open, false);
  els['#filter'].value = 'Alpha'; els['#filter'].handlers.input();
  assert.equal(shared.hidden, false); assert.equal(els['#count'].textContent, '2 visible');
});
