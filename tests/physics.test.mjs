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
