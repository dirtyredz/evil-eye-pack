'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verdict } = require('../verdict.cjs');
const allowlist = {
  missingTargets: [{ mod: 'optional', config: 'example.mixins.json', mixin: 'CompatMixin', target: 'missing.X', reason: 'Reviewed minor behavior loss.', 'known-minor': 'dk-1234abcd' }],
  unhandled: [{ config: 'bootstrap.mixins.json', target: 'bootstrap.One', reason: 'Bootstrap target is loaded before the game transformer.' }],
};
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
    assert.notEqual(verdict({code: 0, out: error + '\n' + complete}).code, 0);
  }
});
test('only exact reviewed missing and unhandled targets are allowed', () => {
  const reviewed = '@Mixin target missing.X was not found example.mixins.json:CompatMixin from mod optional\n';
  const accepted = verdict({ code: 0, out: reviewed + complete }, allowlist);
  assert.equal(accepted.code, 0);
  assert.equal(accepted.allowedMissingTargets[0]['known-minor'], 'dk-1234abcd');
  assert.equal(verdict({ code: 0, out: reviewed.replace('missing.X', 'missing.Y') + complete }, allowlist).code, 1);
  const pending = 'PACK_AUDIT UNHANDLED bootstrap.mixins.json [bootstrap.One]\n';
  const rawFailed = complete.replace('failures=0', 'failures=1');
  assert.equal(verdict({ code: 1, out: pending + rawFailed }, allowlist).code, 0);
  assert.equal(verdict({ code: 1, out: pending.replace('bootstrap.One', 'bootstrap.Two') + rawFailed }, allowlist).code, 1);
  assert.equal(verdict({ code: 0, out: pending + rawFailed }, allowlist).code, 2);
});
test('an optional class lookup is not evidence that a mixin target is missing', () => {
  assert.equal(verdict({code: 0, out: 'Error loading class: optional/Annotation (java.lang.ClassNotFoundException)\n' + complete}).code, 0);
});
