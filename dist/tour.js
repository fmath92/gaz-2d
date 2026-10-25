/* Automatic camera sequences driven by future, then actual physical collisions.
 * Forecast and live simulation use exactly the same steps and thermostat RNG.
 * No particle trajectory, collision velocity, heat or work is fabricated. */
(function (root) {
  'use strict';
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const stepSize = (sim, quantum) => sim.motion
    ? Math.min(quantum, Math.max(1e-10, sim.motion.duration - sim.motion.elapsed)) : quantum;
  class CollisionTour {
    constructor(sim, { kind = 'pressure', speed = 1, reducedMotion = false, manualComparison = false } = {}) {
      this.manualComparison=manualComparison; this.sim = sim; this.kind = kind; this.normalSpeed = speed; this.reducedMotion = reducedMotion;
      this.stages = kind === 'heat' ? ['heat-in', 'heat-out'] : [kind];
      this.stageIndex = 0; this.events = []; this.zoom = 0; this.finished = false;
      this.message = ''; this.beginSearch();
    }
    beginSearch() {
      this.phase = 'search'; this.elapsed = 0; this.accumulator = 0; this.target = null; this.event = null; this.impactAge = 0;
      this.startTime = this.sim.time; this.startWidth = this.sim.width;
      const remaining = this.sim.motion ? this.sim.motion.duration - this.sim.motion.elapsed : Infinity;
      const averageSpeed = this.sim.motion ? Math.abs(this.sim.motion.targetWidth-this.sim.motion.startWidth)/this.sim.motion.duration : 0;
      const lead = this.kind === 'work' ? Math.max(.6, .12/Math.max(averageSpeed,.03)) : .22;
      this.leadMinimum = Math.min(lead, remaining * .20);
      this.quantum = Math.min(1 / 480, Math.max(1e-5, this.leadMinimum / 180));
      this.deadline = this.startTime + Math.min(8, this.kind === 'work' ? remaining : 8);
      this.probe = this.sim.fork(); this.probe.observeCollisions = true;
      if (this.kind === 'work' && !this.sim.motion) this.fail('Choisissez une détente ou une compression, puis lancez le piston.');
      if (this.kind === 'heat' && (this.sim.thermal.mode !== 'thermostat' || !this.sim.thermal.walls.includes('left') || this.sim.thermal.accommodation === 0))
        this.fail('Activez le contact thermique de la paroi gauche pour observer un échange de chaleur.');
    }
    fail(message) { this.message = message; this.finished = true; this.phase = 'unavailable'; this.zoom = 0; this.probe = null; }
    accepts(e) {
      if (!e || e.time < this.startTime + this.leadMinimum || e.y < .5 || e.y > this.sim.height - .5) return false;
      const stage = this.stages[this.stageIndex];
      if (stage === 'heat-in') return e.thermal && e.heat > .08;
      if (stage === 'heat-out') return e.thermal && e.heat < -.08;
      if (stage === 'work') return e.before.vx > .1 && Math.abs(e.wallVelocity) > 1e-8 && Math.abs(e.work) > .005;
      return e.impulse > .1 && e.wallVelocity === 0;
    }
    plan(budgetMs = 7) {
      const started = performance.now(), wall = this.kind === 'heat' ? 'left' : 'right';
      // Both a clock budget and an iteration bound keep planning responsive.
      for (let i = 0; i < 240 && this.phase === 'search'; i++) {
        this.probe.step(stepSize(this.probe, this.quantum));
        const e = this.probe.observations.walls[wall];
        if (this.accepts(e)) {
          this.target = e; this.lead = e.time - this.sim.time;
          this.phase = 'approach'; this.elapsed = 0; this.rate = Math.min(this.lead / 3.2, this.normalSpeed / 2);
          this.probe = null; break;
        }
        if (this.probe.time >= this.deadline - 1e-10) {
          this.fail(this.kind === 'work' ? 'Aucun choc adapté pendant ce trajet. Essayez un déplacement plus lent ou relancez une compression.'
            : 'Aucun choc de ce signe trouvé dans les 8 prochaines unités de temps. Ajustez la température de paroi, puis réessayez.');
          break;
        }
        if (performance.now() - started >= budgetMs) break;
      }
    }
    continueComparison(){if(this.manualComparison&&this.phase==='compare'){this.phase='return';this.elapsed=0;}}
    tick(seconds, advance, budgetMs = 9) {
      if (this.finished || (this.manualComparison && this.phase==='compare')) return;
      if (this.phase === 'search') { this.plan(budgetMs); return; }
      this.elapsed += seconds;
      if (this.event && this.phase !== 'compare') this.impactAge += seconds;
      if (this.phase === 'approach') {
        this.zoom = this.reducedMotion ? 1 : ease(this.elapsed / 1.1);
        this.rate = Math.min(this.lead / 3.2, this.normalSpeed / 2);
      } else if (this.phase === 'impact') {
        this.zoom = 1;
        const outgoingRate = Math.min(this.normalSpeed / 2, .24 / (2.2 * Math.max(1, Math.hypot(this.event.after.vx, this.event.after.vy))));
        this.rate = this.incomingRate + ease(this.elapsed / .9) * (outgoingRate - this.incomingRate);
        if (this.elapsed >= .9) { this.phase = 'departure'; this.elapsed = 0; }
      } else if (this.phase === 'departure') {
        this.rate = Math.min(this.normalSpeed / 2, .24 / (2.2 * Math.max(1, Math.hypot(this.event.after.vx, this.event.after.vy))));
        if (this.elapsed >= 2.2) {
          this.phase = this.kind === 'work' || this.manualComparison ? 'compare' : 'return'; this.elapsed = 0;
          if (this.phase === 'compare') { this.rate = 0; return; }
        }
      } else if (this.phase === 'compare') {
        this.zoom = 1; this.rate = 0;
        if (this.elapsed >= 2.5) { this.phase = 'return'; this.elapsed = 0; }
        return;
      } else if (this.phase === 'return') {
        const q = ease(this.elapsed / 1.1);
        this.zoom = this.reducedMotion ? (q < 1 ? 1 : 0) : 1 - q;
        this.rate = .04 + q * (this.normalSpeed - .04);
        if (this.elapsed >= 1.1) {
          this.zoom = 0;
          if (++this.stageIndex < this.stages.length) this.beginSearch();
          else { this.finished = true; this.phase = 'done'; }
          return;
        }
      }
      this.accumulator = Math.min(.15, this.accumulator + seconds * this.rate);
      const started = performance.now();
      for (let i = 0; i < 240 && this.accumulator >= this.quantum && !this.finished; i++) {
        const h = advance(stepSize(this.sim, this.quantum));
        this.accumulator = Math.max(0, this.accumulator - h);
        if (this.phase === 'approach' && this.sim.time >= this.target.time - 1e-10) {
          const actual = this.sim.observations.walls[this.target.wall];
          if (!actual || actual.particleId !== this.target.particleId || Math.abs(actual.time - this.target.time) > 1e-7) {
            this.fail('La collision prévue a changé. Relancez l’illustration depuis cet état.'); break;
          }
          this.event = actual; this.events.push(actual); this.phase = 'impact'; this.elapsed = 0;
          this.incomingRate = this.rate; this.impactAge = 0; this.zoom = 1; break;
        }
        if (performance.now() - started >= budgetMs) break;
      }
    }
    get view() {
      return { kind: this.kind, phase: this.phase, zoom: this.zoom, target: this.target,
        startWidth: this.startWidth, event: this.event, elapsed: this.elapsed, impactAge: this.impactAge, rate: this.rate || 0,
        stage: Math.min(this.stageIndex + 1, this.stages.length), stages: this.stages.length };
    }
  }
  root.CollisionTour = CollisionTour;
})(typeof globalThis !== 'undefined' ? globalThis : window);
