import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GasSimulation } = require('../dist/physics.js');
require('../dist/tour.js');
const { CollisionTour } = globalThis;
const close = (a,b,tol=1e-8) => assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const gas = options => new GasSimulation({count:1000,observeCollisions:true,...options});
function complete(tour) {
  const phases = new Set(), times = [];
  for(let frame=0;frame<4000&&!tour.finished;frame++) {
    tour.tick(1/60,h=>{const before=tour.sim.time;tour.sim.step(h);times.push(tour.sim.time);return tour.sim.time-before;},Infinity);
    phases.add(tour.phase);
  }
  assert.equal(tour.phase,'done',tour.message);
  assert.equal(tour.zoom,0);
  assert.ok(times.every((t,i)=>!i||t>times[i-1]));
  for(const phase of ['approach','impact','departure','return'])assert.ok(phases.has(phase),phase);
  close(tour.sim.metrics.balancePressureError,0,1e-7);
  return tour.events;
}
test('forecast fork copies thermal RNG, moving geometry and histories without mutating the source',()=>{
  for(const particleModel of ['ideal','hard-disks']){
    const s=gas({particleModel,thermal:{mode:'thermostat',temperature:3}});
    s.setMotion({type:'smooth',targetWidth:8,duration:3});s.step(.1);
    const before=JSON.stringify(s.metrics),beforeParticles=JSON.stringify(s.particles),copy=s.fork();
    for(let i=0;i<60;i++)copy.step(1/720);
    assert.equal(JSON.stringify(s.metrics),before);assert.equal(JSON.stringify(s.particles),beforeParticles);
    for(let i=0;i<60;i++)s.step(1/720);
    assert.deepEqual(s.particles,copy.particles);assert.deepEqual(s.metrics,copy.metrics);
    copy.particles[0].vx+=1;assert.notEqual(s.particles[0].vx,copy.particles[0].vx);
  }
});
test('pressure tour selects a future collision, zooms, shows the real impulse and automatically returns',()=>{
  const s=gas();s.step(.3);const before=JSON.stringify(s.metrics);const tour=new CollisionTour(s);
  while(tour.phase==='search')tour.plan(Infinity);
  assert.equal(JSON.stringify(s.metrics),before);assert.ok(tour.target.time>s.time+.2);
  const predicted=tour.target,events=complete(tour);assert.equal(events.length,1);
  close(events[0].time,predicted.time);assert.equal(events[0].particleId,predicted.particleId);
  close(events[0].impulse,predicted.impulse);close(events[0].energyBefore,events[0].energyAfter);assert.equal(s.metrics.heat,0);close(s.metrics.work,0);
});
test('thermal tour shows positive then negative actual Q, conserving the first law throughout',()=>{
  const s=gas({thermal:{mode:'thermostat',temperature:3,walls:['left']}});
  const events=complete(new CollisionTour(s,{kind:'heat'}));assert.equal(events.length,2);
  assert.ok(events[0].heat>0&&events[1].heat<0);assert.ok(events[1].time>events[0].time);
  for(const e of events){assert.equal(e.wall,'left');close(e.heat,e.energyAfter-e.energyBefore);close(e.work,0);}
  close(s.metrics.work,0);close(s.metrics.energy-s.initialEnergy,s.metrics.heat);
});
test('moving piston tours show opposite laboratory energy changes for expansion and compression',()=>{
  for(const [targetWidth,type] of [[15,'linear'],[8,'linear'],[8,'smooth'],[8,'fast']]){
    const s=gas();s.setMotion({type:type==='fast'?'linear':type,targetWidth,duration:type==='fast'?.2:10});
    const [e]=complete(new CollisionTour(s,{kind:'work'}));
    assert.ok(targetWidth>11?e.work<0:e.work>0);close(e.work,e.energyAfter-e.energyBefore);close(e.work,-e.wallVelocity*e.impulse);assert.equal(e.heat,0);
  }
});
test('predicted thermal and piston events also occur exactly for interacting hard disks',()=>{
  for(const kind of ['heat','work']){
    const s=gas({particleModel:'hard-disks',thermal:kind==='heat'?{mode:'thermostat',temperature:2,walls:['left']}:{mode:'isolated'}});
    if(kind==='work')s.setMotion({targetWidth:8,duration:5});
    const events=complete(new CollisionTour(s,{kind}));assert.ok(events.length);assert.ok(s.metrics.pairCollisions>0);
  }
});
test('an isolated wall and a piston outrunning the particles do not fabricate an energy transfer',()=>{
  const isolated=new CollisionTour(gas(),{kind:'heat'});assert.equal(isolated.phase,'unavailable');assert.equal(isolated.events.length,0);
  const s=gas();s.setMotion({targetWidth:18,duration:.2});const tour=new CollisionTour(s,{kind:'work'}),before=JSON.stringify(s.metrics);
  while(tour.phase==='search')tour.plan(Infinity);
  assert.equal(tour.phase,'unavailable');assert.equal(tour.events.length,0);assert.equal(JSON.stringify(s.metrics),before);
});
test('automatic close-up also slows a simulation already playing at 0.05 speed',()=>{
  const tour=new CollisionTour(gas(),{speed:.05});
  while(tour.phase==='search')tour.plan(Infinity);
  assert.ok(tour.rate<.05);
  complete(tour);assert.equal(tour.normalSpeed,.05);
});
test('the rebound keeps advancing physical time without an impact pause, with continuous wave age',()=>{
  const s=gas(),tour=new CollisionTour(s);let impactFrames=0,lastAge=0,sawDeparture=false;
  for(let frame=0;frame<1500&&!tour.finished;frame++){
    const phase=tour.phase,before=s.time;
    tour.tick(1/60,h=>{s.step(h);return h;},Infinity);
    if(phase==='impact'){
      assert.ok(tour.rate>0);assert.ok(s.time>before,'the particles must keep moving through the rebound');impactFrames++;
    }
    if(tour.event){assert.ok(tour.view.impactAge>=lastAge);lastAge=tour.view.impactAge;}
    if(phase==='impact'&&tour.phase==='departure'){assert.ok(tour.view.impactAge>=.9);sawDeparture=true;}
  }
  assert.ok(impactFrames>30);assert.ok(sawDeparture);assert.equal(tour.phase,'done');close(s.metrics.balancePressureError,0);
});
require('../dist/units.js');
require('../dist/graphics.js');
test('the zoom camera keeps laboratory landmarks fixed while the piston translates in both directions',()=>{
  const {chamberCamera}=globalThis.LabGraphics;
  for(const direction of [-1,1])for(const zoom of [.4,1]){
    const sim=gas(),tour={kind:'work',zoom,startWidth:11,target:{wall:'right',x:11+direction*.2,y:3.5,radius:0}};
    const before=chamberCamera(460,285,sim,{tour}),wallBefore=before.X(sim.width);
    sim.width+=direction*.12;
    const after=chamberCamera(460,285,sim,{tour});
    close(after.X(11),before.X(11));close(after.X(7),before.X(7));close(after.Y(3.5),before.Y(3.5));
    close(after.X(sim.width)-wallBefore,direction*.12*before.scale);
    assert.ok(Math.abs(after.X(sim.width)-wallBefore)>5,'piston displacement must be visible at this zoom');
  }
});
test('stationary-wall comparison preserves incident energy and differs from the real outgoing velocity by 2u',()=>{
  for(const targetWidth of [8,15]){
    const s=gas();s.setMotion({targetWidth,duration:10});const tour=new CollisionTour(s,{kind:'work'});
    while(tour.phase==='search')tour.plan(Infinity);
    const e=tour.target,fixed=globalThis.LabGraphics.stationaryReflection(e);
    assert.ok(e.before.vx>.1,'the fixed-wall counterfactual must also be incident');
    close(fixed.energy,e.energyBefore);close(e.after.vx-fixed.vx,2*e.wallVelocity);close(fixed.vy,e.after.vy);
    assert.ok(targetWidth<11?Math.hypot(e.after.vx,e.after.vy)>fixed.speed:Math.hypot(e.after.vx,e.after.vy)<fixed.speed);
  }
});
test('work pauses only after departure to compare exit speeds, then automatically zooms out',()=>{
  const s=gas();s.setMotion({targetWidth:8,duration:10});const tour=new CollisionTour(s,{kind:'work'});
  let snapshot=null,frames=0,phaseBeforeHold=null;
  for(let frame=0;frame<2000&&!tour.finished;frame++){
    const phase=tour.phase;
    tour.tick(1/60,h=>{s.step(h);return h;},Infinity);
    if(tour.phase==='compare'){
      if(!snapshot){snapshot=JSON.stringify({time:s.time,width:s.width,particles:s.particles,metrics:s.metrics,age:tour.impactAge});phaseBeforeHold=phase;}
      assert.equal(JSON.stringify({time:s.time,width:s.width,particles:s.particles,metrics:s.metrics,age:tour.impactAge}),snapshot);
      assert.equal(tour.zoom,1);assert.equal(tour.rate,0);frames++;
    }
  }
  assert.equal(phaseBeforeHold,'departure');assert.ok(frames>=149&&frames<=152);assert.equal(tour.phase,'done');assert.equal(tour.zoom,0);
});
