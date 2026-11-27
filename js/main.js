const Game = {
  canvas: null,
  ctx: null,
  vw: 0,
  vh: 0,
  keys: {},
  mouse: { x: 0, y: 0, px: 0, down: false },
  orbiting: false,
  state: 'title',
  paused: false,
  time: 0,
  dayT: 0.55,
  player: null,
  cars: [],
  police: [],
  peds: [],
  bikes: [],
  trams: [],
  bullets: [],
  particles: [],
  mission: null,
  marker: { x: 1800, y: 1800, type: 'taxi' },
  toasts: [],
  cam: { x: 0, y: 0, zoom: 1 },
  shake: 0,
  hintT: 0,
  showKeys: true,
  lastRamCrime: -10,
  sirenNear: false,
  mode: '2d',
  lastDt: 0.016,
  glCanvas: null,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; this.orbiting = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.orbiting) Render3D.camYaw = (Render3D.camYaw || 0) - (e.clientX - this.mouse.px) * 0.006;
      this.mouse.px = e.clientX;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', (e) => {
      SFX.init();
      SFX.ensure();
      if (e.button === 2) this.orbiting = true;
      else if (e.button === 0) {
        const mb = this.modeBtn;
        const eb = this.editorBtn;
        if (mb && e.clientX >= mb.x && e.clientX <= mb.x + mb.w && e.clientY >= mb.y && e.clientY <= mb.y + mb.h) {
          this.setMode(this.mode === '3d' ? '2d' : '3d');
        } else if (this.state === 'title' && eb && e.clientX >= eb.x && e.clientX <= eb.x + eb.w && e.clientY >= eb.y && e.clientY <= eb.y + eb.h) {
          try { location.href = 'editor.html'; } catch (err) {}
        } else this.mouse.down = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.orbiting = false;
      else if (e.button === 0) this.mouse.down = false;
    });
    World.build();
    this.marker = { x: World.pois.station.x, y: World.pois.station.y, type: 'taxi' };
    this.player = {
      x: World.pois.plaza.x, y: World.pois.plaza.y, angle: -Math.PI / 2,
      vx: 0, vy: 0, r: 11,
      health: 100, cash: 150, stars: 0,
      inCar: null, fireCd: 0, lastCrime: -100, decayT: 0
    };
    let sp0 = null, ang0 = -Math.PI / 2;
    for (let i = 0; i < 60; i++) {
      const c = World.randomRoadPoint(false, World.roadWays);
      const s = this.safeFootPos(c.x, c.y);
      if (!World.blocked(s.x, s.y, this.player.r)) { sp0 = s; ang0 = c.angle; break; }
    }
    if (!sp0) sp0 = this.safeFootPos(World.pois.plaza.x, World.pois.plaza.y);
    this.player.x = sp0.x;
    this.player.y = sp0.y;
    this.player.angle = Math.round(ang0 / (Math.PI / 18)) * (Math.PI / 18);
    this.spawnInitial();
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.glCanvas = document.getElementById('gl');
    if (!window.__TEST__) {
      try { Render3D.init(); } catch (e) { Render3D.available = false; }
    }
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('mode') === '2d') Render3D.available = false;
    this.editPlace = null;
    try {
      if (typeof location !== 'undefined' && typeof localStorage !== 'undefined' && new URLSearchParams(location.search).get('edit') === '1') {
        const pend = JSON.parse(localStorage.getItem('fve_pending') || 'null');
        if (pend && pend.facade && isFinite(pend.facade.wM) && pend.facade.wM > 0 && isFinite(pend.facade.dM) && pend.facade.dM > 0) {
          if (!isFinite(pend.cx) || !isFinite(pend.cy)) {
            const c = World.toWorld(isFinite(pend.lon) ? pend.lon : 8.529, isFinite(pend.lat) ? pend.lat : 49.52);
            pend.cx = c.x; pend.cy = c.y;
          }
          if (!isFinite(pend.rot)) pend.rot = 0;
          if (!pend.facade.floors) pend.facade.floors = 2;
          this.editPlace = pend;
          this.state = 'play';
          this.toast('Platzieren: Maus = Position · Q/E = drehen (Shift = 1°) · Enter = speichern · Esc = abbrechen');
        }
      }
    } catch (e) { this.editPlace = null; }
    this.setMode(Render3D.available ? '3d' : '2d', true);
    if (window.__TEST__) return;
    let last = performance.now();
    const loop = (t) => {
      const dt = clamp((t - last) / 1000, 0, 0.05);
      last = t;
      try {
        if (this.state === 'play' && !this.paused) this.update(dt);
        this.render();
      } catch (err) {
        if (this.mode === '3d') {
          this._errCount = (this._errCount || 0) + 1;
          if (!this._errLogged) { this._errLogged = true; if (typeof console !== 'undefined') console.error(err); }
          if (this._errCount > 30) {
            Render3D.available = false;
            this.setMode('2d');
            this.toast('3D-Renderfehler — Fallback auf 2D (Taste 3 versucht 3D erneut)');
          }
        } else {
          this._errCount2 = (this._errCount2 || 0) + 1;
          if (!this._errLogged2) { this._errLogged2 = true; if (typeof console !== 'undefined') console.error(err); }
          if (this._errCount2 === 10 && this.ctx) {
            try {
              const g = this.ctx;
              g.setTransform(1, 0, 0, 1, 0, 0);
              g.fillStyle = 'rgba(120,10,10,0.9)';
              g.fillRect(0, 0, this.vw, 64);
              g.fillStyle = '#fff';
              g.font = '13px monospace';
              g.textAlign = 'left';
              g.fillText('Render-Fehler: ' + err.message, 10, 24);
              g.fillText(((err.stack || '').split('\n')[1] || ''), 10, 46);
            } catch (e2) {}
          }
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  resize() {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.canvas.width = this.vw;
    this.canvas.height = this.vh;
    if (Render3D.available) Render3D.setSize(this.vw, this.vh);
  },

  setMode(m, silent) {
    if (m === '3d' && !Render3D.available && !window.__TEST__) {
      try { Render3D.init(); } catch (e) { Render3D.available = false; }
    }
    if (m === '3d' && !Render3D.available) {
      this.mode = '2d';
      if (!silent) this.toast('WebGL nicht verfügbar — bleibe in 2D (Taste 2/3 wechselt)');
    } else {
      this.mode = m;
    }
    if (this.glCanvas) this.glCanvas.style.display = this.mode === '3d' ? 'block' : 'none';
    if (!silent && this.mode === '3d') this.toast('3D-Modus — Taste 2 für 2D-Top-Down');
    if (!silent && this.mode === '2d' && m === '2d') this.toast(Render3D.available ? '2D-Modus — Taste 3 für 3D' : '2D-Modus (WebGL nicht verfügbar)');
  },

  spawnInitial() {
    for (let i = 0; i < CFG.PARKED_COUNT; i++) {
      const p = World.randomRoadPoint(false, World.driveWays);
      this.cars.push(new Car(p.x, p.y, p.angle, { ai: false }));
    }
    for (let i = 0; i < CFG.TRAFFIC_COUNT; i++) {
      const p = World.randomRoadPoint(false, World.driveWays);
      this.cars.push(new Car(p.x, p.y, p.angle, { ai: true }));
    }
    for (let i = 0; i < CFG.PED_COUNT; i++) {
      const p = World.randomRoadPoint(true, World.roadWays);
      this.peds.push(new Ped(p.x, p.y));
    }
    for (let i = 0; i < CFG.BIKE_COUNT; i++) this.bikes.push(new Bike());
    if (World.railWays.length >= 2) {
      const totalLen = World.railWays.reduce((s, w) => s + w.len, 0);
      for (let i = 0; i < CFG.TRAM_COUNT; i++) {
        this.trams.push(new Tram(totalLen * (0.15 + 0.7 * i / Math.max(1, CFG.TRAM_COUNT - 1)) + rand(0, 300)));
      }
    }
  },

  onKey(e, down) {
    let c = e.code;
    const k = e.key;
    if (c === 'Digit2' || c === 'Numpad2' || k === '2') c = 'Key2';
    if (c === 'Digit3' || c === 'Numpad3' || k === '3') c = 'Key3';
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
    this.keys[c] = down;
    if (down && !e.repeat) {
      SFX.init();
      SFX.ensure();
      if (this.editPlace) {
        if (c === 'Enter') this.confirmEdit();
        else if (c === 'Escape') this.cancelEdit();
        else if (c === 'KeyQ') this.editPlace.rot -= (e.shiftKey ? 1 : 5) * Math.PI / 180;
        else if (c === 'KeyE') this.editPlace.rot += (e.shiftKey ? 1 : 5) * Math.PI / 180;
        return;
      }
      const MODS = ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'CapsLock', 'Tab', 'Escape'];
      if (this.state === 'title' && !MODS.includes(c)) {
        this.state = 'play';
        this.toast('Willkommen in FRANKLIN! Finde den gelben Marker.');
      }
      if (c === 'KeyR' && (this.state === 'wasted' || this.state === 'busted')) this.respawn();
      if (c === 'KeyP' && this.state === 'play') this.paused = !this.paused;
      if (c === 'KeyM') this.toast(SFX.toggleMute() ? 'Ton aus' : 'Ton an');
      if (c === 'KeyE' && this.state === 'play') this.tryInteract();
      if (c === 'Key2') this.setMode('2d');
      if (c === 'Key3') this.setMode('3d');
      if (c === 'KeyH' && this.state === 'play') this.showKeys = !this.showKeys;
    }
  },

  safeFootPos(x, y) {
    const r = this.player.r;
    const sp = World.snapToRoad(x, y);
    if (World.onRoadOrWalk(sp.x, sp.y) && !World.blocked(sp.x, sp.y, r)) return sp;
    for (let ring = 1; ring <= 8; ring++) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const s = World.snapToRoad(x + Math.cos(a) * ring * 14, y + Math.sin(a) * ring * 14);
        if (World.onRoadOrWalk(s.x, s.y) && !World.blocked(s.x, s.y, r)) return s;
      }
    }
    return sp;
  },

  tryInteract() {
    const p = this.player;
    if (p.inCar) {
      const car = p.inCar;
      const f = car.forward();
      const rx = -f.y, ry = f.x;
      const sp = this.safeFootPos(car.x + rx * 34, car.y + ry * 34);
      p.x = sp.x;
      p.y = sp.y;
      p.inCar = null;
      car.vx = 0; car.vy = 0;
      car.ai = false;
      return;
    }
    let best = null, bd = 46 * 46;
    for (const c of this.cars) {
      if (c.dead) continue;
      const d = (c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    for (const c of this.police) {
      if (c.dead) continue;
      const d = (c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      if (best.ai) best.ai = false;
      p.inCar = best;
      this.toast('Auto übernommen — E drücken zum Aussteigen');
      return;
    }
    if (!this.mission && dist(p.x, p.y, this.marker.x, this.marker.y) < 40) this.startMission(this.marker.type);
  },

  inputVector() {
    let x = 0, y = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) y -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) y += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
    if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
    return { x, y };
  },

  update(dt) {
    this.lastDt = dt;
    this.time += dt;
    this.hintT += dt;
    this.dayT = (this.dayT + dt / CFG.DAY_LENGTH) % 1;
    if (this.editPlace) {
      try { this.updateEditPlace(dt); } catch (e) { this.editPlace = null; this.toast('Editor-Fehler: ' + e.message); }
      return;
    }
    const p = this.player;
    p.fireCd -= dt;

    if (p.inCar) {
      const car = p.inCar;
      const iv = this.inputVector();
      const ox = car.x, oy = car.y;
      car.drive(dt, {
        throttle: -iv.y,
        steer: iv.x,
        handbrake: !!this.keys.Space
      });
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      const impact = car.collideWorld();
      if (!World.onDrive(car.x, car.y)) {
        car.x = ox; car.y = oy; car.vx = 0; car.vy = 0;
        p.x = car.x; p.y = car.y;
      }
      if (impact > 260) {
        car.health -= impact / 55;
        this.shake = Math.min(18, impact / 22);
        SFX.crash(impact);
        sparkBurst(car.x, car.y, 10);
        this.scarePeds(car.x, car.y, 380);
        if (car.health <= 0) this.explodeCar(car);
      }
    } else {
      if (this.mode === '2d') {
        const iv = this.inputVector();
        if (iv.x !== 0 || iv.y !== 0) {
          let mx = iv.x, my = iv.y;
          let wa = World.wayAt(p.x, p.y, Math.atan2(iv.y, iv.x));
          if (!wa) wa = World.wayAt(p.x, p.y, p.angle);
          if (wa && wa.d < wa.width / 2 + 5) { mx = Math.cos(wa.ang); my = Math.sin(wa.ang); }
          const target = Math.atan2(my, mx);
          p.angle += angleDiff(target, p.angle) * Math.min(1, 14 * dt);
          p.vx += mx * CFG.PLAYER_ACCEL * dt;
          p.vy += my * CFG.PLAYER_ACCEL * dt;
        }
      } else {
      const fwd = (this.keys.KeyW || this.keys.ArrowUp) ? 1 : (this.keys.KeyS || this.keys.ArrowDown) ? -1 : 0;
      let turnIn = (this.keys.KeyA || this.keys.ArrowLeft) ? -1 : (this.keys.KeyD || this.keys.ArrowRight) ? 1 : 0;
      const step = Math.PI / 18;
      if (turnIn === 0 && fwd > 0) {
        const wa = World.wayAt(p.x, p.y, p.angle);
        if (wa && wa.d < wa.width / 2 + 5) {
          const diff = angleDiff(wa.ang, p.angle);
          if (Math.abs(diff) > 0.03) turnIn = diff > 0 ? 1 : -1;
        }
      }
      if (turnIn !== 0) {
        p.turnAcc = (p.turnAcc || 0) + turnIn * Math.PI * dt;
        const steps = Math.floor(Math.abs(p.turnAcc) / step);
        if (steps > 0) {
          p.angle = Math.round((p.angle + Math.sign(p.turnAcc) * steps * step) / step) * step;
          p.turnAcc -= Math.sign(p.turnAcc) * steps * step;
        }
      } else {
        p.turnAcc = 0;
      }
      if (fwd !== 0) {
        const acc = CFG.PLAYER_ACCEL * (fwd < 0 ? 0.6 : 1);
        p.vx += Math.cos(p.angle) * acc * fwd * dt;
        p.vy += Math.sin(p.angle) * acc * fwd * dt;
      }
      }
      const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const max = CFG.PLAYER_SPEED;
      if (sp > max) { p.vx = p.vx / sp * max; p.vy = p.vy / sp * max; }
      p.vx *= Math.max(0, 1 - 6 * dt);
      p.vy *= Math.max(0, 1 - 6 * dt);
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      if (World.onRoadOrWalk(nx, p.y) && !World.blocked(nx, p.y, p.r)) p.x = nx; else p.vx = 0;
      if (World.onRoadOrWalk(p.x, ny) && !World.blocked(p.x, ny, p.r)) p.y = ny; else p.vy = 0;
      const hit = World.collideCircle(p.x, p.y, p.r);
      if (hit) {
        const hx = p.x + hit.x, hy = p.y + hit.y;
        if (World.onRoadOrWalk(hx, hy) && !World.blocked(hx, hy, p.r - 0.5)) { p.x = hx; p.y = hy; }
        else {
          const pl = Math.hypot(hit.x, hit.y);
          if (pl > 0.01) {
            const ux = hit.x / pl, uy = hit.y / pl;
            for (let s = pl; s > 0; s -= 1) {
              const qx = p.x + ux * s, qy = p.y + uy * s;
              if (World.onRoadOrWalk(qx, qy) && !World.blocked(qx, qy, p.r - 0.5)) { p.x = qx; p.y = qy; break; }
            }
          }
        }
        const vn = p.vx * hit.nx + p.vy * hit.ny;
        if (vn < 0) { p.vx -= vn * hit.nx; p.vy -= vn * hit.ny; }
        p.vx *= 0.55; p.vy *= 0.55;
      }
    }

    if ((this.keys.KeyF || this.mouse.down) && p.fireCd <= 0) this.playerShoot();

    for (const car of this.cars) {
      if (car.dead) continue;
      if (car === p.inCar) continue;
      if (car.ai) {
        const probeX = car.x + Math.cos(car.dir) * 52;
        const probeY = car.y + Math.sin(car.dir) * 52;
        let blockedByPlayer = false;
        const pe = p.inCar || p;
        if (dist(probeX, probeY, pe.x, pe.y) < 34) blockedByPlayer = true;
        if (!blockedByPlayer) car.followRoad(dt);
        else { car.vx = 0; car.vy = 0; }
      } else {
        car.vx = 0; car.vy = 0;
        if (!World.onDrive(car.x, car.y)) {
          const sp = World.snapToDrive(car.x, car.y);
          car.x = sp.x; car.y = sp.y;
        }
      }
    }

    const desired = p.stars > 0 ? Math.min(1 + p.stars, CFG.MAX_POLICE) : 0;
    while (this.police.length < desired) {
      let pt = null;
      for (let tries = 0; tries < 12; tries++) {
        const cand = World.randomRoadPoint(false, World.driveWays);
        if (dist(cand.x, cand.y, p.x, p.y) > 900) { pt = cand; break; }
      }
      if (!pt) pt = World.randomRoadPoint(false, World.driveWays);
      this.police.push(new Car(pt.x, pt.y, pt.angle, { type: 'police', color: '#20242e', ai: false, aiSpeed: 300 }));
    }
    this.police = this.police.filter(c => !c.dead);
    if (p.stars === 0 && this.police.length) this.police = [];
    this.sirenNear = false;
    for (const pc of this.police) {
      const pox = pc.x, poy = pc.y;
      const res = pc.chase(dt, p.inCar || p, 14);
      const impact = pc.collideWorld();
      if (!World.onDrive(pc.x, pc.y)) { pc.x = pox; pc.y = poy; pc.vx = 0; pc.vy = 0; }
      if (impact > 260) { SFX.crash(impact); sparkBurst(pc.x, pc.y, 8); pc.health -= impact / 70; if (pc.health <= 0) { this.explodeCar(pc); this.addCrime(3); } }
      if (res && res.fire) {
        const tgt = p.inCar || p;
        const a = Math.atan2(tgt.y - pc.y, tgt.x - pc.x) + rand(-0.07, 0.07);
        this.bullets.push(new Bullet(pc.x + Math.cos(a) * 30, pc.y + Math.sin(a) * 30, a, 'police'));
        if (dist(pc.x, pc.y, p.x, p.y) < 700) { SFX.enemyShoot(); this.sirenNear = true; }
      }
      if (dist(pc.x, pc.y, p.x, p.y) < 600) this.sirenNear = true;
      if (!p.inCar && p.stars > 0 && dist(pc.x, pc.y, p.x, p.y) < 42) {
        this.state = 'busted';
        SFX.busted();
        p.cash = Math.max(0, Math.floor(p.cash * 0.8));
        return;
      }
    }

    const allCars = this.cars.concat(this.police);
    for (let i = 0; i < allCars.length; i++) {
      for (let j = i + 1; j < allCars.length; j++) {
        const a = allCars[i], b = allCars[j];
        if (a.dead || b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const minD = a.r + b.r - 4;
        if (d < minD && d > 0.01) {
          const nx = dx / d, ny = dy / d;
          const push = (minD - d) / 2;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const imp = -vn;
            a.vx += nx * vn * 0.5; a.vy += ny * vn * 0.5;
            b.vx -= nx * vn * 0.5; b.vy -= ny * vn * 0.5;
            if (imp > 240) {
              SFX.crash(imp);
              sparkBurst((a.x + b.x) / 2, (a.y + b.y) / 2, 8);
              a.health -= imp / 60;
              b.health -= imp / 60;
              if ((a === p.inCar && b.type === 'police') || (b === p.inCar && a.type === 'police')) {
                if (this.time - this.lastRamCrime > 2) { this.addCrime(1); this.lastRamCrime = this.time; }
              }
              if (a.health <= 0) this.explodeCar(a);
              if (b.health <= 0) this.explodeCar(b);
            }
          }
        }
      }
    }

    for (const c of allCars) {
      if (c.dead || !c.ai || !c.wk || c === p.inCar) continue;
      if (!World.onDrive(c.x, c.y)) {
        const cw = World.roadWays[c.wk.w];
        if (cw && World.driveSet.has(c.wk.w)) {
          const wp = World.walkerPoint(c.wk, World.laneOff(cw));
          c.x = wp.x; c.y = wp.y;
        }
      }
    }

    if (p.inCar && !World.onDrive(p.inCar.x, p.inCar.y)) {
      const sp = World.snapToDrive(p.inCar.x, p.inCar.y);
      p.inCar.x = sp.x; p.inCar.y = sp.y;
      p.x = sp.x; p.y = sp.y;
    }

    if (p.inCar) {
      const car = p.inCar;
      const sp = car.speedAbs();
      if (sp > 130) {
        for (const ped of this.peds) {
          if (ped.dead) continue;
          if (dist(car.x, car.y, ped.x, ped.y) < car.r + ped.r) {
            ped.dead = true;
            bloodBurst(ped.x, ped.y, 14);
            this.addCrime(2);
            this.shake = Math.min(16, sp / 30);
            SFX.crash(sp);
          }
        }
      }
    }

    for (const ped of this.peds) ped.update(dt);
    this.peds = this.peds.filter(pd => !pd.dead);
    for (const b of this.bikes) b.update(dt);
    for (const t of this.trams) t.update(dt);

    for (const t of this.trams) {
      const fx = t.x + Math.cos(t.angle) * t.len / 2, fy = t.y + Math.sin(t.angle) * t.len / 2;
      const bx = t.x - Math.cos(t.angle) * t.len / 2, by = t.y - Math.sin(t.angle) * t.len / 2;
      const tc = World.segClosest(p.x, p.y, bx, by, fx, fy);
      if (tc.d < t.wdt / 2 + (p.inCar ? p.inCar.colR : p.r) - 2 && this.state === 'play') {
        if (p.inCar) this.explodeCar(p.inCar);
        else {
          p.health = 0;
          bloodBurst(p.x, p.y, 26);
          SFX.crash(420);
          this.shake = 18;
          this.toast('Von der Straßenbahn erfasst!');
        }
      }
    }

    for (const b of this.bullets) {
      b.update(dt);
      if (b.dead) continue;
      if (b.from === 'player') {
        for (const ped of this.peds) {
          if (ped.dead) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < ped.r + 3) {
            ped.dead = true;
            bloodBurst(ped.x, ped.y, 12);
            b.dead = true;
            if (b.witnessed) this.addCrime(1);
            break;
          }
        }
        if (b.dead) continue;
        for (const car of this.cars.concat(this.police)) {
          if (car.dead) continue;
          if (dist(b.x, b.y, car.x, car.y) < car.r) {
            b.dead = true;
            car.health -= 24;
            sparkBurst(b.x, b.y, 5);
            if (car.type === 'police') {
              if (!car.hitByPlayer) { car.hitByPlayer = true; this.addCrime(2); }
            } else if (b.witnessed && car.ai === false) {
              this.addCrime(1);
            }
            if (car.health <= 0) { this.explodeCar(car); if (car.type === 'police') this.addCrime(3); }
            break;
          }
        }
      } else {
        const tgt = p.inCar || p;
        if (dist(b.x, b.y, tgt.x, tgt.y) < tgt.r + 3) {
          b.dead = true;
          if (p.inCar) { p.inCar.health -= 12; if (p.inCar.health <= 0) this.explodeCar(p.inCar); }
          else { p.health -= 9; bloodBurst(p.x, p.y, 6); if (p.health <= 0) this.wasted(); }
        }
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter(pt => !pt.dead);
    this.cars = this.cars.filter(c => !c.dead);
    if (p.health <= 0 && this.state === 'play') this.wasted();

    if (p.stars > 0 && this.time - p.lastCrime > CFG.STAR_DECAY_TIME) {
      p.decayT += dt;
      const policeNear = this.police.some(c => dist(c.x, c.y, p.x, p.y) < 700);
      if (p.decayT > CFG.STAR_DECAY_TICK && !policeNear) {
        p.stars--;
        p.decayT = 0;
        if (p.stars === 0) this.police = [];
      }
    }

    this.updateMission(dt);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter(t => t.t > 0);
    this.shake = Math.max(0, this.shake - dt * 30);

    const pe = p.inCar || p;
    const targetZoom = p.inCar ? 1 - clamp(p.inCar.speedAbs() / 2200, 0, 0.32) : 1;
    this.cam.zoom = lerp(this.cam.zoom, targetZoom, 1 - Math.pow(0.001, dt));
    const z = this.cam.zoom;
    const vw = this.vw / z, vh = this.vh / z;
    const tx = vw >= World.W ? World.W / 2 : clamp(pe.x, vw / 2, World.W - vw / 2);
    const ty = vh >= World.H ? World.H / 2 : clamp(pe.y, vh / 2, World.H - vh / 2);
    if (Math.abs(tx - this.cam.x) > 500 || Math.abs(ty - this.cam.y) > 500) { this.cam.x = tx; this.cam.y = ty; }
    const ck = 1 - Math.pow(0.0001, dt);
    this.cam.x += (tx - this.cam.x) * ck;
    this.cam.y += (ty - this.cam.y) * ck;

    SFX.setEngine(!!p.inCar, p.inCar ? p.inCar.speedF() / CFG.CAR_MAXF : 0, p.inCar ? clamp(Math.abs(p.inCar.speedF()) / CFG.CAR_MAXF, 0, 1) : 0);
    SFX.updateSiren(this.sirenNear && this.state === 'play', dt);

    if (p.health < 100 && p.state !== 'wasted') p.health = Math.min(100, p.health + dt * 1.2);
  },

  aimAngle() {
    const p = this.player;
    if (this.mode === '3d' && Render3D.available && typeof THREE !== 'undefined') {
      const nx = (this.mouse.x / this.vw) * 2 - 1;
      const ny = -(this.mouse.y / this.vh) * 2 + 1;
      const ray = new THREE.Raycaster();
      ray.setFromCamera({ x: nx, y: ny }, Render3D.camera);
      const d = ray.ray.direction;
      if (Math.abs(d.y) > 0.0001) {
        const t = -ray.ray.origin.y / d.y;
        if (t > 0) {
          return Math.atan2(ray.ray.origin.z + d.z * t - p.y, ray.ray.origin.x + d.x * t - p.x);
        }
      }
    }
    const z = this.cam.zoom;
    const wx = this.cam.x + (this.mouse.x - this.vw / 2) / z;
    const wy = this.cam.y + (this.mouse.y - this.vh / 2) / z;
    return Math.atan2(wy - p.y, wx - p.x);
  },

  playerShoot() {
    const p = this.player;
    p.fireCd = CFG.FIRE_COOLDOWN;
    const src = p.inCar || p;
    const a = this.aimAngle();
    if (!p.inCar) p.angle = a;
    const b = new Bullet(src.x + Math.cos(a) * 28, src.y + Math.sin(a) * 28, a, 'player');
    b.witnessed = this.peds.some(pd => !pd.dead && dist(pd.x, pd.y, p.x, p.y) < CFG.WITNESS_RANGE);
    this.bullets.push(b);
    SFX.shoot();
    sparkBurst(b.x, b.y, 3, '#fff2a0');
    this.scarePeds(src.x, src.y, 430);
  },

  scarePeds(x, y, range) {
    for (const ped of this.peds) {
      if (!ped.dead && dist(ped.x, ped.y, x, y) < range) ped.scare(x, y);
    }
  },

  explodeCar(car) {
    car.dead = true;
    explosionBurst(car.x, car.y);
    SFX.explosion();
    this.shake = 20;
    this.scarePeds(car.x, car.y, 500);
    if (car === this.player.inCar) {
      this.player.inCar = null;
      this.player.health = 0;
      this.wasted();
    }
  },

  wasted() {
    this.state = 'wasted';
    this.player.stars = 0;
    this.police = [];
    SFX.setEngine(false, 0, 0);
    SFX.updateSiren(false, 0.1);
  },

  respawn() {
    const p = this.player;
    const sp = this.safeFootPos(World.respawn.x, World.respawn.y);
    p.x = sp.x;
    p.y = sp.y;
    p.vx = 0; p.vy = 0;
    p.health = 100;
    p.stars = 0;
    p.inCar = null;
    p.lastCrime = this.time;
    this.police = [];
    this.bullets = [];
    this.state = 'play';
    this.paused = false;
    this.toast('Wiederbelebt im Klinikum — KS ' + p.cash + '€ behalten');
  },

  addCrime(n) {
    const p = this.player;
    p.stars = Math.min(5, p.stars + n);
    p.lastCrime = this.time;
    p.decayT = 0;
  },

  startMission(type) {
    const p = this.player;
    if (type === 'taxi' && !p.inCar) {
      this.toast('Für den Taxi-Job brauchst du ein Auto!');
      return;
    }
    if (type === 'taxi') {
      let target = World.randomRoadPointFar(p.x, p.y, 1400);
      const d = dist(p.x, p.y, target.x, target.y);
      this.mission = { type, target, t: d / 240 * 1.7 + 20, reward: Math.round(130 + d / 12) };
      this.toast('TAXI: Fahrgast ans Ziel bringen!');
    } else if (type === 'pakete') {
      const pkgs = [];
      for (let i = 0; i < 5; i++) {
        let px = 0, py = 0, tries = 0;
        do {
          const it = World.randomRoadPointNear(p.x, p.y, 1700);
          px = it.x + rand(-12, 12);
          py = it.y + rand(-12, 12);
        } while (World.blocked(px, py, 10) && ++tries < 8);
        pkgs.push({ x: px, y: py, taken: false });
      }
      this.mission = { type, packages: pkgs, t: 150, reward: 230 };
      this.toast('PAKETE: 5 Pakete einsammeln!');
    } else if (type === 'sprint') {
      const g = World.forestGate;
      const d = dist(p.x, p.y, g.x, g.y);
      this.mission = { type, target: g, t: d / 280 * 1.6 + 12, reward: 260 };
      this.toast('SPRINT: Erreiche das Wald-Tor am Käfertaler Wald!');
    }
    SFX.pickup();
  },

  updateMission(dt) {
    const m = this.mission;
    if (!m) return;
    const p = this.player;
    m.t -= dt;
    if (m.t <= 0) {
      this.mission = null;
      SFX.missionFail();
      this.toast('Mission fehlgeschlagen!');
      this.newMarker();
      return;
    }
    if (m.type === 'pakete') {
      for (const pk of m.packages) {
        if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 30) {
          pk.taken = true;
          SFX.pickup();
          this.toast('Paket eingesammelt (' + m.packages.filter(q => q.taken).length + '/5)');
        }
      }
      if (m.packages.every(pk => pk.taken)) this.missionSuccess();
    } else {
      if (dist(p.x, p.y, m.target.x, m.target.y) < 32) this.missionSuccess();
    }
  },

  missionSuccess() {
    const m = this.mission;
    this.player.cash += m.reward;
    SFX.missionSuccess();
    this.toast('Mission geschafft! +' + m.reward + ' €');
    this.mission = null;
    this.newMarker();
  },

  newMarker() {
    const types = ['taxi', 'pakete', 'sprint'];
    const type = choice(types.filter(t => t !== this.marker.type));
    if (type === 'taxi') this.marker = { x: World.pois.station.x, y: World.pois.station.y, type };
    else if (type === 'pakete') this.marker = { x: World.pois.plaza.x, y: World.pois.plaza.y, type };
    else this.marker = { x: World.pois.friedhof.x, y: World.pois.friedhof.y, type };
  },

  toast(text) {
    this.toasts.push({ text, t: 3.2 });
    if (this.toasts.length > 4) this.toasts.shift();
  },

  nightFactor() {
    const sun = Math.sin((this.dayT - 0.25) * 2 * Math.PI);
    return clamp(-sun, 0, 1);
  },

  render() {
    const g = this.ctx;
    const vw = this.vw, vh = this.vh;
    if (this.mode === '3d' && Render3D.available) {
      Render3D.render(this.lastDt);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, vw, vh);
      this.drawHUD(g);
      this.drawMinimap(g);
      this.drawOverlays(g);
      return;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b0b14';
    g.fillRect(0, 0, vw, vh);
    const shx = this.shake ? rand(-this.shake, this.shake) : 0;
    const shy = this.shake ? rand(-this.shake, this.shake) : 0;
    const z = this.cam.zoom;
    g.setTransform(z, 0, 0, z, vw / 2 - this.cam.x * z + shx, vh / 2 - this.cam.y * z + shy);
    g.drawImage(World.canvas, 0, 0);
    if (World.labelCanvas) g.drawImage(World.labelCanvas, 0, 0);
    this.drawMarkers(g);
    const drawables = [];
    for (const ped of this.peds) if (!ped.dead) drawables.push({ y: ped.y, f: () => this.drawPed(g, ped) });
    for (const b of this.bikes) drawables.push({ y: b.y, f: () => this.drawBike(g, b) });
    for (const t of this.trams) drawables.push({ y: t.y, f: () => this.drawTram(g, t) });
    for (const car of this.cars) if (!car.dead) drawables.push({ y: car.y, f: () => this.drawCar(g, car) });
    for (const car of this.police) if (!car.dead) drawables.push({ y: car.y, f: () => this.drawCar(g, car) });
    if (!this.player.inCar) drawables.push({ y: this.player.y, f: () => this.drawPlayer(g) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.f();
    for (const b of this.bullets) this.drawBullet(g, b);
    for (const pt of this.particles) {
      g.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      g.fillStyle = pt.color;
      g.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    g.globalAlpha = 1;

    g.setTransform(1, 0, 0, 1, 0, 0);
    const night = this.nightFactor();
    if (night > 0.02) {
      g.fillStyle = 'rgba(8,10,42,' + (night * 0.52).toFixed(3) + ')';
      g.fillRect(0, 0, vw, vh);
    }
    if (night > 0.3) {
      g.setTransform(z, 0, 0, z, vw / 2 - this.cam.x * z, vh / 2 - this.cam.y * z);
      g.globalCompositeOperation = 'lighter';
      for (const it of World.lampNodes) {
        const gr = g.createRadialGradient(it.x, it.y, 4, it.x, it.y, 90);
        gr.addColorStop(0, 'rgba(255,220,140,' + (0.20 * night).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(255,220,140,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(it.x, it.y, 90, 0, 7); g.fill();
      }
      for (const car of this.cars.concat(this.police)) {
        if (car.dead) continue;
        const f = car.forward();
        const hx = car.x + f.x * 40, hy = car.y + f.y * 40;
        const gr = g.createRadialGradient(hx, hy, 6, hx, hy, 150);
        gr.addColorStop(0, 'rgba(255,240,180,' + (0.30 * night).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(255,240,180,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(hx, hy, 150, 0, 7); g.fill();
      }
      g.shadowBlur = 0;
      g.globalCompositeOperation = 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0);
    }

    if (this.editPlace && this.mode === '2d') {
      try { this.drawEditGhost(g); } catch (e) { this.editPlace = null; this.toast('Editor-Fehler: ' + e.message); }
    }
    this.drawCustomPreview(g);

    this.drawHUD(g);
    this.drawMinimap(g);
    this.drawOverlays(g);
  },

  updateEditPlace(dt) {
    const ep = this.editPlace;
    const z = this.cam.zoom || 1;
    ep.cx = (this.mouse.x - this.vw / 2) / z + this.cam.x;
    ep.cy = (this.mouse.y - this.vh / 2) / z + this.cam.y;
    const rotSp = (this.keys.KeyE ? 1 : 0) - (this.keys.KeyQ ? 1 : 0);
    if (rotSp) ep.rot += rotSp * ((this.keys.ShiftLeft || this.keys.ShiftRight) ? 0.4 : 2.2) * dt;
    const ck = 1 - Math.pow(0.001, dt);
    this.cam.x += (ep.cx - this.cam.x) * ck;
    this.cam.y += (ep.cy - this.cam.y) * ck;
  },

  editGhostPts(ep) {
    const s = World.s, hw = ep.facade.wM * s / 2, hd = ep.facade.dM * s / 2;
    const ux = Math.cos(ep.rot), uy = Math.sin(ep.rot), nx = -uy, ny = ux;
    return [
      [ep.cx + ux * hd + nx * hw, ep.cy + uy * hd + ny * hw],
      [ep.cx + ux * hd - nx * hw, ep.cy + uy * hd - ny * hw],
      [ep.cx - ux * hd - nx * hw, ep.cy - uy * hd - ny * hw],
      [ep.cx - ux * hd + nx * hw, ep.cy - uy * hd + ny * hw]
    ];
  },

  confirmEdit() {
    const ep = this.editPlace;
    if (!ep) return;
    const pts = this.editGhostPts(ep);
    const ll = pts.map(q => World.toLonLat(q[0], q[1]));
    ll.push(ll[0].slice());
    const rec = { p: ll, n: ep.name || 'Eigenes Gebäude', lvl: 0, roof: ['flat', 'gabled', 'hip', 'pyramidal'].includes(ep.facade.roofShape) ? ep.facade.roofShape : 'flat', bt: 'yes', facade: ep.facade };
    let edits = [];
    try { edits = JSON.parse(localStorage.getItem('fve_edits') || '[]') || []; } catch (e) {}
    if (!Array.isArray(edits)) edits = [];
    edits.push(rec);
    try {
      localStorage.setItem('fve_edits', JSON.stringify(edits));
      localStorage.removeItem('fve_pending');
    } catch (e) {}
    this.editPlace = null;
    this.toast('Gebäude gespeichert — es erscheint jetzt in 2D und 3D!');
    setTimeout(() => { try { location.href = 'index.html?mode=2d'; } catch (e) {} }, 600);
  },

  cancelEdit() {
    try { localStorage.removeItem('fve_pending'); } catch (e) {}
    this.editPlace = null;
    try { location.href = 'index.html'; } catch (e) {}
  },

  drawEditGhost(g) {
    const vw = this.vw, vh = this.vh;
    const ep = this.editPlace;
    const z = this.cam.zoom || 1;
    const pts = this.editGhostPts(ep);
    const cl = World.roadClearance(pts);
    g.setTransform(z, 0, 0, z, vw / 2 - this.cam.x * z, vh / 2 - this.cam.y * z);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillStyle = cl >= 0.5 ? 'rgba(125,255,106,0.35)' : 'rgba(255,80,80,0.4)';
    g.fill();
    g.strokeStyle = cl >= 0.5 ? '#7dff6a' : '#ff5050';
    g.lineWidth = 2.5 / z;
    g.stroke();
    const terrG = ep.facade && ep.facade.terr && ep.facade.terr.m > 0 && (ep.facade.floors | 0) >= 2 ? ep.facade.terr : null;
    if (terrG) {
      let bi = 0, bl = 0;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[(i + 1) % pts.length];
        const l = Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]);
        if (l > bl) { bl = l; bi = i; }
      }
      const q = pts[(bi + 1) % pts.length];
      let dx = q[0] - pts[bi][0], dy = q[1] - pts[bi][1];
      const dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl, ny = dx / dl;
      const t = terrG.m * World.s;
      const cx = ep.cx, cy = ep.cy;
      const inner = pts.map(p => {
        const d = (p[0] - cx) * nx + (p[1] - cy) * ny;
        const sgn = d >= 0 ? 1 : -1;
        let mv = 0;
        if (terrG.sides === 'both') mv = -sgn * t;
        else if (terrG.sides === 'left' && d > 0) mv = -t;
        else if (terrG.sides === 'right' && d < 0) mv = t;
        return [p[0] + nx * mv, p[1] + ny * mv];
      });
      g.beginPath();
      g.moveTo(inner[0][0], inner[0][1]);
      for (let i = 1; i < inner.length; i++) g.lineTo(inner[i][0], inner[i][1]);
      g.closePath();
      g.strokeStyle = 'rgba(255,230,60,0.9)';
      g.lineWidth = 1.5 / z;
      g.setLineDash([5 / z, 4 / z]);
      g.stroke();
      g.setLineDash([]);
    }
    const ux = Math.cos(ep.rot), uy = Math.sin(ep.rot);
    g.beginPath();
    g.moveTo(ep.cx, ep.cy);
    g.lineTo(ep.cx + ux * 60, ep.cy + uy * 60);
    g.strokeStyle = '#ffe63c';
    g.lineWidth = 3 / z;
    g.stroke();
    g.fillStyle = '#ffe63c';
    g.beginPath();
    g.arc(ep.cx + ux * 60, ep.cy + uy * 60, 6 / z, 0, 7);
    g.fill();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.textAlign = 'center';
    g.font = 'bold 15px Verdana, sans-serif';
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(vw / 2 - 330, vh - 92, 660, 76);
    g.fillStyle = '#fff';
    g.fillText('🛠 ' + (ep.name || 'Eigenes Gebäude') + ' — ' + (ep.facade.wM | 0) + '×' + (ep.facade.dM | 0) + ' m, ' + Math.round(ep.rot * 180 / Math.PI) + '°' + (ep.osmName ? ' · OSM: ' + ep.osmName : ''), vw / 2, vh - 68);
    g.fillStyle = cl >= 0.5 ? '#7dff6a' : '#ff8080';
    g.fillText('Maus = Position · Q/E = drehen (Shift = 1°) · Enter = speichern · Esc = abbrechen · Abstand zur Straße: ' + cl.toFixed(1) + ' px', vw / 2, vh - 44);
  },

  drawCustomPreview(g) {
    if (this.mode !== '2d' || typeof FacadeLib === 'undefined') return;
    const z = this.cam.zoom || 1;
    const mx = (this.mouse.x - this.vw / 2) / z + this.cam.x;
    const my = (this.mouse.y - this.vh / 2) / z + this.cam.y;
    let best = null, bd = 46 * 46;
    for (const b of World.buildings) {
      if (!b.facade) continue;
      const d = (b.cx - mx) * (b.cx - mx) + (b.cy - my) * (b.cy - my);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return;
    if (!this._prevCache) this._prevCache = new Map();
    const key = JSON.stringify(best.facade);
    if (!this._prevCache.has(key)) {
      const cv = document.createElement('canvas');
      cv.width = 220; cv.height = 380;
      try { FacadeLib.drawPreview(cv.getContext('2d'), best.facade, 12, 46, 196, (best.cx | 0)); } catch (e) {}
      this._prevCache.set(key, cv);
      if (this._prevCache.size > 10) this._prevCache.clear();
    }
    const cv = this._prevCache.get(key);
    let sx = this.mouse.x + 18, sy = this.mouse.y - 200;
    sx = Math.max(4, Math.min(this.vw - 230, sx));
    sy = Math.max(4, Math.min(this.vh - 240, sy));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(0,0,0,0.78)';
    g.fillRect(sx - 6, sy - 24, 232, 232);
    g.strokeStyle = 'rgba(125,255,106,0.6)';
    g.strokeRect(sx - 6, sy - 24, 232, 232);
    g.drawImage(cv, sx, sy, 220, 200);
    g.fillStyle = '#7dff6a';
    g.font = 'bold 13px Verdana, sans-serif';
    g.textAlign = 'left';
    g.fillText(best.name || 'Eigenes Gebäude', sx, sy - 9);
  },

  drawOverlays(g) {
    const vw = this.vw, vh = this.vh;
    if (this.state === 'title') this.drawTitle(g);
    if (this.state === 'wasted') this.drawDeath(g, 'WASTED', 'rgba(140,10,10,0.55)', 'R = Wiederbelebung beim Arzt');
    if (this.state === 'busted') this.drawDeath(g, 'BUSTED', 'rgba(10,40,140,0.55)', 'R = Wieder freilassen (20% Strafe)');
    if (this.paused && this.state === 'play') {
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(0, 0, vw, vh);
      g.fillStyle = '#fff';
      g.font = 'bold 44px Verdana, sans-serif';
      g.textAlign = 'center';
      g.fillText('PAUSE', vw / 2, vh / 2);
      g.font = '18px Verdana, sans-serif';
      g.fillText('P drücken zum Weiterspielen', vw / 2, vh / 2 + 36);
    }
  },

  drawMarkers(g) {
    const t = this.time;
    if (!this.mission) {
      const m = this.marker;
      const pulse = 18 + Math.sin(t * 5) * 5;
      g.strokeStyle = 'rgba(255,230,60,0.9)';
      g.lineWidth = 4;
      g.beginPath(); g.arc(m.x, m.y, pulse, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,230,60,0.25)';
      g.beginPath(); g.arc(m.x, m.y, pulse, 0, 7); g.fill();
      g.fillStyle = '#ffe63c';
      g.font = 'bold 16px Verdana, sans-serif';
      g.textAlign = 'center';
      g.fillText('E', m.x, m.y - pulse - 8);
    } else {
      const m = this.mission;
      if (m.type === 'pakete') {
        for (const pk of m.packages) {
          if (pk.taken) continue;
          g.fillStyle = '#ffb02e';
          g.fillRect(pk.x - 8, pk.y - 8, 16, 16);
          g.strokeStyle = '#7a4a00';
          g.strokeRect(pk.x - 8, pk.y - 8, 16, 16);
        }
      } else if (m.target) {
        const pulse = 20 + Math.sin(t * 6) * 6;
        g.strokeStyle = 'rgba(80,255,120,0.95)';
        g.lineWidth = 5;
        g.beginPath(); g.arc(m.target.x, m.target.y, pulse, 0, 7); g.stroke();
        g.fillStyle = 'rgba(80,255,120,0.2)';
        g.beginPath(); g.arc(m.target.x, m.target.y, pulse, 0, 7); g.fill();
      }
    }
  },

  drawCar(g, car) {
    g.save();
    g.translate(car.x, car.y);
    g.rotate(car.angle);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
    g.fillStyle = car.type === 'police' ? '#1c2f66' : car.color;
    g.fillRect(-car.w / 2, -car.h / 2, car.w, car.h);
    if (car.type === 'police') {
      g.fillStyle = '#e8e8e8';
      g.fillRect(-car.w / 2 + 6, -car.h / 2, car.w - 12, car.h);
      g.fillStyle = '#1c2f66';
      g.fillRect(-6, -car.h / 2 + 3, 14, car.h - 6);
      const on = Math.floor(this.time * 8) % 2 === 0;
      g.fillStyle = on ? '#ff3b3b' : '#3b6bff';
      g.fillRect(-4, -car.h / 2 - 3, 8, 4);
      g.fillStyle = on ? '#3b6bff' : '#ff3b3b';
      g.fillRect(-4, car.h / 2 - 1, 8, 4);
    }
    g.fillStyle = 'rgba(20,30,40,0.85)';
    g.fillRect(car.w / 2 - 18, -car.h / 2 + 4, 9, car.h - 8);
    g.fillRect(-car.w / 2 + 8, -car.h / 2 + 3, 10, car.h - 6);
    g.fillStyle = 'rgba(255,250,210,0.9)';
    g.fillRect(car.w / 2 - 3, -car.h / 2 + 3, 3, 6);
    g.fillRect(car.w / 2 - 3, car.h / 2 - 9, 3, 6);
    g.fillStyle = 'rgba(255,60,60,0.9)';
    g.fillRect(-car.w / 2, -car.h / 2 + 3, 3, 6);
    g.fillRect(-car.w / 2, car.h / 2 - 9, 3, 6);
    g.fillStyle = '#15181d';
    g.fillRect(-car.w / 2 + 6, -car.h / 2 - 2, 12, 3);
    g.fillRect(-car.w / 2 + 6, car.h / 2 - 1, 12, 3);
    g.fillRect(car.w / 2 - 16, -car.h / 2 - 2, 12, 3);
    g.fillRect(car.w / 2 - 16, car.h / 2 - 1, 12, 3);
    if (car === this.player.inCar) {
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 2;
      g.strokeRect(-car.w / 2 - 2, -car.h / 2 - 2, car.w + 4, car.h + 4);
    }
    g.restore();
  },

  drawBike(g, b) {
    g.save();
    g.translate(b.x, b.y);
    g.rotate(b.angle);
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 2;
    g.beginPath(); g.arc(-6, 0, 4.5, 0, 7); g.stroke();
    g.beginPath(); g.arc(7, 0, 4.5, 0, 7); g.stroke();
    g.beginPath();
    g.moveTo(-6, 0); g.lineTo(-1, -5); g.lineTo(7, 0); g.lineTo(2, -6); g.lineTo(-1, -5);
    g.stroke();
    g.fillStyle = b.color;
    g.beginPath(); g.arc(1, -8, 4, 0, 7); g.fill();
    g.restore();
  },

  drawTram(g, t) {
    g.save();
    g.translate(t.x, t.y);
    g.rotate(t.angle);
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.fillRect(-t.len / 2 + 4, -t.wdt / 2 + 5, t.len, t.wdt);
    g.fillStyle = t.color;
    g.fillRect(-t.len / 2, -t.wdt / 2, t.len, t.wdt);
    g.fillStyle = 'rgba(16,26,36,0.9)';
    g.fillRect(-t.len / 2 + 8, -t.wdt / 2 + 4, t.len - 16, t.wdt / 2 - 6);
    g.fillStyle = 'rgba(255,250,215,0.95)';
    for (let wx = -t.len / 2 + 13; wx < t.len / 2 - 16; wx += 15) g.fillRect(wx, t.wdt / 2 - 7, 9, 5);
    g.strokeStyle = '#2a2a2a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-10, -t.wdt / 2); g.lineTo(-16, -t.wdt / 2 - 8); g.lineTo(16, -t.wdt / 2 - 8); g.lineTo(10, -t.wdt / 2);
    g.stroke();
    g.fillStyle = 'rgba(255,250,210,0.95)';
    g.fillRect(t.len / 2 - 3, -t.wdt / 2 + 3, 3, 7);
    g.fillRect(t.len / 2 - 3, t.wdt / 2 - 10, 3, 7);
    g.fillStyle = 'rgba(255,60,60,0.95)';
    g.fillRect(-t.len / 2, -t.wdt / 2 + 3, 3, 7);
    g.fillRect(-t.len / 2, t.wdt / 2 - 10, 3, 7);
    g.fillStyle = '#15181d';
    for (const wx of [-t.len / 2 + 10, t.len / 2 - 22]) {
      g.fillRect(wx, -t.wdt / 2 - 2, 12, 3);
      g.fillRect(wx, t.wdt / 2 - 1, 12, 3);
    }
    g.restore();
  },

  drawPed(g, ped) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.arc(ped.x + 2, ped.y + 3, ped.r, 0, 7); g.fill();
    g.fillStyle = ped.color;
    g.beginPath(); g.arc(ped.x, ped.y, ped.r, 0, 7); g.fill();
    g.fillStyle = '#e8b98a';
    g.beginPath(); g.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 4.5, 0, 7); g.fill();
  },

  drawPlayer(g) {
    const p = this.player;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.arc(p.x + 2, p.y + 3, p.r, 0, 7); g.fill();
    g.fillStyle = '#2456d6';
    g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    g.fillStyle = '#f0c8a0';
    g.beginPath(); g.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 5.5, 0, 7); g.fill();
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(p.x + Math.cos(p.angle) * 6, p.y + Math.sin(p.angle) * 6);
    g.lineTo(p.x + Math.cos(p.angle) * 15, p.y + Math.sin(p.angle) * 15);
    g.stroke();
  },

  drawBullet(g, b) {
    g.strokeStyle = b.from === 'player' ? '#ffe98a' : '#ff9a7a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    g.lineTo(b.x, b.y);
    g.stroke();
  },

  drawHUD(g) {
    const vw = this.vw, vh = this.vh;
    const p = this.player;
    g.textAlign = 'left';
    g.font = 'bold 22px Verdana, sans-serif';
    g.fillStyle = '#7dff6a';
    g.fillText('€ ' + p.cash, 16, 30);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(14, 40, 184, 16);
    const hcol = p.health > 50 ? '#5ad65a' : p.health > 25 ? '#e8c832' : '#e84a32';
    g.fillStyle = hcol;
    g.fillRect(16, 42, 180 * clamp(p.health, 0, 100) / 100, 12);
    g.strokeStyle = '#000';
    g.strokeRect(14, 40, 184, 16);

    g.textAlign = 'right';
    g.font = 'bold 26px Verdana, sans-serif';
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i < p.stars ? '#ffd23c' : 'rgba(255,255,255,0.25)';
      g.fillText('★', vw - 20 - i * 30, 236);
    }

    if (this.mission) {
      const m = this.mission;
      const mm = Math.max(0, Math.floor(m.t / 60));
      const ss = Math.max(0, Math.floor(m.t % 60));
      g.textAlign = 'center';
      g.font = 'bold 19px Verdana, sans-serif';
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(vw / 2 - 240, 10, 480, 30);
      g.fillStyle = '#ffe63c';
      let txt = '';
      if (m.type === 'taxi') txt = 'TAXI: Bringe den Fahrgast zum grünen Marker!  ' + mm + ':' + String(ss).padStart(2, '0');
      if (m.type === 'pakete') txt = 'PAKETE: ' + m.packages.filter(q => q.taken).length + '/5 eingesammelt  ' + mm + ':' + String(ss).padStart(2, '0');
      if (m.type === 'sprint') txt = 'SPRINT: Erreiche das Wald-Tor!  ' + mm + ':' + String(ss).padStart(2, '0');
      g.fillText(txt, vw / 2, 32);
    } else {
      g.textAlign = 'center';
      g.font = '16px Verdana, sans-serif';
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillText('Geh zum gelben Marker und drücke E — Mission starten', vw / 2, 30);
    }

    const hour = Math.floor(this.dayT * 24), min = Math.floor((this.dayT * 24 % 1) * 60);
    g.textAlign = 'right';
    g.font = '15px Verdana, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillText(String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0'), vw - 16, 262);

    {
      const mb = { x: vw - 116, y: 272, w: 100, h: 26 };
      this.modeBtn = mb;
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(mb.x, mb.y, mb.w, mb.h);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1;
      g.strokeRect(mb.x, mb.y, mb.w, mb.h);
      g.textAlign = 'center';
      g.font = 'bold 14px Verdana, sans-serif';
      g.fillStyle = this.mode === '3d' ? 'rgba(255,255,255,0.45)' : '#7dff6a';
      g.fillText('2D', mb.x + 24, mb.y + 18);
      g.fillStyle = this.mode === '3d' ? '#7dff6a' : 'rgba(255,255,255,0.45)';
      g.fillText('3D', mb.x + 76, mb.y + 18);
      g.font = '10px Verdana, sans-serif';
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillText('Taste 2/3 oder klicken', mb.x + mb.w / 2, mb.y + mb.h + 11);
    }

    if (p.inCar) {
      g.textAlign = 'right';
      g.font = 'bold 30px Verdana, sans-serif';
      g.fillStyle = '#fff';
      g.fillText(Math.round(p.inCar.speedAbs() * 0.32) + ' km/h', vw - 20, vh - 24);
      g.font = '14px Verdana, sans-serif';
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillText('Auto-Leben: ' + Math.max(0, Math.round(p.inCar.health)) + '%', vw - 20, vh - 52);
    }

    if (this.hintT < 25 && this.state === 'play') {
      g.textAlign = 'left';
      g.font = '13px Verdana, sans-serif';
      g.fillStyle = 'rgba(255,255,255,' + clamp(25 - this.hintT, 0, 1) * 0.75 + ')';
      g.fillText(this.mode === '2d'
        ? '2D: ↑/↓/←/→ (WASD) = Himmelsrichtung (N/S/W/O) · Maus = zielen · F/Klick = schießen · E = Auto/Mission · Leertaste = Handbremse · 3 = 3D · P = Pause · M = Ton'
        : '3D: ↑/↓(W/S) = vorwärts/rückwärts · ←/→(A/D) = Figur drehen in 10°-Schritten · im Auto lenken ←/→ · Maus = zielen · F/Klick = schießen · E = Auto/Mission · Leertaste = Handbremse · 2 = 2D · P = Pause · M = Ton', 16, vh - 16);
    }

    if (this.showKeys && this.state === 'play') {
      const rows = (this.mode === '2d' ? [
        ['W/S · Pfeile ↑/↓', 'Nord / Süd'],
        ['A/D · Pfeile ←/→', 'West / Ost'],
        ['Maus', 'zielen · ziehen = Kamera (3D)'],
        ['F / Klick', 'schießen'],
        ['E', 'Auto / aussteigen / Mission'],
        ['Leertaste', 'Handbremse (Auto)'],
        ['2 / 3', '2D / 3D-Modus'],
        ['P · M · H', 'Pause · Ton · diese Box']
      ] : [
        ['W/S · Pfeile ↑/↓', 'vorwärts / rückwärts'],
        ['A/D · Pfeile ←/→', 'drehen (10°) · Auto: lenken'],
        ['Maus', 'zielen · ziehen = Kamera (3D)'],
        ['F / Klick', 'schießen'],
        ['E', 'Auto / aussteigen / Mission'],
        ['Leertaste', 'Handbremse (Auto)'],
        ['2 / 3', '2D / 3D-Modus'],
        ['P · M · H', 'Pause · Ton · diese Box']
      ]);
      g.textAlign = 'left';
      g.font = '12px Verdana, sans-serif';
      const bw = 252, bh = rows.length * 15 + 24;
      const bx = 12, by = vh - bh - (this.hintT < 25 ? 24 : 8);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(bx, by, bw, bh);
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.strokeRect(bx, by, bw, bh);
      g.fillStyle = '#ffd76a';
      g.fillText('TASTEN  (H = ausblenden)', bx + 8, by + 15);
      let ry = by + 30;
      for (const [k, a] of rows) {
        g.fillStyle = '#ffffff';
        g.fillText(k, bx + 8, ry);
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fillText(a, bx + 104, ry);
        ry += 15;
      }
    }

    g.textAlign = 'center';
    g.font = 'bold 17px Verdana, sans-serif';
    let ty = vh / 2 - 90;
    for (const t of this.toasts) {
      g.globalAlpha = clamp(t.t / 0.6, 0, 1);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      const w = g.measureText(t.text).width + 24;
      g.fillRect(vw / 2 - w / 2, ty - 18, w, 26);
      g.fillStyle = '#fff';
      g.fillText(t.text, vw / 2, ty);
      g.globalAlpha = 1;
      ty += 32;
    }
  },

  drawMinimap(g) {
    const vw = this.vw;
    const s = 190 / World.W;
    const ox = vw - 202, oy = 12;
    if (!this._mmBase) {
      const c = document.createElement('canvas');
      c.width = 190; c.height = 190;
      const mg = c.getContext('2d');
      for (const gn of World.greens) {
        mg.fillStyle = gn.kind === 'forest' ? '#274a24' : gn.kind === 'cemetery' ? '#3a4438' : '#3f5a2e';
        mg.beginPath();
        mg.moveTo(gn.pts[0][0] * s, gn.pts[0][1] * s);
        for (let i = 1; i < gn.pts.length; i++) mg.lineTo(gn.pts[i][0] * s, gn.pts[i][1] * s);
        mg.closePath();
        mg.fill();
      }
      mg.strokeStyle = '#4a4d53';
      mg.lineCap = 'round';
      for (const w of World.roadWays) {
        mg.lineWidth = Math.max(1, w.width * s);
        mg.beginPath();
        mg.moveTo(w.pts[0][0] * s, w.pts[0][1] * s);
        for (let i = 1; i < w.pts.length; i++) mg.lineTo(w.pts[i][0] * s, w.pts[i][1] * s);
        mg.stroke();
      }
      for (const w of World.railWays) {
        mg.strokeStyle = '#8a8578';
        mg.lineWidth = 1.6;
        mg.beginPath();
        mg.moveTo(w.pts[0][0] * s, w.pts[0][1] * s);
        for (let i = 1; i < w.pts.length; i++) mg.lineTo(w.pts[i][0] * s, w.pts[i][1] * s);
        mg.stroke();
      }
      this._mmBase = c;
    }
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(ox - 3, oy - 3, 196, 196);
    g.drawImage(this._mmBase, ox, oy);
    const dot = (x, y, c, r) => {
      g.fillStyle = c;
      g.beginPath(); g.arc(ox + x * s, oy + y * s, r, 0, 7); g.fill();
    };
    if (!this.mission) dot(this.marker.x, this.marker.y, '#ffe63c', 4 + Math.sin(this.time * 5));
    else if (this.mission.type === 'pakete') {
      for (const pk of this.mission.packages) if (!pk.taken) dot(pk.x, pk.y, '#ffb02e', 3);
    } else if (this.mission.target) {
      dot(this.mission.target.x, this.mission.target.y, '#50ff78', 4 + Math.sin(this.time * 6));
    }
    for (const pc of this.police) dot(pc.x, pc.y, '#ff4040', 3);
    for (const t of this.trams) dot(t.x, t.y, '#ffd76a', 3);
    const p = this.player;
    g.save();
    g.translate(ox + p.x * s, oy + p.y * s);
    g.rotate(p.angle + Math.PI / 2);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5);
    g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.strokeRect(ox - 3, oy - 3, 196, 196);
  },

  drawTitle(g) {
    const vw = this.vw, vh = this.vh;
    const gr = g.createLinearGradient(0, 0, 0, vh);
    gr.addColorStop(0, '#2b1055');
    gr.addColorStop(0.55, '#7a2d8c');
    gr.addColorStop(0.8, '#e0508a');
    gr.addColorStop(1, '#ff9a5c');
    g.fillStyle = gr;
    g.fillRect(0, 0, vw, vh);
    g.textAlign = 'center';
    g.shadowColor = '#ff4fd8';
    g.shadowBlur = 34;
    g.fillStyle = '#ffe9fb';
    g.font = 'bold 84px Verdana, sans-serif';
    g.fillText('FRANKLIN VICE', vw / 2, vh / 2 - 110);
    g.shadowBlur = 0;
    g.fillStyle = '#fff';
    g.font = 'bold 22px Verdana, sans-serif';
    g.fillText('Mannheim-Käfertal · Benjamin Franklin Village', vw / 2, vh / 2 - 66);
    g.font = '17px Verdana, sans-serif';
    const lines = [
      '2D: Pfeile/WASD = Himmelsrichtung (N/S/W/O) · 3D: ↑/↓ = vorwärts/rückwärts, ←/→ = Figur drehen (10°-Schritte) · E = Auto/Mission · Leertaste = Handbremse',
      'Maus = zielen · F oder Klick = schießen · rechte Maustaste ziehen = Kamera drehen (3D) · P = Pause · M = Ton',
      'Gelbe Marker = Missionen (Taxi, Pakete, Wald-Sprint)',
      '2 = 2D-Top-Down · 3 = 3D (Third-Person) — Vorsicht: ★ bei Verbrechen → WASTED / BUSTED!'
    ];
    lines.forEach((l, i) => g.fillText(l, vw / 2, vh / 2 - 16 + i * 26));
    g.font = 'bold 15px Verdana, sans-serif';
    g.fillStyle = '#ffe63c';
    g.fillText('Modus: ' + (this.mode === '3d' ? '3D (Third-Person)' : '2D-Top-Down') + (Render3D.available ? '' : ' — WebGL nicht verfügbar') + '  ·  Taste 2/3 wechselt', vw / 2, vh / 2 + 116);
    if (Math.floor(this.time * 1.6) % 2 === 0 || this.time < 0.1) {
      g.font = 'bold 26px Verdana, sans-serif';
      g.fillStyle = '#ffe63c';
      g.fillText('▶ Beliebige Taste drücken zum Spielen ◀', vw / 2, vh / 2 + 140);
    }
    const eb = { x: vw / 2 - 170, y: vh / 2 + 168, w: 340, h: 38 };
    this.editorBtn = eb;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(eb.x, eb.y, eb.w, eb.h);
    g.strokeStyle = 'rgba(125,255,106,0.8)';
    g.lineWidth = 1.5;
    g.strokeRect(eb.x, eb.y, eb.w, eb.h);
    g.fillStyle = '#7dff6a';
    g.font = 'bold 16px Verdana, sans-serif';
    g.fillText('🛠 GEBÄUDE-EDITOR', eb.x + eb.w / 2, eb.y + 24);
    g.font = '12px Verdana, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillText('Foto/Screenshot hochladen → eigenes Haus auf der Karte platzieren', eb.x + eb.w / 2, eb.y + eb.h + 15);
    g.font = '13px Verdana, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText('Fan-Parodie im GTA-Stil — echte Straßen & Orte aus Mannheim-Franklin. Keine echte Karte.', vw / 2, vh - 24);
  },

  drawDeath(g, text, color, sub) {
    const vw = this.vw, vh = this.vh;
    g.fillStyle = color;
    g.fillRect(0, 0, vw, vh);
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = 'bold 92px Verdana, sans-serif';
    g.fillText(text, vw / 2, vh / 2);
    g.font = '20px Verdana, sans-serif';
    g.fillText(sub, vw / 2, vh / 2 + 46);
  }
};

if (typeof window !== 'undefined' && !window.__TEST__) {
  try {
    Game.init();
  } catch (e) {
    try {
      const c = document.getElementById('game');
      c.width = window.innerWidth; c.height = window.innerHeight;
      const g = c.getContext('2d');
      g.fillStyle = '#0b0b14';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#ff5050';
      g.font = 'bold 18px monospace';
      g.textAlign = 'left';
      g.fillText('Fehler beim Start: ' + e.message, 20, 40);
      g.font = '13px monospace';
      g.fillStyle = '#ffb0b0';
      g.fillText(((e.stack || '').split('\n').slice(0, 8).join('\n')), 20, 70);
    } catch (e2) {}
  }
}
