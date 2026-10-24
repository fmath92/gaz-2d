/* Gaz parfait ponctuel en 2D, m = kB = 1. Les disques de l'interface
 * n'ont pas de rayon physique et les particules ne s'entrechoquent pas.
 * La température cinétique scalaire est E/N ; hors équilibre Tx et Ty
 * peuvent différer. Le piston échange du travail, jamais de chaleur. */
(function (root) {
  'use strict';
  const EPS = 1e-11;
  const WALLS = ['left', 'right', 'top', 'bottom'];
  const finite = (n, name) => {
    if (!Number.isFinite(n)) throw new TypeError(name + ' doit être fini.');
    return n;
  };
  const checkWidth = (width) => {
    finite(width, 'La largeur');
    if (width < 3 || width > 18) throw new RangeError('La largeur doit être comprise entre 3 et 18.');
    return width;
  };
  function randomGenerator(seed) {
    let a = (Number(seed) || 1) >>> 0;
    return function () {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gaussian(random) {
    return Math.sqrt(-2 * Math.log(Math.max(1e-15, random()))) * Math.cos(2 * Math.PI * random());
  }
  class GasSimulation {
    constructor(options = {}) {
      this.height = finite(options.height ?? 7.5, 'La hauteur');
      if (this.height <= 0) throw new RangeError('La hauteur doit être positive.');
      this.measurementWindow = finite(options.measurementWindow ?? 2, 'La fenêtre de mesure');
      if (this.measurementWindow <= 0) throw new RangeError('La fenêtre de mesure doit être positive.');
      this.reset(options);
    }
    reset(options = {}) {
      const count = options.count ?? 180;
      const temperature = options.temperature ?? 1.5;
      if (!Number.isInteger(count) || count < 1 || count > 2000) throw new RangeError('Le nombre de particules doit être compris entre 1 et 2000.');
      finite(temperature, 'La température');
      if (temperature <= 0) throw new RangeError('La température doit être positive.');
      this.width = checkWidth(options.width ?? 11);
      this.count = count;
      this.seed = options.seed ?? 314159;
      const random = randomGenerator(this.seed);
      this.particles = Array.from({ length: count }, () => ({
        x: (0.005 + 0.99 * random()) * this.width,
        y: (0.005 + 0.99 * random()) * this.height,
        vx: gaussian(random), vy: gaussian(random)
      }));
      // Normalisation séparée : état initial isotrope, sans dérive collective.
      for (const key of ['vx', 'vy']) {
        const mean = count > 1 ? this.particles.reduce((s, p) => s + p[key], 0) / count : 0;
        const sum = this.particles.reduce((s, p) => s + (p[key] - mean) ** 2, 0);
        const scale = Math.sqrt(count * temperature / sum);
        for (const p of this.particles) p[key] = (p[key] - mean) * scale;
      }
      this.time = 0;
      this.work = 0;
      this.initialEnergy = count * temperature;
      this.motion = null;
      this._pistonVelocity = 0;
      this._events = [];
      this._segments = [];
      this._collisions = 0;
      return this;
    }
    setMotion({ type = 'linear', targetWidth, duration = 5 } = {}) {
      if (!['linear', 'smooth', 'oscillate'].includes(type)) throw new RangeError('Mouvement inconnu.');
      checkWidth(targetWidth);
      finite(duration, 'La durée');
      if (duration <= 0) throw new RangeError('La durée doit être positive.');
      this.motion = { type, targetWidth, duration, elapsed: 0, startWidth: this.width };
      this._pistonVelocity = type === 'linear' ? (targetWidth - this.width) / duration : 0;
      return this;
    }
    stopMotion() {
      this.motion = null;
      this._pistonVelocity = 0;
      return this;
    }
    freeExpand(targetWidth) {
      checkWidth(targetWidth);
      if (targetWidth < this.width - EPS) throw new RangeError('Une détente libre ne peut pas comprimer le gaz.');
      this.stopMotion();
      this.width = targetWidth;
      return this;
    }
    _motionWidth(motion, elapsed) {
      const q = elapsed / motion.duration;
      if (motion.type === 'linear') return motion.startWidth + (motion.targetWidth - motion.startWidth) * Math.min(1, q);
      const phase = motion.type === 'oscillate' ? q : Math.min(1, q);
      return motion.startWidth + (motion.targetWidth - motion.startWidth) * (1 - Math.cos(Math.PI * phase)) / 2;
    }
    _record(wall, impulse, time) {
      this._events.push({ wall, impulse, time });
      this._collisions++;
    }
    _advanceParticle(p, dt, oldWidth, pistonVelocity) {
      let elapsed = 0;
      while (elapsed < dt - EPS) {
        const remaining = dt - elapsed;
        const relative = p.vx - pistonVelocity;
        const leftTime = p.vx < -EPS ? Math.max(0, -p.x / p.vx) : Infinity;
        const rightTime = relative > EPS ? Math.max(0, (oldWidth + pistonVelocity * elapsed - p.x) / relative) : Infinity;
        const bottomTime = p.vy < -EPS ? Math.max(0, -p.y / p.vy) : Infinity;
        const topTime = p.vy > EPS ? Math.max(0, (this.height - p.y) / p.vy) : Infinity;
        const hit = Math.min(leftTime, rightTime, bottomTime, topTime);
        const travel = Math.min(remaining, hit);
        p.x += p.vx * travel;
        p.y += p.vy * travel;
        elapsed += travel;
        if (hit > remaining + EPS || !Number.isFinite(hit)) break;
        const collisionTime = this.time + elapsed;
        // Les égalités traitent aussi un choc simultané dans un coin.
        if (Math.abs(hit - leftTime) < EPS) {
          p.x = 0;
          this._record('left', -2 * p.vx, collisionTime);
          p.vx = -p.vx;
        }
        if (Math.abs(hit - rightTime) < EPS) {
          p.x = oldWidth + pistonVelocity * elapsed;
          const impulse = 2 * (p.vx - pistonVelocity);
          const oldVelocity = p.vx;
          p.vx = 2 * pistonVelocity - p.vx;
          this.work += 0.5 * (p.vx * p.vx - oldVelocity * oldVelocity);
          this._record('right', impulse, collisionTime);
        }
        if (Math.abs(hit - bottomTime) < EPS) {
          p.y = 0;
          this._record('bottom', -2 * p.vy, collisionTime);
          p.vy = -p.vy;
        }
        if (Math.abs(hit - topTime) < EPS) {
          p.y = this.height;
          this._record('top', 2 * p.vy, collisionTime);
          p.vy = -p.vy;
        }
      }
      // Le résidu < EPS ne porte pas de choc résolu ; il est négligeable
      // à la précision du temps de vol et ne modifie aucune vitesse.
    }
    step(dt) {
      finite(dt, 'Le pas de temps');
      if (dt < 0) throw new RangeError('Le pas de temps doit être positif.');
      let remaining = dt;
      while (remaining > EPS) {
        const m = this.motion;
        let h = Math.min(remaining, 1 / 240);
        // Les trajectoires courbes sont approximées par des segments fins.
        if (m) {
          h = Math.min(h, m.duration / 240);
          if (m.type !== 'oscillate') h = Math.min(h, Math.max(0, m.duration - m.elapsed));
          if (h < EPS) {
            this.width = m.targetWidth;
            this.stopMotion();
            continue;
          }
        }
        const oldWidth = this.width;
        const nextWidth = m ? this._motionWidth(m, m.elapsed + h) : oldWidth;
        const velocity = (nextWidth - oldWidth) / h;
        for (const particle of this.particles) this._advanceParticle(particle, h, oldWidth, velocity);
        this._segments.push({ start: this.time, end: this.time + h, width0: oldWidth, width1: nextWidth });
        this.width = nextWidth;
        this.time += h;
        remaining -= h;
        this._pistonVelocity = velocity;
        if (m) {
          m.elapsed += h;
          if (m.type !== 'oscillate' && m.elapsed >= m.duration - EPS) {
            this.width = m.targetWidth;
            this.stopMotion();
          } else if (m.type === 'oscillate') {
            // Une phase bornée évite de perdre en précision après de longs runs.
            m.elapsed %= 2 * m.duration;
          }
        }
      }
      const cutoff = this.time - this.measurementWindow;
      // Les événements de chaque particule sont ordonnés localement, pas globalement.
      this._events = this._events.filter(e => e.time >= cutoff - EPS);
      this._segments = this._segments.filter(s => s.end > cutoff);
      return this;
    }
    get metrics() {
      let ex = 0, ey = 0;
      for (const p of this.particles) { ex += 0.5 * p.vx * p.vx; ey += 0.5 * p.vy * p.vy; }
      const energy = ex + ey;
      const duration = Math.min(this.time, this.measurementWindow);
      const cutoff = this.time - duration;
      const impulses = { left: 0, right: 0, top: 0, bottom: 0 };
      for (const event of this._events) if (event.time >= cutoff - EPS) impulses[event.wall] += event.impulse;
      let widthIntegral = 0;
      for (const s of this._segments) {
        const start = Math.max(cutoff, s.start);
        const span = s.end - s.start;
        if (s.end <= start) continue;
        const widthAtStart = s.width0 + (s.width1 - s.width0) * (start - s.start) / span;
        widthIntegral += 0.5 * (widthAtStart + s.width1) * (s.end - start);
      }
      const pressureByWall = {};
      let sumImpulse = 0;
      for (const wall of WALLS) {
        const denominator = wall === 'left' || wall === 'right' ? this.height * duration : widthIntegral;
        pressureByWall[wall] = denominator > EPS ? impulses[wall] / denominator : null;
        sumImpulse += impulses[wall];
      }
      const perimeterIntegral = 2 * (this.height * duration + widthIntegral);
      return {
        time: this.time, width: this.width, height: this.height, count: this.count,
        volume: this.width * this.height, energy, temperature: energy / this.count,
        temperatureX: 2 * ex / this.count, temperatureY: 2 * ey / this.count,
        pressure: perimeterIntegral > EPS ? sumImpulse / perimeterIntegral : null,
        pressureIdeal: energy / (this.width * this.height), pressureByWall,
        work: this.work, balanceError: energy - this.initialEnergy - this.work,
        measurementDuration: duration, collisions: this._collisions,
        pistonVelocity: this._pistonVelocity
      };
    }
  }
  root.GasSimulation = GasSimulation;
  if (typeof module !== 'undefined' && module.exports) module.exports = { GasSimulation };
})(typeof globalThis !== 'undefined' ? globalThis : window);
