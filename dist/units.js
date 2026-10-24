(function (root) {
  'use strict';
  // Fixed dimensional mapping. Never recalibrate from measured pressure or presets.
  const volume = 1e-3 / 82.5, pressure = 5500, temperature = 200;
  const energy = pressure * volume, length = Math.cbrt(volume), velocity = 200;
  const time = length / velocity, momentum = energy / velocity;
  const R = 8.31446261815324, nR = 1000 * energy / temperature;
  const scales = Object.freeze({ volume, pressure, temperature, energy, length, velocity,
    time, momentum, depth: length, power: energy / time,
    flux: energy / (length * length * time), amount: nR / R, nR, R });
  const convert = (value, scale) => value == null ? null : value * scale;
  const factors = { temperature, volume: volume * 1000, pressure: pressure / 1e5,
    energy, velocity, time: time * 1000, momentum,
    length: length * 100, power: energy / time, flux: scales.flux / 1000 };
  const labels = { temperature:'K', volume:'L', pressure:'bar', energy:'J', velocity:'m/s',
    time:'ms', momentum:'kg·m/s', length:'cm', power:'W', flux:'kW/m²' };
  const api = { scales, value: (kind, value) => convert(value, factors[kind]),
    text(kind, value, digits = 2) {
      const v = convert(value, factors[kind]);
      if (kind === 'momentum' && v != null && Number.isFinite(v) && Math.abs(v) > 0 && Math.abs(v) < .01) return v.toLocaleString('fr-FR', {maximumFractionDigits:6}) + ' ' + labels[kind];
      return v == null || !Number.isFinite(v) ? '—' : (Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v).toLocaleString('fr-FR', {
        minimumFractionDigits: digits, maximumFractionDigits: digits }) + ' ' + labels[kind];
    } };
  root.GasUnits = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : window);
