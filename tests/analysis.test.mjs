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

test('OLS standard uncertainties agree with an analytic noisy fixture',()=>{
  const f=A.linearRegression([{x:0,y:1},{x:1,y:2},{x:2,y:2},{x:3,y:4}]);
  const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
  close(f.slope,.9);close(f.intercept,.9);close(f.residualSumSquares,.7);
  close(f.slopeSE,Math.sqrt(.07));close(f.interceptSE,Math.sqrt(.245));
  close(f.rSquared,1-.7/4.75);assert.equal(f.degreesOfFreedom,2);
  assert.equal(A.linearRegression([{x:1,y:2},{x:2,y:3}]),null);
  assert.equal(A.linearRegression([{x:1,y:2},{x:1,y:3},{x:1,y:4}]),null);
  const constant=A.linearRegression([{x:0,y:2},{x:1,y:2},{x:2,y:2}]);
  assert.equal(constant.rSquared,null);assert.equal(constant.slopeSE,0);
});
test('alpha optimization minimizes the stated objective, supports bounds and leaves observations untouched',()=>{
  const records=[.01,.03,.08,.15].map(packing=>({packing,ratio:1/(1-2*packing)}));
  const original=JSON.stringify(records),fit=A.optimalAlpha(records);
  assert.ok(Math.abs(fit.alpha-2)<1e-12);assert.ok(fit.rmse<1e-12);
  assert.equal(JSON.stringify(records),original);assert.equal(A.optimalAlpha([]),null);
  assert.equal(A.optimalAlpha([{packing:0,ratio:1}]),null);
  assert.equal(A.optimalAlpha([{packing:.01,ratio:2}]).alpha,5);
});
test('ten thousand records remain retained and all contribute to regression',()=>{
  const rows=[];
  for(let i=0;i<10000;i++) assert.equal(A.appendRecord(rows,{x:i,y:2*i+3}),true);
  assert.equal(A.appendRecord(rows,{x:10000,y:0}),false);
  assert.equal(rows.length,10000);assert.equal(rows[0].x,0);assert.equal(rows.at(-1).x,9999);
  const f=A.linearRegression(rows);assert.equal(f.count,10000);assert.equal(f.slope,2);assert.equal(f.intercept,3);
});


test('radius regression recovers the sole excluded-volume parameter at fixed volume',()=>{
 const points=[.2,.5,.8,1.1,1.4].map(x=>({x,volume:1.2,y:1/(1-.3*x/1.2)}));
 const fit=A.radiusRegression(points);
 assert.ok(Math.abs(fit.a-.3)<1e-8);assert.ok(Math.abs(fit.rSquared-1)<1e-12);
 assert.equal(fit.curve.length,101);assert.equal(fit.curve[0].x,.2);assert.equal(fit.curve.at(-1).x,1.4);
 for(const p of fit.curve)assert.ok(Math.abs(p.y-1/(1-fit.a*p.x/fit.volume))<1e-12);
 assert.equal(A.radiusRegression(points.slice(0,4)),null);
 assert.equal(A.radiusRegression(Array(10).fill(points[0])),null);
 assert.equal(A.radiusRegression([...points.slice(0,4),{x:NaN,y:2,volume:1.2}]),null);
 assert.equal(A.radiusRegression(points.map((p,i)=>({...p,volume:i?1.2:2}))),null);
 assert.equal(A.radiusRegression(points.map(p=>({...p,y:1.234}))).rSquared,null);
 assert.equal(A.radiusRegression(points.map(p=>({...p,y:1}))).a,0);
});
test('excluded-volume fit minimizes ratio residuals, preserves repeats and reports negative R squared',()=>{
 const points=[.2,.5,.8,1.1,1.4].map((x,i)=>({x,volume:1.2,y:1/(1-.3*x/1.2)+[.01,-.02,.03,-.02,.01][i]}));
 const fit=A.radiusRegression(points);
 const error=a=>points.reduce((s,p)=>s+(p.y-1/(1-a*p.x/p.volume))**2,0);
 assert.ok(error(fit.a)<=error(fit.a+.001));assert.ok(error(fit.a)<=error(fit.a-.001));
 const mean=points.reduce((s,p)=>s+p.y,0)/5,total=points.reduce((s,p)=>s+(p.y-mean)**2,0);
 assert.ok(Math.abs(fit.rSquared-(1-error(fit.a)/total))<1e-12);
 assert.equal(A.radiusRegression([...points,points[0]]).count,6);
 const bad=A.radiusRegression(points.map((p,i)=>({...p,y:.5+i*.01})));
 assert.equal(bad.a,0);assert.ok(bad.rSquared<0);
});

test('hard-disk theory uses the occupied area, ideal limit and second virial coefficient',()=>{
 assert.equal(A.hardDiskCompressibility(0),1);
 assert.equal(A.hardDiskCompressibility(-.1),null);assert.equal(A.hardDiskCompressibility(1),null);
 const phi=1e-6;assert.ok(Math.abs((A.hardDiskCompressibility(phi)-1)/phi-2)<1e-5);
 const points=[.2,.5,.8,1.1,1.4].map(x=>({x,packing:.07*x*x,y:A.hardDiskCompressibility(.07*x*x)}));
 const fit=A.radiusTheory(points);assert.equal(fit.model,'Henderson');assert.ok(Math.abs(fit.rSquared-1)<1e-12);assert.equal(fit.rmse,0);
 assert.equal(A.radiusTheory(points.slice(0,4)),null);
 assert.equal(A.radiusTheory(points.map((p,i)=>({...p,packing:p.packing*(i?1:2)}))),null);
});
test('precise equilibrium gate requires elapsed warm-up and stable isotropic windows',()=>{
 const blocks=[20,40,60].map(end=>({end,ratio:1.2,anisotropy:.01}));
 assert.equal(A.equilibriumReady(blocks.slice(0,2)),false);assert.equal(A.equilibriumReady(blocks),true);
 assert.equal(A.equilibriumReady(blocks.map(b=>({...b,anisotropy:.1}))),false);
 assert.equal(A.equilibriumReady(blocks.map((b,i)=>({...b,ratio:i===0?1.3:1.2}))),false);
 assert.equal(A.equilibriumReady([...blocks.slice(0,2),{end:60,ratio:NaN,anisotropy:0}]),false);
});

test('finite-wall factor matches the exact independent-center pressure and corrected theory',()=>{
 const r=.7,L=250,H=170;
 const factor=A.wallGeometryFactor(r,L,H);
 const ideal=L*H/(L+H)*(1/(L-2*r)+1/(H-2*r));
 assert.ok(Math.abs(factor-ideal)<1e-14);assert.equal(A.wallGeometryFactor(0,L,H),1);assert.equal(A.wallGeometryFactor(L,L,H),null);
 const points=[.2,.5,.8,1.1,1.4].map(x=>({x,width:L,height:H,packing:.07*x*x,y:A.hardDiskCompressibility(.07*x*x)*A.wallGeometryFactor(x,L,H)}));
 const fit=A.radiusTheory(points);assert.equal(fit.wallCorrection,true);assert.ok(Math.abs(fit.rSquared-1)<1e-12);assert.ok(fit.curve[50].y>fit.bulkCurve[50].y);
});
