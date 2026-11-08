'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { addEntry } = require('../add-server-entry.cjs');

// A real one-entry Minecraft servers.dat (hidden=1, ip, name).
const ONE = Buffer.from('0a0000090007' + '736572766572730a00000001' + '0100066869646465' + '6e0008000269700014' + Buffer.from('apx2181221.apexmc.co').toString('hex') + '08000' + '46e616d65000845766' + '96c457965370000', 'hex');

test('appends a compound and bumps the list length, keeping the existing bytes', () => {
  const out = addEntry(ONE, 'Evil Eye (ANU)', '192.168.1.251');
  assert.ok(out);
  assert.strictEqual(out.readInt32BE(14), 2);
  assert.ok(out.subarray(18, ONE.length - 1).equals(ONE.subarray(18, ONE.length - 1)));
  assert.ok(out.includes(Buffer.from('192.168.1.251')) && out.includes(Buffer.from('Evil Eye (ANU)')));
  assert.strictEqual(out[out.length - 1], 0);
  assert.strictEqual(out[out.length - 2], 0);
});

test('is idempotent and refuses unknown layouts', () => {
  const once = addEntry(ONE, 'Evil Eye (ANU)', '192.168.1.251');
  assert.strictEqual(addEntry(once, 'Evil Eye (ANU)', '192.168.1.251'), null);
  assert.throws(() => addEntry(Buffer.from('0a0000', 'hex'), 'x', 'y'), /unrecognised/);
});
