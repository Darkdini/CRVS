// Сцена города: сетка, дороги, здания, стройка, эффекты.
import { Assets } from './assets.js';
import { IsoView } from './iso.js';
import { FX, easeBack } from './fx.js';

export class CityScene {
  constructor(canvas, game) {
    this.game = game;
    this.view = new IsoView(canvas, { tileW: 128, zoom: 1 });
    this.fx = new FX();
    this.hover = null; this.selected = null; this.buildMode = null;
    this.decor = this._makeDecor();
    this.scale = {};        // анимация появления зданий: id -> scale
    this.known = new Set(); // id уже виденных зданий
    this.time = 0; this.smokeT = 0;
    this.view.onTap = (t) => this.tap(t);
    this.view.onHover = (t) => { this.hover = t; };
    const c = game.data.citySize / 2 - 0.5;
    this.view.centerOn(c, c + 1);
  }
  _makeDecor() {
    const out = []; let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const S = this.game.data.citySize;
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(rnd() * (S + 12)) - 6, y = Math.floor(rnd() * (S + 12)) - 6;
      if (x >= -1 && y >= -1 && x <= S && y <= S) continue;
      const r = rnd();
      out.push({ x, y, frame: r < 0.65 ? 'tree' : r < 0.85 ? 'bush' : 'rock', s: 0.6 + rnd() * 0.5, ox: (rnd() - .5) * .5, oy: (rnd() - .5) * .5 });
    }
    return out;
  }
  tap(t) {
    const S = this.game.data.citySize;
    if (t.x < 0 || t.y < 0 || t.x >= S || t.y >= S) { this.selected = null; this.game.ui.closePanel(); return; }
    const b = this.game.state.buildings.find(b => b.x === t.x && b.y === t.y);
    if (this.buildMode) {
      if (b) { this.game.ui.toast('Клетка занята'); return; }
      this.game.actions.build(this.buildMode, t.x, t.y);
      return;
    }
    this.selected = { x: t.x, y: t.y, t: 0 };
    if (b) this.game.ui.showBuilding(b); else this.game.ui.showBuildMenu(t.x, t.y);
  }
  // вызывается при обновлении состояния: новые здания появляются с анимацией
  onState(st) {
    for (const b of st.buildings) {
      if (!this.known.has(b.id)) {
        this.known.add(b.id);
        if (this.known.size > st.buildings.length) { /* первая загрузка — без анимации */ }
        if (this._loaded) { this.scale[b.id] = 0; this.fx.tween(this.scale, { [b.id]: 1 }, .5, easeBack); this.puff(b.x, b.y, 10); }
      }
      if (this._prevLevels && this._prevLevels[b.id] != null && this._prevLevels[b.id] < b.level && b.level > 0) {
        this.scale[b.id] = 0.6; this.fx.tween(this.scale, { [b.id]: 1 }, .45, easeBack); this.puff(b.x, b.y, 14);
        this.fx.text(b.x, b.y - 0.8, `Уровень ${b.level}!`, '#f2c14e', 16);
      }
    }
    this._prevLevels = Object.fromEntries(st.buildings.map(b => [b.id, b.level]));
    this._loaded = true;
  }
  puff(x, y, n) { for (let i = 0; i < n; i++) this.fx.emit(x + (Math.random() - .5) * .6, y + (Math.random() - .5) * .6, { spread: .8, up: .5, life: 1, size: 7, grow: 6, color: 'rgba(230,220,200,.55)' }); }
  draw(now, dt) {
    const v = this.view, c = v.ctx, S = this.game.data.citySize, st = this.game.state;
    this.time += dt; v.update(dt); this.fx.update(dt);
    v.begin();
    const tw = v.tileW * v.zoom, th = v.tileH * v.zoom;
    // небо/фон
    const bg = c.createLinearGradient(0, 0, 0, v.h); bg.addColorStop(0, '#2d4a26'); bg.addColorStop(1, '#1b2e17'); c.fillStyle = bg; c.fillRect(0, 0, v.w, v.h);
    const cc = Math.floor(S / 2);
    const hasWall = st.buildings.some(b => b.type === 'wall' && b.level > 0);
    const hasTH = st.buildings.find(b => b.type === 'townhall');
    // тайлы
    for (let y = -6; y < S + 6; y++) for (let x = -6; x < S + 6; x++) {
      const p = v.toScreen(x, y);
      if (p.x < -tw || p.x > v.w + tw || p.y < -tw || p.y > v.h + tw) continue;
      const inside = x >= 0 && y >= 0 && x < S && y < S;
      const river = !inside && (x === -3 || (x < -3 && y === S + 1));
      Assets.draw(c, 'terrain', river ? 'water' : 'grass', p.x, p.y, tw, tw);
      if (inside && (x === cc || y === cc)) Assets.draw(c, 'misc', 'road', p.x, p.y, tw, tw);
      if (inside) v.diamond(x, y, null, 'rgba(255,255,255,.07)');
    }
    // подсветка
    if (this.hover && this.hover.x >= 0 && this.hover.y >= 0 && this.hover.x < S && this.hover.y < S) {
      const occ = st.buildings.some(b => b.x === this.hover.x && b.y === this.hover.y);
      v.diamond(this.hover.x, this.hover.y, this.buildMode ? (occ ? 'rgba(220,60,60,.45)' : 'rgba(80,220,120,.45)') : 'rgba(255,255,255,.18)');
    }
    if (this.selected) { const a = .25 + .15 * Math.sin(this.time * 5); v.diamond(this.selected.x, this.selected.y, `rgba(255,220,80,${a})`, '#ffd84a'); }
    // объекты по глубине
    const objs = [];
    for (const d of this.decor) objs.push({ x: d.x + d.ox, y: d.y + d.oy, kind: 'decor', d });
    for (const b of st.buildings) objs.push({ x: b.x, y: b.y, kind: 'building', b });
    if (hasWall) for (let i = -1; i <= S; i++) { objs.push({ x: i, y: -1, kind: 'wall' }); objs.push({ x: i, y: S, kind: 'wall' }); if (i >= 0 && i < S) { objs.push({ x: -1, y: i, kind: 'wall' }); objs.push({ x: S, y: i, kind: 'wall' }); } }
    objs.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);
    for (const o of objs) {
      const p = v.toScreen(o.x, o.y);
      if (p.x < -tw || p.x > v.w + tw || p.y < -tw * 1.5 || p.y > v.h + tw) continue;
      const baseY = p.y + th / 2;
      if (o.kind === 'decor') { const sz = tw * 0.75 * o.d.s; Assets.draw(c, 'misc', o.d.frame, p.x, baseY, sz, sz); continue; }
      if (o.kind === 'wall') { const gate = (o.y === S && o.x === cc); Assets.draw(c, 'buildings', gate ? 'tower' : 'wall', p.x, baseY, tw * .9, tw * .9); continue; }
      const b = o.b;
      const sc = this.scale[b.id] == null ? 1 : this.scale[b.id];
      const sz = tw * sc;
      if (b.level === 0) Assets.draw(c, 'misc', 'construction', p.x, baseY, sz, sz);
      else Assets.draw(c, 'buildings', b.type, p.x, baseY, sz, sz);
      // дым
      if (b.level > 0 && (b.type === 'blacksmith' || b.type === 'house' || b.type === 'tavern') && Math.random() < dt * 2.5) this.fx.emit(b.x + 0.12, b.y - 0.1, { spread: .15, up: .35, life: 2.2, size: 3, grow: 3, color: b.type === 'blacksmith' ? 'rgba(90,90,90,.5)' : 'rgba(230,230,230,.4)' });
      // уровень
      if (b.level > 0 && v.zoom > 0.6) {
        const r = 9 * Math.max(.8, v.zoom);
        c.fillStyle = 'rgba(20,12,6,.85)'; c.beginPath(); c.arc(p.x, p.y - tw * 0.6, r, 0, 7); c.fill(); c.strokeStyle = '#f2c14e'; c.lineWidth = 1.5; c.stroke();
        c.font = `800 ${10 * Math.max(.8, v.zoom)}px Nunito, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f2c14e'; c.fillText(b.level, p.x, p.y - tw * 0.6 + 0.5);
      }
      // прогресс стройки
      if (b.upgrade_until) {
        const def = this.game.data.buildings[b.type];
        const total = def.levels[b.level].time;
        const left = Math.max(0, b.upgrade_until - now);
        const frac = 1 - Math.min(1, left / total);
        const w = tw * 0.6, hh = 7 * Math.max(0.7, v.zoom), bx = p.x - w / 2, by = p.y - tw * 0.8;
        c.fillStyle = 'rgba(0,0,0,.65)'; c.beginPath(); c.roundRect(bx - 2, by - 2, w + 4, hh + 4, 4); c.fill();
        const gg = c.createLinearGradient(bx, 0, bx + w, 0); gg.addColorStop(0, '#b8862b'); gg.addColorStop(1, '#f2c14e');
        c.fillStyle = gg; c.beginPath(); c.roundRect(bx, by, w * frac, hh, 3); c.fill();
        c.font = `800 ${11 * Math.max(0.7, v.zoom)}px Nunito, sans-serif`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(fmtTime(left), p.x, by - 4); c.fillText(fmtTime(left), p.x, by - 4);
        if (Math.random() < dt * 1.5) this.fx.emit(b.x + (Math.random() - .5) * .4, b.y + (Math.random() - .5) * .4, { spread: .3, up: .25, life: 1.2, size: 3, grow: 2, color: 'rgba(240,220,160,.5)' });
      }
    }
    this.fx.draw(c, (x, y) => v.toScreen(x, y), v.zoom);
  }
}
export function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  if (s < 60) return s + 'с';
  if (s < 3600) return Math.floor(s / 60) + 'м ' + (s % 60) + 'с';
  return Math.floor(s / 3600) + 'ч ' + Math.floor((s % 3600) / 60) + 'м';
}
