// Permanent recipe/tag policy. No inventory hooks, swaps or registry remaps.
;(function () {
  var policy = JsonIO.read('kubejs/config/dedup.json')
  var sources = JsonIO.read('kubejs/config/dedup_sources.json')
  var retired = Object.keys(policy.replacements).concat(policy.disabled)

  ServerEvents.recipes(function (event) {
    sources.removeRecipes.forEach(function (id) { event.remove({ id: id }) })
    policy.disabled.forEach(function (id) { event.remove({ output: id }) })
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
    ;(sources.blockTagRemovals || []).forEach(function (id) { event.removeAllTagsFrom(id) })
    Object.keys(sources.blockTags).forEach(function (tag) { event.add(tag, sources.blockTags[tag]) })
  })
})()
