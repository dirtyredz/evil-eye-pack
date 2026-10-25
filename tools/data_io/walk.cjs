'use strict';
// ZIP traversal only. Callers own resource selection, parsing and merge policy.
const path = require('node:path');
const { listEntries, readEntry } = require('./zip_reader.cjs');
function walkJar(buf, source, visit, { matches, nested = false, inspect = () => {}, encoding = 'utf8', beforeRead = () => undefined }) {
  for (const entry of listEntries(buf)) {
    if (nested && /^META-INF\/jarjar\/.+\.jar$/.test(entry.name)) {
      walkJar(readEntry(buf, entry, beforeRead(entry)), source + '!' + path.basename(entry.name), visit, { matches, nested, inspect, encoding, beforeRead });
      continue;
    }
    inspect(entry.name);
    if (matches(entry.name)) {
      const bytes = readEntry(buf, entry, beforeRead(entry));
      visit(entry.name, encoding === null ? bytes : bytes.toString(encoding), source);
    }
  }
}
module.exports = { walkJar };
