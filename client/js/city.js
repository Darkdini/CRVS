// Сцена города: сетка, здания, стройка.
import { Assets } from './assets.js';
import { IsoView } from './iso.js';

export class CityScene {
  constructor(canvas, game) {
    this.game = game;
    this.view = new IsoView(canvas, { tileW: 128, zoom: 1 });
    this.hover = null; this.selected = null; this.buildMode = null;
    this.decor = this._makeDecor();
    this.view.onTap = (t) => this.tap(t);
    this.view.onHover = (t) => { this.hover = t; };
    const c = game.data.citySize / 2 - 0.5;
    this.view.centerOn(c, c);
  }
  _makeDecor() {
    // декор вокруг города (детерминированный)
    const out = []; let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const S = this.game.data.citySize;
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(rnd() * (S + 8)) - 4, y = Math.floor(rnd() * (S + 8)) - 4;
      if (x >= 0 && y >= 0 && x < S && y < S) continue;
      out.push({ x, y, frame: rnd() < 0.6 ? 'tree' : rnd() < 0.5 ? 'rock' : 'bush' });
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
    this.selected = { x: t.x, y: t.y };
    if (b) this.game.ui.showBuilding(b); else this.game.ui.showBuildMenu(t.x, t.y);
  }
  draw(now) {
    const v = this.view, c = v.ctx, S = this.game.data.citySize, st = this.game.state;
    v.begin();
    const tw = v.tileW * v.zoom;
    // фон
    c.fillStyle = '#3f6b33'; c.fillRect(0, 0, v.w, v.h);
    const bounds = v.visibleBounds(S + 8);
    // трава снаружи + тайлы города
    for (let y = -4; y < S + 4; y++) for (let x = -4; x < S + 4; x++) {
      const p = v.toScreen(x, y);
      if (p.x < -tw || p.x > v.w + tw || p.y < -tw || p.y > v.h + tw) continue;
      const inside = x >= 0 && y >= 0 && x < S && y < S;
      Assets.draw(c, 'terrain', 'grass', p.x, p.y, tw, tw);
      if (inside) v.diamond(x, y, null, 'rgba(255,255,255,.08)');
    }
    // подсветки
    if (this.hover && this.hover.x >= 0 && this.hover.y >= 0 && this.hover.x < S && this.hover.y < S) {
      const occ = st.buildings.some(b => b.x === this.hover.x && b.y === this.hover.y);
      v.diamond(this.hover.x, this.hover.y, this.buildMode ? (occ ? 'rgba(220,60,60,.45)' : 'rgba(80,220,120,.45)') : 'rgba(255,255,255,.18)');
    }
    if (this.selected) v.diamond(this.selected.x, this.selected.y, 'rgba(255,220,80,.35)', '#ffd84a');
    // объекты по глубине
    const objs = [];
    for (const d of this.decor) objs.push({ x: d.x, y: d.y, kind: 'decor', frame: d.frame });
    for (const b of st.buildings) objs.push({ x: b.x, y: b.y, kind: 'building', b });
    objs.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);
    const bh = tw; // здания квадратные
    for (const o of objs) {
      const p = v.toScreen(o.x, o.y);
      if (p.x < -tw || p.x > v.w + tw || p.y < -tw * 1.5 || p.y > v.h + tw) continue;
      const baseY = p.y + v.tileH * v.zoom / 2;
      if (o.kind === 'decor') { Assets.draw(c, 'misc', o.frame, p.x, baseY, tw * 0.7, tw * 0.7); continue; }
      const b = o.b;
      if (b.level === 0) Assets.draw(c, 'misc', 'construction', p.x, baseY, tw, bh);
      else Assets.draw(c, 'buildings', b.type, p.x, baseY, tw, bh);
      // уровень
      if (b.level > 0 && v.zoom > 0.6) {
        c.font = `bold ${12 * v.zoom + 4}px sans-serif`; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 3;
        const txt = `${b.level}`; c.strokeText(txt, p.x, p.y - tw * 0.55); c.fillText(txt, p.x, p.y - tw * 0.55);
      }
      // прогресс стройки
      if (b.upgrade_until) {
        const def = this.game.data.buildings[b.type];
        const total = def.levels[b.level].time; // время до level+1
        const left = Math.max(0, b.upgrade_until - now);
        const frac = 1 - Math.min(1, left / total);
        const w = tw * 0.6, hh = 6 * Math.max(0.6, v.zoom), bx = p.x - w / 2, by = p.y - tw * 0.75;
        c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(bx - 1, by - 1, w + 2, hh + 2);
        c.fillStyle = '#f0c040'; c.fillRect(bx, by, w * frac, hh);
        c.font = `${11 * Math.max(0.7, v.zoom)}px sans-serif`; c.fillStyle = '#fff'; c.textAlign = 'center';
        c.fillText(fmtTime(left), p.x, by - 3);
      }
    }
  }
}
export function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  if (s < 60) return s + 'с';
  if (s < 3600) return Math.floor(s / 60) + 'м ' + (s % 60) + 'с';
  return Math.floor(s / 3600) + 'ч ' + Math.floor((s % 3600) / 60) + 'м';
}
