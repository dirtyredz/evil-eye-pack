// priority: 0
;(function () {
  ServerEvents.commandRegistry(function (event) {
    var ns = global.evilEyeShowcase, commands = event.commands
    var root = commands.literal('evileye').requires(function (source) { return source.hasPermission(2) })
    var showcase = commands.literal('showcase'), clear = commands.literal('clear')
    showcase.then(commands.literal('list').executes(function (context) {
      context.source.sendSuccess(function () { return Text.of('Showcases: ' + Object.keys(ns.sections).sort().join(', ')) }, false)
      return 1
    }))
    function execute(name, clearOnly) { return function (context) {
      var source = context.source
      try {
        var plan = ns.sections[name](), at = source.getPosition()
        var origin = ns.origin(at.x, at.y, at.z, source.getRotation().y, plan)
        ns.build(source, plan, origin, name, clearOnly)
        source.sendSuccess(function () { return Text.of('Showcase ' + name + (clearOnly ? ' cleared' : ' built') + ' at ' + origin.x + ', ' + origin.y + ', ' + origin.z + '. North entrance; labels face north. Repeating from this position resets the plot and its contents.') }, false)
        return 1
      } catch (error) {
        source.sendFailure(Text.of('Showcase: ' + String(error)))
        return 0
      }
    } }
    Object.keys(ns.sections).sort().forEach(function (name) {
      showcase.then(commands.literal(name).executes(execute(name, false)))
      clear.then(commands.literal(name).executes(execute(name, true)))
    })
    event.register(root.then(showcase.then(clear)))
  })
})();
