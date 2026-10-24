'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { scanResources, serverSources, shippedMentions } = require('./resources.cjs');
const { packConfigFiles } = require('../verdict/policy.cjs');

// Raw resources, shipped-config mentions and the pack's own policy files, read from the staged server.
function stageEvidence(stageDir, evidenceDir, data) {
  fs.mkdirSync(path.join(evidenceDir, 'pack-config'), { recursive: true });
  const ev = scanResources(serverSources(stageDir), { removedNamespaces: data.policy.removedMods });
  ev.shipped = shippedMentions(stageDir, data.policy.removedMods);
  fs.writeFileSync(path.join(evidenceDir, 'resources.json'), JSON.stringify(ev));
  for (const f of packConfigFiles(data.policy)) fs.copyFileSync(path.join(stageDir, f), path.join(evidenceDir, 'pack-config', path.basename(f)));
}

module.exports = { stageEvidence };
