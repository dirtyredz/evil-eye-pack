// priority: 85
// Java interop shared by the EMI view adapters: class lookup, reference identity,
// Java list construction, and EmiStack -> policy descriptor conversion (including a
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
    var Item = cls('net.minecraft.world.item.Item')
    return {
      id: String(stack.getId()),
      isItem: stack.getKey() instanceof Item,
      nbt: function () { return toPlainNbt(stack.getNbt()) }
    }
  }

  // Length / element access that works for JS arrays and Java lists alike.
  function len(list) {
    if (list === null || list === undefined) return 0
    return typeof list.size === 'function' ? list.size() : list.length
  }

  function at(list, i) {
    return typeof list.get === 'function' ? list.get(i) : list[i]
  }

  ns.interop = {
    cls: cls,
    len: len,
    at: at,
    sameRef: sameRef,
    newIdentityMap: newIdentityMap,
    newList: newList,
    copy: copy,
    freeze: freeze,
    toPlainNbt: toPlainNbt,
    describe: describe
  }
})(global.emiCuration || (global.emiCuration = {}))
