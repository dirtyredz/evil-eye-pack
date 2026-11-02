'use strict';
const { key } = require('./allowlist.cjs');

function parseMissing(line) {
  const match = /@Mixin target (\S+) was not found (\S+):([^\s]+) from mod (\S+)/.exec(line);
  return match && { target: match[1], config: match[2], mixin: match[3], mod: match[4], line };
}

function verdict(result, allowlist = { missingTargets: [], unhandled: [] }) {
  const lines = result.out.split(/\r?\n/);
  const errors = lines.filter(line => /VerifyError|MixinApplyError|MixinTransformerError|InvalidMixinException|InjectionError|InjectionException|@Mixin target .* was not found|PACK_AUDIT UNHANDLED/.test(line));
  const missingTargets = errors.map(parseMissing).filter(Boolean);
  const verified = new Set([...result.out.matchAll(/PACK_AUDIT VERIFIED (\S+)/g)].map(m => m[1]));
  const failedTargets = [...new Set([...result.out.matchAll(/PACK_AUDIT FAILED (\S+)/g)].map(m => m[1]))];
  const unhandled = [...result.out.matchAll(/PACK_AUDIT UNHANDLED (\S+) \[([^\]]*)\]/g)].map(m => ({ config: m[1], targets: m[2].split(', ').filter(Boolean) }));
  const allowedMissingKeys = new Map(allowlist.missingTargets.map(entry => [key(entry, ['mod', 'config', 'mixin', 'target']), entry]));
  const allowedUnhandledKeys = new Map(allowlist.unhandled.map(entry => [key(entry, ['config', 'target']), entry]));
  const allowedMissingTargets = [], newMissingTargets = [];
  for (const finding of missingTargets) {
    const allowed = allowedMissingKeys.get(key(finding, ['mod', 'config', 'mixin', 'target']));
    (allowed ? allowedMissingTargets : newMissingTargets).push(allowed ? { ...finding, ...allowed } : finding);
  }
  const allowedUnhandled = [], newUnhandled = [];
  for (const group of unhandled) for (const target of group.targets) {
    const finding = { config: group.config, target };
    const allowed = allowedUnhandledKeys.get(key(finding, ['config', 'target']));
    (allowed ? allowedUnhandled : newUnhandled).push(allowed ? { ...finding, reason: allowed.reason } : finding);
  }
  const hardErrors = errors.filter(line => !parseMissing(line) && !line.includes('PACK_AUDIT UNHANDLED'));
  const details = { errors, missingTargets, allowedMissingTargets, newMissingTargets, verified: verified.size, failedTargets, unhandled, allowedUnhandled, newUnhandled };
  if (result.timedOut) return { code: 2, reason: 'Audit timed out', ...details };
  const complete = /PACK_AUDIT COMPLETE targets=([1-9]\d*) failures=(\d+)/.exec(result.out);
  const selected = /PACK_AUDIT CONFIGS ([1-9]\d*) TARGETS ([1-9]\d*)/.exec(result.out);
  const rawFailures = complete && Number(complete[2]);
  const expectedFailures = failedTargets.length + unhandled.length;
  const expectedJvmExit = expectedFailures === 0 ? 0 : 1;
  if (!complete || !selected || selected[2] !== complete[1] || !result.out.includes('PACK_AUDIT CLIENT CLIENT') ||
      verified.size + failedTargets.length !== Number(complete[1]) || rawFailures !== expectedFailures || result.code !== expectedJvmExit) {
    return { code: 2, reason: 'Incomplete CLIENT audit', ...details };
  }
  const blocked = hardErrors.length || failedTargets.length || newMissingTargets.length || newUnhandled.length;
  return { code: blocked ? 1 : 0, configs: Number(selected[1]), targets: Number(complete[1]), failures: rawFailures, ...details };
}
module.exports = { verdict, parseMissing };
