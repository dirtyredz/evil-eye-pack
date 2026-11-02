// priority: -10
// Evil Eye Essentials on the live pack server: the build, the commands that replace FTB Essentials (FTB's
// gone), and homes, /back, warps and the trash can run by a fake player standing on the plot.
global.evilEyeShowcaseCheck.checks = global.evilEyeShowcaseCheck.checks || {}
global.evilEyeShowcaseCheck.checks.evileye_essentials = function (h) {
  var check = h.check, later = h.later, server = h.server, level = h.level
  var before = h.shell()
  global.evilEyeShowcaseCheck.terrain(h)
  check(h.invoke() === 1, 'level 2 builds through real command')
  h.verifyPlan()
  check(h.shell() === before, 'entire exterior shell unchanged after build')

  var root = server.getCommands().getDispatcher().getRoot()
  ;['home', 'sethome', 'delhome', 'listhomes', 'back', 'spawn', 'tpa', 'tpaccept', 'warp', 'setwarp', 'kit', 'trashcan',
    'heal', 'feed', 'fly', 'god', 'invsee', 'enderchest', 'nickname', 'mute', 'evileye_essentials'].forEach(function (name) {
    check(root.getChild(name) !== null, 'Evil Eye Essentials registers /' + name)
  })
  check(root.getChild('ftblibrary') === null && root.getChild('ftbessentials') === null, 'no FTB command tree is left')
  check(root.getChild('rtp') === null, '/rtp stays off (pack value)')
  check(h.run('evileye_essentials import ftb dry_run') === 1, 'the FTB import runs (no FTB data in a fresh world)')

  var FPF = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayerFactory')
  var Profile = Java.loadClass('com.mojang.authlib.GameProfile')
  var UUID = Java.loadClass('java.util.UUID')
  var player = FPF.get(level, new Profile(UUID.fromString('5e5e5e5e-0000-4000-8000-00000000e5e5'), 'ees_showcase'))
  function stand(x, z) { var at = h.pos(x, 1, z); player.setPos(at.getX() + 0.5, at.getY(), at.getZ() + 0.5) }  // moveTo(5 args) is ambiguous to Rhino
  function as(text, op) {
    var source = player.createCommandSourceStack().withSuppressedOutput()
    return global.evilEyeShowcaseCheck.runCommand(server, op ? source.withPermission(2) : source, text)
  }

  stand(2, 5)
  check(as('sethome showcase') === 1, '/sethome on the lodestone')
  stand(6, 18)
  check(as('home showcase') === 1, '/home succeeds')
  check(as('back') === 1, '/back returns to where /home was used')
  check(as('home showcase') === 0, 'the 60 s /home cooldown applies')
  check(as('delhome showcase') === 1 && as('delhome showcase') === 0, '/delhome removes the home once')

  stand(2, 14)
  check(as('setwarp showcase') === 0, 'a player without level 2 cannot /setwarp')
  check(as('setwarp showcase', true) === 1, 'an operator sets a warp on the crying obsidian')
  stand(6, 18)
  check(as('warp showcase') === 1, 'anyone uses /warp')
  check(as('delwarp showcase', true) === 1, 'the operator deletes it again')

  // NeoForge's FakePlayer never opens menus, so the screen itself is an owner check.
  check(as('trashcan') === 1, '/trashcan (the sidebar trash button) runs')

  later(5, function () {
    check(h.invoke() === 1, 'rebuild succeeds')
    h.verifyPlan()
    check(h.invoke(null, true) === 1, 'clear command succeeds')
    h.verifyVolume(true)
    check(h.shell() === before, 'entire exterior shell unchanged after teardown')
    h.done()
  })
}
