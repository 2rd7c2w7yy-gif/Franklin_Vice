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
          if (out.length && i - out[out.length - 1] < minGap) { if (a[i] > a[out[out.length - 1]]) out[out.length - 1] = i; } else out.push(i);
        }
        return out;
      };
      const avg = (x0f, x1f, y0f, y1f) => {
        let r = 0, gg = 0, b = 0, n = 0;
        for (let y = Math.max(0, Math.floor(H * y0f)); y < Math.min(H, Math.ceil(H * y1f)); y++) for (let x = Math.max(0, Math.floor(W * x0f)); x < Math.min(W, Math.ceil(W * x1f)); x++) {
          const i = (y * W + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
        }
        if (!n) return '#cccccc';
        const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
        return '#' + hex(r) + hex(gg) + hex(b);
      };
      const floorPks = peaks(rs, Math.max(9, Math.round(H / 9)), 0.55);
      const colPksAll = peaks(cs, Math.max(6, Math.round(W / 24)), 0.3);
      const isDach = mode === 'dach' || (mode === 'auto' && floorPks.length < 3 && colPksAll.length < 3);
      if (isDach) { const rc = avg(0.1, 0.9, 0.1, 0.9); return { facade: '#cfcfcf', roofColor: rc, floors: 1, wins: 0, doors: 0, openings: null, roofShape: 'flat', isDach: true, roofVis: false, bWidthPx: W, roofDepthPx: 0, wM: 15, dM: 8, hM: 3 }; }
      const rowMax = Math.max(...rs);
      const rowMode = new Array(H);
      const rowW = new Float32Array(H);
      for (let y = 0; y < H; y++) {
        const hist = new Map();
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
          hist.set(k, (hist.get(k) || 0) + 1);
        }
        let modeK = 0, modeN = 0;
        for (const [k, n] of hist) if (n > modeN) { modeN = n; modeK = k; }
        const mr = (modeK >> 8) * 16 + 8, mg = ((modeK >> 4) & 15) * 16 + 8, mb = (modeK & 15) * 16 + 8;
        rowMode[y] = [mr, mg, mb];
        let l = -1, r = -1;
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const dr = d[i] - mr, dg = d[i + 1] - mg, db = d[i + 2] - mb;
          if (dr * dr + dg * dg + db * db > 700) { if (l < 0) l = x; r = x; }
        }
        rowW[y] = l >= 0 ? r - l + 1 : 0;
      }
      let maxW = W * 0.2;
      for (let y = 0; y < H; y++) if (rowW[y] > maxW) maxW = rowW[y];
      let bTop = 0;
      for (let y = 0; y < Math.floor(H * 0.8); y++) {
        if (rowW[y] > maxW * 0.35) {
          let ok = true;
          for (let k = 1; k <= 8 && y + k < H; k++) if (rowW[y + k] < maxW * 0.2) { ok = false; break; }
          if (ok) { bTop = y; break; }
        }
      }
      let fBot = H - 1;
      for (let y = H - 1; y > Math.floor(H * 0.2); y--) if (rowW[y] > maxW * 0.08) { fBot = y; break; }
      const facadeMode = rowMode[Math.max(bTop + 4, Math.round(fBot - (fBot - bTop) * 0.25))];
      let eave = -1, eaveJump = 0;
      const eLo = bTop + 3, eHi = Math.min(fBot, bTop + (fBot - bTop) * 0.35);
      for (let y = eLo; y < eHi; y++) {
        const a = rowMode[y], b = rowMode[y + 1];
        const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
        const jump = Math.sqrt(dr * dr + dg * dg + db * db);
        const toFacade = Math.sqrt((b[0] - facadeMode[0]) ** 2 + (b[1] - facadeMode[1]) ** 2 + (b[2] - facadeMode[2]) ** 2) < 35;
        const score = (toFacade ? jump * 2 : jump) + (rs[y] / Math.max(1, rowMax)) * 55;
        if (score > eaveJump) { eaveJump = score; eave = y; }
      }
      let eaveV = 0;
      if (!(eave > bTop && eaveJump > 38)) {
        eave = -1;
        for (let y = bTop + 4; y < Math.min(fBot, bTop + (fBot - bTop) * 0.4); y++) if (rs[y] > eaveV) { eaveV = rs[y]; eave = y; }
      }
      const hasEave = eave > bTop && (eaveJump > 38 || eaveV > rowMax * 0.22) && (eave - bTop) >= 4;
      const facTop0 = hasEave ? eave + 3 : bTop + 3;
      const facBot0 = Math.max(facTop0 + 8, fBot - 2);
      const integ = new Float64Array((W + 1) * (H + 1));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) integ[(y + 1) * (W + 1) + (x + 1)] = gray[y * W + x] + integ[y * (W + 1) + (x + 1)] + integ[(y + 1) * (W + 1) + x] - integ[y * (W + 1) + x];
      const boxBg = (x0, y0, x1, y1) => {
        const a = integ[y0 * (W + 1) + x0], b = integ[y0 * (W + 1) + x1 + 1], cc = integ[(y1 + 1) * (W + 1) + x0], dd = integ[(y1 + 1) * (W + 1) + x1 + 1];
        return (dd - b - cc + a) / ((x1 - x0 + 1) * (y1 - y0 + 1));
      };
      const kr = Math.max(8, Math.round(Math.max(W, H) / 12));
      const bg = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        bg[y * W + x] = boxBg(Math.max(0, x - kr), Math.max(0, y - kr), Math.min(W - 1, x + kr), Math.min(H - 1, y + kr));
      }
      const darkM = new Uint8Array(W * H);
      const darkCol = new Float32Array(W), rowDarkF = new Float32Array(H);
      for (let y = facTop0; y <= facBot0; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, gv = gray[i], b = bg[i];
        const T = Math.max(12, b * 0.10);
        if (gv < b - T && gv < 246) { darkM[i] = 1; darkCol[x]++; }
      }
      let maxCs = 0, maxDc = 0;
      for (let x = 0; x < W; x++) { if (cs[x] > maxCs) maxCs = cs[x]; if (darkCol[x] > maxDc) maxDc = darkCol[x]; }
      const colScore0 = new Float32Array(W);
      for (let x = 0; x < W; x++) colScore0[x] = (maxCs ? 0.5 * cs[x] / maxCs : 0) + (maxDc ? 0.5 * darkCol[x] / maxDc : 0);
      let maxS0 = 0;
      for (let x = 0; x < W; x++) if (colScore0[x] > maxS0) maxS0 = colScore0[x];
      let bL0 = 0, bR0 = W - 1;
      for (let x = 0; x < W; x++) if (colScore0[x] > maxS0 * 0.22) { bL0 = x; break; }
      for (let x = W - 1; x >= 0; x--) if (colScore0[x] > maxS0 * 0.22) { bR0 = x; break; }
      if (bR0 - bL0 < W * 0.25) { bL0 = 0; bR0 = W - 1; }
      let fr0 = 0, fg0 = 0, fb0 = 0, fn0 = 0;
      for (let y = facTop0; y <= facBot0; y++) for (let x = bL0; x <= bR0; x++) {
        const i = y * W + x;
        if (!darkM[i] && gray[i] > bg[i] + 6) { fr0 += d[i * 4]; fg0 += d[i * 4 + 1]; fb0 += d[i * 4 + 2]; fn0++; }
      }
      if (fn0 < (bR0 - bL0) * (facBot0 - facTop0) * 0.05) {
        fr0 = 0; fg0 = 0; fb0 = 0; fn0 = 0;
        for (let y = facTop0; y <= facBot0; y++) for (let x = bL0; x <= bR0; x++) {
          const i = y * W + x;
          if (!darkM[i]) { fr0 += d[i * 4]; fg0 += d[i * 4 + 1]; fb0 += d[i * 4 + 2]; fn0++; }
        }
      }
      const facR = fr0 / Math.max(1, fn0), facG = fg0 / Math.max(1, fn0), facB = fb0 / Math.max(1, fn0);
      const colFac = new Float32Array(W);
      for (let y = facTop0; y <= facBot0; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const dr = d[i] - facR, dg = d[i + 1] - facG, db = d[i + 2] - facB;
        if (dr * dr + dg * dg + db * db < 1600) colFac[x]++;
      }
      let maxLit = 0;
      for (let x = 0; x < W; x++) if (colFac[x] > maxLit) maxLit = colFac[x];
      const colScore = new Float32Array(W);
      for (let x = 0; x < W; x++) colScore[x] = (maxCs ? 0.34 * cs[x] / maxCs : 0) + (maxDc ? 0.33 * darkCol[x] / maxDc : 0) + (maxLit ? 0.33 * colFac[x] / maxLit : 0);
      let maxScore = 0;
      for (let x = 0; x < W; x++) if (colScore[x] > maxScore) maxScore = colScore[x];
      let bLeft = 0, bRight = W - 1;
      for (let x = 0; x < W; x++) if (colScore[x] > maxScore * 0.18) { bLeft = x; break; }
      for (let x = W - 1; x >= 0; x--) if (colScore[x] > maxScore * 0.18) { bRight = x; break; }
      if (colPksAll.length) {
        bLeft = Math.min(bLeft, Math.max(0, colPksAll[0] - 6));
        bRight = Math.max(bRight, Math.min(W - 1, colPksAll[colPksAll.length - 1] + 6));
      }
      if (bRight - bLeft < W * 0.25) { bLeft = 0; bRight = W - 1; }
      const spanW = bRight - bLeft;
      const rowBrightB = new Float32Array(H);
      for (let y = facTop0; y <= facBot0; y++) {
        let n = 0;
        for (let x = bLeft; x <= bRight; x++) if (gray[y * W + x] > bg[y * W + x] + Math.max(14, bg[y * W + x] * 0.08)) n++;
        rowBrightB[y] = n;
        let dk = 0;
        for (let x = bLeft; x <= bRight; x++) if (darkM[y * W + x]) dk++;
        rowDarkF[y] = dk;
      }
      let facBot = facBot0;
      for (let y = facBot0; y > facTop0 + 6; y--) {
        if (rowBrightB[y] > spanW * 0.30 || rowDarkF[y] > spanW * 0.30) { facBot = y; break; }
      }
      const facTop = facTop0;
      const facW = Math.max(10, bRight - bLeft), facH = Math.max(10, facBot - facTop);
      let fr = 0, fg = 0, fb = 0, fn = 0;
      for (let y = facTop; y <= facBot; y++) for (let x = bLeft; x <= bRight; x++) {
        const i = y * W + x;
        if (!darkM[i] && gray[i] > bg[i] + 6) { fr += d[i * 4]; fg += d[i * 4 + 1]; fb += d[i * 4 + 2]; fn++; }
      }
      if (fn < facW * facH * 0.05) {
        fr = 0; fg = 0; fb = 0; fn = 0;
        for (let y = facTop; y <= facBot; y++) for (let x = bLeft; x <= bRight; x++) {
          const i = y * W + x;
          if (!darkM[i] && gray[i] > bg[i] - 16) { fr += d[i * 4]; fg += d[i * 4 + 1]; fb += d[i * 4 + 2]; fn++; }
        }
      }
      const hex2 = (v) => Math.round(v / Math.max(1, fn)).toString(16).padStart(2, '0');
      const facade = fn ? '#' + hex2(fr) + hex2(fg) + hex2(fb) : '#d4c9b8';
      // BFS comps on local-contrast mask, then trim to dense core and split wide comps
      const seen = new Uint8Array(W * H);
      let comps = [];
      for (let y = facTop; y <= facBot; y++) for (let x = bLeft; x <= bRight; x++) {
        const si = y * W + x;
        if (!darkM[si] || seen[si]) continue;
        let minX = x, maxX = x, minY = y, maxY = y, area = 0;
        const stack = [si];
        seen[si] = 1;
        while (stack.length) {
          const q = stack.pop();
          const qx = q % W, qy = Math.floor(q / W);
          area++;
          if (qx < minX) minX = qx; if (qx > maxX) maxX = qx; if (qy < minY) minY = qy; if (qy > maxY) maxY = qy;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = qx + dx, ny = qy + dy;
            if (nx < bLeft || nx > bRight || ny < facTop || ny > facBot) continue;
            const ni = ny * W + nx;
            if (darkM[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
          }
        }
        const cw = maxX - minX + 1, ch = maxY - minY + 1;
        if (cw >= Math.max(4, facW * 0.015) && ch >= Math.max(6, facH * 0.03) && area >= 18 && cw <= facW * 0.62 && ch <= facH * 0.96) comps.push({ minX, maxX, minY, maxY, w: cw, h: ch, area });
      }
      for (let m = 0; m < 3; m++) {
        for (let i = 0; i < comps.length; i++) for (let j = i + 1; j < comps.length; j++) {
          const a = comps[i], b = comps[j];
          if (a.minX - 3 <= b.maxX && b.minX - 3 <= a.maxX && a.maxY >= b.minY - 2 && b.maxY >= a.minY - 2) {
            a.minX = Math.min(a.minX, b.minX); a.maxX = Math.max(a.maxX, b.maxX);
            a.minY = Math.min(a.minY, b.minY); a.maxY = Math.max(a.maxY, b.maxY);
            a.w = a.maxX - a.minX + 1; a.h = a.maxY - a.minY + 1; a.area += b.area;
            comps.splice(j, 1); j--;
          }
        }
      }
      const trim = (c) => {
        const wpx = c.maxX - c.minX + 1, hpx = c.maxY - c.minY + 1;
        const rowD = new Float32Array(hpx), colD = new Float32Array(wpx);
        for (let y = c.minY; y <= c.maxY; y++) for (let x = c.minX; x <= c.maxX; x++) if (darkM[y * W + x]) { rowD[y - c.minY]++; colD[x - c.minX]++; }
        let rMax = 0, cMax = 0;
        for (const v of rowD) if (v > rMax) rMax = v;
        for (const v of colD) if (v > cMax) cMax = v;
        let y0 = 0, y1 = hpx - 1;
        while (y0 < hpx && rowD[y0] < rMax * 0.5) y0++;
        while (y1 > y0 && rowD[y1] < rMax * 0.5) y1--;
        let x0 = 0, x1 = wpx - 1;
        while (x0 < wpx && colD[x0] < cMax * 0.5) x0++;
        while (x1 > x0 && colD[x1] < cMax * 0.5) x1--;
        return { minX: c.minX + x0, maxX: c.minX + x1, minY: c.minY + y0, maxY: c.minY + y1 };
      };
      const splitWide = [];
      for (const c of comps) {
        if (c.minX <= bLeft + 1 || c.maxX >= bRight - 1) continue;
        let t = trim(c);
        if (t.maxX - t.minX + 1 > facW * 0.45) {
          let sum = 0, n = 0;
          for (let y = t.minY; y <= t.maxY; y++) for (let x = t.minX; x <= t.maxX; x++) { sum += gray[y * W + x]; n++; }
          const mean = sum / Math.max(1, n);
          const cw = t.maxX - t.minX + 1;
          const colMean = new Float32Array(cw);
          for (let x = t.minX; x <= t.maxX; x++) {
            let s = 0, k = 0;
            for (let y = t.minY; y <= t.maxY; y++) { s += gray[y * W + x]; k++; }
            colMean[x - t.minX] = s / k;
          }
          const cuts = [];
          let run = 0, runStart = 0;
          for (let k = 0; k < cw; k++) {
            if (colMean[k] > mean + 14) { if (!run) runStart = k; run++; } else { if (run >= 3) cuts.push(runStart + Math.floor(run / 2)); run = 0; }
          }
          if (cuts.length) {
            const bounds = [0, ...cuts, cw];
            for (let bi = 0; bi < bounds.length - 1; bi++) {
              const sub = { minX: t.minX + bounds[bi], maxX: t.minX + bounds[bi + 1] - 1, minY: t.minY, maxY: t.maxY };
              const tt = trim(sub);
              if (tt.maxX - tt.minX + 1 >= Math.max(4, facW * 0.015) && tt.maxY - tt.minY + 1 >= Math.max(6, facH * 0.03)) splitWide.push(tt);
            }
            continue;
          }
        }
        if (t.maxX - t.minX + 1 >= Math.max(4, facW * 0.015) && t.maxY - t.minY + 1 >= Math.max(6, facH * 0.03) && t.maxX - t.minX + 1 <= facW * 0.62 && t.maxY - t.minY + 1 <= facH * 0.96) splitWide.push(t);
      }
      const rowDFb = new Float32Array(H);
      for (let y = facTop; y <= facBot; y++) {
        let dk = 0;
        for (let x = bLeft + 2; x <= bRight - 2; x++) if (darkM[y * W + x]) dk++;
        rowDFb[y] = dk / spanW;
      }
      const bands = [];
      for (let y = facTop; y <= facBot; y++) if (rowDFb[y] > 0.6) {
        if (bands.length && y - bands[bands.length - 1][1] <= 3) bands[bands.length - 1][1] = y;
        else bands.push([y, y]);
      }
      const litCols = [];
      for (const c of splitWide) {
        if (c.maxY - c.minY + 1 > facH * 0.42) continue;
        litCols.push([c.minX, c.maxX]);
      }
      litCols.sort((a, b) => a[0] - b[0]);
      const mergedCols = [];
      for (const [a, b] of litCols) {
        if (mergedCols.length && a <= mergedCols[mergedCols.length - 1][1] + 6) mergedCols[mergedCols.length - 1][1] = Math.max(mergedCols[mergedCols.length - 1][1], b);
        else mergedCols.push([a, b]);
      }
      for (const [y0, y1] of bands) {
        const bh = y1 - y0 + 1;
        if (bh < Math.max(6, facH * 0.04) || bh > facH * 0.42) continue;
        const colDF = new Float32Array(spanW);
        for (let x = bLeft; x <= bRight; x++) {
          let dk = 0;
          for (let y = y0; y <= y1; y++) if (darkM[y * W + x]) dk++;
          colDF[x - bLeft] = dk / bh;
        }
        if (mergedCols.length >= 2) {
          for (const [a, b] of mergedCols) {
            const xa = Math.max(a, bLeft + 2), xb = Math.min(b, bRight - 2);
            if (xb - xa + 1 < Math.max(4, facW * 0.015) || xb - xa + 1 > facW * 0.45) continue;
            let dk = 0, tot = 0;
            for (let x = xa; x <= xb; x++) for (let y = y0; y <= y1; y++) { tot++; if (darkM[y * W + x]) dk++; }
            if (tot && dk / tot > 0.5) splitWide.push({ minX: xa, maxX: xb, minY: y0, maxY: y1 });
          }
        } else {
          const cuts = [];
          let run = 0, runStart = 0;
          for (let k = 0; k < spanW; k++) {
            if (colDF[k] < 0.35) { if (!run) runStart = k; run++; } else { if (run >= 2) cuts.push(runStart + Math.floor(run / 2)); run = 0; }
          }
          const bounds = [0, ...cuts, spanW];
          for (let bi = 0; bi < bounds.length - 1; bi++) {
            const x0 = bLeft + bounds[bi], x1 = bLeft + bounds[bi + 1] - 1;
            const wpx = x1 - x0 + 1;
            if (wpx >= Math.max(4, facW * 0.015) && wpx <= facW * 0.45) {
              let mnX = 1e9, mxX = -1;
              for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (darkM[y * W + x]) { if (x < mnX) mnX = x; if (x > mxX) mxX = x; }
              if (mxX > mnX) splitWide.push({ minX: mnX, maxX: mxX, minY: y0, maxY: y1 });
            }
          }
        }
      }
      comps = splitWide;
      const openings = comps.slice(0, 80).map(c => {
        const wpx = c.maxX - c.minX + 1, hpx = c.maxY - c.minY + 1;
        const isDoor = c.maxY >= facBot - 5 && c.maxY > facBot - facH * 0.3 && hpx >= facH * 0.12;
        return { x: +((c.minX - bLeft) / facW).toFixed(3), y: +((c.minY - facTop) / facH).toFixed(3), w: +(wpx / facW).toFixed(3), h: +(hpx / facH).toFixed(3), type: isDoor ? 'door' : 'win' };
      }).sort((a, b) => a.y - b.y || a.x - b.x);
      let floors, wins, doors;
      if (openings.length) {
        const winCys = openings.filter(o => o.type === 'win').map(o => o.y + o.h / 2).sort((a, b) => a - b);
        const cys = winCys.length >= 2 ? winCys : openings.map(o => o.y + o.h / 2).sort((a, b) => a - b);
        let groups = 1;
        for (let i = 1; i < cys.length; i++) if (cys[i] - cys[i - 1] > 0.18) groups++;
        floors = Math.max(1, Math.min(8, groups));
        wins = openings.filter(o => o.type === 'win').length;
        doors = openings.filter(o => o.type === 'door').length;
      } else {
        const facRows = [];
        for (let y = facTop; y <= facBot; y++) facRows.push(rs[y]);
        const fPks = peaks(new Float32Array(facRows), Math.max(9, Math.round(H / 9)), 0.4);
        floors = Math.max(1, Math.min(8, fPks.length + 1));
        let band = new Float32Array(W);
        for (let x = 1; x < W - 1; x++) for (let y = facTop; y <= facBot; y++) band[x] += Math.abs(gxm[y * W + x]);
        const winPks = peaks(smooth(band, 2), Math.max(6, Math.round(W / 24)), 0.3);
        wins = Math.max(1, Math.min(8, Math.round(winPks.length / 2)));
        doors = 1;
      }
      let roofColor = '#888888', roofVis = false, roofDepthPx = 0, roofShape = 'flat', bWidthPx = facW;
      if (hasEave) {
        roofDepthPx = eave - bTop;
        roofVis = roofDepthPx >= 6;
        let rr = 0, rg = 0, rb = 0, rn = 0;
        for (let y = bTop + 1; y < eave; y++) { rr += rowMode[y][0]; rg += rowMode[y][1]; rb += rowMode[y][2]; rn++; }
        const hexR = (v) => Math.round(v / Math.max(1, rn)).toString(16).padStart(2, '0');
        roofColor = rn ? '#' + hexR(rr) + hexR(rg) + hexR(rb) : '#888888';
        const depthRatio = roofDepthPx / Math.max(1, bWidthPx);
        if (roofDepthPx < 9 || depthRatio < 0.12) roofShape = 'flat';
        else {
          const topW = (rowW[bTop + 1] + rowW[bTop + 2] + rowW[Math.min(bTop + 3, eave - 1)]) / 3;
          const botW = (rowW[Math.max(bTop + 1, eave - 3)] + rowW[Math.max(bTop + 1, eave - 2)] + rowW[eave - 1]) / 3;
          const ratio = topW / Math.max(1, botW);
          if (ratio < 0.35) roofShape = 'gabled';
          else if (ratio < 0.9) roofShape = 'hip';
          else roofShape = depthRatio < 0.4 ? 'flat' : 'gabled';
        }
      }
      return { facade, roofColor, floors, wins, doors, openings: openings.length ? openings : null, roofShape, isDach, roofVis, bWidthPx, roofDepthPx, wM: 15, dM: 8, hM: floors * 3 };
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
      openings: (Editor.params && Editor.params.openings) || null,
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
        try {
          Editor.params = Editor.analyze(img, mode === 'auto' ? 'auto' : mode);
        } catch (e) {
          Editor.params = { facade: '#d4c9b8', roofColor: '#6a4a3a', floors: 3, wins: 3, doors: 1, openings: null, roofShape: 'flat', isDach: false, wM: 15, dM: 8, hM: 9, roofVis: false, bWidthPx: 0, roofDepthPx: 0 };
          info += '\n⚠ Analyse fehlgeschlagen (' + e.message + ') — Werte manuell setzen';
        }
        document.getElementById('pFloors').value = Editor.params.floors;
        document.getElementById('pWins').value = Editor.params.wins;
        document.getElementById('pDoors').value = Editor.params.doors;
        document.getElementById('pFacade').value = Editor.params.facade;
        document.getElementById('pRoof').value = Editor.params.roofColor;
        if (['flat', 'gabled', 'hip', 'pyramidal'].includes(Editor.params.roofShape)) document.getElementById('pRoofShape').value = Editor.params.roofShape;
        info += '\n🪟 ' + (Editor.params.openings ? Editor.params.openings.length + ' Öffnungen einzeln erkannt (' + Editor.params.openings.filter(o => o.type === 'win').length + ' Fenster, ' + Editor.params.openings.filter(o => o.type === 'door').length + ' Türen), Dachform: ' + Editor.params.roofShape : 'keine einzelnen Öffnungen erkannt — Raster-Fallback');
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
          try {
            Editor.params = Editor.analyze(Editor.img, document.getElementById('pMode').value);
          } catch (e) {
            Editor.params = { facade: '#d4c9b8', roofColor: '#6a4a3a', floors: 3, wins: 3, doors: 1, openings: null, roofShape: 'flat', isDach: false, wM: 15, dM: 8, hM: 9, roofVis: false, bWidthPx: 0, roofDepthPx: 0 };
          }
          document.getElementById('pFloors').value = Editor.params.floors;
          document.getElementById('pWins').value = Editor.params.wins;
          document.getElementById('pDoors').value = Editor.params.doors;
          document.getElementById('pFacade').value = Editor.params.facade;
          document.getElementById('pRoof').value = Editor.params.roofColor;
          if (['flat', 'gabled', 'hip', 'pyramidal'].includes(Editor.params.roofShape)) document.getElementById('pRoofShape').value = Editor.params.roofShape;
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
