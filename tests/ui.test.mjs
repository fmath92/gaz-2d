import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../dist/physics.js', import.meta.url), 'utf8');
const analysis = readFileSync(new URL('../dist/analysis.js', import.meta.url), 'utf8');
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
      disabled: Object.hasOwn(attrs, 'disabled'), checked: Object.hasOwn(attrs, 'checked'), hidden: false,
      textContent: '', innerHTML: '', width: 0, height: 0,
      min: attrs.min ?? '', max: attrs.max ?? '', step: attrs.step ?? '',
      classList: { toggle(name, force) { const on = force ?? !classes.has(name); if (on) classes.add(name); else classes.delete(name); return on; }, contains: name => classes.has(name) },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name] ?? null; },
      addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(listener); },
      dispatch(name) { for (const listener of listeners.get(name) || []) listener({ target: this, type: name }); },
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
    if (attrs['data-chart']) node.dataset.chart = attrs['data-chart'];
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
  nodes.get('pressureSource').value = 'mean';
  const document = {
    hidden: false,
    getElementById(id) { assert.ok(nodes.has(id), `Element ${id} exists in the real HTML`); return nodes.get(id); },
    querySelectorAll(selector) { assert.equal(selector, '[data-chart]'); return charts; },
    createElement: tag => element(tag),
    addEventListener() {}
  };
  const window = { devicePixelRatio: 1, addEventListener() {} };
  const scope = vm.createContext({ document, window, console, Blob,
    URL: { createObjectURL(blob) { const key = 'blob:test-measures-' + blobs.size; blobs.set(key, blob); return key; }, revokeObjectURL() {} },
    setTimeout() {},
    requestAnimationFrame(callback) { pendingFrame = callback; }
  });
  vm.runInContext(physics, scope, { filename: 'physics.js' });
  vm.runInContext(analysis, scope, { filename: 'analysis.js' });
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
  lab.charts[1].click();
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

test('all four chart tabs show the requested variables and logarithmic diagnostics only when selected', () => {
  const lab = laboratory(); lab.advance(0.4);
  assert.equal(lab.charts.length, 4);
  const labels = { time: /Évolution/, pv: /volume/, pvt: /température/, log: /Logarithme/ };
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
    lab.charts[2].click(); lab.click('export');
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
  lab.input('duration', 64); lab.click('start'); lab.advance(8.5); lab.charts[3].click();
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
  for (const item of [lab, control]) { item.input('duration', 64); item.click('start'); item.advance(3); item.charts[3].click(); }
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
  lab.charts[3].click();
  assert.match(lab.nodes.get('fitStatus').textContent, /détente libre/);
});
