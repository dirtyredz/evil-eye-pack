'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {plan}=require('../probe/plan.cjs');
test('bounded terrain sampling never skips a stored inventory or owned entity',()=>{
  const targets=[0,1,2,3,40].map(x=>({dimension:'minecraft:overworld',x,z:0,reasons:x===2?['entity']:x===3?['block entity']:['port blocks']}));
  const inventory={targets,entities:[{dimension:'minecraft:overworld',chunk:[2,0],id:'minecraft:wolf',nbt:{Owner:[1,2,3,4]}}],items:[{dimension:'minecraft:overworld',chunk:[3,0]}]};
  assert.deepEqual(plan(inventory).targets.map(t=>t.x),[0,2,3,40]);
});
