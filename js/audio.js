const SFX = {
  ctx: null,
  master: null,
  noiseBuf: null,
  engineOsc: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,
  sirenPhase: 0,
  sirenTimer: 0,
  muted: false,

  init() {
    if (this.ctx || typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return;
    const AC = typeof AudioContext !== 'undefined' ? AudioContext : webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 1;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    this.engineOsc.connect(lp);
    lp.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  },

  ensure() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  },

  setEngine(inCar, speedRatio, throttle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (inCar) {
      const target = 0.05 + throttle * 0.05;
      this.engineGain.gain.setTargetAtTime(target, t, 0.08);
      this.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speedRatio) * 160 + throttle * 25, t, 0.08);
    } else {
      this.engineGain.gain.setTargetAtTime(0, t, 0.1);
    }
  },

  updateSiren(active, dt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (active) {
      this.sirenTimer += dt;
      if (this.sirenTimer > 0.42) {
        this.sirenTimer = 0;
        this.sirenPhase = 1 - this.sirenPhase;
      }
      this.sirenOsc.frequency.setTargetAtTime(this.sirenPhase ? 940 : 700, t, 0.05);
      this.sirenGain.gain.setTargetAtTime(0.045, t, 0.1);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.15);
    }
  },

  blip(freq, dur, type, vol, when) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (when || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  noise(dur, vol, filterFreq, when) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (when || 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  },

  shoot() {
    this.noise(0.09, 0.35, 2600);
    this.blip(160, 0.08, 'square', 0.12);
  },

  enemyShoot() {
    this.noise(0.08, 0.2, 2200);
  },

  crash(strength) {
    this.noise(0.22, Math.min(0.4, 0.1 + strength / 900), 500 + strength);
  },

  skid() {
    this.noise(0.12, 0.06, 900);
  },

  pickup() {
    this.blip(660, 0.09, 'sine', 0.22);
    this.blip(990, 0.14, 'sine', 0.22, 0.09);
  },

  missionSuccess() {
    this.blip(523, 0.1, 'triangle', 0.25);
    this.blip(659, 0.1, 'triangle', 0.25, 0.1);
    this.blip(784, 0.18, 'triangle', 0.25, 0.2);
  },

  missionFail() {
    this.blip(330, 0.15, 'triangle', 0.22);
    this.blip(220, 0.25, 'triangle', 0.22, 0.14);
  },

  explosion() {
    this.noise(0.9, 0.6, 300);
    this.blip(120, 0.7, 'sine', 0.4);
    this.blip(45, 0.9, 'sine', 0.5, 0.05);
  },

  busted() {
    this.blip(392, 0.16, 'square', 0.2);
    this.blip(311, 0.16, 'square', 0.2, 0.18);
    this.blip(262, 0.3, 'square', 0.2, 0.36);
  }
};
