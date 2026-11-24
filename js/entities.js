function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

const CAR_COLORS = ['#c94f4f', '#4f7dc9', '#c9b44f', '#7dc94f', '#9b6fc9', '#c9c9c9', '#4fc9c0', '#d97fb0', '#e07b39', '#5a6470'];

class Car {
  constructor(x, y, angle, opts) {
    opts = opts || {};
    this.x = x; this.y = y; this.angle = angle;
    this.w = 48; this.h = 24; this.r = 21; this.colR = 14;
    this.vx = 0; this.vy = 0;
    this.health = 100;
    this.type = opts.type || 'civil';
    this.color = opts.color || choice(CAR_COLORS);
    this.ai = !!opts.ai;
    this.aiSpeed = opts.aiSpeed || rand(130, 185);
    this.dir = angle;
    this.lastNode = -1;
    this.driver = null;
    this.hitByPlayer = false;
    this.flash = 0;
    this.shootTimer = 0;
    this.stuckTime = 0;
    this.reverseTime = 0;
    this.dead = false;
  }

  forward() { return { x: Math.cos(this.angle), y: Math.sin(this.angle) }; }
  speedF() { const f = this.forward(); return this.vx * f.x + this.vy * f.y; }
  speedAbs() { return Math.sqrt(this.vx * this.vx + this.vy * this.vy); }

  drive(dt, input) {
    const f0 = this.forward();
    let vF = this.vx * f0.x + this.vy * f0.y;
    let vLx = this.vx - f0.x * vF, vLy = this.vy - f0.y * vF;
    const th = input.throttle, st = input.steer, hb = input.handbrake;
    if (th > 0) vF += CFG.CAR_ACCEL * th * dt;
    else if (th < 0) vF += CFG.CAR_ACCEL * 0.72 * th * dt;
    vF = clamp(vF, -CFG.CAR_MAXR, CFG.CAR_MAXF);
    vF -= vF * CFG.CAR_DRAG * dt;
    const k = hb ? CFG.CAR_LAT_HANDBRAKE : CFG.CAR_LAT;
    const lat = Math.max(0, 1 - k * dt);
    vLx *= lat; vLy *= lat;
    const sf = clamp(vF / 140, -1, 1);
    const steerMag = Math.abs(vF) > 2 ? sf : 0.35 * (vF === 0 ? 1 : Math.sign(vF));
    this.angle += st * CFG.STEER_RATE * dt * steerMag;
    const f = this.forward();
    this.vx = f.x * vF + vLx;
    this.vy = f.y * vF + vLy;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (hb && Math.abs(vF) > 220) SFX.skid();
    return Math.abs(vF);
  }

  followRoad(dt) {
    if (!this.wk) this.wk = World.newWalker(World.driveWays);
    if (this.reverseTime > 0) {
      this.reverseTime -= dt;
      World.advanceWalker(this.wk, -120 * dt);
    } else {
      World.advanceWalker(this.wk, this.aiSpeed * dt);
    }
    const w = World.roadWays[this.wk.w];
    const p = World.walkerPoint(this.wk, World.laneOff(w));
    this.x = p.x; this.y = p.y; this.angle = p.angle; this.dir = p.angle;
    this.vx = Math.cos(p.angle) * this.aiSpeed;
    this.vy = Math.sin(p.angle) * this.aiSpeed;
  }

  chase(dt, target, laneOff) {
    const dx = target.x - this.x, dy = target.y - this.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const want = Math.atan2(dy, dx);
    const diff = angleDiff(want, this.angle);
    const steer = clamp(diff * 2.4, -1, 1);
    const probeX = this.x + Math.cos(this.angle) * 46;
    const probeY = this.y + Math.sin(this.angle) * 46;
    const blockedAhead = World.blocked(probeX, probeY, 18);
    let throttle = 0.9;
    if (blockedAhead) {
      this.stuckTime += dt;
      if (this.stuckTime > 0.7) {
        this.reverseTime = 0.8;
        this.stuckTime = 0;
        this.angle += 1.2;
      }
      throttle = 0.25;
    } else {
      this.stuckTime = Math.max(0, this.stuckTime - dt * 2);
    }
    if (this.reverseTime > 0) {
      this.reverseTime -= dt;
      this.x -= Math.cos(this.angle) * 200 * dt;
      this.y -= Math.sin(this.angle) * 200 * dt;
      return;
    }
    this.drive(dt, { throttle, steer, handbrake: false });
    if (d < 400) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = rand(0.4, 0.75);
        return { fire: true };
      }
    }
    return null;
  }

  collideWorld() {
    const hit = World.collideCircle(this.x, this.y, this.colR || this.r);
    if (!hit) return 0;
    this.x += hit.x; this.y += hit.y;
    const vn = this.vx * hit.nx + this.vy * hit.ny;
    if (vn < 0) {
      this.vx -= vn * hit.nx * 1.5;
      this.vy -= vn * hit.ny * 1.5;
      return -vn;
    }
    return 0;
  }
}

class Ped {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 9;
    this.angle = rand(0, Math.PI * 2);
    this.dir = choice([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    this.speed = rand(45, 75);
    this.state = 'walk';
    this.fleeT = 0;
    this.fleeX = 0; this.fleeY = 0;
    this.lastNode = -1;
    this.color = choice(['#d9a066', '#a06cd9', '#66c9d9', '#d96666', '#8ac96a', '#c9c9c9', '#e0d06a']);
    this.dead = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.state === 'flee') {
      this.fleeT -= dt;
      const a = Math.atan2(this.y - this.fleeY, this.x - this.fleeX);
      this.x += Math.cos(a) * 175 * dt;
      this.y += Math.sin(a) * 175 * dt;
      this.angle = a;
      if (this.fleeT <= 0) this.state = 'walk';
    } else {
      if (!this.wk) this.wk = World.newWalker(World.roadWays);
      World.advanceWalker(this.wk, this.speed * dt);
      const w = World.roadWays[this.wk.w];
      const p = World.walkerPoint(this.wk, World.sidewalkOff(w));
      this.x = p.x; this.y = p.y; this.angle = p.angle;
    }
    const hit = World.collideCircle(this.x, this.y, this.r);
    if (hit) { this.x += hit.x; this.y += hit.y; }
  }

  scare(fromX, fromY) {
    if (this.dead) return;
    this.state = 'flee';
    this.fleeX = fromX; this.fleeY = fromY;
    this.fleeT = rand(2, 3.5);
  }
}

class Bike {
  constructor() {
    this.wk = World.newWalker(World.bikeWays);
    this.speed = rand(60, 100);
    this.r = 8;
    this.color = choice(['#d94f4f', '#4f8fd9', '#d9b44f', '#6ac96a', '#c9c9c9', '#e07b39']);
    const w = World.roadWays[this.wk.w];
    const p = World.walkerPoint(this.wk, Math.max(8, w.width * 0.32));
    this.x = p.x; this.y = p.y; this.angle = p.angle;
  }
  update(dt) {
    World.advanceWalker(this.wk, this.speed * dt);
    const w = World.roadWays[this.wk.w];
    const p = World.walkerPoint(this.wk, Math.max(8, w.width * 0.32));
    this.x = p.x; this.y = p.y; this.angle = p.angle;
  }
}

class Bullet {
  constructor(x, y, angle, from) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * CFG.BULLET_SPEED;
    this.vy = Math.sin(angle) * CFG.BULLET_SPEED;
    this.life = 0.75;
    this.from = from;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || World.blocked(this.x, this.y, 2)) this.dead = true;
  }
}

class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.92; this.vy *= 0.92;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
}

function bloodBurst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(40, 220);
    Game.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.8), '#a11', rand(2, 5)));
  }
}

function sparkBurst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(60, 320);
    Game.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.15, 0.5), color || '#ffd76a', rand(1.5, 3.5)));
  }
}

function explosionBurst(x, y) {
  for (let i = 0; i < 46; i++) {
    const a = rand(0, Math.PI * 2), s = rand(80, 420);
    Game.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.4, 1.1), choice(['#ff9a3c', '#ff5722', '#ffd76a', '#555']), rand(3, 8)));
  }
}
