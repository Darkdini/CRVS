// Сцена общего мира.
import { Assets } from './assets.js';
import { IsoView } from './iso.js';

export class WorldScene {
  constructor(canvas, game) {
    this.game = game;
    this.view = new IsoView(canvas, { tileW: 96, zoom: 0.8, minZoom: 0.3, maxZoom: 2 });
    this.world = null; this.selected = null; this.hover = null;
    this.view.onTap = (t) => this.tap(t);
    this.view.onHover = (t) => { this.hover = t; };
  }
  setWorld(w) {
    this.world = w;
    const S = w.size; this.grid = new Array(S * S);
    for (const t of w.tiles) this.grid[t.y * S + t.x] = t;
    this.objects = new Map();
    for (const p of w.players) this.objects.set(p.world_x + ',' + p.world_y, { kind: 'city', player: p });
    for (const b of w.bosses) this.objects.set(b.x + ',' + b.y, { kind: 'boss', boss: b });
    for (const t of w.tiles) if (t.object && t.object.startsWith('node:')) this.objects.set(t.x + ',' + t.y, { kind: 'node', node: t.object.slice(5), x: t.x, y: t.y });
    this.cooldowns = new Map(); for (const c of w.cooldowns) this.cooldowns.set(c.x + ',' + c.y, c.ready_at);
    if (!this._centered) { const me = this.game.state.player; this.view.centerOn(me.worldX, me.worldY); this._centered = true; }
  }
  tap(t) {
    if (!this.world) return;
    const S = this.world.size;
    if (t.x < 0 || t.y < 0 || t.x >= S || t.y >= S) { this.selected = null; this.game.ui.closePanel(); return; }
    this.selected = { x: t.x, y: t.y };
    const o = this.objects.get(t.x + ',' + t.y);
    const tile = this.grid[t.y * S + t.x];
    this.game.ui.showWorldTile(tile, o, this.cooldowns.get(t.x + ',' + t.y) || 0);
  }
  draw(now) {
    const v = this.view, c = v.ctx;
    v.begin();
    c.fillStyle = '#1d2a3a'; c.fillRect(0, 0, v.w, v.h);
    if (!this.world) return;
    const S = this.world.size, tw = v.tileW * v.zoom;
    const b = v.visibleBounds(S);
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const t = this.grid[y * S + x]; if (!t) continue;
      const p = v.toScreen(x, y);
      if (p.x < -tw || p.x > v.w + tw || p.y < -tw || p.y > v.h + tw) continue;
      Assets.draw(c, 'terrain', t.terrain, p.x, p.y, tw, tw);
    }
    if (this.hover) v.diamond(this.hover.x, this.hover.y, 'rgba(255,255,255,.15)');
    if (this.selected) v.diamond(this.selected.x, this.selected.y, 'rgba(255,220,80,.3)', '#ffd84a');
    const me = this.game.state.player;
    v.diamond(me.worldX, me.worldY, null, '#ffe680');
    const objs = [...this.objects.values()].map(o => ({ o, x: o.kind === 'city' ? o.player.world_x : o.kind === 'boss' ? o.boss.x : o.x, y: o.kind === 'city' ? o.player.world_y : o.kind === 'boss' ? o.boss.y : o.y }))
      .filter(e => e.x >= b.x0 && e.x <= b.x1 && e.y >= b.y0 && e.y <= b.y1).sort((a, b2) => (a.x + a.y) - (b2.x + b2.y));
    for (const e of objs) {
      const p = v.toScreen(e.x, e.y); const baseY = p.y + v.tileH * v.zoom / 2; const o = e.o;
      if (o.kind === 'city') {
        const mine = o.player.id === me.id;
        Assets.draw(c, 'world', mine ? 'city_player' : 'city_other', p.x, baseY, tw, tw);
        if (v.zoom > 0.55) label(c, o.player.city_name, p.x, p.y - tw * 0.6, 11 * Math.max(0.8, v.zoom), mine ? '#ffe680' : '#fff');
      } else if (o.kind === 'boss') {
        const bs = o.boss; const alive = bs.dead_until <= now;
        c.globalAlpha = alive ? 1 : 0.4;
        Assets.draw(c, 'bosses', bs.key, p.x, baseY, tw * 1.2, tw * 1.2);
        c.globalAlpha = 1;
        if (v.zoom > 0.45) {
          label(c, `${bs.name} (${bs.level})`, p.x, p.y - tw * 0.8, 11 * Math.max(0.8, v.zoom), '#ffb3b3');
          const w = tw * 0.8, bx = p.x - w / 2, by = p.y - tw * 0.72;
          c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(bx - 1, by - 1, w + 2, 6);
          c.fillStyle = alive ? '#e04040' : '#666'; c.fillRect(bx, by, w * (alive ? bs.hp / bs.maxHp : 0), 4);
        }
      } else {
        const cd = this.cooldowns.get(e.x + ',' + e.y) || 0;
        c.globalAlpha = cd > now ? 0.45 : 1;
        Assets.draw(c, 'world', o.node, p.x, baseY, tw * 0.9, tw * 0.9);
        c.globalAlpha = 1;
      }
    }
  }
}
function label(c, text, x, y, size, color) {
  c.font = `bold ${size}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y);
}
