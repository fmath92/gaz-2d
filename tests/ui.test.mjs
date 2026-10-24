import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../dist/physics.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

// Only DOM and drawing primitives are replaced. The production application,
// animation loop and physics engine run unchanged, including all button handlers.
function laboratory() {
  const nodes = new Map();
  let pendingFrame, timestamp = 1000;
  const downloads = [];
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
      click() { if (!this.disabled) { this.dispatch('click'); if (tag === 'a') downloads.push({ href: this.href, download: this.download }); } },
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
  const document = {
    hidden: false,
    getElementById(id) { assert.ok(nodes.has(id), `Element ${id} exists in the real HTML`); return nodes.get(id); },
    querySelectorAll(selector) { assert.equal(selector, '[data-chart]'); return charts; },
    createElement: tag => element(tag),
    addEventListener() {}
  };
  const window = { devicePixelRatio: 1, addEventListener() {} };
  const scope = vm.createContext({ document, window, console, Blob,
    URL: { createObjectURL: () => 'blob:test-measures', revokeObjectURL() {} },
    setTimeout() {},
    requestAnimationFrame(callback) { pendingFrame = callback; }
  });
  vm.runInContext(physics, scope, { filename: 'physics.js' });
  vm.runInContext(app, scope, { filename: 'app.js' });
  function frame() { const callback = pendingFrame; pendingFrame = null; callback(timestamp); timestamp += 1000 / 60; }
  frame();
  return {
    nodes, charts, freeOption, downloads,
    get metrics() { return window.gaz2D.metrics; },
    get paused() { return window.gaz2D.paused; },
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
