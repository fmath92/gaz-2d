import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { GasSimulation } = createRequire(import.meta.url)('../dist/physics.js');
const close = (a, b, tol = 1e-8) => assert.ok(Math.abs(a-b) < tol, `${a} ≠ ${b}`);
function run(sim, t) { for (let elapsed = 0; elapsed < t - 1e-10; elapsed += 1/30) sim.step(Math.min(1/30, t-elapsed)); }
function validGeometry(sim) {
  const r = sim.radius;
  for (let i=0; i<sim.particles.length; i++) {
    const p = sim.particles[i];
    assert.ok(p.x >= r-1e-8 && p.x <= sim.width-r+1e-8 && p.y >= r-1e-8 && p.y <= sim.height-r+1e-8, `confinement ${p.x}, ${p.y}`);
    for (let j=0;j<i;j++) {
      const q = sim.particles[j];
      assert.ok(Math.hypot(p.x-q.x,p.y-q.y) >= 2*r-1e-8, 'disques sans recouvrement');
    }
  }
}
function isolatedPair() {
  const sim = new GasSimulation({particleModel:'hard-disks',count:10});
  sim.particles.forEach((p,i)=>Object.assign(p,{x:1+i*.4,y:6,vx:0,vy:0}));
  return sim;
}
function energy(sim) { return sim.particles.reduce((s,p)=>s+(p.vx*p.vx+p.vy*p.vy)/2,0); }
test('disques : placement reproductible sans recouvrement de 10 à 1000 particules',()=>{
  for (const count of [10,180,1000]) {
    const sim = new GasSimulation({particleModel:'hard-disks',count,width:3});
    validGeometry(sim); close(sim.metrics.temperature,1.5);
    const duplicate = new GasSimulation({particleModel:'hard-disks',count,width:3});
    assert.deepEqual(sim.particles,duplicate.particles);
    assert.ok(sim.metrics.packingFraction > 0);
  }
});
test('choc frontal exact : échange des vitesses, conservation de E et de la quantité de mouvement',()=>{
  const sim=isolatedPair(),[a,b]=sim.particles;
  Object.assign(a,{x:3,y:3,vx:1,vy:0});Object.assign(b,{x:3.2,y:3,vx:-1,vy:0});
  sim.step(.1);
  close(a.vx,-1);close(b.vx,1);close(a.x,3.02);close(b.x,3.18);
  close(energy(sim),1);close(a.vx+b.vx,0);
  assert.equal(sim.metrics.pairCollisions,1);close(sim.work,0);close(sim.heat,0);
  validGeometry(sim);
});
test('choc oblique : déviation et invariants de la paire',()=>{
  const sim=isolatedPair(),[a,b]=sim.particles;
  Object.assign(a,{x:3,y:3,vx:1,vy:0});Object.assign(b,{x:3.2,y:3.04,vx:0,vy:0});
  const before=energy(sim);sim.step(.2);
  close(a.vx+b.vx,1);close(a.vy+b.vy,0);close(energy(sim),before);
  assert.ok(Math.abs(a.vy)>.1 && Math.abs(b.vy)>.1);
  assert.equal(sim.metrics.pairCollisions,1); validGeometry(sim);
});
test('trajectoires rapides : aucun croisement de disques entre deux pas',()=>{
  const sim=isolatedPair(),[a,b]=sim.particles;
  Object.assign(a,{x:3,y:3,vx:100,vy:0});Object.assign(b,{x:3.2,y:3,vx:-100,vy:0});
  sim.step(.002);close(a.vx,-100);close(b.vx,100);validGeometry(sim);
});
test('chaîne de contacts et rebond : les prédictions périmées sont recalculées',()=>{
  const sim=isolatedPair(),[a,b,c]=sim.particles;
  Object.assign(a,{x:9.9,y:3,vx:10,vy:0});Object.assign(b,{x:10.2,y:3,vx:0,vy:0});Object.assign(c,{x:10.5,y:3,vx:0,vy:0});
  const before=energy(sim);sim.step(.2);close(energy(sim),before);validGeometry(sim);
  assert.ok(sim.metrics.pairCollisions>=4); assert.ok(sim.metrics.collisions>=1);
});
test('enceinte isolée : chocs mutuels sans travail ou chaleur, stabilité pendant 20 u.t.',()=>{
  const sim=new GasSimulation({particleModel:'hard-disks',count:180});
  run(sim,20); validGeometry(sim);close(sim.metrics.balanceError,0);
  close(sim.work,0);close(sim.heat,0);assert.ok(sim.metrics.pairCollisions>100);
});
for (const mode of ['isolated','thermostat']) test(`piston rapide + disques + ${mode} : confinement et premier principe`,()=>{
  const sim = new GasSimulation({particleModel:'hard-disks',count:180,thermal:{mode,temperature:2}});
  sim.setMotion({type:'oscillate',targetWidth:3,duration:.2});
  run(sim,1.6);validGeometry(sim);close(sim.metrics.balanceError,0,1e-6);close(sim.metrics.balancePressureError,0,1e-6);
  assert.ok(sim.metrics.pairCollisions>100);
});
test('1000 disques : compression et confinement à la borne inférieure de volume',()=>{
  const sim=new GasSimulation({particleModel:'hard-disks',count:1000});
  sim.setMotion({type:'linear',targetWidth:3,duration:1});run(sim,1.2);validGeometry(sim);
  close(sim.metrics.balanceError,0,1e-6);assert.ok(sim.metrics.pairCollisions>1000);
});
test('détente libre isolée avec disques durs : E et T restent constantes',()=>{
  const sim = new GasSimulation({particleModel:'hard-disks',width:9});
  const before=sim.metrics;sim.freeExpand(18);run(sim,5);validGeometry(sim);
  close(sim.metrics.energy,before.energy);close(sim.metrics.temperature,before.temperature);close(sim.work,0);close(sim.heat,0);
});
test('les collisions rééquilibrent les directions sans changer l’énergie totale',()=>{
  const sim=new GasSimulation({particleModel:'hard-disks',count:500});
  for(const p of sim.particles){p.vx*=Math.sqrt(1.8);p.vy*=Math.sqrt(.2);}
  const before=energy(sim);run(sim,20);close(energy(sim),before,1e-7);
  assert.ok(Math.abs(sim.metrics.temperatureX/sim.metrics.temperatureY-1)<.2);
});
test('changer de modèle se fait lors d’un nouvel état, et les resets le conservent',()=>{
  const sim=new GasSimulation();sim.reset({particleModel:'hard-disks'});run(sim,.3);
  sim.reset();assert.equal(sim.particleModel,'hard-disks');assert.equal(sim.metrics.pairCollisions,0);
  sim.reset({particleModel:'ideal'});assert.equal(sim.radius,0);
  assert.throws(()=>sim.reset({particleModel:'unknown'}));
});

test('variable disk radii preserve non-overlap, energy and the chosen radius in forecasts',()=>{
  for(const radius of [.005,.04,.07]) {
    const sim=new GasSimulation({count:1000,width:11,particleModel:'hard-disks',particleRadius:radius,seed:314159});
    validGeometry(sim);const energy=sim.metrics.energy;
    run(sim,.1);validGeometry(sim);close(sim.metrics.energy,energy,1e-7);
    close(sim.metrics.packingFraction,1000*Math.PI*radius**2/82.5);
    assert.equal(sim.fork().radius,radius);assert.ok(sim.metrics.pairCollisions>0);
  }
  for(const particleRadius of [0,-.01,.071,NaN,Infinity]) assert.throws(()=>new GasSimulation({count:1000,particleModel:'hard-disks',particleRadius}),RangeError);
});

test('mean free path counts complete mutual flights including wall bounces, not initial partial paths',()=>{
  const sim=isolatedPair(),[a,b]=sim.particles;
  Object.assign(a,{x:3,y:3,vx:1,vy:0});Object.assign(b,{x:3.2,y:3,vx:-1,vy:0});
  sim.step(.1);assert.equal(sim.metrics.completedFlights,0);assert.equal(sim.metrics.meanFreePath,null);
  const copy=sim.fork();run(copy,10.81);
  assert.equal(sim.metrics.completedFlights,0);close(sim.particles[0].lastPairTime,.06);
  assert.equal(copy.metrics.completedFlights,2);
  close(copy.metrics.meanFreePath,10.84,1e-7);close(copy.metrics.meanCollisionTime,10.84,1e-7);
  copy.reset({count:10,particleModel:'hard-disks'});assert.equal(copy.metrics.completedFlights,0);assert.equal(copy.metrics.meanFreePath,null);
});

test('window flight metrics exclude warm-up and old endings, with independent forecast storage',()=>{
  const sim=new GasSimulation({count:10,particleModel:'hard-disks'});sim.time=6;
  sim._flightEvents=[
    {start:1,end:5,distance:100,duration:4}, // warm-up start: ignored
    {start:2,end:4,distance:80,duration:2}, // left boundary: ignored
    {start:3,end:5,distance:6,duration:2},
    {start:4,end:6,distance:4,duration:2}
  ];
  const m=sim.metrics;assert.equal(m.windowCompletedFlights,2);
  close(m.windowMeanFreePath,5);close(m.windowMeanCollisionTime,2);
  const copy=sim.fork();copy._flightEvents[2].distance=99;
  assert.equal(sim._flightEvents[2].distance,6);
  sim.time=8;assert.equal(sim.metrics.windowCompletedFlights,0);assert.equal(sim.metrics.windowMeanFreePath,null);
});
test('pressure windows assign boundary impulses to only one recording interval',()=>{
  const sim=new GasSimulation({count:10,particleModel:'hard-disks'});
  sim._events=[{time:2,wall:'right',impulse:9,work:0,heat:0},{time:4,wall:'right',impulse:5,work:0,heat:0}];
  sim.time=4;assert.equal(sim.metrics.impulseByWall.right,5);
  sim.time=6;assert.equal(sim.metrics.impulseByWall.right,0);
});
