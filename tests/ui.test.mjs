import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../dist/physics.js', import.meta.url), 'utf8');
const analysis = readFileSync(new URL('../dist/analysis.js', import.meta.url), 'utf8');
const graphics = readFileSync(new URL('../dist/graphics.js', import.meta.url), 'utf8');
const tour = readFileSync(new URL('../dist/tour.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

// Only DOM and drawing primitives are replaced. The production application,
// animation loop and physics engine run unchanged, including all button handlers.
function laboratory() {
  const nodes = new Map();
  let pendingFrame, timestamp = 1000;
  const downloads = [], blobs = new Map(), histogramCalls = [];
  const context2d = new Proxy({}, { get: (o, key) => o[key] ?? (() => {}), set: (o, key, value) => (o[key] = value, true) });
  function element(tag, attrs = {}) {
    const listeners = new Map(), classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
    let storedValue = attrs.value ?? '';
    const node = {
      tagName: tag.toUpperCase(), attributes: { ...attrs }, dataset: {},
      disabled: Object.hasOwn(attrs, 'disabled'), checked: Object.hasOwn(attrs, 'checked'), hidden: Object.hasOwn(attrs, 'hidden'),
      style: { setProperty() {} }, focus() { this.focused = true; },
      textContent: '', innerHTML: '', width: 0, height: 0,
      min: attrs.min ?? '', max: attrs.max ?? '', step: attrs.step ?? '',
      classList: { toggle(name, force) { const on = force ?? !classes.has(name); if (on) classes.add(name); else classes.delete(name); return on; }, contains: name => classes.has(name) },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name] ?? null; },
      addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(listener); },
      dispatch(name, event = {}) { for (const listener of listeners.get(name) || []) listener({ target: this, type: name, ...event }); },
      click() { if (!this.disabled) { this.dispatch('click'); if (tag === 'a') downloads.push({ href: this.href, download: this.download, blob: blobs.get(this.href) }); } },
      getBoundingClientRect: () => ({ width: 800, height: tag === 'canvas' && attrs.id === 'chart' ? 220 : 380 }),
      getContext: () => context2d,
      querySelector(selector) { if (selector === '[value="free"]') return freeOption; throw new Error('Unexpected selector ' + selector); }
    };
    Object.defineProperty(node, 'value', {
      get() { return storedValue; },
      set(value) {
        if (attrs.type === 'range') {
          // HTML range inputs clamp programmatic writes to their current bounds.
          const lower = Number(this.min), upper = Math.max(lower, Number(this.max));
          storedValue = String(Math.max(lower, Math.min(upper, Number(value))));
        } else storedValue = String(value);
      }
    });
    for (const key of ['chart', 'experiment']) if (attrs['data-' + key]) node.dataset[key] = attrs['data-' + key];
    return node;
  }
  function attributes(text) {
    return Object.fromEntries([...text.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(match => [match[1], match[2] ?? '']));
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="[^"]+"[^>]*)>/g)) {
    const attrs = attributes(match[2]); nodes.set(attrs.id, element(match[1], attrs));
  }
  const freeOption = { disabled: false };
  const charts = [...nodes.values()].filter(node => node.dataset.chart);
  for (const match of html.matchAll(/<select\b([^>]*\bid="[^"]+"[^>]*)>([\s\S]*?)<\/select>/g)) {
    const attrs = attributes(match[1]);
    const selected = [...match[2].matchAll(/<option\b([^>]*)>/g)].map(m => attributes(m[1]));
    nodes.get(attrs.id).value = (selected.find(o => Object.hasOwn(o,'selected')) || selected[0]).value;
  }
  const document = {
    hidden: false,
    getElementById(id) { assert.ok(nodes.has(id), `Element ${id} exists in the real HTML`); return nodes.get(id); },
    querySelectorAll(selector) {
      if (selector === '[data-chart]') return charts;
      if (selector === 'input[type="range"]') return [...nodes.values()].filter(n => n.attributes.type === 'range');
      if (selector === '[data-experiment]') return [...nodes.values()].filter(n => n.dataset.experiment);
      throw new Error('Unexpected selector ' + selector);
    },
    createElement: tag => element(tag),
    addEventListener() {}
  };
  const window = { devicePixelRatio: 1, addEventListener() {} };
  const scope = vm.createContext({ document, window, console, Blob, performance: { now: () => 0 },
    URL: { createObjectURL(blob) { const key = 'blob:test-measures-' + blobs.size; blobs.set(key, blob); return key; }, revokeObjectURL() {} },
    setTimeout() {},
    requestAnimationFrame(callback) { pendingFrame = callback; }
  });
  vm.runInContext(physics, scope, { filename: 'physics.js' });
  vm.runInContext(analysis, scope, { filename: 'analysis.js' });
  vm.runInContext(readFileSync(new URL('../dist/units.js', import.meta.url), 'utf8'), scope);
  vm.runInContext(graphics, scope, { filename: 'graphics.js' });
  const histogram = scope.GasAnalysis.histogram;
  scope.GasAnalysis.histogram = (...args) => {
    const result = histogram(...args);
    histogramCalls.push(result);
    if (histogramCalls.length > 8) histogramCalls.shift();
    return result;
  };
  vm.runInContext(tour, scope, { filename: 'tour.js' });
  vm.runInContext(app, scope, { filename: 'app.js' });
  function frame() { const callback = pendingFrame; pendingFrame = null; callback(timestamp); timestamp += 1000 / 60; }
  frame();
  return {
    nodes, charts, freeOption, downloads, histogramCalls,
    get metrics() { return window.gaz2D.metrics; },
    get comparisonMetrics() { return window.gaz2D.comparisonMetrics; },
    get paused() { return window.gaz2D.paused; },
    get analysis() { return window.gaz2D.analysis; },
    click(id) { nodes.get(id).click(); },
    input(id, value) { const node = nodes.get(id); assert.ok(!node.disabled, `${id} is available`); node.value = value; node.dispatch('input'); },
    check(id, value) { const node = nodes.get(id); assert.ok(!node.disabled, `${id} is available`); node.checked = value; node.dispatch('input'); },
    finishTour() { for(let i=0;i<3000&&window.gaz2D.analysis.tour;i++)frame();assert.equal(window.gaz2D.analysis.tour,null);assert.equal(window.gaz2D.analysis.lastTour.phase,'done'); },
    advance(seconds) { for (let i = 0; i < Math.ceil(seconds * 60); i++) frame(); }
  };
}

test('guided visit starts with pressure, fixes N at 1000 and removes particle count and cycle controls',()=>{
  const lab=laboratory();assert.equal(lab.metrics.count,1000);assert.equal(lab.analysis.experiment,'pressure');
  for(const id of ['particles','particleNumber','preset-cycles','cycleSelect'])assert.ok(!lab.nodes.has(id));
  lab.advance(.4);assert.ok(lab.metrics.pressure>0);assert.equal(lab.metrics.work,0);assert.equal(lab.metrics.heat,0);
});
test('all five experience tabs retain independent state, and only the visible experiment evolves',()=>{
  const lab=laboratory();lab.advance(.4);lab.click('pause');const time=lab.metrics.time;
  for(const key of ['heat','free','adiabatic','comparison']){
    lab.click('tab-'+key);assert.equal(lab.analysis.experiment,key);assert.equal(lab.metrics.count,1000);lab.advance(.1);
    assert.equal(lab.nodes.get('workbench').getAttribute('aria-labelledby'),'tab-'+key);
  }
  assert.equal(lab.comparisonMetrics,null);assert.equal(lab.metrics.particleModel,'hard-disks');
  lab.click('tab-pressure');assert.equal(lab.metrics.time,time);assert.equal(lab.paused,true);
});
test('keyboard arrows, Home and End navigate experience tabs with correct focus',()=>{
  const lab=laboratory();lab.nodes.get('tab-pressure').dispatch('keydown',{key:'ArrowRight',preventDefault(){}});
  assert.equal(lab.analysis.experiment,'heat');assert.ok(lab.nodes.get('tab-heat').focused);
  lab.nodes.get('tab-heat').dispatch('keydown',{key:'End',preventDefault(){}});assert.equal(lab.analysis.experiment,'comparison');
  lab.nodes.get('tab-comparison').dispatch('keydown',{key:'Home',preventDefault(){}});assert.equal(lab.analysis.experiment,'pressure');
});
test('pressure illustration follows a future collision, restores playback and keeps work controls out of this lesson',()=>{
  const lab=laboratory();lab.input('timeScale',.25);const initial=lab.metrics.time;lab.click('illustrate');
  assert.ok(lab.analysis.tour);assert.equal(lab.nodes.get('timeScale').disabled,true);
  assert.equal(lab.nodes.get('energyBalance').hidden,true);assert.equal(lab.nodes.get('motionChoice').hidden,true);assert.equal(lab.nodes.get('workLesson').hidden,true);
  lab.finishTour();const e=lab.analysis.lastTour.events[0];assert.ok(e.time>initial);assert.equal(e.wall,'right');assert.ok(e.impulse>0);assert.equal(e.wallVelocity,0);
  assert.ok(Math.abs(e.energyAfter-e.energyBefore)<1e-10);assert.equal(lab.paused,false);
  assert.equal(lab.nodes.get('timeScale').value,'0.25');assert.equal(lab.nodes.get('timeScale').disabled,false);assert.equal(lab.nodes.get('tourStatus').hidden,true);
  const time=lab.metrics.time;lab.advance(.4);assert.ok(lab.metrics.time>time+.08&&lab.metrics.time<time+.12);
});
test('pressure gauge uses the true window impulse and piston length-time denominator',()=>{
  const lab=laboratory();lab.input('timeScale',1);lab.advance(2.5);const m=lab.metrics;
  assert.ok(Math.abs(m.pressureByWall.right-m.impulseByWall.right/m.pistonLengthTime)<1e-10);
  assert.ok(Math.abs(m.pistonLengthTime-15)<1e-9);assert.equal(m.work,0);
  assert.match(lab.nodes.get('pressureCalculation').textContent,/P = ΣJ/);
});
test('work illustration launches the selected moving piston, shows its energy exchange and can be stopped',()=>{
  const lab=laboratory();lab.click('tab-adiabatic');lab.input('motionAction','compression');lab.input('duration',60);lab.click('illustrate');
  assert.equal(lab.nodes.get('target').disabled,true);assert.equal(lab.nodes.get('motionAction').disabled,true);lab.finishTour();
  const e=lab.analysis.lastTour.events[0];assert.ok(e.wallVelocity<0);assert.ok(e.work>0);assert.ok(Math.abs(e.work+e.wallVelocity*e.impulse)<1e-9);
  assert.equal(lab.nodes.get('workLesson').hidden,false);assert.equal(lab.nodes.get('pressureLesson').hidden,true);
  lab.click('stop');const work=lab.metrics.work;lab.advance(.5);assert.equal(lab.metrics.work,work);
});
test('thermal illustration shows both energy transfer signs in order and restores editable controls',()=>{
  const lab=laboratory();lab.click('tab-heat');lab.click('illustrate');assert.equal(lab.nodes.get('bathTemperature').disabled,true);lab.finishTour();
  const events=lab.analysis.lastTour.events;assert.equal(events.length,2);assert.ok(events[0].heat>0&&events[1].heat<0);
  for(const e of events){assert.equal(e.wall,'left');assert.equal(e.thermal,true);assert.equal(e.work,0);assert.ok(Math.abs(e.heat-e.energyAfter+e.energyBefore)<1e-10);}
  assert.equal(lab.nodes.get('bathTemperature').disabled,false);assert.equal(lab.paused,false);assert.ok(Math.abs(lab.metrics.balanceError)<1e-8);
});
test('thermal slider changes future collisions only; isolation stops Q without deleting past exchanges',()=>{
  const lab=laboratory();lab.click('tab-heat');lab.input('timeScale',1);lab.advance(.5);lab.click('pause');
  const m=lab.metrics;lab.input('bathTemperature',100);assert.equal(lab.metrics.energy,m.energy);assert.equal(lab.metrics.heat,m.heat);assert.equal(lab.metrics.bathTemperature,.5);
  lab.input('thermalMode','isolated');lab.click('pause');lab.advance(.5);assert.equal(lab.metrics.heat,m.heat);assert.equal(lab.metrics.work,0);
});
test('Joule–Gay–Lussac doubles V without changing E or T, with simulation and plot visible together',()=>{
  const lab=laboratory();lab.click('tab-free');const before=lab.metrics;lab.advance(.2);lab.click('start');
  assert.equal(lab.metrics.width,18);assert.equal(lab.metrics.volume,2*before.volume);assert.ok(Math.abs(lab.metrics.energy-before.energy)<1e-8);assert.equal(lab.metrics.work,0);assert.equal(lab.metrics.heat,0);
  lab.advance(.5);assert.ok(Math.abs(lab.metrics.temperature-before.temperature)<1e-9);assert.ok(lab.nodes.has('chamber')&&lab.nodes.has('chart'));assert.equal(lab.nodes.get('zoomPanel').hidden,true);
  lab.click('chart-ratio');assert.equal(lab.analysis.chartType,'ratio');assert.equal(lab.analysis.plot.yLabel,'PV / (nRT)');
  assert.equal(lab.analysis.plot.series[0].points[0].y,1);
});
test('PV/T graph uses measured pressure and actual temperature rather than imposing the ideal reference',()=>{
  const lab=laboratory();lab.click('tab-free');lab.advance(.3);lab.click('chart-ratio');
  const row=lab.analysis.history.at(-1),last=lab.analysis.plot.series[1].points.at(-1);
  assert.ok(Math.abs(last.y-row.pressure*row.volume/(1000*row.temperature))<1e-9);
  assert.ok(Math.abs(last.y-1)>1e-3);
  lab.input('pressureSource','piston');const r=lab.analysis.history.at(-1);assert.ok(Math.abs(lab.analysis.plot.series[1].points.at(-1).y-r.pressureByWall.right*r.volume/(1000*r.temperature))<1e-9);
});
test('free expansion has a gap in P–V instead of a fictitious work segment',()=>{
  const lab=laboratory();lab.click('tab-free');lab.advance(.2);lab.click('start');lab.input('extraChart','pv');
  assert.ok(lab.analysis.plot.series[0].points.some(p=>Number.isNaN(p.x)));assert.equal(lab.metrics.work,0);
});
test('one adiabatic tab handles both directions with insulated walls and the correct work sign',()=>{
  const lab=laboratory();
  for(const key of ['expansion','compression']){
    lab.click('tab-adiabatic');lab.input('motionAction',key);lab.click('reset');lab.input('duration',40);lab.input('timeScale',4);lab.click('start');lab.advance(.8);
    assert.equal(lab.metrics.heat,0);assert.equal(lab.metrics.thermalMode,'isolated');assert.ok(Math.abs(lab.metrics.balanceError)<1e-7);
    assert.ok(key==='compression'?lab.metrics.work>0:lab.metrics.work<0);
  }
});
test('radius experiment uses one interacting gas, records measurements and resets only its radius',()=>{
  const lab=laboratory();lab.click('tab-comparison');
  assert.equal(lab.comparisonMetrics,null);assert.equal(lab.metrics.particleModel,'hard-disks');
  lab.input('timeScale',4);lab.advance(1.3);assert.ok(lab.metrics.pairCollisions>0);
  lab.click('recordRadius');assert.match(lab.nodes.get('radiusRecords').innerHTML,/PV/);
  const old=lab.metrics;lab.input('particleRadius',70);assert.equal(lab.metrics.particleRadius,.04);
  lab.click('applyRadius');assert.equal(lab.metrics.particleRadius,.07);assert.equal(lab.metrics.time,0);
  assert.equal(lab.metrics.volume,old.volume);assert.ok(Math.abs(lab.metrics.temperature-1.5)<1e-9);
  assert.match(lab.nodes.get('radiusRecords').innerHTML,/PV/);assert.equal(lab.nodes.get('recordRadius').disabled,true);
  lab.click('capture');lab.advance(.2);assert.ok(lab.paused);assert.equal(lab.analysis.collision.kind,'pair');
  lab.click('tab-pressure');assert.equal(lab.metrics.particleRadius,.04);
});
test('slow playback changes elapsed simulated time, and single-step is 0.02 without unpausing',()=>{
  const lab=laboratory();lab.input('timeScale',.05);lab.advance(1);assert.ok(lab.metrics.time>=.04&&lab.metrics.time<.06);
  lab.click('pause');const time=lab.metrics.time;lab.click('step');assert.ok(Math.abs(lab.metrics.time-time-.02)<1e-10);assert.ok(lab.paused);
});
test('model and initial temperature changes reset only this experience and always keep N=1000',()=>{
  const lab=laboratory();lab.click('tab-free');assert.equal(lab.metrics.particleModel,'hard-disks');
  lab.input('initialTemperature',400);lab.click('applyInitial');assert.equal(lab.metrics.count,1000);assert.ok(Math.abs(lab.metrics.temperature-2)<1e-10);
  lab.click('start');assert.equal(lab.metrics.heat,0);assert.equal(lab.metrics.work,0);
  lab.click('tab-pressure');assert.equal(lab.metrics.particleModel,'hard-disks');assert.ok(Math.abs(lab.metrics.temperature-1.5)<1e-10);
});
test('all seven charts remain available and gamma input is validated',()=>{
  const lab=laboratory();lab.advance(.2);
  for(const key of ['time','ratio','pv','pt','vt','pvt','log']){lab.input('extraChart',key);assert.equal(lab.analysis.chartType,key);assert.ok(lab.analysis.plot.series.length);}
  lab.input('gamma',0);assert.equal(lab.nodes.get('gamma').getAttribute('aria-invalid'),'true');lab.input('gamma',1.4);assert.equal(lab.nodes.get('gamma').getAttribute('aria-invalid'),'false');
});
test('CSV contains hard-disk radius, measured ratios and first-law balances',async()=>{
  const lab=laboratory();lab.click('tab-comparison');lab.advance(.4);lab.click('export');const csv=await lab.downloads.at(-1).blob.text();
  const lines=csv.trim().replace(/^\uFEFF/,'').split(/\r?\n/);const headers=lines.shift().split(';');const rows=lines.map(line=>Object.fromEntries(line.split(';').map((v,i)=>[headers[i],v])));
  assert.ok(rows.length>0);assert.ok(rows.every(r=>r.modele==='hard-disks'));assert.ok(rows.every(r=>Number(r.rayon_mm.replace(',','.'))>0));
  for(const row of rows){assert.equal(row.N_marqueurs,'1000');if(row.P_mesuree_bar){const num=k=>Number(row[k].replace(',','.'));assert.ok(Math.abs(num('PV_sur_nRT')-100*num('P_mesuree_bar')*num('volume_L')/(num('T_K')/3))<1e-5);assert.ok(Math.abs(num('ecart_bilan_J'))<1e-7);}}
});

test('pause, reset and tab changes safely interrupt camera sequences without changing the selected speed',()=>{
  const lab=laboratory();lab.input('timeScale',2);lab.click('illustrate');lab.advance(.5);lab.click('pause');
  assert.equal(lab.analysis.tour,null);assert.equal(lab.paused,true);assert.equal(lab.nodes.get('timeScale').value,'2');
  const time=lab.metrics.time;lab.advance(.3);assert.equal(lab.metrics.time,time);
  lab.click('illustrate');lab.advance(.3);lab.click('tab-free');lab.click('tab-pressure');assert.equal(lab.analysis.tour,null);assert.equal(lab.nodes.get('illustrate').disabled,false);
  lab.click('illustrate');lab.advance(.3);lab.click('reset');assert.equal(lab.analysis.tour,null);assert.equal(lab.metrics.time,0);assert.equal(lab.nodes.get('tourStatus').hidden,true);
});
test('thermal illustration is unavailable with insulation or zero accommodation',()=>{
  const lab=laboratory();lab.click('tab-heat');lab.input('thermalMode','isolated');assert.equal(lab.nodes.get('illustrate').disabled,true);
  lab.input('thermalMode','thermostat');assert.equal(lab.nodes.get('illustrate').disabled,false);lab.input('accommodation',0);assert.equal(lab.nodes.get('illustrate').disabled,true);
});

test('visible units and plot coordinates share fixed scales across presets and resets',()=>{
  const lab=laboratory();
  assert.equal(lab.nodes.get('volume').textContent,'1,00 L');
  assert.equal(lab.nodes.get('temperature').textContent,'300,00 K');
  lab.input('extraChart','pvt');
  const ideal=lab.analysis.plot.series[0].points;
  for(const point of ideal) assert.ok(Math.abs(point.y-point.x/3)<1e-9);
  assert.equal(lab.analysis.plot.xLabel,'T (K)');assert.equal(lab.analysis.plot.yLabel,'PV (J)');
  lab.click('tab-free');assert.equal(lab.nodes.get('volume').textContent,'0,82 L');
  lab.click('start');assert.equal(lab.nodes.get('volume').textContent,'1,64 L');
  assert.equal(lab.nodes.get('temperature').textContent,'300,00 K');
  lab.click('tab-pressure');lab.input('initialTemperature',600);lab.click('applyInitial');
  assert.equal(lab.nodes.get('temperature').textContent,'600,00 K');
  assert.equal(lab.nodes.get('volume').textContent,'1,00 L');
});

test('record axes use immutable saved measurements and export all radii independently of live history',async()=>{
  const lab=laboratory();lab.click('tab-comparison');
  assert.equal(lab.analysis.recordPlot.points.length,0);assert.equal(lab.nodes.get('exportRecords').disabled,true);
  lab.input('timeScale',4);lab.advance(1.3);lab.click('recordRadius');
  const saved=lab.analysis.radiusRecords[0];assert.ok(saved.meanFreePath>0);assert.ok(saved.completedFlights>0);
  lab.input('particleRadius',70);lab.click('applyRadius');
  assert.equal(lab.analysis.radiusRecords[0].meanFreePath,saved.meanFreePath);
  lab.input('recordX','packing');lab.input('recordY','meanFreePath');
  const point=lab.analysis.recordPlot.points[0];
  assert.ok(Math.abs(point.x-saved.packing*100)<1e-9);
  assert.ok(point.y>saved.meanFreePath);assert.equal(lab.analysis.recordPlot.xLabel,'Surface occupée (%)');
  lab.input('timeScale',4);lab.advance(1.3);lab.click('recordRadius');
  assert.equal(lab.analysis.recordPlot.points.length,2);
  lab.click('exportRecords');const csv=await lab.downloads.at(-1).blob.text();
  assert.match(csv,/libre_parcours_moyen_mm/);assert.equal(csv.trim().split(/\r?\n/).length,3);
  for(const key of ['radius','ratio','packing','meanFreePath','temperature','pressure','meanCollisionTime','completedFlights']) {
    lab.input('recordX',key);lab.input('recordY',key);assert.equal(lab.analysis.recordPlot.points.length,2);
    assert.equal(lab.analysis.recordPlot.points[0].x,lab.analysis.recordPlot.points[0].y);
  }
  lab.click('clearRadiusRecords');assert.equal(lab.analysis.recordPlot.points.length,0);assert.equal(lab.nodes.get('exportRecords').disabled,true);
});
