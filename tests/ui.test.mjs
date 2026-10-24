import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../dist/physics.js', import.meta.url), 'utf8');
const analysis = readFileSync(new URL('../dist/analysis.js', import.meta.url), 'utf8');
const cycles = readFileSync(new URL('../dist/cycles.js', import.meta.url), 'utf8');
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
    for (const key of ['chart', 'view', 'preset']) if (attrs['data-' + key]) node.dataset[key] = attrs['data-' + key];
    return node;
  }
  function attributes(text) {
    return Object.fromEntries([...text.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(match => [match[1], match[2] ?? '']));
  }
  for (const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="[^"]+"[^>]*)>/g)) {
    const attrs = attributes(match[2]); nodes.set(attrs.id, element(match[1], attrs));
  }
  const freeOption = { disabled: false };
  const charts = [...html.matchAll(/<button\b([^>]*\bdata-chart="[^"]+"[^>]*)>/g)].map(match => element('button', attributes(match[1])));
  nodes.get('motion').value = 'linear';
  nodes.get('pressureSource').value = 'piston';
  nodes.get('thermalMode').value = 'isolated';
  nodes.get('timeScale').value = '1';
  nodes.get('cycleLimit').value = '5';
  nodes.get('cycleSelect').value = 'latest';
  const document = {
    hidden: false,
    getElementById(id) { assert.ok(nodes.has(id), `Element ${id} exists in the real HTML`); return nodes.get(id); },
    querySelectorAll(selector) {
      if (selector === '[data-chart]') return charts;
      if (selector === 'input[type="range"]') return [...nodes.values()].filter(n => n.attributes.type === 'range');
      if (selector === '[data-view]') return [...nodes.values()].filter(n => n.dataset.view);
      if (selector === '[data-preset]') return [...nodes.values()].filter(n => n.dataset.preset);
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
  vm.runInContext(cycles, scope, { filename: 'cycles.js' });
  const histogram = scope.GasAnalysis.histogram;
  scope.GasAnalysis.histogram = (...args) => {
    const result = histogram(...args);
    histogramCalls.push(result);
    if (histogramCalls.length > 8) histogramCalls.shift();
    return result;
  };
  vm.runInContext(app, scope, { filename: 'app.js' });
  function frame() { const callback = pendingFrame; pendingFrame = null; callback(timestamp); timestamp += 1000 / 60; }
  frame();
  return {
    nodes, charts, freeOption, downloads, histogramCalls,
    get metrics() { return window.gaz2D.metrics; },
    get paused() { return window.gaz2D.paused; },
    get analysis() { return window.gaz2D.analysis; },
    click(id) { nodes.get(id).click(); },
    input(id, value) { const node = nodes.get(id); assert.ok(!node.disabled, `${id} is available`); node.value = value; node.dispatch('input'); },
    check(id, value) { const node = nodes.get(id); assert.ok(!node.disabled, `${id} is available`); node.checked = value; node.dispatch('input'); },
    advance(seconds) { for (let i = 0; i < Math.ceil(seconds * 60); i++) frame(); }
  };
}

test('application boots against its HTML, advances measurements and pauses/resumes', () => {
  const lab = laboratory();
  assert.equal(lab.metrics.width, 11);
  assert.equal(lab.metrics.count, 180);
  assert.equal(lab.metrics.pressure, null);
  lab.advance(0.6);
  assert.ok(lab.metrics.time > 0.5);
  assert.ok(lab.metrics.pressure > 0);
  lab.click('pause');
  assert.equal(lab.paused, true);
  const pausedTime = lab.metrics.time;
  lab.advance(1);
  assert.equal(lab.metrics.time, pausedTime);
  lab.click('pause'); lab.advance(0.6);
  assert.equal(lab.paused, false);
  assert.ok(lab.metrics.time > pausedTime + 0.5);
});

test('a completed expansion allows a following compression with a new starting volume', () => {
  const lab = laboratory();
  lab.input('duration', 0); lab.input('target', 140);
  lab.click('start');
  assert.equal(lab.nodes.get('start').disabled, true);
  assert.equal(lab.nodes.get('compression').disabled, true);
  lab.advance(0.5);
  assert.ok(Math.abs(lab.metrics.width - 15.4) < 1e-9);
  assert.equal(lab.nodes.get('start').disabled, false);
  assert.equal(lab.nodes.get('stop').disabled, true);
  lab.click('compression'); lab.input('target', 70); lab.click('start');
  lab.advance(0.5);
  assert.ok(Math.abs(lab.metrics.width - 15.4 * 0.7) < 1e-9);
  assert.ok(Math.abs(lab.metrics.balanceError) < 1e-8);
});

test('free expansion works while paused, preserves energy, and cannot be selected for compression', () => {
  const lab = laboratory();
  lab.click('pause');
  lab.input('motion', 'free');
  assert.equal(lab.nodes.get('durationField').hidden, true);
  const energy = lab.metrics.energy;
  lab.click('start');
  assert.ok(Math.abs(lab.metrics.width - 15.4) < 1e-9);
  assert.equal(lab.metrics.energy, energy);
  assert.equal(lab.metrics.work, 0);
  assert.equal(lab.paused, false);
  lab.click('compression');
  assert.equal(lab.nodes.get('motion').value, 'linear');
  assert.equal(lab.freeOption.disabled, true);
  assert.equal(lab.nodes.get('durationField').hidden, false);
});

test('duration really controls motion speed and stopping an oscillation fixes the volume', () => {
  const lab = laboratory();
  lab.input('duration', 100); lab.click('start'); lab.advance(0.6);
  assert.ok(lab.metrics.width > 11 && lab.metrics.width < 11.04);
  lab.click('stop');
  const width = lab.metrics.width;
  lab.advance(0.3);
  assert.equal(lab.metrics.width, width);
  lab.input('motion', 'oscillate'); lab.input('duration', 0); lab.click('start');
  lab.advance(0.3);
  assert.equal(lab.nodes.get('stop').disabled, false);
  lab.click('stop');
  const stoppedWidth = lab.metrics.width, work = lab.metrics.work;
  lab.advance(0.6);
  assert.equal(lab.metrics.width, stoppedWidth);
  assert.equal(lab.metrics.work, work);
  assert.equal(lab.nodes.get('start').disabled, false);
});

test('reset applies the selected particle count and energy, clears work, and resumes', () => {
  const lab = laboratory();
  lab.click('compression'); lab.input('duration', 0); lab.click('start'); lab.advance(0.4);
  assert.ok(lab.metrics.work > 0);
  lab.click('pause');
  lab.input('particles', 500); lab.input('initialTemperature', 250); lab.click('applyInitial');
  assert.equal(lab.metrics.count, 500);
  assert.equal(lab.metrics.width, 11);
  assert.equal(lab.metrics.time, 0);
  assert.equal(lab.metrics.work, 0);
  assert.ok(Math.abs(lab.metrics.temperature - 2.5) < 1e-12);
  assert.equal(lab.metrics.pressure, null);
  assert.equal(lab.paused, false);
  lab.charts.find(button => button.dataset.chart === 'pv').click();
  assert.match(lab.nodes.get('chart').getAttribute('aria-label'), /volume/);
  lab.click('export');
  assert.equal(lab.downloads.length, 1);
  assert.equal(lab.downloads[0].download, 'gaz-2d-mesures.csv');
});

test('maximum expansion remains reachable without a dead slider below the physical bound', () => {
  const lab = laboratory(); lab.input('motion', 'free');
  for (let i = 0; i < 8 && lab.metrics.width < 17.999; i++) {
    assert.equal(lab.nodes.get('start').disabled, false, `Expansion unexpectedly unavailable at L=${lab.metrics.width}`);
    const target = lab.nodes.get('target');
    assert.ok(+target.min <= +target.max);
    lab.input('target', target.max); lab.click('start');
  }
  assert.ok(lab.metrics.width >= 17.999, `Maximum remains unreachable at L=${lab.metrics.width}`);
  assert.ok(lab.metrics.width <= 18);
  assert.equal(lab.nodes.get('start').disabled, true);
  lab.click('compression');
  assert.equal(lab.nodes.get('start').disabled, false);
});

test('minimum compression remains reachable and changing direction unlocks the piston', () => {
  const lab = laboratory(); lab.click('compression'); lab.input('duration', 0);
  for (let i = 0; i < 8 && lab.metrics.width > 3.001; i++) {
    assert.equal(lab.nodes.get('start').disabled, false, `Compression unexpectedly unavailable at L=${lab.metrics.width}`);
    const target = lab.nodes.get('target');
    assert.ok(+target.min <= +target.max);
    lab.input('target', target.min); lab.click('start'); lab.advance(0.4);
  }
  assert.ok(lab.metrics.width <= 3.001, `Minimum remains unreachable at L=${lab.metrics.width}`);
  assert.ok(lab.metrics.width >= 3);
  assert.equal(lab.nodes.get('start').disabled, true);
  lab.click('expansion');
  assert.equal(lab.nodes.get('start').disabled, false);
});

test('particle controls apply both extremes and refresh both normalized distributions', () => {
  const lab = laboratory();
  for (const [control, count] of [['particles', 10], ['particleNumber', 1000]]) {
    lab.input(control, count);
    assert.equal(+lab.nodes.get('particles').value, count);
    assert.equal(+lab.nodes.get('particleNumber').value, count);
    lab.click('applyInitial');
    assert.equal(lab.metrics.count, count);
    assert.ok(Math.abs(lab.metrics.energy - count * 1.5) < 1e-9);
    assert.match(lab.nodes.get('distributionCount').textContent.replace(/\s/g, ''), new RegExp('^' + count + 'particules$'));
    const distributions = lab.histogramCalls.slice(-4);
    assert.equal(distributions.length, 4);
    for (const histogram of distributions) {
      assert.equal(histogram.total, count);
      const area = histogram.bins.reduce((sum, bin) => sum + bin.density * histogram.binWidth, 0);
      assert.ok(Math.abs(area - 1) < 1e-12);
    }
    lab.advance(0.2);
    assert.ok(Number.isFinite(lab.metrics.pressure));
  }
});

test('invalid particle entries leave the current state intact and a valid slider entry recovers', () => {
  const lab = laboratory(); lab.advance(0.3);
  const time = lab.metrics.time;
  for (const invalid of [9, 1001, 10.5, '', 'not-a-number']) {
    lab.input('particleNumber', invalid);
    assert.equal(lab.nodes.get('applyInitial').disabled, true);
    assert.equal(lab.nodes.get('particleNumber').getAttribute('aria-invalid'), 'true');
    lab.click('applyInitial');
    assert.equal(lab.metrics.count, 180);
    lab.click('reset');
    assert.equal(lab.metrics.time, time);
    assert.equal(lab.metrics.count, 180);
    assert.match(lab.nodes.get('notice').textContent, /entier/);
  }
  lab.input('particles', 137);
  assert.equal(lab.nodes.get('applyInitial').disabled, false);
  assert.equal(lab.nodes.get('particleNumber').getAttribute('aria-invalid'), 'false');
  lab.click('applyInitial');
  assert.equal(lab.metrics.count, 137);
});

test('all six chart tabs show the requested variables and logarithmic diagnostics only when selected', () => {
  const lab = laboratory(); lab.advance(0.4);
  assert.equal(lab.charts.length, 6);
  const labels = { time: /Évolution/, pv: /volume/, pvt: /température/, log: /Logarithme/, pt: /pression.*température/, vt: /volume.*température/ };
  for (const button of lab.charts) {
    button.click();
    const type = button.dataset.chart;
    assert.equal(lab.analysis.chartType, type);
    assert.match(lab.nodes.get('chart').getAttribute('aria-label'), labels[type]);
    assert.equal(lab.nodes.get('logAnalysis').hidden, type !== 'log');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(lab.charts.filter(item => item.getAttribute('aria-pressed') === 'true').length, 1);
  }
  assert.equal(lab.analysis.logarithmic.fit, null);
  assert.match(lab.nodes.get('fitStatus').textContent, /Lancez/);
});

test('pressure source, pressure work and CSV remain consistent with actual collision measurements', async () => {
  const lab = laboratory();
  lab.click('compression'); lab.input('duration', 0); lab.click('start'); lab.advance(0.5);
  const metrics = lab.metrics;
  assert.ok(metrics.pressureWork > 0);
  assert.ok(Math.abs(metrics.pressureWork - metrics.work) < 1e-9);
  assert.ok(Math.abs(metrics.balancePressureError) < 1e-8);
  const format = value => value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (const source of ['mean', 'piston']) {
    lab.input('pressureSource', source);
    assert.equal(lab.analysis.pressureSource, source);
    const p = source === 'piston' ? metrics.pressureByWall.right : metrics.pressure;
    assert.equal(lab.nodes.get('pressure').textContent, format(p));
    assert.match(lab.nodes.get('pressureLabel').textContent, source === 'piston' ? /piston/ : /moyenne/);
    lab.charts.find(button => button.dataset.chart === 'pvt').click(); lab.click('export');
    const text = await lab.downloads.at(-1).blob.text();
    assert.ok(!/NaN|Infinity/.test(text));
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    const headings = lines[0].split(';'), cells = lines.at(-1).split(';');
    assert.equal(cells.length, headings.length);
    const value = name => {
      const cell = cells[headings.indexOf(name)];
      return cell === '' ? null : Number(cell.replace(',', '.'));
    };
    assert.ok(Math.abs(value('pression_selectionnee_ur') - p) < 1e-7);
    assert.ok(Math.abs(value('PV_ur') - p * metrics.volume) < 1e-5);
    assert.ok(Math.abs(value('travail_pression_recu_ur') - metrics.pressureWork) < Math.max(1e-7, Math.abs(metrics.pressureWork) * 1e-9), `${value('travail_pression_recu_ur')} versus ${metrics.pressureWork}`);
    // A transient pressure is measured, so PV is not forced onto the NT line.
    assert.ok(Math.abs(value('PV_ur') - metrics.count * metrics.temperature) > 0.1);
    assert.ok(Math.abs(value('ln_P_selectionnee') - Math.log(p)) < 1e-7);
  }
});

test('a slow trajectory yields a descriptive log fit, and later rest does not add fit samples', () => {
  const lab = laboratory();
  lab.input('duration', 64); lab.click('start'); lab.advance(8.5); lab.charts.find(button => button.dataset.chart === 'log').click();
  const during = lab.analysis.logarithmic;
  assert.ok(during.fit && during.fit.count >= 3);
  assert.ok(Number.isFinite(during.fit.slope));
  assert.ok(during.points.length > during.fitPoints.length);
  assert.ok(during.points.every(point => point.time >= lab.analysis.legStart + 2 - 1e-8));
  for (let i = 1; i < during.fitPoints.length; i++) assert.ok(during.fitPoints[i].time - during.fitPoints[i - 1].time >= 2 - 1e-8);
  assert.notEqual(lab.nodes.get('gammaFit').textContent, '—');
  lab.advance(5);
  assert.equal(lab.nodes.get('stop').disabled, true);
  const after = JSON.stringify(lab.analysis.logarithmic);
  lab.advance(3);
  assert.equal(JSON.stringify(lab.analysis.logarithmic), after);
});

test('changing the gamma reference changes analysis settings without changing gas dynamics', () => {
  const lab = laboratory(), control = laboratory();
  for (const item of [lab, control]) { item.input('duration', 64); item.click('start'); item.advance(3); item.charts.find(button => button.dataset.chart === 'log').click(); }
  lab.input('gamma', 3.2);
  assert.equal(lab.analysis.gammaReference, 3.2);
  assert.equal(control.analysis.gammaReference, 2);
  for (const item of [lab, control]) item.advance(3.5);
  for (const key of ['time', 'width', 'energy', 'temperature', 'pressure', 'work', 'pressureWork']) assert.equal(lab.metrics[key], control.metrics[key], key);
  lab.input('gamma', -1);
  assert.equal(lab.analysis.gammaReference, 3.2);
  assert.equal(lab.nodes.get('gamma').getAttribute('aria-invalid'), 'true');
});

test('an oscillation inversion starts a new log leg and free expansion never reuses its fit', () => {
  const lab = laboratory();
  lab.input('motion', 'oscillate'); lab.input('duration', 60); lab.click('start'); lab.advance(7);
  assert.equal(lab.analysis.legId, 0);
  assert.ok(lab.analysis.logarithmic.fit);
  lab.advance(3);
  assert.equal(lab.analysis.legId, 1);
  assert.equal(lab.analysis.logarithmic.fit, null);
  assert.equal(lab.analysis.logarithmic.points.length, 0);
  lab.advance(6.2);
  assert.equal(lab.analysis.legId, 1);
  assert.ok(lab.analysis.logarithmic.fit);
  assert.ok(lab.analysis.logarithmic.points.every(point => point.time >= lab.analysis.legStart + 2 - 1e-8));
  lab.click('stop'); lab.input('motion', 'free');
  const previousRun = lab.analysis.runId, previousWork = lab.metrics.pressureWork;
  lab.click('start');
  assert.ok(lab.analysis.runId > previousRun);
  assert.equal(lab.metrics.pressureWork, previousWork);
  assert.equal(lab.analysis.logarithmic.fit, null);
  assert.equal(lab.analysis.logarithmic.points.length, 0);
  lab.charts.find(button => button.dataset.chart === 'log').click();
  assert.match(lab.nodes.get('fitStatus').textContent, /détente libre/);
});

function periodicLaboratory({ thermal = false, count = 40 } = {}) {
  const lab = laboratory();
  lab.input('particles', count); lab.click('applyInitial');
  if (thermal) { lab.input('bathTemperature', 2.5); lab.input('thermalMode', 'thermostat'); }
  lab.input('duration', 0); lab.input('motion', 'oscillate'); lab.click('start');
  return lab;
}

function assertBalance(summary) {
  const scale = Math.max(1, Math.abs(summary.deltaEnergy), Math.abs(summary.work), Math.abs(summary.heat));
  assert.ok(Math.abs(summary.deltaEnergy - summary.work - summary.heat) <= 1e-9 * scale, `ΔE=${summary.deltaEnergy}, W=${summary.work}, Q=${summary.heat}`);
}

test('rapid periodic motion captures exact half-periods and complete periods across accelerated frames', () => {
  const lab = periodicLaboratory({ thermal: true });
  lab.input('timeScale', 8); lab.advance(0.2);
  // The active path is sampled every 0.1 u.t.; export captures its current
  // endpoint before comparing its cumulative counters with the live engine.
  lab.click('export');
  const records = lab.analysis.cycles, complete = records.filter(c => c.complete);
  assert.ok(complete.length >= 3);
  assert.ok(records.some(c => !c.complete));
  for (const cycle of complete) {
    assert.equal(cycle.kind, 'periodic');
    const first = cycle.rows[0], last = cycle.rows.at(-1);
    assert.ok(Math.abs(last.time - first.time - 0.4) < 1e-9);
    assert.ok(Math.abs(first.width - 11) < 1e-9);
    assert.ok(Math.abs(last.width - 11) < 1e-9);
    const turn = cycle.rows.find(row => Math.abs(row.time - first.time - 0.2) < 1e-9);
    assert.ok(turn?.turningPoint, 'The exact half-period survives sampling');
    assert.ok(Math.abs(turn.width - 15.4) < 1e-9);
    assertBalance(cycle.summary);
    assert.equal(cycle.summary.closedVolume, true);
    assert.equal(cycle.reconstruction.valid, true, cycle.reconstruction.reason);
    assert.ok(Math.abs(-cycle.reconstruction.integral - cycle.summary.work) < Math.max(1e-8, Math.abs(cycle.summary.work) * 1e-9));
  }
  const totalWork = records.reduce((sum, c) => sum + c.summary.work, 0);
  const totalHeat = records.reduce((sum, c) => sum + c.summary.heat, 0);
  assert.ok(Math.abs(totalWork - lab.metrics.pressureWork) < 1e-7);
  assert.ok(Math.abs(totalHeat - lab.metrics.heat) < 1e-7);
});

test('multiple P–V, P–T and V–T diagrams retain distinct complete paths and old-cycle selection', () => {
  const lab = periodicLaboratory(); lab.advance(2.6);
  assert.equal(lab.analysis.cycles.length, 5);
  lab.input('cycleLimit', 10);
  const records = lab.analysis.cycles;
  assert.ok(records.length >= 7 && records.length <= 10);
  assert.equal(new Set(records.map(c => c.id)).size, records.length);
  const oldest = records[0];
  lab.input('cycleSelect', oldest.id);
  assert.equal(lab.analysis.selectedCycleId, oldest.id);
  for (const type of ['pv', 'pt', 'vt']) {
    lab.charts.find(button => button.dataset.chart === type).click();
    assert.equal(lab.analysis.chartType, type);
    assert.equal(lab.analysis.selectedCycleId, oldest.id);
    assert.equal(lab.nodes.get('cycleLegend').hidden, false);
    assert.match(lab.nodes.get('cycleLegend').innerHTML, /background:/);
    if (type !== 'pv') assert.match(lab.nodes.get('chartHint').textContent, /pas directement un travail/);
  }
  assert.ok(new Set([...lab.nodes.get('cycleLegend').innerHTML.matchAll(/background:([^";]+)/g)].map(match => match[1])).size >= 5);
  lab.input('cycleLimit', 5);
  assert.equal(lab.analysis.cycles.length, 5);
  assert.notEqual(lab.analysis.selectedCycleId, oldest.id, 'An evicted display selection falls back to a visible cycle');
});

test('cycle memory stays bounded while display limits and earlier visible cycles remain usable', () => {
  const lab = periodicLaboratory();
  lab.input('timeScale', 8); lab.advance(5.5);
  assert.match(lab.nodes.get('cycleMemory').textContent, /^100 \/ 100/);
  for (const limit of [5, 10, 20]) {
    lab.input('cycleLimit', limit);
    const records = lab.analysis.cycles;
    assert.equal(records.length, limit);
    assert.ok(records[0].id > 1, 'Old cycles are discarded after reaching capacity');
    const complete = records.find(c => c.complete);
    lab.input('cycleSelect', complete.id);
    assert.equal(lab.analysis.selectedCycleId, complete.id);
    assert.ok(records.every(record => record.rows.length <= 1200));
    assertBalance(complete.summary);
  }
});

test('live thermostat controls exchange Q only on subsequent collisions and isolation stops heat exchange', () => {
  const lab = laboratory(); lab.advance(0.4);
  const energyBefore = lab.metrics.energy, timeBefore = lab.metrics.time;
  lab.input('bathTemperature', 4); lab.input('thermalMode', 'thermostat');
  assert.equal(lab.metrics.energy, energyBefore);
  assert.equal(lab.metrics.time, timeBefore);
  assert.equal(lab.metrics.heat, 0);
  assert.equal(lab.metrics.bathTemperature, 4);
  assert.equal(lab.metrics.pistonThermal, true, 'The HTML checkbox includes the piston by default');
  assert.equal(lab.nodes.get('thermalSettings').hidden, false);
  lab.advance(2);
  assert.notEqual(lab.metrics.heat, 0);
  assert.ok(lab.metrics.heatIn > 0);
  assert.ok(lab.metrics.temperature > 1.5);
  assert.ok(Math.abs(lab.metrics.firstLawError) < 1e-8);
  const heat = lab.metrics.heat;
  lab.input('thermalMode', 'isolated'); lab.advance(1);
  assert.equal(lab.metrics.heat, heat);
  assert.equal(lab.nodes.get('thermalSettings').hidden, true);
  assert.equal(lab.metrics.thermalMode, 'isolated');
  assert.ok(Math.abs(lab.metrics.firstLawError) < 1e-8);
});

test('invalid thermostat temperature remains editable after switching isolation off and on', () => {
  const lab = laboratory();
  lab.input('bathTemperature', 2); lab.input('thermalMode', 'thermostat');
  const energy = lab.metrics.energy;
  for (const invalid of ['', 0]) {
    lab.input('bathTemperature', invalid);
    assert.equal(lab.nodes.get('bathTemperature').getAttribute('aria-invalid'), 'true');
    lab.input('thermalMode', 'isolated');
    assert.equal(lab.metrics.thermalMode, 'isolated');
    assert.equal(lab.nodes.get('thermalSettings').hidden, true);
    lab.input('thermalMode', 'thermostat');
    assert.equal(lab.nodes.get('thermalSettings').hidden, false, 'The invalid field remains visible so it can be corrected');
    assert.equal(lab.metrics.thermalMode, 'isolated', 'An invalid temperature does not activate a new thermostat');
    lab.input('bathTemperature', 3);
    assert.equal(lab.metrics.thermalMode, 'thermostat');
    assert.equal(lab.metrics.bathTemperature, 3);
    assert.equal(lab.nodes.get('bathTemperature').getAttribute('aria-invalid'), 'false');
    assert.equal(lab.metrics.energy, energy);
    assert.equal(lab.metrics.heat, 0);
  }
});

test('thermostat temperature affects relaxation and reset preserves settings while clearing heat and cycles', () => {
  const hot = laboratory(), cold = laboratory();
  for (const [lab, temperature] of [[hot, 4], [cold, 0.5]]) {
    lab.input('bathTemperature', temperature); lab.input('thermalMode', 'thermostat'); lab.advance(5);
  }
  assert.ok(hot.metrics.temperature > cold.metrics.temperature + 0.5);
  hot.check('thermalPiston', false);
  assert.equal(hot.metrics.pistonThermal, false);
  hot.input('accommodation', 35);
  hot.input('duration', 0); hot.input('motion', 'oscillate'); hot.click('start'); hot.advance(0.6);
  assert.ok(hot.analysis.cycles.length >= 2);
  hot.click('reset');
  assert.equal(hot.analysis.cycles.length, 0);
  assert.equal(hot.metrics.heat, 0);
  assert.equal(hot.metrics.heatIn, 0);
  assert.equal(hot.metrics.heatOut, 0);
  assert.equal(hot.metrics.pressureWork, 0);
  assert.equal(hot.metrics.thermalMode, 'thermostat');
  assert.equal(hot.metrics.bathTemperature, 4);
  assert.equal(hot.metrics.accommodation, 0.35);
  assert.equal(hot.metrics.pistonThermal, false);
  assert.equal(hot.metrics.time, 0);
});

test('a manual outward and return command closes the starting volume and includes intervening heat', () => {
  const lab = laboratory();
  lab.input('thermalMode', 'thermostat'); lab.input('bathTemperature', 3);
  lab.input('duration', 0); lab.click('start'); lab.advance(0.5);
  const firstRun = lab.analysis.runId;
  assert.equal(lab.analysis.cycles.length, 1);
  assert.equal(lab.nodes.get('returnCycle').disabled, false);
  lab.advance(0.4);
  lab.click('returnCycle'); lab.advance(0.4);
  assert.ok(lab.analysis.runId > firstRun);
  const cycle = lab.analysis.cycles.find(record => record.complete);
  assert.ok(cycle);
  assert.equal(cycle.kind, 'manual');
  assert.equal(cycle.summary.closedVolume, true);
  assert.ok(Math.abs(cycle.rows.at(-1).volume - cycle.rows[0].volume) < 1e-8);
  assert.ok(new Set(cycle.rows.map(row => row.runId)).size >= 2);
  assert.notEqual(cycle.summary.heat, 0);
  assertBalance(cycle.summary);
  assert.equal(cycle.reconstruction.valid, true, cycle.reconstruction.reason);
  assert.equal(lab.nodes.get('returnCycle').disabled, true);
});

function csvData(text) {
  assert.ok(!/NaN|Infinity/.test(text));
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/), headings = lines.shift().split(';');
  const rows = lines.map(line => {
    const cells = line.split(';'); assert.equal(cells.length, headings.length);
    return Object.fromEntries(headings.map((name, i) => [name, cells[i]]));
  });
  return { headings, rows, number: (row, key) => row[key] === '' ? null : Number(row[key].replace(',', '.')) };
}

test('measurement and cycle CSV exports preserve Q, first-law balances and reconstructed work', async () => {
  const lab = periodicLaboratory({ thermal: true }); lab.advance(1.6);
  lab.click('export');
  const measurements = csvData(await lab.downloads.at(-1).blob.text());
  const last = measurements.rows.at(-1), M = key => measurements.number(last, key);
  assert.ok(measurements.headings.includes('chaleur_recue_nette_ur'));
  assert.notEqual(M('chaleur_recue_nette_ur'), 0);
  assert.ok(Math.abs(M('chaleur_recue_nette_ur') - lab.metrics.heat) < Math.max(1e-7, Math.abs(lab.metrics.heat) * 1e-9));
  assert.ok(Math.abs(M('ecart_bilan_ur')) < 1e-7);
  assert.equal(last.mode_thermique, 'thermostat');
  assert.equal(last.piston_thermalise, '1');
  lab.click('exportCycles');
  assert.equal(lab.downloads.at(-1).download, 'gaz-2d-cycles.csv');
  const exported = csvData(await lab.downloads.at(-1).blob.text());
  assert.ok(exported.rows.length >= 4);
  assert.ok(exported.headings.includes('W_reconstruit_Peff_ur'));
  for (const row of exported.rows) {
    const N = key => exported.number(row, key);
    assert.ok(Math.abs(N('delta_E_ur') - N('W_recu_ur') - N('Q_recue_ur')) < Math.max(1e-6, Math.abs(N('W_recu_ur')) * 1e-8));
    assert.ok(Math.abs(N('ecart_bilan_ur')) < 1e-7);
    if (N('W_reconstruit_Peff_ur') != null) assert.ok(Math.abs(N('W_reconstruit_Peff_ur') - N('W_recu_ur')) < Math.max(1e-6, Math.abs(N('W_recu_ur')) * 1e-8));
    if (row.acheve === '1') assert.equal(row.volume_revenu, '1');
  }
});

test('main tabs preserve measurements and paused state; keyboard navigation has one selected panel', () => {
  const lab = laboratory();lab.advance(.3);lab.click('start');lab.advance(.3);lab.click('pause');
  const before = lab.metrics;
  for (const view of ['diagrams','particles','understand','experience']) {
    lab.click('tab-' + view);
    assert.equal(lab.analysis.currentView,view);
    for (const other of ['experience','diagrams','particles','understand']) {
      assert.equal(lab.nodes.get('view-'+other).hidden,other!==view);
      assert.equal(lab.nodes.get('tab-'+other).getAttribute('aria-selected'),String(other===view));
    }
    assert.equal(lab.metrics.time,before.time);assert.equal(lab.metrics.work,before.work);assert.equal(lab.paused,true);
  }
  lab.nodes.get('tab-experience').dispatch('keydown',{key:'ArrowRight',preventDefault(){}});
  assert.equal(lab.analysis.currentView,'diagrams');assert.equal(lab.nodes.get('tab-diagrams').focused,true);
  lab.nodes.get('tab-diagrams').dispatch('keydown',{key:'End',preventDefault(){}});
  assert.equal(lab.analysis.currentView,'understand');
});
test('Joule–Gay–Lussac preset doubles the volume into vacuum with W = Q = ΔE = 0', () => {
  const lab=laboratory();lab.input('thermalMode','thermostat');lab.advance(.3);
  lab.click('preset-free');assert.equal(lab.metrics.width,9);assert.equal(lab.metrics.thermalMode,'isolated');
  assert.equal(lab.metrics.time,0);assert.equal(lab.nodes.get('durationField').hidden,true);
  const energy=lab.metrics.energy;lab.click('start');lab.advance(.5);
  assert.equal(lab.metrics.width,18);assert.equal(lab.metrics.energy,energy);assert.equal(lab.metrics.heat,0);assert.equal(lab.metrics.work,0);
  lab.click('reset');assert.equal(lab.metrics.width,9);lab.click('start');assert.equal(lab.metrics.width,18);
});
test('adiabatic presets enforce isolation, the expected direction and work sign', () => {
  const lab=laboratory();
  for (const preset of ['compression','expansion']) {
    lab.click('preset-'+preset);assert.equal(lab.metrics.thermalMode,'isolated');assert.equal(lab.metrics.time,0);
    lab.input('duration',0);lab.click('start');lab.advance(.6);
    assert.ok(preset==='compression' ? lab.metrics.work>0 : lab.metrics.work<=0);
    assert.equal(lab.metrics.heat,0);assert.ok(Math.abs(lab.metrics.balanceError)<1e-8);
    assert.ok(preset==='compression' ? lab.metrics.width<11 : lab.metrics.width>11);
  }
});
test('cycle preset records multiple periods, and free configuration preserves their measurements', () => {
  const lab=laboratory();lab.click('preset-cycles');lab.input('duration',0);lab.click('start');lab.advance(1.5);
  assert.ok(lab.analysis.cycles.filter(c=>c.complete).length>=3);
  lab.click('pause');const before=lab.metrics;const count=lab.analysis.cycles.length;
  lab.click('preset-custom');assert.equal(lab.analysis.selectedPreset,'custom');assert.equal(lab.nodes.get('customMotion').open,true);
  assert.equal(lab.metrics.time,before.time);assert.equal(lab.analysis.cycles.length,count);
});
test('thermal changes exit a named adiabatic preset and the bath slider applies only to future impacts', () => {
  const lab=laboratory();lab.click('preset-expansion');lab.click('pause');const before=lab.metrics.energy;
  lab.input('thermalMode','thermostat');lab.input('bathSlider',300);
  assert.equal(lab.metrics.bathTemperature,3);assert.equal(lab.metrics.energy,before);
  assert.equal(lab.nodes.get('bathTemperature').value,'3');assert.equal(lab.analysis.selectedPreset,'custom');
});
test('hard disks require applying a new state, preserve particle count and export the model actually simulated', async () => {
  const lab=laboratory();lab.input('particles',1000);lab.input('particleModel','hard-disks');
  assert.equal(lab.metrics.particleModel,'ideal');assert.equal(lab.metrics.count,180);
  lab.click('applyInitial');assert.equal(lab.metrics.particleModel,'hard-disks');assert.equal(lab.metrics.count,1000);
  lab.advance(.3);assert.ok(lab.metrics.pairCollisions>0);assert.ok(Math.abs(lab.metrics.balanceError)<1e-7);
  lab.click('export');const text=await lab.downloads.at(-1).blob.text();
  assert.match(text,/modele_particules;rayon_particule_ur;chocs_entre_particules;fraction_surface_occupee/);assert.match(text,/hard-disks/);
  lab.click('preset-free');assert.equal(lab.metrics.particleModel,'hard-disks');assert.equal(lab.metrics.count,1000);
  lab.click('start');assert.equal(lab.metrics.width,18);assert.equal(lab.metrics.heat,0);assert.equal(lab.metrics.work,0);
});
