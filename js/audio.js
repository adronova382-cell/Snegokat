'use strict';
// ===== Звук на WebAudio (без файлов) =====
const Sfx = {
  ctx: null, master: null, noiseBuf: null,
  engine: null, sizzle: null, musicTimer: null, alarmTimer: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  ok() { return this.ctx && S && S.settings.sound; },

  tone(f, d = 0.1, type = 'square', v = 0.15, slide = 0, delay = 0) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + d + 0.02);
  },
  noise(d = 0.2, v = 0.3, freq = 1000, type = 'lowpass', delay = 0) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  },

  click() { this.tone(900, 0.04, 'square', 0.05); },
  coin() { this.tone(988, 0.08, 'square', 0.1); this.tone(1319, 0.18, 'square', 0.1, 0, 0.08); },
  buy() { this.tone(660, 0.06, 'triangle', 0.15); this.tone(880, 0.12, 'triangle', 0.15, 0, 0.06); },
  error() { this.tone(200, 0.15, 'sawtooth', 0.1); this.tone(150, 0.2, 'sawtooth', 0.1, 0, 0.12); },
  success() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.15, 0, i * 0.09)); },
  land(hard = 0.5) { this.noise(0.25, 0.25 + hard * 0.3, 500); },
  whoosh() { this.noise(0.4, 0.15, 1800, 'bandpass'); },
  crash() { this.noise(0.6, 0.5, 400); this.tone(120, 0.4, 'sawtooth', 0.12, -60); },
  trick() { this.tone(700, 0.08, 'triangle', 0.12, 300); },
  spark() { this.noise(0.12, 0.25, 4000, 'highpass'); },
  bang() { this.noise(0.5, 0.6, 2500); this.tone(80, 0.4, 'square', 0.2, -40); },
  pop() { this.noise(0.12, 0.5, 900); this.tone(90, 0.1, 'square', 0.15); },
  ratchet() { this.tone(300 + Math.random() * 80, 0.03, 'square', 0.06); },
  hornTone() { this.tone(440, 0.25, 'square', 0.12); this.tone(554, 0.25, 'square', 0.1); },
  alarm(dur = 2.5) {
    if (!this.ok()) return;
    for (let i = 0; i < dur * 4; i++) this.tone(i % 2 ? 1400 : 900, 0.24, 'square', 0.08, i % 2 ? -500 : 500, i * 0.25);
  },

  // непрерывный шипящий звук паяльника
  setSizzle(on) {
    if (!this.ok()) on = false;
    if (on && !this.sizzle) {
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3500;
      const g = this.ctx.createGain(); g.gain.value = 0.08;
      s.connect(f); f.connect(g); g.connect(this.master); s.start();
      this.sizzle = { s, g };
    } else if (!on && this.sizzle) {
      try { this.sizzle.s.stop(); } catch (e) {}
      this.sizzle = null;
    }
  },

  // мотор: rpm 0..1, run — работает ли
  setEngine(run, rpm = 0) {
    if (!this.ok()) run = false;
    if (run && !this.engine) {
      const c = this.ctx;
      const o1 = c.createOscillator(); o1.type = 'sawtooth';
      const o2 = c.createOscillator(); o2.type = 'square';
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = c.createGain(); g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
      o1.start(); o2.start();
      this.engine = { o1, o2, f, g };
    }
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    if (!run) {
      this.engine.g.gain.setTargetAtTime(0, t, 0.05);
      const e = this.engine; this.engine = null;
      setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch (er) {} }, 300);
      return;
    }
    const base = 38 + rpm * 160 + Math.random() * 4;
    this.engine.o1.frequency.setTargetAtTime(base, t, 0.04);
    this.engine.o2.frequency.setTargetAtTime(base * 0.5, t, 0.04);
    this.engine.f.frequency.setTargetAtTime(500 + rpm * 1800, t, 0.05);
    this.engine.g.gain.setTargetAtTime(0.06 + rpm * 0.06, t, 0.05);
  },

  // простенькая чиптюн-музыка из колонки
  startMusic() {
    if (this.musicTimer || !this.ok() || !S.settings.music) return;
    const mel = [76, 0, 79, 76, 74, 72, 74, 76, 0, 72, 69, 72, 74, 0, 71, 67, 76, 0, 79, 81, 79, 76, 74, 72, 74, 76, 79, 76, 74, 72, 0, 0];
    const bass = [45, 45, 52, 52, 41, 41, 48, 48];
    let step = 0;
    const midi = n => 440 * Math.pow(2, (n - 69) / 12);
    this.musicTimer = setInterval(() => {
      if (!this.ok()) return;
      const n = mel[step % mel.length];
      if (n) this.tone(midi(n), 0.16, 'square', 0.035);
      if (step % 4 === 0) this.tone(midi(bass[(step / 4) % bass.length]), 0.3, 'triangle', 0.08);
      if (step % 2 === 0) this.noise(0.04, 0.04, 6000, 'highpass');
      step++;
    }, 150);
  },
  stopMusic() { clearInterval(this.musicTimer); this.musicTimer = null; },
};
