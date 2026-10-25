(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const MAX_RECORDS = 10000, RECORD_PAGE_SIZE = 100;
  const N = 1000, G = LabGraphics, U = GasUnits;
  const format = (v, digits = 2) => v == null || !Number.isFinite(v) ? '—' : (Math.abs(v) < 0.5 * Math.pow(10,-digits) ? 0 : v).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const experiments = {
    pressure: { index: '01', label: 'LES CHOCS FONT LA PRESSION', title: 'Des chocs microscopiques à la pression.', description: 'Suivez une particule jusqu’au piston et observez la poussée au moment du choc.', width: 11, action: 'fixed', source: 'piston', chart: 'time', zoom: false, speed: 1 },
    free: { index: '02', label: 'DÉTENTE DE JOULE–GAY–LUSSAC', title: 'Plus de place. La même température ?', description: 'Ouvrez vers le vide, puis regardez le gaz occuper le nouvel espace. Les parois sont isolées.', width: 9, action: 'expansion', source: 'mean', chart: 'time', zoom: false, speed: 1 },
    adiabatic: { index: '03', label: 'LE TRAVAIL DU PISTON', title: 'Détendre ou comprimer : l’énergie change de côté.', description: 'Choisissez le sens du mouvement, puis suivez un choc sur le piston mobile. Les parois sont isolées.', width: 11, action: 'expansion', source: 'mean', chart: 'time', zoom: false, speed: 1 },
    comparison: { index: '04', label: 'LE RAYON DES PARTICULES', title: 'La taille des particules change-t-elle PV = nRT ?', description: 'Faites varier le rayon des disques, à quantité de gaz, volume et température initiale identiques. Comparez PV/(nRT) à 1.', width: 11, action: 'fixed', source: 'mean', chart: 'ratio', zoom: false, speed: 1 }
  };
  const sessions = new Map();
  let sharedRadius = .04;
  let active = 'pressure', previousFrame = 0, accumulator = 0, lastUI = 0;
  const session = () => sessions.get(active);
  const states = s => s.other ? [s.sim, s.other] : [s.sim];
  const pressure = (m, s = session()) => s.source === 'piston' ? (m.pistonPressure ?? m.pressureByWall.right) : m.pressure;
  const ratio = (m, s = session()) => pressure(m, s) == null ? null : pressure(m, s) * m.volume / (N * m.temperature);
  const duration = s => 0.2 * Math.pow(600, s.duration / 100);
  const target = s => Math.max(3, Math.min(18, s.baseWidth * s.ratio / 100));
  const snapshots = sim => ({ speeds: sim.particles.map(p => Math.hypot(p.vx, p.vy)), energies: sim.particles.map(p => (p.vx ** 2 + p.vy ** 2) / 2) });
  function createSession(key, previous) {
    const config = experiments[key];
    const s = { key, model: 'hard-disks', radius: sharedRadius, radiusRecords: previous?.radiusRecords ?? [], recordX: previous?.recordX ?? 'radius', recordY: previous?.recordY ?? 'ratio', lastRecordTime: null, alpha: previous?.alpha ?? 1, fitEnabled: previous?.fitEnabled ?? true, autoRecords: previous?.autoRecords ?? false, recordPage: previous?.recordPage ?? 0, initialTemperature: previous?.initialTemperature || 1.5,
      action: previous?.action ?? config.action, duration: 72, ratio: key === 'free' ? 200 : (previous?.action ?? config.action) === 'compression' ? 70 : 140,
      source: config.source, chart: config.chart, zoom: config.zoom, speed: config.speed, playing: true, vectors: false,
      bath: previous?.bath ?? 3, accommodation: previous?.accommodation ?? 1, allWalls: previous?.allWalls ?? false,
      thermalMode: previous?.thermalMode ?? (key === 'heat' ? 'thermostat' : 'isolated'), profile: previous?.profile || 'linear',
      gamma: previous?.gamma || 2, history: [], nextSample: 0, focus: null, focusAt: -Infinity, seek: null, tour: null, lastTour: null, run: null, runId: 0 };
    const thermal = { mode: key === 'heat' ? s.thermalMode : 'isolated', temperature: s.bath, accommodation: s.accommodation, pistonThermal: s.allWalls, walls: s.allWalls ? ['left', 'right', 'top', 'bottom'] : ['left'] };
    s.sim = new GasSimulation({ count: N, width: config.width, temperature: s.initialTemperature, particleModel: 'hard-disks', particleRadius: s.radius, thermal, observeCollisions: true, seed: 314159 });
    s.other = null;
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
    notify('Rayon commun : '+format(sharedRadius*U.scales.length*1000)+' mm. Seul le gaz affiché évolue.');
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
    $('comparisonLesson').hidden = active !== 'comparison'; $('transformationLesson').hidden = active !== 'free'; $('workLesson').hidden = active !== 'adiabatic';
    $('motionChoice').hidden = active !== 'adiabatic';
    $('motionFixedOption').hidden = $('motionFixedOption').disabled = active === 'adiabatic';
    $('heatControls').hidden = active !== 'heat'; $('thermalAdvanced').hidden = active !== 'heat';
    $('radiusControls').hidden = active !== 'comparison';
    $('recordAnalysis').hidden = active !== 'comparison';
    $('recordX').value = s.recordX; $('recordY').value = s.recordY;
    $('alpha').value = s.alpha; $('alphaNumber').value = s.alpha; $('alphaNumber').setAttribute('aria-invalid','false'); $('linearFit').checked = s.fitEnabled; $('autoRecords').checked = s.autoRecords;
    $('particleRadius').value = Math.round(s.radius * 1000);
    $('radiusValue').value = format(s.radius * U.scales.length * 1000) + ' mm';
    $('microTitle').textContent = s.other ? 'Deux états microscopiques' : active === 'heat' ? 'Le gaz et la paroi gauche' : 'Le gaz et son piston';
    $('zoomTitle').textContent = active === 'comparison' ? 'Zoom · un choc entre deux disques' : active === 'heat' ? 'Zoom · un échange sur la paroi gauche' : 'Zoom · une poussée sur le piston';
    $('zoomHint').textContent = active === 'comparison' ? 'Pointillés : avant · traits pleins : après. Les vitesses se redistribuent.' : 'Bleu : avant · vert : après. Vitesses relatives à la paroi.';
    $('zoomScale').textContent = 'Schéma d’un choc enregistré';
    $('timeScale').value = s.speed; $('motionAction').value = s.action; $('duration').value = s.duration;
    $('pressureSource').value = s.source; $('extraChart').value = s.chart;
    $('thermalMode').value = s.thermalMode; $('bathTemperature').value = s.bath * 200; $('accommodation').value = s.accommodation * 100;
    $('allWalls').checked = s.allWalls; $('vectors').checked = s.vectors; $('zoomEnabled').checked = s.zoom;
    $('recordTemperature').value = s.initialTemperature*200; $('recordTemperatureValue').value = U.text('temperature',s.initialTemperature);
    $('initialTemperature').value = s.initialTemperature * 200; $('initialTemperatureValue').value = U.text('temperature', s.initialTemperature);
    $('motionProfile').value = s.profile; $('gamma').value = s.gamma;
    $('predictionTitle').textContent = active === 'free' ? 'Sans travail et sans chaleur' : 'L’énergie change par le travail';
    $('predictionText').textContent = active === 'free' ? 'L’ouverture seule ne change aucune vitesse. En mode isolé, W = Q = 0 : la température cinétique reste constante.' : s.action === 'compression' ? 'Le piston apporte de l’énergie au gaz : W > 0. Comme Q = 0, la température augmente.' : 'Lors des chocs, le gaz fournit du travail au piston : W < 0. Comme Q = 0, sa température diminue. Une détente très rapide peut produire très peu de chocs.';
    $('experimentTag').textContent = active === 'free' ? 'W = Q = 0' : 'Q = 0';
    $('microHint').textContent = active === 'free' ? 'L’espace vide se remplit sans travail du piston. Attendez le retour à un état homogène pour interpréter PV/(nRT).' : 'Les flèches de vitesse et le zoom permettent de relier l’évolution de la température aux chocs sur le piston.';
    $('illustrationControls').hidden = !['pressure','heat','adiabatic'].includes(active);
    $('staticZoomControl').hidden = active !== 'comparison'; $('capture').hidden = active !== 'comparison';
    $('illustrate').textContent = active === 'heat' ? '▶ Illustrer les deux sens de la chaleur' : active === 'adiabatic' ? '▶ Illustration du travail sur le piston' : '▶ Illustrer une poussée';
    $('experimentControls').hidden = ['pressure','comparison'].includes(active); $('energyBalance').hidden = ['pressure','comparison'].includes(active);
    $('profileLabel').hidden = $('motionProfile').hidden = ['pressure','heat','free','comparison'].includes(active);
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
    $('durationValue').value = U.text('time', duration(s));
    $('bathValue').value = U.text('temperature', s.bath); $('accommodationValue').value = Math.round(s.accommodation * 100) + ' %';
    const fixed = s.action === 'fixed';
    $('volumeControl').hidden = fixed || active === 'heat'; $('durationControl').hidden = fixed || active === 'free' || active === 'heat';
    $('start').hidden = ['heat','pressure','comparison'].includes(active); $('stop').hidden = !moving;
    $('start').textContent = active === 'free' ? 'Ouvrir vers le vide' : fixed ? 'Isoler un choc' : expanding ? 'Lancer la détente' : 'Lancer la compression';
    $('start').disabled = touring || moving || (!fixed && Math.abs(target(s) - s.sim.width) < 1e-3);
    $('stop').disabled = !moving;
    for (const id of ['motionAction', 'target', 'duration', 'motionProfile']) $(id).disabled = touring || moving || (id === 'target' && active === 'free' && !!s.run?.free);
    for (const id of ['timeScale','thermalMode','accommodation','allWalls','particleRadius','applyRadius','initialTemperature','applyInitial']) $(id).disabled = touring;
    $('bathTemperature').disabled = touring || s.thermalMode === 'isolated';
    $('illustrate').disabled = touring || (active === 'heat' && (s.thermalMode === 'isolated' || s.accommodation === 0)) || (active === 'adiabatic' && !moving && Math.abs(target(s)-s.sim.width)<1e-3);
    $('endIllustration').hidden = !touring; $('tourStatus').hidden = !touring;
    $('zoomPanel').hidden = !s.zoom || active !== 'comparison'; $('microObservation').hidden = s.zoom || touring || active === 'comparison';
    $('microHint').textContent = active === 'comparison' ? 'Les chocs mutuels redistribuent les vitesses. Pour chaque rayon, attendez la stabilisation de la mesure ; un écart à 1 peut aussi fluctuer.' : active === 'pressure' ? 'Le bouton suit un choc à venir : ralenti, rapprochement de la caméra, poussée sur le piston, puis retour à la vue d’ensemble.' : active === 'heat' ? 'Le parcours montre deux échanges successifs : de la paroi vers le gaz, puis du gaz vers la paroi. Le flux moyen peut avoir un autre signe que celui d’un choc.' : active === 'adiabatic' ? 'Le bouton d’illustration lance le trajet choisi si nécessaire. La paroi mobile et la particule échangent de l’énergie au moment du choc.' : 'L’espace vide se remplit sans travail du piston. Attendez le retour à un état homogène pour interpréter PV/(nRT).';
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
  function latestEvent(s) { return s.key === 'comparison' ? s.sim.observations.pair : s.sim.observations.walls[active === 'heat' ? 'left' : 'right']; }
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
        notify('Choc isolé à t = ' + U.text('time', event.time) + '. Examinez les vitesses et les échanges, puis reprenez ou isolez le suivant.'); updateControls(); render();
      } else if (s.sim.time >= s.seek.deadline) { s.seek = null; s.playing = false; notify('Aucun choc sur la zone suivie pendant la fenêtre de recherche Reprenez la lecture ou changez le mouvement.'); updateControls(); }
    }
    if (motion && !s.sim.motion && !s.tour) { updateControls(); notify('Volume cible atteint. Les mesures continuent à piston immobile.'); }
    return h;
  }
  function applyThermal() {
    const s = session(); if (active !== 'heat') return;
    s.thermalMode = $('thermalMode').value; s.bath = +$('bathTemperature').value / 200; s.accommodation = +$('accommodation').value / 100; s.allWalls = $('allWalls').checked;
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
    const phases={search:'Repérage du choc',approach:'Approche au ralenti',impact:'Rebond au ralenti',departure:'Après le choc',compare:'Comparez les vitesses',return:'Retour à la vue d’ensemble'};
    const step=tour.kind==='heat' ? (heating?'1/2 · Paroi → gaz':'2/2 · Gaz → paroi') : tour.kind==='work'?'Travail sur le piston':'Poussée sur le piston';
    $('tourStage').textContent=step+' · '+(phases[v.phase]||'');
    $('tourSpeed').textContent=v.phase==='search' ? 'Préparation' : v.phase==='compare' ? 'Arrêt sur image · 2,5 s' : 'Lecture ×'+format(v.rate,3);
    let caption=v.phase==='search' ? 'Un choc à venir est repéré sans modifier les particules.' : v.phase==='approach' ? tour.kind==='work' ? 'Le piston se déplace devant un repère fixe du laboratoire. Suivez la particule entourée jusqu’au choc.' : 'Suivez la particule entourée. La caméra se rapproche de son point de contact.' : v.phase==='return' ? 'La caméra recule ; le temps retrouve progressivement sa vitesse normale.' : '';
    if(v.phase==='compare'&&v.event) caption='V sortante si fixe : '+U.text('velocity', G.stationaryReflection(v.event).speed)+' ; si mobile : '+U.text('velocity', Math.hypot(v.event.after.vx,v.event.after.vy))+'. Le piston mobile '+(v.event.work>0?'accélère':'ralentit')+' la particule. Reprise automatique dans un instant.';
    if(!caption&&v.event) caption=tour.kind==='pressure' ? 'La particule rebondit : J = m(vₓ avant − vₓ après) = '+U.text('momentum', v.event.impulse)+' au piston. Bleu et vert : quantités de mouvement ; orange : leur différence.'
      : tour.kind==='heat' ? (v.event.heat>0?'La paroi donne de l’énergie à la particule.':'La particule cède de l’énergie à la paroi.')+' δQ reçu par le gaz = '+U.text('energy', v.event.heat, 3)+'.'
      : (v.event.work>0?'Le piston communique de l’énergie à la particule.':'La particule communique de l’énergie au piston.')+' δW reçu par le gaz = '+U.text('energy', v.event.work, 3)+'.';
    if($('tourCaption').textContent!==caption)$('tourCaption').textContent=caption;
    const progress={search:0,approach:.15,impact:.55,departure:.7,compare:.85,return:.9}[v.phase]??1;
    $('tourProgress').style.setProperty('width',(100*(tour.stageIndex+progress)/tour.stages.length)+'%');
  }
  function chartData() {
    const s = session(), primary = s.history, compare = s.other ? s.history.map(r => ({ ...r.other, runId: r.runId, legId: r.legId, legStart: r.legStart, moving: r.moving, freeExpansion: r.freeExpansion, pistonPressure: r.other.pressureByWall.right })) : null;
    const groups = [{ rows: primary, initial: s.initial, color: '#287db4', dashed: false }, ...(compare ? [{ rows: compare, initial: s.otherInitial, color: '#bd843b', dashed: false }] : [])];
    let series = [], xLabel = 't (ms)', yLabel = '', legend = '', hint = '', xRange, yRange;
    const startTime = Math.max(0, s.sim.time - 60);
    if (s.chart === 'time') {
      for (const [groupIndex, group] of groups.entries()) {
        const rows = group.rows.filter(r => r.time >= startTime);
        for (const [key, color, base] of [['temperature', '#cb8640', group.initial.temperature], ['volume', '#477dc6', group.initial.volume], ['pressure', '#238c79', group.initial.pressureIdeal]])
          series.push({ color, dashed: groupIndex > 0 || key === 'volume', points: rows.map(r => ({ x: r.time, y: (key === 'pressure' ? pressure(r) ?? NaN : r[key]) / base })) });
      }
      yLabel = 'Rapports à l’état initial'; xRange = [startTime, Math.max(startTime + 5, s.sim.time)];
      legend = '<span style="--color:#238c79">P / P₀</span><span style="--color:#477dc6">V / V₀</span><span style="--color:#cb8640">T / T₀</span>' + (s.other ? '<small>P et T : plein de disques, pointillé disques</small>' : '');
      hint = 'P, V et T sont ramenés à leur valeur initiale pour partager le même axe. P₀ = nRT₀/V₀ est la référence idéale ; P est mesurée aux collisions.';
    } else if (s.chart === 'ratio') {
      series = groups.map(group => ({ color: group.color, points: group.rows.filter(r => r.time >= startTime).map(r => ({ x: r.time, y: ratio(r) ?? NaN })) }));
      xRange = [startTime, Math.max(startTime + 5, s.sim.time)]; yLabel = 'PV / (nRT)';
      series.unshift({ color: '#8c9eaa', dashed: true, points: xRange.map(x => ({ x, y: 1 })) });
      legend = '<span style="--color:#287db4">' + (s.other ? 'Disques durs' : 'PV/(nRT) mesuré') + '</span>' + (s.other ? '<span style="--color:#bd843b">Disques durs</span>' : '') + '<span style="--color:#8c9eaa">Référence idéale : 1</span>';
      hint = 'À l’équilibre idéal, PV/(nRT) = 1. La pression est lissée sur 0,23 ms : transitoires, anisotropie et fluctuations peuvent écarter la mesure de cette référence.';
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
      xRange = G.dataRange(series.flatMap(line => line.points.map(p => p.x)), s.chart === 'pv' ? [s.initial.volume * .8, s.initial.volume * 1.2] : [s.initial.temperature * .8, s.initial.temperature * 1.2]);
      if (s.chart === 'pvt') series.unshift({ color: '#8c9eaa', dashed: true, points: xRange.map(x => ({ x, y: N * x })) });
      legend = '<span style="--color:#287db4">' + (s.other ? 'Disques durs' : 'Mesures') + '</span>' + (s.other ? '<span style="--color:#bd843b">Disques durs</span>' : '');
      hint = s.run?.free ? 'Une ouverture dans le vide est un saut de volume sans travail. Aucun segment ne relie ce saut dans le diagramme.' : s.chart === 'pv' ? 'Le travail reçu correspond à −∫P au piston dV. L’intégrale d’une pression lissée n’est qu’une estimation du travail réel aux chocs.' : s.chart === 'pvt' ? 'La droite PV = nRT est une référence idéale, indépendante de la pression mesurée.' : 'Les aires des diagrammes P–T et V–T ne représentent pas directement un travail.';
    }
    yRange = G.dataRange(series.flatMap(line => line.points.map(p => p.y)), s.chart === 'ratio' ? [.8,1.2] : [0,1.5], s.chart !== 'log');
    let fx = x => x, fy = y => y;
    if (s.chart === 'time' || s.chart === 'ratio') {
      fx = x => U.value('time', x); xLabel = 't (ms)';
    } else if (s.chart === 'log') {
      fx = x => x + Math.log(U.value('volume', 1));
      fy = y => y + Math.log(U.value('pressure', 1));
      xLabel = 'ln(V / 1 L)'; yLabel = 'ln(P / 1 bar)';
    } else {
      fx = x => U.value(['pt','vt','pvt'].includes(s.chart) ? 'temperature' : 'volume', x);
      fy = y => U.value(s.chart === 'vt' ? 'volume' : s.chart === 'pvt' ? 'energy' : 'pressure', y);
      xLabel = ['pt','vt','pvt'].includes(s.chart) ? 'T (K)' : 'V (L)';
      yLabel = s.chart === 'vt' ? 'V (L)' : s.chart === 'pvt' ? 'PV (J)' : 'P (bar)';
      if (s.chart === 'pv') hint += ' Sur ce diagramme, 1 bar·L = 100 J.';
    }
    series = series.map(line => ({...line, points:line.points.map(p => ({...p,x:fx(p.x),y:fy(p.y)}))}));
    xRange = xRange.map(fx); yRange = yRange.map(fy);
    return { series, xRange, yRange, xLabel, yLabel, legend, hint };
  }
  function nextRecordTime(s) {
    return Math.max(2*s.sim.measurementWindow, s.lastRecordTime == null ? 0 : s.lastRecordTime+s.sim.measurementWindow);
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
    $('time').textContent = 't = ' + U.text('time', m.time);
    $('pressureLabel').textContent = s.source === 'piston' ? 'Pression au piston' : 'Pression moyenne des parois';
    $('pressure').textContent = U.text('pressure', pressure(m)); $('volume').textContent = U.text('volume', m.volume); $('temperature').textContent = U.text('temperature', m.temperature); $('ratio').textContent = format(ratio(m));
    $('volumeRatio').textContent = '×' + format(m.volume / s.initial.volume) + ' le volume initial';
    $('secondPressure').textContent = other ? 'Disques : ' + U.text('pressure', pressure(other)) : 'Fenêtre ' + U.text('time', m.measurementDuration);
    $('secondTemperature').textContent = other ? 'Disques : ' + U.text('temperature', other.temperature) : 'Modèle 2D : E = nRT';
    $('secondRatio').textContent = other ? 'Disques : ' + format(ratio(other)) : 'Référence idéale : 1';
    $('modelBadge').textContent = other ? '1 000 + 1 000 particules' : s.model === 'ideal' ? 'Disques durs · N = 1 000' : 'Disques durs · N = 1 000';
    $('work').textContent = U.text('energy', m.pressureWork, 3); $('heat').textContent = U.text('energy', m.heat, 3); $('deltaEnergy').textContent = U.text('energy', m.energy - s.initial.energy, 3);
    $('balance').textContent = (other ? 'Bilan du gaz de disques · ' : '') + (Math.abs(m.balancePressureError) < 1e-7 ? 'ΔE − W − Q ≈ 0' : 'Écart : ' + (m.balancePressureError * U.scales.energy).toExponential(2) + ' J');
    $('outcome').textContent = 'Mesures : T/T₀ = ' + format(m.temperature / s.initial.temperature) + ' ; V/V₀ = ' + format(m.volume / s.initial.volume) + '. ' + (s.run ? 'Les valeurs exactes restent affichées au-dessus.' : 'Faites une prédiction avant de lancer.');
    const p = m.pressureByWall.right;
    const gauge = Math.min(1, (p ?? 0) / (4 * s.initial.pressureIdeal));
    $('pressureGaugeFill').style.setProperty('width', 100 * gauge + '%');
    $('pressureGaugeFill').setAttribute('data-impact', String(s.tour?.phase === 'impact' && active === 'pressure'));
    $('pressureGaugeFill').setAttribute('aria-label','Pression au piston : ' + U.text('pressure', p));
    $('pressureWindow').textContent = 'Fenêtre ' + U.text('time', m.measurementDuration);
    $('pressureCalculation').textContent = 'P = ΣJ / (S × Δt) = ' + U.text('pressure', p) + ' · ΣJ = ' + U.text('momentum', m.impulseByWall.right) + ' · S = ' + format(s.sim.height * U.scales.length * U.scales.depth * 1e4) + ' cm²';
    $('collisionTime').textContent = event ? 'Choc à t = ' + U.text('time', event.time) : 'En attente d’un choc';
    if (event?.kind === 'wall') {
      $('collisionImpulse').textContent = U.text('momentum', event.impulse); $('collisionWallSpeed').textContent = U.text('velocity', event.wallVelocity);
      $('collisionWork').textContent = U.text('energy', event.work, 3); $('collisionBefore').textContent = U.text('energy', event.energyBefore); $('collisionAfter').textContent = U.text('energy', event.energyAfter); $('collisionHeat').textContent = U.text('energy', event.heat, 3);
      $('heatDirection').textContent = event.heat > 0 ? 'Paroi → gaz' : event.heat < 0 ? 'Gaz → paroi' : 'Aucun transfert';
      $('pressureExplanation').textContent = 'J = m(vₓ avant − vₓ après) = ' + U.text('momentum', event.impulse) + ' au piston : c’est la quantité de mouvement transmise. La jauge additionne les impulsions de tous les chocs sur la fenêtre de mesure.';
      $('heatExplanation').textContent = 'Paroi immobile : δW = 0 et δQ = Ec après − Ec avant = ' + U.text('energy', event.heat, 3) + '. Chaque choc peut donner ou reprendre de l’énergie ; c’est l’échange moyen qui réchauffe ou refroidit le gaz.';
    } else if (!event) {
      for (const id of ['collisionImpulse','collisionWallSpeed','collisionWork','collisionBefore','collisionAfter','collisionHeat']) $(id).textContent = '—';
      $('pressureExplanation').textContent = 'Chaque choc apporte une impulsion au piston. La somme des impulsions, divisée par la durée et la surface de paroi, donne la pression.';
      $('heatDirection').textContent = 'En attente d’un choc';
      $('heatExplanation').textContent = 'La paroi est immobile : δW = 0. Comparez l’énergie de la particule avant et après le choc pour mesurer la chaleur échangée.';
    }
    $('workLesson').setAttribute('data-compare', String(s.tour?.phase === 'compare'));
    $('workBefore').textContent = event?.kind === 'wall' ? U.text('energy', event.energyBefore) : '—';
    $('workAfter').textContent = event?.kind === 'wall' ? U.text('energy', event.energyAfter) : '—';
    $('workDirection').textContent = event?.work > 0 ? 'Piston → gaz' : event?.work < 0 ? 'Gaz → piston' : 'Q = 0';
    $('workExplanation').textContent = event?.kind === 'wall' && event.work !== 0
      ? 'δW reçu par le gaz = Ec après − Ec avant = ' + U.text('energy', event.work, 3) + '. ' + (event.work > 0 ? 'Le piston donne de l’énergie à la particule.' : 'La particule donne de l’énergie au piston.')
      : (s.action === 'compression' ? 'En compression, le gaz reçoit un travail positif et se réchauffe.' : 'En détente, le gaz fournit de l’énergie au piston : son travail reçu est négatif et il se refroidit.') + ' Observez un choc avec le bouton d’illustration.';
    const comparable = event?.kind === 'wall' && event.wall === 'right' && event.before.vx > 0;
    $('realExitSpeed').textContent = comparable ? U.text('velocity', Math.hypot(event.after.vx,event.after.vy)) : '—';
    $('fixedExitSpeed').textContent = comparable ? U.text('velocity', G.stationaryReflection(event).speed) : '—';
    $('speedComparisonNote').textContent = comparable
      ? 'Même vitesse incidente : v′ₓ = 2u − vₓ, contre −vₓ à piston fixe. Le violet en pointillés illustre ce second cas au même point de contact.'
      : event?.kind === 'wall' && event.before.vx <= 0 ? 'Le piston rattrape ici une particule qui s’éloigne : un piston immobile ne produirait pas ce choc.'
      : 'Le zoom reste fixe dans le laboratoire. Après le choc, comparez le rebond réel au rebond hypothétique sur un piston immobile.';
    $('heatFlux').textContent = 'Flux moyen à gauche : ' + U.text('flux', m.heatFluxByWall.left);
    $('diskRatio').textContent = format(ratio(m));
    $('correctedRatio').textContent = format(ratio(m) == null ? null : ratio(m)*(1-s.alpha*m.packingFraction));
    $('recordRadius').disabled = active !== 'comparison' || m.time < nextRecordTime(s) || s.radiusRecords.length >= MAX_RECORDS;
    const windowText = U.text('time',s.sim.measurementWindow,3);
    $('recordCount').textContent = s.radiusRecords.length.toLocaleString('fr-FR')+' / 10 000 relevés · les 10 derniers ci-dessous';
    $('autoRecords').disabled = s.radiusRecords.length >= MAX_RECORDS;
    $('radiusStatus').textContent = s.radiusRecords.length >= MAX_RECORDS ? 'Limite de 10 000 atteinte : exportez avant d’effacer. Aucun relevé n’a été supprimé.' : m.time < s.sim.measurementWindow
      ? 'Démarrage écarté : encore '+U.text('time',s.sim.measurementWindow-m.time,3)+' de temps simulé, puis une fenêtre complète de '+windowText+'.'
      : m.time < nextRecordTime(s) ? 'Fenêtre en cours : encore '+U.text('time',nextRecordTime(s)-m.time,3)+' de temps simulé avant un relevé sans chevauchement.'
      : 'Prêt : fenêtre de '+U.text('time',m.measurementStart,3)+' à '+U.text('time',m.time,3)+'. Les observations ne seront pas reprises dans le prochain relevé.';
    $('radiusRecords').innerHTML = s.radiusRecords.slice(-10).map(r => '<li>r = ' + format(r.radius * U.scales.length * 1000) + ' mm · PV/(nRT) = ' + format(r.ratio) + ' · T = ' + U.text('temperature',r.temperature) + ' · fenêtre : ' + U.text('time',r.windowStart,3) + ' → ' + U.text('time',r.time,3) + ' · ' + (r.source === 'mean' ? 'toutes les parois' : 'piston') + '</li>').join('');
    $('pairCount').textContent = format(other?.pairCollisions ?? m.pairCollisions,0);
    $('packingFraction').textContent = 'Surface des disques : ' + format((other?.packingFraction ?? m.packingFraction) * 100,1) + ' %';
    $('directionTemperatures').textContent = 'Tₓ = ' + U.text('temperature', m.temperatureX) + ' ; Tᵧ = ' + U.text('temperature', m.temperatureY) + (other ? ' · Disques : Tₓ = ' + U.text('temperature', other.temperatureX) + ' ; Tᵧ = ' + U.text('temperature', other.temperatureY) : '');
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
    if (s.zoom && active === 'comparison') G.collision($('collisionZoom'), s.focus, { kind: active, pulse: Math.max(0, 1 - (s.sim.time - (s.focus?.time ?? -1)) / .35) });
  }
  function drawChart() {
    const data = chartData(); G.plot($('chart'), data);
    $('graphLegend').innerHTML = data.legend; $('chartHint').textContent = (session().sim.time < 2 ? 'Première fenêtre encore partielle (' + U.text('time', session().sim.time) + '/0,23 ms). ' : '') + data.hint;
    $('chart').setAttribute('aria-label', data.yLabel + ' en fonction de ' + data.xLabel);
    document.querySelectorAll('[data-chart]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.chart === session().chart)); });
    if ($('advanced').open) {
      const s = session(), current = snapshots(s.sim), reference = s.other ? snapshots(s.other) : s.initialParticles;
      G.histogram($('speedHistogram'), current.speeds.map(v => U.value('velocity',v)), reference.speeds.map(v => U.value('velocity',v)), 'v (m/s)'); G.histogram($('energyHistogram'), current.energies.map(v => U.value('energy',v)), reference.energies.map(v => U.value('energy',v)), 'E par marqueur (J)');
      $('distributionLegend').textContent = s.other ? 'Barres : gaz de disques · pointillés : disques durs. Densités normalisées, mêmes classes.' : 'Barres : état actuel · pointillés : état initial. Densités normalisées, mêmes classes.';
    }
  }
  const recordFields = {
    radius: {label:'Rayon (mm)', value:r => r.radius * U.scales.length * 1000},
    ratio: {label:'PV/(nRT)', value:r => r.ratio},
    correctedRatio: {label:'P(V − αV occupé)/(nRT)', value:r => r.ratio*(1-session().alpha*r.packing)},
    correctedPV: {label:'P(V − b) (J), b = αV occupé', value:r => r.pressure*r.volume*(1-session().alpha*r.packing)*U.scales.energy},
    correctedPVT: {label:'P(V − αV occupé)/T (J/K)', value:r => r.ratio*(1-session().alpha*r.packing)*U.scales.nR},
    inverseMeanFreePath: {label:'Inverse du libre parcours moyen (mm⁻¹)', value:r => r.meanFreePath > 0 ? 1/(r.meanFreePath*U.scales.length*1000) : null},
    inverseMeanCollisionTime: {label:'Inverse du temps moyen entre chocs (µs⁻¹)', value:r => r.meanCollisionTime > 0 ? 1/(r.meanCollisionTime*U.scales.time*1e6) : null},
    meanFreePath: {label:'Libre parcours moyen (mm)', value:r => r.meanFreePath == null ? null : r.meanFreePath * U.scales.length * 1000},
    packing: {label:'Surface occupée (%)', value:r => r.packing * 100},
    pressure: {label:'Pression (bar)', value:r => U.value('pressure',r.pressure)},
    temperature: {label:'Température (K)', value:r => U.value('temperature',r.temperature)},
    meanCollisionTime: {label:'Temps moyen entre chocs (µs)', value:r => r.meanCollisionTime == null ? null : r.meanCollisionTime * U.scales.time * 1e6},
    completedFlights: {label:'Trajets complets comptés', value:r => r.completedFlights}
  };
  function recordPlotData() {
    const s = session(), xf = recordFields[s.recordX], yf = recordFields[s.recordY];
    const points = s.radiusRecords.map((r,i) => ({x:xf.value(r), y:yf.value(r), index:i+1})).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    const reference = key => key === 'correctedPVT' ? U.scales.nR : ['ratio','correctedRatio'].includes(key) ? 1 : null;
    const xr = reference(s.recordX), yr = reference(s.recordY);
    const xRange = G.dataRange(points.map(p=>p.x),[0,1]), yRange = G.dataRange(points.map(p=>p.y).concat(yr == null ? [] : [yr]),[0,1]);
    const series = [{color:'#287db4',scatter:true,radius:4,points}];
    if (yr != null) series.unshift({color:'#8c9eaa',dashed:true,points:xRange.map(x=>({x,y:yr}))});
    if (xr != null) {
      xRange[0] = Math.min(xRange[0],xr*.95); xRange[1] = Math.max(xRange[1],xr*1.05);
      series.unshift({color:'#8c9eaa',dashed:true,points:yRange.map(y=>({x:xr,y}))});
    }
    const excludedVolumePlot = s.recordX === 'temperature' && s.recordY === 'correctedPV';
    if (excludedVolumePlot) {
      if (!points.length) { xRange[0]=0; xRange[1]=1000; }
      const referencePoints=xRange.map(x=>({x,y:U.scales.nR*x}));
      yRange[0]=Math.min(yRange[0],...referencePoints.map(p=>p.y)); yRange[1]=Math.max(yRange[1],...referencePoints.map(p=>p.y));
      series.unshift({color:'#18857d',dashed:true,points:referencePoints,lineWidth:2});
    }
    const fit = s.fitEnabled ? GasAnalysis.linearRegression(points) : null;
    if (fit) {
      const endpoints = xRange.map(x=>({x,y:fit.slope*x+fit.intercept}));
      yRange[0] = Math.min(yRange[0],...endpoints.map(p=>p.y)); yRange[1] = Math.max(yRange[1],...endpoints.map(p=>p.y));
      series.push({color:'#ce8033',points:endpoints,lineWidth:2});
    }
    return {series,xRange,yRange,xLabel:xf.label,yLabel:yf.label,points,fit,excludedVolumePlot};
  }
  function drawRecordPlot() {
    if (active !== 'comparison') return;
    const s = session(), data = recordPlotData(); G.plot($('recordChart'),data);
    $('recordChart').setAttribute('aria-label',data.yLabel+' en fonction de '+data.xLabel);
    $('recordPlotHint').textContent = s.radiusRecords.length ? data.points.length+' point(s) sur '+s.radiusRecords.length+' relevé(s). Chaque point est un relevé conservé ; les points ne sont pas reliés.'+(data.points.length<s.radiusRecords.length?' Les mesures indisponibles sont omises.':'') : data.excludedVolumePlot ? 'Gardez le rayon fixe et relevez au moins trois températures distinctes avec « Relever ce rayon ».' : 'Relevez au moins une mesure avec « Relever ce rayon », puis changez le rayon pour comparer.';
    $('exportRecords').disabled = !s.radiusRecords.length;
    $('alphaValue').textContent = format(s.alpha,3);
    const best = GasAnalysis.optimalAlpha(s.radiusRecords);
    $('optimizeAlpha').disabled = !best;
    let error=0; for (const r of s.radiusRecords) error+=(r.ratio*(1-s.alpha*r.packing)-1)**2;
    $('alphaScore').textContent = s.radiusRecords.length ? 'Écart quadratique moyen à 1 (RMS) : '+format(Math.sqrt(error/s.radiusRecords.length),4)+' · chaque relevé a le même poids.' : 'α = 0 : aucune correction · α = 1 : volume matériel · α ≈ 2 : référence diluée 2D.';
    const significant = v => v == null || !Number.isFinite(v) ? 'indéfini' : v.toLocaleString('fr-FR',{maximumSignificantDigits:5});
    const fit = data.fit;
    const interceptSymbol=data.excludedVolumePlot?'c':'b';
    $('recordReference').textContent = data.excludedVolumePlot ? 'Pointillés verts : P(V − b) = nRT, pente nR = '+format(U.scales.nR,4)+' J/K, ordonnée à l’origine nulle. Orange : régression des mesures.'+(new Set(s.radiusRecords.map(r=>r.radius)).size>1?' Attention : ces relevés mélangent plusieurs rayons, donc plusieurs volumes exclus b. Pour tester un b constant, exportez puis effacez les relevés et gardez un seul rayon.':'') : '';
    $('fitEquation').textContent = !s.fitEnabled ? 'Régression désactivée.' : !fit ? (data.points.length<3 ? 'Il faut au moins 3 relevés valides pour estimer les incertitudes.' : 'Les abscisses doivent varier pour déterminer une pente.') : 'y = ('+significant(fit.slope)+') x '+(fit.intercept<0?'− ':'+ ')+significant(Math.abs(fit.intercept))+' · R² = '+significant(fit.rSquared);
    $('fitUncertainty').textContent = fit ? 'a = '+significant(fit.slope)+' ± '+significant(fit.slopeSE)+' ; '+interceptSymbol+' = '+significant(fit.intercept)+' ± '+significant(fit.interceptSE)+' (incertitudes-types, 1 σ) · n = '+fit.count+' · degrés de liberté = '+fit.degreesOfFreedom+'. Unités : a en unité Y / unité X ; '+interceptSymbol+' en unité Y.' : '';
    $('fitInterpretation').textContent = ['correctedRatio','correctedPVT'].includes(s.recordY) ? 'On cherche ici une grandeur constante : une pente compatible avec zéro et une valeur proche de '+(s.recordY==='correctedPVT'?'nR = '+format(U.scales.nR,4)+' J/K':'1')+'. Un faible R² peut donc être attendu : il ne mesure pas la qualité de cette correction. Multiplier par nR ne change pas R².' : data.excludedVolumePlot ? 'Régression y = aT + c : comparer a à nR et c à zéro. c est l’ordonnée à l’origine, distincte du volume exclu b. Un R² élevé ne suffit pas à valider la correction ; varier aussi la densité permet de la mettre à l’épreuve.' : '';
    const pages = Math.max(1,Math.ceil(s.radiusRecords.length/RECORD_PAGE_SIZE));
    s.recordPage = Math.max(0,Math.min(s.recordPage,pages-1));
    $('recordPageStatus').textContent = 'Page '+(s.recordPage+1)+' / '+pages+' · 100 lignes par page ; graphique, régression et export : tous les relevés.';
    $('recordsPrevious').disabled = s.recordPage===0; $('recordsNext').disabled = s.recordPage===pages-1;
    $('recordTable').innerHTML = s.radiusRecords.slice(s.recordPage*RECORD_PAGE_SIZE,(s.recordPage+1)*RECORD_PAGE_SIZE).map((r,i)=>'<tr><td>'+(s.recordPage*RECORD_PAGE_SIZE+i+1)+'</td><td>'+format(recordFields.radius.value(r))+'</td><td>'+format(r.ratio,3)+'</td><td>'+format(recordFields.correctedRatio.value(r),3)+'</td><td>'+format(recordFields.meanFreePath.value(r))+'</td><td>'+format(recordFields.packing.value(r))+'</td><td>'+format(recordFields.pressure.value(r),3)+'</td><td>'+format(recordFields.temperature.value(r))+'</td><td>'+format(recordFields.meanCollisionTime.value(r))+'</td><td>'+r.completedFlights+'</td><td>'+U.text('time',r.windowStart,3)+' → '+U.text('time',r.time,3)+'</td><td>'+(r.source==='mean'?'Toutes les parois':'Piston')+'</td></tr>').join('');
  }
  function render() { readings(); draw(); drawChart(); drawRecordPlot(); }
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
    if (active === 'comparison' && s.autoRecords && s.playing && s.sim.time >= nextRecordTime(s)) recordRadius();
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
  $('particleRadius').addEventListener('input', () => {
    $('radiusValue').value = format(+$('particleRadius').value / 1000 * U.scales.length * 1000) + ' mm';
  });
  $('applyRadius').addEventListener('click', () => {
    sharedRadius = Math.max(.005, Math.min(.07, +$('particleRadius').value / 1000));
    for (const [key, previous] of sessions) sessions.set(key, createSession(key, previous));
    accumulator = 0; previousFrame = 0; populateControls(); render();
    notify('Rayon commun appliqué à toutes les expériences : les simulations redémarrent. Les relevés précédents sont conservés avec leur rayon d’origine.');
  });
  function recordRadius() {
    const s = session(), m = s.sim.metrics;
    if (active !== 'comparison' || m.time < nextRecordTime(s) || ratio(m) == null || s.radiusRecords.length >= MAX_RECORDS) return;
    GasAnalysis.appendRecord(s.radiusRecords, {radius:s.radius, ratio:ratio(m), time:m.time, temperature:m.temperature, source:s.source, pressure:pressure(m), volume:m.volume, packing:m.packingFraction, meanFreePath:m.windowMeanFreePath, meanCollisionTime:m.windowMeanCollisionTime, completedFlights:m.windowCompletedFlights, windowStart:m.measurementStart}, MAX_RECORDS);
    s.lastRecordTime = m.time;
    if (s.radiusRecords.length >= MAX_RECORDS) { s.autoRecords=false; $('autoRecords').checked=false; }
    render(); notify('Relevé conservé. Un nouveau relevé attendra '+U.text('time',s.sim.measurementWindow,3)+' de temps simulé ; changer d’axe ou effacer la liste ne raccourcit pas cette attente.');
  }
  $('recordRadius').addEventListener('click', recordRadius);
  $('autoRecords').addEventListener('input', () => { session().autoRecords=$('autoRecords').checked; });
  $('linearFit').addEventListener('input', () => { session().fitEnabled=$('linearFit').checked; drawRecordPlot(); });
  function setAlpha(value) {
    if (!Number.isFinite(value) || value<0 || value>5) { $('alphaNumber').setAttribute('aria-invalid','true'); return; }
    const s=session(); s.alpha=value; $('alpha').value=value; $('alphaNumber').value=value; $('alphaNumber').setAttribute('aria-invalid','false');
    readings(); drawRecordPlot();
  }
  $('alpha').addEventListener('input',()=>setAlpha(+$('alpha').value));
  $('alphaNumber').addEventListener('input',()=>setAlpha($('alphaNumber').value.trim()===''?NaN:Number($('alphaNumber').value)));
  $('optimizeAlpha').addEventListener('click',()=>{
    const best=GasAnalysis.optimalAlpha(session().radiusRecords); if (!best) return;
    setAlpha(best.alpha); notify('α ajusté sur '+best.count+' relevés : minimum de Σ[Z(1 − αφ) − 1]², avec 0 ≤ α ≤ 5.'+(best.bounded?' Minimum atteint à une borne du réglage.':''));
  });
  $('plotExcludedVolume').addEventListener('click',()=>{const s=session();s.recordX='temperature';s.recordY='correctedPV';$('recordX').value=s.recordX;$('recordY').value=s.recordY;drawRecordPlot();});
  $('recordTemperature').addEventListener('input',()=>{$('recordTemperatureValue').value=U.text('temperature',+$('recordTemperature').value/200);});
  $('applyRecordTemperature').addEventListener('click',()=>{session().initialTemperature=+$('recordTemperature').value/200;reset();});
  for (const [id,key] of [['revisitPressure','pressure'],['revisitFree','free'],['revisitAdiabatic','adiabatic']]) $(id).addEventListener('click',()=>selectExperiment(key,true));
  $('recordsPrevious').addEventListener('click',()=>{session().recordPage--;drawRecordPlot();});
  $('recordsNext').addEventListener('click',()=>{session().recordPage++;drawRecordPlot();});
  for (const id of ['recordX','recordY']) $(id).addEventListener('input', () => { session()[id] = $(id).value; drawRecordPlot(); });
  $('exportRecords').addEventListener('click', () => {
    const number = v => v == null || !Number.isFinite(v) ? '' : v.toPrecision(10).replace('.',',');
    const rows = session().radiusRecords.map((r,i)=>[i+1,...Object.values(recordFields).map(f=>number(f.value(r))),number(U.value('time',r.windowStart)),number(U.value('time',r.time)),r.source,number(session().alpha)].join(';'));
    const header = 'releve;rayon_mm;PV_sur_nRT;P_V_moins_alpha_Voccupe_sur_nRT;P_V_moins_b_J;P_V_moins_alpha_Voccupe_sur_T_J_K;inverse_libre_parcours_mm_moins_1;inverse_temps_chocs_us_moins_1;libre_parcours_moyen_mm;surface_occupee_pct;pression_bar;temperature_K;temps_moyen_entre_chocs_us;trajets_complets_fenetre;debut_fenetre_ms;fin_fenetre_ms;capteur;alpha_analyse';
    const url=URL.createObjectURL(new Blob(['\uFEFF'+header+'\r\n'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='gaz-2d-releves.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('clearRadiusRecords').addEventListener('click', () => { session().radiusRecords = []; session().recordPage=0; render(); });
  $('initialTemperature').addEventListener('input', () => { $('initialTemperatureValue').value = U.text('temperature', +$('initialTemperature').value / 200); });
  $('applyInitial').addEventListener('click', () => { session().initialTemperature = +$('initialTemperature').value / 200; reset(); });
  $('pressureSource').addEventListener('input', () => { session().source = $('pressureSource').value; render(); });
  document.querySelectorAll('[data-chart]').forEach(button => button.addEventListener('click', () => changeChart(button.dataset.chart)));
  $('extraChart').addEventListener('input', () => changeChart($('extraChart').value));
  $('gamma').addEventListener('input', () => { const value = Number($('gamma').value), valid = value >= .1 && value <= 5; $('gamma').setAttribute('aria-invalid',String(!valid)); if (valid) { session().gamma = value; drawChart(); } });
  $('advanced').addEventListener('toggle',drawChart);
  $('export').addEventListener('click', () => {
    const s = session(); sample(s);
    const headings = ['experience','modele','N_marqueurs','rayon_mm','quantite_mol','temps_ms','volume_L','P_mesuree_bar','source_P','P_piston_bar','P_moyenne_bar','T_K','Tx_K','Ty_K','PV_sur_nRT','energie_J','travail_recu_J','chaleur_recue_J','delta_E_J','ecart_bilan_J','vitesse_piston_m_s','chocs_mutuels','fraction_surface','mode_thermique','temperature_thermostat_K','parois_thermiques','fraction_chocs_thermalises','chaleur_absorbee_J','chaleur_cedee_J','puissance_thermique_W','contacts_thermiques_multiples','trajet_id','en_mouvement','detente_libre'];
    const number = v => v == null || !Number.isFinite(v) ? '' : v.toPrecision(10).replace('.',',');
    const rows = s.history.flatMap(row => [row, ...(row.other ? [row.other] : [])].map(m => [active,m.particleModel,m.count,number(m.particleRadius * U.scales.length * 1000),number(U.scales.amount),number(U.value('time', m.time)),number(U.value('volume', m.volume)),number(U.value('pressure', pressure(m))),s.source,number(U.value('pressure', m.pressureByWall.right)),number(U.value('pressure', m.pressure)),number(U.value('temperature', m.temperature)),number(U.value('temperature', m.temperatureX)),number(U.value('temperature', m.temperatureY)),number(ratio(m)),number(U.value('energy', m.energy)),number(U.value('energy', m.pressureWork)),number(U.value('energy', m.heat)),number(U.value('energy', m.energy - s.initial.energy)),number(U.value('energy', m.balancePressureError)),number(U.value('velocity', m.pistonVelocity)),m.pairCollisions,number(m.packingFraction),m.thermalMode,number(U.value('temperature', m.bathTemperature)),m.thermalWalls.join('|'),number(m.accommodation),number(U.value('energy', m.heatIn)),number(U.value('energy', m.heatOut)),number(U.value('power', m.heatPower)),m.thermalContactFallbacks,row.runId,+row.moving,+row.freeExpansion].join(';')));
    const url = URL.createObjectURL(new Blob(['\uFEFF'+headings.join(';')+'\r\n'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href=url; a.download='gaz-2d-'+active+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify('Mesures exportées pour cette expérience'+(s.other ? ', avec une ligne par gaz et par instant.' : '.'));
  });
  window.addEventListener('resize',render); document.addEventListener('visibilitychange',()=>{previousFrame=0;accumulator=0;});
  selectExperiment('pressure'); requestAnimationFrame(frame);
  Object.defineProperty(window,'gaz2D',{value:{
    get metrics(){return {...session().sim.metrics};}, get comparisonMetrics(){return session().other ? {...session().other.metrics} : null;},
    get paused(){return !session().playing;}, get analysis(){const s=session();return {experiment:active,chartType:s.chart,pressureSource:s.source,count:N,history:s.history.map(r=>({...r})),collision:s.focus,plot:chartData(),recordPlot:recordPlotData(),alpha:s.alpha,autoRecords:s.autoRecords,radiusRecords:s.radiusRecords.map(r=>({...r,correctedRatio:recordFields.correctedRatio.value(r)})),run:s.run,seek:!!s.seek,tour:s.tour?.view ?? null,lastTour:s.lastTour};}
  },writable:false});
})();
