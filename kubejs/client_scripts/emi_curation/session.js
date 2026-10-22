// priority: 60
// CLEAN/ALL session lifecycle for the EMI curation views; DECOR state itself lives in decor/decor_state.js.
//
// - State lives in global.emiCuration.state so /kubejs reload keeps the selection.
// - A fresh launch and every logout reset to CLEAN (and, through decorState, to the default DECOR mode).
// - DECOR is an independent second axis: decor stacks are removed from the index in CLEAN and in
//   ALL alike, and never from recipe displays.
// - Views are installed only once EMI's reload and recipe worker have finished, and are
//   re-applied whenever EMI replaces its index list or recipe manager (new generation).
// - A /kubejs reload re-applies the views with the reloaded code and curation files.
// - Toggling swaps in-memory references only: no EMI reload, no config or persistent
//   data write, and nothing is added to EMI's user-hidden stacks.

(function (ns) {
  var CLEAN = 'CLEAN'
  var ALL = 'ALL'

  function freshState() {
    return {
      mode: CLEAN,
      status: 'waiting',
      error: null,
      reapply: true,
      failed: { index: null, recipe: null },
      index: { master: null, baseline: null, views: {}, installed: null },
      recipe: { baseline: null, wrapper: null, wrapperLoad: null, installed: null, known: null }
    }
  }

  var st = ns.state || (ns.state = freshState())
  var loadToken = {}
  ns.loadToken = loadToken
  // A script reload must rebuild views with the reloaded policy and code, and retry a
  // curation file that failed to load.
  st.reapply = true
  if (st.status === 'unavailable') st.status = 'waiting'

  var policy = null
  var policyError = null

  function loadPolicy() {
    if (policy || policyError) return policy
    try {
      policy = ns.policy.load(function (p) { return JsonIO.readString(p) })
      ns.decorState.load(function (p) { return JsonIO.readString(p) })
      ns.hiding.configure({ policy: policy, getMaster: function () { return st.index.master } })
      ns.diag.info('loaded curation (' + policy.itemIdCount + ' explicit ids' + (ns.decorState.available() ? ', decor rules' : ', no decor rules') + ')')
    } catch (err) {
      policyError = err
      ns.diag.logError('load curation', err)
    }
    return policy
  }

  function emiReady() {
    var EmiReloadManager = ns.interop.cls('dev.emi.emi.runtime.EmiReloadManager')
    if (!EmiReloadManager.isLoaded()) return false
    if (ns.recipeView.isBusy()) return false
    var Minecraft = ns.interop.cls('net.minecraft.client.Minecraft')
    return Minecraft.getInstance().player != null
  }

  // ---- index ----

  // The index to install for the current CLEAN/ALL x DECOR combination; built views are
  // kept per combination until EMI replaces its list.
  function applyIndex() {
    var clean = st.mode === CLEAN
    var decor = ns.decorState.indexHidden()
    var target = st.index.baseline
    if (clean || decor) {
      var key = (clean ? 'c' : '') + (decor ? 'd' : '')
      if (st.index.views[key] == null) {
        st.index.views[key] = ns.indexView.buildClean(st.index.baseline, function (stack) {
          return (clean && ns.hiding.isPolicyHidden(stack)) || (decor && ns.decorState.isHidden(stack))
        })
      }
      target = st.index.views[key]
    }
    ns.indexView.install(target)
    st.index.installed = target
  }

  // Returns true when EMI replaced its list since we last installed ours.
  function syncIndex() {
    var cur = ns.indexView.currentFiltered()
    if (ns.interop.sameRef(cur, st.index.installed)) return false
    var master = ns.indexView.currentMaster()
    if (!ns.interop.sameRef(master, st.index.master)) {
      st.index.master = master
    }
    st.index.baseline = cur
    st.index.views = {}
    ns.decorState.invalidate()
    return true
  }

  // ---- recipes ----

  function knownWrappers() {
    if (st.recipe.known == null) st.recipe.known = ns.interop.newIdentityMap()
    return st.recipe.known
  }

  function applyRecipes() {
    if (st.mode === CLEAN && policy.displayFiltering) {
      if (st.recipe.wrapper == null || st.recipe.wrapperLoad !== loadToken) {
        var ref = ns.recipeView.install(ns.recipeView.createWrapper(st.recipe.baseline, ns.hiding.isDisplayHidden))
        knownWrappers().put(ref, st.recipe.baseline)
        st.recipe.wrapper = ref
        st.recipe.wrapperLoad = loadToken
      } else {
        ns.recipeView.install(st.recipe.wrapper)
      }
      st.recipe.installed = st.recipe.wrapper
    } else {
      st.recipe.installed = ns.recipeView.install(st.recipe.baseline)
    }
  }

  function syncRecipes() {
    var cur = ns.recipeView.current()
    if (ns.interop.sameRef(cur, st.recipe.installed)) return false
    // Never wrap one of our own wrappers: map it back to the manager it wraps.
    var known = knownWrappers()
    st.recipe.baseline = known.containsKey(cur) ? known.get(cur) : cur
    st.recipe.wrapper = null
    known.clear()
    return true
  }

  // ---- lifecycle ----

  function applyAll(indexChanged) {
    var prevIndex = st.index.installed
    var prevRecipe = st.recipe.installed
    try {
      applyIndex()
      // Display filtering depends on the index (user hides, key set): rebuild it too.
      if (indexChanged) st.recipe.wrapper = null
      applyRecipes()
      ns.indexView.refresh()
      st.status = 'ready'
      st.error = null
    } catch (err) {
      restore(prevIndex, prevRecipe)
      throw err
    }
  }

  // Puts back the last complete view after a failure.
  function restore(indexRef, recipeRef) {
    try { if (indexRef != null) { ns.indexView.install(indexRef); st.index.installed = indexRef } } catch (e1) { ns.diag.logError('restore index', e1) }
    try { if (recipeRef != null) { ns.recipeView.install(recipeRef); st.recipe.installed = recipeRef } } catch (e2) { ns.diag.logError('restore recipes', e2) }
    try { ns.indexView.refresh() } catch (e3) { ns.diag.logError('restore refresh', e3) }
  }

  function fail(where, err) {
    st.status = 'error'
    st.error = String(err)
    ns.diag.logError(where, err)
  }

  // The lists EMI held when the last apply failed (after restore).
  function rememberFailure() {
    try {
      st.failed.index = ns.indexView.currentFiltered()
      st.failed.recipe = ns.recipeView.current()
    } catch (err) {
      ns.diag.logError('remember failure', err)
    }
  }

  function unchangedSinceFailure() {
    var f = st.failed
    if (f.index == null || f.recipe == null) return false
    return ns.interop.sameRef(ns.indexView.currentFiltered(), f.index) &&
           ns.interop.sameRef(ns.recipeView.current(), f.recipe)
  }

  function tick() {
    if (!loadPolicy()) { st.status = 'unavailable'; return }
    if (!emiReady()) {
      if (st.status === 'ready') st.status = 'waiting'
      return
    }
    // A failed apply is not retried every tick: wait until EMI replaces its lists or
    // the owner presses the button (which sets reapply).
    if (st.status === 'error' && !st.reapply && unchangedSinceFailure()) return
    try {
      var indexChanged = syncIndex()
      var recipeChanged = syncRecipes()
      var retry = st.reapply
      // After a failure, stay in the error state until the owner retries or EMI
      // starts a new generation.
      if (st.status === 'error' && !indexChanged && !recipeChanged && !retry) return
      if (indexChanged || recipeChanged || retry || st.status !== 'ready') {
        if (retry) { st.index.views = {}; ns.decorState.invalidate(); st.recipe.wrapper = null }
        st.reapply = false
        applyAll(indexChanged)
      }
    } catch (err) {
      st.reapply = false
      fail('apply views', err)
      rememberFailure()
    }
  }

  // Button press. Returns true when the mode changed.
  function toggle() {
    if (st.status === 'error') {
      st.reapply = true
      st.status = 'waiting'
      return false
    }
    if (st.status !== 'ready') return false
    var prevMode = st.mode
    st.mode = prevMode === CLEAN ? ALL : CLEAN
    try {
      applyAll(false)
      return true
    } catch (err) {
      st.mode = prevMode
      fail('toggle', err)
      return false
    }
  }

  // DECOR button press. Returns true when the mode changed.
  function toggleDecor() {
    if (!canPressDecor()) return false
    var prev = ns.decorState.flip()
    try {
      applyAll(false)
      return true
    } catch (err) {
      ns.decorState.setOverride(prev)
      fail('toggle decor', err)
      return false
    }
  }

  // Re-applies the index after the local DECOR marks changed (decorState.mark already dropped
  // its caches), with the current CLEAN/ALL and DECOR state. Returns true when it is installed.
  function refreshDecor() {
    if (st.status !== 'ready') return false
    st.index.views = {}
    try {
      applyAll(false)
      return true
    } catch (err) {
      fail('refresh decor', err)
      return false
    }
  }

  // Logout: put EMI's own objects back (only if ours are still installed, so objects
  // from a previous world are never restored over new ones) and reset to CLEAN.
  function logout() {
    try {
      if (st.index.installed != null && st.index.baseline != null &&
          ns.interop.sameRef(ns.indexView.currentFiltered(), st.index.installed)) {
        ns.indexView.install(st.index.baseline)
      }
      if (st.recipe.installed != null && st.recipe.baseline != null &&
          ns.interop.sameRef(ns.recipeView.current(), st.recipe.installed)) {
        ns.recipeView.install(st.recipe.baseline)
      }
    } catch (err) {
      ns.diag.logError('logout restore', err)
    }
    ns.state = st = freshState()
    ns.decorState.resetMode()
  }

  function label() {
    if (st.status === 'unavailable') return 'EMI: N/A'
    if (st.status === 'error') return 'EMI: ERROR'
    if (st.status !== 'ready') return 'EMI: ...'
    return 'EMI: ' + st.mode
  }

  function canPress() { return st.status === 'ready' || st.status === 'error' }

  // Pressable when the index is ready and decor.json loaded.
  function canPressDecor() { return st.status === 'ready' && ns.decorState.available() }

  ns.session = {
    tick: tick, toggle: toggle, toggleDecor: toggleDecor, logout: logout, label: label,
    canPress: canPress, canPressDecor: canPressDecor, refreshDecor: refreshDecor, CLEAN: CLEAN, ALL: ALL
  }

  // KubeJS replaces these handlers on every script reload, so they never duplicate.
  ClientEvents.tick(function () { ns.diag.guard('tick', function () { ns.session.tick() }) })
  ClientEvents.loggedOut(function () { ns.diag.guard('logout', function () { ns.session.logout() }) })
})(global.emiCuration || (global.emiCuration = {}))
