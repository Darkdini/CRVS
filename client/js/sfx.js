// Звуки без файлов: синтез через Web Audio. Заменяются на свои через sounds/*.mp3 при желании.
export const SFX = {
  ctx: null, muted: localStorage.getItem('crvs_mute') === '1',
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  toggle() { this.muted = !this.muted; localStorage.setItem('crvs_mute', this.muted ? '1' : '0'); return this.muted; },
  tone(freq, dur, type = 'sine', vol = .15, slide = 0, delay = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol = .2, delay = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay, n = this.ctx.sampleRate * dur, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1200; s.buffer = buf; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.ctx.destination); s.start(t);
  },
  click() { this.tone(900, .05, 'square', .05, -300); },
  open() { this.tone(500, .08, 'triangle', .08, 200); },
  build() { this.noise(.15, .15); this.tone(220, .2, 'triangle', .12, 60); this.tone(330, .25, 'triangle', .1, 80, .1); },
  coin() { this.tone(1200, .08, 'sine', .12); this.tone(1600, .15, 'sine', .12, 0, .07); },
  error() { this.tone(200, .18, 'sawtooth', .08, -80); },
  hit() { this.noise(.08, .25); this.tone(140, .12, 'square', .1, -60); },
  march() { this.tone(300, .12, 'triangle', .1, 100); this.tone(400, .12, 'triangle', .1, 100, .12); this.tone(500, .2, 'triangle', .1, 100, .24); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .3, 'triangle', .12, 0, i * .12)); },
  lose() { [400, 350, 300, 220].forEach((f, i) => this.tone(f, .35, 'sawtooth', .07, -20, i * .18)); },
  levelup() { [660, 880, 1320].forEach((f, i) => this.tone(f, .25, 'sine', .12, 0, i * .1)); },
};
