(function (root) {
  'use strict';
  const format = (v, digits = 2) => Number.isFinite(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
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
    const tick = (value, span) => Math.abs(value) >= 10000 ? value.toExponential(1) : format(value, span < 1 ? 2 : span < 8 ? 1 : 0);
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
  function plotLine(ctx, axes, points, color, { dashed = false, scatter = false, radius = 1.7, lineWidth = 1.7, arrows = false } = {}) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lineWidth;
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
    if (arrows && points.length > 3) {
      for (let i = Math.max(1, Math.floor(points.length / 5)); i < points.length; i += Math.max(1, Math.floor(points.length / 4))) {
        const a = points[i - 1], b = points[i];
        if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
        let from = i - 1;
        while (from > 0 && Math.hypot(axes.X(b.x) - axes.X(points[from].x), axes.Y(b.y) - axes.Y(points[from].y)) < 9) from--;
        const p = points[from];
        if (![p.x, p.y].every(Number.isFinite)) continue;
        const x = axes.X(b.x), y = axes.Y(b.y), angle = Math.atan2(y - axes.Y(p.y), x - axes.X(p.x));
        line(ctx, x, y, x - 5 * Math.cos(angle - 0.5), y - 5 * Math.sin(angle - 0.5), color, 1.4);
        line(ctx, x, y, x - 5 * Math.cos(angle + 0.5), y - 5 * Math.sin(angle + 0.5), color, 1.4);
      }
    }
  }
  function setup(canvas) {
    const { width: w, height: h } = canvas.getBoundingClientRect();
    if (!w || !h) return null;
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function line(ctx, x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function arrow(ctx, x, y, dx, dy, color, width = 2) {
    if (Math.hypot(dx, dy) < 0.1) return;
    const angle = Math.atan2(dy, dx), endX = x + dx, endY = y + dy;
    line(ctx, x, y, endX, endY, color, width);
    line(ctx, endX, endY, endX - 6 * Math.cos(angle - 0.5), endY - 6 * Math.sin(angle - 0.5), color, width);
    line(ctx, endX, endY, endX - 6 * Math.cos(angle + 0.5), endY - 6 * Math.sin(angle + 0.5), color, width);
  }
  function circle(ctx, x, y, radius, color) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }
  const palette = ['#397bd1', '#479ac3', '#4caaa6', '#81b78a', '#c4b767', '#db9852', '#d76f47'];
  function chamber(canvas, sim, { initialTemperature = 1.5, vectors = false, focus = null, maxWidth = 18, target = null } = {}) {
    const surface = setup(canvas); if (!surface) return;
    const { ctx, w, h } = surface;
    const scale = Math.min((w - 58) / maxWidth, (h - 54) / sim.height);
    const ox = 26, oy = (h - sim.height * scale) / 2 + 3;
    const right = ox + sim.width * scale, bottom = oy + sim.height * scale, end = ox + maxWidth * scale;
    ctx.fillStyle = '#f7fafc'; ctx.fillRect(ox, oy, end - ox, bottom - oy);
    ctx.fillStyle = '#edf4f9'; ctx.fillRect(ox, oy, right - ox, bottom - oy);
    for (let x = 20; x < w; x += 20) for (let y = 16; y < h; y += 20) { ctx.fillStyle = '#dce7ed'; ctx.fillRect(x, y, 1, 1); }
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, right - ox, bottom - oy); ctx.clip();
    for (const p of sim.particles) {
      const x = ox + p.x * scale, y = bottom - p.y * scale;
      const color = palette[Math.min(6, Math.floor(Math.hypot(p.vx, p.vy) / Math.sqrt(2 * initialTemperature) * 3))];
      if (vectors) line(ctx, x, y, x + p.vx * scale * 0.1, y - p.vy * scale * 0.1, color + '80');
      circle(ctx, x, y, 0.04 * scale, color); // Même rayon graphique pour les deux modèles.
    }
    ctx.restore();
    const thermal = wall => sim.thermal.mode === 'thermostat' && sim.thermal.accommodation > 0 && sim.thermal.walls.includes(wall) && (wall !== 'right' || sim.thermal.pistonThermal);
    line(ctx, ox, oy, end, oy, thermal('top') ? '#dc9855' : '#9bb0bf', 3);
    line(ctx, ox, bottom, end, bottom, thermal('bottom') ? '#dc9855' : '#9bb0bf', 3);
    line(ctx, ox, oy, ox, bottom, thermal('left') ? '#dc9855' : '#7590a3', 5);
    line(ctx, right, oy - 3, right, bottom + 3, thermal('right') ? '#dc9855' : '#6f869f', 7);
    line(ctx, right + 4, (oy + bottom) / 2, end + 15, (oy + bottom) / 2, '#a7b7c2', 5);
    ctx.font = '10px system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = thermal('left') ? '#b6793f' : '#6b8292';
    ctx.fillText(thermal('left') ? 'THERMOSTAT' : 'ISOLÉE', ox, oy - 10);
    ctx.textAlign = 'center'; ctx.fillStyle = '#5f7689'; ctx.fillText('PISTON', Math.max(ox + 70, right), oy - 10);
    ctx.fillText('V = ' + format(sim.width * sim.height, 1), (ox + right) / 2, bottom + 18);
    if (target != null && Math.abs(target - sim.width) > 0.05) {
      ctx.setLineDash([3, 4]); line(ctx, ox + target * scale, oy + 5, ox + target * scale, bottom - 5, '#97ada780'); ctx.setLineDash([]);
    }
    if (focus) {
      const p = focus.kind === 'pair' ? focus.before[0] : focus;
      const x = ox + p.x * scale, y = bottom - p.y * scale;
      const size = Math.max(10, scale * 0.55);
      ctx.strokeStyle = '#dd9c36'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.strokeRect(x - size / 2, y - size / 2, size, size); ctx.setLineDash([]);
      circle(ctx, x, y, 2.5, '#df9c36');
    }
  }
  function collision(canvas, event, { kind = 'pressure', pulse = 0 } = {}) {
    const surface = setup(canvas); if (!surface) return;
    const { ctx, w, h } = surface;
    ctx.font = '11px system-ui'; ctx.fillStyle = '#6a7e8d'; ctx.textAlign = 'center';
    if (!event) { ctx.fillText('Les prochains chocs apparaîtront ici.', w / 2, h / 2); return; }
    if (event.kind === 'pair') {
      line(ctx, w / 2, 8, w / 2, h - 8, '#dce5e9');
      for (let side = 0; side < 2; side++) {
        const centerX = w * (side ? 0.75 : 0.25), centerY = h * 0.58;
        ctx.fillStyle = side ? '#b57a38' : '#3679bd'; ctx.textAlign = 'center';
        ctx.fillText(side ? 'Disques : déviation au contact' : 'Points : ils se traverseraient', centerX, 15);
        const center = { x: (event.before[0].x + event.before[1].x) / 2, y: (event.before[0].y + event.before[1].y) / 2 };
        const radius = 9, scale = radius / 0.04;
        const largest = Math.max(...event.before.concat(event.after).map(p => Math.hypot(p.vx, p.vy)), 1);
        const vectorScale = Math.min(44, w / 11) / largest;
        event.before.forEach((p, i) => {
          const x = centerX + (p.x - center.x) * scale, y = centerY - (p.y - center.y) * scale;
          const after = side ? event.after[i] : p;
          ctx.setLineDash([3, 3]); arrow(ctx, x - p.vx * vectorScale, y + p.vy * vectorScale, p.vx * vectorScale, -p.vy * vectorScale, '#5488bd80', 1.2); ctx.setLineDash([]);
          arrow(ctx, x, y, after.vx * vectorScale, -after.vy * vectorScale, i ? '#bb7b39' : '#258c7a', 2);
          circle(ctx, x, y, radius, i ? '#e2b27580' : '#7cbbd480');
          ctx.strokeStyle = i ? '#bb7b39' : '#3679bd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.stroke();
        });
      }
      return;
    }
    const leftWall = event.wall === 'left', wallX = leftWall ? w * 0.28 : w * 0.70;
    const inward = leftWall ? 1 : -1, cy = h * 0.53;
    ctx.fillStyle = kind === 'heat' && event.thermal ? '#f7e4cb' : '#e0e9ef';
    ctx.fillRect(wallX - (leftWall ? 12 : 0), 25, 12, h - 38);
    line(ctx, wallX, 25, wallX, h - 13, kind === 'heat' ? '#cb8d48' : '#7890a3', 3);
    const before = { vx: event.before.vx - event.wallVelocity, vy: event.before.vy };
    const after = { vx: event.after.vx - event.wallVelocity, vy: event.after.vy };
    const max = Math.max(Math.hypot(before.vx, before.vy), Math.hypot(after.vx, after.vy), 0.1);
    const scale = Math.min(w * 0.23, h * 0.31) / max;
    const cx = wallX + inward * event.radius * 210;
    arrow(ctx, cx - before.vx * scale, cy + before.vy * scale, before.vx * scale, -before.vy * scale, '#397fbe', 2.5);
    arrow(ctx, cx, cy, after.vx * scale, -after.vy * scale, '#258d79', 2.5);
    circle(ctx, cx, cy, 8.4, '#5799bfa0');
    ctx.strokeStyle = '#e8ac47' + (pulse > 0 ? 'aa' : '40'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 12 + 8 * pulse, 0, 2 * Math.PI); ctx.stroke();
    let beforeLabelY = Math.min(h - 8, Math.max(30, cy + before.vy * scale - 7));
    let afterLabelY = Math.min(h - 8, Math.max(30, cy - after.vy * scale + 13));
    if (Math.abs(beforeLabelY - afterLabelY) < 18) {
      const middle = (beforeLabelY + afterLabelY) / 2;
      beforeLabelY = middle - 10; afterLabelY = middle + 10;
    }
    ctx.fillStyle = '#47718f'; ctx.textAlign = 'left'; ctx.fillText('Avant', Math.max(8, cx - before.vx * scale - 35), beforeLabelY);
    ctx.fillStyle = '#217a69'; ctx.fillText('Après', Math.max(8, cx + after.vx * scale - 35), afterLabelY);
    if (kind === 'heat') {
      const sign = Math.sign(event.heat), dx = inward * sign * Math.min(74, w * 0.17), y = cy;
      if (sign) arrow(ctx, wallX - dx / 2, y, dx, 0, sign > 0 ? '#cf8b3899' : '#598ac099', 4);
      ctx.fillStyle = sign > 0 ? '#b1712d' : '#4877a6'; ctx.textAlign = 'center';
      ctx.fillText('δQ = ' + format(event.heat), w * 0.72, h * 0.50);
      ctx.fillText(sign > 0 ? 'La paroi donne de l’énergie' : sign < 0 ? 'Le gaz cède de l’énergie' : 'Pas de chaleur échangée', w * 0.72, h * 0.50 + 18);
    } else {
      const dx = -inward * Math.min(75, w * 0.17);
      arrow(ctx, wallX, cy, dx, 0, '#d4913b', 3);
      ctx.fillStyle = '#b07a3b'; ctx.textAlign = 'center'; ctx.fillText('J = ' + format(event.impulse), wallX + dx / 2, cy + 22);
      ctx.fillStyle = '#617c8d'; ctx.fillText('u = ' + format(event.wallVelocity), wallX, 14);
      if (event.wallVelocity) arrow(ctx, wallX, 20, Math.sign(event.wallVelocity) * 30, 0, '#6f98ac', 1.5);
    }
  }
  function plot(canvas, { series, xRange, yRange, xLabel, yLabel }) {
    const surface = setup(canvas); if (!surface) return;
    const { ctx, w, h } = surface;
    const axes = plotAxes(ctx, w, h, xRange, yRange, xLabel, yLabel);
    ctx.save(); ctx.beginPath(); ctx.rect(axes.left, axes.top, axes.right - axes.left, axes.bottom - axes.top); ctx.clip();
    for (const s of series) plotLine(ctx, axes, s.points, s.color, s);
    ctx.restore();
  }
  function histogram(canvas, samples, references) {
    const surface = setup(canvas); if (!surface) return;
    const { ctx, w, h } = surface;
    const max = Math.max(...samples, ...references, 1e-9) * 1.05;
    const actual = root.GasAnalysis.histogram(samples, { bins: 20, max });
    const initial = root.GasAnalysis.histogram(references, { bins: 20, max });
    const axes = plotAxes(ctx, w, h, [0, max], [0, Math.max(...actual.bins.map(b => b.density), ...initial.bins.map(b => b.density), 0.01) * 1.15], 'u.r.', 'Densité');
    for (const b of actual.bins) { ctx.fillStyle = '#4b92c080'; ctx.fillRect(axes.X(b.min) + 1, axes.Y(b.density), Math.max(0, axes.X(b.max) - axes.X(b.min) - 2), axes.Y(0) - axes.Y(b.density)); }
    plotLine(ctx, axes, initial.bins.flatMap(b => [{ x: b.min, y: b.density }, { x: b.max, y: b.density }]), '#bd843e', { dashed: true });
  }
  root.LabGraphics = { setup, chamber, collision, plot, histogram, dataRange };
})(typeof globalThis !== 'undefined' ? globalThis : window);
