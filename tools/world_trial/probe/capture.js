// priority: -30
// Injected only into trial servers. One forced existing chunk at a time, with bounded readiness.
;(function () {
  var state = null
  ServerEvents.loaded(function (event) {
    var input = JsonIO.read('world-trial-input.json')
    var BR = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
    var Registries = Java.loadClass('net.minecraft.core.registries.Registries')
    function keys(reg) { var a=reg.keySet().toArray(), out=[]; for(var i=0;i<a.length;i++)out.push(String(a[i]));return out.sort() }
    var dims=[], levels=event.server.getAllLevels().iterator()
    while(levels.hasNext())dims.push(String(levels.next().dimension().location()))
    JsonIO.write('world-trial-registries.json',{items:keys(BR.ITEM),blocks:keys(BR.BLOCK),entities:keys(BR.ENTITY_TYPE),blockEntities:keys(BR.BLOCK_ENTITY_TYPE),biomes:keys(event.server.registryAccess().registryOrThrow(Registries.BIOME)),dimensions:dims})
    state={input:input,index:0,ticks:0,active:null,visited:[],errors:[],done:false}
  })
  ServerEvents.tick(function (event) {
    if(!state||state.done)return
    try {
      if(state.active) {
        state.ticks++
        var p=state.active, ready=p.level.isPositionEntityTicking(p.pos)
        if(!ready&&state.ticks<200)return
        if(!ready)state.errors.push({target:p.target,error:'entity section not ticking after 200 ticks'})
        state.visited.push({dimension:p.target.dimension,x:p.target.x,z:p.target.z,entityTicking:ready,ticks:state.ticks})
        p.level.setChunkForced(p.target.x,p.target.z,false)
        state.active=null;state.index++
      }
      if(state.index>=state.input.targets.length) {
        event.server.runCommandSilent('save-all flush')
        JsonIO.write('world-trial-complete.json',{token:state.input.token,visited:state.visited,errors:state.errors})
        state.done=true;return
      }
      var t=state.input.targets[state.index],levels=event.server.getAllLevels().iterator(),level=null
      while(levels.hasNext()){var l=levels.next();if(String(l.dimension().location())===String(t.dimension))level=l}
      if(!level)throw new Error('Missing dimension '+t.dimension)
      var BP=Java.loadClass('net.minecraft.core.BlockPos')
      level.setChunkForced(t.x,t.z,true)
      level.getChunk(t.x,t.z)
      state.active={level:level,target:t,pos:new BP(t.x*16+8,64,t.z*16+8)};state.ticks=0
    }catch(e){
      state.errors.push({index:state.index,error:String(e)})
      if(state.active)state.active.level.setChunkForced(state.active.target.x,state.active.target.z,false)
      JsonIO.write('world-trial-complete.json',{token:state.input.token,visited:state.visited,errors:state.errors})
      state.done=true
    }
  })
})()
