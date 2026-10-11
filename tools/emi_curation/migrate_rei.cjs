#!/usr/bin/env node
'use strict';
// Converts / checks the REI manual hide list against the EMI curation item lists.
//
//   node tools/emi_curation/migrate_rei.cjs --check   (default) verify exact set equality
//   node tools/emi_curation/migrate_rei.cjs --write   regenerate config/emi-curation/*.json
//
// Source: tools/emi_curation/fixtures/rei-config.json5 (the frozen REI 12.1.785 config).
// Every `advanced.filtering.filteredStacks` entry must be a plain serialized item stack
// `{type:"minecraft:item",id:"<ns>:<path>",Count:1b}`. Any other serialization (extra
// fields, NBT `tag:`, other entry types, other counts) is rejected rather than guessed at.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(ROOT, 'tools', 'emi_curation', 'fixtures', 'rei-config.json5');
const CURATION_DIR = path.join(ROOT, 'config', 'emi-curation');
const SCHEMA = 1;
const ID_RE = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
const STACK_RE = /^\{type:"minecraft:item",id:"([^"]+)",Count:1b\}$/;

// Group order matters only for the split; set equality is checked independently.
const GROUPS = [
  { file: 'creative.json', group: 'creative', expected: 20,
    description: 'Creative-only items hidden from the CLEAN index.',
    test: (id) => id.indexOf('creative') !== -1 },
  { file: 'compressed.json', group: 'compressed', expected: 654,
    description: 'AllTheCompressed 4x-9x tiers hidden from the CLEAN index; lower tiers stay visible.',
    test: (id) => id.startsWith('allthecompressed:') },
  { file: 'enderio-glass.json', group: 'enderio-glass', expected: 708,
    description: 'Ender IO coloured and pass-through/collision glass and fused quartz; plain, _e and _d variants stay visible.',
    test: (id) => id.startsWith('enderio:') },
  { file: 'minecolonies-eggs.json', group: 'minecolonies-eggs', expected: 16,
    description: 'MineColonies raider/pirate/pharaoh eggs (their IDs lack spawn_egg).',
    test: (id) => id.startsWith('minecolonies:') },
  { file: 'colours.json', group: 'colours', expected: 361,
    description: 'Colour variants; the uncoloured/base example of each family stays visible.',
    test: () => true },
];
const EXPECTED_TOTAL = 1759;

/** Extracts the JSON string literals of advanced.filtering.filteredStacks from REI json5 text. */
function extractFilteredStacks(text) {
  const start = text.indexOf('"filteredStacks": [');
  if (start === -1) throw new Error('fixture has no "filteredStacks" array');
  const end = text.indexOf(']', start);
  const body = text.slice(start + '"filteredStacks": ['.length, end);
  const out = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim().replace(/,$/, '');
    if (line === '') continue;
    if (!line.startsWith('"') || !line.endsWith('"')) throw new Error('unrecognized filteredStacks line: ' + line);
    out.push(JSON.parse(line));
  }
  return out;
}

/** Parses one serialized REI stack; throws on anything other than a plain item stack. */
function parseStack(serialized) {
  const m = STACK_RE.exec(serialized);
  if (!m) throw new Error('unrecognized serialized stack (NBT, count or type not supported): ' + serialized);
  if (!ID_RE.test(m[1])) throw new Error('invalid item id in serialized stack: ' + serialized);
  return m[1];
}

function readSourceIds(fixturePath) {
  const ids = extractFilteredStacks(fs.readFileSync(fixturePath, 'utf8')).map(parseStack);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) throw new Error('duplicate source id: ' + id);
    seen.add(id);
  }
  return ids;
}

function splitGroups(ids) {
  const buckets = GROUPS.map(() => []);
  for (const id of ids) {
    const i = GROUPS.findIndex((g) => g.test(id));
    buckets[i].push(id);
  }
  return buckets;
}

function readList(file) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (doc.schema !== SCHEMA) throw new Error(file + ': schema must be ' + SCHEMA);
  if (!Array.isArray(doc.items)) throw new Error(file + ': items must be an array');
  for (const id of doc.items) {
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error(file + ': invalid item id ' + JSON.stringify(id));
  }
  return doc;
}

/** Returns a list of problems; empty means the lists equal the source exactly. */
function check(fixturePath, curationDir) {
  const problems = [];
  const source = readSourceIds(fixturePath);
  if (source.length !== EXPECTED_TOTAL) problems.push('source has ' + source.length + ' ids, expected ' + EXPECTED_TOTAL);
  const union = new Map();
  for (const g of GROUPS) {
    const doc = readList(path.join(curationDir, g.file));
    if (doc.group !== g.group) problems.push(g.file + ': group must be ' + g.group);
    if (doc.items.length !== g.expected) problems.push(g.file + ': ' + doc.items.length + ' ids, expected ' + g.expected);
    for (const id of doc.items) {
      if (union.has(id)) problems.push('duplicate id ' + id + ' in ' + g.file + ' and ' + union.get(id));
      else union.set(id, g.file);
    }
  }
  const sourceSet = new Set(source);
  for (const id of sourceSet) if (!union.has(id)) problems.push('missing from curation lists: ' + id);
  for (const id of union.keys()) if (!sourceSet.has(id)) problems.push('extra id not in REI source: ' + id);
  return { problems, sourceCount: source.length, unionCount: union.size };
}

function write(fixturePath, curationDir) {
  const buckets = splitGroups(readSourceIds(fixturePath));
  fs.mkdirSync(curationDir, { recursive: true });
  GROUPS.forEach((g, i) => {
    const doc = { schema: SCHEMA, group: g.group, description: g.description, items: buckets[i] };
    fs.writeFileSync(path.join(curationDir, g.file), JSON.stringify(doc, null, 2) + '\n');
  });
}

function main(argv) {
  const mode = argv.includes('--write') ? 'write' : 'check';
  if (mode === 'write') write(FIXTURE, CURATION_DIR);
  const result = check(FIXTURE, CURATION_DIR);
  if (result.problems.length) {
    for (const p of result.problems) console.error('FAIL ' + p);
    return 1;
  }
  console.log('OK ' + result.sourceCount + ' REI source ids == ' + result.unionCount +
    ' curation ids (exact set equality; ' + GROUPS.map((g) => g.group + '=' + g.expected).join(', ') + ')');
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { GROUPS, EXPECTED_TOTAL, extractFilteredStacks, parseStack, readSourceIds, check, FIXTURE, CURATION_DIR };
