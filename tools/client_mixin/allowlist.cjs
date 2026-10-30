'use strict';
const fs = require('node:fs');

function key(entry, fields) {
  return fields.map(field => entry[field]).join('\0');
}

function loadAllowlist(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const shapes = {
    missingTargets: ['mod', 'config', 'mixin', 'target'],
    unhandled: ['config', 'target'],
  };
  const out = {};
  for (const [kind, fields] of Object.entries(shapes)) {
    if (!Array.isArray(data[kind])) throw Error(`Client-mixin allow-list ${kind} must be an array`);
    const seen = new Set();
    out[kind] = data[kind].map((entry, index) => {
      if (!entry || typeof entry !== 'object' || fields.some(field => typeof entry[field] !== 'string' || !entry[field])) {
        throw Error(`Client-mixin allow-list ${kind}[${index}] has invalid match fields`);
      }
      if (typeof entry.reason !== 'string' || entry.reason.trim().length < 20) {
        throw Error(`Client-mixin allow-list ${kind}[${index}] needs a specific reason`);
      }
      const id = key(entry, fields);
      if (seen.has(id)) throw Error(`Duplicate client-mixin allow-list ${kind} entry: ${id.replaceAll('\0', ' / ')}`);
      seen.add(id);
      return { ...entry, reason: entry.reason.trim() };
    });
  }
  return out;
}

module.exports = { loadAllowlist, key };
