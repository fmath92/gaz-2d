(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const number = (value, digits = 2) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sim = new GasSimulation();
  const chamber = $('chamber'), chart = $('chart');
  let paused = false, direction = 'expansion', chartType = 'time';
  let baseWidth = sim.width, initial = sim.metrics, history = [], nextSample = 0;
  let lastTimestamp = 0, accumulator = 0, lastUi = 0, hadMotion = false;
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
    history.push({ ...m, pressureByWall: { ...m.pressureByWall } });
    if (history.length > 6000) history.shift();
    nextSample = sim.time + 0.1;
  }
  function reset() {
    sim.reset({ count: +$('particles').value, temperature: +$('initialTemperature').value / 100, width: 11, seed: 314159 });
    initial = sim.metrics;
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
  $('particles').addEventListener('input', () => $('particlesValue').value = $('particles').value);
  $('initialTemperature').addEventListener('input', () => $('initialTemperatureValue').value = number(+$('initialTemperature').value / 100));
  $('pause').addEventListener('click', () => setPaused(!paused));
  $('reset').addEventListener('click', reset);
  $('applyInitial').addEventListener('click', reset);
  $('start').addEventListener('click', () => {
    try {
      const target = targetWidth();
      if (freeMode()) {
        sample();
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
    $('graphLegend').innerHTML = chartType === 'time' ? '<span class="legend-v">V / V₀</span><span class="legend-t">T / T₀</span><span class="legend-p">P / P₀</span><span class="graph-caption">Valeurs rapportées à l’état initial</span>' : '<span class="legend-p">Pression mesurée</span><span class="graph-caption">Parcours dans le plan pression–volume</span>';
    chart.setAttribute('aria-label', chartType === 'time' ? 'Évolution des grandeurs mesurées au cours du temps' : 'Parcours de la pression mesurée en fonction du volume');
    drawChart();
  }));
  $('export').addEventListener('click', () => {
    sample();
    const fields = ['time', 'volume', 'pressure', 'pressureIdeal', 'temperature', 'temperatureX', 'temperatureY', 'energy', 'work', 'balanceError', 'pistonVelocity', 'measurementDuration'];
    const headings = ['temps_ut', 'aire_ur2', 'pression_mesuree_ur', 'NkT_sur_V_comparateur_equilibre', 'T_cinetique_ur', 'Tx_ur', 'Ty_ur', 'energie_ur', 'travail_recu_ur', 'ecart_bilan_ur', 'vitesse_piston_ur_par_ut', 'duree_fenetre_ut'];
    const csv = '\uFEFF' + headings.concat(['P_gauche', 'P_piston', 'P_haut', 'P_bas']).join(';') + '\r\n' + history.map(row => fields.map(key => row[key] == null ? '' : row[key].toPrecision(10).replace('.', ',')).concat(['left', 'right', 'top', 'bottom'].map(key => row.pressureByWall[key] == null ? '' : row.pressureByWall[key].toPrecision(10).replace('.', ','))).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'gaz-2d-mesures.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Mesures exportées : unités réduites, pression mesurée et bilan énergétique.');
  });
  function updateReadings() {
    const m = sim.metrics;
    $('pressure').textContent = number(m.pressure);
    $('volume').textContent = number(m.volume, 1);
    $('volumeRatio').textContent = '· ' + number(m.volume / initial.volume) + ' V₀';
    $('temperature').textContent = number(m.temperature);
    $('energy').textContent = number(m.energy, 1);
    $('countLabel').textContent = m.count + ' particules';
    $('time').textContent = 't = ' + number(m.time) + ' u.t.';
    $('windowLabel').textContent = '· fenêtre ' + number(m.measurementDuration, 1) + ' u.t.';
    $('work').textContent = (m.work > 0.005 ? '+' : '') + number(m.work);
    $('balance').textContent = Math.abs(m.balanceError) < 1e-8 ? '≈ 0' : m.balanceError.toExponential(2);
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
  function drawChart() {
    const { ctx, w, h } = setupCanvas(chart);
    const pad = { left: 44, right: 22, top: 14, bottom: 30 };
    const pw = w - pad.left - pad.right, ph = h - pad.top - pad.bottom;
    const start = Math.max(0, sim.time - 60);
    const rows = chartType === 'time' ? history.filter(row => row.time >= start) : history;
    const series = chartType === 'time' ? [
      { color: '#245cdd', get: r => r.volume / initial.volume },
      { color: '#df8b3b', get: r => r.temperature / initial.temperature },
      { color: '#349a87', get: r => r.pressure == null ? null : r.pressure / initial.pressureIdeal }
    ] : [{ color: '#349a87', get: r => r.pressure }];
    let maxY = chartType === 'time' ? 1.5 : initial.pressureIdeal * 1.5;
    let xmin = chartType === 'time' ? start : initial.volume * 0.8;
    let xmax = chartType === 'time' ? Math.max(10, sim.time) : initial.volume * 1.2;
    for (const row of rows) {
      for (const s of series) { const y = s.get(row); if (y != null) maxY = Math.max(maxY, y * 1.12); }
      if (chartType === 'pv') { xmin = Math.min(xmin, row.volume * 0.93); xmax = Math.max(xmax, row.volume * 1.07); }
    }
    maxY = Math.ceil(maxY * 2) / 2;
    const X = value => pad.left + (value - xmin) / (xmax - xmin || 1) * pw;
    const Y = value => pad.top + ph - value / maxY * ph;
    ctx.font = '9px "DM Sans", sans-serif';
    for (let i = 0; i <= 4; i++) {
      const y = maxY * i / 4;
      line(ctx, pad.left, Y(y), w - pad.right, Y(y), '#eaf0f2');
      ctx.textAlign = 'right'; ctx.fillStyle = '#8b9ba5'; ctx.fillText(number(y, maxY > 10 ? 0 : 1), pad.left - 9, Y(y) + 3);
    }
    for (let i = 0; i <= 5; i++) {
      const x = xmin + (xmax - xmin) * i / 5;
      ctx.textAlign = 'center'; ctx.fillStyle = '#8b9ba5'; ctx.fillText(number(x, 0), X(x), h - 12);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(pad.left, pad.top, pw, ph); ctx.clip();
    for (const s of series) {
      ctx.beginPath(); ctx.strokeStyle = s.color; ctx.lineWidth = 1.6;
      let pen = false, last = null;
      for (const row of rows) {
        const value = s.get(row); if (value == null) { pen = false; continue; }
        const x = X(chartType === 'time' ? row.time : row.volume), y = Y(value);
        if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
        last = { x, y };
      }
      ctx.stroke();
      if (last) { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(last.x, last.y, 2.5, 0, 2 * Math.PI); ctx.fill(); }
    }
    ctx.restore();
    ctx.textAlign = 'right'; ctx.fillStyle = '#7a8e9b'; ctx.fillText(chartType === 'time' ? 't (u.t.)' : 'V (u.r.²)', w - pad.right, 10);
    if (chartType === 'pv') { ctx.textAlign = 'left'; ctx.fillText('P (u.r.)', pad.left, 10); }
  }
  function render() { drawChamber(); drawChart(); }
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
    render();
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { lastTimestamp = 0; accumulator = 0; });
  window.addEventListener('resize', render);
  configureTarget(true); sample(); updateReadings(); render(); requestAnimationFrame(frame);
  // Diagnostic en lecture : pratique pour vérifier la simulation depuis la console.
  Object.defineProperty(window, 'gaz2D', { value: { get metrics() { return { ...sim.metrics }; }, get paused() { return paused; } }, writable: false });
})();
