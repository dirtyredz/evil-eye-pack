'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verdict } = require('../verdict.cjs');
const complete = 'PACK_AUDIT CLIENT CLIENT\nPACK_AUDIT CONFIGS 10 TARGETS 2\nPACK_AUDIT VERIFIED example.One\nPACK_AUDIT VERIFIED example.Two\nPACK_AUDIT COMPLETE targets=2 failures=0\n';
test('requires a completed nonempty client audit and successful JVM exit', () => {
  assert.equal(verdict({code: 0, out: complete}).code, 0);
  for (const out of ['', complete.replace('CLIENT CLIENT', 'CLIENT SERVER'), complete.replace('targets=2', 'targets=0'), complete.replace('failures=0', 'failures=1')]) {
    assert.notEqual(verdict({code: 0, out}).code, 0);
  }
  assert.notEqual(verdict({code: 1, out: complete}).code, 0);
  assert.equal(verdict({code: -1, out: complete, timedOut: true}).code, 2);
  assert.equal(verdict({code: 0, out: complete.replace('VERIFIED example.Two', 'VERIFIED example.One')}).code, 2);
});
test('logged verifier, missing target and mixin errors cannot be hidden by a success marker', () => {
  for (const error of ['java.lang.VerifyError: Bad type on operand stack', 'org.spongepowered.asm.mixin.transformer.throwables.MixinApplyError: failed', '@Mixin target missing.X was not found', 'PACK_AUDIT UNHANDLED example.mixins.json [example.One]']) {
    assert.equal(verdict({code: 0, out: error + '\n' + complete}).code, 1);
  }
});
test('an optional class lookup is not evidence that a mixin target is missing', () => {
  assert.equal(verdict({code: 0, out: 'Error loading class: optional/Annotation (java.lang.ClassNotFoundException)\n' + complete}).code, 0);
});
