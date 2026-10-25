'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { scan } = require('../../malware_guard/scanning/scan.cjs');
const { gate } = require('../../malware_guard/gate.cjs');
const { drift } = require('../../malware_guard/drift.cjs');
const { metadata } = require('../../malware_guard/metadata.cjs');
function writeMalwareEvidence(stage, evidenceDir, { root, instance = '' }) {
  const empty = { schema: 1, entries: [] };
  const evidence = { schema: 1, scan: scan(stage, { policy: empty }), gate: gate(root),
    drift: instance ? drift(instance, { expected: metadata(root).expected, owners: empty }) : null };
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'malware.json'), JSON.stringify(evidence));
  return evidence;
}
module.exports = { writeMalwareEvidence };
