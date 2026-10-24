// priority: 88
// The owner's local DECOR marks: config/emi-curation/decor-local.json, written in game by the
// "mark as decor" key (ui/decor_mark.js). Pure logic plus an injected IO object, so the same file
// runs under KubeJS Rhino and the Node tests. Not in the pack index: packwiz never overwrites it.
//
// File: { "schema": 1, "forceDecor": [ids], "forceNotDecor": [ids], "mods": [namespaces],
//         "notMods": [namespaces] }
// Precedence (first match wins, all before the shipped decor.json layers):
//   1. local item marks: forceNotDecor, forceDecor (a set holds an id in at most one list)
//   2. local mod marks: notMods (never decor), mods (always decor)
//   3. nothing -> null, and decor_policy.classify decides ("automatic")
// An item mark beats a mod mark, so one stair can stay visible inside a decor mod.
// Cycles (item and mod alike): automatic -> decor -> not decor -> automatic.

(function (ns) {
  var SCHEMA = 1
  var PATH = 'config/emi-curation/decor-local.json'
  var AUTO = 'automatic'
  var DECOR = 'decor'
  var NOT_DECOR = 'not decor'
  var LISTS = ['forceDecor', 'forceNotDecor', 'mods', 'notMods']

  function fail(msg) { throw new Error('emi-curation decor-local: ' + msg) }

  function empty() { return { forceDecor: {}, forceNotDecor: {}, mods: {}, notMods: {} } }

  function clone(data) {
    var out = empty()
    for (var i = 0; i < LISTS.length; i++) {
      var keys = Object.keys(data[LISTS[i]])
      for (var k = 0; k < keys.length; k++) out[LISTS[i]][keys[k]] = true
    }
    return out
  }

  function list(doc, name, re) {
    var value = doc[name]
    if (value === undefined) return {}
    if (!Array.isArray(value)) fail(name + ' must be an array')
    var out = {}
    for (var i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string' || !re.test(value[i])) fail(name + '[' + i + '] is invalid: ' + JSON.stringify(value[i]))
      out[value[i]] = true
    }
    return out
  }

  function disjoint(a, b, nameA, nameB) {
    var keys = Object.keys(a)
    for (var i = 0; i < keys.length; i++) if (b[keys[i]] === true) fail(JSON.stringify(keys[i]) + ' is in both ' + nameA + ' and ' + nameB)
  }

  // Throws on anything malformed; the caller then ignores the whole file.
  function parse(text) {
    var doc = JSON.parse(String(text))
    if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc.schema !== SCHEMA) fail('schema must be ' + SCHEMA)
    var data = {
      forceDecor: list(doc, 'forceDecor', ns.decorPolicy.ID_RE),
      forceNotDecor: list(doc, 'forceNotDecor', ns.decorPolicy.ID_RE),
      mods: list(doc, 'mods', ns.decorPolicy.NS_RE),
      notMods: list(doc, 'notMods', ns.decorPolicy.NS_RE)
    }
    disjoint(data.forceDecor, data.forceNotDecor, 'forceDecor', 'forceNotDecor')
    disjoint(data.mods, data.notMods, 'mods', 'notMods')
    return data
  }

  function serialize(data) {
    var doc = { schema: SCHEMA }
    for (var i = 0; i < LISTS.length; i++) doc[LISTS[i]] = Object.keys(data[LISTS[i]]).sort()
    return JSON.stringify(doc, null, 2) + '\n'
  }

  // true / false when a local mark decides, null when the shipped rules do.
  function lookup(data, id) {
    if (data.forceNotDecor[id] === true) return false
    if (data.forceDecor[id] === true) return true
    var space = ns.ids.namespaceOf(id)
    if (data.notMods[space] === true) return false
    if (data.mods[space] === true) return true
    return null
  }

  function stateIn(yes, no, key) {
    if (yes[key] === true) return DECOR
    if (no[key] === true) return NOT_DECOR
    return AUTO
  }

  function itemState(data, id) { return stateIn(data.forceDecor, data.forceNotDecor, id) }
  function modState(data, space) { return stateIn(data.mods, data.notMods, space) }

  function next(state) { return state === AUTO ? DECOR : state === DECOR ? NOT_DECOR : AUTO }

  function setIn(yes, no, key, state) {
    delete yes[key]
    delete no[key]
    if (state === DECOR) yes[key] = true
    if (state === NOT_DECOR) no[key] = true
  }

  // Cycles one mark in place and returns the new state.
  function cycleItem(data, id) {
    var state = next(itemState(data, id))
    setIn(data.forceDecor, data.forceNotDecor, id, state)
    return state
  }

  function cycleMod(data, space) {
    var state = next(modState(data, space))
    setIn(data.mods, data.notMods, space, state)
    return state
  }

  // ---- persistence (io: { read(path) -> text or null/'null' when absent, write(path, text) }) ----

  // { data, status: 'ok' | 'missing' | 'malformed', error }. A malformed file is ignored: data is
  // empty, so the shipped rules still apply, and marking is refused (see mark) so the owner's file
  // is never overwritten.
  function load(io) {
    var text
    try {
      text = io.read(PATH)
    } catch (err) {
      return { data: empty(), status: 'malformed', error: err }
    }
    if (text === null || text === undefined || String(text).trim() === '' || String(text).trim() === 'null') {
      return { data: empty(), status: 'missing', error: null }
    }
    try {
      return { data: parse(text), status: 'ok', error: null }
    } catch (err2) {
      return { data: empty(), status: 'malformed', error: err2 }
    }
  }

  // Cycles the mark of `id` (or of its whole mod) and saves it. Nothing in `holder` ({ data, status })
  // changes unless the save worked. Returns { ok, scope: 'item'|'mod', key, state } or
  // { ok: false, reason: 'malformed' | 'save', error }.
  function mark(holder, io, id, wholeMod) {
    if (holder.status === 'malformed') return { ok: false, reason: 'malformed', error: holder.error }
    var draft = clone(holder.data)
    var key = wholeMod ? ns.ids.namespaceOf(id) : id
    var state = wholeMod ? cycleMod(draft, key) : cycleItem(draft, id)
    try {
      io.write(PATH, serialize(draft))
    } catch (err) {
      return { ok: false, reason: 'save', error: err }
    }
    holder.data = draft
    holder.status = 'ok'
    return { ok: true, scope: wholeMod ? 'mod' : 'item', key: key, state: state }
  }

  // The real IO: KubeJS's JsonIO, which resolves paths against the game directory only.
  // readString returns "null" for a missing file (JsonIO.readJson gives null for no file).
  function kubeIo() {
    return {
      read: function (path) { return JsonIO.readString(path) },
      write: function (path, text) { JsonIO.write(path, JsonIO.parseRaw(text)) }
    }
  }

  ns.decorLocal = {
    PATH: PATH, AUTO: AUTO, DECOR: DECOR, NOT_DECOR: NOT_DECOR,
    empty: empty, parse: parse, serialize: serialize, lookup: lookup,
    itemState: itemState, modState: modState, cycleItem: cycleItem, cycleMod: cycleMod,
    load: load, mark: mark, kubeIo: kubeIo
  }
})(global.emiCuration || (global.emiCuration = {}))
