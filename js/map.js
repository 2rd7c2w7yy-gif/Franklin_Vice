const World = {
  W: CFG.WORLD,
  H: CFG.WORLD,
  canvas: null,
  buildings: [],
  trees: [],
  neons: [],
  intersections: [],
  pois: {},
  respawn: { x: 3000, y: 2700 },
  forestGate: { x: 1800, y: 262 },
  streetNamesX: ['Bensheimer Straße', 'James-Monroe-Ring', 'Ledo-Straße', 'George-Sullivan-Ring', 'Birkenauer Straße', 'George-Washington-Straße'],
  streetNamesY: ['Wasserwerkstraße', 'Käfertaler Straße', 'Franklin-D.-Roosevelt-Straße', 'Viernheimer Straße', 'Im Rott', 'Speckweg'],

  roadHalfAt(y) { return y === CFG.B38_Y ? CFG.B38_HALF : CFG.ROAD_HALF; },

  build() {
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    const g = c.getContext('2d');
    this.canvas = c;
    this.paintBase(g);
    this.paintForest(g);
    this.paintBlocks(g);
    this.paintRoads(g);
    this.paintLabels(g);
    this.buildIntersections();
  },

  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp((n >> 16) + amt, 0, 255);
    const gch = clamp(((n >> 8) & 255) + amt, 0, 255);
    const b = clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + gch + ',' + b + ')';
  },

  speckle(g, x, y, w, h, n, alpha, size) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,' + alpha + ')' : 'rgba(255,255,255,' + alpha + ')';
      g.fillRect(x + Math.random() * w, y + Math.random() * h, size + Math.random() * size, size + Math.random() * size);
    }
  },

  paintBase(g) {
    g.fillStyle = CFG.PALETTE.sidewalk;
    g.fillRect(0, 0, this.W, this.H);
    g.strokeStyle = 'rgba(0,0,0,0.08)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= this.W; x += 26) { g.moveTo(x, 0); g.lineTo(x, this.H); }
    for (let y = 0; y <= this.H; y += 26) { g.moveTo(0, y); g.lineTo(this.W, y); }
    g.stroke();
    this.speckle(g, 0, 0, this.W, this.H, 9000, 0.05, 2);
  },

  paintForest(g) {
    const fh = CFG.ROAD_Y[0] - CFG.ROAD_HALF - 4;
    g.fillStyle = CFG.PALETTE.forest;
    g.fillRect(0, 0, this.W, fh);
    for (let i = 0; i < 130; i++) {
      const x = 20 + Math.random() * (this.W - 40);
      const y = 14 + Math.random() * (fh - 28);
      const r = 8 + Math.random() * 7;
      this.trees.push({ x, y, r });
      g.fillStyle = CFG.PALETTE.forestDark;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = 'rgba(90,160,80,0.8)';
      g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.font = 'bold 44px Verdana, sans-serif';
    g.textAlign = 'center';
    g.fillText('KÄFERTALER WALD', this.W / 2, fh / 2 + 14);
  },

  blockRect(i, j) {
    const left = i === 0 ? 0 : CFG.ROAD_X[i];
    const right = i === CFG.ROAD_X.length - 1 ? this.W : CFG.ROAD_X[i + 1];
    const top = j === 0 ? 0 : CFG.ROAD_Y[j];
    const bottom = j === CFG.ROAD_Y.length - 2 ? CFG.B38_Y - CFG.B38_HALF : CFG.ROAD_Y[j + 1];
    const x0 = left + (i === 0 ? 8 : CFG.ROAD_HALF + CFG.WALK);
    const x1 = right - (i === CFG.ROAD_X.length - 1 ? 8 : CFG.ROAD_HALF + CFG.WALK);
    const y0 = top + (j === 0 ? 8 : this.roadHalfAt(top) + CFG.WALK);
    const y1 = bottom - (j === CFG.ROAD_Y.length - 2 ? CFG.WALK : this.roadHalfAt(bottom) + CFG.WALK);
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  },

  paintBlocks(g) {
    const cols = CFG.ROAD_X.length;
    const rows = CFG.ROAD_Y.length - 1;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (j === 0) continue;
        const b = this.blockRect(i, j);
        if (b.w < 120 || b.h < 120) {
          g.fillStyle = CFG.PALETTE.grassDark;
          g.fillRect(b.x0, b.y0, b.w, b.h);
          continue;
        }
        if (i === 0 && j === 2) { this.paintStation(g, b); continue; }
        if (i === 2 && j === 2) { this.paintPlaza(g, b); continue; }
        if (i === 4 && j === 3) { this.paintKlinikum(g, b); continue; }
        if (i === 1 && j === 4) { this.paintFriedhof(g, b); continue; }
        if (Math.random() < 0.3) this.paintPark(g, b);
        else this.paintBuildings(g, b);
      }
    }
    this.paintQuarterLabels(g);
  },

  paintStation(g, b) {
    g.fillStyle = '#6f7278';
    g.fillRect(b.x0, b.y0, b.w, b.h);
    g.fillStyle = '#9aa0a8';
    g.fillRect(b.x0, b.y0 + 40, 60, b.h - 80);
    const bx = b.x0 + 70, by = b.y0 + 60, bw = Math.min(150, b.w - 90), bh = b.h - 120;
    g.fillStyle = '#b8452f';
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(bx + 8, by + 8, bw - 16, bh - 16);
    g.fillStyle = '#fff';
    g.font = 'bold 20px Verdana, sans-serif';
    g.textAlign = 'center';
    g.save();
    g.translate(bx + bw / 2, by + bh / 2);
    g.rotate(-Math.PI / 2);
    g.fillText('BAHNHOF KÄFERTAL', 0, 7);
    g.restore();
    this.buildings.push({ x: bx, y: by, w: bw, h: bh, color: '#b8452f' });
    this.pois.station = { x: CFG.ROAD_X[0], y: 1800, label: 'BAHNHOF KÄFERTAL' };
  },

  paintPlaza(g, b) {
    g.fillStyle = CFG.PALETTE.plaza;
    g.fillRect(b.x0, b.y0, b.w, b.h);
    this.speckle(g, b.x0, b.y0, b.w, b.h, 800, 0.06, 2);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    g.fillStyle = '#7fb2c9';
    g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.fill();
    g.fillStyle = '#cfd8dc';
    g.beginPath(); g.arc(cx, cy, 18, 0, 7); g.fill();
    this.trees.push({ x: cx, y: cy, r: 26, fountain: true });
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.font = 'bold 34px Verdana, sans-serif';
    g.textAlign = 'center';
    g.fillText('FRANKLIN MITTE', cx, b.y1 - 24);
    this.pois.plaza = { x: cx, y: cy + 110, label: 'FRANKLIN MITTE' };
    const neonDefs = [
      { t: 'CLOCKHOUSE', c: '#4fe3ff', x: b.x0 + 30, y: b.y0 + 26 },
      { t: 'LITTLE FRANKLIN', c: '#ff4fd8', x: b.x1 - 30, y: b.y0 + 26 },
      { t: 'RNV 16', c: '#ffe14f', x: b.x0 + 30, y: b.y1 - 14 },
      { t: 'GRAND CIRCLE', c: '#7dff6a', x: b.x1 - 30, y: b.y1 - 14 }
    ];
    for (const n of neonDefs) {
      g.fillStyle = n.c;
      g.font = 'bold 16px Verdana, sans-serif';
      g.fillText(n.t, n.x, n.y);
      this.neons.push({ x: n.x, y: n.y, text: n.t, color: n.c });
    }
  },

  paintKlinikum(g, b) {
    g.fillStyle = CFG.PALETTE.blockPave;
    g.fillRect(b.x0, b.y0, b.w, b.h);
    const bx = b.x0 + 24, by = b.y0 + 24, bw = b.w - 48, bh = b.h - 48;
    g.fillStyle = '#e8e8e8';
    g.fillRect(bx, by, bw, bh);
    g.strokeStyle = '#bbb';
    g.strokeRect(bx, by, bw, bh);
    g.fillStyle = '#d32f2f';
    const s = 26, cx = bx + bw / 2, cy = by + bh / 2;
    g.fillRect(cx - s / 2, cy - s * 1.4, s, s * 2.8);
    g.fillRect(cx - s * 1.4, cy - s / 2, s * 2.8, s);
    g.fillStyle = '#333';
    g.font = 'bold 24px Verdana, sans-serif';
    g.textAlign = 'center';
    g.fillText('KLINIKUM', cx, by + bh - 16);
    this.buildings.push({ x: bx, y: by, w: bw, h: bh, color: '#e8e8e8' });
    this.pois.klinikum = { x: 3000, y: 2700, label: 'KLINIKUM (Respawn)' };
  },

  paintFriedhof(g, b) {
    g.fillStyle = '#5c6b52';
    g.fillRect(b.x0, b.y0, b.w, b.h);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let r = 0; r < 8; r++) {
      for (let cc = 0; cc < 5; cc++) {
        const x = b.x0 + 40 + cc * (b.w - 80) / 4;
        const y = b.y0 + 40 + r * (b.h - 80) / 7;
        g.fillRect(x - 2, y - 6, 4, 12);
        g.fillRect(x - 5, y - 3, 10, 3);
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.font = 'bold 20px Verdana, sans-serif';
    g.textAlign = 'center';
    g.fillText('FRIEDHOF KÄFERTAL', (b.x0 + b.x1) / 2, b.y1 - 12);
    this.pois.friedhof = { x: 600, y: CFG.ROAD_Y[4], label: 'FRIEDHOF KÄFERTAL' };
  },

  paintPark(g, b) {
    g.fillStyle = CFG.PALETTE.grass;
    g.fillRect(b.x0, b.y0, b.w, b.h);
    this.speckle(g, b.x0, b.y0, b.w, b.h, 1200, 0.09, 3);
    const n = 5 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const x = b.x0 + 30 + Math.random() * (b.w - 60);
      const y = b.y0 + 30 + Math.random() * (b.h - 60);
      const r = 9 + Math.random() * 6;
      this.trees.push({ x, y, r });
      g.fillStyle = CFG.PALETTE.forestDark;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = 'rgba(110,180,90,0.85)';
      g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, 7); g.fill();
    }
  },

  paintBuildings(g, b) {
    g.fillStyle = CFG.PALETTE.blockPave;
    g.fillRect(b.x0, b.y0, b.w, b.h);
    const m = 18, gap = 12;
    const mode = Math.random();
    const rects = [];
    if (mode < 0.3) {
      rects.push({ x: b.x0 + m, y: b.y0 + m, w: b.w - 2 * m, h: b.h - 2 * m });
    } else if (mode < 0.65) {
      if (b.w > b.h) {
        const hw = (b.w - 2 * m - gap) / 2;
        rects.push({ x: b.x0 + m, y: b.y0 + m, w: hw, h: b.h - 2 * m });
        rects.push({ x: b.x0 + m + hw + gap, y: b.y0 + m, w: hw, h: b.h - 2 * m });
      } else {
        const hh = (b.h - 2 * m - gap) / 2;
        rects.push({ x: b.x0 + m, y: b.y0 + m, w: b.w - 2 * m, h: hh });
        rects.push({ x: b.x0 + m, y: b.y0 + m + hh + gap, w: b.w - 2 * m, h: hh });
      }
    } else {
      const hw = (b.w - 2 * m - gap) / 2, hh = (b.h - 2 * m - gap) / 2;
      rects.push({ x: b.x0 + m, y: b.y0 + m, w: hw, h: hh });
      rects.push({ x: b.x0 + m + hw + gap, y: b.y0 + m, w: hw, h: hh });
      rects.push({ x: b.x0 + m, y: b.y0 + m + hh + gap, w: hw, h: hh });
      rects.push({ x: b.x0 + m + hw + gap, y: b.y0 + m + hh + gap, w: hw, h: hh });
    }
    for (const r of rects) {
      if (r.w < 60 || r.h < 60) continue;
      const col = CFG.PALETTE.building[Math.floor(Math.random() * CFG.PALETTE.building.length)];
      g.fillStyle = this.shade(col, -22);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = this.shade(col, -40);
      g.fillRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12);
      const vents = 1 + Math.floor(Math.random() * 3);
      for (let v = 0; v < vents; v++) {
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(r.x + 12 + Math.random() * Math.max(4, r.w - 44), r.y + 12 + Math.random() * Math.max(4, r.h - 34), 12 + Math.random() * 18, 8 + Math.random() * 12);
      }
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(r.x + 6, r.y + 6, r.w - 12, 4);
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.strokeRect(r.x, r.y, r.w, r.h);
      r.color = col;
      this.buildings.push(r);
      if (Math.random() < 0.16 && this.neons.length < 26) {
        const t = CFG.NEON_TEXTS[Math.floor(Math.random() * CFG.NEON_TEXTS.length)];
        const c = CFG.NEON_COLORS[Math.floor(Math.random() * CFG.NEON_COLORS.length)];
        const nx = r.x + r.w / 2, ny = r.y + 14;
        g.fillStyle = c;
        g.font = 'bold 13px Verdana, sans-serif';
        g.textAlign = 'center';
        g.fillText(t, nx, ny);
        this.neons.push({ x: nx, y: ny, text: t, color: c });
      }
    }
  },

  paintQuarterLabels(g) {
    g.fillStyle = 'rgba(255,255,255,0.13)';
    g.font = 'bold 40px Verdana, sans-serif';
    g.textAlign = 'center';
    const labels = [
      ['OFFIZIERSSIEDLUNG', 620, 640],
      ['SULLIVAN', 1810, 640],
      ['FUNARI BARRACKS', 3010, 640],
      ['COLUMBUS', 3010, 1810],
      ['BENJAMIN FRANKLIN VILLAGE', 920, 2410]
    ];
    for (const [t, x, y] of labels) g.fillText(t, x, y);
  },

  paintRoads(g) {
    for (const x of CFG.ROAD_X) {
      g.fillStyle = CFG.PALETTE.asphalt;
      g.fillRect(x - CFG.ROAD_HALF, 0, CFG.ROAD_HALF * 2, this.H);
    }
    for (const y of CFG.ROAD_Y) {
      const half = this.roadHalfAt(y);
      g.fillStyle = y === CFG.B38_Y ? CFG.PALETTE.asphaltB38 : CFG.PALETTE.asphalt;
      g.fillRect(0, y - half, this.W, half * 2);
      this.speckle(g, 0, y - half, this.W, half * 2, 900, 0.07, 2);
    }
    for (const x of CFG.ROAD_X) {
      this.speckle(g, x - CFG.ROAD_HALF, 0, CFG.ROAD_HALF * 2, this.H, 900, 0.07, 2);
    }
    g.strokeStyle = CFG.PALETTE.lane;
    g.lineWidth = 3;
    g.setLineDash([26, 22]);
    for (const x of CFG.ROAD_X) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, this.H);
      g.stroke();
    }
    for (const y of CFG.ROAD_Y) {
      if (y === CFG.B38_Y) continue;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(this.W, y);
      g.stroke();
    }
    g.setLineDash([]);
    g.strokeStyle = '#e8e8e8';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, CFG.B38_Y - 6); g.lineTo(this.W, CFG.B38_Y - 6);
    g.moveTo(0, CFG.B38_Y + 6); g.lineTo(this.W, CFG.B38_Y + 6);
    g.stroke();
    for (const ix of CFG.ROAD_X) {
      for (const iy of CFG.ROAD_Y) {
        const half = this.roadHalfAt(iy);
        g.fillStyle = 'rgba(255,255,255,0.75)';
        for (let k = -2; k <= 2; k++) {
          g.fillRect(ix + k * 9 - 3, iy - half - 12, 6, 10);
          g.fillRect(ix + k * 9 - 3, iy + half + 2, 6, 10);
          g.fillRect(ix - CFG.ROAD_HALF - 12, iy + k * 9 - 3, 10, 6);
          g.fillRect(ix + CFG.ROAD_HALF + 2, iy + k * 9 - 3, 10, 6);
        }
      }
    }
  },

  paintLabels(g) {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.font = 'bold 17px Verdana, sans-serif';
    g.textAlign = 'center';
    CFG.ROAD_X.forEach((x, i) => {
      g.save();
      g.translate(x + 6, 620);
      g.rotate(-Math.PI / 2);
      g.fillText(this.streetNamesX[i], 0, 0);
      g.restore();
      g.save();
      g.translate(x + 6, 2500);
      g.rotate(-Math.PI / 2);
      g.fillText(this.streetNamesX[i], 0, 0);
      g.restore();
    });
    CFG.ROAD_Y.forEach((y, j) => {
      if (y === CFG.B38_Y) return;
      g.fillText(this.streetNamesY[j], 950, y - 8);
      g.fillText(this.streetNamesY[j], 2450, y - 8);
    });
    g.fillStyle = 'rgba(255,220,90,0.85)';
    g.font = 'bold 24px Verdana, sans-serif';
    g.fillText('B 38  →  INNENSTADT / VIERNHEIM', this.W / 2, CFG.B38_Y + 8);
  },

  buildIntersections() {
    this.intersections = [];
    for (const x of CFG.ROAD_X) {
      for (const y of CFG.ROAD_Y) {
        this.intersections.push({ x, y });
      }
    }
  },

  nearestIntersection(x, y, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const it of this.intersections) {
      const dx = it.x - x, dy = it.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  },

  randomRoadPoint(laneOff) {
    const vertical = Math.random() < 0.5;
    if (vertical) {
      const x = CFG.ROAD_X[Math.floor(Math.random() * CFG.ROAD_X.length)];
      const y = 120 + Math.random() * (this.H - 240);
      const dir = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      const rx = -Math.sin(dir) * laneOff, ry = Math.cos(dir) * laneOff;
      return { x: x + rx, y, angle: dir };
    }
    const y = CFG.ROAD_Y[Math.floor(Math.random() * CFG.ROAD_Y.length)];
    const x = 120 + Math.random() * (this.W - 240);
    const dir = Math.random() < 0.5 ? 0 : Math.PI;
    const rx = -Math.sin(dir) * laneOff, ry = Math.cos(dir) * laneOff;
    return { x, y: y + ry, angle: dir };
  },

  collideCircle(x, y, r) {
    let px = 0, py = 0, nx = 0, ny = 0, depth = 0;
    if (x < r) { px += r - x; nx = 1; ny = 0; depth = r - x; }
    if (x > this.W - r) { px += (this.W - r) - x; nx = -1; ny = 0; depth = x - (this.W - r); }
    if (y < r) { py += r - y; nx = 0; ny = 1; depth = Math.max(depth, r - y); }
    if (y > this.H - r) { py += (this.H - r) - y; nx = 0; ny = -1; depth = Math.max(depth, y - (this.H - r)); }
    const checkRect = (b) => {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      let dx = x - cx, dy = y - cy;
      let d2 = dx * dx + dy * dy;
      if (d2 >= r * r) return;
      let d = Math.sqrt(d2);
      if (d < 0.001) {
        const l = x - b.x, rt = b.x + b.w - x, t = y - b.y, bt = b.y + b.h - y;
        const m = Math.min(l, rt, t, bt);
        if (m === l) { dx = -1; dy = 0; d = 0; } else if (m === rt) { dx = 1; dy = 0; d = 0; }
        else if (m === t) { dx = 0; dy = -1; d = 0; } else { dx = 0; dy = 1; d = 0; }
        px += dx * (r + 0.1); py += dy * (r + 0.1);
        if (r > depth) { nx = dx; ny = dy; depth = r; }
      } else {
        const push = (r - d) + 0.1;
        px += (dx / d) * push; py += (dy / d) * push;
        if (push > depth) { nx = dx / d; ny = dy / d; depth = push; }
      }
    };
    for (const b of this.buildings) checkRect(b);
    for (const t of this.trees) {
      const dx = x - t.x, dy = y - t.y;
      const rr = r + t.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.001) {
        const d = Math.sqrt(d2);
        const push = (rr - d) + 0.1;
        px += (dx / d) * push; py += (dy / d) * push;
        if (push > depth) { nx = dx / d; ny = dy / d; depth = push; }
      }
    }
    if (depth > 0) return { x: px, y: py, nx, ny, depth };
    return null;
  },

  blocked(x, y, r) {
    if (x < r || x > this.W - r || y < r || y > this.H - r) return true;
    for (const b of this.buildings) {
      if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
    }
    for (const t of this.trees) {
      const dx = x - t.x, dy = y - t.y, rr = r + t.r;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }
};
