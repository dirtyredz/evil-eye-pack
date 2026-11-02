'use strict';
// Per-mod kind with its evidence. Overrides are reasoned, checked-in corrections.
function classify(mod, node, dependedOn, registries, overrides = {}) {
  const override = overrides[mod.id];
  const counts = registries ? ['items', 'blocks', 'entities'].map(k => (registries[k] || []).filter(id => id.startsWith(mod.id + ':')).length) : null;
  const words = mod.name + ' ' + mod.description;
  let kind = 'utility', evidence = 'fallback; review classification';
  if (node.side === 'client') { kind = 'client-only/cosmetic'; evidence = '.pw.toml side=client'; }
  else if (/\b(performance|optimi[sz]|memory usage|lag reduction|faster loading)/i.test(words)) { kind = 'performance'; evidence = 'metadata description'; }
  else if (/\b(world gen|worldgen|biomes|terrain generation|ore generation)/i.test(words)) { kind = 'worldgen'; evidence = 'metadata description'; }
  else if (dependedOn && counts && counts.every(n => n === 0)) { kind = 'library/API'; evidence = 'mandatory users and zero item/block/entity IDs (heuristic)'; }
  else if (/\b(library|api|framework)\b/i.test(words)) { kind = 'library/API'; evidence = 'metadata description'; }
  else if (counts && counts.some(n => n > 0)) { kind = 'content'; evidence = 'live item/block/entity registrations'; }
  if (override) { kind = override.kind || kind; evidence = 'checked-in override: ' + override.reason; }
  return { kind, evidence, counts, description: override?.description || mod.description || node.name, packWideFix: override?.packWideFix };
}
// Classify every mod of every node, keyed by node key, in mod order.
function classifyAll(nodes, registries, overrides = {}) {
  const dependedOn = new Set(nodes.flatMap(n => n.dependencies));
  return new Map(nodes.map(n => [n.key, n.mods.map(m => classify(m, n, dependedOn.has(n.key), registries, overrides))]));
}
// A node is a library when it has mods and every one of them is a library/API.
function isLibrary(classifications, node) {
  const kinds = classifications.get(node.key);
  return !!kinds && kinds.length > 0 && kinds.every(c => c.kind === 'library/API');
}
function isContent(classifications, node) {
  return classifications.get(node.key).some(c => c.kind === 'content' || c.kind === 'worldgen');
}
module.exports = { classify, classifyAll, isLibrary, isContent };
