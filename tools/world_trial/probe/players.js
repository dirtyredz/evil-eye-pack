// priority: -25
// Separate from network login: exercise the real player-data loader/saver with the original UUID.
// This changes only disposable playerdata. A successful read is not a claim of client interaction.
ServerEvents.loaded(function(event) {
  var input=JsonIO.read('world-trial-input.json'),results=[]
  function stacks(container){var out=[];for(var i=0;i<container.getContainerSize();i++){var s=container.getItem(i);if(!s.isEmpty())out.push({slot:i,id:String(s.getId()),count:s.getCount(),payload:String(typeof s.getComponentsPatch==='function'?s.getComponentsPatch():s.getNbt())})}return out}
  try {
    var FPF
    try{FPF=Java.loadClass('net.neoforged.neoforge.common.util.FakePlayerFactory')}catch(e){FPF=Java.loadClass('net.minecraftforge.common.util.FakePlayerFactory')}
    var UUID=Java.loadClass('java.util.UUID'),Profile=Java.loadClass('com.mojang.authlib.GameProfile')
    for(var i=0;i<input.players.length;i++) {
      var id=String(input.players[i]),p=FPF.get(event.server.overworld(),new Profile(UUID.fromString(id),'WorldTrial'+i))
      event.server.getPlayerList().load(p)
      var row={uuid:String(p.uuid),source:id,inventory:stacks(p.getInventory()),enderChest:stacks(p.getEnderChestInventory()),savedNbt:String(p.getNbt())}
      if(row.uuid!==id)throw new Error('Player UUID changed '+id+' -> '+row.uuid)
      results.push(row)
      // Public logout path calls protected save(player) before removal. The fake is never
      // added to the world's active player list and never receives a network connection.
      event.server.getPlayerList().remove(p)
    }
    JsonIO.write('world-trial-players.json',{token:input.token,players:results,errors:[]})
  }catch(e){JsonIO.write('world-trial-players.json',{token:input.token,players:results,errors:[String(e)]})}
})
