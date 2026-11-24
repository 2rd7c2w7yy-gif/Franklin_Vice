const Render3D = {
  available: false,
  renderer: null,
  scene: null,
  camera: null,
  sun: null,
  hemi: null,
  carMeshes: new Map(),
  pedMeshes: new Map(),
  bikeMeshes: new Map(),
  playerMesh: null,
  marker: null,
  bulletPool: [],
  points: null,
  pointGeo: null,
  pointPos: null,
  pointCol: null,
  lampGlows: [],
  headlightCons: [],
  camPos: null,
  camYaw: 0,
  fov: 62,

  init() {
    if (typeof THREE === 'undefined') return;
    const canvas = document.getElementById('gl');
    if (!canvas) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (e) {
      return;
    }
    if (!renderer.getContext()) return;
    this.renderer = renderer;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if ('outputEncoding' in this.renderer) this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87c5e8);
    this.scene.fog = new THREE.Fog(0x87c5e8, 600, 2600);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 5000);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a4a3a, 0.6);
    this.scene.add(this.hemi);
    this.buildStatic();
    this.buildParticles();
    this.buildPlayer();
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 1.6), new THREE.MeshBasicMaterial({ color: 0xffe98a }));
      m.visible = false;
      this.scene.add(m);
      this.bulletPool.push(m);
    }
    this.available = true;
  },

  setSize(w, h) {
    if (!this.available) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  },

  groundTexture() {
    const tex = new THREE.CanvasTexture(World.canvas);
    tex.flipY = false;
    tex.anisotropy = 4;
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;
    return tex;
  },

  buildStatic() {
    const W = World.W, H = World.H;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshLambertMaterial({ map: this.groundTexture() })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(W / 2, 0, H / 2);
    this.scene.add(ground);

    this.facadeTexs = [0, 1, 2].map(v => {
      const t = this.makeFacadeTexture(v);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / 52, 1 / 52);
      return t;
    });
    for (const b of World.buildings) {
      const bxs = b.pts.map(p => p[0]), bys = b.pts.map(p => p[1]);
      if ((Math.max(...bxs) - Math.min(...bxs)) * (Math.max(...bys) - Math.min(...bys)) < 700) continue;
      const shape = new THREE.Shape();
      b.pts.forEach(([x, y], i) => {
        if (i === 0) shape.moveTo(x, -y);
        else shape.lineTo(x, -y);
      });
      const h3 = b.lvl ? 7 + b.lvl * 9 : 20 + (Math.abs((b.cx * 31 + b.cy * 17) | 0) % 48);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h3, bevelEnabled: false, curveSegments: 2 });
      geo.rotateX(-Math.PI / 2);
      const tint = new THREE.Color(b.color);
      const commercial = ['commercial', 'retail', 'office', 'industrial', 'warehouse', 'garage', 'church', 'school', 'hospital'].includes(b.bt);
      const variant = commercial ? 1 : b.bt === 'apartments' ? 2 : 0;
      const ftex = this.facadeTexs[variant].clone();
      ftex.needsUpdate = true;
      const sideMat = new THREE.MeshLambertMaterial({ map: ftex, color: tint });
      const capCol = World.roofColor(b);
      const capMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(capCol) });
      const mesh = new THREE.Mesh(geo, [sideMat, capMat]);
      this.scene.add(mesh);
      if (['gabled', 'prism', 'pyramidal', 'hip', 'round', 'onion'].includes(b.roof)) {
        const rshape = new THREE.Shape();
        b.pts.forEach(([x, y], i) => {
          const px = b.cx + (x - b.cx) * 0.7;
          const py = b.cy + (y - b.cy) * 0.7;
          if (i === 0) rshape.moveTo(px, -py);
          else rshape.lineTo(px, -py);
        });
        const rgeo = new THREE.ExtrudeGeometry(rshape, { depth: 8, bevelEnabled: false, curveSegments: 2 });
        rgeo.rotateX(-Math.PI / 2);
        const roofMesh = new THREE.Mesh(rgeo, new THREE.MeshLambertMaterial({ color: new THREE.Color(capCol) }));
        roofMesh.position.y = h3;
        this.scene.add(roofMesh);
      }
    }

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x3e7d3a });
    for (const t of World.trees) {
      if (t.fountain) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r * 1.1, 7, 18), new THREE.MeshLambertMaterial({ color: 0x5f9fc4 }));
        f.position.set(t.x, 3.5, t.y);
        this.scene.add(f);
        continue;
      }
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 7, 6), trunkMat);
      trunk.position.set(t.x, 3.5, t.y);
      this.scene.add(trunk);
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(t.r, 0), leafMat);
      leaf.position.set(t.x, 7 + t.r * 0.7, t.y);
      this.scene.add(leaf);
    }

    const poleMat = new THREE.MeshLambertMaterial({ color: 0x555a62 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const glowTex = this.radialTexture('rgba(255,225,150,1)', 'rgba(255,225,150,0)');
    const lamps = World.lampNodes.slice(0, 70);
    for (const it of lamps) {
      const px = it.x;
      const pz = it.y;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 26, 6), poleMat);
      pole.position.set(px, 13, pz);
      this.scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), bulbMat);
      bulb.position.set(px, 26, pz);
      this.scene.add(bulb);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false }));
      glow.scale.set(70, 70, 1);
      glow.position.set(px, 24, pz);
      this.scene.add(glow);
      this.lampGlows.push(glow);
    }

    const neonBuildings = [];
    for (let i = 0; i < 16 && World.buildings.length; i++) {
      neonBuildings.push(World.buildings[(Math.random() * World.buildings.length) | 0]);
    }
    for (const b of neonBuildings) {
      const rp = this.nearestRoadWorld(b.cx, b.cy);
      if (!rp) continue;
      const a = Math.atan2(rp[1] - b.cy, rp[0] - b.cx);
      const nx = b.cx + Math.cos(a) * 34;
      const nz = b.cy + Math.sin(a) * 34;
      const text = CFG.NEON_TEXTS[(Math.random() * CFG.NEON_TEXTS.length) | 0];
      const col = CFG.NEON_COLORS[(Math.random() * CFG.NEON_COLORS.length) | 0];
      const c = document.createElement('canvas');
      c.width = 256; c.height = 64;
      const g = c.getContext('2d');
      g.font = 'bold 34px Verdana, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = col;
      g.shadowBlur = 22;
      g.fillStyle = col;
      g.fillText(text, 128, 32);
      g.fillText(text, 128, 32);
      const tex = new THREE.CanvasTexture(c);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      spr.scale.set(64, 16, 1);
      spr.position.set(nx, 22, nz);
      this.scene.add(spr);
    }
  },

  nearestRoadWorld(x, y) {
    let bd = Infinity, bp = null;
    for (const w of World.roadWays) {
      for (const p of w.pts) {
        const d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
        if (d < bd) { bd = d; bp = p; }
      }
    }
    return bp;
  },

  makeFacadeTexture(variant) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    if (variant === 1) {
      g.fillStyle = '#aebfc9';
      g.fillRect(0, 0, 128, 256);
      for (let y = 0; y < 256; y += 32) {
        g.fillStyle = '#33465a';
        g.fillRect(0, y + 6, 128, 20);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(0, y + 6, 128, 4);
      }
    } else {
      g.fillStyle = variant === 2 ? '#cccccc' : '#d4d4d4';
      g.fillRect(0, 0, 128, 256);
      g.fillStyle = 'rgba(0,0,0,0.10)';
      for (let y = 0; y < 256; y += 8) g.fillRect(0, y, 128, 1);
      const cols = variant === 2 ? 4 : 4, rows = variant === 2 ? 8 : 8;
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const x = 8 + col * 30, y = 12 + r * 30;
          g.fillStyle = Math.random() < (variant === 2 ? 0.2 : 0.14) ? '#ffdf9a' : '#2a3646';
          g.fillRect(x, y, 20, 18);
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.fillRect(x, y, 20, 4);
          if (variant === 2) {
            g.fillStyle = 'rgba(0,0,0,0.25)';
            g.fillRect(x, y + 18, 20, 4);
          }
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  },

  radialTexture(inner, outer) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, outer);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  },

  buildParticles() {
    const max = 400;
    this.pointPos = new Float32Array(max * 3);
    this.pointCol = new Float32Array(max * 3);
    this.pointGeo = new THREE.BufferGeometry();
    this.pointGeo.setAttribute('position', new THREE.BufferAttribute(this.pointPos, 3));
    this.pointGeo.setAttribute('color', new THREE.BufferAttribute(this.pointCol, 3));
    this.points = new THREE.Points(this.pointGeo, new THREE.PointsMaterial({
      size: 6, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false
    }));
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  },

  buildPlayer() {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(4.5, 8, 4, 8), new THREE.MeshLambertMaterial({ color: 0x2456d6 }));
    body.position.y = 9;
    grp.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), new THREE.MeshLambertMaterial({ color: 0xf0c8a0 }));
    head.position.y = 17;
    grp.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(9, 2, 2), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    gun.position.set(6, 10, 0);
    grp.add(gun);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(9, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.15;
    grp.add(shadow);
    this.scene.add(grp);
    this.playerMesh = grp;
    const mark = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 4), new THREE.MeshBasicMaterial({ color: 0xffe63c }));
    this.scene.add(mark);
    this.marker = mark;
  },

  makeCarMesh(car) {
    const grp = new THREE.Group();
    const base = car.type === 'police' ? 0x1c2f66 : new THREE.Color(car.color).getHex();
    const bodyMat = new THREE.MeshLambertMaterial({ color: base });
    const body = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 22), bodyMat);
    body.position.y = 8;
    grp.add(body);
    if (car.type === 'police') {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(34, 5, 22.4), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
      stripe.position.y = 8;
      grp.add(stripe);
    }
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(22, 7, 18), new THREE.MeshLambertMaterial({ color: 0x1a2430 }));
    cabin.position.set(-3, 15.5, 0);
    grp.add(cabin);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x15181d });
    for (const [wx, wz] of [[-14, -8], [-14, 8], [14, -8], [14, 8]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 3.4, 10), wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 3.6, wz);
      grp.add(w);
    }
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
    for (const wz of [-7, 7]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 4), hlMat);
      hl.position.set(23.2, 8, wz);
      grp.add(hl);
    }
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
    for (const wz of [-7, 7]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 4), tlMat);
      tl.position.set(-23.2, 8, wz);
      grp.add(tl);
    }
    let barRed = null, barBlue = null;
    if (car.type === 'police') {
      barRed = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      barRed.position.set(-1, 20, -4.5);
      grp.add(barRed);
      barBlue = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      barBlue.position.set(-1, 20, 4.5);
      grp.add(barBlue);
    }
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(15, 100, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    cone.rotation.z = -Math.PI / 2;
    cone.position.set(70, 7, 0);
    grp.add(cone);
    this.headlightCons.push(cone.material);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(26, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.15;
    grp.add(shadow);
    grp.userData = { barRed, barBlue, cone };
    this.scene.add(grp);
    return grp;
  },

  makeBikeMesh(b) {
    const grp = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 2.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    frame.position.y = 5.5;
    grp.add(frame);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const wx of [-7, 7]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 1.6, 10), wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 3.4, 0);
      grp.add(w);
    }
    const rider = new THREE.Mesh(new THREE.CapsuleGeometry(3, 6, 4, 8), new THREE.MeshLambertMaterial({ color: new THREE.Color(b.color) }));
    rider.position.y = 11.5;
    grp.add(rider);
    const box = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 5), new THREE.MeshLambertMaterial({ color: 0xb08a4f }));
    box.position.set(-9, 8, 0);
    grp.add(box);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(9, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.15;
    grp.add(shadow);
    this.scene.add(grp);
    return grp;
  },

  makePedMesh(ped) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(3.4, 7, 4, 8), new THREE.MeshLambertMaterial({ color: new THREE.Color(ped.color) }));
    body.position.y = 8.5;
    grp.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
    head.position.y = 16;
    grp.add(head);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(6, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.15;
    grp.add(shadow);
    this.scene.add(grp);
    return grp;
  },

  syncEntities() {
    const t = Game.time;
    const night = Game.nightFactor();
    const seenCars = new Set();
    for (const car of Game.cars.concat(Game.police)) {
      if (car.dead) continue;
      seenCars.add(car);
      let m = this.carMeshes.get(car);
      if (!m) { m = this.makeCarMesh(car); this.carMeshes.set(car, m); }
      m.position.set(car.x, 0, car.y);
      m.rotation.y = -car.angle;
      if (m.userData.barRed) {
        const on = Math.floor(t * 8) % 2 === 0;
        m.userData.barRed.material.color.setHex(on ? 0xff2222 : 0x550000);
        m.userData.barBlue.material.color.setHex(on ? 0x2244ff : 0x000055);
      }
      m.userData.cone.material.opacity = night * 0.5;
    }
    for (const [car, m] of this.carMeshes) {
      if (!seenCars.has(car)) {
        this.scene.remove(m);
        this.carMeshes.delete(car);
      }
    }
    const seenBikes = new Set();
    for (const b of Game.bikes) {
      seenBikes.add(b);
      let m = this.bikeMeshes.get(b);
      if (!m) { m = this.makeBikeMesh(b); this.bikeMeshes.set(b, m); }
      m.position.set(b.x, 0, b.y);
      m.rotation.y = -b.angle;
    }
    for (const [b, m] of this.bikeMeshes) {
      if (!seenBikes.has(b)) { this.scene.remove(m); this.bikeMeshes.delete(b); }
    }
    const seenPeds = new Set();
    for (const ped of Game.peds) {
      if (ped.dead) continue;
      seenPeds.add(ped);
      let m = this.pedMeshes.get(ped);
      if (!m) { m = this.makePedMesh(ped); this.pedMeshes.set(ped, m); }
      m.position.set(ped.x, 0, ped.y);
      m.rotation.y = -ped.angle;
    }
    for (const [ped, m] of this.pedMeshes) {
      if (!seenPeds.has(ped)) {
        this.scene.remove(m);
        this.pedMeshes.delete(ped);
      }
    }
    const p = Game.player;
    const pe = p.inCar || p;
    this.playerMesh.visible = !p.inCar;
    this.playerMesh.position.set(p.x, 0, p.y);
    this.playerMesh.rotation.y = -p.angle;
    this.marker.visible = true;
    this.marker.position.set(pe.x, (p.inCar ? 34 : 26) + Math.sin(t * 4) * 3, pe.y);
    this.marker.rotation.y = t * 2;
    let bi = 0;
    for (const b of Game.bullets) {
      if (bi >= this.bulletPool.length) break;
      const m = this.bulletPool[bi++];
      m.visible = true;
      m.position.set(b.x, 7, b.y);
      m.rotation.y = -Math.atan2(b.vy, b.vx);
    }
    for (; bi < this.bulletPool.length; bi++) this.bulletPool[bi].visible = false;
    let n = Math.min(Game.particles.length, 400);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const pt = Game.particles[i];
      this.pointPos[i * 3] = pt.x;
      this.pointPos[i * 3 + 1] = 3;
      this.pointPos[i * 3 + 2] = pt.y;
      col.set(pt.color);
      const f = clamp(pt.life / pt.maxLife, 0, 1);
      this.pointCol[i * 3] = col.r * f;
      this.pointCol[i * 3 + 1] = col.g * f;
      this.pointCol[i * 3 + 2] = col.b * f;
    }
    this.pointGeo.setDrawRange(0, n);
    this.pointGeo.attributes.position.needsUpdate = true;
    this.pointGeo.attributes.color.needsUpdate = true;
    for (const g of this.lampGlows) g.material.opacity = night * 0.85;
  },

  updateSky() {
    const dayT = Game.dayT;
    const e = (dayT - 0.25) * Math.PI * 2;
    const elev = Math.sin(e);
    const day = clamp(elev, 0, 1);
    const night = clamp(-elev, 0, 1);
    const sky = new THREE.Color();
    const dayC = new THREE.Color(0x87c5e8);
    const setC = new THREE.Color(0xff8a5c);
    const nightC = new THREE.Color(0x0b0b26);
    if (elev > 0) sky.lerpColors(setC, dayC, clamp(elev / 0.5, 0, 1));
    else sky.lerpColors(nightC, setC, clamp(1 + elev / 0.35, 0, 1));
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    const sunPos = new THREE.Vector3(Math.cos(e), Math.max(elev, 0.06), 0.4).normalize().multiplyScalar(1600).add(new THREE.Vector3(1800, 0, 1800));
    this.sun.position.copy(sunPos);
    this.sun.target.position.set(1800, 0, 1800);
    this.sun.intensity = elev > 0 ? 0.15 + day * 1.05 : 0.12;
    this.sun.color.lerpColors(new THREE.Color(0xff9a55), new THREE.Color(0xfff4e0), clamp(elev / 0.5, 0, 1));
    if (elev <= 0) this.sun.color.setHex(0x8899ff);
    this.hemi.intensity = 0.22 + day * 0.5;
    this.hemi.color.copy(sky).lerp(new THREE.Color(0xffffff), 0.4);
  },

  updateCamera(dt) {
    const p = Game.player;
    const pe = p.inCar || p;
    const ang = pe.angle + (this.camYaw || 0);
    const sp = p.inCar ? p.inCar.speedAbs() : Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const dist = (p.inCar ? 160 : 115) + sp * 0.14;
    const height = (p.inCar ? 88 : 72) + sp * 0.05;
    const tx = clamp(pe.x - Math.cos(ang) * dist, 60, World.W - 60);
    const tz = clamp(pe.y - Math.sin(ang) * dist, 60, World.H - 60);
    if (!this.camPos) this.camPos = new THREE.Vector3(tx, height, tz);
    const k = 1 - Math.pow(0.0004, dt);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (height - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(pe.x + Math.cos(ang) * 30, 10, pe.y + Math.sin(ang) * 30);
    const fovT = 62 + clamp(sp / CFG.CAR_MAXF, 0, 1) * 16;
    this.fov += (fovT - this.fov) * k;
    if (Math.abs(this.fov - this.camera.fov) > 0.1) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  },

  render(dt) {
    if (!this.available) return;
    this.updateSky();
    this.syncEntities();
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
};
