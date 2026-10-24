// priority: 70
// Reversible recipe-display filtering for EMI (pinned to EMI 1.1.24+1.20.1+forge).
//
// EMI reads recipes through EmiRecipes.manager (an EmiRecipeManager). CLEAN installs a
// JavaScript implementation of that interface (Rhino turns the object into a Java
// proxy) that delegates to the completed baseline manager and filters every recipe
// list it returns with the REI display rule from ns.policy.isDisplayHidden. Recipe,
// category and workstation objects are the baseline's own; the baseline is never
// modified. ALL reinstalls the baseline manager object itself.

(function (ns) {
  var RECIPES = 'dev.emi.emi.registry.EmiRecipes'

  function freshState() {
    return { baseline: null, wrapper: null, wrapperLoad: null, installed: null, known: null }
  }

  // Survives script reloads so wrappers already proxied into Java can still be unwrapped.
  // Adopt the old session-owned holder on the first reload after this extraction.
  var st = ns.recipeState || (ns.recipeState = ns.state && ns.state.recipe ? ns.state.recipe : freshState())
  if (ns.state) delete ns.state.recipe
  var loadToken = {}

  function knownWrappers() {
    if (st.known == null) st.known = ns.interop.newIdentityMap()
    return st.known
  }

  function unwrap(manager) {
    var known = knownWrappers()
    return known.containsKey(manager) ? known.get(manager) : manager
  }

  // Return the installed Java proxy when reusable, otherwise a fresh JS interface.
  // apply() records the actual Java reference only after assignment has succeeded.
  function viewFor(baseline) {
    baseline = unwrap(baseline)
    if (st.wrapper != null && st.wrapperLoad === loadToken && ns.interop.sameRef(baseline, st.baseline)) return st.wrapper
    return createWrapper(baseline, ns.hiding.isDisplayHidden)
  }

  function apply(filtered) {
    if (filtered) {
      var ref = install(viewFor(st.baseline))
      knownWrappers().put(ref, st.baseline)
      st.wrapper = ref
      st.wrapperLoad = loadToken
      st.installed = ref
    } else {
      st.installed = install(st.baseline)
    }
  }

  // A new EMI manager is a new baseline; never adopt one of our own wrappers.
  function sync() {
    var cur = current()
    if (ns.interop.sameRef(cur, st.installed)) return false
    st.baseline = unwrap(cur)
    invalidate()
    knownWrappers().clear()
    return true
  }

  function invalidate() { st.wrapper = null }
  function installed() { return st.installed }

  function restore(ref) {
    if (ref != null) { install(ref); st.installed = ref }
  }

  // Restore only while ours is still installed; never overwrite a new EMI generation.
  function release() {
    if (st.installed != null && st.baseline != null && ns.interop.sameRef(current(), st.installed)) install(st.baseline)
  }

  function reset() { ns.recipeState = st = freshState() }

  function recipes() { return ns.interop.cls(RECIPES) }

  function current() { return recipes().manager }

  // EMI bakes a sorted manager on a worker thread after reload; wait for it.
  function isBusy() { return recipes().activeWorker != null }

  // Installs a manager (EMI's own or our wrapper object) and returns the Java object
  // EMI now holds (Rhino proxies a JS wrapper).
  function install(manager) {
    recipes().manager = manager
    return recipes().manager
  }

  // REI rule over a recipe's inputs and outputs (never its catalysts).
  function isRecipeHidden(recipe, isStackHidden) {
    var copy = ns.interop.copy
    return ns.policy.isDisplayHidden(
      [copy(recipe.getInputs()), copy(recipe.getOutputs())],
      function (ingredient) { return copy(ingredient.getEmiStacks()) },
      function (ingredient) { return ingredient.isEmpty() },
      isStackHidden)
  }

  // Builds the CLEAN manager object around `baseline`. Results are memoised per
  // baseline list (identity) and per recipe, so repeated lookups stay cheap.
  function createWrapper(baseline, isStackHidden) {
    var I = ns.interop
    // Synchronized: EMI may consult the manager off the render thread.
    var Collections = I.cls('java.util.Collections')
    var checked = Collections.synchronizedMap(I.newIdentityMap())
    var hidden = Collections.synchronizedMap(I.newIdentityMap())
    var lists = Collections.synchronizedMap(I.newIdentityMap())

    function recipeHidden(recipe) {
      if (recipe == null) return false
      if (!checked.containsKey(recipe)) {
        var h = false
        try {
          h = isRecipeHidden(recipe, isStackHidden)
        } catch (err) {
          ns.diag.logError('recipe filter', err)
        }
        checked.put(recipe, true)
        if (h) hidden.put(recipe, true)
      }
      return hidden.containsKey(recipe)
    }

    function filtered(list) {
      if (list == null) return list
      var cached = lists.get(list)
      if (cached != null) return cached
      var view = I.filterToList(list, function (r) { return !recipeHidden(r) })
      lists.put(list, view)
      return view
    }

    // Interface methods. getRecipes is overloaded (no-arg and by category); Rhino
    // dispatches both to the same function.
    return {
      getCategories: function () { return baseline.getCategories() },
      getWorkstations: function (category) { return baseline.getWorkstations(category) },
      getRecipes: function (category) {
        if (category === undefined) return filtered(baseline.getRecipes())
        return filtered(baseline.getRecipes(category))
      },
      getRecipe: function (id) {
        var r = baseline.getRecipe(id)
        return recipeHidden(r) ? null : r
      },
      getRecipesByInput: function (stack) { return filtered(baseline.getRecipesByInput(stack)) },
      getRecipesByOutput: function (stack) { return filtered(baseline.getRecipesByOutput(stack)) }
    }
  }

  ns.recipeView = {
    viewFor: viewFor, unwrap: unwrap, apply: apply, sync: sync, invalidate: invalidate,
    installed: installed, restore: restore, release: release, reset: reset,
    current: current,
    isBusy: isBusy,
    install: install,
    isRecipeHidden: isRecipeHidden,
    createWrapper: createWrapper
  }
})(global.emiCuration || (global.emiCuration = {}))
