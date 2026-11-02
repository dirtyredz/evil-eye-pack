'use strict';
// Physical removal policy belongs here, not in the recursive archive reader.
const targets = {
  ipn: { ids: /^(inventoryprofilesnext|libipn)$/, classes: /org[/.]anti_ad[/.]/ },
  kotlin: { ids: /kotlin/i, classes: /(?:kotlin[/.]|kotlinforforge|kotlin_for_forge)/ },
  drawers: { ids: /^createdrawerscompat$/, classes: /dev[/.]createdrawerscompat[/.]/ },
  polymorph: { ids: /^polymorph$/, classes: /com[/.]illusivesoulworks[/.]polymorph[/.]/ },
  diagonal: { ids: /^(diagonalfences|diagonalblocks)$/, classes: /fuzs[/.](?:diagonalfences|diagonalblocks)[/.]/ },
  compatible: { ids: /^create_compatible_storage$/, classes: /net[/.]dadamalda[/.]create_compatible_storage[/.]/ }
};
const profiles = {
  ipn: { targets: ['ipn', 'kotlin'], remove: [], requireSafe: ['ipn'] },
  wave7: { targets: ['drawers', 'polymorph', 'diagonal', 'compatible'], remove: [], requireSafe: [] },
  'wave7-drawers': { targets: ['drawers', 'polymorph', 'diagonal', 'compatible'],
    remove: ['create-storage-drawers-compat.pw.toml'], requireSafe: ['drawers'] }
};
function profile(name = 'ipn') {
  if (!Object.hasOwn(profiles, name)) throw new Error('Unknown closure profile: ' + name);
  return { name, ...profiles[name], definitions: Object.fromEntries(profiles[name].targets.map(k => [k, targets[k]])) };
}
function verdict(result, selected) {
  const blockers = selected.requireSafe.flatMap(kind => result.consumers[kind]
    .filter(c => c.referringClasses || c.dependencies.some(d => d.dependency.type === 'required'))
    .map(c => ({ kind, ...c })));
  return { safe: result.complete && blockers.length === 0, blockers };
}
module.exports = { profile, verdict };
