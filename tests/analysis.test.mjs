import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GasAnalysis: A } = require('../dist/analysis.js');

test('histogram covers every particle, includes the upper edge and integrates to one', () => {
  const h = A.histogram([0, 0.2, 0.5, 0.8, 1], { bins: 4, max: 1 });
  assert.equal(h.total, 5);
  assert.equal(h.bins.reduce((s, bin) => s + bin.count, 0), 5);
  assert.equal(h.bins.at(-1).count, 2);
  assert.ok(Math.abs(h.bins.reduce((s, bin) => s + bin.density * h.binWidth, 0) - 1) < 1e-14);
  assert.ok(Math.abs(h.mean - 0.5) < 1e-14);
});

test('histograms share supplied bounds and never silently discard overflow', () => {
  const before = A.histogram([0.5, 1], { bins: 3, max: 3 });
  const after = A.histogram([1.2, 2.5], { bins: 3, max: 3 });
  assert.equal(before.binWidth, after.binWidth);
  assert.equal(before.max, after.max);
  const overflow = A.histogram([0, 5], { bins: 4, max: 1 });
  assert.equal(overflow.max, 5);
  assert.equal(overflow.bins.reduce((s, bin) => s + bin.count, 0), 2);
});

test('empty and zero samples are finite; invalid and negative values are omitted', () => {
  for (const values of [[], [0, 0, 0], [NaN, Infinity, -1]]) {
    const h = A.histogram(values);
    assert.ok(Number.isFinite(h.max) && h.max > 0);
    assert.ok(Number.isFinite(h.mean));
    assert.ok(h.bins.every(bin => Number.isFinite(bin.density)));
  }
  assert.equal(A.histogram([0, 1, NaN, -2, Infinity]).total, 2);
});

test('regression recovers the slope, intercept and fit quality without mutating input', () => {
  const points = [{ x: 1, y: 2 }, { x: 2, y: 0 }, { x: 3, y: -2 }, { x: 4, y: -4 }];
  const original = JSON.stringify(points);
  const fit = A.linearRegression(points);
  assert.equal(fit.slope, -2);
  assert.equal(fit.intercept, 4);
  assert.equal(fit.rSquared, 1);
  assert.equal(fit.count, 4);
  assert.equal(JSON.stringify(points), original);
  assert.equal(A.linearRegression([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]), null);
  assert.equal(A.linearRegression([{ x: 1, y: 1 }, { x: 2, y: 2 }]), null);
  assert.equal(A.linearRegression([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]).rSquared, null);
});

function rowsForLeg({ runId = 1, legId = 0, start = 0, duration = 12, gamma = 2 } = {}) {
  return Array.from({ length: Math.round(duration * 10) + 1 }, (_, i) => {
    const time = start + i / 10;
    const volume = 80 * Math.exp(0.025 * i / 10);
    return { runId, legId, legStart: start, moving: true, freeExpansion: false, time, volume,
      pressure: 2700 / volume ** gamma, pistonPressure: 5000 / volume ** gamma,
      measurementDuration: Math.min(time, 2) };
  });
}

test('log fit recovers gamma from measured pressure with non-overlapping windows', () => {
  const result = A.logarithmicFit(rowsForLeg(), { runId: 1, legId: 0 });
  assert.ok(result.points.length > result.fitPoints.length);
  assert.ok(result.fitPoints.length >= 3);
  for (let i = 1; i < result.fitPoints.length; i++) assert.ok(result.fitPoints[i].time - result.fitPoints[i - 1].time >= 2 - 1e-8);
  assert.ok(Math.abs(result.fit.slope + 2) < 1e-12);
  assert.ok(Math.abs(result.fit.intercept - Math.log(2700)) < 1e-12);
  assert.ok(result.fit.rSquared > 0.999999);
  assert.equal(result.reason, '');
  const pistonFit = A.logarithmicFit(rowsForLeg(), { pressureKey: 'pistonPressure' });
  assert.ok(Math.abs(pistonFit.fit.intercept - Math.log(5000)) < 1e-12);
});

test('log fit rejects incomplete or mixed measurement windows, rests and invalid logarithms', () => {
  const rows = rowsForLeg();
  rows.push({ ...rows.at(-1), time: 50, moving: false, volume: 200, pressure: 1000 });
  rows.push({ ...rows.at(-2), time: 60, freeExpansion: true, volume: 300, pressure: 10000 });
  rows.push({ ...rows.at(-3), time: 70, volume: 0 });
  rows.push({ ...rows.at(-4), time: 80, pressure: 0 });
  rows.push({ ...rows.at(-5), time: 90, pressure: -1 });
  rows.push({ ...rows.at(-6), time: 100, measurementDuration: 0.5 });
  const result = A.logarithmicFit(rows, { runId: 1, legId: 0 });
  assert.ok(result.points.every(p => p.time >= 2 && p.time <= 12));
  assert.ok(Math.abs(result.fit.slope + 2) < 1e-12);
});

test('latest leg and run are isolated rather than mixing an oscillation or successive commands', () => {
  const rows = [...rowsForLeg({ gamma: 1 }), ...rowsForLeg({ legId: 1, start: 12, gamma: 2.5 }), ...rowsForLeg({ runId: 2, start: 24, gamma: 1.75 })];
  assert.ok(Math.abs(A.logarithmicFit(rows).fit.slope + 1.75) < 1e-12);
  assert.ok(Math.abs(A.logarithmicFit(rows, { runId: 1 }).fit.slope + 2.5) < 1e-12);
  assert.ok(Math.abs(A.logarithmicFit(rows, { runId: 1, legId: 0 }).fit.slope + 1) < 1e-12);
});

test('short or tiny transformations explain why no exponent can be estimated', () => {
  const short = A.logarithmicFit(rowsForLeg({ duration: 5.9 }));
  assert.equal(short.fit, null);
  assert.match(short.reason, /3 fenêtres/);
  const tinyRows = rowsForLeg().map(row => ({ ...row, volume: 80 + row.time * 1e-5 }));
  const tiny = A.logarithmicFit(tinyRows);
  assert.equal(tiny.fit, null);
  assert.match(tiny.reason, /variation de volume/);
  assert.equal(A.logarithmicFit([]).fit, null);
});
