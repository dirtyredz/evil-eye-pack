// priority: -100
// Pack-test probe bootstrap (injected into the throwaway test server only; never shipped to players).
// Reads pack_test/in/run.json, then once the server has started runs each section on the server thread,
// writing pack_test/out/<section>.json and, last of all, pack_test/out/manifest.json with the run token.
// A section that throws is recorded as failed in the manifest; nothing is rethrown into the server.
;(function () {
  var ns = (global.packTest = global.packTest || {})
  var OUT = 'pack_test/out/'
  var SCHEMA = 1
  var CRAFT_DEADLINE_TICKS = 1200
  var input = null
  try { input = JsonIO.read('pack_test/in/run.json') } catch (e) { console.error('[pack_test] cannot read run.json: ' + e) }
  if (!input) return

  function now() { return Date.now() }

  function write(name, result, manifest, t0) {
    JsonIO.write(OUT + name + '.json', { schema: SCHEMA, token: input.token, section: name, count: result.count, data: result.data })
    manifest.sections.push({ name: name, file: name + '.json', count: result.count, ok: true, ms: now() - t0 })
    console.info('[pack_test] section ' + name + ': ' + result.count + ' in ' + (now() - t0) + ' ms')
  }

  function section(name, fn, manifest) {
    var t0 = now()
    try { write(name, fn(), manifest, t0) } catch (e) {
      manifest.sections.push({ name: name, ok: false, error: String(e).slice(0, 500), ms: now() - t0 })
      console.error('[pack_test] section ' + name + ' failed: ' + e)
    }
  }

  function finish(manifest) {
    manifest.finishedAt = now()
    JsonIO.write(OUT + 'manifest.json', manifest)
    console.info('[pack_test] PROBE COMPLETE token=' + input.token)
  }

  function runAll(server) {
    if (ns.started) return
    ns.started = true
    var manifest = { schema: SCHEMA, token: input.token, startedAt: now(), sections: [] }
    section('registries', function () { return ns.registries.collect(server) }, manifest)
    section('tags', function () { return ns.registries.collectTags() }, manifest)
    section('recipes', function () { return ns.recipes.collect(server) }, manifest)
    var t0 = now()
    var finished = false
    function end(results, error) {
      if (finished) return
      finished = true
      if (error) manifest.sections.push({ name: 'crafting', ok: false, error: error, ms: now() - t0 })
      else {
        try { write('crafting', { data: results, count: results.length }, manifest, t0) } catch (e) {
          manifest.sections.push({ name: 'crafting', ok: false, error: String(e).slice(0, 500), ms: now() - t0 })
        }
      }
      finish(manifest)
    }
    // The crafts span several ticks; if a callback dies, the manifest is still written (crafting failed).
    server.scheduleInTicks(CRAFT_DEADLINE_TICKS, function () { end(null, 'crafting did not finish within ' + CRAFT_DEADLINE_TICKS + ' ticks') })
    try {
      ns.crafting.run(server, input.crafts || [], function (results) { end(results, null) })
    } catch (e) { end(null, String(e).slice(0, 500)) }
  }

  // Registered here, after every pack script, so the captured JSON reflects the pack's own recipe changes.
  ServerEvents.recipes(function (event) {
    try { ns.recipes.capture(event) } catch (e) { console.error('[pack_test] recipe capture failed: ' + e) }
  })
  // Re-run on demand in a live test server: /kubejs custom_command pack_test
  ServerEvents.customCommand('pack_test', function (event) {
    ns.started = false
    try { runAll(event.server) } catch (e) { console.error('[pack_test] probe failed: ' + e) }
  })
  ServerEvents.loaded(function (event) {
    try { runAll(event.server) } catch (e) { console.error('[pack_test] probe failed: ' + e) }
  })
})()
