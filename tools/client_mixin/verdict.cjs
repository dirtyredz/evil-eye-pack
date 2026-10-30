'use strict';
function verdict(result) {
  const lines = result.out.split(/\r?\n/);
  const errors = lines.filter(line => /VerifyError|MixinApplyError|MixinTransformerError|InvalidMixinException|InjectionError|InjectionException|@Mixin target .* was not found|PACK_AUDIT UNHANDLED/.test(line));
  const missingTargets = errors.filter(line => /@Mixin target .* was not found/.test(line));
  const verified = new Set([...result.out.matchAll(/PACK_AUDIT VERIFIED (\S+)/g)].map(m => m[1]));
  const failedTargets = [...new Set([...result.out.matchAll(/PACK_AUDIT FAILED (\S+)/g)].map(m => m[1]))];
  const unhandled = [...result.out.matchAll(/PACK_AUDIT UNHANDLED (\S+) \[([^\]]*)\]/g)].map(m => ({ config: m[1], targets: m[2].split(', ').filter(Boolean) }));
  const details = { errors, missingTargets, verified: verified.size, failedTargets, unhandled };
  if (result.timedOut) return { code: 2, reason: 'Audit timed out', ...details };
  const complete = /PACK_AUDIT COMPLETE targets=([1-9]\d*) failures=(\d+)/.exec(result.out);
  const selected = /PACK_AUDIT CONFIGS ([1-9]\d*) TARGETS ([1-9]\d*)/.exec(result.out);
  if (!complete || !selected || selected[2] !== complete[1] || !result.out.includes('PACK_AUDIT CLIENT CLIENT') || verified.size + failedTargets.length !== Number(complete[1])) {
    return { code: 2, reason: 'Incomplete CLIENT audit', ...details };
  }
  return { code: result.code === 0 && complete[2] === '0' && !errors.length ? 0 : 1, configs: Number(selected[1]), targets: Number(complete[1]), failures: Number(complete[2]), ...details };
}
module.exports = { verdict };
