const fs = require('fs');
const path = require('path');

const photosDir = process.argv[2] || path.join(__dirname, '..', 'photos');
const outFile = process.argv[3] || path.join(photosDir, 'photos.json');

const geoSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'geodata.js'), 'utf8');
const GEO = JSON.parse(geoSrc.replace(/^const GEO = /, '').replace(/;\s*$/, ''));

const PAD = 170, WORLD = 3600;
const bbox = GEO.bbox;
const midLat = (bbox[1] + bbox[3]) / 2 * Math.PI / 180;
const mPerDegLon = 111320 * Math.cos(midLat);
const mPerDegLat = 110540;
const wM = (bbox[2] - bbox[0]) * mPerDegLon;
const hM = (bbox[3] - bbox[1]) * mPerDegLat;
const s = (WORLD - 2 * PAD) / Math.max(wM, hM);
const toWorld = (lon, lat) => ({
  x: PAD + (lon - bbox[0]) * mPerDegLon * s,
  y: PAD + (bbox[3] - lat) * mPerDegLat * s
});

function readExif(buf) {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let off = 2;
  while (off + 4 < buf.length) {
    if (buf[off] !== 0xFF) break;
    const marker = buf[off + 1];
    if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { off += 2; continue; }
    if (marker === 0xDA || marker === 0xD9) break;
    const len = buf.readUInt16BE(off + 2);
    if (marker === 0xE1 && buf.toString('latin1', off + 4, off + 10) === 'Exif\0\0') {
      return parseTiff(buf, off + 10);
    }
    off += 2 + len;
  }
  return null;
}

function parseTiff(buf, base) {
  const le = buf.toString('latin1', base, base + 2) === 'II';
  const rd16 = (o) => (le ? buf.readUInt16LE(base + o) : buf.readUInt16BE(base + o));
  const rd32 = (o) => (le ? buf.readUInt32LE(base + o) : buf.readUInt32BE(base + o));
  if (rd16(2) !== 0x2A) return null;
  const readIfd = (off) => {
    const n = rd16(off);
    const tags = {};
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      tags[rd16(e)] = { type: rd16(e + 2), count: rd32(e + 4), val: rd32(e + 8) };
    }
    return tags;
  };
  const ifd0 = readIfd(rd32(4));
  const gpsTag = ifd0[0x8825];
  if (!gpsTag) return null;
  const gps = readIfd(gpsTag.val);
  const dms = (refId, valId) => {
    const v = gps[valId];
    if (!v || v.type !== 5 || v.count !== 3) return null;
    let ref = 'N';
    const rt = gps[refId];
    if (rt && rt.type === 2) ref = buf.toString('latin1', base + rt.val, base + rt.val + 1).toUpperCase();
    const o = v.val;
    const d = rd32(o) / rd32(o + 4);
    const m = rd32(o + 8) / rd32(o + 12);
    const sec = rd32(o + 16) / rd32(o + 20);
    let val = d + m / 60 + sec / 3600;
    if (ref === 'S' || ref === 'W') val = -val;
    return val;
  };
  let yaw = null;
  const dt = gps[17];
  if (dt && dt.type === 5) yaw = rd32(dt.val) / rd32(dt.val + 4);
  return { lat: dms(1, 2), lon: dms(3, 4), yaw };
}

function readXmpGps(buf) {
  const str = buf.toString('latin1');
  const mLat = str.match(/GPSLatitude="([\d.]+),([\d.]+)([NS])"/);
  const mLon = str.match(/GPSLongitude="([\d.]+),([\d.]+)([EW])"/);
  if (!mLat || !mLon) return null;
  let lat = parseFloat(mLat[1]) + parseFloat(mLat[2]) / 60;
  let lon = parseFloat(mLon[1]) + parseFloat(mLon[2]) / 60;
  if (mLat[3] === 'S') lat = -lat;
  if (mLon[3] === 'W') lon = -lon;
  const mDir = str.match(/GPSImgDirection="([\d.]+)"/);
  return { lat, lon, yaw: mDir ? parseFloat(mDir[1]) : null };
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const buildings = GEO.buildings.map(b => ({
  pts: b.p.map(([lon, lat]) => { const w = toWorld(lon, lat); return [w.x, w.y]; })
}));

function nearestBuilding(x, y) {
  let best = -1, bd = Infinity;
  buildings.forEach((b, i) => {
    if (pointInPoly(x, y, b.pts)) { best = i; bd = 0; return; }
    let d = Infinity;
    for (let k = 0, j = b.pts.length - 1; k < b.pts.length; j = k++) {
      d = Math.min(d, segDist(x, y, b.pts[j][0], b.pts[j][1], b.pts[k][0], b.pts[k][1]));
    }
    if (d < bd) { bd = d; best = i; }
  });
  return { idx: bd <= 28 ? best : -1, dist: bd };
}

const files = fs.existsSync(photosDir) ? fs.readdirSync(photosDir).filter(f => /\.(jpe?g)$/i.test(f)).sort() : [];
const entries = [];
for (const f of files) {
  const buf = fs.readFileSync(path.join(photosDir, f));
  const exif = readExif(buf) || readXmpGps(buf);
  if (!exif || exif.lat == null || exif.lon == null) {
    console.log('SKIP (kein GPS):', f);
    continue;
  }
  const w = toWorld(exif.lon, exif.lat);
  const nb = nearestBuilding(w.x, w.y);
  entries.push({
    f,
    x: Math.round(w.x * 10) / 10,
    y: Math.round(w.y * 10) / 10,
    yaw: exif.yaw != null ? Math.round(exif.yaw * 10) / 10 : 0,
    b: nb.idx,
    lat: Math.round(exif.lat * 1e6) / 1e6,
    lon: Math.round(exif.lon * 1e6) / 1e6
  });
  console.log('OK', f, 'lat=' + exif.lat.toFixed(6), 'lon=' + exif.lon.toFixed(6), 'yaw=' + exif.yaw, '-> world', Math.round(w.x), Math.round(w.y), 'building=' + nb.idx, '(dist ' + Math.round(nb.dist) + 'px)');
}

const out = JSON.stringify({ note: 'Nur Referenz: welche Fotos welches Gebaeude zeigen. Wird NICHT vom Spiel geladen/geladen angezeigt.', photos: entries }, null, 1) + '\n';
fs.writeFileSync(outFile, out);
console.log('\n' + entries.length + ' Fotos -> ' + outFile + ' (Referenz-Manifest, keine Anzeige im Spiel)');
