'use strict';
// The shared shape of a check finding and of a check's section result. Every check builds findings through
// makeFinding so their identity fields (check, code, subject, ref) stay uniform for baseline matching.

// Returns finding(code, subject, ref, message, severity = 'fail', evidence?) for one check. `evidence` is
// only present when given.
function makeFinding(check) {
  return (code, subject, ref, message, severity = 'fail', evidence) => {
    const f = { check, code, subject, ref, message, severity };
    if (evidence !== undefined) f.evidence = evidence;
    return f;
  };
}

// { state: 'findings' | 'passed', findings, stats, ...extra }: findings state when any finding fails.
const sectionResult = (findings, stats, extra = {}) => ({ state: findings.some((f) => f.severity === 'fail') ? 'findings' : 'passed', findings, stats, ...extra });

module.exports = { makeFinding, sectionResult };
