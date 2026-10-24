import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GasSimulation } = require('../dist/physics.js');

function run(sim, seconds, step = 1 / 30) {
  for (let t = 0; t < seconds - 1e-9; t += step) sim.step(Math.min(step, seconds - t));
}
function confined(sim) {
  for (const p of sim.particles) {
    assert.ok(p.x >= -1e-8 && p.x <= sim.width + 1e-8, `x=${p.x}, largeur=${sim.width}`);
    assert.ok(p.y >= -1e-8 && p.y <= sim.height + 1e-8, `y=${p.y}`);
    assert.ok(Number.isFinite(p.vx) && Number.isFinite(p.vy));
  }
}
function balanced(sim) {
  assert.ok(Math.abs(sim.metrics.balanceError) < Math.max(1e-8, sim.metrics.energy * 1e-11), `Bilan : ${sim.metrics.balanceError}`);
  assert.ok(Math.abs(sim.metrics.balancePressureError) < Math.max(1e-8, sim.metrics.energy * 1e-11), `Bilan pression : ${sim.metrics.balancePressureError}`);
  assert.ok(Math.abs(sim.metrics.pressureWorkError) < Math.max(1e-8, sim.metrics.energy * 1e-11), `Écart des travaux : ${sim.metrics.pressureWorkError}`);
}
function singleMovingParticle(options = {}) {
  // Les autres particules sont immobiles : la collision analytique reste isolée
  // tout en respectant le nombre minimal de particules du démonstrateur.
  const sim = new GasSimulation({ ...options, count: 10 });
  for (const p of sim.particles) Object.assign(p, { x: sim.width / 2, y: sim.height / 2, vx: 0, vy: 0 });
  return sim;
}

test('initialisation reproductible et isotrope ; aucune pression fabriquée avant mesure', () => {
  const a = new GasSimulation({ seed: 11 }), b = new GasSimulation({ seed: 11 });
  assert.deepEqual(a.particles, b.particles);
  assert.equal(a.metrics.pressure, null);
  assert.equal(a.metrics.pressureByWall.left, null);
  assert.ok(Math.abs(a.metrics.energy - 270) < 1e-10);
  assert.ok(Math.abs(a.metrics.temperatureX - a.metrics.temperatureY) < 1e-12);
  assert.equal(a.metrics.pressureWork, 0);
  assert.equal(a.metrics.pressurePower, null);
});

test('nombre de particules entier entre 10 et 1000, bornes incluses', () => {
  for (const count of [10, 1000]) {
    const sim = new GasSimulation({ count, temperature: 2 });
    assert.equal(sim.particles.length, count);
    assert.equal(sim.metrics.count, count);
    assert.ok(Math.abs(sim.metrics.energy - 2 * count) < 1e-9);
    sim.step(0.1);
    confined(sim); balanced(sim);
  }
  for (const count of [0, 1, 9, 1001, 2000, 10.5, NaN]) {
    assert.throws(() => new GasSimulation({ count }), /entier compris entre 10 et 1000/);
  }
});

test('enceinte fixe isolée : conservation de l’énergie et confinement', () => {
  const sim = new GasSimulation();
  const initial = sim.metrics.energy;
  run(sim, 50);
  assert.equal(sim.metrics.energy, initial);
  assert.equal(sim.metrics.work, 0);
  assert.ok(sim.metrics.collisions > 1000);
  confined(sim); balanced(sim);
});

test('mesure des impulsions : choc exact sur piston fixe puis sur piston mobile', () => {
  const sim = singleMovingParticle({ width: 10, height: 5, temperature: 1 });
  sim.particles[0] = { x: 9, y: 2, vx: 2, vy: 0 };
  sim.initialEnergy = 2;
  sim.step(0.6);
  assert.ok(Math.abs(sim.particles[0].x - 9.8) < 1e-9);
  assert.equal(sim.particles[0].vx, -2);
  assert.ok(Math.abs(sim.metrics.pressureByWall.right - 4 / (5 * 0.6)) < 1e-9);
  balanced(sim);
  sim.particles[0] = { x: 9, y: 2, vx: 2, vy: 0 };
  sim.initialEnergy = 2;
  sim.setMotion({ type: 'linear', targetWidth: 12, duration: 2 });
  sim.step(1.1);
  assert.ok(Math.abs(sim.particles[0].vx) < 1e-8);
  assert.ok(Math.abs(sim.metrics.work + 2) < 1e-8);
  // J = 2 m (vx-u) = 2 et u = 1 : -J u = -2.
  assert.ok(Math.abs(sim.metrics.pressureWork + 2) < 1e-8);
  assert.ok(Math.abs(sim.metrics.pressurePower + 2 / sim.time) < 1e-8);
  balanced(sim); confined(sim);
});

test('travail de pression analytique en compression et puissance sur fenêtre glissante', () => {
  const sim = singleMovingParticle({ width: 10, height: 5, measurementWindow: 2 });
  sim.particles[0] = { x: 9, y: 2, vx: 2, vy: 0 };
  sim.initialEnergy = 2;
  sim.setMotion({ type: 'linear', targetWidth: 8, duration: 2 });
  sim.step(0.5);
  // u=-1 ; choc à t=1/3 ; J=2(2-(-1))=6 ; -J u=+6.
  assert.ok(Math.abs(sim.particles[0].vx + 4) < 1e-9);
  assert.ok(Math.abs(sim.metrics.pressureWork - 6) < 1e-9);
  assert.ok(Math.abs(sim.metrics.pressurePower - 12) < 1e-9);
  balanced(sim);
  sim.stopMotion();
  assert.ok(Math.abs(sim.metrics.pressurePower - 12) < 1e-9, 'La puissance est une moyenne historique, pas Pmoyenne × u instantané.');
  sim.step(2.1);
  assert.equal(sim.metrics.pressurePower, 0, 'Le choc sort de la fenêtre de mesure.');
  assert.ok(Math.abs(sim.metrics.pressureWork - 6) < 1e-9, 'Le travail cumulé conserve les anciens échanges.');
  balanced(sim); confined(sim);
  sim.reset({ count: 10 });
  assert.equal(sim.metrics.pressureWork, 0);
  assert.equal(sim.metrics.pressurePower, null);
});

test('rebonds multiples en un pas et choc dans un coin', () => {
  const sim = singleMovingParticle({ width: 3, height: 3 });
  sim.particles[0] = { x: 1, y: 1, vx: 10000, vy: 10000 };
  sim.initialEnergy = 1e8;
  sim.step(0.02);
  assert.ok(sim.metrics.collisions > 100);
  confined(sim); balanced(sim);
});

for (const type of ['linear', 'smooth']) {
  for (const duration of [0.2, 8]) {
    for (const targetWidth of [4, 17]) {
      test(`${type}, durée ${duration}, cible ${targetWidth} : confinement et travail exact`, () => {
        const sim = new GasSimulation({ width: 11 });
        const before = sim.metrics.energy;
        sim.setMotion({ type, targetWidth, duration });
        assert.equal(sim.width, 11);
        run(sim, duration + 0.1);
        assert.ok(Math.abs(sim.width - targetWidth) < 1e-8);
        assert.equal(sim.motion, null);
        // Une détente très rapide peut ne rencontrer aucune particule.
        assert.ok(targetWidth < 11 ? sim.metrics.energy > before : sim.metrics.energy <= before + 1e-9);
        assert.ok(targetWidth < 11 ? sim.metrics.work > 0 : sim.metrics.work <= 1e-9);
        confined(sim); balanced(sim);
      });
    }
  }
}

test('détente libre : ouverture immédiate, énergie inchangée et aucun travail', () => {
  const sim = new GasSimulation({ width: 5 });
  const before = sim.metrics.energy;
  sim.freeExpand(15);
  assert.equal(sim.width, 15);
  assert.equal(sim.metrics.energy, before);
  run(sim, 30);
  assert.equal(sim.metrics.energy, before);
  assert.equal(sim.metrics.work, 0);
  assert.equal(sim.metrics.pressureWork, 0);
  assert.equal(sim.metrics.pressurePower, 0);
  assert.ok(sim.particles.some(p => p.x > 5));
  assert.throws(() => sim.freeExpand(4), /comprimer/);
  confined(sim); balanced(sim);
});

test('oscillation et inversion en cours de mouvement sans saut de position', () => {
  const sim = new GasSimulation({ width: 8 });
  sim.setMotion({ type: 'oscillate', targetWidth: 15, duration: 2 });
  run(sim, 2);
  assert.ok(Math.abs(sim.width - 15) < 1e-8);
  run(sim, 2);
  assert.ok(Math.abs(sim.width - 8) < 1e-8);
  run(sim, 25);
  confined(sim); balanced(sim);
  const width = sim.width;
  sim.setMotion({ type: 'linear', targetWidth: 4, duration: 2 });
  assert.equal(sim.width, width);
  run(sim, 2.1);
  confined(sim); balanced(sim);
});

test('piston arrêté et dt nul : état identique puis gaz libre de continuer', () => {
  const sim = new GasSimulation();
  sim.setMotion({ type: 'smooth', targetWidth: 5, duration: 4 });
  run(sim, 1);
  sim.stopMotion();
  const width = sim.width;
  const state = structuredClone(sim.particles);
  sim.step(0);
  assert.deepEqual(sim.particles, state);
  run(sim, 3);
  assert.equal(sim.width, width);
  assert.notDeepEqual(sim.particles, state);
  confined(sim); balanced(sim);
});

test('pression issue des chocs : moyenne temporelle proche de NkT/V à l’équilibre', () => {
  const sim = new GasSimulation({ count: 350, temperature: 2, width: 10 });
  let average = 0, samples = 0;
  for (let t = 0; t < 200; t += 0.25) {
    sim.step(0.25);
    if (sim.time > 3) { average += sim.metrics.pressure; samples++; }
  }
  average /= samples;
  const relativeError = Math.abs(average / sim.metrics.pressureIdeal - 1);
  assert.ok(relativeError < 0.02, `Erreur moyenne : ${(100 * relativeError).toFixed(3)} %`);
});

test('fenêtre de pression suit le temps simulé et intègre les longueurs mobiles', () => {
  const sim = new GasSimulation({ measurementWindow: 2 });
  sim.step(0.5);
  assert.ok(Math.abs(sim.metrics.measurementDuration - 0.5) < 1e-9);
  sim.setMotion({ type: 'smooth', targetWidth: 5, duration: 1 });
  run(sim, 3);
  assert.equal(sim.metrics.measurementDuration, 2);
  assert.ok(Object.values(sim.metrics.pressureByWall).every(Number.isFinite));
  assert.ok(sim._segments.every(s => s.end > sim.time - 2));
  assert.ok(sim._events.every(e => e.time >= sim.time - 2 - 1e-10));
  balanced(sim);
});

test('piston qui fuit plus vite que toutes les particules : détente sans choc ni travail', () => {
  const sim = new GasSimulation({ width: 8 });
  const energy = sim.metrics.energy;
  const fastest = Math.max(...sim.particles.map(p => Math.abs(p.vx)));
  const duration = 0.05;
  assert.ok((18 - 8) / duration > fastest);
  sim.setMotion({ type: 'linear', targetWidth: 18, duration });
  sim.step(duration);
  assert.equal(sim.metrics.energy, energy);
  assert.equal(sim.metrics.work, 0);
  assert.equal(sim.metrics.pressureWork, 0);
  assert.equal(sim.metrics.pressureByWall.right, 0);
  confined(sim); balanced(sim);
});

test('réglages thermiques validés sans changement instantané de l’énergie ni des bilans', () => {
  const sim = new GasSimulation();
  const state = structuredClone(sim.particles), before = sim.metrics;
  sim.setThermal({ mode: 'thermostat', temperature: 3, accommodation: 0.4, pistonThermal: false });
  assert.deepEqual(sim.particles, state);
  assert.equal(sim.metrics.energy, before.energy);
  assert.equal(sim.metrics.work, before.work);
  assert.equal(sim.metrics.heat, 0);
  assert.equal(sim.metrics.heatPower, null);
  assert.equal(sim.metrics.thermalMode, 'thermostat');
  assert.equal(sim.metrics.bathTemperature, 3);
  assert.equal(sim.metrics.pistonThermal, false);
  const config = sim.thermal;
  for (const setting of [
    { mode: 'unknown' }, { temperature: 0 }, { temperature: NaN },
    { accommodation: -0.01 }, { accommodation: 1.01 }, { accommodation: Infinity },
    { pistonThermal: 1 }
  ]) assert.throws(() => sim.setThermal(setting));
  assert.equal(sim.thermal, config, 'Un réglage invalide ne modifie pas les conditions aux limites.');
  sim.reset({ count: 40 });
  assert.equal(sim.metrics.thermalMode, 'thermostat');
  assert.equal(sim.metrics.bathTemperature, 3);
  assert.equal(sim.metrics.heat, 0);
  assert.equal(sim.metrics.work, 0);
  balanced(sim);
});

test('chaleur analytique à une paroi fixe et puissance sur fenêtre glissante', () => {
  const sim = singleMovingParticle({ width: 10, height: 5 });
  sim.particles[0] = { x: 0.1, y: 2, vx: -2, vy: 0 };
  sim.initialEnergy = 2;
  sim.setThermal({ mode: 'thermostat', temperature: 1 });
  // Normale émise 2, tangentiel 1 : Ec sortante=2,5, donc Q=+0,5.
  const random = [Math.exp(-2), Math.exp(-0.5), 0];
  sim._thermalRandom = () => random.shift() ?? 0.5;
  sim.step(0.1);
  assert.ok(Math.abs(sim.particles[0].vx - 2) < 1e-12);
  assert.ok(Math.abs(sim.particles[0].vy - 1) < 1e-12);
  assert.ok(Math.abs(sim.metrics.heat - 0.5) < 1e-12);
  assert.ok(Math.abs(sim.metrics.heatByWall.left - 0.5) < 1e-12);
  assert.ok(Math.abs(sim.metrics.heatPower - 5) < 1e-10);
  assert.equal(sim.metrics.work, 0);
  assert.equal(sim.metrics.pressureWork, 0);
  assert.equal(sim.metrics.heatOut, 0);
  assert.ok(Math.abs(sim.metrics.heatIn - 0.5) < 1e-12);
  balanced(sim); confined(sim);
  sim.setThermal({ mode: 'isolated' });
  sim.step(2.1);
  assert.equal(sim.metrics.heatPower, 0);
  assert.ok(Math.abs(sim.metrics.heat - 0.5) < 1e-12);
  balanced(sim); confined(sim);
});

for (const [targetWidth, elapsed, expectedVx, expectedWork, expectedHeat] of [
  [12, 1.1, -1, -3, 2],
  [8, 0.5, -3, 5, -2]
]) {
  test(`piston thermique vers L=${targetWidth} : chaleur dans son référentiel et travail mécanique séparés`, () => {
    const sim = singleMovingParticle({ width: 10, height: 5 });
    sim.particles[0] = { x: 9, y: 2, vx: 2, vy: 0 };
    sim.initialEnergy = 2;
    sim.setThermal({ mode: 'thermostat', temperature: 1, pistonThermal: true });
    const random = [Math.exp(-2), Math.exp(-0.5), 0];
    sim._thermalRandom = () => random.shift() ?? 0.5;
    sim.setMotion({ type: 'linear', targetWidth, duration: 2 });
    sim.step(elapsed);
    assert.ok(Math.abs(sim.particles[0].vx - expectedVx) < 1e-8);
    assert.ok(Math.abs(sim.metrics.work - expectedWork) < 1e-8);
    assert.ok(Math.abs(sim.metrics.pressureWork - expectedWork) < 1e-8);
    assert.ok(Math.abs(sim.metrics.heat - expectedHeat) < 1e-8);
    assert.ok(Math.abs(sim.metrics.heatByWall.right - expectedHeat) < 1e-8);
    assert.ok(Math.abs(sim.metrics.heatPower - expectedHeat / sim.time) < 1e-8);
    assert.ok(Math.abs(sim.metrics.pressurePower - expectedWork / sim.time) < 1e-8);
    assert.ok(Math.abs(sim.metrics.energy - 2 - expectedWork - expectedHeat) < 1e-8);
    balanced(sim); confined(sim);
  });
}

test('piston isolé au milieu de parois thermostatiques : seul le travail intervient au choc', () => {
  const sim = singleMovingParticle({ width: 10, height: 5 });
  sim.particles[0] = { x: 9, y: 2, vx: 2, vy: 0 };
  sim.initialEnergy = 2;
  sim.setThermal({ mode: 'thermostat', temperature: 4, pistonThermal: false });
  sim.setMotion({ type: 'linear', targetWidth: 8, duration: 2 });
  sim.step(0.5);
  assert.ok(Math.abs(sim.metrics.work - 6) < 1e-8);
  assert.equal(sim.metrics.heatByWall.right, 0);
  assert.equal(sim.metrics.heat, 0);
  balanced(sim); confined(sim);
});

test('accommodation nulle : dynamique exactement identique aux parois isolées', () => {
  const isolated = new GasSimulation({ seed: 112 });
  const thermal = new GasSimulation({ seed: 112, thermal: { mode: 'thermostat', temperature: 3, accommodation: 0 } });
  for (const sim of [isolated, thermal]) sim.setMotion({ type: 'oscillate', targetWidth: 5, duration: 1 });
  for (let i = 0; i < 300; i++) { isolated.step(1 / 30); thermal.step(1 / 30); }
  assert.deepEqual(thermal.particles, isolated.particles);
  assert.equal(thermal.metrics.work, isolated.metrics.work);
  assert.equal(thermal.metrics.pressure, isolated.metrics.pressure);
  assert.equal(thermal.metrics.heat, 0);
  balanced(thermal); confined(thermal);
});

test('thermostat reproductible, chaleur signée et changements de température en cours de simulation', () => {
  const options = { count: 180, seed: 43, temperature: 0.5, thermal: { mode: 'thermostat', temperature: 3, accommodation: 0.6 } };
  const a = new GasSimulation(options), b = new GasSimulation(options);
  run(a, 30); run(b, 30);
  assert.deepEqual(a.particles, b.particles);
  assert.equal(a.metrics.heat, b.metrics.heat);
  assert.ok(a.metrics.heat > 0);
  const before = a.metrics;
  a.setThermal({ temperature: 0.3 });
  assert.equal(a.metrics.energy, before.energy);
  assert.equal(a.metrics.heat, before.heat);
  run(a, 50);
  assert.ok(a.metrics.temperature < before.temperature / 2);
  assert.ok(a.metrics.heat < before.heat);
  assert.ok(a.metrics.heatIn > 0 && a.metrics.heatOut < 0);
  assert.ok(Math.abs(a.metrics.heatIn + a.metrics.heatOut - a.metrics.heat) < 1e-8);
  assert.ok(Math.abs(Object.values(a.metrics.heatByWall).reduce((sum, value) => sum + value, 0) - a.metrics.heat) < 1e-8);
  balanced(a); confined(a);
  const heat = a.metrics.heat;
  a.setThermal({ mode: 'isolated' });
  run(a, 10);
  assert.equal(a.metrics.heat, heat);
  assert.equal(a.metrics.heatPower, 0);
  balanced(a);
});

test('parois à température fixe : le gaz du volume relaxe vers Tb, sans biais de flux', () => {
  const temperature = 2;
  const sim = new GasSimulation({ count: 1000, temperature: 0.25, seed: 622, thermal: { mode: 'thermostat', temperature } });
  run(sim, 80);
  let tx = 0, ty = 0, samples = 0;
  for (let i = 0; i < 240; i++) {
    sim.step(0.5);
    tx += sim.metrics.temperatureX; ty += sim.metrics.temperatureY; samples++;
  }
  tx /= samples; ty /= samples;
  assert.ok(Math.abs(tx / temperature - 1) < 0.04, `Tx moyenne=${tx}, Tb=${temperature}`);
  assert.ok(Math.abs(ty / temperature - 1) < 0.04, `Ty moyenne=${ty}, Tb=${temperature}`);
  assert.ok(Math.abs((tx + ty) / (2 * temperature) - 1) < 0.025, `T moyenne=${(tx + ty) / 2}, Tb=${temperature}`);
  assert.equal(sim.metrics.work, 0);
  assert.ok(Math.abs(sim.metrics.energy - sim.initialEnergy - sim.metrics.heat) < 1e-7);
  balanced(sim); confined(sim);
});

test('thermostat et piston périodique rapide : confinement, coins et premier principe', () => {
  for (const seed of [7, 116, 3001]) {
    const sim = new GasSimulation({ count: 500, seed, thermal: { mode: 'thermostat', temperature: 2.5, accommodation: 0.7 } });
    sim.setMotion({ type: 'oscillate', targetWidth: 3.1, duration: 0.08 });
    run(sim, 2, 1 / 60);
    balanced(sim); confined(sim);
    assert.ok(sim.metrics.heatOut < 0, 'Le thermostat évacue une partie de l’énergie apportée par le piston.');
  }
  const corner = singleMovingParticle({ width: 3, height: 3 });
  corner.particles[0] = { x: 1, y: 1, vx: 100, vy: 100 };
  corner.initialEnergy = 10000;
  corner.setThermal({ mode: 'thermostat', temperature: 3 });
  corner.step(0.5);
  balanced(corner); confined(corner);
});
