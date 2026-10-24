(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const number = (value, digits = 2) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sim = new GasSimulation();
  const chamber = $('chamber'), chart = $('chart');
  let paused = false, direction = 'expansion', chartType = 'time';
  let pressureSource = 'mean', gammaReference = 2, runCounter = 0, currentRun = null;
  let baseWidth = sim.width, initial = sim.metrics, history = [], nextSample = 0;
  let lastTimestamp = 0, accumulator = 0, lastUi = 0, lastPlot = 0, hadMotion = false;
  const particleSnapshot = () => ({ speeds: sim.particles.map(p => Math.hypot(p.vx, p.vy)), energies: sim.particles.map(p => (p.vx ** 2 + p.vy ** 2) / 2) });
  let initialParticles = particleSnapshot();
  const pressureOf = row => pressureSource === 'piston' ? (row.pistonPressure ?? row.pressureByWall.right) : row.pressure;
  function runLeg() {
    if (!currentRun) return { runId: 0, legId: 0, legStart: 0 };
    if (currentRun.type === 'oscillate' && sim.motion) currentRun.legId = Math.floor((sim.time - currentRun.start + 1e-8) / currentRun.duration);
    return { runId: currentRun.id, legId: currentRun.legId, legStart: currentRun.start + currentRun.legId * currentRun.duration };
  }
  function logResult() {
    const leg = runLeg();
    const result = GasAnalysis.logarithmicFit(history, { runId: leg.runId, legId: leg.legId, pressureKey: pressureSource === 'piston' ? 'pistonPressure' : 'pressure', window: 2, minLogSpan: 0.02 });
    if (!currentRun) result.reason = 'Lancez un déplacement lent du piston pour constituer un trajet.';
    if (currentRun && currentRun.type === 'free') result.reason = 'Une détente libre ne suit pas une transformation adiabatique quasi statique : pas d’ajustement de γ.';
    return result;
  }
  const duration = () => 0.2 * Math.pow(600, +$('duration').value / 100);
  const targetWidth = () => Math.max(3, Math.min(18, baseWidth * +$('target').value / 100));
  const freeMode = () => $('motion').value === 'free';
  const motionTexts = {
    linear: 'Le piston se déplace à vitesse constante jusqu’au volume cible.',
    smooth: 'Une demi-cosinus donne un départ et un arrêt sans saut de vitesse.',
    oscillate: 'Le piston fait des allers-retours entre le volume de départ et le volume cible. La durée règle un aller.',
    free: 'Le volume augmente instantanément, sans travail ni changement des vitesses. Ce n’est pas un piston qui recule.'
  };
  function notify(message, error = false) {
    $('notice').textContent = message;
    $('notice').classList.toggle('error', error);
  }
  function configureTarget(resetValue = false) {
    baseWidth = sim.width;
    const expanding = direction === 'expansion';
    // Dépasser légèrement le pourcentage entier permet d'atteindre la butée
    // exacte ; targetWidth borne ensuite la largeur physique à [3, 18].
    const lower = expanding ? Math.min(105, Math.ceil(1800 / baseWidth)) : Math.floor(300 / baseWidth);
    const upper = expanding ? Math.ceil(1800 / baseWidth) : Math.max(lower, 95);
    $('target').min = lower;
    $('target').max = Math.max(lower, upper);
    const proposed = resetValue ? (expanding ? 140 : 70) : +$('target').value;
    $('target').value = Math.max(lower, Math.min(upper, proposed));
    const ratioAt = value => Math.max(3, Math.min(18, baseWidth * value / 100)) / baseWidth;
    $('targetMin').textContent = number(ratioAt(lower)) + ' ×';
    $('targetMax').textContent = number(ratioAt(upper)) + ' ×';
    updateControls();
  }
  function updateControls() {
    const moving = !!sim.motion;
    const free = freeMode();
    const expanding = direction === 'expansion';
    $('expansion').classList.toggle('selected', expanding);
    $('compression').classList.toggle('selected', !expanding);
    $('expansion').setAttribute('aria-pressed', String(expanding));
    $('compression').setAttribute('aria-pressed', String(!expanding));
    $('motionHelp').textContent = motionTexts[$('motion').value];
    $('durationField').hidden = free;
    $('durationValue').value = number(duration(), 1) + ' u.t.';
    const ratio = targetWidth() / baseWidth;
    $('targetValue').value = number(ratio, Math.abs(ratio - 1) < 0.01 && ratio !== 1 ? 3 : 2) + ' × V départ';
    $('speedEstimate').textContent = 'Vitesse moyenne |u| = ' + number(Math.abs(targetWidth() - baseWidth) / duration()) + ' u.r. / u.t.';
    $('start').innerHTML = (free ? 'Ouvrir la cavité' : $('motion').value === 'oscillate' ? 'Lancer les allers-retours' : expanding ? 'Lancer la détente' : 'Lancer la compression') + ' <span aria-hidden="true">↗</span>';
    const possible = expanding ? baseWidth < 17.999 : baseWidth > 3.001;
    $('start').disabled = moving || !possible || Math.abs(targetWidth() - baseWidth) < 0.001;
    $('stop').disabled = !moving;
    for (const id of ['expansion', 'compression', 'motion', 'target', 'duration']) $(id).disabled = moving;
    $('motion').querySelector('[value="free"]').disabled = !expanding;
    if (!possible && !moving) notify('Le piston a atteint la limite. Changez le sens de la transformation.');
  }
  function setDirection(value) {
    direction = value;
    if (value === 'compression' && freeMode()) $('motion').value = 'linear';
    configureTarget(true);
  }
  function setPaused(value) {
    paused = value;
    lastTimestamp = 0;
    accumulator = 0;
    $('pauseText').textContent = paused ? 'Reprendre' : 'Pause';
    $('pauseIcon').textContent = paused ? '▶' : 'Ⅱ';
    $('pause').setAttribute('aria-label', paused ? 'Reprendre la simulation' : 'Mettre la simulation en pause');
    $('status').innerHTML = '<i></i>' + (paused ? 'En pause' : 'En cours');
    $('status').classList.toggle('paused', paused);
  }
  function sample() {
    const m = sim.metrics;
    history.push({ ...m, pistonPressure: m.pressureByWall.right, pressureByWall: { ...m.pressureByWall }, ...runLeg(), moving: !!sim.motion, freeExpansion: currentRun?.type === 'free' });
    if (history.length > 6000) history.shift();
    nextSample = sim.time + 0.1;
  }
  function reset() {
    const count = Number($('particleNumber').value);
    if (!Number.isInteger(count) || count < 10 || count > 1000) { notify('Choisissez un nombre entier de particules entre 10 et 1 000.', true); return; }
    sim.reset({ count, temperature: +$('initialTemperature').value / 100, width: 11, seed: 314159 });
    initial = sim.metrics;
    initialParticles = particleSnapshot();
    currentRun = null;
    runCounter = 0;
    history = [];
    nextSample = 0;
    hadMotion = false;
    sample();
    configureTarget(true);
    setPaused(false);
    notify('Nouvel état initial. Les mesures et le travail cumulé repartent de zéro.');
    updateReadings();
    render();
  }
  $('expansion').addEventListener('click', () => setDirection('expansion'));
  $('compression').addEventListener('click', () => setDirection('compression'));
  for (const id of ['target', 'duration', 'motion']) $(id).addEventListener('input', updateControls);
  $('particles').addEventListener('input', () => {
    $('particlesValue').value = $('particles').value;
    $('particleNumber').value = $('particles').value;
    $('applyInitial').disabled = false;
    $('particleNumber').setAttribute('aria-invalid', 'false');
  });
  $('particleNumber').addEventListener('input', () => {
    const n = Number($('particleNumber').value);
    const valid = Number.isInteger(n) && n >= 10 && n <= 1000;
    $('applyInitial').disabled = !valid;
    $('particleNumber').setAttribute('aria-invalid', String(!valid));
    if (valid) { $('particles').value = n; $('particlesValue').value = n; }
  });
  $('initialTemperature').addEventListener('input', () => $('initialTemperatureValue').value = number(+$('initialTemperature').value / 100));
  $('pause').addEventListener('click', () => setPaused(!paused));
  $('reset').addEventListener('click', reset);
  $('applyInitial').addEventListener('click', reset);
  $('start').addEventListener('click', () => {
    try {
      const target = targetWidth();
      sample();
      currentRun = { id: ++runCounter, type: $('motion').value, start: sim.time, legId: 0, duration: duration() };
      if (freeMode()) {
        sim.freeExpand(target);
        sample();
        notify('Détente libre : l’espace augmente sans travail. L’énergie cinétique est conservée.');
        configureTarget(true);
      } else {
        sim.setMotion({ type: $('motion').value, targetWidth: target, duration: duration() });
        hadMotion = true;
        notify($('motion').value === 'oscillate' ? 'Allers-retours en cours. Le travail cumulé tient compte de chaque choc sur le piston.' : 'Transformation en cours. Le travail reçu est positif si le gaz gagne de l’énergie.');
      }
      setPaused(false);
      updateControls();
      updateReadings();
    } catch (error) { notify(error.message, true); }
  });
  $('stop').addEventListener('click', () => {
    sample();
    sim.stopMotion();
    hadMotion = false;
    configureTarget(true);
    notify('Piston arrêté. Les particules continuent à se déplacer dans le volume atteint.');
    updateReadings();
  });
  document.querySelectorAll('[data-chart]').forEach(button => button.addEventListener('click', () => {
    chartType = button.dataset.chart;
    document.querySelectorAll('[data-chart]').forEach(other => {
      other.classList.toggle('selected', other === button);
      other.setAttribute('aria-pressed', String(other === button));
    });
    updateGraphLabels();
    drawChart();
  }));
  $('pressureSource').addEventListener('input', () => {
    pressureSource = $('pressureSource').value;
    updateGraphLabels(); updateReadings(); drawChart();
  });
  $('gamma').addEventListener('input', () => {
    const value = Number($('gamma').value);
    const valid = Number.isFinite(value) && value >= 0.1 && value <= 5;
    $('gamma').setAttribute('aria-invalid', String(!valid));
    if (valid) { gammaReference = value; drawChart(); }
  });
  $('export').addEventListener('click', () => {
    sample();
    const fields = ['time', 'volume', 'pressure', 'pistonPressure', 'pressureIdeal', 'temperature', 'temperatureX', 'temperatureY', 'energy', 'work', 'pressureWork', 'pressurePower', 'balancePressureError', 'pistonVelocity', 'measurementDuration', 'runId', 'legId'];
    const headings = ['temps_ut', 'aire_ur2', 'pression_moyenne_parois_ur', 'pression_piston_ur', 'NkT_sur_V_comparateur_equilibre', 'T_cinetique_ur', 'Tx_ur', 'Ty_ur', 'energie_ur', 'travail_collisions_ur', 'travail_pression_recu_ur', 'puissance_pression_ur_par_ut', 'ecart_bilan_ur', 'vitesse_piston_ur_par_ut', 'duree_fenetre_ut', 'transformation_id', 'trajet_id'];
    const numeric = value => value == null || !Number.isFinite(value) ? '' : value.toPrecision(10).replace('.', ',');
    const csv = '\uFEFF' + headings.concat(['P_gauche', 'P_haut', 'P_bas', 'pression_selectionnee_ur', 'PV_ur', 'ln_V', 'ln_P_selectionnee', 'gamma_reference', 'PV_puissance_gamma', 'en_mouvement', 'detente_libre', 'debut_trajet_ut', 'source_pression']).join(';') + '\r\n' + history.map(row => {
      const p = pressureOf(row);
      const derived = [p, p == null ? null : p * row.volume, Math.log(row.volume), p > 0 ? Math.log(p) : null, gammaReference, p > 0 ? p * row.volume ** gammaReference : null, row.moving ? 1 : 0, row.freeExpansion ? 1 : 0, row.legStart];
      return fields.map(key => numeric(row[key])).concat(['left', 'top', 'bottom'].map(key => numeric(row.pressureByWall[key])), derived.map(numeric), pressureSource).join(';');
    }).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'gaz-2d-mesures.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Mesures exportées : unités réduites, pression mesurée et bilan énergétique.');
  });
  function updateReadings() {
    const m = sim.metrics;
    $('pressure').textContent = number(pressureOf(m));
    $('pressureLabel').textContent = pressureSource === 'piston' ? 'Pression au piston' : 'Pression moyenne';
    $('pressureCaption').textContent = pressureSource === 'piston' ? 'Impulsions sur le piston' : 'Impulsions sur les parois';
    $('volume').textContent = number(m.volume, 1);
    $('volumeRatio').textContent = '· ' + number(m.volume / initial.volume) + ' V₀';
    $('temperature').textContent = number(m.temperature);
    $('energy').textContent = number(m.energy, 1);
    $('countLabel').textContent = m.count + ' particules';
    $('time').textContent = 't = ' + number(m.time) + ' u.t.';
    $('windowLabel').textContent = '· fenêtre ' + number(m.measurementDuration, 1) + ' u.t.';
    $('work').textContent = (m.work > 0.005 ? '+' : '') + number(m.work);
    $('pressureWork').textContent = (m.pressureWork > 0.005 ? '+' : '') + number(m.pressureWork);
    $('pressurePower').textContent = number(m.pressurePower);
    $('balance').textContent = Math.abs(m.balancePressureError) < 1e-8 ? '≈ 0' : m.balancePressureError.toExponential(2);
    $('pistonState').textContent = sim.motion ? 'Piston : u = ' + number(m.pistonVelocity) + ' u.r. / u.t.' : 'Piston immobile';
    $('anisotropy').textContent = 'Tₓ = ' + number(m.temperatureX) + ' · Tᵧ = ' + number(m.temperatureY) + ' u.r.';
    $('wallPressures').innerHTML = [['left', 'Gauche'], ['right', 'Piston'], ['top', 'Haut'], ['bottom', 'Bas']].map(([key, label]) => '<div><dt>' + label + '</dt><dd>' + number(m.pressureByWall[key]) + '</dd></div>').join('');
    if (hadMotion && !sim.motion) {
      hadMotion = false;
      configureTarget(true);
      notify('Volume cible atteint. Le piston est immobile ; la pression reste mesurée par les collisions.');
    }
  }
  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = rect.width, h = rect.height;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function line(ctx, x1, y1, x2, y2, color, width = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function drawChamber() {
    const { ctx, w, h } = setupCanvas(chamber);
    const scale = Math.min((w - 78) / 18, (h - 104) / sim.height);
    const ox = 35, oy = (h - sim.height * scale) / 2 - 5;
    const bottom = oy + sim.height * scale, right = ox + sim.width * scale;
    const maxRight = ox + 18 * scale;
    ctx.fillStyle = '#d9e2e7';
    for (let x = 17; x < w; x += 18) for (let y = 16; y < h; y += 18) ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = '#edf4fc'; ctx.fillRect(ox, oy, sim.width * scale, sim.height * scale);
    ctx.fillStyle = '#f5f5f2'; ctx.fillRect(right + 9, oy, Math.max(0, maxRight - right - 9), sim.height * scale);
    // Le rayon est graphique : le moteur simule des particules ponctuelles.
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, sim.width * scale, sim.height * scale); ctx.clip();
    const vectors = $('vectors').checked;
    const speedRef = Math.sqrt(2 * initial.temperature);
    const colors = ['#3273cd', '#3c91cd', '#4baec0', '#86bc9f', '#d6bb61', '#eaa254', '#e37a46'];
    for (const p of sim.particles) {
      const x = ox + p.x * scale, y = bottom - p.y * scale;
      const speed = Math.hypot(p.vx, p.vy);
      const color = colors[Math.min(colors.length - 1, Math.floor(speed / speedRef * 3))];
      if (vectors) {
        const vx = p.vx * scale * 0.18, vy = -p.vy * scale * 0.18;
        line(ctx, x, y, x + vx, y + vy, color + 'b0', 1);
        const angle = Math.atan2(vy, vx), ex = x + vx, ey = y + vy;
        line(ctx, ex, ey, ex - 3 * Math.cos(angle - 0.5), ey - 3 * Math.sin(angle - 0.5), color);
        line(ctx, ex, ey, ex - 3 * Math.cos(angle + 0.5), ey - 3 * Math.sin(angle + 0.5), color);
      }
      ctx.beginPath(); ctx.arc(x, y, w < 500 ? 2.15 : 2.8, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill();
    }
    ctx.restore();
    line(ctx, ox, oy, maxRight, oy, '#aabcc8', 3);
    line(ctx, ox, bottom, maxRight, bottom, '#aabcc8', 3);
    line(ctx, ox, oy, ox, bottom, '#536d80', 5);
    ctx.fillStyle = '#ea965b'; ctx.fillRect(right, oy - 5, 10, bottom - oy + 10);
    ctx.save(); ctx.beginPath(); ctx.rect(right, oy - 5, 10, bottom - oy + 10); ctx.clip();
    for (let y = oy - 15; y < bottom + 15; y += 8) line(ctx, right, y, right + 10, y + 10, '#c8733d', 1);
    ctx.restore();
    line(ctx, right + 10, (oy + bottom) / 2, Math.min(w - 12, maxRight + 17), (oy + bottom) / 2, '#a2b0b9', 8);
    line(ctx, right, oy - 5, right, bottom + 5, '#b66e3c', 1.5);
    ctx.font = '10px "DM Sans", sans-serif'; ctx.fillStyle = '#6c8090';
    ctx.textAlign = 'left'; ctx.fillText('PAROI FIXE', ox, oy - 19);
    ctx.textAlign = 'center';
    const pistonLabelX = Math.max(65, Math.min(w - 55, right + 5));
    ctx.fillStyle = '#b37243'; ctx.fillText('PISTON', pistonLabelX, oy - 19);
    const planned = sim.motion ? sim.motion.targetWidth : targetWidth();
    if (Math.abs(planned - sim.width) > 0.05) {
      const tx = ox + planned * scale;
      ctx.setLineDash([4, 5]); line(ctx, tx, oy + 7, tx, bottom - 7, '#9ba9b670'); ctx.setLineDash([]);
    }
    const dy = bottom + 27;
    line(ctx, ox, dy, right, dy, '#a6b4be');
    line(ctx, ox, dy - 4, ox, dy + 4, '#a6b4be'); line(ctx, right, dy - 4, right, dy + 4, '#a6b4be');
    ctx.fillStyle = '#f9fbfc'; ctx.fillRect((ox + right) / 2 - 31, dy - 8, 62, 16);
    ctx.fillStyle = '#607585'; ctx.fillText('L = ' + number(sim.width), (ox + right) / 2, dy + 3);
  }
  function updateGraphLabels() {
    const legends = {
      time: '<span class="legend-v">V / V₀</span><span class="legend-t">T / T₀</span><span class="legend-p">P / P₀</span>',
      pv: '<span class="legend-p">Pression mesurée</span>',
      pvt: '<span class="legend-p">PV mesuré</span><span class="legend-t">Référence PV = NT</span>',
      log: '<span class="legend-p">Mesures du dernier trajet</span><span class="legend-v">Ajustement</span><span class="legend-t">Référence γ</span>'
    };
    const hints = {
      time: 'Valeurs relatives à l’état initial. P₀ = NT₀/V₀ ; pression moyennée sur les 2 dernières u.t.',
      pv: 'Parcours pression–volume. Le travail est calculé au piston, indépendamment de la pression choisie pour ce tracé.',
      pvt: 'Points : pression mesurée × volume instantané. Droite : NT, référence d’équilibre isotrope. Le lissage de P introduit un retard en régime rapide.',
      log: 'ln(P) en fonction de ln(V), dans les unités réduites. Une loi PVᵞ constante donne une pente −γ.'
    };
    const labels = {
      time: 'Évolution des grandeurs mesurées au cours du temps',
      pv: 'Parcours de la pression mesurée en fonction du volume',
      pvt: 'Produit pression volume mesuré en fonction de la température cinétique',
      log: 'Logarithme de la pression mesurée en fonction du logarithme du volume'
    };
    $('graphLegend').innerHTML = legends[chartType];
    $('chartHint').textContent = hints[chartType];
    $('logAnalysis').hidden = chartType !== 'log';
    chart.setAttribute('aria-label', labels[chartType]);
  }
  function dataRange(values, fallback, zero = false) {
    let min = Infinity, max = -Infinity;
    for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
    if (!Number.isFinite(min)) [min, max] = fallback;
    const span = max - min || Math.max(Math.abs(max) * 0.2, 0.2);
    return [zero ? 0 : min - span * 0.08, max + span * 0.08];
  }
  function plotAxes(ctx, w, h, xr, yr, xLabel, yLabel) {
    const left = 49, right = w - 20, top = 22, bottom = h - 29;
    const X = x => left + (x - xr[0]) / (xr[1] - xr[0]) * (right - left);
    const Y = y => bottom - (y - yr[0]) / (yr[1] - yr[0]) * (bottom - top);
    const tick = (value, span) => Math.abs(value) >= 10000 ? value.toExponential(1) : number(value, span < 1 ? 2 : span < 8 ? 1 : 0);
    ctx.font = '9px system-ui, sans-serif';
    for (let i = 0; i <= 4; i++) {
      const value = yr[0] + (yr[1] - yr[0]) * i / 4;
      line(ctx, left, Y(value), right, Y(value), '#eaf0f2');
      ctx.textAlign = 'right'; ctx.fillStyle = '#82949f'; ctx.fillText(tick(value, yr[1] - yr[0]), left - 7, Y(value) + 3);
    }
    for (let i = 0; i <= 5; i++) {
      const value = xr[0] + (xr[1] - xr[0]) * i / 5;
      ctx.textAlign = 'center'; ctx.fillStyle = '#82949f'; ctx.fillText(tick(value, xr[1] - xr[0]), X(value), h - 10);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = '#637c8d'; ctx.fillText(yLabel, left, 11);
    ctx.textAlign = 'right'; ctx.fillText(xLabel, right, 11);
    return { X, Y, left, right, top, bottom };
  }
  function plotLine(ctx, axes, points, color, { dashed = false, scatter = false, radius = 1.7 } = {}) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.7;
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.beginPath(); let pen = false;
    for (const p of points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { pen = false; continue; }
      const x = axes.X(p.x), y = axes.Y(p.y);
      if (scatter) { ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, 2 * Math.PI); }
      else if (pen) ctx.lineTo(x, y);
      else { ctx.moveTo(x, y); pen = true; }
    }
    if (scatter) ctx.fill(); else ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawChart() {
    const { ctx, w, h } = setupCanvas(chart);
    let series = [], xr, yr, xLabel, yLabel;
    let fitData = null;
    if (chartType === 'time') {
      const start = Math.max(0, sim.time - 60);
      const rows = history.filter(row => row.time >= start);
      series = [
        { color: '#245cdd', points: rows.map(r => ({ x: r.time, y: r.volume / initial.volume })) },
        { color: '#df8b3b', points: rows.map(r => ({ x: r.time, y: r.temperature / initial.temperature })) },
        { color: '#349a87', points: rows.map(r => ({ x: r.time, y: pressureOf(r) == null ? NaN : pressureOf(r) / initial.pressureIdeal })) }
      ];
      xr = [start, Math.max(10, sim.time)];
      yr = dataRange(series.flatMap(s => s.points.map(p => p.y)).concat([1.3]), [0, 1.5], true);
      xLabel = 't (u.t.)'; yLabel = 'Valeurs relatives';
    } else if (chartType === 'log') {
      fitData = logResult();
      series = [{ color: '#349a8755', points: fitData.points, scatter: true }];
      xr = dataRange(fitData.points.map(p => p.x), [Math.log(initial.volume) - 0.2, Math.log(initial.volume) + 0.2]);
      const anchor = fitData.fitPoints[0] || fitData.points[0] || { x: Math.log(initial.volume), y: Math.log(initial.pressureIdeal) };
      series.push({ color: '#df8b3b', dashed: true, points: xr.map(x => ({ x, y: anchor.y - gammaReference * (x - anchor.x) })) });
      if (fitData.fit) series.push({ color: '#245cdd', points: xr.map(x => ({ x, y: fitData.fit.slope * x + fitData.fit.intercept })) });
      series.push({ color: '#349a87', scatter: true, radius: 3, points: fitData.fitPoints });
      yr = dataRange(series.flatMap(s => s.points.map(p => p.y)), [0, 2]);
      xLabel = 'ln(V)'; yLabel = 'ln(P)';
      $('gammaFit').textContent = fitData.fit ? number(-fitData.fit.slope, 3) : '—';
      $('fitR2').textContent = fitData.fit ? (fitData.fit.rSquared == null ? 'non défini' : number(fitData.fit.rSquared, 3)) : '—';
      let spread = null;
      if (fitData.fitPoints.length >= 3) {
        const logs = fitData.fitPoints.map(p => p.y + gammaReference * p.x);
        const max = Math.max(...logs), constants = logs.map(value => Math.exp(value - max));
        spread = (Math.max(...constants) - Math.min(...constants)) / (constants.reduce((sum, value) => sum + value, 0) / constants.length) * 100;
      }
      $('invariantSpread').textContent = spread == null ? '—' : number(spread, 1) + ' %';
      $('fitStatus').textContent = fitData.fit ? fitData.fit.count + ' fenêtres non recouvrantes sur le dernier trajet. Pente mesurée = ' + number(fitData.fit.slope, 3) + '. Variation = (max − min) / moyenne de PVᵞ.' : fitData.reason;
    } else {
      const rows = history.filter(r => pressureOf(r) != null);
      const pvt = chartType === 'pvt';
      const points = rows.map(r => ({ x: pvt ? r.temperature : r.volume, y: pressureOf(r) * (pvt ? r.volume : 1) }));
      series = [{ color: pvt ? '#349a8788' : '#349a87', points, scatter: pvt }];
      xr = dataRange(points.map(p => p.x), pvt ? [initial.temperature * 0.8, initial.temperature * 1.2] : [initial.volume * 0.8, initial.volume * 1.2], pvt);
      if (pvt) series.unshift({ color: '#df8b3b', dashed: true, points: xr.map(x => ({ x, y: sim.count * x })) });
      yr = dataRange(series.flatMap(s => s.points.map(p => p.y)), [0, pvt ? initial.energy * 1.3 : initial.pressureIdeal * 1.3], true);
      xLabel = pvt ? 'T cinétique (u.r.)' : 'V (u.r.²)';
      yLabel = pvt ? 'PV (u.r.)' : 'P (u.r.)';
    }
    const axes = plotAxes(ctx, w, h, xr, yr, xLabel, yLabel);
    ctx.save(); ctx.beginPath(); ctx.rect(axes.left, axes.top, axes.right - axes.left, axes.bottom - axes.top); ctx.clip();
    for (const s of series) plotLine(ctx, axes, s.points, s.color, s);
    ctx.restore();
  }
  function drawHistogram(canvas, values, reference, xLabel) {
    const max = Math.max(...values, ...reference, 1e-9) * 1.04;
    const current = GasAnalysis.histogram(values, { bins: 18, max });
    const original = GasAnalysis.histogram(reference, { bins: 18, max });
    const { ctx, w, h } = setupCanvas(canvas);
    const top = Math.max(...current.bins.map(b => b.density), ...original.bins.map(b => b.density), 1e-9) * 1.15;
    const axes = plotAxes(ctx, w, h, [0, max], [0, top], xLabel, 'Densité');
    ctx.save(); ctx.beginPath(); ctx.rect(axes.left, axes.top, axes.right - axes.left, axes.bottom - axes.top); ctx.clip();
    for (const b of current.bins) {
      ctx.fillStyle = '#4c83df99';
      ctx.fillRect(axes.X(b.min) + 1, axes.Y(b.density), Math.max(0, axes.X(b.max) - axes.X(b.min) - 2), axes.Y(0) - axes.Y(b.density));
    }
    // Courbe en escalier : densité de l'instant initial, avec les mêmes classes.
    const step = [];
    for (const b of original.bins) step.push({ x: b.min, y: b.density }, { x: b.max, y: b.density });
    plotLine(ctx, axes, step, '#d78a43', { dashed: true });
    ctx.restore();
    return current;
  }
  function drawDistributions() {
    const current = particleSnapshot();
    const speed = drawHistogram($('speedHistogram'), current.speeds, initialParticles.speeds, '|v| (u.r. / u.t.)');
    const energy = drawHistogram($('energyHistogram'), current.energies, initialParticles.energies, 'Ec (u.r.)');
    $('meanSpeed').textContent = '⟨|v|⟩ = ' + number(speed.mean);
    $('meanEnergy').textContent = '⟨Ec⟩ = ' + number(energy.mean);
    $('distributionCount').textContent = sim.count.toLocaleString('fr-FR') + ' particules';
  }
  function render() { drawChamber(); drawChart(); drawDistributions(); }
  function frame(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const elapsed = Math.min(0.06, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;
    if (!paused && !document.hidden) {
      accumulator += elapsed;
      while (accumulator >= 1 / 120) {
        sim.step(1 / 120); accumulator -= 1 / 120;
        if (sim.time >= nextSample) sample();
      }
    }
    if (timestamp - lastUi > 100) { updateReadings(); lastUi = timestamp; }
    drawChamber();
    if (timestamp - lastPlot > 100) { drawChart(); drawDistributions(); lastPlot = timestamp; }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { lastTimestamp = 0; accumulator = 0; });
  window.addEventListener('resize', render);
  configureTarget(true); sample(); updateGraphLabels(); updateReadings(); render(); requestAnimationFrame(frame);
  // Diagnostic en lecture : pratique pour vérifier la simulation depuis la console.
  Object.defineProperty(window, 'gaz2D', { value: { get metrics() { return { ...sim.metrics }; }, get paused() { return paused; }, get analysis() { return { chartType, pressureSource, gammaReference, ...runLeg(), logarithmic: logResult() }; } }, writable: false });
})();
