// Release 1 only. Delete this script with ato_retirement.js when removing the two mods.
// Swaps an old AllTheOres item for its survivor (same count) the moment it lands in a
// player's inventory: pickup, chest shift-click, or placing the cursor stack into a slot.
// The map is kubejs/config/ato_retirement.json, the same manifest the crafting recipes read.
// AllTheCompressed blocks are not in the map, so they keep their 9:1 unpacking.
// PlayerEvents handlers are replaced on /reload; a thrown error is logged, never rethrown.
;(function () {
  var migration = JsonIO.read('kubejs/config/ato_retirement.json')
  if (migration == null) throw new Error('[ATO retirement] Missing conversion manifest')
  var map = {}
  Object.keys(migration.conversions).forEach(function (source) {
    map[source] = String(migration.conversions[source])
  })
  var swapping = false

  function targetFor(stack) {
    if (stack == null || stack.empty) return null
    var id = String(stack.id)
    return Object.prototype.hasOwnProperty.call(map, id) ? map[id] : null
  }

  // Returns the stack that replaces `stack`; any count above the survivor's max stack goes to the player.
  function replacement(player, stack, target) {
    var left = Number(stack.count)
    var first = Item.of(target, left)
    var max = Number(first.maxStackSize)
    if (left > max) first.count = max
    left -= Number(first.count)
    while (left > 0) {
      var extra = Item.of(target, Math.min(left, max))
      left -= Number(extra.count)
      player.give(extra)
    }
    return first
  }

  function swapInventory(player) {
    var inventory = player.inventory
    var size = Number(inventory.containerSize)
    var swaps = 0
    for (var i = 0; i < size; i++) {
      var stack = inventory.getItem(i)
      var target = targetFor(stack)
      if (target != null) {
        inventory.setItem(i, replacement(player, stack, target))
        swaps++
      }
    }
    var menu = player.containerMenu
    if (menu != null) {
      var carried = menu.getCarried()
      var carriedTarget = targetFor(carried)
      if (carriedTarget != null) {
        menu.setCarried(replacement(player, carried, carriedTarget))
        swaps++
      }
    }
    return swaps
  }

  function onInventoryChanged(event) {
    if (swapping) return
    try {
      if (targetFor(event.item) == null) return
      swapping = true
      var swaps = swapInventory(event.player)
      if (swaps > 0) console.info('[ATO retirement] Swapped ' + swaps + ' stack(s) for ' + event.player.username)
    } catch (e) {
      console.error('[ATO retirement] Swap failed: ' + e)
    } finally {
      swapping = false
    }
  }

  PlayerEvents.inventoryChanged(onInventoryChanged)
  console.info('[ATO retirement] Auto-swap active for ' + Object.keys(map).length + ' items')
})()
