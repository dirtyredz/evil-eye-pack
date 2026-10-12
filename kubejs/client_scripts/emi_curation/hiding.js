// priority: 65
// "What is hidden" decisions for the CLEAN view, kept apart from the session lifecycle.
//
// - isPolicyHidden: the pack's own curation (classification cached per registry key).
// - isDisplayHidden: REI-style display filtering. Hidden by the pack, hidden by the
//   user in EMI, or removed from EMI's index entirely (tag/plugin/data exclusions).
// Both take the loaded policy explicitly; the caches live here and reset on a script
// reload. The key-set cache is rebuilt whenever EMI's master index list is replaced.

(function (ns) {
  // Classification per registry key (Item/Fluid object), so the id string is built once
  // per key rather than once per stack; only the two NBT-exception ids look at NBT.
  var keyClass = null

  var keySet = null
  var keySetMaster = null

  function isPolicyHidden(policy, stack) {
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

  // Item keys present in `master`, rebuilt only when the master list object changes.
  function keysOf(master) {
    if (keySet == null || !ns.interop.sameRef(master, keySetMaster)) {
      keySet = ns.indexView.buildKeySet(master)
      keySetMaster = master
    }
    return keySet
  }

  // `master` is EMI's current master index list (session state).
  function isDisplayHidden(policy, master, stack) {
    if (stack.isEmpty()) return false
    if (isPolicyHidden(policy, stack)) return true
    var EmiHidden = ns.interop.cls('dev.emi.emi.runtime.EmiHidden')
    if (EmiHidden.isHidden(stack)) return true
    var Item = ns.interop.cls('net.minecraft.world.item.Item')
    var key = stack.getKey()
    if (key instanceof Item) return !keysOf(master).contains(key)
    return false
  }

  ns.hiding = { isPolicyHidden: isPolicyHidden, isDisplayHidden: isDisplayHidden }
})(global.emiCuration || (global.emiCuration = {}))
