/* Analyses des mesures réelles : aucune pression n'est reconstruite par PV=NT.
 * Les fenêtres non recouvrantes limitent la corrélation du lissage ; elles ne
 * garantissent pas l'indépendance statistique des états microscopiques. */
(function (root) {
  'use strict';
  function histogram(values, { bins = 18, max = null } = {}) {
    const count = Number.isFinite(bins) ? Math.max(1, Math.min(512, Math.floor(bins))) : 18;
    const sample = Array.from(values || []).filter(value => Number.isFinite(value) && value >= 0);
    let largest = 0, mean = 0;
    for (let i = 0; i < sample.length; i++) {
      largest = Math.max(largest, sample[i]);
      mean += (sample[i] - mean) / (i + 1);
    }
    // Un maximum fourni est élargi si nécessaire : aucune particule n'est
    // perdue dans un débordement, y compris celle exactement à la borne.
    const limit = Math.max(largest, Number.isFinite(max) && max > 0 ? max : 0, largest === 0 && !(max > 0) ? 1 : 1e-12);
    const binWidth = limit / count;
    const result = Array.from({ length: count }, (_, i) => ({
      min: i * binWidth,
      max: i === count - 1 ? limit : (i + 1) * binWidth,
      count: 0,
      density: 0
    }));
    for (const value of sample) result[Math.min(count - 1, Math.floor(value / limit * count))].count++;
    for (const bin of result) bin.density = sample.length ? bin.count / sample.length / binWidth : 0;
    return { bins: result, max: limit, binWidth, total: sample.length, mean };
  }

  function linearRegression(points) {
    const sample = Array.from(points || []).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (sample.length < 3) return null;
    let meanX = 0, meanY = 0, xmin = Infinity, xmax = -Infinity;
    for (let i = 0; i < sample.length; i++) {
      meanX += (sample[i].x - meanX) / (i + 1);
      meanY += (sample[i].y - meanY) / (i + 1);
      xmin = Math.min(xmin, sample[i].x); xmax = Math.max(xmax, sample[i].x);
    }
    // Une variation sous la précision relative de x ne définit pas une pente.
    if (xmax - xmin <= 8 * Number.EPSILON * Math.max(1, Math.abs(meanX))) return null;
    let xx = 0, xy = 0, yy = 0;
    for (const p of sample) {
      const dx = p.x - meanX, dy = p.y - meanY;
      xx += dx * dx; xy += dx * dy; yy += dy * dy;
    }
    if (!(xx > 0) || !Number.isFinite(xx + xy + yy)) return null;
    const slope = xy / xx;
    const intercept = meanY - slope * meanX;
    let residual = 0;
    for (const p of sample) residual += ((p.y - meanY) - slope * (p.x - meanX)) ** 2;
    const rSquared = yy > 0 ? Math.max(0, Math.min(1, 1 - residual / yy)) : null;
    const degreesOfFreedom = sample.length - 2;
    const residualVariance = residual / degreesOfFreedom;
    return { slope, intercept, rSquared, count: sample.length, degreesOfFreedom,
      residualSumSquares: residual, residualSD: Math.sqrt(residualVariance),
      slopeSE: Math.sqrt(residualVariance / xx),
      interceptSE: Math.sqrt(residualVariance * (1 / sample.length + meanX * meanX / xx)) };
  }

  // Fit Z = 1 / (1 - a r / V) directly in Z, with b = a r.
  // A single Z(r) curve requires measurements at the same cavity volume.
  function radiusRegression(points) {
    const sample=Array.from(points||[]).filter(p=>p&&Number.isFinite(p.x)&&p.x>=0&&Number.isFinite(p.y)&&Number.isFinite(p.volume)&&p.volume>0);
    const xs=sample.map(p=>p.x).sort((a,b)=>a-b);
    const distinct=xs.filter((x,i)=>!i||x-xs[i-1]>1e-9*Math.max(1,Math.abs(x)));
    if(distinct.length<5)return null;
    const volume=sample[0].volume;
    if(sample.some(p=>Math.abs(p.volume-volume)>1e-9*volume))return null;
    // Positive excluded volume, strictly below the cavity volume at every r.
    const upper=volume/xs.at(-1)*(1-1e-8);
    const predict=(a,r)=>1/(1-a*r/volume);
    const objective=a=>sample.reduce((sum,p)=>sum+(p.y-predict(a,p.x))**2,0);
    let best=0,bestError=objective(0),bestIndex=0;
    for(let i=1;i<=64;i++){const a=upper*i/64,error=objective(a);if(error<bestError){best=a;bestError=error;bestIndex=i;}}
    let lo=upper*Math.max(0,bestIndex-1)/64,hi=upper*Math.min(64,bestIndex+1)/64;
    const g=(Math.sqrt(5)-1)/2;
    let left=hi-g*(hi-lo),right=lo+g*(hi-lo),fl=objective(left),fr=objective(right);
    for(let i=0;i<80;i++){
      if(fl<fr){hi=right;right=left;fr=fl;left=hi-g*(hi-lo);fl=objective(left);}
      else{lo=left;left=right;fl=fr;right=lo+g*(hi-lo);fr=objective(right);}
    }
    const a=(lo+hi)/2,error=objective(a);
    if(error<bestError){best=a;bestError=error;}
    const mean=sample.reduce((sum,p)=>sum+p.y/sample.length,0);
    const total=sample.reduce((sum,p)=>sum+(p.y-mean)**2,0);
    return {a:best,volume,count:sample.length,distinctCount:distinct.length,
      rSquared:sample.every(p=>p.y===sample[0].y)?null:total>0?1-bestError/total:null,
      curve:Array.from({length:101},(_,i)=>{const x=xs[0]+(xs.at(-1)-xs[0])*i/100;return {x,y:predict(best,x)};})};
  }

  function hardDiskCompressibility(phi) {
    return Number.isFinite(phi)&&phi>=0&&phi<1?(1+phi*phi/8)/(1-phi)**2:null;
  }
  // Exact geometric factor for independent finite-radius centers in a rectangle.
  // Multiplying the bulk hard-disk EOS by it is a finite-wall approximation,
  // not an exact interacting-fluid result or a fitted parameter.
  function wallGeometryFactor(radius,width,height) {
    if(![radius,width,height].every(Number.isFinite)||radius<0||width<=2*radius||height<=2*radius)return null;
    return width*height*(width+height-4*radius)/((width-2*radius)*(height-2*radius)*(width+height));
  }
  function radiusTheory(points) {
    const sample=Array.from(points||[]).filter(p=>p&&p.x>0&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&hardDiskCompressibility(p.packing)!=null);
    const xs=sample.map(p=>p.x).sort((a,b)=>a-b),distinct=xs.filter((x,i)=>!i||x-xs[i-1]>1e-9*Math.max(1,Math.abs(x)));
    if(distinct.length<5)return null;
    const coefficient=sample[0].packing/sample[0].x**2;
    if(sample.some(p=>Math.abs(p.packing/p.x**2-coefficient)>1e-8*Math.max(1,coefficient)))return null;
    const geometry=sample.every(p=>wallGeometryFactor(p.x,p.width,p.height)!=null);
    const width=sample[0].width,height=sample[0].height;
    if(geometry&&sample.some(p=>Math.abs(p.width-width)>1e-8*width||Math.abs(p.height-height)>1e-8*height))return null;
    const correction=x=>geometry?wallGeometryFactor(x,width,height):1;
    const predictions=sample.map(p=>hardDiskCompressibility(p.packing)*correction(p.x));
    const mean=sample.reduce((s,p)=>s+p.y/sample.length,0),total=sample.reduce((s,p)=>s+(p.y-mean)**2,0);
    const residual=sample.reduce((s,p,i)=>s+(p.y-predictions[i])**2,0);
    return {model:'Henderson',wallCorrection:geometry,count:sample.length,distinctCount:distinct.length,
      rSquared:sample.every(p=>p.y===sample[0].y)?null:total>0?1-residual/total:null,
      rmse:Math.sqrt(residual/sample.length),bulkCurve:Array.from({length:101},(_,i)=>{const x=xs[0]+(xs.at(-1)-xs[0])*i/100;return {x,y:hardDiskCompressibility(coefficient*x*x)};}),curve:Array.from({length:101},(_,i)=>{const x=xs[0]+(xs.at(-1)-xs[0])*i/100;return {x,y:hardDiskCompressibility(coefficient*x*x)*correction(x)};})};
  }
  function equilibriumReady(blocks,minimumTime=60) {
    const last=blocks.slice(-3);
    if(last.length<3||last.at(-1).end<minimumTime-1e-6)return false;
    if(last.some(b=>!Number.isFinite(b.ratio)||b.ratio<=0||!Number.isFinite(b.anisotropy)))return false;
    const mean=last.reduce((s,b)=>s+b.ratio/3,0);
    return (Math.max(...last.map(b=>b.ratio))-Math.min(...last.map(b=>b.ratio)))/mean<.02&&Math.abs(last.reduce((s,b)=>s+b.anisotropy/3,0))<.03;
  }

  function appendRecord(records, record, limit = 10000) {
    if (records.length >= limit) return false;
    records.push(record); return true;
  }

  function optimalAlpha(records, min = 0, max = 5) {
    let numerator = 0, denominator = 0, count = 0;
    for (const r of records) if (Number.isFinite(r.ratio) && Number.isFinite(r.packing) && r.packing > 0) {
      const q = r.ratio * r.packing;
      numerator += q * (r.ratio - 1); denominator += q * q; count++;
    }
    if (!(denominator > 0)) return null;
    const unconstrained = numerator / denominator;
    const alpha = Math.max(min,Math.min(max,unconstrained));
    let error = 0;
    for (const r of records) if (Number.isFinite(r.ratio) && Number.isFinite(r.packing) && r.packing > 0) error += (r.ratio*(1-alpha*r.packing)-1)**2;
    return {alpha,unconstrained,count,rmse:Math.sqrt(error/count),bounded:alpha!==unconstrained};
  }

  function logarithmicFit(rows, { runId, legId, pressureKey = 'pressure', window = 2, minLogSpan = 0.02 } = {}) {
    const source = Array.from(rows || []);
    const measurementWindow = Number.isFinite(window) && window > 0 ? window : 2;
    const requiredSpan = Number.isFinite(minLogSpan) && minLogSpan > 0 ? minLogSpan : 0.02;
    // Sans identifiants explicites, sélectionner le dernier trajet disponible,
    // jamais concaténer l'ensemble des allers et des retours d'une oscillation.
    const candidate = source.slice().reverse().find(row => row && row.moving && !row.freeExpansion && (runId == null || row.runId === runId) && (legId == null || row.legId === legId));
    const selectedRun = runId ?? candidate?.runId;
    const selectedLeg = legId ?? candidate?.legId;
    const empty = reason => ({ points: [], fitPoints: [], fit: null, reason });
    if (selectedRun == null || selectedLeg == null) return empty('Lancez une détente ou une compression pour recueillir un trajet.');
    const trajectory = source.filter(row => row && row.runId === selectedRun && row.legId === selectedLeg && row.moving && !row.freeExpansion);
    if (!trajectory.length) return empty('Aucun trajet de piston exploitable ; une détente libre ne définit pas une courbe adiabatique quasi statique.');
    const points = trajectory.filter(row => Number.isFinite(row.time) && Number.isFinite(row.legStart) && row.time - row.legStart >= measurementWindow - 1e-8 && row.measurementDuration >= measurementWindow - 1e-8 && Number.isFinite(row.volume) && row.volume > 0 && Number.isFinite(row[pressureKey]) && row[pressureKey] > 0)
      .sort((a, b) => a.time - b.time)
      .map(row => ({ x: Math.log(row.volume), y: Math.log(row[pressureKey]), time: row.time, volume: row.volume, pressure: row[pressureKey] }));
    const fitPoints = [];
    for (const point of points) if (!fitPoints.length || point.time - fitPoints[fitPoints.length - 1].time >= measurementWindow - 1e-8) fitPoints.push(point);
    if (fitPoints.length < 3) return { points, fitPoints, fit: null, reason: 'Au moins 3 fenêtres de pression non recouvrantes sont nécessaires sur un même trajet. Ralentissez le piston (durée supérieure à 6 u.t.).' };
    const logs = fitPoints.map(point => point.x);
    if (Math.max(...logs) - Math.min(...logs) < requiredSpan) return { points, fitPoints, fit: null, reason: 'La variation de volume est trop faible pour estimer une pente. Augmentez l’amplitude du trajet.' };
    const fit = linearRegression(fitPoints);
    return { points, fitPoints, fit, reason: fit ? '' : 'Les mesures ne permettent pas de déterminer une pente finie.' };
  }

  const GasAnalysis = { histogram, linearRegression, appendRecord, optimalAlpha, logarithmicFit, radiusRegression, hardDiskCompressibility, radiusTheory, wallGeometryFactor, equilibriumReady };
  root.GasAnalysis = GasAnalysis;
  if (typeof module !== 'undefined' && module.exports) module.exports = { GasAnalysis };
})(typeof globalThis !== 'undefined' ? globalThis : window);
