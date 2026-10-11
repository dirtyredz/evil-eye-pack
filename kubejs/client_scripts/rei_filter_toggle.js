// REI filter toggle: adds an "REI: CLEAN / REI: ALL" button to container screens.
// Switches REI's config-based hidden-item filtering off/on IN MEMORY ONLY (never saved).
// State lives in `global` so /kubejs reload and F3+T don't desync it.

const ReiConfigManager = Java.loadClass('me.shedaniel.rei.api.client.config.ConfigManager')
const ReiEntryRegistry = Java.loadClass('me.shedaniel.rei.api.client.registry.entry.EntryRegistry')
const ReiRuntime = Java.loadClass('me.shedaniel.rei.api.client.REIRuntime')
const ReiSearchRule = Java.loadClass('me.shedaniel.rei.impl.client.entry.filtering.rules.SearchFilteringRule')
const ReiButton = Java.loadClass('net.minecraft.client.gui.components.Button')
const ReiComponent = Java.loadClass('net.minecraft.network.chat.Component')
const ReiContainerScreen = Java.loadClass('net.minecraft.client.gui.screens.inventory.AbstractContainerScreen')

if (global.reiFilterOff === undefined) global.reiFilterOff = false
if (global.reiStash === undefined) global.reiStash = null

function reiFiltering() {
  return ReiConfigManager.getInstance().getConfig().advanced.filtering
}

function reiRefresh() {
  ReiEntryRegistry.getInstance().refilter()
  ReiRuntime.getInstance().getOverlay().ifPresent(o => o.queueReloadOverlay())
}

// Filtering OFF: stash + clear hidden stacks, pull out only the search rules
// (never empty filteringRules: REI re-adds missing rules and saves the config).
function reiDisableFilters() {
  if (global.reiFilterOff) return
  let f = reiFiltering()
  let rules = []
  for (let r of Array.from(f.filteringRules)) {
    if (r instanceof ReiSearchRule) rules.push(r)
  }
  global.reiStash = {
    stacks: Array.from(f.filteredStacks),
    rules: rules,
    displays: f.shouldFilterDisplays
  }
  f.filteredStacks.clear()
  for (let r of rules) f.filteringRules.remove(r)
  f.shouldFilterDisplays = false
  global.reiFilterOff = true
  reiRefresh()
}

// Filtering ON: put back exactly what was stashed.
function reiRestoreFilters() {
  if (!global.reiFilterOff) return
  let f = reiFiltering()
  let s = global.reiStash
  if (s) {
    f.filteredStacks.clear()
    f.filteredStacks.addAll(s.stacks)
    for (let r of s.rules) f.filteringRules.add(r)
    f.shouldFilterDisplays = s.displays
  }
  global.reiStash = null
  global.reiFilterOff = false
  reiRefresh()
}

// Log a failure with the Java stack trace when there is one. Nothing we do may throw
// into Forge's event bus: an exception there crashes the whole client.
function reiLogError(where, err) {
  try {
    console.error('REI toggle (' + where + '): ' + err)
    let je = err.javaException || err.rhinoException
    if (je) {
      let sw = new (Java.loadClass('java.io.StringWriter'))()
      je.printStackTrace(new (Java.loadClass('java.io.PrintWriter'))(sw))
      console.error(String(sw.toString()))
    }
  } catch (ignored) {}
}

// Screen hook. ForgeEvents is startup-only, so register on the Forge bus directly.
// Forge listeners survive /kubejs reload: register once, and have the listener call
// a function kept in global so reloaded code is still picked up.
global.reiOnScreenInit = e => {
  try {
    if (!(e.getScreen() instanceof ReiContainerScreen)) return
    let label = global.reiFilterOff ? 'REI: ALL' : 'REI: CLEAN'
    let b = ReiButton.builder(ReiComponent.literal(label), btn => {
      try {
        if (global.reiFilterOff) reiRestoreFilters(); else reiDisableFilters()
        btn.setMessage(ReiComponent.literal(global.reiFilterOff ? 'REI: ALL' : 'REI: CLEAN'))
      } catch (err) { reiLogError('press', err) }
    }).bounds(2, 2, 70, 14).build()
    e.addListener(b)
  } catch (err) { reiLogError('screen init', err) }
}

if (!global.reiListenerRegistered) {
  global.reiListenerRegistered = true
  Java.loadClass('net.minecraftforge.common.MinecraftForge').EVENT_BUS.addListener(
    Java.loadClass('net.minecraftforge.eventbus.api.EventPriority').NORMAL, false,
    Java.loadClass('net.minecraftforge.client.event.ScreenEvent$Init$Post'),
    e => {
      try { global.reiOnScreenInit(e) } catch (err) { console.error('REI toggle (listener): ' + err) }
    })
}

// Restore on logout so a stray REI config save can't persist the emptied state.
ClientEvents.loggedOut(() => {
  try { reiRestoreFilters() } catch (err) { reiLogError('logout', err) }
})
