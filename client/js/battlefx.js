// Анимированный экран боя: наши войска слева, враг справа, раунды по логу.
import { Assets } from './assets.js';
import { FX, easeOut } from './fx.js';
import { SFX } from './sfx.js';

export class BattleReplay {
  constructor(game) {
    this.game = game; this.el = document.getElementById('battle'); this.cv = document.getElementById('battle-canvas'); this.ctx = this.cv.getContext('2d');
    document.getElementById('battle-skip').onclick = () => this.close();
    this.fx = new FX();
  }
  open(r, title) {
    this.r = r; this.t = 0; this.round = 0; this.phase = 0; this.done = false;
    this.aHp = r.aHp || 1; this.bHp = r.bHp || 1; this.aCur = this.aHp; this.bCur = this.bHp;
    this.shake = 0; this.lungeA = 0; this.lungeB = 0;
    document.getElementById('battle-title').textContent = title || (r.target ? `Бой: ${r.target}` : 'Бой');
    document.getElementById('battle-skip').textContent = 'Пропустить';
    this.el.classList.add('show');
    const dpr = Math.min(2, devicePixelRatio || 1); const rect = this.cv.getBoundingClientRect();
    this.cv.width = rect.width * dpr; this.cv.height = rect.height * dpr; this.w = rect.width; this.h = rect.height; this.dpr = dpr;
    this.last = performance.now(); this.running = true;
    // наши отряды — до 12 спрайтов, пропорционально составу
    this.units = []; const units = this.game.data.units;
    const total = Object.values(r.army || {}).reduce((a, b) => a + b, 0) || 1;
    for (const [k, n] of Object.entries(r.army || {})) { const cnt = Math.max(n > 0 ? 1 : 0, Math.round(n / total * 10)); for (let i = 0; i < cnt; i++) this.units.push({ sheet: 'units', frame: k }); }
    for (const h of r.heroes || []) this.units.unshift({ sheet: 'heroes', frame: h, hero: true });
    this.enemies = [];
    if (r.enemyArmy) { const et = Object.values(r.enemyArmy).reduce((a, b) => a + b, 0) || 1; for (const [k, n] of Object.entries(r.enemyArmy)) { const cnt = Math.max(n > 0 ? 1 : 0, Math.round(n / et * 10)); for (let i = 0; i < cnt; i++) this.enemies.push({ sheet: 'units', frame: k }); } }
    requestAnimationFrame((ts) => this.loop(ts));
  }
  close() { this.running = false; this.el.classList.remove('show'); }
  loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, (ts - this.last) / 1000); this.last = ts; this.t += dt;
    this.step(dt); this.draw();
    requestAnimationFrame((ts2) => this.loop(ts2));
  }
  step(dt) {
    this.fx.update(dt);
    const log = this.r.log || [];
    if (this.done) return;
    if (this.t > 0.8) {
      this.t = 0;
      const l = log[this.round];
      if (!l) { this.done = true; document.getElementById('battle-skip').textContent = 'Закрыть'; (this.r.win || this.r.killed) ? SFX.win() : SFX.lose(); return; }
      if (this.phase === 0) { this.lungeA = 1; this.bCur = l.bhp; this.fx.text(this.w * .72, this.h * .62, '-' + l.dealt, '#ffd34d', 24); this.burst(this.w * .72, this.h * .68, '#ffb347'); this.phase = 1; }
      else { this.lungeB = 1; this.aCur = l.ahp; this.fx.text(this.w * .28, this.h * .62, '-' + l.taken, '#ff8a7a', 24); this.burst(this.w * .3, this.h * .68, '#ff5a4a'); this.phase = 0; this.round++; }
      this.shake = 1; SFX.hit();
    }
    this.lungeA = Math.max(0, this.lungeA - dt * 2.2); this.lungeB = Math.max(0, this.lungeB - dt * 2.2); this.shake = Math.max(0, this.shake - dt * 3);
  }
  burst(x, y, color) { for (let i = 0; i < 14; i++) this.fx.emit(x, y, { spread: 260, up: 120, life: .5, size: 3, color, gravity: 300, kind: 'spark' }); }
  draw() {
    const c = this.ctx, w = this.w, h = this.h;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.save(); if (this.shake > 0) c.translate((Math.random() - .5) * 8 * this.shake, (Math.random() - .5) * 8 * this.shake);
    // земля
    const g = c.createLinearGradient(0, h * .45, 0, h); g.addColorStop(0, '#5a7a3a'); g.addColorStop(1, '#2a3a1a'); c.fillStyle = g; c.fillRect(0, h * .45, w, h);
    c.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 20; i++) c.fillRect((i * 97) % w, h * .5 + (i * 53) % (h * .45), 14, 2);
    // наши
    const ua = this.units, n = ua.length;
    const lunge = Math.sin(this.lungeA * Math.PI) * 30;
    ua.forEach((u, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = w * .12 + col * 34 + lunge + (row % 2) * 10, y = h * .62 + row * 26 - col * 6;
      const sz = u.hero ? 78 : 56;
      const alive = this.aCur / this.aHp > (i + 1) / (n + 1) * .9 || u.hero;
      c.globalAlpha = alive ? 1 : .25;
      Assets.draw(c, u.sheet, u.frame, x, y, sz, sz);
    });
    c.globalAlpha = 1;
    // враг
    const el = Math.sin(this.lungeB * Math.PI) * 30;
    if (this.enemies.length) {
      this.enemies.forEach((u, i) => { const col = i % 3, row = Math.floor(i / 3); const x = w * .88 - col * 34 - el - (row % 2) * 10, y = h * .62 + row * 26 - col * 6; c.save(); c.translate(x, y); c.scale(-1, 1); Assets.draw(c, u.sheet, u.frame, 0, 0, 56, 56); c.restore(); });
    } else {
      const es = this.r.enemySprite || { sheet: 'monsters', frame: 'wolf' };
      const big = es.sheet === 'bosses' ? 200 : 140;
      c.save(); c.translate(w * .75 - el, h * .85); c.scale(-1, 1); Assets.draw(c, es.sheet, es.frame, 0, 0, big, big); c.restore();
    }
    // полосы HP
    this.hpBar(c, w * .06, h * .1, w * .36, this.aCur / this.aHp, '#4caf50', 'Ваша армия');
    this.hpBar(c, w * .58, h * .1, w * .36, this.bCur / this.bHp, '#e53935', this.r.target || 'Враг');
    c.font = '800 14px Nunito, sans-serif'; c.fillStyle = '#f2c14e'; c.textAlign = 'center'; c.fillText(`Раунд ${Math.min(this.round + 1, (this.r.log || []).length)} / ${(this.r.log || []).length}`, w / 2, h * .14);
    this.fx.draw(c, (x, y) => ({ x, y }), 1);
    c.restore();
    if (this.done) {
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, h * .3, w, h * .4);
      c.font = '800 34px Cinzel, Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const win = this.r.win || this.r.killed;
      c.fillStyle = win ? '#f2c14e' : '#ff8a7a'; c.shadowColor = '#000'; c.shadowBlur = 12;
      c.fillText(this.r.killed ? 'БОСС ПОВЕРЖЕН' : win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', w / 2, h * .44); c.shadowBlur = 0;
      c.font = '700 14px Nunito, sans-serif'; c.fillStyle = '#fff';
      const lines = [];
      const fa = (o) => Object.entries(o || {}).map(([k, v]) => `${this.game.data.units[k].name} ×${v}`).join(', ') || 'нет';
      lines.push(`Погибло: ${fa(this.r.dead)} · Ранено: ${fa(this.r.wounded)}`);
      if (this.r.loot && Object.keys(this.r.loot).length) lines.push('Добыча: ' + Object.entries(this.r.loot).map(([k, v]) => `${v} ${RES[k]}`).join(', '));
      if (this.r.item) lines.push(`Трофей: ${this.r.item.name}`);
      if (this.r.xpGain) lines.push(`Опыт героям: +${this.r.xpGain}`);
      lines.forEach((l, i) => c.fillText(l, w / 2, h * .54 + i * 18));
    }
  }
  hpBar(c, x, y, w, f, color, label) {
    c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.roundRect(x - 2, y - 2, w + 4, 16, 6); c.fill();
    c.fillStyle = color; c.beginPath(); c.roundRect(x, y, Math.max(0, w * Math.max(0, Math.min(1, f))), 12, 5); c.fill();
    c.font = '800 12px Nunito, sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(label, x, y - 6);
  }
}
const RES = { food: 'еды', wood: 'дерева', stone: 'камня', iron: 'железа', gold: 'золота' };
