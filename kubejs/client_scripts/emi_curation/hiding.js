// priority: 65
// The single home of the pack's "what is hidden" decisions for the CLEAN view, kept apart from the
// session lifecycle. policy.js holds the pure rules; this file applies them to EMI stacks.
//
// - isPolicyHidden: the pack's own curation (classification cached per registry key).
// - isDisplayHidden: REI-style display filtering. Hidden by the pack, hidden by the
//   user in EMI, or removed from EMI's index entirely (tag/plugin/data exclusions).
// DECOR is not decided here: see decor/decor_state.js.
// session.js calls configure() once with the loaded policy and a getter for EMI's current
// master index list. The caches live here and reset on configure() and on a script reload;
// the key-set cache is rebuilt whenever EMI's master index list is replaced.

(function (ns) {
  var policy = null
  var getMaster = null

  // Classification per registry key (Item/Fluid object), so the id string is built once
  // per key rather than once per stack; only NBT-rule verdicts read per-stack NBT.
  var keyClass = null

  var keySet = null
  var keySetMaster = null

  // ctx: { policy: loaded policy, getMaster: function () -> EMI's master index list }
  function configure(ctx) {
    policy = ctx.policy
    getMaster = ctx.getMaster
    keyClass = null
    keySet = null
    keySetMaster = null
  }

  function isPolicyHidden(stack) {
    if (keyClass == null) keyClass = ns.interop.newIdentityMap()
    var key = stack.getKey()
    var verdict = keyClass.get(key)
    var desc = null
    if (verdict == null) {
      desc = ns.interop.describe(stack)
      verdict = ns.policy.classifyId(policy, desc.id, desc.isItem)
      keyClass.put(key, verdict)
    }
    // On cache hits neither the id nor the item class is read again. NBT remains lazy
    // and belongs to this stack, never to the stack that first populated the cache.
    return ns.policy.verdictHidden(verdict, desc || {
      nbt: function () { return ns.interop.toPlainNbt(stack.getNbt()) }
    })
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
    if (ns.interop.isItemKey(stack)) return !currentKeys().contains(stack.getKey())
    return false
  }

  ns.hiding = { configure: configure, isPolicyHidden: isPolicyHidden, isDisplayHidden: isDisplayHidden }
})(global.emiCuration || (global.emiCuration = {}))
