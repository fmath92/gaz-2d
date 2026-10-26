import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=name=>JSON.parse(fs.readFileSync(new URL('../data/'+name,import.meta.url)));
test('reference series contains all reproducible equilibrated runs and independent measurement windows',()=>{
 const {protocol,results}=read('radius-study-raw.json');
 assert.equal(results.length,52);assert.equal(protocol.radii.length,26);
 for(const radius of protocol.radii){
  const runs=results.filter(r=>r.radius===radius);assert.deepEqual(runs.map(r=>r.seed).sort(),[271828,314159]);
  for(const r of runs){
   assert.ok(r.equilibratedAt>=60-1e-6);assert.ok(r.blocks.length>=8&&r.blocks.length<=16);assert.ok(r.maxEnergyError<1e-10);
   let previous=r.equilibratedAt;
   for(const b of r.blocks){assert.ok(b.start>=previous-1e-6);assert.ok(Math.abs(b.end-b.start-20)<1e-6);assert.ok(b.wallCollisions>0);assert.ok(b.pairCollisions>0);previous=b.end;}
  }
 }
 const summary=read('radius-study-summary.json');
 assert.equal(summary.physics_sha256,crypto.createHash('sha256').update(fs.readFileSync(new URL('../dist/physics.js',import.meta.url))).digest('hex'));
 assert.equal(summary.blocks,426);assert.equal(summary.rows.length,26);
 assert.ok(summary.rows.every(r=>r.SE>0&&r.SE<.002));
 assert.ok(summary.models['Henderson × correction de paroi'].R2>.999);
});
