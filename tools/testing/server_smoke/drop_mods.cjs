'use strict';
// Smoke diagnostic policy: delete installed jars whose name contains a term, from the throwaway server
// only (to find the next offender).
const fs = require('node:fs');
const path = require('node:path');

function dropMods(runDir, terms, log) {
  const modsDir = path.join(runDir, 'mods');
  for (const term of terms) {
    for (const f of fs.readdirSync(modsDir)) {
      if (f.toLowerCase().includes(term.toLowerCase())) { fs.rmSync(path.join(modsDir, f)); log(`dropped ${f}`); }
    }
  }
}

module.exports = { dropMods };
