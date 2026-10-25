/* Gaz 2D, m = kB = 1 : points indépendants ou disques durs de rayon 0,04.
 * Les disques durs échangent une impulsion élastique à leur contact.
 * La température cinétique scalaire est E/N ; hors équilibre Tx et Ty
 * peuvent différer. Les parois peuvent être isolées ou diffuser les particules
 * à la température d’un thermostat dans le référentiel local de la paroi. */
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
  function randomGenerator(seed, state) {
    let a = state ?? ((Number(seed) || 1) >>> 0);
    const random = function () {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    random.clone = () => randomGenerator(1, a);
    return random;
  }
  function gaussian(random) {
    return Math.sqrt(-2 * Math.log(Math.max(1e-15, random()))) * Math.cos(2 * Math.PI * random());
  }
  // File des contacts prévus dans un segment de mouvement du piston.
  class EventQueue {
    constructor() { this.items = []; }
    push(event) {
      const a = this.items; let i = a.length; a.push(event);
      while (i > 0) { const parent = (i - 1) >> 1; if (a[parent].t <= event.t) break; a[i] = a[parent]; i = parent; }
      a[i] = event;
    }
    pop() {
      const a = this.items, first = a[0], last = a.pop();
      if (a.length) {
        let i = 0;
        while (2 * i + 1 < a.length) {
          let child = 2 * i + 1;
          if (child + 1 < a.length && a[child + 1].t < a[child].t) child++;
          if (last.t <= a[child].t) break;
          a[i] = a[child]; i = child;
        }
        a[i] = last;
      }
      return first;
    }
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
      if (!Number.isInteger(count) || count < 10 || count > 1000) throw new RangeError('Le nombre de particules doit être un entier compris entre 10 et 1000.');
      finite(temperature, 'La température');
      if (temperature <= 0) throw new RangeError('La température doit être positive.');
      const model = options.particleModel ?? this.particleModel ?? 'ideal';
      if (!['ideal', 'hard-disks'].includes(model)) throw new RangeError('Modèle de particules inconnu.');
      if (model === 'hard-disks' && this.height < 1) throw new RangeError('Les disques durs nécessitent une hauteur d’au moins 1.');
      this.particleModel = model;
      const radius = options.particleRadius ?? 0.04;
      if (model === 'hard-disks' && (!Number.isFinite(radius) || radius < 0.005 || radius > 0.07)) throw new RangeError('Le rayon doit être compris entre 0,005 et 0,07.');
      this.radius = model === 'hard-disks' ? radius : 0;
      this.observeCollisions = options.observeCollisions ?? this.observeCollisions ?? false;
      this.observations = { sequence: 0, walls: {}, pair: null };
      this.setThermal(options.thermal ?? this.thermal ?? {});
      this.width = checkWidth(options.width ?? 11);
      this.count = count;
      this.seed = options.seed ?? 314159;
      const random = randomGenerator(this.seed);
      // Flux thermique reproductible, indépendant du tirage de l’état initial.
      this._thermalRandom = randomGenerator((Number(this.seed) >>> 0) ^ 0xA53C9E17);
      this.particles = Array.from({ length: count }, (_, id) => ({
        id,
        x: (0.005 + 0.99 * random()) * this.width,
        y: (0.005 + 0.99 * random()) * this.height,
        vx: gaussian(random), vy: gaussian(random)
      }));
      if (this.radius) {
        // Placement sans recouvrement. Un tirage séparé conserve les mêmes
        // vitesses initiales dans les deux modèles pour faciliter la comparaison.
        const positionRandom = randomGenerator((Number(this.seed) >>> 0) ^ 0x7AC319EF);
        const cells = new Map(), diameter = 2 * this.radius;
        const key = (x, y) => x + ',' + y;
        for (const p of this.particles) {
          let placed = false;
          for (let attempt = 0; attempt < 20000 && !placed; attempt++) {
            p.x = this.radius + positionRandom() * (this.width - diameter);
            p.y = this.radius + positionRandom() * (this.height - diameter);
            const cx = Math.floor(p.x / diameter), cy = Math.floor(p.y / diameter);
            placed = true;
            for (let dx = -1; dx <= 1 && placed; dx++) for (let dy = -1; dy <= 1 && placed; dy++)
              for (const other of cells.get(key(cx + dx, cy + dy)) || [])
                if ((p.x - other.x) ** 2 + (p.y - other.y) ** 2 < diameter ** 2) { placed = false; break; }
            if (placed) { const k = key(cx, cy); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(p); }
          }
          if (!placed) throw new RangeError('Enceinte trop dense pour placer les disques sans recouvrement.');
        }
      }
      // Normalisation séparée : état initial isotrope, sans dérive collective.
      for (const key of ['vx', 'vy']) {
        const mean = count > 1 ? this.particles.reduce((s, p) => s + p[key], 0) / count : 0;
        const sum = this.particles.reduce((s, p) => s + (p[key] - mean) ** 2, 0);
        const scale = Math.sqrt(count * temperature / sum);
        for (const p of this.particles) p[key] = (p[key] - mean) * scale;
      }
      this.time = 0;
      this.work = 0;
      this.pressureWork = 0;
      this.heat = 0;
      this.heatIn = 0;
      this.heatOut = 0;
      this.heatByWall = { left: 0, right: 0, top: 0, bottom: 0 };
      this.initialEnergy = count * temperature;
      this.motion = null;
      this._pistonVelocity = 0;
      this._events = [];
      this._segments = [];
      this._collisions = 0;
      this._pairCollisions = 0;
      this._flightDistanceSum = 0; this._flightTimeSum = 0; this._flightCount = 0;
      for (const p of this.particles) { p.flightDistance = 0; p.lastPairTime = null; }
      this._lastThermalContact = new Float64Array(count).fill(-Infinity);
      this._thermalContactFallbacks = 0;
      return this;
    }
    // Une prévision indépendante, avec le même état du thermostat aléatoire.
    // Elle ne consomme aucun tirage ni aucune mesure du gaz observé.
    fork() {
      const copy = Object.assign(Object.create(GasSimulation.prototype), this);
      copy.particles = this.particles.map(p => ({ ...p }));
      copy.motion = this.motion ? { ...this.motion } : null;
      copy.heatByWall = { ...this.heatByWall };
      copy._events = this._events.map(e => ({ ...e }));
      copy._segments = this._segments.map(s => ({ ...s }));
      copy._lastThermalContact = new Float64Array(this._lastThermalContact);
      copy._thermalRandom = this._thermalRandom.clone();
      copy.observations = { sequence: this.observations.sequence, walls: {}, pair: null };
      return copy;
    }
    setThermal(options = {}) {
      const config = { mode: 'isolated', temperature: 1.5, accommodation: 1, pistonThermal: true, walls: WALLS, ...this.thermal, ...options };
      if (!['isolated', 'thermostat'].includes(config.mode)) throw new RangeError('Mode thermique inconnu.');
      finite(config.temperature, 'La température du thermostat');
      if (config.temperature <= 0) throw new RangeError('La température du thermostat doit être positive.');
      finite(config.accommodation, 'Le coefficient d’accommodation');
      if (config.accommodation < 0 || config.accommodation > 1) throw new RangeError('Le coefficient d’accommodation doit être compris entre 0 et 1.');
      if (typeof config.pistonThermal !== 'boolean') throw new TypeError('Le réglage thermique du piston doit être booléen.');
      if (!Array.isArray(config.walls) || config.walls.some(wall => !WALLS.includes(wall))) throw new RangeError('Liste de parois thermiques invalide.');
      config.walls = Object.freeze([...new Set(config.walls)]);
      // Changer les conditions aux limites n’applique aucun thermostat global :
      // seuls les chocs suivants pourront échanger de la chaleur.
      this.thermal = Object.freeze(config);
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
    _record(wall, impulse, time, work = 0, heat = 0) {
      this._events.push({ wall, impulse, time, work, heat });
      this._collisions++;
    }
    _reflect(p, wall, time, pistonVelocity = 0, allowThermal = true) {
      const oldVx = p.vx, oldVy = p.vy;
      const thermal = allowThermal && this.thermal.mode === 'thermostat'
        && this.thermal.walls.includes(wall)
        && (wall !== 'right' || this.thermal.pistonThermal)
        && this.thermal.accommodation > 0
        && (this.thermal.accommodation === 1 || this._thermalRandom() < this.thermal.accommodation);
      let impulse, pressureWork = 0, heat = 0;
      if (!thermal) {
        // Chemin spéculaire inchangé : les cas isolés conservent leurs tirages
        // et leur précision numérique antérieurs.
        if (wall === 'left') { impulse = -2 * oldVx; p.vx = -oldVx; }
        if (wall === 'right') {
          impulse = 2 * (oldVx - pistonVelocity);
          p.vx = 2 * pistonVelocity - oldVx;
          this.work += 0.5 * (p.vx * p.vx - oldVx * oldVx);
          pressureWork = -impulse * pistonVelocity;
        }
        if (wall === 'bottom') { impulse = -2 * oldVy; p.vy = -oldVy; }
        if (wall === 'top') { impulse = 2 * oldVy; p.vy = -oldVy; }
      } else {
        const temperature = this.thermal.temperature;
        // Une émission de paroi échantillonne un flux : la normale suit une
        // loi de Rayleigh, et non la demi-gaussienne d’un volume à l’équilibre.
        // Le tangentiel est gaussien. m = kB = 1.
        const normal = Math.sqrt(-2 * temperature * Math.log(Math.max(1e-15, this._thermalRandom())));
        const tangent = Math.sqrt(temperature) * gaussian(this._thermalRandom);
        if (wall === 'left') { p.vx = normal; p.vy = tangent; impulse = p.vx - oldVx; }
        if (wall === 'right') { p.vx = pistonVelocity - normal; p.vy = tangent; impulse = oldVx - p.vx; }
        if (wall === 'bottom') { p.vx = tangent; p.vy = normal; impulse = p.vy - oldVy; }
        if (wall === 'top') { p.vx = tangent; p.vy = -normal; impulse = oldVy - p.vy; }
        const u = wall === 'right' ? pistonVelocity : 0;
        const oldRelativeEnergy = 0.5 * ((oldVx - u) ** 2 + oldVy ** 2);
        const newRelativeEnergy = 0.5 * ((p.vx - u) ** 2 + p.vy ** 2);
        heat = newRelativeEnergy - oldRelativeEnergy;
        if (wall === 'right') {
          // ΔEc = W + Q ; Q est l’échange dans le référentiel de la paroi.
          // Cette voie et -uJ constituent deux calculs indépendants de W.
          if (u !== 0) this.work += 0.5 * (p.vx ** 2 + p.vy ** 2 - oldVx ** 2 - oldVy ** 2) - heat;
          pressureWork = -u * impulse;
        }
        this.heat += heat;
        this.heatIn += Math.max(0, heat);
        this.heatOut += Math.min(0, heat);
        this.heatByWall[wall] += heat;
      }
      this.pressureWork += pressureWork;
      this._record(wall, impulse, time, pressureWork, heat);
      if (this.observeCollisions) {
        const event = { kind: 'wall', sequence: ++this.observations.sequence, time, wall, particleId: p.id,
          x: p.x, y: p.y, radius: this.radius, before: { vx: oldVx, vy: oldVy }, after: { vx: p.vx, vy: p.vy },
          wallVelocity: wall === 'right' ? pistonVelocity : 0, impulse, work: pressureWork, heat, thermal,
          energyBefore: 0.5 * (oldVx ** 2 + oldVy ** 2), energyAfter: 0.5 * (p.vx ** 2 + p.vy ** 2) };
        // Le moteur ponctuel traite les particules l'une après l'autre :
        // l'ordre d'appel n'est pas nécessairement l'ordre chronologique.
        if (!this.observations.walls[wall] || time >= this.observations.walls[wall].time) this.observations.walls[wall] = event;
      }
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
        // Dans un coin, une émission diffuse peut déjà éloigner la particule
        // de l’autre paroi. Ne traiter celle-ci que si elle reste incidente.
        if (Math.abs(hit - leftTime) < EPS && p.vx < -EPS) {
          p.x = 0;
          this._reflect(p, 'left', collisionTime);
        }
        if (Math.abs(hit - rightTime) < EPS && p.vx - pistonVelocity > EPS) {
          p.x = oldWidth + pistonVelocity * elapsed;
          this._reflect(p, 'right', collisionTime, pistonVelocity);
        }
        if (Math.abs(hit - bottomTime) < EPS && p.vy < -EPS) {
          p.y = 0;
          this._reflect(p, 'bottom', collisionTime);
        }
        if (Math.abs(hit - topTime) < EPS && p.vy > EPS) {
          p.y = this.height;
          this._reflect(p, 'top', collisionTime);
        }
      }
      // Le résidu < EPS ne porte pas de choc résolu ; il est négligeable
      // à la précision du temps de vol et ne modifie aucune vitesse.
    }
    _advanceDisks(dt, oldWidth, pistonVelocity) {
      // Contacts exacts dans chaque segment linéaire : aucune correction de
      // recouvrement, ni renormalisation d’énergie. Les événements périmés
      // sont invalidés dès qu’une particule change de vitesse (Princeton §6.1).
      const ps = this.particles, n = ps.length, radius = this.radius, diameter = 2 * radius;
      const localTime = new Float64Array(n), revisions = new Uint32Array(n);
      const queue = new EventQueue();
      const move = (i, t) => { const p = ps[i], h = t - localTime[i]; p.flightDistance += Math.max(0,h) * Math.hypot(p.vx,p.vy); p.x += h * p.vx; p.y += h * p.vy; localTime[i] = t; };
      const scheduleWall = (i, t) => {
        const p = ps[i];
        const hits = [
          ['left', p.vx < -EPS ? (radius - p.x) / p.vx : Infinity],
          ['right', p.vx - pistonVelocity > EPS ? (oldWidth + pistonVelocity * t - radius - p.x) / (p.vx - pistonVelocity) : Infinity],
          ['bottom', p.vy < -EPS ? (radius - p.y) / p.vy : Infinity],
          ['top', p.vy > EPS ? (this.height - radius - p.y) / p.vy : Infinity]
        ];
        let nearest = null;
        for (const hit of hits) if (!nearest || hit[1] < nearest[1]) nearest = hit;
        const at = t + Math.max(0, nearest[1]);
        if (at <= dt) queue.push({ t: at, i, j: -1, wall: nearest[0], ri: revisions[i] });
      };
      const schedulePair = (i, j, t) => {
        const a = ps[i], b = ps[j];
        const dx = b.x + b.vx * (t - localTime[j]) - a.x - a.vx * (t - localTime[i]);
        const dy = b.y + b.vy * (t - localTime[j]) - a.y - a.vy * (t - localTime[i]);
        const vx = b.vx - a.vx, vy = b.vy - a.vy, dot = dx * vx + dy * vy;
        if (dot >= -EPS) return;
        const speed2 = vx * vx + vy * vy, gap = dx * dx + dy * dy - diameter * diameter;
        const discriminant = dot * dot - speed2 * gap;
        if (discriminant <= 0) return; // tangence : aucune impulsion normale
        // Racine stable, y compris à une distance très proche du contact.
        const delay = Math.max(0, gap / (-dot + Math.sqrt(discriminant)));
        const at = t + delay;
        if (at <= dt) queue.push({ t: at, i, j, ri: revisions[i], rj: revisions[j] });
      };
      // Une grille élargie par la distance maximale parcourue filtre les paires
      // initiales. Après un choc, on recalcule toutes les paires concernées :
      // un rebond sur un piston rapide ne peut pas faire manquer un contact.
      let maxSpeed = 0;
      for (const p of ps) maxSpeed = Math.max(maxSpeed, Math.hypot(p.vx, p.vy));
      const cellSize = diameter + 2 * maxSpeed * dt, cells = new Map();
      const key = (x, y) => x + ',' + y;
      for (let i = 0; i < n; i++) {
        scheduleWall(i, 0);
        const p = ps[i], cx = Math.floor(p.x / cellSize), cy = Math.floor(p.y / cellSize);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
          for (const j of cells.get(key(cx + dx, cy + dy)) || []) schedulePair(i, j, 0);
        const k = key(cx, cy); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i);
      }
      while (queue.items.length) {
        const e = queue.pop(), { i, j, t } = e;
        if (revisions[i] !== e.ri || (j >= 0 && revisions[j] !== e.rj)) continue;
        move(i, t);
        if (j < 0) {
          const p = ps[i];
          if (e.wall === 'left') p.x = radius;
          if (e.wall === 'right') p.x = oldWidth + pistonVelocity * t - radius;
          if (e.wall === 'bottom') p.y = radius;
          if (e.wall === 'top') p.y = this.height - radius;
          // Une réémission diffuse répétée à temps identique dans un contact
          // multiple (paroi + plusieurs disques) peut boucler sans vol libre.
          // On n'autorise qu'une émission thermique par particule et instant ;
          // les réflexions suivantes à cet instant sont élastiques. Cette
          // convention de contact multiple conserve exactement ΔE = W + Q.
          const absoluteTime = this.time + t;
          const allowed = absoluteTime - this._lastThermalContact[i] > 1e-10;
          if (this.thermal.mode === 'thermostat' && this.thermal.accommodation > 0 && this.thermal.walls.includes(e.wall) && (e.wall !== 'right' || this.thermal.pistonThermal)) {
            if (allowed) this._lastThermalContact[i] = absoluteTime;
            else this._thermalContactFallbacks++;
          }
          this._reflect(p, e.wall, absoluteTime, pistonVelocity, allowed);
        } else {
          move(j, t);
          const a = ps[i], b = ps[j], dx = b.x - a.x, dy = b.y - a.y;
          const distance = Math.hypot(dx, dy), nx = dx / distance, ny = dy / distance;
          const normalVelocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          const before = this.observeCollisions ? [{ x: a.x, y: a.y, vx: a.vx, vy: a.vy }, { x: b.x, y: b.y, vx: b.vx, vy: b.vy }] : null;
          a.vx += normalVelocity * nx; a.vy += normalVelocity * ny;
          b.vx -= normalVelocity * nx; b.vy -= normalVelocity * ny;
          this._pairCollisions++;
          // Only complete flights between two mutual collisions enter the mean.
          // Wall reflections continue the travelled path, without ending it.
          for (const p of [a,b]) {
            if (p.lastPairTime !== null) {
              this._flightDistanceSum += p.flightDistance;
              this._flightTimeSum += this.time + t - p.lastPairTime;
              this._flightCount++;
            }
            p.flightDistance = 0; p.lastPairTime = this.time + t;
          }
          if (this.observeCollisions) this.observations.pair = { kind: 'pair', sequence: ++this.observations.sequence,
            time: this.time + t, ids: [a.id, b.id], radius, before,
            after: [{ x: a.x, y: a.y, vx: a.vx, vy: a.vy }, { x: b.x, y: b.y, vx: b.vx, vy: b.vy }],
            impulse: -normalVelocity, nx, ny };

          revisions[j]++;
        }
        revisions[i]++;
        scheduleWall(i, t);
        for (let k = 0; k < n; k++) if (k !== i && k !== j) schedulePair(i, k, t);
        if (j >= 0) {
          scheduleWall(j, t);
          for (let k = 0; k < n; k++) if (k !== i && k !== j) schedulePair(j, k, t);
        }
      }
      for (let i = 0; i < n; i++) move(i, dt);
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
        if (this.radius) this._advanceDisks(h, oldWidth, velocity);
        else for (const particle of this.particles) this._advanceParticle(particle, h, oldWidth, velocity);
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
      let windowWork = 0, windowHeat = 0;
      const windowHeatByWall = { left: 0, right: 0, top: 0, bottom: 0 };
      for (const event of this._events) {
        if (event.time < cutoff - EPS) continue;
        impulses[event.wall] += event.impulse;
        windowWork += event.work;
        windowHeat += event.heat;
        windowHeatByWall[event.wall] += event.heat;
      }
      let widthIntegral = 0;
      for (const s of this._segments) {
        const start = Math.max(cutoff, s.start);
        const span = s.end - s.start;
        if (s.end <= start) continue;
        const widthAtStart = s.width0 + (s.width1 - s.width0) * (start - s.start) / span;
        widthIntegral += 0.5 * (widthAtStart + s.width1) * (s.end - start);
      }
      const pressureByWall = {}, heatFluxByWall = {};
      let sumImpulse = 0;
      for (const wall of WALLS) {
        const denominator = wall === 'left' || wall === 'right' ? this.height * duration : widthIntegral;
        pressureByWall[wall] = denominator > EPS ? impulses[wall] / denominator : null;
        heatFluxByWall[wall] = denominator > EPS ? windowHeatByWall[wall] / denominator : null;
        sumImpulse += impulses[wall];
      }
      const perimeterIntegral = 2 * (this.height * duration + widthIntegral);
      return {
        time: this.time, width: this.width, height: this.height, count: this.count,
        volume: this.width * this.height, energy, temperature: energy / this.count,
        temperatureX: 2 * ex / this.count, temperatureY: 2 * ey / this.count,
        pressure: perimeterIntegral > EPS ? sumImpulse / perimeterIntegral : null,
        pressureIdeal: energy / (this.width * this.height), pressureByWall,
        impulseByWall: { ...impulses }, pistonLengthTime: this.height * duration,
        work: this.work, balanceError: energy - this.initialEnergy - this.work - this.heat,
        pressureWork: this.pressureWork,
        pressurePower: duration > EPS ? windowWork / duration : null,
        pressureWorkError: this.pressureWork - this.work,
        balancePressureError: energy - this.initialEnergy - this.pressureWork - this.heat,
        heat: this.heat, heatIn: this.heatIn, heatOut: this.heatOut,
        heatPower: duration > EPS ? windowHeat / duration : null,
        heatByWall: { ...this.heatByWall }, heatFluxByWall,
        firstLawError: energy - this.initialEnergy - this.pressureWork - this.heat,
        thermalWalls: [...this.thermal.walls], thermalMode: this.thermal.mode, bathTemperature: this.thermal.temperature,
        accommodation: this.thermal.accommodation, pistonThermal: this.thermal.pistonThermal,
        measurementDuration: duration, collisions: this._collisions,
        particleModel: this.particleModel, particleRadius: this.radius, pairCollisions: this._pairCollisions,
        meanFreePath: this._flightCount ? this._flightDistanceSum / this._flightCount : null,
        meanCollisionTime: this._flightCount ? this._flightTimeSum / this._flightCount : null,
        completedFlights: this._flightCount,
        thermalContactFallbacks: this._thermalContactFallbacks,
        packingFraction: this.count * Math.PI * this.radius ** 2 / (this.width * this.height),
        pistonVelocity: this._pistonVelocity
      };
    }
  }
  root.GasSimulation = GasSimulation;
  if (typeof module !== 'undefined' && module.exports) module.exports = { GasSimulation };
})(typeof globalThis !== 'undefined' ? globalThis : window);
