// Registers the "EMI Curation" key mapping used by client_scripts/emi_curation/ui/decor_mark.js.
//
// Forge accepts key mappings only from RegisterKeyMappingsEvent on the mod event bus, which fires
// once while the game starts, so this must be a startup script (a change needs a full restart, not
// /kubejs reload). The mapping is handed to the client scripts through `global`, which every
// script type shares. Default key D, active only while a screen is open (GUI conflict context), so
// it never clashes with walking right; EMI, JEI and the vanilla screens use no plain D.
// Rebind it under Options > Controls > "EMI Curation".

(function () {
  try {
    if (!Platform.isClientEnvironment()) return
    ForgeModEvents.onEvent('net.minecraftforge.client.event.RegisterKeyMappingsEvent', function (event) {
      try {
        var KeyMapping = Java.loadClass('net.minecraft.client.KeyMapping')
        var Context = Java.loadClass('net.minecraftforge.client.settings.KeyConflictContext')
        var Type = Java.loadClass('com.mojang.blaze3d.platform.InputConstants$Type')
        var GLFW_KEY_D = 68
        var key = new KeyMapping('key.emi_curation.mark_decor', Context.GUI, Type.KEYSYM, GLFW_KEY_D, 'key.categories.emi_curation')
        event.register(key)
        global.emiCurationDecorKey = key
      } catch (err) {
        console.error('EMI curation (register key mapping): ' + err)
      }
    })
  } catch (err2) {
    console.error('EMI curation (key mapping startup script): ' + err2)
  }
})()
