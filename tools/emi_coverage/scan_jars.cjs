#!/usr/bin/env node
'use strict';
// Read-only survey of recipe-viewer integration in a directory of mod jars.
//
//   node tools/emi_coverage/scan_jars.cjs <mods-dir> [extra.jar ...] [--json]
//
// For every jar (and every nested jar inside it, e.g. META-INF/jarjar/*.jar) it reports
// the mod IDs declared in META-INF/mods.toml, viewer-related dependencies, and classes
// whose constant pool names a viewer plugin annotation:
//   JEI  Lmezz/jei/api/JeiPlugin;           (JEI plugin discovery annotation)
//   EMI  Ldev/emi/emi/api/EmiEntrypoint;    (native EMI plugin discovery annotation)
//   REI  Lme/shedaniel/rei/forge/REIPlugin* (REI Forge plugin annotations)
// Jars are treated as untrusted data: bytes are read and searched, never executed.

const fs = require('node:fs');
const path = require('node:path');
const { listEntries, readEntry } = require('../data_io/zip_reader.cjs');

const MARKERS = {
  jei: Buffer.from('Lmezz/jei/api/JeiPlugin;'),
  emi: Buffer.from('Ldev/emi/emi/api/EmiEntrypoint;'),
  rei: Buffer.from('Lme/shedaniel/rei/forge/REIPlugin'),
};
const VIEWER_DEPS = ['jei', 'emi', 'roughlyenoughitems', 'rei_plugin_compatibilities', 'justenoughprofessions', 'roughlyenoughprofessions'];

function parseModsToml(text) {
  const modIds = [];
  const deps = [];
  const blocks = text.split(/^\s*\[\[/m);
  for (const block of blocks) {
    const header = block.split(/\r?\n/, 1)[0].trim();
    const get = (key) => {
      const m = block.match(new RegExp('^\\s*' + key + '\\s*=\\s*"?([^"\\r\\n#]*)"?', 'm'));
      return m ? m[1].trim() : null;
    };
    if (header.startsWith('mods]]')) {
      const id = get('modId');
      if (id) modIds.push(id);
    } else if (header.startsWith('dependencies.')) {
      const owner = header.slice('dependencies.'.length).replace(/]].*$/, '').replace(/"/g, '');
      const id = get('modId');
      const mandatory = get('mandatory');
      const type = get('type');
      const required = mandatory === 'true' || (type !== null && type.toLowerCase() === 'required');
      deps.push({ owner, modId: id, required, versionRange: get('versionRange') });
    }
  }
  return { modIds, deps };
}

function scanArchive(buf, label, out, depth) {
  const record = { jar: label, modIds: [], viewerDeps: [], jei: [], emi: [], rei: [], nested: [] };
  let entries;
  try {
    entries = listEntries(buf);
  } catch (err) {
    record.error = String(err.message || err);
    out.push(record);
    return record;
  }
  for (const entry of entries) {
    if (entry.name.endsWith('/')) continue;
    if (entry.name === 'META-INF/mods.toml') {
      const toml = parseModsToml(readEntry(buf, entry).toString('utf8'));
      record.modIds = toml.modIds;
      record.viewerDeps = toml.deps.filter((d) => d.modId && VIEWER_DEPS.includes(d.modId));
    } else if (entry.name.endsWith('.class')) {
      const bytes = readEntry(buf, entry);
      const cls = entry.name.slice(0, -'.class'.length).replace(/\//g, '.');
      for (const key of Object.keys(MARKERS)) {
        if (bytes.includes(MARKERS[key])) record[key].push(cls);
      }
    } else if (entry.name.endsWith('.jar') && depth < 3) {
      const nested = scanArchive(readEntry(buf, entry), label + '!/' + entry.name, out, depth + 1);
      record.nested.push(nested.jar);
    }
  }
  out.push(record);
  return record;
}

function main(argv) {
  const json = argv.includes('--json');
  const args = argv.filter((a) => a !== '--json');
  if (args.length === 0) {
    console.error('usage: scan_jars.cjs <mods-dir> [extra.jar ...] [--json]');
    return 2;
  }
  const jars = [];
  for (const arg of args) {
    const stat = fs.statSync(arg);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(arg).sort()) {
        if (name.endsWith('.jar')) jars.push(path.join(arg, name));
      }
    } else {
      jars.push(arg);
    }
  }
  const out = [];
  for (const jar of jars) scanArchive(fs.readFileSync(jar), path.basename(jar), out, 0);
  out.sort((a, b) => a.jar.localeCompare(b.jar));
  if (json) {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return 0;
  }
  for (const r of out) {
    const parts = [];
    if (r.error) parts.push('ERROR ' + r.error);
    if (r.emi.length) parts.push('EMI[' + r.emi.join(', ') + ']');
    if (r.jei.length) parts.push('JEI[' + r.jei.join(', ') + ']');
    if (r.rei.length) parts.push('REI[' + r.rei.join(', ') + ']');
    const deps = r.viewerDeps.map((d) => d.owner + '->' + d.modId + (d.required ? '(required)' : '(optional)'));
    if (deps.length) parts.push('deps{' + deps.join(', ') + '}');
    if (parts.length) console.log(r.jar + ' [' + r.modIds.join(',') + ']: ' + parts.join(' '));
  }
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { parseModsToml, scanArchive };
