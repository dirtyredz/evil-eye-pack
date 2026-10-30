'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {plan}=require('../probe/plan.cjs');
test('bounded terrain sampling never skips an entity or container chunk',()=>{
  const targets=[0,1,2,3,40].map(x=>({dimension:'minecraft:overworld',x,z:0,reasons:x===2?['entity']:x===3?['block entity']:['port blocks']}));
  assert.deepEqual(plan({targets}).targets.map(t=>t.x),[0,2,3,40]);
});
