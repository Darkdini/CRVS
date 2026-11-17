// Эффекты: частицы, всплывающие числа, твины, плавная камера.
export class FX {
  constructor() { this.particles = []; this.texts = []; this.tweens = []; }
  // дым/искры/листья
  emit(x, y, opts = {}) {
    const n = opts.count || 1;
    for (let i = 0; i < n; i++) this.particles.push({
      x, y, vx: (Math.random() - .5) * (opts.spread || 10), vy: -(opts.up || 12) * (0.6 + Math.random() * .8),
      life: 0, max: (opts.life || 1.6) * (0.7 + Math.random() * .6), size: (opts.size || 4) * (0.7 + Math.random() * .6),
      color: opts.color || 'rgba(230,230,230,.5)', grow: opts.grow || 0, gravity: opts.gravity || 0, kind: opts.kind || 'circle',
    });
  }
  text(x, y, str, color = '#fff', size = 14) { this.texts.push({ x, y, str, color, size, life: 0, max: 1.3 }); }
  tween(obj, props, dur = 0.3, ease = easeOut, done) { this.tweens.push({ obj, from: Object.fromEntries(Object.keys(props).map(k => [k, obj[k]])), to: props, t: 0, dur, ease, done }); }
  update(dt) {
    for (const p of this.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.size += p.grow * dt; }
    this.particles = this.particles.filter(p => p.life < p.max);
    for (const t of this.texts) t.life += dt;
    this.texts = this.texts.filter(t => t.life < t.max);
    for (const tw of this.tweens) {
      tw.t += dt; const f = tw.ease(Math.min(1, tw.t / tw.dur));
      for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * f;
      if (tw.t >= tw.dur && tw.done) tw.done();
    }
    this.tweens = this.tweens.filter(t => t.t < t.dur);
  }
  // проекция через функцию toScreen(worldX, worldY, z) — частицы живут в мировых координатах тайлов
  draw(c, toScreen, zoom) {
    for (const p of this.particles) {
      const s = toScreen(p.x, p.y);
      const a = 1 - p.life / p.max;
      c.globalAlpha = a * (p.kind === 'spark' ? 1 : .8);
      c.fillStyle = p.color;
      c.beginPath(); c.arc(s.x, s.y, Math.max(0.5, p.size * zoom), 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    for (const t of this.texts) {
      const s = toScreen(t.x, t.y);
      const f = t.life / t.max;
      c.globalAlpha = 1 - f * f;
      c.font = `800 ${t.size * Math.max(.8, zoom)}px Nunito, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(t.str, s.x, s.y - 40 * f * zoom);
      c.fillStyle = t.color; c.fillText(t.str, s.x, s.y - 40 * f * zoom);
    }
    c.globalAlpha = 1;
  }
}
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
