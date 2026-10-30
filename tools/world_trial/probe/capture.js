// priority: -30
// Injected only into trial servers. One forced existing chunk at a time, with bounded readiness.
;(function () {
  var state = null
  function dimension(level) {
    var key=String(typeof level.dimension==='function'?level.dimension():level.dimension)
    var match=/([a-z0-9_.-]+:[a-z0-9_./-]+)\]?$/.exec(key)
    if(!match)throw new Error('Unreadable dimension '+key)
    return match[1]
  }
  ServerEvents.loaded(function (event) {
    var input = JsonIO.read('world-trial-input.json')
    var BR = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
    var Registries = Java.loadClass('net.minecraft.core.registries.Registries')
    function keys(reg) { var a=reg.keySet().toArray(), out=[]; for(var i=0;i<a.length;i++)out.push(String(a[i]));return out.sort() }
    var dims=[], levels=event.server.getAllLevels().iterator()
    while(levels.hasNext())dims.push(dimension(levels.next()))
    JsonIO.write('world-trial-registries.json',{items:keys(BR.ITEM),blocks:keys(BR.BLOCK),entities:keys(BR.ENTITY_TYPE),blockEntities:keys(BR.BLOCK_ENTITY_TYPE),biomes:keys(event.server.registryAccess().registryOrThrow(Registries.BIOME)),dimensions:dims})
    state={input:input,index:0,ticks:0,active:null,visited:[],errors:[],done:false,colonyTicks:0,colonyDone:false}
  })
  ServerEvents.tick(function (event) {
    if(!state||state.done)return
    try {
      var cp=state.input.coverage && state.input.coverage.colonyProbe
      if(cp && cp.chunks.length && !state.colonyDone) {
        var overworld=event.server.overworld(),BP=Java.loadClass('net.minecraft.core.BlockPos')
        if(state.colonyTicks===0)for(var ci=0;ci<cp.chunks.length;ci++) {
          var ch=cp.chunks[ci];overworld.setChunkForced(ch.x,ch.z,true);overworld.getChunk(ch.x,ch.z)
        }
        state.colonyTicks++
        if(state.colonyTicks<cp.ticks)return
        var observed=[],colonyErrors=[],readiness=[]
        try {
          var API=Java.loadClass('com.minecolonies.api.colony.IColonyManager')
          for(var co=0;co<cp.colonies.length;co++) {
            var colony=API.getInstance().getColonyByWorld(cp.colonies[co],overworld)
            if(colony===null)throw new Error('Colony not loaded '+cp.colonies[co])
            var citizens=colony.getCitizenManager().getCitizens().iterator()
            while(citizens.hasNext()) {
              var citizen=citizens.next(),entity=citizen.getEntity()
              var row={colony:cp.colonies[co],citizen:citizen.getId(),present:entity.isPresent()}
              if(entity.isPresent()) {
                var e=entity.get();row.uuid=String(e.uuid);row.removed=e.isRemoved()
                row.bound=e.getCitizenData()!==null && e.getCitizenData().getId()===citizen.getId()
              }
              observed.push(row)
            }
          }
        }catch(ce){colonyErrors.push(String(ce))}
        for(var cr=0;cr<cp.chunks.length;cr++) {
          var c=cp.chunks[cr]
          readiness.push({x:c.x,z:c.z,ticking:overworld.isPositionEntityTicking(new BP(c.x*16+8,79,c.z*16+8))})
          overworld.setChunkForced(c.x,c.z,false)
        }
        JsonIO.write('world-trial-colony.json',{token:state.input.token,ticks:state.colonyTicks,observed:observed,chunks:readiness,errors:colonyErrors})
        state.colonyDone=true
        return
      }
      if(state.active) {
        state.ticks++
        var p=state.active, ready=p.level.isPositionEntityTicking(p.pos)
        if(!ready&&state.ticks<200)return
        if(!ready)state.errors.push({target:p.target,error:'entity section not ticking after 200 ticks'})
        state.visited.push({dimension:p.target.dimension,x:p.target.x,z:p.target.z,entityTicking:ready,ticks:state.ticks})
        if(state.visited.length%100===0)JsonIO.write('world-trial-progress.json',{token:state.input.token,visited:state.visited.length,total:state.input.targets.length,last:state.visited[state.visited.length-1]})
        p.level.setChunkForced(p.target.x,p.target.z,false)
        state.active=null;state.index++
      }
      if(state.index>=state.input.targets.length) {
        event.server.runCommandSilent('save-all flush')
        JsonIO.write('world-trial-complete.json',{token:state.input.token,visited:state.visited,errors:state.errors})
        state.done=true;return
      }
      var t=state.input.targets[state.index],levels=event.server.getAllLevels().iterator(),level=null
      while(levels.hasNext()){var l=levels.next();if(dimension(l)===String(t.dimension))level=l}
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
