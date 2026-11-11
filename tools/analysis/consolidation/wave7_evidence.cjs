'use strict';
const { inventory, digest, classifyFile } = require('../../data_io/world/inventory.cjs');
const { files } = require('../../data_io/world/files.cjs');
const storageIds = new Set(['createdrawerscompat:drawer', ...[
  'uncooperative', 'furniture_refurbished', 'repository', 'closet', 'iron_chest',
  'crystal_chest', 'iron_shulker_box', 'crate', 'sound', 'sound_uncooperative'
].map(id => 'create_compatible_storage:' + id)]);

function collector() {
  const result = { schema:1, complete:false, mounted:[], polymorph:[], diagonalReferences:[],
    actualDiagonalBlocks:{}, unsupportedFiles:[], errors:[],
    scope:'Historical supplied snapshot only; absence does not establish current Stable non-use.',
    quantities:'Raw payload counts and compacting views are retained, never summed as independent holdings.' };
  const documents = new Map();
  function visit(value, context) {
    function walk(v, trail) {
      if (!v || typeof v !== 'object' || Buffer.isBuffer(v)) return;
      if (Array.isArray(v)) {
        if (v.length && typeof v[0] !== 'object') return;
        v.forEach((x, i) => walk(x, trail + '/' + i)); return;
      }
      if (typeof v.type === 'string' && storageIds.has(v.type)) {
        const sha256 = digest(v);
        let row = documents.get(sha256);
        if (!row) {
          row = { type:v.type, sha256, payload:v, occurrences:[] };
          documents.set(sha256, row); result.mounted.push(row);
        }
        // Equal documents can be independent inventories. Grouping is for provenance,
        // never an assertion that equal payloads are one physical holding.
        row.occurrences.push({ ...context, path:trail });
        if (v.type === 'createdrawerscompat:drawer' &&
            (!v.drawer_data || typeof v.drawer_data !== 'object' || !v.drawer_data.state || !v.drawer_data.block_entity)) {
          result.errors.push({ ...context, path:trail, error:'Malformed drawer_data document' });
        }
      }
      if (typeof v.type === 'string' && /^(createdrawerscompat|create_compatible_storage):/.test(v.type) && !storageIds.has(v.type))
        result.errors.push({ ...context, path:trail, payload:v, error:'Unsupported mounted-storage identity: ' + v.type });
      for (const [key, child] of Object.entries(v)) {
        const at = trail + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
        if (key.startsWith('polymorph:') || key === 'SelectedRecipe')
          result.polymorph.push({ ...context, path:at, key, payload:child });
        if (typeof child === 'string' && child.startsWith('diagonalfences:'))
          result.diagonalReferences.push({ ...context, path:at, id:child,
            kind:'reference only; palette membership does not establish placement' });
        walk(child, at);
      }
    }
    walk(value, '');
  }
  return { result, visit };
}

function report(world) {
  const {result, visit} = collector();
  const inv = inventory(world, {visit});
  result.errors.push(...inv.errors);
  result.actualDiagonalBlocks = Object.fromEntries(Object.entries(inv.blocks).filter(([id]) => id.startsWith('diagonalfences:')));
  result.files = inv.files; result.chunks = inv.chunks;
  // Explicitly classify every file outside the supported current NBT/region inputs.
  // Unknown formats invalidate completeness; known auxiliary/backup files stay listed.
  result.excludedFiles = [];
  for (const file of files(world)) {
    const classification = classifyFile(file);
    if (classification.excludedReason) result.excludedFiles.push({file, reason:classification.excludedReason});
    if (classification.unsupportedReason) result.unsupportedFiles.push({file, reason:classification.unsupportedReason});
  }
  result.complete = result.errors.length === 0 && result.unsupportedFiles.length === 0;
  return result;
}
module.exports = { storageIds, collector, report };
