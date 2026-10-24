'use strict';
// ZIP traversal only. Callers own resource selection, parsing and merge policy.
const path = require('node:path');
const { listEntries, readEntry } = require('./zip_reader.cjs');
function walkJar(buf, source, visit, { matches, nested = false, inspect = () => {} }) {
  for (const entry of listEntries(buf)) {
    if (nested && /^META-INF\/jarjar\/.+\.jar$/.test(entry.name)) {
      walkJar(readEntry(buf, entry), source + '!' + path.basename(entry.name), visit, { matches, nested, inspect });
      continue;
    }
    inspect(entry.name);
    if (matches(entry.name)) visit(entry.name, readEntry(buf, entry).toString('utf8'), source);
  }
}
module.exports = { walkJar };
