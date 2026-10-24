import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const {GasSimulation}=createRequire(import.meta.url)('../dist/physics.js');
const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
function isolatedParticle(options={}){
 const s=new GasSimulation({count:10,observeCollisions:true,...options});
 for(const [i,p] of s.particles.entries())Object.assign(p,{x:1+i*.3,y:1,vx:0,vy:0});
 return s;
}
test('recorded wall event includes the real location, time, velocities and impulse',()=>{
 const s=isolatedParticle(),p=s.particles[0];Object.assign(p,{x:10.9,y:3,vx:2,vy:.5});s.step(.1);
 const e=s.observations.walls.right;close(e.time,.05);close(e.x,11);close(e.y,3.025);close(e.impulse,4);close(e.before.vx,2);close(e.after.vx,-2);close(e.energyBefore,e.energyAfter);close(e.work,0);close(e.heat,0);
 close(s.metrics.pressureByWall.right,s.metrics.impulseByWall.right/s.metrics.pistonLengthTime);
});
test('latest point collision is chosen chronologically, not by particle iteration order',()=>{
 const s=isolatedParticle();Object.assign(s.particles[0],{x:10.8,y:3,vx:1,vy:0});Object.assign(s.particles[1],{x:10.9,y:4,vx:1,vy:0});s.step(.4);
 assert.equal(s.observations.walls.right.particleId,0);close(s.observations.walls.right.time,.2);
});
test('observed moving wall separates work and heat and matches laboratory energy change',()=>{
 const s=isolatedParticle({thermal:{mode:'thermostat',temperature:2}});Object.assign(s.particles[0],{x:10.9,y:3,vx:2,vy:.5});s.setMotion({targetWidth:10,duration:1});s.step(.1);
 const e=s.observations.walls.right;close(e.wallVelocity,-1);close(e.work,-e.wallVelocity*e.impulse);close(e.energyAfter-e.energyBefore,e.work+e.heat);assert.ok(e.thermal);
});
test('a selected left thermostat does not exchange heat at any other wall',()=>{
 const s=isolatedParticle({thermal:{mode:'thermostat',walls:['left'],temperature:3}});
 Object.assign(s.particles[0],{x:10.9,y:3,vx:2,vy:0});Object.assign(s.particles[1],{x:.1,y:3,vx:-2,vy:0});s.step(.1);
 const l=s.observations.walls.left,r=s.observations.walls.right;assert.ok(l.thermal);assert.equal(r.thermal,false);close(r.heat,0);close(s.heat,l.heat);close(l.heat,l.energyAfter-l.energyBefore);
 close(s.metrics.heatFluxByWall.left,l.heat/(s.height*.1));close(s.metrics.heatFluxByWall.right,0);
});
test('thermal wall selection is validated and copied rather than retaining a mutable input array',()=>{
 const s=new GasSimulation(),walls=['left'];s.setThermal({walls});walls.push('right');assert.deepEqual(s.thermal.walls,['left']);
 assert.throws(()=>s.setThermal({walls:['bogus']}));assert.throws(()=>s.setThermal({walls:null}));
 s.setThermal({walls:[]});assert.deepEqual(s.thermal.walls,[]);
});
test('pair observation records conserved energy and momentum without reporting exterior work or heat',()=>{
 const s=isolatedParticle({particleModel:'hard-disks'});Object.assign(s.particles[0],{x:3,y:3,vx:2,vy:0});Object.assign(s.particles[1],{x:3.2,y:3.04,vx:0,vy:0});s.step(.1);
 const e=s.observations.pair;assert.equal(e.kind,'pair');assert.ok(e.time>0);const energy=ps=>ps.reduce((sum,p)=>sum+(p.vx**2+p.vy**2)/2,0);
 close(energy(e.before),energy(e.after));for(const axis of ['vx','vy'])close(e.before.reduce((sum,p)=>sum+p[axis],0),e.after.reduce((sum,p)=>sum+p[axis],0));close(s.work,0);close(s.heat,0);
});
test('observation does not change any trajectory, heat, or work; reset discards past observations',()=>{
 const options={count:100,particleModel:'hard-disks',thermal:{mode:'thermostat',walls:['left'],temperature:3}};
 const a=new GasSimulation({...options,observeCollisions:true}),b=new GasSimulation(options);
 for(let i=0;i<30;i++){a.step(1/30);b.step(1/30);}
 assert.deepEqual(a.particles,b.particles);close(a.work,b.work);close(a.heat,b.heat);assert.ok(a.observations.sequence>0);assert.equal(b.observations.sequence,0);
 a.reset({count:100});assert.equal(a.observations.sequence,0);assert.deepEqual(a.observations.walls,{});assert.equal(a.observations.pair,null);
});
