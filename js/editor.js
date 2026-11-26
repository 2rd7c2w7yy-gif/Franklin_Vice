const Editor = {
  img: null,
  exif: null,
  params: null,
  osm: null,
  rot: 0,

  readExif(buf) {
    try {
      const dv = new DataView(buf);
      if (dv.getUint16(0) !== 0xFFD8) return null;
      let off = 2;
      while (off < buf.byteLength - 4) {
        const marker = dv.getUint16(off);
        if ((marker & 0xFF00) !== 0xFF00) break;
        const len = dv.getUint16(off + 2);
        if (marker === 0xFFE1 && dv.getUint32(off + 4) === 0x45786966) {
          const tiff = off + 10;
          const le = dv.getUint16(tiff) === 0x4949;
          const rd16 = (o) => le ? dv.getUint16(o, true) : dv.getUint16(o);
          const rd32 = (o) => le ? dv.getUint32(o, true) : dv.getUint32(o);
          if (rd16(tiff + 2) !== 0x2A) return null;
          const ifd0 = tiff + rd32(tiff + 4);
          const n0 = rd16(ifd0);
          let gpsOff = 0, orient = 1;
          for (let i = 0; i < n0; i++) {
            const e = ifd0 + 2 + i * 12;
            const tag = rd16(e);
            if (tag === 0x8825) gpsOff = rd32(e + 8);
            if (tag === 0x0112) orient = rd16(e + 8) || 1;
          }
          let lat = null, lon = null;
          if (gpsOff) {
            const g = tiff + gpsOff;
            const ng = rd16(g);
            let latRef = 'N', lonRef = 'E';
            const vals = {};
            for (let i = 0; i < ng; i++) {
              const e = g + 2 + i * 12;
              const tag = rd16(e), typ = rd16(e + 2), cnt = rd32(e + 4), vo = rd32(e + 8);
              if (typ === 2 && cnt <= 4) {
                let s = '';
                for (let k = 0; k < cnt; k++) s += String.fromCharCode(dv.getUint8(e + 8 + k));
                if (tag === 1) latRef = s.replace(/\0.*$/, '').trim() || 'N';
                if (tag === 3) lonRef = s.replace(/\0.*$/, '').trim() || 'E';
              } else if (typ === 5 && (tag === 2 || tag === 4)) {
                const arr = [];
                for (let k = 0; k < Math.min(cnt, 3); k++) {
                  const p = tiff + vo + k * 8;
                  const den = rd32(p + 4);
                  arr.push(rd32(p) / (den || 1));
                }
                vals[tag] = arr;
              }
            }
            if (vals[2] && vals[4] && vals[2].length >= 3 && vals[4].length >= 3) {
              lat = vals[2][0] + vals[2][1] / 60 + vals[2][2] / 3600;
              if (latRef === 'S') lat = -lat;
              lon = vals[4][0] + vals[4][1] / 60 + vals[4][2] / 3600;
              if (lonRef === 'W') lon = -lon;
            }
          }
          return { lat, lon, orientation: orient };
        }
        off += 2 + len;
      }
    } catch (e) { return null; }
    return null;
  },

  toWorld(lon, lat) {
    const B = GEO.bbox;
    const midLat = (B[1] + B[3]) / 2 * Math.PI / 180;
    const mLon = 111320 * Math.cos(midLat), mLat = 110540;
    return { x: 170 + (lon - B[0]) * mLon * 0.92, y: 170 + (B[3] - lat) * mLat * 0.92, mLon, mLat };
  },

  osmNearest(lon, lat) {
    const p = Editor.toWorld(lon, lat);
    let best = null, bd = 1e9;
    for (const b of GEO.buildings) {
      if (!b.p || b.p.length < 3) continue;
      let cx = 0, cy = 0;
      const pts = b.p.map(q => { const w = Editor.toWorld(q[0], q[1]); cx += w.x; cy += w.y; return [w.x, w.y]; });
      cx /= pts.length; cy /= pts.length;
      const d = Math.hypot(cx - p.x, cy - p.y);
      if (d < bd) { bd = d; best = { b, pts, cx, cy }; }
    }
    if (!best || bd > 140) return null;
    let bl = 0, ang = 0;
    const pts = best.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (l > bl) { bl = l; ang = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]); }
    }
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    return { name: best.b.n || 'OSM-Gebäude', dist: bd, angle: ang, wM: (Math.max(...xs) - Math.min(...xs)) / 0.92, dM: (Math.max(...ys) - Math.min(...ys)) / 0.92, ptsLL: best.b.p };
  },

  analyze(img, mode) {
    const maxD = 440;
    const sc = Math.min(1, maxD / Math.max(img.width, img.height));
    const w = Math.max(16, Math.round(img.width * sc)), h = Math.max(16, Math.round(img.height * sc));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (Editor.exif && Editor.exif.orientation >= 5) {
      g.translate(w / 2, h / 2);
      g.rotate((Editor.exif.orientation % 4) * Math.PI / 2 * (Editor.exif.orientation >= 5 && Editor.exif.orientation <= 8 ? 1 : -1));
      if (Editor.exif.orientation === 6 || Editor.exif.orientation === 8) { /* handled by rotate */ }
      g.drawImage(img, -h / 2, -w / 2, h, w);
      if (Editor.exif.orientation >= 5) { const t = c.width; c.width = h; c.height = w; }
    } else {
      g.drawImage(img, 0, 0, w, h);
    }
    const g2 = c.getContext('2d');
    const W = c.width, H = c.height;
    const d = g2.getImageData(0, 0, W, H).data;
    const gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const gxm = new Float32Array(W * H), gym = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      gxm[i] = -gray[i - W - 1] - 2 * gray[i - 1] - gray[i + W - 1] + gray[i - W + 1] + 2 * gray[i + 1] + gray[i + W + 1];
      gym[i] = -gray[i - W - 1] - 2 * gray[i - W] - gray[i - W + 1] + gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1];
    }
    const rowE = new Float32Array(H), colE = new Float32Array(W);
    for (let y = 1; y < H - 1; y++) for (let x = Math.floor(W * 0.1); x < Math.ceil(W * 0.9); x++) rowE[y] += Math.abs(gym[y * W + x]);
    for (let x = 1; x < W - 1; x++) for (let y = Math.floor(H * 0.2); y < Math.ceil(H * 0.95); y++) colE[x] += Math.abs(gxm[y * W + x]);
    const smooth = (a, k) => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) { let s = 0, n = 0; for (let j = -k; j <= k; j++) { const q = i + j; if (q >= 0 && q < a.length) { s += a[q]; n++; } } o[i] = s / n; } return o; };
    const rs = smooth(rowE, 2), cs = smooth(colE, 2);
    const stats = (a) => { let m = 0, s = 0; for (const v of a) m += v; m /= a.length; for (const v of a) s += (v - m) * (v - m); return { mean: m, std: Math.sqrt(s / a.length) }; };
    const peaks = (a, minGap, thrF) => {
      const st = stats(a);
      const thr = st.mean + st.std * thrF;
      const out = [];
      for (let i = 0; i < a.length; i++) {
        if (a[i] < thr) continue;
        if (out.length && i - out[out.length - 1] < minGap) {
          if (a[i] > a[out[out.length - 1]]) out[out.length - 1] = i;
        } else out.push(i);
      }
      return out;
    };
    const floorPks = peaks(rs, Math.max(9, Math.round(H / 9)), 0.55);
    const colPksAll = peaks(cs, Math.max(6, Math.round(W / 24)), 0.3);
    const isDach = mode === 'dach' || (mode === 'auto' && floorPks.length < 3 && colPksAll.length < 3);
    const avg = (x0f, x1f, y0f, y1f) => {
      let r = 0, gg = 0, b = 0, n = 0;
      for (let y = Math.max(0, Math.floor(H * y0f)); y < Math.min(H, Math.ceil(H * y1f)); y++) for (let x = Math.max(0, Math.floor(W * x0f)); x < Math.min(W, Math.ceil(W * x1f)); x++) {
        const i = (y * W + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
      }
      if (!n) return '#cccccc';
      const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
      return '#' + hex(r) + hex(gg) + hex(b);
    };
    const avgAbs = (x0, x1, y0, y1) => {
      let r = 0, gg = 0, b = 0, n = 0;
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
        const i = (y * W + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
      }
      if (!n) return '#cccccc';
      const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
      return '#' + hex(r) + hex(gg) + hex(b);
    };
    let floors, wins, doors, roofColor, facade, roofVis = false, bWidthPx = W, roofDepthPx = 0;
    if (isDach) {
      floors = 1; wins = 0; doors = 0;
      facade = '#cfcfcf';
      roofColor = avg(0.1, 0.9, 0.1, 0.9);
    } else {
      const rowMax = Math.max(...rs);
      let bTop = Math.round(H * 0.2), topV = 0;
      for (let y = Math.floor(H * 0.04); y < Math.floor(H * 0.62); y++) if (rs[y] > topV) { topV = rs[y]; bTop = y; }
      let eave = -1, eaveV = 0;
      for (let y = bTop + 6; y < Math.min(H - 2, bTop + (H - bTop) * 0.65); y++) if (rs[y] > eaveV) { eaveV = rs[y]; eave = y; }
      const hasEave = eave > bTop && eaveV > rowMax * 0.22 && (eave - bTop) >= 5;
      let fBot = H - 2, fbV = 0;
      for (let y = Math.floor(H * 0.62); y < H - 1; y++) if (rs[y] > fbV) { fbV = rs[y]; fBot = y; }
      const facTop = hasEave ? eave + 3 : bTop + 3;
      const facBot = Math.max(facTop + 8, fBot - 2);
      const facRows = [];
      for (let y = facTop; y <= facBot; y++) facRows.push(rs[y]);
      const fPks = peaks(new Float32Array(facRows), Math.max(9, Math.round(H / 9)), 0.4);
      floors = Math.max(2, Math.min(8, fPks.length + 1));
      let band = new Float32Array(W);
      for (let x = 1; x < W - 1; x++) for (let y = facTop; y <= facBot; y++) band[x] += Math.abs(gxm[y * W + x]);
      const bs = smooth(band, 2);
      const winPks = peaks(bs, Math.max(6, Math.round(W / 24)), 0.3);
      wins = Math.max(1, Math.min(8, Math.round(winPks.length / 2)));
      const strong = [];
      for (const p of winPks) if (bs[p] > Math.max(...bs) * 0.35) strong.push(p);
      bWidthPx = strong.length >= 2 ? Math.max(...strong) - Math.min(...strong) : W * 0.8;
      let darkCols = 0;
      const dTop = fBot - (fBot - facTop) * 0.28;
      for (let x = Math.floor(W * 0.3); x < Math.ceil(W * 0.7); x++) {
        let m = 0, n = 0;
        for (let y = Math.max(0, Math.round(dTop)); y < H - 1; y++) { m += gray[y * W + x]; n++; }
        if (n && m / n < stats(gray).mean - 28) darkCols++;
      }
      doors = darkCols > W * 0.06 ? 2 : 1;
      facade = avgAbs(W * 0.15, W * 0.85, facTop + (facBot - facTop) * 0.2, facBot - 2);
      if (hasEave) {
        roofColor = avgAbs(W * 0.15, W * 0.85, bTop + 1, eave - 1);
        roofDepthPx = eave - bTop;
        roofVis = roofDepthPx >= 6;
      } else {
        roofColor = FacadeLib.shade(facade, -50);
      }
    }
    return { facade, roofColor, floors, wins, doors, roofShape: 'flat', isDach, wM: 15, dM: 8, hM: floors * 3, roofVis, bWidthPx, roofDepthPx };
  },

  currentParams() {
    const p = Editor.params || {};
    return {
      facade: document.getElementById('pFacade').value,
      roofColor: document.getElementById('pRoof').value,
      floors: Math.max(1, Math.min(8, parseInt(document.getElementById('pFloors').value) || 1)),
      wins: Math.max(0, Math.min(8, parseInt(document.getElementById('pWins').value) || 0)),
      doors: Math.max(0, Math.min(2, parseInt(document.getElementById('pDoors').value) || 0)),
      roofShape: document.getElementById('pRoofShape').value,
      wM: Math.max(4, Math.min(60, parseFloat(document.getElementById('pW').value) || 15)),
      dM: Math.max(4, Math.min(40, parseFloat(document.getElementById('pD').value) || 8)),
      hM: Math.max(3, Math.min(30, (Math.max(1, parseInt(document.getElementById('pFloors').value) || 1)) * 3)),
      roofVis: !!(Editor.params && Editor.params.roofVis),
      bWidthPx: (Editor.params && Editor.params.bWidthPx) || 0,
      roofDepthPx: (Editor.params && Editor.params.roofDepthPx) || 0,
      camAngle: Math.max(10, Math.min(80, parseFloat(document.getElementById('pAngle').value) || 30))
    };
  },

  suggestDepth() {
    const p = Editor.params;
    if (!p || !p.roofVis || !p.bWidthPx || p.bWidthPx < 20) return null;
    const ang = (Math.max(10, Math.min(80, parseFloat(document.getElementById('pAngle').value) || 30))) * Math.PI / 180;
    const wM = Math.max(4, parseFloat(document.getElementById('pW').value) || 15);
    return p.roofDepthPx / p.bWidthPx * wM / Math.sin(ang);
  },

  refreshPreview() {
    const f = Editor.currentParams();
    Editor.params = f;
    const cv = document.getElementById('prevCv');
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    FacadeLib.drawPreview(g, f, 30, 40, 300, 7);
  },

  getEdits() {
    try { const a = JSON.parse(localStorage.getItem('fve_edits') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  },

  renderEdits() {
    const el = document.getElementById('editsList');
    const edits = Editor.getEdits();
    if (!edits.length) { el.textContent = '— noch keine eigenen Gebäude gespeichert —'; return; }
    el.innerHTML = '';
    edits.forEach((b, i) => {
      const row = document.createElement('div');
      const cx = b.p.reduce((s, q) => s + q[0], 0) / b.p.length, cy = b.p.reduce((s, q) => s + q[1], 0) / b.p.length;
      row.textContent = '🏠 ' + (b.n || 'Eigenes Gebäude') + ' — ' + (b.facade ? b.facade.wM + '×' + b.facade.dM + ' m, ' + b.facade.floors + ' Etagen' : '') + ' @ ' + cy.toFixed(5) + ', ' + cx.toFixed(5);
      const del = document.createElement('button');
      del.textContent = 'löschen';
      del.className = 'gray';
      del.style.cssText = 'padding:2px 8px; font-size:11px; margin-left:8px';
      del.onclick = () => {
        const a = Editor.getEdits();
        a.splice(i, 1);
        localStorage.setItem('fve_edits', JSON.stringify(a));
        Editor.renderEdits();
      };
      const re = document.createElement('button');
      re.textContent = 'neu platzieren';
      re.className = 'gray';
      re.style.cssText = 'padding:2px 8px; font-size:11px; margin-left:4px';
      re.onclick = () => {
        const a = Editor.getEdits();
        const b2 = a.splice(i, 1)[0];
        localStorage.setItem('fve_edits', JSON.stringify(a));
        const f = b2.facade || {};
        let rot = 0;
        if (b2.p.length >= 2) rot = Math.atan2(b2.p[1][1] - b2.p[0][1], b2.p[1][0] - b2.p[0][0]);
        const cxw = b2.p.reduce((s, q) => s + q[0], 0) / b2.p.length, cyw = b2.p.reduce((s, q) => s + q[1], 0) / b2.p.length;
        localStorage.setItem('fve_pending', JSON.stringify({ name: b2.n, facade: f, rot, lon: cxw, lat: cyw }));
        location.href = 'index.html?edit=1&mode=2d';
      };
      row.appendChild(del);
      row.appendChild(re);
      el.appendChild(row);
    });
  },

  loadFile(file) {
    const rd = new FileReader();
    rd.onload = () => {
      Editor.exif = Editor.readExif(rd.result);
      const img = new Image();
      img.onload = () => {
        Editor.img = img;
        const buf = rd.result;
        let info = 'Foto geladen: ' + img.width + '×' + img.height + ' px';
        if (Editor.exif && Editor.exif.lat != null) {
          info += '\n📍 EXIF-GPS: ' + Editor.exif.lat.toFixed(6) + ', ' + Editor.exif.lon.toFixed(6);
          Editor.osm = Editor.osmNearest(Editor.exif.lon, Editor.exif.lat);
          if (Editor.osm) {
            info += '\n🗺 OSM-Abgleich: „' + Editor.osm.name + '“ in ' + Math.round(Editor.osm.dist * 1.087) + ' m — Grundriss ' + Editor.osm.wM.toFixed(1) + '×' + Editor.osm.dM.toFixed(1) + ' m, Richtung ' + Math.round(Editor.osm.angle * 180 / Math.PI) + '°';
            Editor.rot = Editor.osm.angle;
          } else info += '\n🗺 OSM-Abgleich: kein Gebäude in der Nähe gefunden (nur manuelle Platzierung)';
        } else info += '\n📍 Kein EXIF-GPS im Foto — Ausrichtung manuell in der Karte (oder OSM-Grundriss per Hand)';
        document.getElementById('info').textContent = info;
        const mode = document.getElementById('pMode').value;
        Editor.params = Editor.analyze(img, mode === 'auto' ? 'auto' : mode);
        document.getElementById('pFloors').value = Editor.params.floors;
        document.getElementById('pWins').value = Editor.params.wins;
        document.getElementById('pDoors').value = Editor.params.doors;
        document.getElementById('pFacade').value = Editor.params.facade;
        document.getElementById('pRoof').value = Editor.params.roofColor;
        if (Editor.osm) {
          document.getElementById('pW').value = Math.round(Editor.osm.wM * 2) / 2;
          document.getElementById('pD').value = Math.round(Editor.osm.dM * 2) / 2;
        }
        document.getElementById('osmBox').style.display = Editor.osm ? 'block' : 'none';
        if (Editor.osm) document.getElementById('osmInfo').textContent = 'OSM: „' + Editor.osm.name + '“ — ' + Editor.osm.wM.toFixed(1) + '×' + Editor.osm.dM.toFixed(1) + ' m, ' + Math.round(Editor.osm.angle * 180 / Math.PI) + '°';
        if (Editor.params.roofVis && !Editor.osm) {
          const dEst = Editor.suggestDepth();
          if (dEst) {
            document.getElementById('pD').value = Math.round(Math.max(4, Math.min(40, dEst)) * 2) / 2;
            info += '\n📐 Schrägansicht: Dach sichtbar (' + Editor.params.roofDepthPx + ' px Dachhöhe bei ' + Editor.params.bWidthPx.toFixed(0) + ' px Hausbreite) → Tiefe geschätzt: ' + dEst.toFixed(1) + ' m (bei ' + (parseFloat(document.getElementById('pAngle').value) || 30) + '° Kamerawinkel) — anpassbar';
          }
        } else if (Editor.params.roofVis) info += '\n📐 Schrägansicht erkannt (Dach sichtbar) — OSM-Grundriss hat Vorrang, sonst Tiefe manuell';
        document.getElementById('info').textContent = info;
        document.getElementById('analyzePanel').style.display = 'block';
        const scv = document.getElementById('srcCv');
        const sg = scv.getContext('2d');
        sg.clearRect(0, 0, scv.width, scv.height);
        const sc = Math.min(1, scv.width / img.width, scv.height / img.height);
        sg.drawImage(img, (scv.width - img.width * sc) / 2, (scv.height - img.height * sc) / 2, img.width * sc, img.height * sc);
        Editor.refreshPreview();
      };
      const rd2 = new FileReader();
      rd2.onload = (e2) => { img.src = e2.target.result; };
      rd2.readAsDataURL(file);
    };
    rd.readAsArrayBuffer(file);
  },

  init() {
    const drop = document.getElementById('drop');
    const file = document.getElementById('file');
    drop.onclick = () => file.click();
    file.onchange = () => { if (file.files[0]) Editor.loadFile(file.files[0]); };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      if (e.dataTransfer.files[0]) Editor.loadFile(e.dataTransfer.files[0]);
    };
    for (const id of ['pName', 'pW', 'pD', 'pFloors', 'pWins', 'pDoors', 'pRoofShape', 'pFacade', 'pRoof', 'pMode', 'pAngle']) {
      document.getElementById(id).addEventListener('input', () => {
        if (id === 'pMode' && Editor.img) {
          Editor.params = Editor.analyze(Editor.img, document.getElementById('pMode').value);
          document.getElementById('pFloors').value = Editor.params.floors;
          document.getElementById('pWins').value = Editor.params.wins;
          document.getElementById('pDoors').value = Editor.params.doors;
          document.getElementById('pFacade').value = Editor.params.facade;
          document.getElementById('pRoof').value = Editor.params.roofColor;
        }
        Editor.refreshPreview();
      });
    }
    document.getElementById('osmRot').onclick = () => { if (Editor.osm) { Editor.rot = Editor.osm.angle; document.getElementById('info').textContent += '\n↻ Ausrichtung übernommen: ' + Math.round(Editor.rot * 180 / Math.PI) + '°'; } };
    document.getElementById('osmFoot').onclick = () => {
      if (!Editor.osm) return;
      document.getElementById('pW').value = Math.round(Editor.osm.wM * 2) / 2;
      document.getElementById('pD').value = Math.round(Editor.osm.dM * 2) / 2;
      Editor.rot = Editor.osm.angle;
      Editor.refreshPreview();
    };
    document.getElementById('placeBtn').onclick = () => {
      const f = Editor.currentParams();
      const pend = {
        name: document.getElementById('pName').value || 'Eigenes Gebäude',
        facade: f,
        rot: Editor.rot || 0,
        lon: Editor.exif && Editor.exif.lon != null ? Editor.exif.lon : null,
        lat: Editor.exif && Editor.exif.lat != null ? Editor.exif.lat : null,
        osmName: Editor.osm ? Editor.osm.name : null
      };
      localStorage.setItem('fve_pending', JSON.stringify(pend));
      location.href = 'index.html?edit=1&mode=2d';
    };
    document.getElementById('exportBtn').onclick = () => {
      const data = JSON.stringify({ fve_edits: Editor.getEdits(), pending: (() => { try { return JSON.parse(localStorage.getItem('fve_pending') || 'null'); } catch (e) { return null; } })() }, null, 1);
      const blob = new Blob([data], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'franklin_vice_edit.json';
      a.click();
    };
    document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
    document.getElementById('importFile').onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const j = JSON.parse(rd.result);
          if (j.fve_edits) localStorage.setItem('fve_edits', JSON.stringify(j.fve_edits));
          if (j.pending) localStorage.setItem('fve_pending', JSON.stringify(j.pending));
          Editor.renderEdits();
          alert('Importiert: ' + (j.fve_edits || []).length + ' Gebäude.');
        } catch (err) { alert('Konnte JSON nicht lesen.'); }
      };
      rd.readAsText(f);
    };
    Editor.renderEdits();
  }
};

window.addEventListener('DOMContentLoaded', () => Editor.init());
