const FacadeLib = {
  shade(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  },

  drawTexture(g, f, w, h, seed) {
    let s = seed || 1;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    g.fillStyle = f.facade || '#d4d4d4';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1);
    const floors = Math.max(1, f.floors | 0);
    const wins = Math.max(0, f.wins | 0);
    const doors = Math.max(0, Math.min(2, f.doors | 0));
    const fh = h / (floors + 0.35);
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
      const x0 = (w - dw * doors) / 2 + (doors === 1 ? dw / 2 : 0) - (doors === 1 ? dw / 2 : 0);
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
    if (f.roofShape === 'gabled') {
      g.beginPath();
      g.moveTo(x - 4, y + 6);
      g.lineTo(x + w / 2, y - fh * 0.55);
      g.lineTo(x + w + 4, y + 6);
      g.closePath();
      g.fill();
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
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
    g.fillStyle = '#2f4a2f';
    g.fillRect(x - 14, y + h + 2, w + 28, 26);
    g.fillStyle = '#fff';
    g.font = 'bold 13px Verdana, sans-serif';
    g.textAlign = 'center';
    g.fillText((f.wM | 0) + ' m × ' + (f.dM | 0) + ' m · ' + floors + ' Etagen · Dach ' + (f.roofShape === 'gabled' ? 'Satteldach' : 'Flachdach'), x + w / 2, y + h + 19);
  },

  makeCanvas(f, w, h, seed) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    FacadeLib.drawTexture(g, f, w, h, seed);
    return c;
  }
};
