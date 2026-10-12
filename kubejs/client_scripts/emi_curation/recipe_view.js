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
      var out = I.newList()
      var src = I.copy(list)
      for (var i = 0; i < ns.collections.len(src); i++) {
        var r = ns.collections.at(src, i)
        if (!recipeHidden(r)) out.add(r)
      }
      var view = I.freeze(out)
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
    current: current,
    isBusy: isBusy,
    install: install,
    isRecipeHidden: isRecipeHidden,
    createWrapper: createWrapper
  }
})(global.emiCuration || (global.emiCuration = {}))
