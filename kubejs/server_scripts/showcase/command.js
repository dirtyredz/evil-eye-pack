// priority: 0
;(function () {
  ServerEvents.commandRegistry(function (event) {
    var ns = global.evilEyeShowcase, commands = event.commands
    var StringArgumentType = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')
    var root = commands.literal('evileye').requires(function (source) { return source.hasPermission(2) })
    function names() { return Object.keys(ns.sections).sort() }
    function reply(source, message) { source.sendSuccess(function () { return Text.of(message) }, false) }
    function refuse(source, message) { source.sendFailure(Text.of('Showcase: ' + message)); return 0 }
    // All requested sections side by side along world east, centred on the player's plot.
    // Each section is preflighted and built in order, so a refusal keeps earlier ones built.
    function build(source, wanted, clearOnly) {
      try {
        var plans = wanted.map(function (name) { return ns.sections[name]() })
        var layout = ns.layout(plans, source), removed = 0, kinds = [], placed = []
        wanted.forEach(function (name, i) {
          var origin = layout.origins[i]
          var result = ns.build(source, plans[i], origin, name, clearOnly)
          removed += result.removed.total
          if (result.removed.summary) kinds.push(result.removed.summary)
          placed.push(name + ' at ' + origin.x + ', ' + origin.y + ', ' + origin.z)
        })
        reply(source, 'Showcase ' + (clearOnly ? 'cleared' : 'built') + ': ' + placed.join('; ') + ' over ' + layout.width + 'x' + layout.height + 'x' + layout.depth + ' ahead of you; removed ' + removed + ' mobs/items' + (kinds.length ? ' (' + kinds.join(', ') + ')' : '') + '. North entrance; labels face north. Repeating from this position resets the plot and its contents.')
        return 1
      } catch (error) {
        console.info('Showcase command refused: ' + String(error))
        return refuse(source, String(error))
      }
    }
    function run(context) {
      var source = context.source, tokens = []
      try { tokens = String(StringArgumentType.getString(context, 'args')).trim().split(/\s+/).filter(Boolean) } catch (e) { tokens = [] }
      return dispatch(source, tokens)
    }
    function dispatch(source, tokens) {
      var all = names(), first = (tokens[0] || '').toLowerCase(), clearOnly = first === 'clear'
      if (first === 'list') { reply(source, 'Showcases: ' + all.join(', ') + '. /evileye showcase builds them all where you stand; add a name for one, or "clear [name]" to remove.'); return 1 }
      var rest = clearOnly ? tokens.slice(1) : tokens
      if (rest.length > 1) return refuse(source, 'expected one section name, got "' + rest.join(' ') + '". Available: ' + all.join(', '))
      if (!rest.length) return build(source, all, clearOnly)
      var name = rest[0].toLowerCase()
      if (all.indexOf(name) < 0) return refuse(source, 'unknown showcase "' + rest[0] + '". Available: ' + all.join(', ') + ' (or "list").')
      return build(source, [name], clearOnly)
    }
    function suggest(context, builder) {
      var typed = String(builder.getRemaining()).toLowerCase()
      // Only the final word is completed; "clear <name>" suggests names after "clear ".
      var lead = typed.lastIndexOf(' ') + 1, word = typed.slice(lead), prior = typed.slice(0, lead).trim()
      var options = prior === '' ? ['list', 'clear'].concat(names()) : prior === 'clear' ? names() : []
      var out = builder.createOffset(builder.getStart() + lead)
      options.filter(function (o) { return o.indexOf(word) === 0 }).forEach(function (o) { out.suggest(o) })
      return out.buildFuture()
    }
    var showcase = commands.literal('showcase').executes(run)
      .then(commands.argument('args', StringArgumentType.greedyString()).suggests(suggest).executes(run))
    event.register(root.then(showcase))
  })
})();
