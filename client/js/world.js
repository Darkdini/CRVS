// Сцена общего мира: местность, города, монстры, боссы, ресурсы, походы.
import { Assets } from './assets.js';
import { IsoView } from './iso.js';
import { FX } from './fx.js';

export class WorldScene {
  constructor(canvas, game) {
    this.game = game;
    this.view = new IsoView(canvas, { tileW: 96, zoom: 0.8, minZoom: 0.3, maxZoom: 2 });
    this.world = null; this.selected = null; this.hover = null; this.fx = new FX(); this.time = 0;
    this.view.onTap = (t) => this.tap(t);
    this.view.onHover = (t) => { this.hover = t; };
  }
  setWorld(w) {
    this.world = w;
    const S = w.size; this.grid = new Array(S * S);
    for (const t of w.tiles) this.grid[t.y * S + t.x] = t;
    this.tags = {}; for (const a of w.alliances) this.tags[a.id] = a.tag;
    this.objects = new Map();
    for (const p of w.players) this.objects.set(p.world_x + ',' + p.world_y, { kind: 'city', player: p, x: p.world_x, y: p.world_y });
    for (const b of w.bosses) this.objects.set(b.x + ',' + b.y, { kind: 'boss', boss: b, x: b.x, y: b.y });
    for (const m of w.monsters) this.objects.set(m.x + ',' + m.y, { kind: 'monster', monster: m, x: m.x, y: m.y });
    for (const t of w.tiles) if (t.object && t.object.startsWith('node:')) this.objects.set(t.x + ',' + t.y, { kind: 'node', node: t.object.slice(5), x: t.x, y: t.y });
    this.cooldowns = new Map(); for (const c of w.cooldowns) this.cooldowns.set(c.x + ',' + c.y, c.ready_at);
    this.others = w.others || [];
    if (!this._centered) { const me = this.game.state.player; this.view.centerOn(me.worldX, me.worldY); this._centered = true; }
  }
  tap(t) {
    if (!this.world) return;
    const S = this.world.size;
    if (t.x < 0 || t.y < 0 || t.x >= S || t.y >= S) { this.selected = null; this.game.ui.closePanel(); return; }
    this.selected = { x: t.x, y: t.y };
    this.game.ui.showWorldTile(this.grid[t.y * S + t.x], this.objects.get(t.x + ',' + t.y), this.cooldowns.get(t.x + ',' + t.y) || 0);
  }
  // позиция похода в мировых координатах (с дробями)
  marchPos(m, now, homeX, homeY) {
    let f = 0;
    if (m.status === 'going') f = Math.min(1, Math.max(0, (now - m.depart_at) / m.travel));
    else if (m.status === 'working') f = 1;
    else f = Math.max(0, Math.min(1, (m.return_at - now) / m.travel));
    return { x: homeX + (m.target_x - homeX) * f, y: homeY + (m.target_y - homeY) * f, f };
  }
  draw(now, dt) {
    const v = this.view, c = v.ctx;
    this.time += dt; v.update(dt); this.fx.update(dt);
    v.begin();
    const bg = c.createLinearGradient(0, 0, 0, v.h); bg.addColorStop(0, '#1b2838'); bg.addColorStop(1, '#0f1722'); c.fillStyle = bg; c.fillRect(0, 0, v.w, v.h);
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
    if (this.selected) { const a = .2 + .15 * Math.sin(this.time * 5); v.diamond(this.selected.x, this.selected.y, `rgba(255,220,80,${a})`, '#ffd84a'); }
    const me = this.game.state.player;
    v.diamond(me.worldX, me.worldY, null, '#ffe680');
    // бой: пульс у цели активных походов
    for (const m of (this.game.state.marches || [])) if (m.status !== 'returning') { const a = .15 + .1 * Math.sin(this.time * 6); v.diamond(m.target_x, m.target_y, `rgba(255,90,60,${a})`); }
    // линии походов
    const marches = this.game.state.marches || [];
    c.setLineDash([6 * v.zoom, 6 * v.zoom]);
    for (const m of marches) {
      const a = v.toScreen(me.worldX, me.worldY), t = v.toScreen(m.target_x, m.target_y);
      c.strokeStyle = m.kind === 'gather' ? 'rgba(120,220,140,.8)' : 'rgba(255,120,80,.8)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(t.x, t.y); c.stroke();
    }
    c.setLineDash([]);
    // объекты
    const objs = [...this.objects.values()].filter(e => e.x >= b.x0 && e.x <= b.x1 && e.y >= b.y0 && e.y <= b.y1).map(o => ({ o, x: o.x, y: o.y }));
    for (const m of marches) { const p = this.marchPos(m, now, me.worldX, me.worldY); objs.push({ o: { kind: 'march', march: m, mine: true }, x: p.x, y: p.y }); }
    for (const m of this.others) { const p = this.marchPos(m, now, m.world_x, m.world_y); if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1) objs.push({ o: { kind: 'march', march: m, mine: false }, x: p.x, y: p.y }); }
    objs.sort((a, b2) => (a.x + a.y) - (b2.x + b2.y));
    const fs = Math.max(0.8, v.zoom);
    for (const e of objs) {
      const p = v.toScreen(e.x, e.y); const baseY = p.y + v.tileH * v.zoom / 2; const o = e.o;
      if (o.kind === 'city') {
        const mine = o.player.id === me.id;
        const ally = !mine && me.alliance && o.player.alliance_id === me.alliance.id;
        Assets.draw(c, 'world', mine ? 'city_player' : 'city_other', p.x, baseY, tw, tw);
        if (v.zoom > 0.55) {
          const tag = o.player.alliance_id && this.tags[o.player.alliance_id] ? `[${this.tags[o.player.alliance_id]}] ` : '';
          label(c, tag + o.player.city_name, p.x, p.y - tw * 0.6, 11 * fs, mine ? '#ffe680' : ally ? '#9fe0ff' : '#fff');
        }
      } else if (o.kind === 'boss') {
        const bs = o.boss; const alive = bs.dead_until <= now;
        if (alive) { const g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, tw * .8); g.addColorStop(0, `rgba(255,60,60,${.25 + .1 * Math.sin(this.time * 3)})`); g.addColorStop(1, 'rgba(255,60,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, tw * .8, 0, 7); c.fill(); }
        c.globalAlpha = alive ? 1 : 0.4;
        Assets.draw(c, 'bosses', bs.key, p.x, baseY - (alive ? Math.abs(Math.sin(this.time * 2 + e.x)) * 3 * v.zoom : 0), tw * 1.3, tw * 1.3);
        c.globalAlpha = 1;
        if (v.zoom > 0.45) {
          label(c, `☠ ${bs.name}`, p.x, p.y - tw * 0.85, 11 * fs, '#ffb3b3');
          bar(c, p.x, p.y - tw * 0.75, tw * 0.8, alive ? bs.hp / bs.maxHp : 0, alive ? '#e04040' : '#666');
        }
      } else if (o.kind === 'monster') {
        const m = o.monster;
        const bob = Math.abs(Math.sin(this.time * 3 + e.x * 1.7 + e.y)) * 2.5 * v.zoom;
        Assets.draw(c, 'monsters', m.type, p.x, baseY - bob, tw * 0.85, tw * 0.85);
        if (v.zoom > 0.5) {
          badge(c, p.x, p.y - tw * 0.6, m.level, m.level <= 5 ? '#4caf50' : m.level <= 12 ? '#ff9800' : '#e53935', fs);
          if (m.hp < m.maxHp) bar(c, p.x, p.y - tw * 0.48, tw * 0.5, m.hp / m.maxHp, '#e04040');
        }
      } else if (o.kind === 'node') {
        const cd = this.cooldowns.get(e.x + ',' + e.y) || 0;
        c.globalAlpha = cd > now ? 0.45 : 1;
        Assets.draw(c, 'world', o.node, p.x, baseY, tw * 0.9, tw * 0.9);
        c.globalAlpha = 1;
      } else if (o.kind === 'march') {
        const m = o.march;
        const unit = o.mine ? slowest(m.army, this.game.data.units) : 'scout';
        const step = m.status === 'working' ? 0 : Math.abs(Math.sin(this.time * 10)) * 3 * v.zoom;
        if (m.status !== 'working' && Math.random() < dt * 6) this.fx.emit(e.x, e.y, { spread: .3, up: .2, life: .8, size: 2.5, grow: 2, color: 'rgba(200,180,140,.5)' });
        Assets.draw(c, 'units', unit, p.x, baseY - step, tw * 0.55, tw * 0.55);
        if (o.mine) {
          const left = m.status === 'going' ? m.arrive_at - now : m.status === 'working' ? m.work_until - now : m.return_at - now;
          label(c, (m.status === 'going' ? '→ ' : m.status === 'working' ? '⛏ ' : '← ') + fmtShort(left), p.x, p.y - tw * 0.5, 10 * fs, '#fff');
        } else if (v.zoom > 0.7) label(c, m.username, p.x, p.y - tw * 0.45, 9 * fs, '#ddd');
      }
    }
    this.fx.draw(c, (x, y) => v.toScreen(x, y), v.zoom);
  }
}
function slowest(army, units) { let best = null, s = Infinity; for (const t in army) if (army[t] > 0 && units[t].speed < s) { s = units[t].speed; best = t; } return best || 'scout'; }
function fmtShort(s) { s = Math.max(0, Math.floor(s)); return s < 60 ? s + 'с' : Math.floor(s / 60) + 'м' + (s % 60 ? (s % 60) + 'с' : ''); }
function label(c, text, x, y, size, color) {
  c.font = `bold ${size}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y);
}
function bar(c, x, y, w, f, color) {
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  c.fillStyle = color; c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, f)), 4);
}
function badge(c, x, y, text, color, fs) {
  const r = 9 * fs;
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.stroke();
  c.font = `bold ${10 * fs}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(String(text), x, y + 0.5);
}
