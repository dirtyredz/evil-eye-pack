// Permanent recipe/tag policy. No inventory hooks, swaps or registry remaps.
;(function () {
  var policy = JsonIO.read('kubejs/config/dedup.json')
  var sources = JsonIO.read('kubejs/config/dedup_sources.json')
  var retired = Object.keys(policy.replacements).concat(policy.disabled)

  ServerEvents.recipes(function (event) {
    sources.removeRecipes.forEach(function (id) { event.remove({ id: id }) })
    policy.disabled.forEach(function (id) { event.remove({ output: id }) })
    // Alex's Caves uranium remains biome-specific, but can fuel Extreme Reactors.
    event.smelting('bigreactors:yellorium_ingot', 'alexscaves:uranium').id('kubejs:uranium_ingot')
    event.blasting('bigreactors:yellorium_ingot', 'alexscaves:uranium').id('kubejs:uranium_ingot_blasting')
    // Create's compat crushed uranium otherwise loses its smelting target with ATO gone.
    event.smelting('bigreactors:yellorium_ingot', 'create:crushed_raw_uranium').id('kubejs:crushed_uranium_ingot')
    event.blasting('bigreactors:yellorium_ingot', 'create:crushed_raw_uranium').id('kubejs:crushed_uranium_ingot_blasting')
  })

  function tags(event, additions) {
    retired.forEach(function (id) { event.removeAllTagsFrom(id) })
    Object.keys(additions).forEach(function (tag) { event.add(tag, additions[tag]) })
  }
  ServerEvents.tags('item', function (event) {
    tags(event, sources.itemTags)
    // Jar tags that mislabel a decor item as a material (e.g. Cluttered's chiseled gold block as gold storage).
    Object.keys(policy.tagRemovals || {}).forEach(function (tag) { event.remove(tag, policy.tagRemovals[tag]) })
  })
  ServerEvents.tags('block', function (event) {
    // Only block duplicates have block tags. Do not feed non-block item ids to the registry.
    Object.keys(policy.replacements).forEach(function (id) {
      if (id.indexOf('cluttered:') === 0 || (id.indexOf('createdeco:') === 0 && id !== 'createdeco:zinc_sheet') || id === 'farmersdelight:rope') event.removeAllTagsFrom(id)
    })
    Object.keys(sources.blockTags).forEach(function (tag) { event.add(tag, sources.blockTags[tag]) })
  })
})()
