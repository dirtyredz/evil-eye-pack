// priority: -12
// Pack-test probe (test server only). A server-side stand-in player crafts each curated fixture through a
// real CraftingMenu: fill the grid, wait for the result (FastWorkbench computes it on a later tick), take it
// with a normal result-slot click, then record the recipe used, the stack taken and what is left in the grid.
// Each fixture gets a fresh menu and an emptied inventory.
;(function () {
  var ns = (global.packTest = global.packTest || {})
  var SETTLE_TICKS = 2
  var MAX_WAIT_TICKS = 60

  function stackInfo(s) {
    if (!s || s.isEmpty()) return null
    var nbt = s.getNbt()
    return { id: String(s.getId()), count: s.getCount(), nbt: nbt ? String(nbt) : undefined }
  }

  // fixtures: [{ name, recipe, grid: [9 ids, '' for an empty slot] }] (no nulls: KubeJS's JSON lists cannot
  // hold them). done(results) runs on the server thread.
  function run(server, fixtures, done) {
    var FPF = Java.loadClass('net.minecraftforge.common.util.FakePlayerFactory')
    var CM = Java.loadClass('net.minecraft.world.inventory.CraftingMenu')
    var CLA = Java.loadClass('net.minecraft.world.inventory.ContainerLevelAccess')
    var BP = Java.loadClass('net.minecraft.core.BlockPos')
    var ClickType = Java.loadClass('net.minecraft.world.inventory.ClickType')
    var level = server.overworld()
    var player = FPF.getMinecraft(level)
    var results = []

    function step(i) {
      if (i >= fixtures.length) { done(results); return }
      var fx = fixtures[i]
      var menu = null
      try {
        player.getInventory().clearContent()
        menu = new CM(9100 + i, player.getInventory(), CLA.create(level, BP.ZERO))
        player.containerMenu = menu
        for (var s = 0; s < 9; s++) if (fx.grid[s]) menu.getSlot(1 + s).set(Item.of(fx.grid[s]))
      } catch (e) {
        results.push({ name: fx.name, ok: false, error: 'setup: ' + String(e).slice(0, 200) })
        player.containerMenu = player.inventoryMenu
        step(i + 1)
        return
      }
      // FastWorkbench fills the result slot on a later tick; poll until it appears or the wait runs out.
      var waited = 0
      function settled() {
        if (menu.getSlot(0).getItem().isEmpty() && waited < MAX_WAIT_TICKS) {
          waited += SETTLE_TICKS
          server.scheduleInTicks(SETTLE_TICKS, settled)
          return
        }
        take()
      }
      server.scheduleInTicks(SETTLE_TICKS, function () { waited += SETTLE_TICKS; settled() })
      function take() {
        var r = { name: fx.name, ok: true, waitedTicks: waited }
        try {
          var used = menu.getSlot(0).container.getRecipeUsed()
          r.recipe = used ? String(used.getId()) : null
          r.offered = stackInfo(menu.getSlot(0).getItem())
          menu.clicked(0, 0, ClickType.PICKUP, player)
          r.result = stackInfo(menu.getCarried())
          r.grid = []
          for (var g = 0; g < 9; g++) {
            var left = stackInfo(menu.getSlot(1 + g).getItem())
            if (left) { left.slot = g; r.grid.push(left) }
          }
        } catch (e) {
          r.ok = false
          r.error = String(e).slice(0, 200)
        }
        try {
          menu.setCarried(Item.of('minecraft:air'))
          for (var c = 0; c < 9; c++) menu.getSlot(1 + c).set(Item.of('minecraft:air'))
          player.getInventory().clearContent()
        } catch (e) { r.cleanupError = String(e).slice(0, 200) }
        player.containerMenu = player.inventoryMenu
        results.push(r)
        step(i + 1)
      }
    }
    step(0)
  }

  ns.crafting = { run: run }
})()
