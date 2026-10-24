(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const N = 1000, G = LabGraphics;
  const format = (v, digits = 2) => v == null || !Number.isFinite(v) ? '—' : (Math.abs(v) < 0.5 * Math.pow(10,-digits) ? 0 : v).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = v => v == null ? '—' : (v >= .005 ? '+' : '') + format(v);
  const experiments = {
    pressure: { index: '01', label: 'LES CHOCS FONT LA PRESSION', title: 'Des chocs microscopiques à la pression.', description: 'Suivez une particule jusqu’au piston et observez la poussée au moment du choc.', width: 11, action: 'fixed', source: 'piston', chart: 'time', zoom: false, speed: 1 },
    heat: { index: '02', label: 'LA CHALEUR PASSE PAR LES PAROIS', title: 'Un choc peut réchauffer ou refroidir le gaz.', description: 'Le piston reste fixe. Seule la paroi gauche échange de la chaleur avec un thermostat réglable.', width: 11, action: 'fixed', source: 'mean', chart: 'time', zoom: false, speed: 1 },
    free: { index: '03', label: 'DÉTENTE DE JOULE–GAY–LUSSAC', title: 'Plus de place. La même température ?', description: 'Ouvrez vers le vide, puis regardez le gaz occuper le nouvel espace. Les parois sont isolées.', width: 9, action: 'expansion', source: 'mean', chart: 'time', zoom: false, speed: 1 },
    adiabatic: { index: '04', label: 'LE TRAVAIL DU PISTON', title: 'Détendre ou comprimer : l’énergie change de côté.', description: 'Choisissez le sens du mouvement, puis suivez un choc sur le piston mobile. Les parois sont isolées.', width: 11, action: 'expansion', source: 'mean', chart: 'time', zoom: false, speed: 1 },
    comparison: { index: '05', label: 'POINTS ET DISQUES DURS', title: 'Les collisions changent-elles la loi des gaz parfaits ?', description: 'Deux gaz comparables, calculés simultanément. Les disques se heurtent et occupent une partie du volume.', width: 8, action: 'fixed', source: 'mean', chart: 'ratio', zoom: true, speed: 0.25 }
  };
  const sessions = new Map();
  let active = 'pressure', previousFrame = 0, accumulator = 0, lastUI = 0;
  const session = () => sessions.get(active);
  const states = s => s.other ? [s.sim, s.other] : [s.sim];
  const pressure = (m, s = session()) => s.source === 'piston' ? (m.pistonPressure ?? m.pressureByWall.right) : m.pressure;
  const ratio = (m, s = session()) => pressure(m, s) == null ? null : pressure(m, s) * m.volume / m.temperature;
  const duration = s => 0.2 * Math.pow(600, s.duration / 100);
  const target = s => Math.max(3, Math.min(18, s.baseWidth * s.ratio / 100));
  const snapshots = sim => ({ speeds: sim.particles.map(p => Math.hypot(p.vx, p.vy)), energies: sim.particles.map(p => (p.vx ** 2 + p.vy ** 2) / 2) });
  function createSession(key, previous) {
    const config = experiments[key];
    const s = { key, model: previous?.model || 'ideal', initialTemperature: previous?.initialTemperature || 1.5,
      action: previous?.action ?? config.action, duration: 72, ratio: key === 'free' ? 200 : (previous?.action ?? config.action) === 'compression' ? 70 : 140,
      source: config.source, chart: config.chart, zoom: config.zoom, speed: config.speed, playing: true, vectors: false,
      bath: previous?.bath ?? 3, accommodation: previous?.accommodation ?? 1, allWalls: previous?.allWalls ?? false,
      thermalMode: previous?.thermalMode ?? (key === 'heat' ? 'thermostat' : 'isolated'), profile: previous?.profile || 'linear',
      gamma: previous?.gamma || 2, history: [], nextSample: 0, focus: null, focusAt: -Infinity, seek: null, tour: null, lastTour: null, run: null, runId: 0 };
    const thermal = { mode: key === 'heat' ? s.thermalMode : 'isolated', temperature: s.bath, accommodation: s.accommodation, pistonThermal: s.allWalls, walls: s.allWalls ? ['left', 'right', 'top', 'bottom'] : ['left'] };
    s.sim = new GasSimulation({ count: N, width: config.width, temperature: s.initialTemperature, particleModel: key === 'comparison' ? 'ideal' : s.model, thermal, observeCollisions: true, seed: 314159 });
    s.other = key === 'comparison' ? new GasSimulation({ count: N, width: config.width, temperature: s.initialTemperature, particleModel: 'hard-disks', observeCollisions: true, seed: 314159 }) : null;
    s.initial = s.sim.metrics; s.otherInitial = s.other?.metrics; s.initialParticles = snapshots(s.sim); s.baseWidth = config.width;
    sample(s); return s;
  }
  function sample(s) {
    const run = s.run;
    const m = s.sim.metrics;
    s.history.push({ ...m, pistonPressure: m.pressureByWall.right, other: s.other?.metrics ?? null,
      runId: run?.id ?? 0, legId: 0, legStart: run?.start ?? 0, moving: !!s.sim.motion, freeExpansion: run?.free ?? false });
    if (s.history.length > 6000) s.history.shift();
    s.nextSample = s.sim.time + 0.1;
  }
  function notify(message) { $('notice').textContent = message; }
  function selectExperiment(key, focus = false) {
    if (!experiments[key]) return;
    if (sessions.has(active)) { if (session().tour) cancelIllustration(); session().seek = null; }
    active = key;
    if (!sessions.has(key)) sessions.set(key, createSession(key));
    accumulator = 0; previousFrame = 0;
    document.querySelectorAll('[data-experiment]').forEach(button => {
      const selected = button.dataset.experiment === key;
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    $('workbench').setAttribute('aria-labelledby', 'tab-' + key);
    $('workbench').setAttribute('data-experience', key);
    $('advanced').open = false;
    populateControls(); render();
    notify('Chaque onglet conserve son expérience. Seul le gaz affiché évolue.');
  }
  function reset() {
    sessions.set(active, createSession(active, session()));
    accumulator = 0; previousFrame = 0; populateControls(); render();
    notify('Nouvel état de 1 000 particules. Les mesures de cette expérience repartent de zéro.');
  }
  function populateControls() {
    const s = session(), e = experiments[active];
    $('stepLabel').textContent = e.index + ' / ' + e.label;
    $('experimentTitle').textContent = e.title; $('experimentDescription').textContent = e.description;
    $('singleChamber').hidden = !!s.other; $('comparisonChambers').hidden = !s.other;
    $('pressureLesson').hidden = active !== 'pressure'; $('heatLesson').hidden = active !== 'heat';
    $('comparisonLesson').hidden = !s.other; $('transformationLesson').hidden = active !== 'free'; $('workLesson').hidden = active !== 'adiabatic';
    $('motionChoice').hidden = !['adiabatic', 'comparison'].includes(active);
    $('motionFixedOption').hidden = $('motionFixedOption').disabled = active === 'adiabatic';
    $('heatControls').hidden = active !== 'heat'; $('thermalAdvanced').hidden = active !== 'heat';
    $('singleModelControl').hidden = !!s.other;
    $('microTitle').textContent = s.other ? 'Deux états microscopiques' : active === 'heat' ? 'Le gaz et la paroi gauche' : 'Le gaz et son piston';
    $('zoomTitle').textContent = s.other ? 'Zoom · se traverser ou se heurter' : active === 'heat' ? 'Zoom · un échange sur la paroi gauche' : 'Zoom · une poussée sur le piston';
    $('zoomHint').textContent = s.other ? 'Pointillés : avant · traits pleins : après. À gauche : comparaison illustrative.' : 'Bleu : avant · vert : après. Vitesses relatives à la paroi.';
    $('zoomScale').textContent = 'Schéma d’un choc enregistré';
    $('timeScale').value = s.speed; $('motionAction').value = s.action; $('duration').value = s.duration;
    $('pressureSource').value = s.source; $('extraChart').value = s.chart; $('particleModel').value = s.model;
    $('thermalMode').value = s.thermalMode; $('bathTemperature').value = s.bath * 100; $('accommodation').value = s.accommodation * 100;
    $('allWalls').checked = s.allWalls; $('vectors').checked = s.vectors; $('zoomEnabled').checked = s.zoom;
    $('initialTemperature').value = s.initialTemperature * 100; $('initialTemperatureValue').value = format(s.initialTemperature);
    $('motionProfile').value = s.profile; $('gamma').value = s.gamma;
    $('predictionTitle').textContent = active === 'free' ? 'Sans travail et sans chaleur' : 'L’énergie change par le travail';
    $('predictionText').textContent = active === 'free' ? 'L’ouverture seule ne change aucune vitesse. En mode isolé, W = Q = 0 : la température cinétique reste constante.' : s.action === 'compression' ? 'Le piston apporte de l’énergie au gaz : W > 0. Comme Q = 0, la température augmente.' : 'Lors des chocs, le gaz fournit du travail au piston : W < 0. Comme Q = 0, sa température diminue. Une détente très rapide peut produire très peu de chocs.';
    $('experimentTag').textContent = active === 'free' ? 'W = Q = 0' : 'Q = 0';
    $('microHint').textContent = active === 'free' ? 'L’espace vide se remplit sans travail du piston. Attendez le retour à un état homogène pour interpréter PV/T.' : 'Les flèches de vitesse et le zoom permettent de relier l’évolution de la température aux chocs sur le piston.';
    $('illustrationControls').hidden = !['pressure','heat','adiabatic'].includes(active);
    $('staticZoomControl').hidden = !s.other; $('capture').hidden = !s.other;
    $('illustrate').textContent = active === 'heat' ? '▶ Illustrer les deux sens de la chaleur' : active === 'adiabatic' ? '▶ Illustration du travail sur le piston' : '▶ Illustrer une poussée';
    $('experimentControls').hidden = active === 'pressure'; $('energyBalance').hidden = active === 'pressure';
    $('profileLabel').hidden = $('motionProfile').hidden = ['pressure','heat','free'].includes(active);
    $('nextExperience').textContent = active === 'comparison' ? 'Retour au début de la visite ↻' : 'Étape suivante →';
    updateControls();
  }
  function updateControls() {
    const s = session(), moving = !!s.sim.motion, touring = !!s.tour;
    if (!moving && !(active === 'free' && s.run?.free)) s.baseWidth = s.sim.width;
    const expanding = s.action === 'expansion';
    const min = expanding ? Math.min(105, Math.ceil(1800 / s.baseWidth)) : Math.floor(300 / s.baseWidth);
    const max = expanding ? Math.ceil(1800 / s.baseWidth) : Math.max(min, 95);
    $('target').min = min; $('target').max = max; s.ratio = Math.max(min, Math.min(max, s.ratio)); $('target').value = s.ratio;
    $('targetValue').value = format(target(s) / s.baseWidth) + (active === 'free' ? ' × V initial' : ' × V départ');
    $('durationValue').value = format(duration(s), 1) + ' u.t.';
    $('bathValue').value = format(s.bath); $('accommodationValue').value = Math.round(s.accommodation * 100) + ' %';
    const fixed = s.action === 'fixed';
    $('volumeControl').hidden = fixed || active === 'heat'; $('durationControl').hidden = fixed || active === 'free' || active === 'heat';
    $('start').hidden = active === 'heat' || active === 'pressure'; $('stop').hidden = !moving;
    $('start').textContent = active === 'free' ? 'Ouvrir vers le vide' : fixed ? 'Isoler un choc' : expanding ? 'Lancer la détente' : 'Lancer la compression';
    $('start').disabled = touring || moving || (!fixed && Math.abs(target(s) - s.sim.width) < 1e-3);
    $('stop').disabled = !moving;
    for (const id of ['motionAction', 'target', 'duration', 'motionProfile']) $(id).disabled = touring || moving || (id === 'target' && active === 'free' && !!s.run?.free);
    for (const id of ['timeScale','thermalMode','accommodation','allWalls','particleModel','initialTemperature','applyInitial']) $(id).disabled = touring;
    $('bathTemperature').disabled = touring || s.thermalMode === 'isolated';
    $('illustrate').disabled = touring || (active === 'heat' && (s.thermalMode === 'isolated' || s.accommodation === 0)) || (active === 'adiabatic' && !moving && Math.abs(target(s)-s.sim.width)<1e-3);
    $('endIllustration').hidden = !touring; $('tourStatus').hidden = !touring;
    $('zoomPanel').hidden = !s.zoom || !s.other; $('microObservation').hidden = s.zoom || touring;
    $('microHint').textContent = active === 'pressure' ? 'Le bouton suit un choc à venir : ralenti, rapprochement de la caméra, poussée sur le piston, puis retour à la vue d’ensemble.' : active === 'heat' ? 'Le parcours montre deux échanges successifs : de la paroi vers le gaz, puis du gaz vers la paroi. Le flux moyen peut avoir un autre signe que celui d’un choc.' : active === 'adiabatic' ? 'Le bouton d’illustration lance le trajet choisi si nécessaire. La paroi mobile et la particule échangent de l’énergie au moment du choc.' : 'L’espace vide se remplit sans travail du piston. Attendez le retour à un état homogène pour interpréter PV/T.';
    $('pause').textContent = s.playing ? 'Ⅱ Pause' : '▶ Reprendre'; $('pause').setAttribute('aria-label', s.playing ? 'Mettre en pause' : 'Reprendre la simulation');
    $('capture').disabled = !!s.seek;
    document.querySelectorAll('input[type="range"]').forEach(input => input.style.setProperty('--fill', ((+input.value - +input.min) / (+input.max - +input.min) * 100) + '%'));
  }
  function launch() {
    const s = session();
    if (s.sim.motion || s.tour) return;
    if (s.action === 'fixed') { capture(); return; }
    sample(s);
    s.run = { id: ++s.runId, start: s.sim.time, free: active === 'free' };
    if (active === 'free') {
      s.sim.freeExpand(target(s)); sample(s);
      notify('Ouverture dans le vide : aucune particule n’a changé de vitesse, W = Q = 0. Observez la relaxation.');
    } else {
      for (const sim of states(s)) sim.setMotion({ type: s.profile, targetWidth: target(s), duration: duration(s) });
      sample(s); notify('Piston en mouvement. Comparez le travail mesuré aux chocs et la variation d’énergie.');
    }
    s.playing = true; s.seek = null; accumulator = 0; updateControls(); render();
  }
  function latestEvent(s) { return s.other ? s.other.observations.pair : s.sim.observations.walls[active === 'heat' ? 'left' : 'right']; }
  function capture() {
    const s = session(); s.zoom = true; $('zoomEnabled').checked = true;
    s.seek = { from: s.sim.time, deadline: s.sim.time + 10 }; accumulator = 0;
    notify('Recherche d’un choc ; le calcul se mettra en pause sur cet événement.'); updateControls();
  }
  function chooseCollision(s, force = false) {
    const event = latestEvent(s);
    if (!s.tour && event && (force || !s.focus || s.sim.time - s.focusAt > 0.35) && event !== s.focus) {
      s.focus = event; s.focusAt = s.sim.time;
    }
  }
  function advance(s, dt) {
    const motion = s.sim.motion;
    const h = motion ? Math.min(dt, Math.max(1e-10, motion.duration - motion.elapsed)) : dt;
    for (const sim of states(s)) sim.step(h);
    if (s.sim.time >= s.nextSample || (motion && !s.sim.motion)) sample(s);
    chooseCollision(s);
    if (s.seek) {
      const event = latestEvent(s);
      if (event && event.time > s.seek.from + 1e-10) {
        chooseCollision(s, true); s.seek = null; s.playing = false; sample(s); accumulator = 0;
        notify('Choc isolé à t = ' + format(event.time, 4) + ' u.t. Examinez les vitesses et les échanges, puis reprenez ou isolez le suivant.'); updateControls(); render();
      } else if (s.sim.time >= s.seek.deadline) { s.seek = null; s.playing = false; notify('Aucun choc sur la zone suivie pendant 10 u.t. Reprenez la lecture ou changez le mouvement.'); updateControls(); }
    }
    if (motion && !s.sim.motion && !s.tour) { updateControls(); notify('Volume cible atteint. Les mesures continuent à piston immobile.'); }
    return h;
  }
  function applyThermal() {
    const s = session(); if (active !== 'heat') return;
    s.thermalMode = $('thermalMode').value; s.bath = +$('bathTemperature').value / 100; s.accommodation = +$('accommodation').value / 100; s.allWalls = $('allWalls').checked;
    sample(s);
    s.sim.setThermal({ mode: s.thermalMode, temperature: s.bath, accommodation: s.accommodation, pistonThermal: s.allWalls, walls: s.allWalls ? ['left', 'right', 'top', 'bottom'] : ['left'] });
    updateControls(); render(); notify('Les conditions thermiques s’appliquent aux prochains chocs. Les échanges passés restent dans le cumul Q.');
  }
  function illustrate() {
    const s = session(); if (s.tour) return;
    if (active === 'adiabatic' && !s.sim.motion) {
      if (Math.abs(target(s)-s.sim.width)<1e-3) { notify('Choisissez un autre volume cible pour remettre le piston en mouvement.'); return; }
      launch();
    }
    s.seek = null; s.focus = null; s.playing = true; accumulator = 0;
    s.tour = new CollisionTour(s.sim, { kind: active === 'adiabatic' ? 'work' : active, speed: s.speed,
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false });
    updateControls(); updateTourUI(); render();
    notify('Le parcours suit des chocs à venir. La caméra et la vitesse de lecture reviennent automatiquement à leur état initial.');
  }
  function finishIllustration() {
    const s=session(), tour=s.tour;
    s.lastTour={kind:tour.kind,events:tour.events.map(e=>({...e})),phase:tour.phase};
    s.focus=tour.event || tour.events.at(-1) || null; s.focusAt=s.sim.time;
    s.tour=null; s.playing=true; accumulator=0; sample(s); updateControls(); render();
    notify(tour.message || 'Illustration terminée. Vue d’ensemble et lecture ×'+format(s.speed)+' rétablies.');
  }
  function cancelIllustration(pause=false) {
    const s=session(); if(!s.tour)return;
    s.lastTour={kind:s.tour.kind,events:s.tour.events.map(e=>({...e})),phase:'cancelled'};
    s.tour=null; s.playing=!pause; accumulator=0; sample(s); updateControls(); render();
    notify(pause ? 'Illustration interrompue. La simulation est en pause.' : 'Retour à la vue d’ensemble et à la vitesse de lecture choisie.');
  }
  function updateTourUI() {
    const tour=session().tour;if(!tour)return;
    const v=tour.view, heating=tour.stageIndex===0;
    const phases={search:'Repérage du choc',approach:'Approche au ralenti',impact:'Rebond au ralenti',departure:'Après le choc',return:'Retour à la vue d’ensemble'};
    const step=tour.kind==='heat' ? (heating?'1/2 · Paroi → gaz':'2/2 · Gaz → paroi') : tour.kind==='work'?'Travail sur le piston':'Poussée sur le piston';
    $('tourStage').textContent=step+' · '+(phases[v.phase]||'');
    $('tourSpeed').textContent=v.phase==='search' ? 'Préparation' : 'Lecture ×'+format(v.rate,3);
    let caption=v.phase==='search' ? 'Un choc à venir est repéré sans modifier les particules.' : v.phase==='approach' ? tour.kind==='work' ? 'Le piston se déplace devant un repère fixe du laboratoire. Suivez la particule entourée jusqu’au choc.' : 'Suivez la particule entourée. La caméra se rapproche de son point de contact.' : v.phase==='return' ? 'La caméra recule ; le temps retrouve progressivement sa vitesse normale.' : '';
    if(!caption&&v.event) caption=tour.kind==='pressure' ? 'La particule rebondit et transmet une impulsion J = '+format(v.event.impulse)+' au piston. Cette poussée contribue à la pression.'
      : tour.kind==='heat' ? (v.event.heat>0?'La paroi donne de l’énergie à la particule.':'La particule cède de l’énergie à la paroi.')+' δQ reçu par le gaz = '+signed(v.event.heat)+'.'
      : (v.event.work>0?'Le piston communique de l’énergie à la particule.':'La particule communique de l’énergie au piston.')+' δW reçu par le gaz = '+signed(v.event.work)+'.';
    if($('tourCaption').textContent!==caption)$('tourCaption').textContent=caption;
    const progress={search:0,approach:.15,impact:.55,departure:.7,return:.9}[v.phase]??1;
    $('tourProgress').style.setProperty('width',(100*(tour.stageIndex+progress)/tour.stages.length)+'%');
  }
  function chartData() {
    const s = session(), primary = s.history, compare = s.other ? s.history.map(r => ({ ...r.other, runId: r.runId, legId: r.legId, legStart: r.legStart, moving: r.moving, freeExpansion: r.freeExpansion, pistonPressure: r.other.pressureByWall.right })) : null;
    const groups = [{ rows: primary, initial: s.initial, color: '#287db4', dashed: false }, ...(compare ? [{ rows: compare, initial: s.otherInitial, color: '#bd843b', dashed: false }] : [])];
    let series = [], xLabel = 't (u.t.)', yLabel = '', legend = '', hint = '', xRange, yRange;
    const startTime = Math.max(0, s.sim.time - 60);
    if (s.chart === 'time') {
      for (const [groupIndex, group] of groups.entries()) {
        const rows = group.rows.filter(r => r.time >= startTime);
        for (const [key, color, base] of [['temperature', '#cb8640', group.initial.temperature], ['volume', '#477dc6', group.initial.volume], ['pressure', '#238c79', group.initial.pressureIdeal]])
          series.push({ color, dashed: groupIndex > 0 || key === 'volume', points: rows.map(r => ({ x: r.time, y: (key === 'pressure' ? pressure(r) ?? NaN : r[key]) / base })) });
      }
      yLabel = 'Rapports à l’état initial'; xRange = [startTime, Math.max(startTime + 5, s.sim.time)];
      legend = '<span style="--color:#238c79">P / P₀</span><span style="--color:#477dc6">V / V₀</span><span style="--color:#cb8640">T / T₀</span>' + (s.other ? '<small>P et T : plein ponctuel, pointillé disques</small>' : '');
      hint = 'P, V et T sont ramenés à leur valeur initiale pour partager le même axe. P₀ = NT₀/V₀ est la référence idéale ; P est mesurée aux collisions.';
    } else if (s.chart === 'ratio') {
      series = groups.map(group => ({ color: group.color, points: group.rows.filter(r => r.time >= startTime).map(r => ({ x: r.time, y: ratio(r) ?? NaN })) }));
      xRange = [startTime, Math.max(startTime + 5, s.sim.time)]; yLabel = 'PV / T';
      series.unshift({ color: '#8c9eaa', dashed: true, points: xRange.map(x => ({ x, y: N })) });
      legend = '<span style="--color:#287db4">' + (s.other ? 'Gaz ponctuel' : 'PV/T mesuré') + '</span>' + (s.other ? '<span style="--color:#bd843b">Disques durs</span>' : '') + '<span style="--color:#8c9eaa">Référence idéale : 1 000</span>';
      hint = 'À l’équilibre idéal, PV/T = NkB = 1 000. La pression est lissée sur 2 u.t. : transitoires, anisotropie et fluctuations peuvent écarter la mesure de cette référence.';
    } else if (s.chart === 'log') {
      const fit = GasAnalysis.logarithmicFit(primary, { runId: s.run?.id ?? 0, legId: 0, pressureKey: s.source === 'piston' ? 'pistonPressure' : 'pressure' });
      series = [{ color: '#238c79', scatter: true, points: fit.points }];
      xRange = G.dataRange(fit.points.map(p => p.x), [Math.log(s.initial.volume) - .1, Math.log(s.initial.volume) + .1]);
      const anchor = fit.fitPoints[0] || { x: Math.log(s.initial.volume), y: Math.log(s.initial.pressureIdeal) };
      series.push({ color: '#bd843b', dashed: true, points: xRange.map(x => ({ x, y: anchor.y - s.gamma * (x - anchor.x) })) });
      if (fit.fit) series.push({ color: '#287db4', points: xRange.map(x => ({ x, y: fit.fit.slope * x + fit.fit.intercept })) });
      xLabel = 'ln(V)'; yLabel = 'ln(P)'; legend = '<span style="--color:#238c79">Mesures</span><span style="--color:#bd843b">Référence γ</span>';
      hint = fit.reason || 'γ apparent = ' + format(-fit.fit.slope, 3) + ' · R² = ' + format(fit.fit.rSquared, 3) + '. Une pente ne valide pas à elle seule une loi adiabatique.';
      $('fitStatus').textContent = hint; $('fitValues').textContent = 'Dernier trajet uniquement, fenêtres de pression complètes et non recouvrantes. Référence idéale 2D isotrope : γ = 2.';
    } else {
      const convert = r => ({ x: ['pt', 'vt', 'pvt'].includes(s.chart) ? r.temperature : r.volume, y: s.chart === 'vt' ? r.volume : s.chart === 'pvt' ? (pressure(r) ?? NaN) * r.volume : pressure(r) ?? NaN });
      series = groups.map(group => ({ color: group.color, scatter: s.chart === 'pvt', arrows: s.chart !== 'pvt', points: group.rows.flatMap((row, i, rows) => i && row.freeExpansion && Math.abs(row.time - rows[i - 1].time) < 1e-9 && row.volume !== rows[i - 1].volume ? [{ x: NaN, y: NaN }, convert(row)] : [convert(row)]) }));
      xLabel = ['pt', 'vt', 'pvt'].includes(s.chart) ? 'T (u.r.)' : 'V (u.r.²)'; yLabel = s.chart === 'vt' ? 'V (u.r.²)' : s.chart === 'pvt' ? 'PV (u.r.)' : 'P (u.r.)';
      xRange = G.dataRange(series.flatMap(line => line.points.map(p => p.x)), s.chart === 'pv' ? [s.initial.volume * .8, s.initial.volume * 1.2] : [s.initial.temperature * .8, s.initial.temperature * 1.2]);
      if (s.chart === 'pvt') series.unshift({ color: '#8c9eaa', dashed: true, points: xRange.map(x => ({ x, y: N * x })) });
      legend = '<span style="--color:#287db4">' + (s.other ? 'Ponctuel' : 'Mesures') + '</span>' + (s.other ? '<span style="--color:#bd843b">Disques durs</span>' : '');
      hint = s.run?.free ? 'Une ouverture dans le vide est un saut de volume sans travail. Aucun segment ne relie ce saut dans le diagramme.' : s.chart === 'pv' ? 'Le travail reçu correspond à −∫P au piston dV. L’intégrale d’une pression lissée n’est qu’une estimation du travail réel aux chocs.' : s.chart === 'pvt' ? 'La droite PV = NT est une référence idéale, indépendante de la pression mesurée.' : 'Les aires des diagrammes P–T et V–T ne représentent pas directement un travail.';
    }
    yRange = G.dataRange(series.flatMap(line => line.points.map(p => p.y)), s.chart === 'ratio' ? [800,1200] : [0,1.5], s.chart !== 'log');
    return { series, xRange, yRange, xLabel, yLabel, legend, hint };
  }
  function readings() {
    const s = session(), m = s.sim.metrics, other = s.other?.metrics, event = s.focus;
    if (active === 'heat') {
      $('thermalModeLabel').textContent = s.allWalls ? 'Les parois' : 'Paroi gauche';
      $('experimentDescription').textContent = s.thermalMode === 'isolated'
        ? 'Toutes les parois sont isolées. La chaleur déjà échangée reste comptabilisée ; les prochains chocs sont élastiques.'
        : s.allWalls ? 'Le piston reste fixe. Toutes les parois échangent de la chaleur avec le thermostat ; le zoom observe celle de gauche.'
          : experiments.heat.description;
    }
    $('time').textContent = 't = ' + format(m.time) + ' u.t.';
    $('pressureLabel').textContent = s.source === 'piston' ? 'Pression au piston' : 'Pression moyenne des parois';
    $('pressure').textContent = format(pressure(m)); $('volume').textContent = format(m.volume,1); $('temperature').textContent = format(m.temperature); $('ratio').textContent = format(ratio(m),0);
    $('volumeRatio').textContent = '×' + format(m.volume / s.initial.volume) + ' le volume initial';
    $('secondPressure').textContent = other ? 'Disques : ' + format(pressure(other)) : 'Fenêtre ' + format(m.measurementDuration,1) + ' u.t.';
    $('secondTemperature').textContent = other ? 'Disques : ' + format(other.temperature) : 'T = Ec / 1 000';
    $('secondRatio').textContent = other ? 'Disques : ' + format(ratio(other),0) : 'Référence idéale : 1 000';
    $('modelBadge').textContent = other ? '1 000 + 1 000 particules' : s.model === 'ideal' ? 'Gaz ponctuel · N = 1 000' : 'Disques durs · N = 1 000';
    $('work').textContent = signed(m.pressureWork); $('heat').textContent = signed(m.heat); $('deltaEnergy').textContent = signed(m.energy - s.initial.energy);
    $('balance').textContent = (other ? 'Bilan du gaz ponctuel · ' : '') + (Math.abs(m.balancePressureError) < 1e-7 ? 'ΔE − W − Q ≈ 0' : 'Écart : ' + m.balancePressureError.toExponential(2));
    $('outcome').textContent = 'Mesures : T/T₀ = ' + format(m.temperature / s.initial.temperature) + ' ; V/V₀ = ' + format(m.volume / s.initial.volume) + '. ' + (s.run ? 'Les valeurs exactes restent affichées au-dessus.' : 'Faites une prédiction avant de lancer.');
    const p = m.pressureByWall.right;
    const gauge = Math.min(1, (p ?? 0) / (4 * s.initial.pressureIdeal));
    $('pressureGaugeFill').style.setProperty('width', 100 * gauge + '%');
    $('pressureGaugeFill').setAttribute('data-impact', String(s.tour?.phase === 'impact' && active === 'pressure'));
    $('pressureGaugeFill').setAttribute('aria-label','Pression au piston : ' + format(p));
    $('pressureWindow').textContent = 'Fenêtre ' + format(m.measurementDuration,2) + ' u.t.';
    $('pressureCalculation').textContent = 'P = ΣJ / (H × Δt) = ' + format(m.impulseByWall.right) + ' / ' + format(m.pistonLengthTime) + ' = ' + format(p);
    $('collisionTime').textContent = event ? 'Choc à t = ' + format(event.time,4) : 'En attente d’un choc';
    if (event?.kind === 'wall') {
      $('collisionImpulse').textContent = format(event.impulse); $('collisionWallSpeed').textContent = format(event.wallVelocity);
      $('collisionWork').textContent = signed(event.work); $('collisionBefore').textContent = format(event.energyBefore); $('collisionAfter').textContent = format(event.energyAfter); $('collisionHeat').textContent = signed(event.heat);
      $('heatDirection').textContent = event.heat > 0 ? 'Paroi → gaz' : event.heat < 0 ? 'Gaz → paroi' : 'Aucun transfert';
      $('pressureExplanation').textContent = 'Ce choc apporte une impulsion J = ' + format(event.impulse) + ' au piston. La jauge additionne les impulsions de tous les chocs sur la fenêtre de mesure.';
      $('heatExplanation').textContent = 'Paroi immobile : δW = 0 et δQ = Ec après − Ec avant = ' + signed(event.heat) + '. Chaque choc peut donner ou reprendre de l’énergie ; c’est l’échange moyen qui réchauffe ou refroidit le gaz.';
    } else if (!event) {
      for (const id of ['collisionImpulse','collisionWallSpeed','collisionWork','collisionBefore','collisionAfter','collisionHeat']) $(id).textContent = '—';
      $('pressureExplanation').textContent = 'Chaque choc apporte une impulsion au piston. La somme des impulsions, divisée par la durée et la longueur de paroi, donne la pression.';
      $('heatDirection').textContent = 'En attente d’un choc';
      $('heatExplanation').textContent = 'La paroi est immobile : δW = 0. Comparez l’énergie de la particule avant et après le choc pour mesurer la chaleur échangée.';
    }
    $('workBefore').textContent = event?.kind === 'wall' ? format(event.energyBefore) : '—';
    $('workAfter').textContent = event?.kind === 'wall' ? format(event.energyAfter) : '—';
    $('workDirection').textContent = event?.work > 0 ? 'Piston → gaz' : event?.work < 0 ? 'Gaz → piston' : 'Q = 0';
    $('workExplanation').textContent = event?.kind === 'wall' && event.work !== 0
      ? 'δW reçu par le gaz = Ec après − Ec avant = ' + signed(event.work) + '. ' + (event.work > 0 ? 'Le piston donne de l’énergie à la particule.' : 'La particule donne de l’énergie au piston.')
      : (s.action === 'compression' ? 'En compression, le gaz reçoit un travail positif et se réchauffe.' : 'En détente, le gaz fournit de l’énergie au piston : son travail reçu est négatif et il se refroidit.') + ' Observez un choc avec le bouton d’illustration.';
    const comparable = event?.kind === 'wall' && event.wall === 'right' && event.before.vx > 0;
    $('realExitSpeed').textContent = comparable ? format(Math.hypot(event.after.vx,event.after.vy)) : '—';
    $('fixedExitSpeed').textContent = comparable ? format(G.stationaryReflection(event).speed) : '—';
    $('speedComparisonNote').textContent = comparable
      ? 'Même vitesse incidente : v′ₓ = 2u − vₓ, contre −vₓ à piston fixe. Le violet en pointillés illustre ce second cas au même point de contact.'
      : event?.kind === 'wall' && event.before.vx <= 0 ? 'Le piston rattrape ici une particule qui s’éloigne : un piston immobile ne produirait pas ce choc.'
      : 'Le zoom reste fixe dans le laboratoire. Après le choc, comparez le rebond réel au rebond hypothétique sur un piston immobile.';
    $('heatFlux').textContent = 'Flux moyen à gauche : ' + signed(m.heatFluxByWall.left) + ' u.r. / (longueur × temps)';
    $('idealRatio').textContent = format(ratio(m),0); $('diskRatio').textContent = other ? format(ratio(other),0) : '—';
    $('pairCount').textContent = format(other?.pairCollisions ?? m.pairCollisions,0);
    $('packingFraction').textContent = 'Surface des disques : ' + format((other?.packingFraction ?? m.packingFraction) * 100,1) + ' %';
    $('directionTemperatures').textContent = 'Tₓ = ' + format(m.temperatureX) + ' ; Tᵧ = ' + format(m.temperatureY) + (other ? ' · Disques : Tₓ = ' + format(other.temperatureX) + ' ; Tᵧ = ' + format(other.temperatureY) : '');
    $('thermalFallbacks').textContent = 'Réflexions élastiques de contact thermique multiple : ' + format(m.thermalContactFallbacks,0) + '.';
    $('logAnalysis').hidden = s.chart !== 'log';
  }
  function draw() {
    const s = session(), opts = { initialTemperature: s.initialTemperature, vectors: s.vectors, focus: s.zoom ? s.focus : null, target: s.action === 'fixed' ? null : target(s), tour: s.tour?.view ?? null };
    if (s.other) {
      const maxWidth = Math.max(12, s.sim.width, s.other.width, s.action === 'fixed' ? 0 : target(s));
      G.chamber($('idealChamber'), s.sim, { ...opts, focus: null, maxWidth });
      G.chamber($('diskChamber'), s.other, { ...opts, maxWidth });
    } else G.chamber($('chamber'), s.sim, opts);
    if (s.zoom && s.other) G.collision($('collisionZoom'), s.focus, { kind: active, pulse: Math.max(0, 1 - (s.sim.time - (s.focus?.time ?? -1)) / .35) });
  }
  function drawChart() {
    const data = chartData(); G.plot($('chart'), data);
    $('graphLegend').innerHTML = data.legend; $('chartHint').textContent = (session().sim.time < 2 ? 'Première fenêtre encore partielle (' + format(session().sim.time,1) + '/2 u.t.). ' : '') + data.hint;
    $('chart').setAttribute('aria-label', data.yLabel + ' en fonction de ' + data.xLabel);
    document.querySelectorAll('[data-chart]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.chart === session().chart)); });
    if ($('advanced').open) {
      const s = session(), current = snapshots(s.sim), reference = s.other ? snapshots(s.other) : s.initialParticles;
      G.histogram($('speedHistogram'), current.speeds, reference.speeds); G.histogram($('energyHistogram'), current.energies, reference.energies);
      $('distributionLegend').textContent = s.other ? 'Barres : gaz ponctuel · pointillés : disques durs. Densités normalisées, mêmes classes.' : 'Barres : état actuel · pointillés : état initial. Densités normalisées, mêmes classes.';
    }
  }
  function render() { readings(); draw(); drawChart(); }
  function changeChart(key) { const s = session(); s.chart = key; $('extraChart').value = key; render(); }
  function frame(timestamp) {
    const s = session(); if (!previousFrame) previousFrame = timestamp;
    const elapsed = Math.min(.06, Math.max(0,(timestamp - previousFrame) / 1000)); previousFrame = timestamp;
    if (!document.hidden && s.tour) {
      const tour = s.tour, phase = tour.phase, stage = tour.stageIndex;
      tour.tick(elapsed, h => advance(s,h));
      s.focus = tour.event;
      updateTourUI();
      if (tour.finished) finishIllustration();
      else if (phase !== tour.phase || stage !== tour.stageIndex) { updateControls(); render(); }
    } else if (!document.hidden && (s.playing || s.seek)) {
      accumulator = Math.min(.5, accumulator + elapsed * (s.seek ? Math.max(1,s.speed) : s.speed));
      const started = performance.now();
      while (accumulator >= 1 / 120 && (s.playing || s.seek)) {
        const h = advance(s, 1 / 120); accumulator = Math.max(0,accumulator - h);
        if (performance.now() - started > 12) break;
      }
    }
    draw();
    if (timestamp - lastUI > 100) { readings(); drawChart(); lastUI = timestamp; }
    requestAnimationFrame(frame);
  }
  const tabs = Array.from(document.querySelectorAll('[data-experiment]'));
  tabs.forEach((button,i) => {
    button.addEventListener('click', () => selectExperiment(button.dataset.experiment));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); selectExperiment(tabs[next].dataset.experiment,true);
    });
  });
  $('brandHome').addEventListener('click', e => { e.preventDefault(); selectExperiment('pressure',true); });
  $('nextExperience').addEventListener('click', () => { const keys = Object.keys(experiments); selectExperiment(keys[(keys.indexOf(active)+1)%keys.length],true); });
  $('pause').addEventListener('click', () => { if (session().tour) { cancelIllustration(true); return; } session().playing = !session().playing; session().seek = null; if (!session().playing) sample(session()); accumulator = 0; updateControls(); render(); });
  $('step').addEventListener('click', () => { const s = session(); if (s.tour) cancelIllustration(true); s.playing = false; s.seek = null; advance(s,.02); chooseCollision(s,true); sample(s); accumulator = 0; updateControls(); render(); });
  $('reset').addEventListener('click', reset); $('start').addEventListener('click',launch); $('capture').addEventListener('click',capture);
  $('stop').addEventListener('click', () => { const s = session(); if (s.tour) cancelIllustration(); for (const sim of states(s)) sim.stopMotion(); sample(s); updateControls(); render(); notify('Piston arrêté : les prochains chocs ne fournissent plus de travail, même si la pression reste non nulle.'); });
  $('illustrate').addEventListener('click', illustrate);
  $('endIllustration').addEventListener('click', () => cancelIllustration());
  $('timeScale').addEventListener('input', () => { session().speed = +$('timeScale').value; accumulator = 0; });
  $('motionAction').addEventListener('input', () => { const s = session(); s.action = $('motionAction').value; s.ratio = s.action === 'compression' ? 70 : 140; updateControls(); render(); });
  $('target').addEventListener('input', () => { session().ratio = +$('target').value; updateControls(); draw(); });
  $('duration').addEventListener('input', () => { session().duration = +$('duration').value; updateControls(); });
  $('motionProfile').addEventListener('input', () => { session().profile = $('motionProfile').value; });
  $('vectors').addEventListener('input', () => { session().vectors = $('vectors').checked; draw(); });
  $('zoomEnabled').addEventListener('input', () => { session().zoom = $('zoomEnabled').checked; updateControls(); draw(); });
  for (const id of ['thermalMode','bathTemperature','accommodation','allWalls']) $(id).addEventListener('input', applyThermal);
  $('particleModel').addEventListener('input', () => { session().model = $('particleModel').value; reset(); });
  $('initialTemperature').addEventListener('input', () => { $('initialTemperatureValue').value = format(+$('initialTemperature').value / 100); });
  $('applyInitial').addEventListener('click', () => { session().initialTemperature = +$('initialTemperature').value / 100; reset(); });
  $('pressureSource').addEventListener('input', () => { session().source = $('pressureSource').value; render(); });
  document.querySelectorAll('[data-chart]').forEach(button => button.addEventListener('click', () => changeChart(button.dataset.chart)));
  $('extraChart').addEventListener('input', () => changeChart($('extraChart').value));
  $('gamma').addEventListener('input', () => { const value = Number($('gamma').value), valid = value >= .1 && value <= 5; $('gamma').setAttribute('aria-invalid',String(!valid)); if (valid) { session().gamma = value; drawChart(); } });
  $('advanced').addEventListener('toggle',drawChart);
  $('export').addEventListener('click', () => {
    const s = session(); sample(s);
    const headings = ['experience','modele','N','temps_ut','aire_ur2','P_mesuree','source_P','P_piston','P_moyenne','T_cinetique','Tx','Ty','PV_sur_T','energie','travail_recu','chaleur_recue','delta_E','ecart_bilan','vitesse_piston','chocs_mutuels','fraction_surface','mode_thermique','temperature_thermostat','parois_thermiques','fraction_chocs_thermalises','chaleur_absorbee','chaleur_cedee','puissance_thermique','contacts_thermiques_multiples','trajet_id','en_mouvement','detente_libre'];
    const number = v => v == null || !Number.isFinite(v) ? '' : v.toPrecision(10).replace('.',',');
    const rows = s.history.flatMap(row => [row, ...(row.other ? [row.other] : [])].map(m => [active,m.particleModel,m.count,number(m.time),number(m.volume),number(pressure(m)),s.source,number(m.pressureByWall.right),number(m.pressure),number(m.temperature),number(m.temperatureX),number(m.temperatureY),number(ratio(m)),number(m.energy),number(m.pressureWork),number(m.heat),number(m.energy - s.initial.energy),number(m.balancePressureError),number(m.pistonVelocity),m.pairCollisions,number(m.packingFraction),m.thermalMode,number(m.bathTemperature),m.thermalWalls.join('|'),number(m.accommodation),number(m.heatIn),number(m.heatOut),number(m.heatPower),m.thermalContactFallbacks,row.runId,+row.moving,+row.freeExpansion].join(';')));
    const url = URL.createObjectURL(new Blob(['\uFEFF'+headings.join(';')+'\r\n'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href=url; a.download='gaz-2d-'+active+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify('Mesures exportées pour cette expérience'+(s.other ? ', avec une ligne par gaz et par instant.' : '.'));
  });
  window.addEventListener('resize',render); document.addEventListener('visibilitychange',()=>{previousFrame=0;accumulator=0;});
  selectExperiment('pressure'); requestAnimationFrame(frame);
  Object.defineProperty(window,'gaz2D',{value:{
    get metrics(){return {...session().sim.metrics};}, get comparisonMetrics(){return session().other ? {...session().other.metrics} : null;},
    get paused(){return !session().playing;}, get analysis(){const s=session();return {experiment:active,chartType:s.chart,pressureSource:s.source,count:N,history:s.history.map(r=>({...r})),collision:s.focus,plot:chartData(),run:s.run,seek:!!s.seek,tour:s.tour?.view ?? null,lastTour:s.lastTour};}
  },writable:false});
})();
