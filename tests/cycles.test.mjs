import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GasCycles: C } = require('../dist/cycles.js');

function measurements(points) {
  let pressureWork = 0, heatIn = 0, heatOut = 0;
  return points.map(([volume, pistonPressure, temperature = 2], i) => {
    if (i) {
      const previous = points[i - 1];
      const dw = -(pistonPressure + previous[1]) / 2 * (volume - previous[0]);
      pressureWork += dw;
      if (-dw > 0) heatIn -= dw; else heatOut -= dw;
    }
    return { time: i, volume, pistonPressure, temperature, pressureWork, heat: heatIn + heatOut, heatIn, heatOut, energy: 10, runId: 1 };
  });
}
const rectangle = [[1, 4], [3, 4], [3, 1], [1, 1], [1, 4]];

test('clockwise P–V rectangle has positive supplied work and negative received work', () => {
  const rows = measurements(rectangle);
  const before = JSON.stringify(rows);
  const summary = C.buildCycleSummary(rows, { complete: true });
  assert.equal(summary.integral, 6);
  assert.equal(summary.workFromDiagram, -6);
  assert.equal(summary.signedAreaReceived, -6);
  assert.equal(summary.work, -6);
  assert.equal(summary.heat, 6);
  assert.equal(summary.heatIn, 8);
  assert.equal(summary.heatOut, -2);
  assert.equal(summary.deltaEnergy, 0);
  assert.equal(summary.balance, 0);
  assert.equal(summary.closedVolume, true);
  assert.equal(summary.closedState, true);
  assert.equal(summary.reason, '');
  assert.equal(JSON.stringify(rows), before);
});

test('reversing a complete rectangle reverses the sign of its work and area', () => {
  const summary = C.buildCycleSummary(measurements(rectangle.slice().reverse()), { complete: true });
  assert.equal(summary.integral, -6);
  assert.equal(summary.work, 6);
  assert.equal(summary.signedAreaReceived, 6);
  assert.equal(summary.heat, -6);
  assert.equal(summary.balance, 0);
});

test('open path retains its path integral without an invented closing segment', () => {
  const summary = C.buildCycleSummary(measurements([[1, 4], [3, 4], [3, 1]]), { complete: true });
  assert.equal(summary.integral, 8);
  assert.equal(summary.closedVolume, false);
  assert.equal(summary.signedAreaReceived, null);
  assert.match(summary.reason, /pas fermé artificiellement/);
  const pending = C.buildCycleSummary(measurements(rectangle));
  assert.equal(pending.integral, 6);
  assert.equal(pending.signedAreaReceived, null);
  assert.match(pending.reason, /en cours/);
});

test('mechanical period returning to V does not prove closure in P and T', () => {
  const rows = measurements([[1, 4, 2], [3, 4, 2], [3, 1, 2], [1, 1, 2], [1, 2, 3]]);
  const summary = C.buildCycleSummary(rows, { complete: true });
  assert.equal(summary.closedVolume, true);
  assert.equal(summary.closedState, false);
  assert.equal(summary.closureGap.pressure, -2);
  assert.equal(summary.closureGap.temperature, 1);
  assert.equal(summary.signedAreaReceived, -6);
  assert.match(summary.reason, /pas revenu au même état/);
});

test('missing or invalid pressure invalidates the estimate, without fabricating an equation of state', () => {
  const rows = measurements(rectangle);
  rows[2].pistonPressure = null;
  const summary = C.buildCycleSummary(rows, { complete: true });
  assert.equal(summary.integral, null);
  assert.equal(summary.workFromDiagram, null);
  assert.equal(summary.signedAreaReceived, null);
  assert.equal(summary.work, -6);
  assert.equal(summary.balance, 0);
  assert.match(summary.reason, /pression mesurée manque/);
  for (const value of [NaN, Infinity, -1]) {
    const invalid = measurements(rectangle); invalid[2].pistonPressure = value;
    assert.equal(C.pathIntegral(invalid).valid, false);
  }
  assert.equal(C.pathIntegral(measurements([[1, 0], [3, 0]])).integral, 0);
});

test('pressure source changes only the plotted integral, not exact mechanical and heat counters', () => {
  const rows = measurements(rectangle).map(row => ({ ...row, pressure: row.pistonPressure * 2 }));
  const summary = C.buildCycleSummary(rows, { pressureKey: 'pressure', complete: true });
  assert.equal(summary.integral, 12);
  assert.equal(summary.work, -6);
  assert.equal(summary.heat, 6);
  assert.equal(summary.balance, 0);
});

test('long gaps, reversed timestamps and different commands are not joined silently', () => {
  const gaps = measurements(rectangle); gaps[2].time += 0.5;
  assert.equal(C.pathIntegral(gaps, { maxGap: 1.1 }).valid, false);
  const reversed = measurements(rectangle); reversed[2].time = reversed[1].time;
  assert.equal(C.pathIntegral(reversed).valid, false);
  const mixed = measurements(rectangle); mixed[2].runId = 2;
  assert.equal(C.pathIntegral(mixed).valid, false);
  for (const rows of [[], [{}], [null, {}]]) assert.equal(C.buildCycleSummary(rows).integral, null);
});

test('first law uses Q even when the gas does not return to its original energy', () => {
  const rows = measurements(rectangle);
  rows.at(-1).energy += 3;
  rows.at(-1).heat += 3;
  rows.at(-1).heatIn += 3;
  const summary = C.buildCycleSummary(rows, { complete: true });
  assert.equal(summary.deltaEnergy, 3);
  assert.equal(summary.heat, 9);
  assert.equal(summary.work, -6);
  assert.equal(summary.balance, 0);
});

test('work-derived step path reproduces the measured work by construction', () => {
  const rows = measurements(rectangle);
  const path = C.workPressurePath(rows);
  assert.equal(path.valid, true);
  assert.deepEqual(path.points, [{ volume: 1, pressure: 4 }, { volume: 3, pressure: 4 }, { volume: 3, pressure: 1 }, { volume: 1, pressure: 1 }]);
  assert.equal(path.integral, 6);
  assert.equal(path.sumWork, -6);
  const reverse = C.workPressurePath(measurements(rectangle.slice().reverse()));
  assert.equal(reverse.sumWork, 6);
  assert.equal(reverse.integral, -6);
});

test('work reconstruction rejects a hidden turning point instead of inventing infinite pressure', () => {
  const rows = measurements([[1, 4], [3, 4], [1, 1]]);
  const collapsed = [rows[0], rows[2]];
  assert.notEqual(collapsed[0].pressureWork, collapsed[1].pressureWork);
  const path = C.workPressurePath(collapsed);
  assert.equal(path.valid, false);
  assert.equal(path.integral, null);
  assert.match(path.reason, /retournements/);
  const fixed = measurements([[1, 4], [1, 2]]);
  assert.equal(C.workPressurePath(fixed).valid, false);
});

test('work reconstruction validates chronology, cumulative work and known sample gaps', () => {
  const rows = measurements(rectangle);
  rows[1].pressureWork = NaN;
  assert.equal(C.workPressurePath(rows).valid, false);
  assert.equal(C.workPressurePath(measurements(rectangle), { maxGap: 0.5 }).valid, false);
  const invalid = measurements(rectangle); invalid[2].volume = 0;
  assert.equal(C.workPressurePath(invalid).valid, false);
  const impossible = measurements([[1, 4], [2, 4]]);
  impossible[1].pressureWork = 2;
  assert.equal(C.workPressurePath(impossible).valid, false);
  assert.match(C.workPressurePath(impossible).reason, /pression effective négative/);
});

test('a manual expansion and compression can explicitly form one cycle across commands and rest', () => {
  const rows = measurements([[1, 4], [3, 4], [3, 3], [3, 1], [1, 1], [1, 4]]);
  for (let i = 0; i < rows.length; i++) rows[i].runId = i <= 1 ? 1 : i <= 3 ? 0 : 2;
  // Rest at fixed V can exchange heat without adding pressure work.
  const energies = [10, 8, 7, 7, 9, 10];
  for (let i = 0; i < rows.length; i++) {
    rows[i].energy = energies[i];
    rows[i].temperature = energies[i] / 10;
    rows[i].heat = energies[i] - energies[0] - rows[i].pressureWork;
  }
  assert.equal(C.pathIntegral(rows).valid, false);
  const summary = C.buildCycleSummary(rows, { complete: true, allowMixedRuns: true });
  assert.equal(summary.valid, true);
  assert.equal(summary.closedVolume, true);
  assert.equal(summary.closedState, true);
  assert.equal(summary.integral, 6);
  assert.equal(summary.work, -6);
  assert.equal(summary.heat, 6);
  assert.equal(summary.balance, 0);
  const reconstructed = C.workPressurePath(rows, { allowMixedRuns: true });
  assert.equal(reconstructed.valid, true);
  assert.equal(reconstructed.integral, 6);
  assert.equal(reconstructed.sumWork, -6);
});

test('free expansion never turns a volume jump into a pressure-work area', () => {
  const rows = measurements([[1, 4], [3, 4]]);
  rows[1].freeExpansion = true;
  rows[1].pressureWork = rows[0].pressureWork;
  assert.equal(C.pathIntegral(rows, { allowMixedRuns: true }).valid, false);
  assert.match(C.pathIntegral(rows).reason, /détente libre/);
  assert.equal(C.buildCycleSummary(rows, { complete: true, allowMixedRuns: true }).signedAreaReceived, null);
  assert.equal(C.workPressurePath(rows, { allowMixedRuns: true }).valid, false);
});
