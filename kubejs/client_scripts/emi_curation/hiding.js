// priority: 65
// The single home of "what is hidden" decisions for the CLEAN view, kept apart from the
// session lifecycle. policy.js holds the pure rules; this file applies them to EMI stacks.
//
// - isPolicyHidden: the pack's own curation (classification cached per registry key).
// - isDecorHidden: the DECOR toggle (decor_policy.js layers; tags through decor_tags.js). It only
//   feeds the index view. Recipe displays never look at it ("hide from the index only").
// - isDisplayHidden: REI-style display filtering. Hidden by the pack, hidden by the
//   user in EMI, or removed from EMI's index entirely (tag/plugin/data exclusions).
// session.js calls configure() once with the loaded policy and a getter for EMI's current
// master index list. The caches live here and reset on configure() and on a script reload;
// the key-set cache is rebuilt whenever EMI's master index list is replaced.

(function (ns) {
  var policy = null
  var decor = null
  var getMaster = null

  // Classification per registry key (Item/Fluid object), so the id string is built once
  // per key rather than once per stack; only the two NBT-exception ids look at NBT.
  var keyClass = null

  var keySet = null
  var keySetMaster = null

  // Decor classification per registry key (true/false), like keyClass.
  var decorClass = null

  // ctx: { policy: loaded policy, decor: loaded decor policy or null, getMaster: function ()
  // -> EMI's master index list }
  function configure(ctx) {
    policy = ctx.policy
    decor = ctx.decor || null
    getMaster = ctx.getMaster
    keyClass = null
    keySet = null
    keySetMaster = null
    resetDecor()
  }

  // Tag contents depend on the joined world: forget them when EMI starts a new generation.
  function resetDecor() {
    decorClass = null
    ns.decorTags.reset()
  }

  function decorOf(stack) {
    var desc = ns.interop.describe(stack)
    return ns.decorPolicy.classify(decor, desc.id, function () {
      return desc.isItem && ns.decorTags.itemSet(decor).contains(stack.getKey())
    })
  }

  function isDecorHidden(stack) {
    if (decor == null) return false
    if (decorClass == null) decorClass = ns.interop.newIdentityMap()
    var key = stack.getKey()
    var c = decorClass.get(key)
    if (c == null) {
      c = decorOf(stack)
      decorClass.put(key, c)
    }
    return c === true || String(c) === 'true'
  }

  function isPolicyHidden(stack) {
    if (keyClass == null) keyClass = ns.interop.newIdentityMap()
    var key = stack.getKey()
    var c = keyClass.get(key)
    if (c == null) {
      var desc = ns.interop.describe(stack)
      c = ns.policy.classifyId(policy, desc.id, desc.isItem)
      keyClass.put(key, c)
      if (c === 'nbt') return ns.policy.isStackHidden(policy, desc)
      return c === 'hide'
    }
    c = String(c)
    if (c === 'nbt') return ns.policy.isStackHidden(policy, ns.interop.describe(stack))
    return c === 'hide'
  }

  // Item keys present anywhere in the master index. An item whose key is absent was
  // removed by EMI itself (c:hidden_from_recipe_viewers, plugin/data removals), which
  // REI's display filter also treated as hidden.
  function buildKeySet(master) {
    var HashSet = ns.interop.cls('java.util.HashSet')
    var keys = new HashSet()
    var C = ns.collections
    var src = ns.interop.copy(master)
    for (var i = 0; i < C.len(src); i++) keys.add(C.at(src, i).getKey())
    return keys
  }

  // Item keys present in the master list, rebuilt only when that list object changes.
  function currentKeys() {
    var master = getMaster()
    if (keySet == null || !ns.interop.sameRef(master, keySetMaster)) {
      keySet = buildKeySet(master)
      keySetMaster = master
    }
    return keySet
  }

  function isDisplayHidden(stack) {
    if (stack.isEmpty()) return false
    if (isPolicyHidden(stack)) return true
    var EmiHidden = ns.interop.cls('dev.emi.emi.runtime.EmiHidden')
    if (EmiHidden.isHidden(stack)) return true
    var Item = ns.interop.cls('net.minecraft.world.item.Item')
    var key = stack.getKey()
    if (key instanceof Item) return !currentKeys().contains(key)
    return false
  }

  ns.hiding = {
    configure: configure,
    resetDecor: resetDecor,
    isPolicyHidden: isPolicyHidden,
    isDecorHidden: isDecorHidden,
    isDisplayHidden: isDisplayHidden
  }
})(global.emiCuration || (global.emiCuration = {}))
