'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../probe/players.js'),'utf8');
test('player probe loads and saves the original UUID and preserves read failures',()=>{
  for(const fails of [false,true]) {
    let handler,result,saved=0;const id='90486bf9-1855-4113-8ab9-35ef878c5a5c';
    const container={getContainerSize:()=>1,getItem:()=>({isEmpty:()=>false,getId:()=>'minecraft:diamond',getCount:()=>7,getNbt:()=>null})};
    const player={uuid:id,getInventory:()=>container,getEnderChestInventory:()=>container,getNbt:()=>'{UUID:original}'};
    const server={overworld:()=>({}),getPlayerList:()=>({load:()=>{if(fails)throw new Error('bad player NBT');},remove:p=>{assert.equal(p,player);saved++;}})};
    vm.runInNewContext(code,{ServerEvents:{loaded:f=>{handler=f;}},JsonIO:{read:()=>({token:'t',players:[id]}),write:(_f,v)=>{result=v;}},Java:{loadClass:n=>n.endsWith('FakePlayerFactory')?{get:(_l,p)=>{assert.equal(p.id,id);return player;}}:n==='java.util.UUID'?{fromString:x=>x}:n.endsWith('GameProfile')?function(uuid){this.id=uuid;}:function(){}}});
    handler({server});assert.equal(result.token,'t');assert.equal(saved,fails?0:1);assert.equal(result.errors.length,fails?1:0);
    if(!fails){assert.equal(result.players[0].uuid,id);assert.equal(result.players[0].inventory[0].count,7);}
  }
});
