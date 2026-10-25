import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const DEFAULT_RADIUS=.0005/Math.cbrt(1e-3/82.5);
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../dist/physics.js', import.meta.url), 'utf8');
const analysis = readFileSync(new URL('../dist/analysis.js', import.meta.url), 'utf8');
const graphics = readFileSync(new URL('../dist/graphics.js', import.meta.url), 'utf8');
const tour = readFileSync(new URL('../dist/tour.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

// Only DOM and drawing primitives are replaced. The production application,
// animation loop and physics engine run unchanged, including all button handlers.
function laboratory({welcome=false}={}) {
  const nodes = new Map();
  const documentListeners=new Map(),textWrites=new Map(),scrollCalls=[];
  let pendingFrame, timestamp = 1000;
  const downloads = [], blobs = new Map(), histogramCalls = [];
  const context2d = new Proxy({}, { get: (o, key) => o[key] ?? (() => {}), set: (o, key, value) => (o[key] = value, true) });
  function element(tag, attrs = {}) {
    const listeners = new Map(), classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
    let storedValue = attrs.value ?? '';
    const node = {
      tagName: tag.toUpperCase(), attributes: { ...attrs }, dataset: {},
      disabled: Object.hasOwn(attrs, 'disabled'), checked: Object.hasOwn(attrs, 'checked'), hidden: Object.hasOwn(attrs, 'hidden'),
      setPointerCapture() {}, style: { setProperty() {} }, focus() { this.focused = true; },
      textContent: '', innerHTML: '', width: 0, height: 0,
      min: attrs.min ?? '', max: attrs.max ?? '', step: attrs.step ?? '',
      classList: { toggle(name, force) { const on = force ?? !classes.has(name); if (on) classes.add(name); else classes.delete(name); return on; }, contains: name => classes.has(name) },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name] ?? null; },
      closest(selector) { return selector==='#appHeader, #appMain'&&!/^tutorial/.test(attrs.id??'')?this:null; },
      addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(listener); },
      dispatch(name, event = {}) { for (const listener of listeners.get(name) || []) listener({ target: this, type: name, ...event }); },
      click() { if (!this.disabled) { this.dispatch('click'); if (tag === 'a') downloads.push({ href: this.href, download: this.download, blob: blobs.get(this.href) }); } },
      getBoundingClientRect: () => ({ left:0, top:0, width: 800, height: tag === 'canvas' && attrs.id === 'chart' ? 220 : 380 }),
      getContext: () => context2d,
      querySelector(selector) { if (selector === '[value="free"]') return freeOption; throw new Error('Unexpected selector ' + selector); }
    };
    let textContent='';
    Object.defineProperty(node,'textContent',{get:()=>textContent,set(value){textContent=value;textWrites.set(attrs.id,(textWrites.get(attrs.id)??0)+1);}});
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
    addEventListener(type,listener) { if(!documentListeners.has(type))documentListeners.set(type,[]);documentListeners.get(type).push(listener); }
  };
  const window = { devicePixelRatio: 1, addEventListener() {} };
  const scope = vm.createContext({ document, window, console, Blob, scrollY:0, scrollTo(options){scrollCalls.push(options);}, performance: { now: () => 0 },
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
  vm.runInContext(readFileSync(new URL('../dist/lessons.js',import.meta.url),'utf8'),scope);
  vm.runInContext(readFileSync(new URL('../dist/tutorial.js',import.meta.url),'utf8'),scope);
  vm.runInContext(app, scope, { filename: 'app.js' });
  if(!welcome)nodes.get('tutorialDismiss').click();
  function frame() { const callback = pendingFrame; pendingFrame = null; callback(timestamp); timestamp += 1000 / 60; }
  frame();
  return {
    nodes, charts, freeOption, downloads, histogramCalls,textWrites,scrollCalls,
    documentEvent(type,event) { for(const listener of documentListeners.get(type)??[])listener({preventDefault(){},...event}); },
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
  for(const id of ['particles','particleNumber','preset-cycles','cycleSelect','tab-heat'])assert.ok(!lab.nodes.has(id));
  lab.advance(.4);assert.ok(lab.metrics.pressure>0);assert.equal(lab.metrics.work,0);assert.equal(lab.metrics.heat,0);
});
test('all six experience tabs retain independent state, and only the visible experiment evolves',()=>{
  const lab=laboratory();lab.advance(.4);lab.click('pause');const time=lab.metrics.time;
  for(const key of ['temperature','free','adiabatic','cycles','comparison']){
    lab.click('tab-'+key);assert.equal(lab.analysis.experiment,key);assert.equal(lab.metrics.count,1000);lab.advance(.1);
    assert.equal(lab.nodes.get('workbench').getAttribute('aria-labelledby'),'tab-'+key);
  }
  assert.equal(lab.comparisonMetrics,null);assert.equal(lab.metrics.particleModel,'hard-disks');
  lab.click('tab-pressure');assert.equal(lab.metrics.time,time);assert.equal(lab.paused,true);
});
test('keyboard arrows, Home and End navigate experience tabs with correct focus',()=>{
  const lab=laboratory();lab.nodes.get('tab-pressure').dispatch('keydown',{key:'ArrowRight',preventDefault(){}});
  assert.equal(lab.analysis.experiment,'temperature');assert.ok(lab.nodes.get('tab-temperature').focused);
  lab.nodes.get('tab-temperature').dispatch('keydown',{key:'End',preventDefault(){}});assert.equal(lab.analysis.experiment,'comparison');
  lab.nodes.get('tab-comparison').dispatch('keydown',{key:'Home',preventDefault(){}});assert.equal(lab.analysis.experiment,'pressure');
});
test('pressure illustration follows a future collision, restores playback and keeps work controls out of this lesson',()=>{
  const lab=laboratory();lab.input('timeScale',.25);const initial=lab.metrics.time;lab.click('illustrate');
  assert.ok(lab.analysis.tour);assert.equal(lab.nodes.get('timeScale').disabled,true);
  assert.equal(lab.nodes.get('energyBalance').hidden,true);assert.equal(lab.nodes.get('motionChoice').hidden,true);assert.equal(lab.nodes.get('workLesson').hidden,true);
  lab.finishTour();const e=lab.analysis.lastTour.events[0];assert.ok(e.time>initial);assert.equal(e.wall,'right');assert.ok(e.impulse>0);assert.equal(e.wallVelocity,0);
  assert.ok(Math.abs(e.energyAfter-e.energyBefore)<1e-10);assert.equal(lab.analysis.lesson.phase,'overview');assert.equal(lab.analysis.lesson.zoom,0);
  assert.ok(!lab.nodes.has('illustratePressureSum'));lab.advance(12);assert.equal(lab.analysis.lesson.phase,'done');lab.click('illustrate');assert.ok(lab.analysis.returning);lab.advance(3.2);assert.equal(lab.paused,false);
  assert.equal(lab.nodes.get('timeScale').value,'0.25');assert.equal(lab.nodes.get('timeScale').disabled,false);assert.equal(lab.nodes.get('tourStatus').hidden,true);
  const time=lab.metrics.time;lab.advance(.4);assert.ok(lab.metrics.time>time+.08&&lab.metrics.time<time+.12);
});
test('pressure gauge uses the true window impulse and piston length-time denominator',()=>{
  const lab=laboratory();lab.input('timeScale',1);lab.advance(2.5);const m=lab.metrics;
  assert.ok(Math.abs(m.pressureByWall.right-m.impulseByWall.right/m.pistonLengthTime)<1e-10);
  assert.ok(Math.abs(m.pistonLengthTime-15)<1e-9);assert.equal(m.work,0);
  assert.match(lab.nodes.get('pressureCalculation').textContent,/P = ΣJ/);
});
test('work illustration requires a correct retry, then manual piston travel, with all controls on the canvas',()=>{
 const lab=laboratory();lab.click('tab-adiabatic');lab.click('illustrate');
 assert.equal(lab.analysis.lesson.case,'compression');assert.equal(lab.nodes.get('motionAction').disabled,true);
 assert.ok(html.indexOf('id="continueSpeed"')<html.indexOf('id="comparisonChambers"'));
 const seen=[];
 for(let i=0;i<120&&lab.analysis.lesson.phase!=='free'&&lab.analysis.lesson.phase!=='unavailable';i++){
  const l=lab.analysis.lesson;
  if(l.collisionPhase==='compare'){
   seen.push(l.case);const time=lab.metrics.time;
   assert.equal(lab.nodes.get('continueSpeed').disabled,true);assert.equal(lab.nodes.get('nextWorkCase').hidden,true);
   const wrong=l.case==='fixed'?'speedLess':'speedEqual';lab.click(wrong);
   assert.match(lab.nodes.get('speedFeedback').textContent,/Essayez encore.*Indice/);
   assert.doesNotMatch(lab.nodes.get('speedFeedback').textContent,/v entrante [<=>]/);
   assert.equal(lab.nodes.get(wrong).getAttribute('aria-invalid'),'true');
   assert.equal(lab.nodes.get('continueSpeed').disabled,true);lab.click('continueSpeed');lab.advance(2);
   assert.equal(lab.metrics.time,time);assert.equal(lab.analysis.lesson.collisionPhase,'compare');
   lab.click(l.case==='fixed'?'speedEqual':l.case==='compression'?'speedGreater':'speedLess');
   assert.equal(lab.nodes.get(wrong).getAttribute('aria-invalid'),'false');assert.equal(lab.nodes.get('continueSpeed').disabled,false);
   assert.equal(lab.nodes.get('speedWorkSign').hidden,false);assert.match(lab.nodes.get('speedWorkSign').textContent,l.case==='fixed'?/nul.*W = 0/:l.case==='compression'?/positif.*W > 0/:/négatif.*W < 0/);
   lab.click('continueSpeed');assert.equal(lab.nodes.get('workSpeedQuestion').hidden,true);
  }
  if(l.window?.canDrag){
   assert.equal(lab.nodes.get('workPistonHandle').hidden,false);
   lab.nodes.get('workPistonHandle').dispatch('keydown',{key:l.case==='compression'?'Home':'End',preventDefault(){}});
  }
  if(l.phase==='hold'){
   const time=lab.metrics.time;lab.advance(2);assert.equal(lab.metrics.time,time);
   assert.equal(lab.nodes.get('nextWorkCase').hidden,false);lab.click('nextWorkCase');
  }
  lab.advance(1);
 }
 assert.equal(lab.analysis.lesson.phase,'free');assert.deepEqual(seen,['compression','expansion','fixed']);
 const results=lab.analysis.lesson.results;assert.equal(results.length,3);
 assert.ok(results[0].work>0);assert.ok(results[1].work<0);assert.equal(results[2].work,0);
 assert.match(lab.nodes.get('workCases').innerHTML,/Compression.*Détente.*Repos/);
 lab.advance(3);assert.equal(lab.nodes.get('workPistonHandle').hidden,false);
 const handle=lab.nodes.get('workPistonHandle'),x=parseFloat(handle.style.left)+17;
 handle.dispatch('pointerdown',{pointerId:7,clientX:x,preventDefault(){}});
 handle.dispatch('pointermove',{pointerId:7,clientX:x+10000});handle.dispatch('pointerup');
 assert.equal(lab.analysis.lesson.window.requestedWidth,lab.analysis.lesson.window.maxWidth);
 lab.advance(1);assert.ok(lab.metrics.width>results[2].startWidth);
 lab.click('restartWorkPath');assert.equal(lab.analysis.lesson.window.work,0);assert.equal(lab.analysis.lesson.window.strokes.length,0);
 lab.click('illustrate');lab.advance(3.2);assert.equal(lab.analysis.lesson,null);assert.equal(lab.paused,false);
 assert.equal(lab.nodes.get('workMotionRibbon').hidden,true);assert.equal(handle.hidden,true);
 const work=lab.metrics.work;lab.advance(.3);assert.equal(lab.metrics.work,work);
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
test('radius experiment uses one interacting gas, records measurements and shares its radius across experiments',()=>{
  const lab=laboratory();lab.click('tab-comparison');
  assert.equal(lab.comparisonMetrics,null);assert.equal(lab.metrics.particleModel,'hard-disks');
  lab.input('timeScale',4);lab.advance(1.3);assert.ok(lab.metrics.pairCollisions>0);
  lab.click('recordRadius');assert.match(lab.nodes.get('radiusRecords').innerHTML,/PV/);
  const old=lab.metrics;lab.input('particleRadius',70);assert.equal(lab.metrics.particleRadius,DEFAULT_RADIUS);
  lab.click('applyRadius');assert.equal(lab.metrics.particleRadius,.07);assert.equal(lab.metrics.time,0);
  assert.equal(lab.metrics.volume,old.volume);assert.ok(Math.abs(lab.metrics.temperature-1.5)<1e-9);
  assert.match(lab.nodes.get('radiusRecords').innerHTML,/PV/);assert.equal(lab.nodes.get('recordRadius').disabled,true);
  lab.click('capture');lab.advance(.2);assert.ok(lab.paused);assert.equal(lab.analysis.collision.kind,'pair');
  for (const key of ['pressure','free','adiabatic']) { lab.click('tab-'+key);assert.equal(lab.metrics.particleRadius,.07);lab.click('reset');assert.equal(lab.metrics.particleRadius,.07); }
  lab.click('tab-comparison');assert.equal(lab.analysis.radiusRecords[0].radius,DEFAULT_RADIUS);
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
  for(const key of ['radius','ratio','correctedRatio','packing','meanFreePath','temperature','pressure','meanCollisionTime','completedFlights']) {
    lab.input('recordX',key);lab.input('recordY',key);assert.equal(lab.analysis.recordPlot.points.length,2);
    assert.equal(lab.analysis.recordPlot.points[0].x,lab.analysis.recordPlot.points[0].y);
  }
  lab.click('clearRadiusRecords');assert.equal(lab.analysis.recordPlot.points.length,0);assert.equal(lab.nodes.get('exportRecords').disabled,true);
});

test('recording excludes warm-up, blocks overlap including after clearing, and saves the corrected ratio',async()=>{
  const lab=laboratory();lab.click('tab-comparison');lab.input('timeScale',4);
  lab.advance(.8);lab.click('recordRadius');assert.equal(lab.analysis.radiusRecords.length,0);
  lab.advance(.5);lab.click('recordRadius');assert.equal(lab.analysis.radiusRecords.length,1);
  const first=lab.analysis.radiusRecords[0];assert.ok(first.windowStart>=2);
  assert.ok(Math.abs(first.time-first.windowStart-2)<1e-9);
  assert.equal(first.correctedRatio,first.ratio*(1-first.packing));
  assert.equal(first.meanFreePath,lab.metrics.windowMeanFreePath);
  lab.click('recordRadius');assert.equal(lab.analysis.radiusRecords.length,1);
  lab.input('recordY','correctedRatio');assert.equal(lab.analysis.recordPlot.points[0].y,first.correctedRatio);
  lab.click('pause');lab.advance(1);lab.click('recordRadius');assert.equal(lab.analysis.radiusRecords.length,1);
  lab.click('pause');lab.advance(.3);lab.click('recordRadius');assert.equal(lab.analysis.radiusRecords.length,1);
  lab.advance(.3);lab.click('recordRadius');assert.equal(lab.analysis.radiusRecords.length,2);
  const second=lab.analysis.radiusRecords[1];assert.ok(second.windowStart>=first.time);
  lab.click('exportRecords');const csv=await lab.downloads.at(-1).blob.text();
  const lines=csv.trim().replace(/^\uFEFF/,'').split(/\r?\n/), header=lines[0].split(';');
  const row=Object.fromEntries(lines[1].split(';').map((v,i)=>[header[i],v]));
  assert.ok(Math.abs(Number(row.P_V_moins_alpha_Voccupe_sur_nRT.replace(',','.'))-first.correctedRatio)<1e-8);
  assert.ok(Number(row.fin_fenetre_ms.replace(',','.'))>Number(row.debut_fenetre_ms.replace(',','.')));
  lab.click('clearRadiusRecords');lab.click('recordRadius');assert.equal(lab.analysis.radiusRecords.length,0);
  assert.equal(lab.nodes.get('recordRadius').disabled,true);
});

test('alpha reanalyses saved records without changing physics, and automatic collection respects the window',async()=>{
  const lab=laboratory();lab.click('tab-comparison');lab.input('timeScale',4);lab.check('autoRecords',true);
  lab.advance(1.3);assert.equal(lab.analysis.radiusRecords.length,1);
  lab.advance(.6);assert.equal(lab.analysis.radiusRecords.length,2);
  const saved=lab.analysis.radiusRecords;
  assert.ok(saved[1].windowStart>=saved[0].time);
  lab.click('pause');const before=lab.metrics;lab.advance(.6);assert.equal(lab.analysis.radiusRecords.length,2);
  lab.input('recordY','correctedRatio');lab.input('alphaNumber','2');
  assert.equal(lab.analysis.alpha,2);assert.equal(lab.metrics.time,before.time);assert.equal(lab.metrics.energy,before.energy);
  assert.equal(lab.analysis.recordPlot.points[0].y,saved[0].ratio*(1-2*saved[0].packing));
  lab.input('alphaNumber','');assert.equal(lab.analysis.alpha,2);assert.equal(lab.nodes.get('alphaNumber').getAttribute('aria-invalid'),'true');
  lab.input('alpha',1.5);assert.equal(lab.analysis.alpha,1.5);
  lab.click('optimizeAlpha');assert.ok(lab.analysis.alpha>=0&&lab.analysis.alpha<=5);
  lab.click('exportRecords');const csv=await lab.downloads.at(-1).blob.text();assert.match(csv,/alpha_analyse/);
  lab.input('particleRadius',70);lab.click('applyRadius');assert.equal(lab.analysis.autoRecords,true);
  lab.input('timeScale',4);lab.advance(1.3);assert.equal(lab.analysis.radiusRecords.length,3);
  assert.ok(lab.analysis.recordPlot.fit);assert.match(lab.nodes.get('fitEquation').textContent,/R²/);assert.match(lab.nodes.get('fitUncertainty').textContent,/1 σ/);
  lab.check('linearFit',false);assert.equal(lab.analysis.recordPlot.fit,null);
});

test('corrected PV/T and inverse flight quantities use physical units and export matching columns',async()=>{
  const lab=laboratory();lab.click('tab-comparison');lab.input('timeScale',4);lab.advance(1.3);lab.click('recordRadius');
  const r=lab.analysis.radiusRecords[0];assert.ok(r);
  lab.input('alphaNumber','2');lab.input('recordY','correctedPVT');
  assert.ok(Math.abs(lab.analysis.recordPlot.points[0].y-r.ratio*(1-2*r.packing)/3)<1e-12);
  assert.match(lab.analysis.recordPlot.yLabel,/J\/K/);
  assert.match(lab.nodes.get('fitInterpretation').textContent,/ne change pas R²/);
  lab.input('recordY','meanFreePath');const path=lab.analysis.recordPlot.points[0].y;
  lab.input('recordY','inverseMeanFreePath');assert.ok(Math.abs(path*lab.analysis.recordPlot.points[0].y-1)<1e-12);
  lab.input('recordY','meanCollisionTime');const time=lab.analysis.recordPlot.points[0].y;
  lab.input('recordY','inverseMeanCollisionTime');assert.ok(Math.abs(time*lab.analysis.recordPlot.points[0].y-1)<1e-12);
  lab.click('exportRecords');const csv=await lab.downloads.at(-1).blob.text();
  const [head,line]=csv.trim().split(/\r?\n/).map(s=>s.replace(/^\uFEFF/,'').split(';'));
  assert.equal(head.length,line.length);assert.ok(head.includes('P_V_moins_alpha_Voccupe_sur_T_J_K'));assert.ok(head.includes('inverse_libre_parcours_mm_moins_1'));
});

test('excluded-volume plot compares temperature series with nR and retains records when T changes',async()=>{
  const lab=laboratory();lab.click('tab-comparison');lab.input('alphaNumber',2);
  for(const temperature of [200,400,600]){
    lab.input('recordTemperature',temperature);lab.click('applyRecordTemperature');
    assert.ok(Math.abs(lab.metrics.temperature-temperature/200)<1e-10);
    lab.input('timeScale',4);lab.advance(1.3);lab.click('recordRadius');
  }
  lab.click('plotExcludedVolume');const plot=lab.analysis.recordPlot;
  assert.equal(plot.points.length,3);assert.ok(plot.fit);assert.ok(plot.excludedVolumePlot);
  for(const [i,r] of lab.analysis.radiusRecords.entries()){
    assert.ok(Math.abs(plot.points[i].x-r.temperature*200)<1e-10);
    assert.ok(Math.abs(plot.points[i].y-r.pressure*r.volume*(1-2*r.packing)/15)<1e-9);
  }
  for(const point of plot.series[0].points)assert.ok(Math.abs(point.y-point.x/3)<1e-10);
  assert.match(lab.nodes.get('fitUncertainty').textContent,/c =/);
  lab.click('exportRecords');const csv=await lab.downloads.at(-1).blob.text();assert.match(csv,/P_V_moins_b_J/);
  for(const [button,key] of [['revisitFree','free'],['revisitAdiabatic','adiabatic'],['revisitPressure','pressure']]){
    lab.click(button);assert.equal(lab.analysis.experiment,key);lab.click('tab-comparison');
  }
  assert.equal(lab.analysis.radiusRecords.length,3);
  lab.input('particleRadius',70);lab.click('applyRadius');assert.equal(lab.analysis.recordPlot.points.length,0);assert.equal(lab.nodes.get('optimizeAlpha').disabled,true);
  lab.click('plotRadius');assert.equal(lab.analysis.recordPlot.points.length,3);assert.equal(lab.analysis.recordPlot.fit,null);
});

test('automatic temperature series stabilizes five states and keeps a fixed radius',()=>{
  const lab=laboratory();lab.click('tab-comparison');lab.click('plotExcludedVolume');lab.click('startTemperatureSeries');
  assert.equal(lab.nodes.get('applyRadius').disabled,true);assert.equal(lab.nodes.get('recordRadius').disabled,true);
  lab.advance(1);assert.equal(lab.analysis.radiusRecords.length,0);
  lab.click('pause');const t=lab.metrics.time;lab.advance(.5);assert.equal(lab.metrics.time,t);
  lab.click('tab-pressure');lab.advance(.2);lab.click('tab-comparison');assert.equal(lab.metrics.time,t);
  lab.click('pause');
  for(let i=0;i<100&&lab.analysis.batch;i++)lab.advance(1);
  assert.equal(lab.analysis.batch,null);assert.equal(lab.analysis.radiusRecords.length,5);assert.ok(lab.paused);
  for(const [i,r] of lab.analysis.radiusRecords.entries()){
    assert.equal(r.radius,DEFAULT_RADIUS);assert.ok(Math.abs(r.temperature*200-(200+i*100))<1e-8);
    const warmup=Math.max(6,33/Math.sqrt(r.temperature));assert.ok(r.windowStart>=warmup+4-1e-8);
    assert.ok(Math.abs(r.time-r.windowStart-2)<1e-8);
  }
  assert.equal(lab.analysis.recordPlot.points.length,5);assert.ok(lab.analysis.recordPlot.fit);
  assert.equal(lab.nodes.get('applyRadius').disabled,false);
  lab.click('startTemperatureSeries');lab.advance(.1);lab.click('stopTemperatureSeries');
  assert.equal(lab.analysis.batch,null);assert.equal(lab.analysis.radiusRecords.length,5);
});

test('cycles repeat compression and expansion, preserve energy balance and can stop',()=>{
  const lab=laboratory();lab.click('tab-cycles');lab.input('duration',35);lab.input('cycleCount','3');lab.input('timeScale',4);lab.click('start');
  assert.equal(lab.analysis.chartType,'pv');assert.equal(lab.analysis.pressureSource,'piston');
  lab.advance(.3);assert.ok(lab.metrics.width<11);lab.click('pause');const time=lab.metrics.time;lab.advance(.2);assert.equal(lab.metrics.time,time);lab.click('pause');
  for(let i=0;i<20&&lab.analysis.cycle.running;i++)lab.advance(.5);
  assert.equal(lab.analysis.cycle.running,false);assert.equal(lab.analysis.cycle.leg,6);assert.ok(Math.abs(lab.metrics.width-11)<1e-9);
  assert.equal(lab.metrics.heat,0);assert.ok(Math.abs(lab.metrics.balanceError)<1e-6);
  assert.ok(lab.analysis.plot.series.some(s=>s.color==='#ce8033'&&s.points.length>2));assert.ok(lab.analysis.plot.series.some(s=>s.color==='#287db4'&&s.points.length>2));
  lab.click('start');lab.advance(.1);lab.click('stop');const width=lab.metrics.width;lab.advance(.2);assert.equal(lab.metrics.width,width);assert.equal(lab.analysis.cycle.running,false);
});

test('temperature lesson enters continuously, holds the result and returns through its launch button',()=>{
 const lab=laboratory();lab.click('tab-temperature');lab.advance(.1);const initial=lab.metrics.time,energy=lab.metrics.energy;
 lab.click('illustrateTemperature');assert.equal(lab.analysis.lesson.phase,'slowdown');assert.equal(lab.analysis.lesson.zoom,0);
 assert.equal(lab.nodes.get('illustrateTemperature').textContent,'Retour à la simulation');assert.equal(lab.nodes.get('nextTemperatureStage').disabled,true);
 lab.advance(.8);assert.ok(lab.metrics.time>initial);assert.equal(lab.analysis.lesson.zoom,0);assert.ok(lab.analysis.lesson.rate>0&&lab.analysis.lesson.rate<1);
 lab.advance(.9);const time=lab.metrics.time;assert.equal(lab.analysis.lesson.phase,'frame');assert.equal(lab.analysis.lesson.time,time);
 lab.advance(6.2);assert.equal(lab.metrics.time,time);assert.equal(lab.analysis.lesson.phase,'align');
 lab.click('pause');const elapsed=lab.analysis.lesson.elapsed;lab.advance(1);assert.equal(lab.analysis.lesson.elapsed,elapsed);lab.click('pause');
 lab.advance(16);assert.equal(lab.analysis.lesson.phase,'done');assert.equal(lab.analysis.lesson.count,1000);assert.ok(lab.analysis.lesson.localCount<1000);
 assert.ok(Math.abs(lab.metrics.energy-energy)<1e-8);assert.equal(lab.metrics.time,time);assert.match(lab.nodes.get('storyFormula').textContent,/300,00 K/);
 assert.equal(lab.analysis.lesson.zoom,1);lab.advance(2);assert.equal(lab.metrics.time,time);
 lab.click('illustrateTemperature');assert.equal(lab.analysis.returning.phase,'restore');assert.equal(lab.nodes.get('illustrateTemperature').disabled,true);
 lab.advance(1.2);assert.equal(lab.analysis.returning.phase,'zoomOut');assert.equal(lab.metrics.time,time);
 lab.advance(1.4);assert.equal(lab.analysis.returning.phase,'resume');assert.equal(lab.analysis.returning.zoom,0);lab.advance(1.8);
 assert.equal(lab.analysis.lesson,null);assert.equal(lab.analysis.returning,null);assert.ok(lab.metrics.time>time);assert.equal(lab.nodes.get('illustrateTemperature').textContent,'▶ Des vitesses à la température');
 lab.click('illustrateTemperature');lab.advance(2.8);lab.click('nextTemperatureStage');assert.equal(lab.analysis.lesson.phase,'vectors');const at=lab.analysis.lesson.elapsed;lab.advance(.2);assert.equal(lab.analysis.lesson.elapsed,at);lab.click('reset');assert.equal(lab.analysis.lesson,null);assert.equal(lab.metrics.time,0);
});

test('pressure illustration accumulates a real surface-window and waits for a smooth return',()=>{
 const lab=laboratory();lab.advance(.1);lab.click('pause');lab.click('illustrate');lab.finishTour();const transitionTime=lab.metrics.time;lab.advance(1.3);assert.equal(lab.analysis.lesson.phase,'zoom');assert.ok(lab.analysis.lesson.zoom>0&&lab.analysis.lesson.zoom<1);assert.equal(lab.analysis.lesson.events.length,0);lab.advance(11);assert.ok(lab.analysis.lesson.start>transitionTime);
 const l=lab.analysis.lesson;assert.equal(l.phase,'done');assert.ok(l.events.length>10);assert.ok(l.pressure>0);
 assert.ok(Math.abs(l.pressure-l.impulse/((l.y1-l.y0)*l.elapsed))<1e-10);
 assert.equal(lab.metrics.work,0);assert.equal(lab.metrics.heat,0);assert.match(lab.nodes.get('storyDetails').textContent,/moitié|S =/);
 const time=lab.metrics.time;lab.advance(2);assert.equal(lab.metrics.time,time);
 assert.equal(lab.nodes.get('illustrate').textContent,'Retour à la simulation');assert.ok(!lab.nodes.has('finishMeasurementStory'));
 lab.click('illustrate');lab.advance(.7);assert.ok(lab.analysis.returning.zoom>0&&lab.analysis.returning.zoom<1);assert.equal(lab.metrics.time,time);
 lab.advance(.8);assert.equal(lab.analysis.returning.phase,'resume');assert.equal(lab.analysis.returning.zoom,0);
 lab.advance(2);assert.equal(lab.analysis.lesson,null);assert.equal(lab.paused,false);assert.ok(lab.metrics.time>time);
});


test('return button also exits early pressure and temperature sequences and survives tab changes',()=>{
 const lab=laboratory();lab.click('illustrate');lab.advance(1);
 assert.equal(lab.nodes.get('illustrate').disabled,false);assert.equal(lab.nodes.get('endIllustration').hidden,true);
 lab.click('illustrate');assert.ok(lab.analysis.returning);lab.click('tab-temperature');lab.click('tab-pressure');assert.ok(lab.analysis.returning);
 lab.advance(3.2);assert.equal(lab.analysis.returning,null);assert.equal(lab.analysis.tour,null);assert.equal(lab.analysis.lesson,null);
 lab.click('tab-temperature');lab.click('illustrateTemperature');lab.advance(.5);const time=lab.metrics.time;
 lab.click('illustrateTemperature');assert.equal(lab.analysis.returning.zoom,0);assert.ok(lab.analysis.returning.rate>0);
 lab.advance(3.2);assert.equal(lab.analysis.lesson,null);assert.ok(lab.metrics.time>time);
 lab.click('illustrateTemperature');lab.advance(5);lab.click('illustrateTemperature');lab.click('reset');assert.equal(lab.analysis.returning,null);assert.equal(lab.analysis.lesson,null);
});


test('work journey can return during a moving case, retain its state across tabs and reset cleanly',()=>{
 const lab=laboratory();lab.click('tab-adiabatic');lab.click('illustrate');
 for(let i=0;i<45&&lab.analysis.lesson.case!=='compression';i++){if(lab.analysis.lesson.collisionPhase==='compare')lab.click('speedEqual');if(lab.analysis.lesson.phase==='hold'||lab.analysis.lesson.collisionPhase==='compare')lab.click('nextWorkCase');lab.advance(1);}
 assert.equal(lab.analysis.lesson.case,'compression');lab.advance(2);
 const before=lab.metrics.time;lab.click('tab-pressure');lab.advance(.3);lab.click('tab-adiabatic');assert.equal(lab.metrics.time,before);assert.equal(lab.analysis.lesson.case,'compression');
 lab.click('illustrate');lab.advance(3.2);assert.equal(lab.analysis.lesson,null);assert.equal(lab.analysis.returning,null);
 const width=lab.metrics.width,work=lab.metrics.work;lab.advance(.3);assert.equal(lab.metrics.width,width);assert.equal(lab.metrics.work,work);
 lab.click('illustrate');lab.click('reset');assert.equal(lab.analysis.lesson,null);assert.equal(lab.metrics.time,0);assert.equal(lab.metrics.width,11);
});


test('the default radius is exactly 0.50 mm across experiments and survives applying the unchanged slider',()=>{
 const lab=laboratory();
 for(const key of ['pressure','temperature','free','adiabatic','cycles','comparison']){
  lab.click('tab-'+key);assert.equal(lab.metrics.particleRadius,DEFAULT_RADIUS);assert.equal(lab.nodes.get('radiusValue').value,'0,50 mm');
 }
 lab.click('applyRadius');assert.equal(lab.metrics.particleRadius,DEFAULT_RADIUS);lab.click('reset');assert.equal(lab.metrics.particleRadius,DEFAULT_RADIUS);
});

test('welcome is optional, freezes the film, and can be reopened without resetting the gas',()=>{
 const lab=laboratory({welcome:true});assert.equal(lab.analysis.tutorial.welcoming,true);assert.equal(lab.nodes.get('appMain').inert,true);
 const time=lab.metrics.time;lab.advance(2);assert.equal(lab.metrics.time,time);
 lab.click('tutorialDismiss');assert.equal(lab.nodes.get('appMain').inert,false);lab.advance(.3);assert.ok(lab.metrics.time>time);
 const before=lab.metrics;lab.click('openTutorial');lab.advance(2);assert.equal(lab.metrics.time,before.time);assert.equal(lab.metrics.energy,before.energy);
 lab.click('tutorialDismiss');assert.equal(lab.analysis.tutorial.active,false);
});

test('quiet guidance requires the actual action and automatically advances to the next instruction',()=>{
 const lab=laboratory({welcome:true});lab.click('tutorialStart');lab.click('tutorialNext');
 assert.equal(lab.analysis.tutorial.index,1);assert.equal(lab.analysis.tutorial.quiet,true);
 lab.click('tutorialNext');assert.equal(lab.analysis.tutorial.index,1);
 lab.nodes.get('tutorialChapter').value='6';lab.nodes.get('tutorialChapter').dispatch('change');
 assert.equal(lab.analysis.tutorial.quiet,true);lab.click('tab-free');lab.advance(.15);
 assert.equal(lab.analysis.tutorial.index,7);assert.equal(lab.analysis.tutorial.quiet,false);
 lab.click('start');lab.input('timeScale',4);lab.advance(2.1);lab.click('tutorialNext');
 assert.equal(lab.analysis.tutorial.index,8);assert.equal(lab.analysis.tutorial.quiet,true);
 lab.click('retryFreeRatio');assert.equal(lab.analysis.tutorial.index,9);assert.equal(lab.analysis.chartType,'ratio');
 lab.click('tutorialQuit');assert.equal(lab.analysis.tutorial.active,false);
});

test('Continue stays available on explanations while quiet actions cannot be bypassed',()=>{
 const lab=laboratory({welcome:true});lab.click('tutorialStart');lab.nodes.get('tutorialChapter').value='6';lab.nodes.get('tutorialChapter').dispatch('change');
 lab.click('tab-free');lab.advance(.15);assert.equal(lab.analysis.tutorial.index,7);
 assert.equal(lab.nodes.get('tutorialNext').disabled,false);lab.click('tutorialNext');assert.equal(lab.analysis.tutorial.index,8);
 lab.click('tutorialNext');assert.equal(lab.analysis.tutorial.index,8);assert.equal(lab.analysis.run,null);
 lab.click('openTutorial');assert.equal(lab.analysis.tutorial.active,false);assert.equal(lab.analysis.tutorial.welcoming,false);
});

test('the guide clears the veil for actions and waits for slider release before dimming',()=>{
 const lab=laboratory({welcome:true}),spot=lab.nodes.get('tutorialSpotlight');lab.click('tutorialStart');
 assert.equal(spot.classList.contains('interaction'),false);lab.click('tutorialNext');
 assert.equal(spot.classList.contains('interaction'),true);
 lab.nodes.get('tutorialChapter').value='20';lab.nodes.get('tutorialChapter').dispatch('change');
 lab.click('tab-comparison');lab.advance(.15);
 const target=lab.nodes.get('particleRadius');
 lab.documentEvent('pointerdown',{target,pointerId:1});lab.input('particleRadius',.6);
 assert.equal(lab.analysis.tutorial.ready,true);assert.equal(spot.classList.contains('interaction'),true);
 lab.advance(.3);assert.equal(spot.classList.contains('interaction'),true);
 lab.documentEvent('pointerup',{target,pointerId:1});assert.equal(spot.classList.contains('interaction'),false);
 lab.documentEvent('keydown',{target,key:'ArrowRight'});lab.input('particleRadius',.7);lab.advance(.3);
 assert.equal(spot.classList.contains('interaction'),true);
 lab.documentEvent('keyup',{target,key:'ArrowRight'});assert.equal(spot.classList.contains('interaction'),false);
 lab.documentEvent('pointerdown',{target,pointerId:2});assert.equal(spot.classList.contains('interaction'),true);
 lab.documentEvent('pointercancel',{target,pointerId:2});assert.equal(spot.classList.contains('interaction'),false);
 lab.click('tutorialQuit');assert.equal(spot.hidden,true);
});

test('the enabled Continue button keeps its text node stable during simulation refreshes',()=>{
 const lab=laboratory({welcome:true});lab.click('tutorialStart');
 const writes=lab.textWrites.get('tutorialNext');
 lab.advance(.5);assert.equal(lab.textWrites.get('tutorialNext'),writes);
 lab.click('tutorialNext');assert.equal(lab.analysis.tutorial.index,1);
 lab.advance(.5);assert.equal(lab.textWrites.get('tutorialNext'),writes);
 lab.click('tutorialNext');assert.equal(lab.analysis.tutorial.index,1);
});

test('Joule–Gay–Lussac has reference ticks and offers a fresh ratio replay after observation',()=>{
 const lab=laboratory();lab.click('tab-free');
 for(const y of [.5,1,2])assert.ok(lab.analysis.plot.yTicks.includes(y));
 assert.equal(lab.analysis.plot.yRange[1],2.2);assert.equal(lab.nodes.get('freeRetry').hidden,true);
 lab.click('start');lab.advance(.4);assert.equal(lab.nodes.get('freeRetry').hidden,true);
 lab.input('timeScale',4);lab.advance(2);assert.equal(lab.nodes.get('freeRetry').hidden,false);
 const radius=lab.metrics.particleRadius,temperature=lab.metrics.temperature;
 lab.click('retryFreeRatio');assert.equal(lab.analysis.chartType,'ratio');assert.equal(lab.analysis.run,null);assert.equal(lab.metrics.time,0);assert.equal(lab.metrics.width,9);
 assert.equal(lab.metrics.particleRadius,radius);assert.ok(Math.abs(lab.metrics.temperature-temperature)<1e-8);
 lab.click('start');assert.equal(lab.metrics.width,18);assert.equal(lab.analysis.chartType,'ratio');
});

test('the tutorial follows a paused temperature animation through its real final result',()=>{
 const lab=laboratory({welcome:true});lab.click('tutorialStart');lab.nodes.get('tutorialChapter').value='3';lab.nodes.get('tutorialChapter').dispatch('change');
 lab.click('tab-temperature');lab.advance(.15);assert.equal(lab.analysis.tutorial.index,4);assert.equal(lab.analysis.tutorial.quiet,true);
 lab.click('illustrateTemperature');lab.advance(5);assert.equal(lab.analysis.tutorial.ready,false);assert.equal(lab.analysis.tutorial.interacting,true);assert.equal(lab.analysis.tutorial.quiet,true);
 lab.click('pause');lab.advance(.15);assert.equal(lab.analysis.tutorial.target,'nextTemperatureStage');
 for(let i=0;i<6&&lab.analysis.lesson.phase!=='done';i++)lab.click('nextTemperatureStage');
 lab.advance(.15);assert.equal(lab.analysis.tutorial.ready,true);assert.equal(lab.analysis.tutorial.quiet,false);
 // The real Return button also advances the visit without an extra Continue click.
 lab.click('illustrateTemperature');lab.advance(4.5);assert.equal(lab.analysis.lesson,null);assert.equal(lab.analysis.tutorial.index,6);assert.equal(lab.analysis.tutorial.quiet,true);
 lab.click('tutorialQuit');assert.equal(lab.analysis.tutorial.active,false);
});


test('tutorial keeps the page top for visible targets and only reveals lower controls',()=>{
 const lab=laboratory({welcome:true});lab.click('tutorialStart');
 assert.equal(lab.analysis.tutorial.total,34);assert.equal(lab.scrollCalls.length,0);
 lab.click('tutorialNext');assert.equal(lab.analysis.tutorial.title,'D’où vient la pression ?');assert.equal(lab.scrollCalls.length,0);
 lab.nodes.get('tutorialChapter').value='6';lab.nodes.get('tutorialChapter').dispatch('change');
 lab.click('tab-free');lab.advance(.15);
 assert.equal(lab.analysis.tutorial.title,'Ouvrir et suivre P, V et T');
 lab.nodes.get('retryFreeRatio').getBoundingClientRect=()=>({left:640,top:900,width:220,height:40});
 lab.click('start');lab.input('timeScale',4);lab.advance(2.1);lab.click('tutorialNext');
 assert.equal(lab.analysis.tutorial.title,'Refaire avec un autre regard');
 assert.equal(lab.nodes.get('tutorialCard').classList.contains('scene-guide'),true);
 assert.equal(lab.scrollCalls.at(-1).top,156); // No popup: only the viewport margin is reserved (940 - 784).
 lab.click('retryFreeRatio');assert.equal(lab.analysis.tutorial.title,'La même détente, avec PV/(nRT)');
});


test('an ongoing animation stays clear even on an explanatory step already marked complete',()=>{
 const lab=laboratory({welcome:true});lab.click('tutorialStart');lab.click('tutorialNext');lab.click('illustrate');lab.advance(.3);
 assert.equal(lab.analysis.tutorial.quiet,true);assert.equal(lab.nodes.get('tutorialSpotlight').classList.contains('interaction'),true);
 // An explanatory chapter can be selected without stopping the underlying animation.
 lab.nodes.get('tutorialChapter').value='0';lab.nodes.get('tutorialChapter').dispatch('change');lab.advance(.2);
 assert.equal(lab.analysis.tutorial.ready,true);assert.equal(lab.nodes.get('tutorialSpotlight').classList.contains('interaction'),true);
 lab.click('tutorialQuit');
});
