const Photos = {
  imgs: {},

  load() {
    if (typeof PHOTODATA === 'undefined' || typeof Image === 'undefined') return;
    for (const p of PHOTODATA) {
      p.loaded = false;
      const img = new Image();
      img.onload = () => { p.loaded = true; };
      img.src = 'photos/' + p.f;
      this.imgs[p.f] = img;
    }
  },

  nearest(x, y, maxD) {
    if (typeof PHOTODATA === 'undefined') return null;
    let best = null, bd = maxD * maxD;
    for (const p of PHOTODATA) {
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
};
