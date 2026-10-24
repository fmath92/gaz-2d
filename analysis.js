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
    return { slope, intercept, rSquared, count: sample.length };
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

  const GasAnalysis = { histogram, linearRegression, logarithmicFit };
  root.GasAnalysis = GasAnalysis;
  if (typeof module !== 'undefined' && module.exports) module.exports = { GasAnalysis };
})(typeof globalThis !== 'undefined' ? globalThis : window);
