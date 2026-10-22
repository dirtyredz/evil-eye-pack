// priority: 85
// Java interop shared by the EMI view adapters: class lookup, reference identity,
// Java list construction, screen/Component helpers, and EmiStack -> policy descriptor conversion (including a
// structural NBT -> plain-value walk). Rhino rules: index loops only over Java
// collections, `instanceof` against Java.loadClass classes, never `.class`.

(function (ns) {
  var classes = {}

  function cls(name) {
    var c = classes[name]
    if (c === undefined) {
      c = Java.loadClass(name)
      classes[name] = c
    }
    return c
  }

  // Java reference identity, independent of how Rhino wraps the two values.
  function sameRef(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return a == null && b == null
    var IdentityHashMap = cls('java.util.IdentityHashMap')
    var m = new IdentityHashMap()
    m.put(a, true)
    return m.containsKey(b)
  }

  // True for AbstractContainerScreen (container and inventory screens), the only screens
  // that get the EMI buttons.
  function isContainerScreen(screen) {
    return screen instanceof cls('net.minecraft.client.gui.screens.inventory.AbstractContainerScreen')
  }

  // A literal text Component.
  function literal(text) {
    return cls('net.minecraft.network.chat.Component').literal(text)
  }

  function newIdentityMap() {
    var IdentityHashMap = cls('java.util.IdentityHashMap')
    return new IdentityHashMap()
  }

  function newList() {
    var ArrayList = cls('java.util.ArrayList')
    return new ArrayList()
  }

  // Plain java.util.ArrayList snapshot of any Java collection. EMI and the JDK hand
  // back JDK-internal immutable lists (List.of, toList(), ...) whose concrete class
  // (ImmutableCollections$ListN) is not exported, so Rhino's reflective size()/get()
  // on them throws IllegalAccessException. The ArrayList constructor copies through
  // the Collection interface in Java, so the script only ever touches a public class.
  function copy(list) {
    if (list === null || list === undefined) return list
    var ArrayList = cls('java.util.ArrayList')
    return new ArrayList(list)
  }

  function freeze(list) {
    return cls('java.util.Collections').unmodifiableList(list)
  }

  // Immutable list of the elements of `javaList` for which keepFn(element) is truthy,
  // in order. Snapshots through copy() first, then index-loops (Rhino cannot for...of
  // a Java collection; see GOTCHAS). The one home of list *filtering* (hiding.js buildKeySet still iterates a Java list by hand to build a set, deliberately).
  function filterToList(javaList, keepFn) {
    var out = newList()
    var C = ns.collections
    var src = copy(javaList)
    for (var i = 0; i < C.len(src); i++) {
      var el = C.at(src, i)
      if (keepFn(el)) out.add(el)
    }
    return freeze(out)
  }

  // True when an EmiStack's key is an Item (as opposed to a Fluid).
  function isItemKey(stack) {
    return stack.getKey() instanceof cls('net.minecraft.world.item.Item')
  }

  var NUMERIC = { 1: 'byte', 2: 'short', 3: 'int', 4: 'long', 5: 'float', 6: 'double' }

  // CompoundTag -> plain object, ListTag -> array, StringTag -> string, numbers and
  // arrays -> tagged values so they never equal a string in the curation rules.
  function toPlainNbt(tag) {
    if (tag === null || tag === undefined) return null
    var id = Number(tag.getId())
    if (id === 10) {
      var out = {}
      var it = tag.getAllKeys().iterator()
      while (it.hasNext()) {
        var key = String(it.next())
        out[key] = toPlainNbt(tag.get(key))
      }
      return out
    }
    if (id === 9) {
      var arr = []
      for (var i = 0; i < tag.size(); i++) arr.push(toPlainNbt(tag.get(i)))
      return arr
    }
    if (id === 8) return String(tag.getAsString())
    if (NUMERIC[id]) return { $nbt: NUMERIC[id], value: Number(tag.getAsNumber()) }
    return { $nbt: 'tag' + id, value: String(tag.getAsString()) }
  }

  // EmiStack -> { id, isItem, nbt() } for ns.policy.isStackHidden.
  function describe(stack) {
    return {
      id: String(stack.getId()),
      isItem: isItemKey(stack),
      nbt: function () { return toPlainNbt(stack.getNbt()) }
    }
  }

  ns.interop = {
    cls: cls,
    isContainerScreen: isContainerScreen,
    literal: literal,
    sameRef: sameRef,
    newIdentityMap: newIdentityMap,
    copy: copy,
    filterToList: filterToList,
    isItemKey: isItemKey,
    toPlainNbt: toPlainNbt,
    describe: describe
  }
})(global.emiCuration || (global.emiCuration = {}))
