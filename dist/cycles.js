/* Bilans d'un parcours temporel. Les aires P–V ci-dessous utilisent la pression
 * effectivement mesurée : elles restent des estimations lorsque P est lissée.
 * Une période du piston ne garantit pas le retour du gaz au même état. */
(function (root) {
  'use strict';
  const finite = value => Number.isFinite(value);
  const difference = (first, last, key) => finite(first?.[key]) && finite(last?.[key]) ? last[key] - first[key] : null;
  const close = (a, b, tolerance) => finite(a) && finite(b) && Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
  const relativeGap = (a, b) => finite(a) && finite(b) ? Math.abs(b - a) / Math.max(1e-12, Math.abs(a), Math.abs(b)) : null;

  function checkPath(rows, { pressureKey, maxGap = null, requireWork = false, allowMixedRuns = false } = {}) {
    const samples = Array.from(rows || []);
    if (samples.length < 2) return { samples, reason: 'Au moins deux relevés sont nécessaires pour décrire un parcours.' };
    let runId;
    for (let i = 0; i < samples.length; i++) {
      const row = samples[i];
      if (!row || !finite(row.time) || !finite(row.volume) || row.volume <= 0) return { samples, reason: 'Temps ou volume manquant dans le parcours ; aucun segment n’est ajouté.' };
      if (row.freeExpansion) return { samples, reason: 'Une détente libre ne définit pas un déplacement de piston ; aucune aire mécanique n’est reconstruite sur cette ouverture.' };
      if (!allowMixedRuns && row.runId != null) {
        if (runId == null) runId = row.runId;
        else if (row.runId !== runId) return { samples, reason: 'Le parcours mélange plusieurs commandes du piston.' };
      }
      if (pressureKey && (!finite(row[pressureKey]) || row[pressureKey] < 0)) return { samples, reason: 'Une pression mesurée manque dans le parcours ; l’aire n’est pas estimée.' };
      if (requireWork && !finite(row.pressureWork)) return { samples, reason: 'Le travail cumulé manque dans le parcours.' };
      if (!i) continue;
      const dt = row.time - samples[i - 1].time;
      if (!(dt > 0)) return { samples, reason: 'Les relevés doivent suivre des temps strictement croissants.' };
      if (finite(maxGap) && maxGap > 0 && dt > maxGap) return { samples, reason: 'Un intervalle sans mesure est trop long ; l’aire n’est pas estimée.' };
    }
    return { samples, reason: '' };
  }

  /** Estime ∫P dV par trapèzes, dans l'ordre du parcours ; aucune fermeture
   * ni interpolation à travers une pression absente n'est introduite. */
  function pathIntegral(rows, { pressureKey = 'pistonPressure', maxGap = null, allowMixedRuns = false } = {}) {
    const checked = checkPath(rows, { pressureKey, maxGap, allowMixedRuns });
    if (checked.reason) return { integral: null, workReceivedEstimate: null, points: [], valid: false, reason: checked.reason };
    let integral = 0;
    const points = checked.samples.map(row => ({ volume: row.volume, pressure: row[pressureKey], time: row.time }));
    for (let i = 1; i < points.length; i++) integral += (points[i - 1].pressure + points[i].pressure) / 2 * (points[i].volume - points[i - 1].volume);
    if (!finite(integral)) return { integral: null, workReceivedEstimate: null, points: [], valid: false, reason: 'L’intégrale du parcours n’est pas finie.' };
    return { integral, workReceivedEstimate: -integral, points, valid: true, reason: '' };
  }

  function buildCycleSummary(rows, { complete = false, pressureKey = 'pistonPressure', volumeTolerance = 1e-6, stateTolerance = 0.05, maxGap = null, allowMixedRuns = false } = {}) {
    const samples = Array.from(rows || []), first = samples[0], last = samples[samples.length - 1];
    const work = difference(first, last, 'pressureWork');
    const heat = difference(first, last, 'heat');
    const deltaEnergy = difference(first, last, 'energy');
    const balance = [work, heat, deltaEnergy].every(finite) ? deltaEnergy - work - heat : null;
    const closedVolume = samples.length >= 2 && close(first?.volume, last?.volume, volumeTolerance);
    const closureGap = {
      volume: difference(first, last, 'volume'),
      pressure: difference(first, last, pressureKey),
      temperature: difference(first, last, 'temperature'),
      relativeVolume: relativeGap(first?.volume, last?.volume),
      relativePressure: relativeGap(first?.[pressureKey], last?.[pressureKey]),
      relativeTemperature: relativeGap(first?.temperature, last?.temperature)
    };
    // Ce critère est descriptif, à tolérance donnée ; les fluctuations de P
    // interdisent d'en déduire une identité stricte des états microscopiques.
    const closedState = closedVolume && finite(closureGap.relativePressure) && finite(closureGap.relativeTemperature) && closureGap.relativePressure <= stateTolerance && closureGap.relativeTemperature <= stateTolerance;
    const path = pathIntegral(samples, { pressureKey, maxGap, allowMixedRuns });
    let reason = path.reason;
    if (!reason && !complete) reason = 'Parcours en cours : aucune aire de cycle fermé n’est annoncée.';
    else if (!reason && !closedVolume) reason = 'Le volume n’est pas revenu à sa valeur initiale ; le parcours n’est pas fermé artificiellement.';
    else if (!reason && !closedState) reason = 'Retour du piston au même volume, avec une dérive de pression ou de température : le gaz n’est pas revenu au même état.';
    return {
      startTime: finite(first?.time) ? first.time : null,
      endTime: finite(last?.time) ? last.time : null,
      complete: !!complete, closedVolume, closedState, stateTolerance,
      work, heat, heatIn: difference(first, last, 'heatIn'), heatOut: difference(first, last, 'heatOut'),
      deltaEnergy, balance, closureGap,
      integral: path.integral, workFromDiagram: path.workReceivedEstimate,
      // Si V revient à sa valeur initiale, fermer verticalement dans P–V
      // n'ajoute aucun P dV. La dérive d'état reste signalée ci-dessus.
      signedAreaReceived: complete && closedVolume && path.valid ? path.workReceivedEstimate : null,
      valid: path.valid, points: path.points, reason
    };
  }

  /** Reconstruit une pression mécanique effective par intervalle de volume :
   * Peff = -δW/δV. Cette courbe est DÉDUITE du travail et son aire le retrouve
   * par construction ; elle ne constitue pas une validation indépendante.
   * Les échantillons doivent contenir chaque retournement du piston. */
  function workPressurePath(rows, { volumeTolerance = 1e-10, workTolerance = 1e-10, maxGap = null, allowMixedRuns = false } = {}) {
    const checked = checkPath(rows, { requireWork: true, maxGap, allowMixedRuns });
    const invalid = reason => ({ points: [], integral: null, sumWork: null, valid: false, reason });
    if (checked.reason) return invalid(checked.reason);
    let integral = 0, sumWork = 0;
    const points = [];
    for (let i = 1; i < checked.samples.length; i++) {
      const a = checked.samples[i - 1], b = checked.samples[i];
      const dV = b.volume - a.volume, dW = b.pressureWork - a.pressureWork;
      if (Math.abs(dV) <= volumeTolerance) {
        if (Math.abs(dW) > workTolerance) return invalid('Un travail non nul accompagne un intervalle de volume nul ; ajoutez les retournements du piston aux relevés.');
        continue;
      }
      const pressure = -dW / dV;
      if (!finite(pressure)) return invalid('La pression effective reconstruite n’est pas finie.');
      if (pressure < 0) return invalid('Le travail et le déplacement donnent une pression effective négative ; vérifiez les retournements et les données du parcours.');
      points.push({ volume: a.volume, pressure }, { volume: b.volume, pressure });
      integral += pressure * dV;
      sumWork += dW;
    }
    if (!points.length) return invalid('Aucune variation de volume ne permet de reconstruire une pression effective.');
    return { points, integral, sumWork, valid: true, reason: '' };
  }

  const GasCycles = { pathIntegral, buildCycleSummary, workPressurePath };
  root.GasCycles = GasCycles;
  if (typeof module !== 'undefined' && module.exports) module.exports = { GasCycles };
})(typeof globalThis !== 'undefined' ? globalThis : window);
