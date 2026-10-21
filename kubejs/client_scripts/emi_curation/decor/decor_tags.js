// priority: 84
// The Java side of the DECOR tag layer: turns the item and block tags named in decor.json
// into one set of Item objects (block tag members map to their item via Block.asItem()).
//
// Tags are read from the live registries (BuiltInRegistries.ITEM/BLOCK .getTag(TagKey)), so
// modded variants that join a common tag (minecraft:stairs, forge:fence_gates, ...) are
// included without listing them. Tag contents change when a world is joined, so the set is
// built lazily and dropped with reset() whenever EMI starts a new index generation.
// Rhino rules (GOTCHAS): Optional/HolderSet are read through size()/get(i), never an
// iterator, and every tag is read inside its own try/catch so one bad tag cannot break the
// others or the session.

(function (ns) {
  var set = null

  function reset() { set = null }

  // Holders of one tag in `registry` (BuiltInRegistries.ITEM or .BLOCK), as a JS array of values.
  function members(registryName, tagId) {
    var I = ns.interop
    var Registries = I.cls('net.minecraft.core.registries.Registries')
    var Built = I.cls('net.minecraft.core.registries.BuiltInRegistries')
    var TagKey = I.cls('net.minecraft.tags.TagKey')
    var Loc = I.cls('net.minecraft.resources.ResourceLocation')
    var loc = Loc.tryParse(tagId)
    if (loc == null) return []
    var isItem = registryName === 'item'
    var key = TagKey.create(isItem ? Registries.ITEM : Registries.BLOCK, loc)
    var found = (isItem ? Built.ITEM : Built.BLOCK).getTag(key)
    if (!found.isPresent()) return []
    var holders = found.get()
    var out = []
    for (var i = 0; i < holders.size(); i++) out.push(holders.get(i).value())
    return out
  }

  function addAll(items, registryName, tagIds, toItem) {
    for (var t = 0; t < tagIds.length; t++) {
      try {
        var list = members(registryName, tagIds[t])
        for (var i = 0; i < list.length; i++) {
          var item = toItem(list[i])
          if (item != null) items.add(item)
        }
      } catch (err) {
        ns.diag.logError('decor tag ' + tagIds[t], err)
      }
    }
  }

  // The HashSet of decor Items for `policy` (built once until reset()).
  function itemSet(policy) {
    if (set != null) return set
    var HashSet = ns.interop.cls('java.util.HashSet')
    var items = new HashSet()
    addAll(items, 'item', policy.itemTags, function (item) { return item })
    addAll(items, 'block', policy.blockTags, function (block) { return block.asItem() })
    set = items
    return set
  }

  ns.decorTags = { itemSet: itemSet, reset: reset }
})(global.emiCuration || (global.emiCuration = {}))
