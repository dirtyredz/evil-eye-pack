// priority: 43
// "Mark as decor" key: hover an item, press the "EMI Curation" key (default D) and its local
// override cycles automatic -> decor -> not decor -> automatic; Shift+key does the same for the
// item's whole mod. The marks are saved by decor_local.js (config/emi-curation/decor-local.json)
// and the index is rebuilt at once through session.refreshDecor().
//
// The KeyMapping itself is created by startup_scripts/emi_curation_keys.js (Forge only accepts
// key mappings during startup) and handed over as global.emiCurationDecorKey. Without it this
// script does nothing and logs the gap once.
//
// The key is read from Forge's ScreenEvent.KeyPressed.Pre on every screen and is consumed only
// when something is hovered and no text field has focus, so typing "d" in a search box and
// pressing D over empty space behave as before.

(function (ns) {
  var SHIFT = 1
  var OTHER_MODIFIERS = 2 | 4 | 8 // ctrl, alt, super
  var TOAST_TITLE = 'EMI Curation'
  var missingKeyLogged = false

  // GUI-scaled mouse position (Screen events for key presses carry none).
  function mouse() {
    var mc = ns.interop.cls('net.minecraft.client.Minecraft').getInstance()
    var win = mc.getWindow()
    return {
      x: Math.floor(mc.mouseHandler.xpos() * win.getGuiScaledWidth() / win.getScreenWidth()),
      y: Math.floor(mc.mouseHandler.ypos() * win.getGuiScaledHeight() / win.getScreenHeight())
    }
  }

  // True while a text field (EMI's search, an anvil name box, ...) has the keyboard.
  function typing(screen) {
    var EditBox = ns.interop.cls('net.minecraft.client.gui.components.EditBox')
    var focused = screen.getFocused()
    if (focused != null && focused instanceof EditBox && focused.isFocused()) return true
    var search = ns.interop.cls('dev.emi.emi.screen.EmiScreenManager').search
    return search != null && search.isFocused()
  }

  // { id, name } for the one item EMI shows under the mouse (index, favorites, recipe screens,
  // inventory slots through EMI's stack providers), { problem } when it is not a single item.
  function emiTarget(x, y) {
    var hit = ns.interop.cls('dev.emi.emi.screen.EmiScreenManager').getHoveredStack(x, y, false)
    if (hit == null || hit.isEmpty()) return null
    var stacks = ns.interop.copy(hit.getStack().getEmiStacks())
    var C = ns.collections
    if (C.len(stacks) === 0) return null
    if (C.len(stacks) > 1) return { problem: 'hover a single item, not a tag' }
    var stack = C.at(stacks, 0)
    var desc = ns.interop.describe(stack)
    if (!desc.isItem) return { problem: 'only items can be marked' }
    return { id: desc.id, name: String(stack.getName().getString()) }
  }

  // The vanilla slot under the mouse, for screens EMI has no stack provider for.
  function slotTarget(screen) {
    var slot = screen.getSlotUnderMouse()
    if (slot == null || !slot.hasItem()) return null
    var stack = slot.getItem()
    var key = ns.interop.cls('net.minecraft.core.registries.BuiltInRegistries').ITEM.getKey(stack.getItem())
    return { id: String(key), name: String(stack.getHoverName().getString()) }
  }

  function target(screen) {
    var m = mouse()
    var found = emiTarget(m.x, m.y)
    if (found == null && ns.interop.isContainerScreen(screen)) found = slotTarget(screen)
    return found
  }

  // A toast (visible over every screen); the action bar if toasts misbehave.
  function notify(text) {
    var I = ns.interop
    var mc = I.cls('net.minecraft.client.Minecraft').getInstance()
    try {
      var Toast = I.cls('net.minecraft.client.gui.components.toasts.SystemToast')
      var Ids = I.cls('net.minecraft.client.gui.components.toasts.SystemToast$SystemToastIds')
      Toast.addOrUpdate(mc.getToasts(), Ids.PERIODIC_NOTIFICATION, I.literal(TOAST_TITLE), I.literal(text))
    } catch (err) {
      ns.diag.logError('decor mark toast', err)
      mc.player.displayClientMessage(I.literal(TOAST_TITLE + ': ' + text), true)
    }
  }

  function describeResult(result, found) {
    if (!result.ok) {
      if (result.reason === 'malformed') return 'decor-local.json is malformed: marks are not saved (see client.log)'
      return 'Could not save decor-local.json (see client.log)'
    }
    if (result.scope === 'mod') return 'All of ' + result.key + ': ' + result.state
    return found.name + ': ' + result.state
  }

  // Marks the hovered item; returns true when the key was consumed.
  function press(screen, wholeMod) {
    var found = target(screen)
    if (found == null) return false
    if (found.problem) {
      notify(found.problem)
      return true
    }
    var holder = ns.session.localMarks()
    var result = ns.decorLocal.mark(holder, ns.decorLocal.kubeIo(), found.id, wholeMod)
    if (!result.ok) ns.diag.logError('decor mark', result.error)
    else ns.session.refreshDecor()
    notify(describeResult(result, found))
    return true
  }

  function onKeyPressed(e) {
    var key = global.emiCurationDecorKey
    if (key == null) {
      if (!missingKeyLogged) {
        missingKeyLogged = true
        ns.diag.info('the "mark as decor" key mapping is missing (startup_scripts/emi_curation_keys.js did not run; restart the game)')
      }
      return
    }
    if (key.isUnbound() || !key.matches(e.getKeyCode(), e.getScanCode())) return
    var modifiers = e.getModifiers()
    if ((modifiers & OTHER_MODIFIERS) !== 0) return
    var screen = e.getScreen()
    if (typing(screen)) return
    if (press(screen, (modifiers & SHIFT) !== 0)) e.setCanceled(true)
  }

  ns.decorMarkHandlers = {
    keyPressed: function (e) { ns.diag.guard('decor mark key', function () { onKeyPressed(e) }) }
  }

  ns.forgeHooks.registerOnce('emiCurationDecorMarkListeners', 'decorMarkHandlers', [
    { event: 'net.minecraftforge.client.event.ScreenEvent$KeyPressed$Pre', handler: 'keyPressed', label: 'decor mark' }
  ])
})(global.emiCuration || (global.emiCuration = {}))
