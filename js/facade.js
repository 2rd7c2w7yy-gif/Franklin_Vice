const FacadeLib = {
  shade(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  },

  terrStrips(g, f, w, h) {
    const t = f.terr;
    if (!t || !t.m || t.m <= 0 || (f.floors | 0) < 2 || !f.wM) return null;
    const floors = Math.max(1, f.floors | 0);
    const fh = h / (floors + 0.35);
    const y0 = h - fh * 1.02, y1 = h;
    const fr = Math.max(0, Math.min(0.45, t.m / f.wM));
    const lw = (t.sides === 'both' || t.sides === 'left') ? w * fr : 0;
    const rw = (t.sides === 'both' || t.sides === 'right') ? w * fr : 0;
    const col = FacadeLib.shade(f.roofColor || '#8a8a8a', 26);
    if (lw > 1) { g.fillStyle = col; g.fillRect(0, y0, lw, y1 - y0); }
    if (rw > 1) { g.fillStyle = col; g.fillRect(w - rw, y0, rw, y1 - y0); }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, y0, w, 2);
    if (lw > 1) g.fillRect(lw, y0, 2, y1 - y0);
    if (rw > 1) g.fillRect(w - rw - 2, y0, 2, y1 - y0);
    return { y0, y1, lw, rw };
  },

  drawTexture(g, f, w, h, seed) {
    let s = seed || 1;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    g.fillStyle = f.facade || '#d4d4d4';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1);
    const floors = Math.max(1, f.floors | 0);
    FacadeLib.terrStrips(g, f, w, h);
    const wins = Math.max(0, f.wins | 0);
    const doors = Math.max(0, Math.min(2, f.doors | 0));
    const fh = h / (floors + 0.35);
    if (f.openings && f.openings.length) {
      for (const o of f.openings) {
        const ox = 3 + o.x * (w - 6), oy = 3 + o.y * (h - 6), ow = Math.max(3, o.w * (w - 6)), oh = Math.max(4, o.h * (h - 6));
        if (o.type === 'door') {
          g.fillStyle = '#5a4632';
          g.fillRect(ox, oy, ow, oh);
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(ox, oy, ow, 2);
          g.fillStyle = '#c9c9c9';
          g.fillRect(ox + ow - 3, oy + oh * 0.5, 2, 2);
        } else {
          g.fillStyle = rnd() < 0.18 ? '#ffdf9a' : '#2a3646';
          g.fillRect(ox, oy, ow, oh);
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.fillRect(ox, oy, ow, 2);
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(ox, oy + oh - 2, ow, 2);
        }
      }
      for (let fl = 1; fl < floors; fl++) {
        g.fillStyle = 'rgba(0,0,0,0.15)';
        g.fillRect(0, Math.round(fl * fh), w, 2);
      }
    } else {
      for (let fl = 0; fl < floors; fl++) {
        const y0 = 6 + fl * fh;
        const wh = Math.min(fh - 8, 20);
        if (wins > 0) {
          const margin = w * 0.08;
          const ww = Math.min(20, (w - 2 * margin) / wins * 0.55);
          for (let i = 0; i < wins; i++) {
            const x0 = margin + (w - 2 * margin) / wins * i + ((w - 2 * margin) / wins - ww) / 2;
            g.fillStyle = rnd() < 0.18 ? '#ffdf9a' : '#2a3646';
            g.fillRect(x0, y0, ww, wh);
            g.fillStyle = 'rgba(255,255,255,0.35)';
            g.fillRect(x0, y0, ww, 3);
          }
        }
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(0, y0 + fh - 3, w, 2);
      }
      if (doors > 0) {
        const dw = Math.min(26, w * 0.16), dh = fh * 0.92;
        for (let d = 0; d < doors; d++) {
          const dx = doors === 1 ? (w - dw) / 2 : (w - dw * 2 - 8) / 2 + d * (dw + 8);
          g.fillStyle = '#5a4632';
          g.fillRect(dx, h - dh, dw, dh);
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(dx, h - dh, dw, 3);
          g.fillStyle = '#c9c9c9';
          g.fillRect(dx + dw - 5, h - dh / 2 - 2, 3, 3);
        }
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 40; i++) g.fillRect(rnd() * w, rnd() * h, 2, 2);
  },

  drawPreview(g, f, x, y, w, seed) {
    const floors = Math.max(1, f.floors | 0);
    const fh = Math.max(30, Math.min(52, w / Math.max(2, (f.wins | 0) + 1) * 1.15));
    const h = fh * (floors + 0.35);
    const sk = f.roofVis ? w * 0.3 : 0;
    g.fillStyle = '#87c5e8';
    g.fillRect(x - 14, y - sk - 14, w + 28, h + sk + 42);
    g.fillStyle = f.roofColor || '#8a8a8a';
    if (f.roofShape === 'gabled' || f.roofShape === 'pyramidal') {
      g.beginPath();
      g.moveTo(x - 4, y + 6);
      g.lineTo(x + w / 2, y - fh * (f.roofShape === 'pyramidal' ? 0.8 : 0.55));
      g.lineTo(x + w + 4, y + 6);
      g.closePath();
      g.fill();
      if (f.roofShape === 'gabled') {
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.fillRect(x + w / 2 - 2, y - fh * 0.55, 4, fh * 0.55);
      }
    } else if (f.roofShape === 'hip') {
      g.beginPath();
      g.moveTo(x - 4, y + 6);
      g.lineTo(x + w * 0.18, y - fh * 0.5);
      g.lineTo(x + w * 0.82 + 4, y - fh * 0.5);
      g.lineTo(x + w + 4, y + 6);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1.5;
      g.stroke();
    } else if (f.roofVis) {
      g.beginPath();
      g.moveTo(x - 4, y + 6);
      g.lineTo(x + sk, y + 6 - sk * 0.8);
      g.lineTo(x + w + 4 + sk, y + 6 - sk * 0.8);
      g.lineTo(x + w + 4, y + 6);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath();
      g.moveTo(x + w * 0.2, y + 6 - sk * 0.16);
      g.lineTo(x + w * 0.35, y + 6 - sk * 0.28);
      g.lineTo(x + w * 0.55, y + 6 - sk * 0.28);
      g.lineTo(x + w * 0.4, y + 6 - sk * 0.16);
      g.closePath();
      g.fill();
    } else {
      g.fillRect(x - 4, y - 6, w + 8, 12);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x - 4, y + 4, w + 8, 2);
    }
    g.save();
    g.translate(x, y);
    FacadeLib.drawTexture(g, f, w, h, seed);
    g.restore();
    const ts = (f.terr && f.terr.m > 0 && floors >= 2 && f.wM) ? FacadeLib.terrStrips({ fillStyle: '', fillRect() {} }, f, w, h) : null;
    if (ts) {
      g.fillStyle = FacadeLib.shade(f.roofColor || '#8a8a8a', 40);
      if (ts.lw > 1) g.fillRect(x, y + ts.y0, ts.lw, ts.y1 - ts.y0);
      if (ts.rw > 1) g.fillRect(x + w - ts.rw, y + ts.y0, ts.rw, ts.y1 - ts.y0);
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1.5;
      g.strokeRect(x + ts.lw, y + ts.y0, w - ts.lw - ts.rw, ts.y1 - ts.y0);
    }
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
    g.fillStyle = '#2f4a2f';
    g.fillRect(x - 14, y + h + 2, w + 28, 26);
    g.fillStyle = '#fff';
    g.font = 'bold 13px Verdana, sans-serif';
    g.textAlign = 'center';
    g.fillText((f.wM | 0) + ' m × ' + (f.dM | 0) + ' m · ' + floors + ' Etagen · Dach ' + (f.roofShape === 'gabled' ? 'Satteldach' : 'Flachdach') + (f.terr && f.terr.m > 0 ? ' · +Dachterrasse ' + f.terr.m + ' m' : ''), x + w / 2, y + h + 19);
  },

  makeCanvas(f, w, h, seed) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    FacadeLib.drawTexture(g, f, w, h, seed);
    return c;
  }
};
