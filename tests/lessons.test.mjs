import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {GasSimulation}=require('../dist/physics.js');
require('../dist/units.js');require('../dist/lessons.js');
const {PressureWindow,TemperatureSnapshot}=globalThis.GasLessons;

test('pressure window counts every impact in its area once, including simultaneous collisions',()=>{
 const sim={time:10,height:8,width:11,_collisions:5,_events:[]},l=new PressureWindow(sim);
 sim.time=11;sim._collisions=10;sim._events=[
  {id:6,time:10,wall:'right',y:3,impulse:99},
  {id:7,time:10.5,wall:'right',y:3,impulse:2},
  {id:8,time:10.5,wall:'right',y:5,impulse:3},
  {id:9,time:10.7,wall:'right',y:1,impulse:100},
  {id:10,time:10.8,wall:'left',y:4,impulse:100}];
 l.collect(sim);l.collect(sim);assert.equal(l.events.length,2);assert.equal(l.impulse,5);assert.equal(l.pressure,5/4);
 sim.time=12;sim._collisions=11;sim._events.push({id:11,time:12,wall:'right',y:4,impulse:7});l.collect(sim);
 assert.equal(l.phase,'done');assert.equal(l.pressure,12/(4*2));assert.equal(l.events.length,3);
});

test('real collision ledger reproduces the pressure sum without changing the physics',()=>{
 const sim=new GasSimulation({count:1000,width:11,temperature:1.5,particleModel:'hard-disks',particleRadius:.04,seed:314159});
 sim.step(.25);const control=sim.fork(),l=new PressureWindow(sim);
 for(let i=0;i<240;i++){sim.step(1/120);control.step(1/120);l.collect(sim);}
 const expected=sim._events.filter(e=>e.wall==='right'&&e.time>l.start&&e.y>=l.y0&&e.y<=l.y1).reduce((a,e)=>a+e.impulse,0);
 assert.ok(l.events.length>10);assert.ok(Math.abs(l.impulse-expected)<1e-8);
 assert.deepEqual(sim.particles,control.particles);assert.equal(sim.metrics.energy,control.metrics.energy);
 assert.ok(Math.abs(l.pressure*l.surface-l.impulse*globalThis.GasUnits.scales.momentum/(l.elapsed*globalThis.GasUnits.scales.time)/globalThis.GasUnits.scales.pressure)<1e-10);
});

test('temperature animation freezes all velocities and sums squared norms, locally and globally',()=>{
 const sim=new GasSimulation({count:1000,width:11,temperature:1.5,particleModel:'hard-disks',particleRadius:.04,seed:314159});
 const before=JSON.stringify(sim.particles),s=new TemperatureSnapshot(sim),b=s.bounds;
 assert.equal(s.local.length,sim.particles.filter(p=>Math.abs(p.x-b.cx)<=b.half&&Math.abs(p.y-b.cy)<=b.half).length);
 assert.ok(s.local.length>=12);assert.equal(s.particles.length,1000);
 assert.ok(Math.abs(s.temperature-300)<1e-8);
 for(const p of s.local)assert.ok(Math.abs(p.energy-p.speed**2/2)<1e-12);
 for(const [dt,phase] of [[2,'vectors'],[3,'align'],[3,'energy'],[3,'sum'],[4,'global'],[3,'done']]){s.tick(dt);assert.equal(s.phase,phase);}
 assert.equal(s.partialEnergy,s.localEnergy);assert.equal(JSON.stringify(sim.particles),before);assert.equal(sim.time,0);
 sim.particles[0].vx=999;assert.notEqual(s.particles[0].vx,999);
});

test('continuous pressure scene advances the same gas, zooms from the full view and starts its window afterwards',()=>{
 const sim=new GasSimulation({count:1000,width:11,temperature:1.5,particleModel:'hard-disks',particleRadius:.04,seed:314159}),control=sim.fork();
 const l=new PressureWindow(sim,{cinematic:true}),particles=sim.particles;
 const advance=dt=>{sim.step(dt);control.step(dt);};
 assert.equal(l.phase,'overview');assert.equal(l.zoom,0);
 for(let i=0;i<60;i++)l.tick(1/60,sim,advance);
 assert.equal(l.phase,'zoom');assert.ok(l.zoom>0&&l.zoom<1);assert.equal(l.events.length,0);assert.ok(sim.time>0);
 while(l.phase!=='collect')l.tick(1/60,sim,advance);
 assert.equal(l.zoom,1);assert.equal(l.start,sim.time);assert.equal(l.elapsed,0);
 const t=sim.time;l.paused=true;l.tick(1,sim,advance);assert.equal(sim.time,t);l.paused=false;
 for(let i=0;i<600&&l.phase!=='done';i++)l.tick(1/60,sim,advance);
 assert.equal(l.phase,'done');assert.ok(l.events.length>10);assert.ok(l.events.every(e=>e.time>l.start&&e.time<=l.start+2+1e-9));
 assert.equal(sim.particles,particles);assert.deepEqual(sim.particles,control.particles);
});

test('region camera shares normal coordinates at zero zoom and never changes particle state',()=>{
 require('../dist/graphics.js');const G=globalThis.LabGraphics;
 const sim=new GasSimulation({count:100,width:11,temperature:1.5});const before=JSON.stringify(sim.particles);
 const region={x:11,y:sim.height/2,y0:sim.height/4,y1:sim.height*3/4,zoom:0};
 const ordinary=G.chamberCamera(700,340,sim),start=G.chamberCamera(700,340,sim,{region});
 for(const p of sim.particles){assert.equal(start.X(p.x),ordinary.X(p.x));assert.equal(start.Y(p.y),ordinary.Y(p.y));}
 const middle=G.chamberCamera(700,340,sim,{region:{...region,zoom:.5}}),end=G.chamberCamera(700,340,sim,{region:{...region,zoom:1}});
 assert.ok(middle.scale>start.scale&&middle.scale<end.scale);assert.equal(end.X(11),.72*700);assert.equal(JSON.stringify(sim.particles),before);
});

test('temperature entry slows the live gas before capturing, framing, then zooming without altering dynamics',()=>{
 const {TemperatureLesson}=globalThis.GasLessons;
 const sim=new GasSimulation({count:1000,width:11,temperature:1.5,particleModel:'hard-disks',particleRadius:.04,seed:314159}),control=sim.fork();
 const l=new TemperatureLesson(sim),advance=h=>{sim.step(h);control.step(h);};
 let previous=l.rate;
 for(let i=0;i<96;i++){
  assert.equal(l.visual.zoom,0);assert.equal(l.visual.selection,0);
  l.tick(1/60,sim,advance);assert.ok(l.rate<=previous);previous=l.rate;
 }
 assert.equal(l.phase,'frame');assert.ok(Math.abs(sim.time-.8)<1e-8);assert.equal(l.time,sim.time);
 assert.deepEqual(sim.particles,control.particles);
 const frozen=JSON.stringify(sim.particles),time=sim.time;
 for(let i=0;i<30;i++)l.tick(1/60,sim,advance);
 assert.equal(l.visual.zoom,0);assert.ok(l.visual.selection>0&&l.visual.selection<1);
 for(let i=0;i<90;i++)l.tick(1/60,sim,advance);
 assert.equal(l.phase,'zoom');assert.ok(l.visual.zoom>0&&l.visual.zoom<1);
 for(let i=0;i<1500;i++)l.tick(1/60,sim,advance);
 assert.equal(l.phase,'done');assert.equal(l.visual.zoom,1);assert.equal(l.visual.arrange,1);
 assert.equal(sim.time,time);assert.equal(JSON.stringify(sim.particles),frozen);
});

test('return restores the temperature diagram, zooms out while frozen, then gradually resumes the same gas',()=>{
 const {SimulationReturn}=globalThis.GasLessons;
 const sim=new GasSimulation({count:100,width:11,temperature:1.5}),control=sim.fork();
 const r=new SimulationReturn({zoom:1,rate:0,speed:2,visual:{zoom:1,arrange:1,energyMix:1,selection:1,opacity:1}});
 const advance=h=>{sim.step(h);control.step(h);};let previousZoom=1,previousRate=0,steps=0;
 while(r.phase!=='done'&&steps++<400){
  const phase=r.phase;r.tick(1/60,advance);
  assert.ok(r.zoom<=previousZoom);previousZoom=r.zoom;
  if(phase==='restore'){assert.equal(r.zoom,1);assert.equal(sim.time,0);}
  if(phase==='zoomOut'){assert.equal(sim.time,0);assert.equal(r.visual.arrange,0);}
  if(r.phase==='resume'){assert.equal(r.zoom,0);assert.ok(r.rate>=previousRate);previousRate=r.rate;}
 }
 assert.equal(r.phase,'done');assert.ok(Math.abs(sim.time-1.6)<1e-8);assert.deepEqual(sim.particles,control.particles);
});

test('area camera starts and ends at the actual full piston view at desktop and mobile sizes',()=>{
 const G=globalThis.LabGraphics,sim=new GasSimulation({count:100,width:11,temperature:1.5});
 for(const [w,h] of [[700,340],[320,300]]){
  const area={cx:5.5,cy:sim.height/2,half:.6,zoom:0},normal=G.chamberCamera(w,h,sim),full=G.chamberCamera(w,h,sim,{area});
  for(const p of sim.particles){assert.equal(full.X(p.x),normal.X(p.x));assert.equal(full.Y(p.y),normal.Y(p.y));}
  assert.ok(full.X(sim.width)<w-20);assert.ok(full.Y(0)<h);assert.ok(full.Y(sim.height)>0);
  const zoom=G.chamberCamera(w,h,sim,{area:{...area,zoom:1}});assert.ok(Math.abs(zoom.X(area.cx)-w/2)<1e-9);assert.ok(zoom.scale>full.scale);
 }
});

require('../dist/tour.js');
test('work windows sum actual full-piston collisions and recover the signed P–V area in all three cases',()=>{
 const {WorkWindow}=globalThis.GasLessons;
 for(const u of [0,-.16,.16]){
  const sim=new GasSimulation({count:1000,width:11,temperature:1.5,particleModel:'hard-disks',particleRadius:.04,observeCollisions:true});
  if(u)sim.setMotion({targetWidth:11+u*10,duration:10});
  const control=sim.fork(),l=new WorkWindow(sim);
  while(l.phase!=='done')l.tick(1/60,sim,h=>{sim.step(h);control.step(h);});
  const area=l.bins.reduce((sum,b)=>sum-b.pressure*(b.v1-b.v0),0);
  assert.ok(l.events.length>20);assert.ok(l.pressure>0);
  assert.ok(Math.abs(l.work+u*l.impulse)<1e-9);
  assert.ok(Math.abs(l.work-l.pressureWork)<1e-8);
  assert.ok(Math.abs(l.work-area)<1e-8);
  assert.ok(Math.abs(l.work-l.deltaEnergy)<1e-8);
  assert.ok(u===0?l.work===0&&l.deltaVolume===0:u<0?l.work>0&&l.deltaVolume<0:l.work<0&&l.deltaVolume>0);
  assert.deepEqual(sim.particles,control.particles);
 }
});

test('the work journey chains rest, compression and expansion on the same gas, then holds its result',()=>{
 const {WorkJourney}=globalThis.GasLessons;
 const sim=new GasSimulation({count:1000,width:11,temperature:1.5,particleModel:'hard-disks',particleRadius:.04,observeCollisions:true});
 const particles=sim.particles,l=new WorkJourney(sim,{planningBudget:Infinity}),seen=[];
 for(let i=0;i<7000&&l.phase!=='done'&&l.phase!=='unavailable';i++){
  if(seen.at(-1)!==l.case)seen.push(l.case);
  l.tick(1/60,sim,h=>{sim.step(h);return h;});
 }
 assert.equal(l.phase,'done',l.message);assert.deepEqual(seen,['fixed','compression','expansion']);
 assert.equal(sim.particles,particles);assert.equal(l.results.length,3);assert.equal(l.zoom,1);assert.equal(l.rate,0);assert.equal(sim.motion,null);
 for(const [i,r] of l.results.entries()){
  assert.ok(r.events.length>20);assert.ok(r.collision.impulse>0);
  assert.ok(Math.abs(r.work-r.pressureWork)<1e-7);assert.ok(Math.abs(r.work-r.deltaEnergy)<1e-7);
  assert.ok(i===0?r.work===0&&r.collision.work===0:i===1?r.work>0&&r.collision.work>0:r.work<0&&r.collision.work<0);
  assert.ok(i===0?r.velocity===0:i===1?r.velocity<0:r.velocity>0);
 }
 const frozen=JSON.stringify(sim.particles),time=sim.time;l.tick(20,sim,h=>sim.step(h));assert.equal(sim.time,time);assert.equal(JSON.stringify(sim.particles),frozen);
 assert.ok(Math.abs(sim.metrics.balanceError)<1e-7);assert.equal(sim.metrics.heat,0);
});

test('work preparation makes room at the compression limit using real motion, without resetting the gas',()=>{
 const {WorkJourney}=globalThis.GasLessons;
 const sim=new GasSimulation({count:100,width:3,temperature:1.5,particleModel:'hard-disks',particleRadius:.04,observeCollisions:true});
 const particles=sim.particles,l=new WorkJourney(sim,{speed:4,planningBudget:Infinity});assert.equal(l.phase,'prepare');
 l.paused=true;l.tick(1,sim,h=>sim.step(h));assert.equal(sim.width,3);l.paused=false;
 for(let i=0;i<500&&l.phase==='prepare';i++)l.tick(1/60,sim,h=>{sim.step(h);return h;});
 assert.equal(l.phase,'collision');assert.equal(l.case,'fixed');assert.equal(sim.width,11);assert.equal(sim.particles,particles);assert.equal(sim.motion,null);
});
