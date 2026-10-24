import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/units.js';
import '../dist/physics.js';
const U = globalThis.GasUnits, s = U.scales;
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-9*Math.max(1,Math.abs(b)), `${a} ≈ ${b}`);
test('fixed units give 300 K, 1 L, 1 bar and 100 J at the reference state', () => {
  near(U.value('temperature',1.5),300); near(U.value('volume',82.5),1);
  near(U.value('pressure',1500/82.5),1); near(U.value('energy',1500),100);
  near(s.amount*s.R*300,100); near(s.depth*s.length*s.length,s.volume);
  assert.equal(U.value('pressure',null),null); assert.equal(U.text('pressure',null),'—');
});
test('impulse, surface, time, velocity and heat flux conversions are dimensionally consistent', () => {
  near(s.momentum/(s.length*s.depth*s.time),s.pressure);
  near(s.velocity*s.momentum,s.energy);
  near(s.velocity*s.time,s.length);
  near(s.flux*s.length*s.depth*s.time,s.energy);
  near(100*U.value('pressure',4)*U.value('volume',9),U.value('energy',36));
});
test('converted moving-wall work and thermal energy satisfy the same first law', () => {
  const gas = new globalThis.GasSimulation({count:1000,width:11,temperature:1.5,seed:12,observeCollisions:true});
  const initial = gas.metrics.energy;
  gas.setMotion({type:'linear',targetWidth:9,duration:2});
  for(let i=0;i<200;i++) gas.step(.01);
  const m=gas.metrics;
  near(U.value('energy',m.energy-initial),U.value('energy',m.pressureWork+m.heat));
  near(U.value('temperature',m.temperature)*s.nR,U.value('energy',m.energy));
});
