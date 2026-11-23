const World = {
  W: 3600,
  H: 3600,
  PAD: 170,
  CELL: 240,
  canvas: null,
  bbox: null,
  s: 1,
  mPerDegLon: 1,
  mPerDegLat: 1,
  roadWays: [],
  nodeMap: new Map(),
  nodePos: new Map(),
  greens: [],
  buildings: [],
  trees: [],
  pois: {},
  respawn: { x: 1800, y: 1800 },
  forestGate: { x: 1800, y: 300 },
  lampNodes: [],
  collHash: new Map(),

  ROAD_WIDTHS: { motorway: 64, motorway_link: 40, trunk: 60, trunk_link: 40, primary: 48, primary_link: 36, secondary: 44, secondary_link: 34, tertiary: 38, tertiary_link: 32, unclassified: 34, residential: 32, living_street: 30, service: 24, track: 18 },

  toWorld(lon, lat) {
    return { x: this.PAD + (lon - this.bbox[0]) * this.mPerDegLon * this.s, y: this.PAD + (this.bbox[3] - lat) * this.mPerDegLat * this.s };
  },

  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp((n >> 16) + amt, 0, 255);
    const g = clamp(((n >> 8) & 255) + amt, 0, 255);
    const b = clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  speckle(g, x, y, w, h, n, alpha, size) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,' + alpha + ')' : 'rgba(255,255,255,' + alpha + ')';
      g.fillRect(x + Math.random() * w, y + Math.random() * h, size + Math.random() * size, size + Math.random() * size);
    }
  },

  pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  },

  segClosest(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = clamp(t, 0, 1);
    const cx = ax + t * dx, cy = ay + t * dy;
    return { d: Math.hypot(px - cx, py - cy), cx, cy };
  },

  polyCollide(px, py, r, b) {
    const pts = b.pts;
    const inside = this.pointInPoly(px, py, pts);
    let bestD = Infinity, bx = 0, by = 0, nx = 0, ny = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[j], [cx, cy] = pts[i];
      const c = this.segClosest(px, py, ax, ay, cx, cy);
      if (c.d < bestD) {
        bestD = c.d; bx = c.cx; by = c.cy;
        const ex = cx - ax, ey = cy - ay;
        const el = Math.hypot(ex, ey) || 1;
        let mx = (py - by), my2 = -(px - bx);
        const ml = Math.hypot(mx, my2) || 1;
        nx = mx / ml; ny = my2 / ml;
        if ((b.cx - bx) * nx + (b.cy - by) * ny < 0) { nx = -nx; ny = -ny; }
      }
    }
    if (inside) return { depth: bestD + r + 0.1, nx, ny };
    if (bestD < r) return { depth: r - bestD + 0.1, nx, ny };
    return null;
  },

  build() {
    this.bbox = GEO.bbox;
    const midLat = (this.bbox[1] + this.bbox[3]) / 2 * Math.PI / 180;
    this.mPerDegLon = 111320 * Math.cos(midLat);
    this.mPerDegLat = 110540;
    const wM = (this.bbox[2] - this.bbox[0]) * this.mPerDegLon;
    const hM = (this.bbox[3] - this.bbox[1]) * this.mPerDegLat;
    this.s = (this.W - 2 * this.PAD) / Math.max(wM, hM);

    for (const rw of GEO.roads) {
      const pts = rw.p.map(([lon, lat]) => {
        const w = this.toWorld(lon, lat);
        return [w.x, w.y];
      });
      if (pts.length < 2) continue;
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const len = cum[cum.length - 1];
      if (len < 30) continue;
      const w = { pts, cum, len, cls: rw.c, name: rw.n, width: this.ROAD_WIDTHS[rw.c] || 28, a: rw.a, b: rw.b };
      this.roadWays.push(w);
      const idx = this.roadWays.length - 1;
      if (!this.nodeMap.has(rw.a)) this.nodeMap.set(rw.a, []);
      if (!this.nodeMap.has(rw.b)) this.nodeMap.set(rw.b, []);
      this.nodeMap.get(rw.a).push({ w: idx, end: 'a' });
      this.nodeMap.get(rw.b).push({ w: idx, end: 'b' });
      this.nodePos.set(rw.a, pts[0]);
      this.nodePos.set(rw.b, pts[pts.length - 1]);
    }

    for (const gn of GEO.greens) {
      const pts = gn.p.map(([lon, lat]) => {
        const w = this.toWorld(lon, lat);
        return [w.x, w.y];
      });
      this.greens.push({ kind: gn.k, name: gn.n, pts });
    }

    for (const bd of GEO.buildings) {
      const pts = bd.p.map(([lon, lat]) => {
        const w = this.toWorld(lon, lat);
        return [w.x, w.y];
      });
      if (pts.length < 3) continue;
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const col = CFG.PALETTE.building[Math.abs((cx * 13 + cy * 7) | 0) % CFG.PALETTE.building.length];
      this.buildings.push({ pts, color: col, cx, cy, name: bd.n });
    }

    let treeBudget = 320;
    for (const gn of this.greens) {
      if (gn.kind !== 'forest' && gn.kind !== 'park') continue;
      const xs = gn.pts.map(p => p[0]), ys = gn.pts.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const area = (x1 - x0) * (y1 - y0);
      const want = gn.kind === 'forest' ? clamp(Math.round(area / 2600), 12, 90) : clamp(Math.round(area / 9000), 3, 12);
      for (let i = 0; i < want && treeBudget > 0; i++) {
        const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
        if (!this.pointInPoly(x, y, gn.pts)) continue;
        this.trees.push({ x, y, r: 9 + Math.random() * 7 });
        treeBudget--;
      }
    }

    for (const pn of GEO.pois) {
      const rp = this.nearestRoadPoint(pn.lon, pn.lat);
      this.pois[pn.k] = { x: rp.x, y: rp.y, label: pn.n };
    }
    this.respawn = { x: this.pois.respawn.x, y: this.pois.respawn.y };

    let biggest = null, barea = 0;
    for (const gn of this.greens) {
      if (gn.kind !== 'forest') continue;
      const xs = gn.pts.map(p => p[0]), ys = gn.pts.map(p => p[1]);
      const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
      if (a > barea) { barea = a; biggest = gn; }
    }
    if (biggest) {
      const pc = this.pois.plaza;
      let best = null, bd = Infinity;
      for (let i = 0, j = biggest.pts.length - 1; i < biggest.pts.length; j = i++) {
        const c = this.segClosest(pc.x, pc.y, biggest.pts[j][0], biggest.pts[j][1], biggest.pts[i][0], biggest.pts[i][1]);
        if (c.d < bd) { bd = c.d; best = { x: c.cx, y: c.cy }; }
      }
      this.forestGate = best || { x: pc.x, y: pc.y - 400 };
      this.pois.gate = { x: this.forestGate.x, y: this.forestGate.y, label: 'KÄFERTALER WALD' };
    }
    let cem = null;
    for (const gn of this.greens) if (gn.kind === 'cemetery') { cem = gn; break; }
    if (cem) {
      const cx = cem.pts.reduce((s, p) => s + p[0], 0) / cem.pts.length;
      const cy = cem.pts.reduce((s, p) => s + p[1], 0) / cem.pts.length;
      const rp = this.nearestRoadPoint((this.bbox[0] + (cx - this.PAD) / (this.mPerDegLon * this.s)), (this.bbox[3] - (cy - this.PAD) / (this.mPerDegLat * this.s)));
      this.pois.friedhof = { x: rp.x, y: rp.y, label: 'FRIEDHOF' };
    } else {
      this.pois.friedhof = { x: this.pois.plaza.x + 300, y: this.pois.plaza.y + 300, label: 'FRIEDHOF' };
    }

    for (const [node, entries] of this.nodeMap) {
      if (entries.length >= 3) {
        const p = this.nodePos.get(node);
        if (p) this.lampNodes.push({ x: p[0] + 10, y: p[1] + 10 });
      }
    }

    this.buildHash();
    this.paint();
  },

  buildHash() {
    this.collHash = new Map();
    const put = (idx, x0, y0, x1, y1, isTree) => {
      const cx0 = Math.floor(x0 / this.CELL), cx1 = Math.floor(x1 / this.CELL);
      const cy0 = Math.floor(y0 / this.CELL), cy1 = Math.floor(y1 / this.CELL);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cy = cy0; cy <= cy1; cy++) {
          const k = cx + ',' + cy;
          if (!this.collHash.has(k)) this.collHash.set(k, []);
          this.collHash.get(k).push({ i: idx, t: isTree });
        }
      }
    };
    this.buildings.forEach((b, i) => {
      const xs = b.pts.map(p => p[0]), ys = b.pts.map(p => p[1]);
      put(i, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), false);
    });
    this.trees.forEach((t, i) => put(this.buildings.length + i, t.x - t.r, t.y - t.r, t.x + t.r, t.y + t.r, true));
  },

  hashCells(x, y, r) {
    const out = [];
    const cx0 = Math.floor((x - r) / this.CELL), cx1 = Math.floor((x + r) / this.CELL);
    const cy0 = Math.floor((y - r) / this.CELL), cy1 = Math.floor((y + r) / this.CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const c = this.collHash.get(cx + ',' + cy);
        if (c) for (const e of c) out.push(e);
      }
    }
    return out;
  },

  pointAt(w, d) {
    d = clamp(d, 0, w.len);
    let lo = 0, hi = w.cum.length - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (w.cum[mid] <= d) lo = mid; else hi = mid; }
    const segLen = (w.cum[lo + 1] - w.cum[lo]) || 1;
    const t = clamp((d - w.cum[lo]) / segLen, 0, 1);
    const a = w.pts[lo], b = w.pts[lo + 1];
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  },

  newWalker() {
    const i = (Math.random() * this.roadWays.length) | 0;
    return { w: i, dir: Math.random() < 0.5 ? 1 : -1, d: Math.random() * this.roadWays[i].len };
  },

  advanceWalker(wk, dist) {
    let rem = dist;
    let guard = 0;
    while (rem > 0 && guard++ < 10) {
      const way = this.roadWays[wk.w];
      const target = wk.dir > 0 ? way.len : 0;
      const space = Math.abs(target - wk.d);
      if (rem <= space) { wk.d += wk.dir * rem; rem = 0; break; }
      rem -= space;
      wk.d = target;
      const node = wk.dir > 0 ? way.b : way.a;
      const opts = (this.nodeMap.get(node) || []).filter(e => e.w !== wk.w);
      if (!opts.length) { wk.dir *= -1; continue; }
      const e = opts[(Math.random() * opts.length) | 0];
      wk.w = e.w;
      if (e.end === 'a') { wk.dir = 1; wk.d = 0; } else { wk.dir = -1; wk.d = this.roadWays[e.w].len; }
    }
  },

  walkerPoint(wk, off) {
    const p = this.pointAt(this.roadWays[wk.w], wk.d);
    const a = p.ang + (wk.dir < 0 ? Math.PI : 0);
    return { x: p.x + -Math.sin(a) * off, y: p.y + Math.cos(a) * off, angle: a };
  },

  laneOff(w) { return Math.max(9, w.width * 0.28); },
  sidewalkOff(w) { return w.width / 2 + 7; },

  randomRoadPoint(sidewalk) {
    const wk = this.newWalker();
    const w = this.roadWays[wk.w];
    return this.walkerPoint(wk, sidewalk ? this.sidewalkOff(w) : this.laneOff(w));
  },

  randomRoadPointFar(x, y, minDist) {
    for (let i = 0; i < 30; i++) {
      const p = this.randomRoadPoint(false);
      if (dist(p.x, p.y, x, y) > minDist) return p;
    }
    return this.randomRoadPoint(false);
  },

  randomRoadPointNear(x, y, maxDist) {
    for (let i = 0; i < 30; i++) {
      const p = this.randomRoadPoint(false);
      if (dist(p.x, p.y, x, y) < maxDist) return p;
    }
    return this.randomRoadPoint(false);
  },

  nearestRoadPoint(lon, lat) {
    const p = this.toWorld(lon, lat);
    let best = null, bd = Infinity, bw = null, bdAt = 0;
    for (const w of this.roadWays) {
      for (let i = 0; i < w.pts.length; i++) {
        const d = (w.pts[i][0] - p.x) * (w.pts[i][0] - p.x) + (w.pts[i][1] - p.y) * (w.pts[i][1] - p.y);
        if (d < bd) { bd = d; best = w.pts[i]; bw = w; bdAt = w.cum[i]; }
      }
    }
    if (!bw) return { x: p.x, y: p.y, angle: 0 };
    const wk = { w: this.roadWays.indexOf(bw), dir: 1, d: bdAt };
    return this.walkerPoint(wk, 0);
  },

  collideCircle(x, y, r) {
    let px = 0, py = 0, nx = 0, ny = 0, depth = 0;
    if (x < r) { px += r - x; nx = 1; ny = 0; depth = r - x; }
    if (x > this.W - r) { px += (this.W - r) - x; nx = -1; ny = 0; depth = x - (this.W - r); }
    if (y < r) { py += r - y; nx = 0; ny = 1; depth = Math.max(depth, r - y); }
    if (y > this.H - r) { py += (this.H - r) - y; nx = 0; ny = -1; depth = Math.max(depth, y - (this.H - r)); }
    for (const e of this.hashCells(x, y, r)) {
      if (e.t) {
        const t = this.trees[e.i - this.buildings.length];
        const dx = x - t.x, dy = y - t.y;
        const rr = r + t.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.001) {
          const d = Math.sqrt(d2);
          const push = (rr - d) + 0.1;
          px += (dx / d) * push; py += (dy / d) * push;
          if (push > depth) { nx = dx / d; ny = dy / d; depth = push; }
        }
      } else {
        const c = this.polyCollide(x, y, r, this.buildings[e.i]);
        if (c) {
          px += c.nx * c.depth; py += c.ny * c.depth;
          if (c.depth > depth) { nx = c.nx; ny = c.ny; depth = c.depth; }
        }
      }
    }
    if (depth > 0) return { x: px, y: py, nx, ny, depth };
    return null;
  },

  blocked(x, y, r) {
    if (x < r || x > this.W - r || y < r || y > this.H - r) return true;
    for (const e of this.hashCells(x, y, r)) {
      if (e.t) {
        const t = this.trees[e.i - this.buildings.length];
        const dx = x - t.x, dy = y - t.y, rr = r + t.r;
        if (dx * dx + dy * dy < rr * rr) return true;
      } else {
        const b = this.buildings[e.i];
        if (this.pointInPoly(x, y, b.pts)) return true;
        for (let i = 0, j = b.pts.length - 1; i < b.pts.length; j = i++) {
          if (this.segClosest(x, y, b.pts[j][0], b.pts[j][1], b.pts[i][0], b.pts[i][1]).d < r) return true;
        }
      }
    }
    return false;
  },

  paint() {
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    const g = c.getContext('2d');
    this.canvas = c;

    g.fillStyle = '#77894f';
    g.fillRect(0, 0, this.W, this.H);
    this.speckle(g, 0, 0, this.W, this.H, 12000, 0.05, 2);

    const greenCols = { forest: '#2e5d2a', park: '#5d8a4a', grass: '#6f9450', cemetery: '#5c6b52' };
    for (const gn of this.greens) {
      g.fillStyle = greenCols[gn.kind] || '#6f9450';
      g.beginPath();
      g.moveTo(gn.pts[0][0], gn.pts[0][1]);
      for (let i = 1; i < gn.pts.length; i++) g.lineTo(gn.pts[i][0], gn.pts[i][1]);
      g.closePath();
      g.fill();
      if (gn.kind === 'forest') {
        const xs = gn.pts.map(p => p[0]), ys = gn.pts.map(p => p[1]);
        this.speckle(g, Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 500, 0.12, 3);
      }
    }

    g.strokeStyle = '#4a4a4a';
    g.lineWidth = 5;
    for (const rail of GEO.rails) {
      const pts = rail.map(([lon, lat]) => this.toWorld(lon, lat));
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    }

    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const w of this.roadWays) {
      g.strokeStyle = '#8f939b';
      g.lineWidth = w.width + 18;
      this.strokeWay(g, w);
    }
    for (const w of this.roadWays) {
      const big = w.width >= 44;
      g.strokeStyle = big ? '#2c2f34' : '#33363c';
      g.lineWidth = w.width;
      this.strokeWay(g, w);
    }
    g.setLineDash([20, 18]);
    for (const w of this.roadWays) {
      if (w.width < 22) continue;
      g.strokeStyle = w.width >= 44 ? '#e8e8e8' : '#d8c84a';
      g.lineWidth = 3;
      this.strokeWay(g, w);
    }
    g.setLineDash([]);
    for (const [node, entries] of this.nodeMap) {
      if (entries.length < 3) continue;
      const p = this.nodePos.get(node);
      if (!p) continue;
      let mw = 0;
      for (const e of entries) mw = Math.max(mw, this.roadWays[e.w].width);
      g.fillStyle = '#33363c';
      g.beginPath();
      g.arc(p[0], p[1], mw * 0.55, 0, 7);
      g.fill();
    }

    for (const b of this.buildings) {
      g.fillStyle = b.color;
      g.beginPath();
      g.moveTo(b.pts[0][0], b.pts[0][1]);
      for (let i = 1; i < b.pts.length; i++) g.lineTo(b.pts[i][0], b.pts[i][1]);
      g.closePath();
      g.fill();
      g.fillStyle = this.shade(b.color.startsWith('#') ? b.color : '#999999', -40);
      g.beginPath();
      for (let i = 0; i < b.pts.length; i++) {
        const px = b.cx + (b.pts[i][0] - b.cx) * 0.82;
        const py = b.cy + (b.pts[i][1] - b.cy) * 0.82;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(b.pts[0][0], b.pts[0][1]);
      for (let i = 1; i < b.pts.length; i++) g.lineTo(b.pts[i][0], b.pts[i][1]);
      g.closePath();
      g.stroke();
    }

    for (const t of this.trees) {
      g.fillStyle = '#244a22';
      g.beginPath(); g.arc(t.x, t.y, t.r, 0, 7); g.fill();
      g.fillStyle = 'rgba(90,160,80,0.8)';
      g.beginPath(); g.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, 7); g.fill();
    }

    g.textAlign = 'center';
    for (const w of this.roadWays) {
      if (!w.name || w.len < 160) continue;
      if (/^B ?\d+|^A ?\d+/.test(w.name)) continue;
      const mid = this.pointAt(w, w.len / 2);
      g.save();
      g.translate(mid.x, mid.y);
      g.rotate(mid.ang);
      g.font = 'bold 16px Verdana, sans-serif';
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillText(w.name, 1, 5);
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillText(w.name, 0, 4);
      g.restore();
    }
    for (const w of this.roadWays) {
      if (!w.name || w.len < 200) continue;
      if (!/^B ?38|^A ?6/.test(w.name) && !(w.cls === 'trunk')) continue;
      const mid = this.pointAt(w, w.len / 2);
      g.save();
      g.translate(mid.x, mid.y);
      g.rotate(mid.ang);
      g.font = 'bold 24px Verdana, sans-serif';
      g.fillStyle = 'rgba(255,220,90,0.9)';
      g.fillText(w.name || 'B 38', 0, 8);
      g.restore();
    }

    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.font = 'bold 46px Verdana, sans-serif';
    const plaza = this.pois.plaza;
    g.fillText('FRANKLIN', plaza.x, plaza.y - 120);
    const kaef = this.toWorld(8.5935, 49.5085);
    g.fillText('KÄFERTAL', kaef.x, kaef.y);
    if (this.greens.length) {
      let biggest = null, barea = 0;
      for (const gn of this.greens) {
        if (gn.kind !== 'forest') continue;
        const xs = gn.pts.map(p => p[0]), ys = gn.pts.map(p => p[1]);
        const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
        if (a > barea) { barea = a; biggest = gn; }
      }
      if (biggest) {
        const cx = biggest.pts.reduce((s, p) => s + p[0], 0) / biggest.pts.length;
        const cy = biggest.pts.reduce((s, p) => s + p[1], 0) / biggest.pts.length;
        g.fillText('KÄFERTALER WALD', cx, cy);
      }
    }

    for (const key of ['station', 'wasserturm', 'respawn', 'plaza', 'friedhof', 'gate']) {
      const p = this.pois[key];
      if (!p) continue;
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.font = 'bold 17px Verdana, sans-serif';
      const wpx = g.measureText(p.label).width + 16;
      g.fillRect(p.x - wpx / 2, p.y - 46, wpx, 24);
      g.fillStyle = key === 'respawn' ? '#ff8a8a' : key === 'station' ? '#9ecbff' : '#fff';
      g.fillText(p.label, p.x, p.y - 29);
      if (key === 'wasserturm') {
        g.fillStyle = '#c9a86a';
        g.beginPath(); g.arc(p.x, p.y, 14, 0, 7); g.fill();
        g.strokeStyle = '#5a4632'; g.lineWidth = 3; g.stroke();
      }
      if (key === 'respawn') {
        g.fillStyle = '#d32f2f';
        g.fillRect(p.x - 4, p.y - 16, 8, 26);
        g.fillRect(p.x - 13, p.y - 8, 26, 8);
      }
      if (key === 'station') {
        g.fillStyle = '#b8452f';
        g.fillRect(p.x - 30, p.y - 12, 60, 20);
        g.strokeStyle = '#5a1f14'; g.lineWidth = 2; g.strokeRect(p.x - 30, p.y - 12, 60, 20);
      }
    }
  },

  strokeWay(g, w) {
    g.beginPath();
    g.moveTo(w.pts[0][0], w.pts[0][1]);
    for (let i = 1; i < w.pts.length; i++) g.lineTo(w.pts[i][0], w.pts[i][1]);
    g.stroke();
  }
};
