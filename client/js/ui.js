// DOM-интерфейс: панели, меню, модалки.
import { API } from './api.js';
import { fmtTime } from './city.js';

const RES_NAMES = { food: 'Еда', wood: 'Дерево', stone: 'Камень', iron: 'Железо', gold: 'Золото' };
const SLOT_NAMES = { weapon: 'Оружие', armor: 'Доспех', helmet: 'Шлем', boots: 'Сапоги', ring: 'Кольцо', amulet: 'Амулет' };
const STAT_NAMES = { atk: 'атаки', def: 'защиты', hp: 'здоровья' };
const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(game) {
    this.game = game;
    this.panel = $('#panel'); this.panelBody = $('#panel-body'); this.panelTitle = $('#panel-title');
    $('#panel-close').onclick = () => this.closePanel();
    this.chatSince = 0; this.chatTimer = null;
  }
  iconHtml(k) { return `<span class="ico ico-${k}" title="${RES_NAMES[k] || k}"></span>`; }
  costHtml(cost, res) {
    return Object.entries(cost).map(([k, v]) => {
      const bad = res && res[k] < v;
      return `<span class="cost ${bad ? 'bad' : ''}">${this.iconHtml(k)}${v}</span>`;
    }).join(' ');
  }
  toast(msg, kind = '') {
    const t = el('div', 'toast ' + kind, esc(msg)); $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
  }
  openPanel(title, bodyEl) {
    this.panelTitle.textContent = title; this.panelBody.innerHTML = ''; this.panelBody.appendChild(bodyEl);
    this.panel.classList.add('open'); this.stopChat();
  }
  closePanel() { this.panel.classList.remove('open'); this.stopChat(); this.game.city.buildMode = null; }
  isOpen() { return this.panel.classList.contains('open'); }

  // ---------- верхняя панель ----------
  renderTop() {
    const p = this.game.state.player;
    const bar = $('#resbar'); bar.innerHTML = '';
    for (const k of this.game.data.resources) {
      const v = p.resources[k], prod = p.production[k];
      const full = v >= p.capacity && k !== 'gold';
      bar.appendChild(el('div', 'res' + (full ? ' full' : ''), `${this.iconHtml(k)}<b>${fmt(v)}</b><small>+${Math.floor(prod)}/ч</small>`));
    }
    $('#cityname').textContent = p.cityName;
    $('#power').innerHTML = `${this.iconHtml('power')}${p.power}`;
    $('#cap').textContent = 'Склад: ' + fmt(p.capacity);
    const st = this.game.state;
    const ready = st.quests.filter(q => q.ready).length;
    $('#btn-quests').innerHTML = '📜' + (ready ? `<i>${ready}</i>` : '');
    $('#btn-marches').innerHTML = '🏇' + (st.marches.length ? `<i>${st.marches.length}</i>` : '');
    const wounded = Object.values(st.wounded).reduce((a, b) => a + b, 0);
    $('#btn-hospital').style.display = wounded ? '' : 'none'; $('#btn-hospital').innerHTML = '🏥<i>' + wounded + '</i>';
  }

  // ---------- город ----------
  showBuildMenu(x, y) {
    const g = this.game, st = g.state, res = st.player.resources;
    const body = el('div');
    body.appendChild(el('p', 'muted', `Клетка ${x}:${y}. Выбери, что построить.`));
    const th = Math.max(...st.buildings.filter(b => b.type === 'townhall').map(b => b.level), 0);
    for (const [key, def] of Object.entries(g.data.buildings)) {
      const have = st.buildings.filter(b => b.type === key).length;
      const limit = def.unique ? 1 : th + 1;
      const l1 = def.levels[0];
      const card = el('div', 'card');
      card.innerHTML = `<div class="card-ico"><canvas data-sheet="buildings" data-frame="${key}" width="64" height="64"></canvas></div>
        <div class="card-main"><b>${def.name}</b> <span class="muted">${have}/${limit}</span><div class="muted small">${def.desc}</div>
        <div>${this.costHtml(l1.cost, res)} <span class="muted">${this.iconHtml('time')}${fmtTime(l1.time)}</span></div></div>`;
      const btn = el('button', 'btn', 'Строить');
      btn.disabled = have >= limit;
      btn.onclick = () => g.actions.build(key, x, y);
      card.appendChild(btn); body.appendChild(card);
    }
    this.openPanel('Строительство', body); this.paintIcons(body);
  }
  showBuilding(b) {
    const g = this.game, st = g.state, def = g.data.buildings[b.type], res = g.state.player.resources;
    const body = el('div');
    const cur = b.level > 0 ? def.levels[b.level - 1] : null;
    const next = b.level < def.maxLevel ? def.levels[b.level] : null;
    let info = `<div class="card"><div class="card-ico"><canvas data-sheet="buildings" data-frame="${b.type}" width="80" height="80"></canvas></div>
      <div class="card-main"><b>${def.name}</b> — уровень ${b.level}${b.level === 0 ? ' (строится)' : ''}<div class="muted small">${def.desc}</div></div></div>`;
    if (cur) {
      const lines = [];
      for (const k in cur.production) lines.push(`${this.iconHtml(k)}+${cur.production[k]}/ч`);
      if (cur.capacity) lines.push(`Вместимость +${cur.capacity}`);
      if (cur.defense) lines.push(`Защита +${cur.defense}`);
      if (b.type === 'hospital') lines.push(`Койки: ${st.player.beds}`);
      if (lines.length) info += `<p>Сейчас: ${lines.join(' · ')}</p>`;
    }
    if (next) {
      const lines = [];
      for (const k in next.production) lines.push(`${this.iconHtml(k)}+${next.production[k]}/ч`);
      if (next.capacity) lines.push(`Вместимость +${next.capacity}`);
      if (next.defense) lines.push(`Защита +${next.defense}`);
      info += `<p>Уровень ${b.level + 1}: ${lines.join(' · ') || '—'}<br>${this.costHtml(next.cost, res)} ${this.iconHtml('time')}${fmtTime(next.time)}</p>`;
    } else info += '<p>Максимальный уровень</p>';
    body.innerHTML = info;
    if (b.upgrade_until) {
      const t = el('p', 'timer'); body.appendChild(t);
      t.dataset.until = b.upgrade_until; t.textContent = 'Строится: ' + fmtTime(b.upgrade_until - g.now());
    } else if (next) {
      const btn = el('button', 'btn primary', `Улучшить до ${b.level + 1}`); btn.onclick = () => g.actions.upgrade(b.id); body.appendChild(btn);
    }
    if (b.type === 'barracks' && b.level > 0) { const bt = el('button', 'btn', 'Обучить войска'); bt.onclick = () => this.showArmy(); body.appendChild(bt); }
    if (b.type === 'tavern' && b.level > 0) { const bt = el('button', 'btn', 'Герои'); bt.onclick = () => this.showHeroes(); body.appendChild(bt); }
    if (b.type === 'market' && b.level > 0) { const bt = el('button', 'btn', 'Торговать'); bt.onclick = () => this.showMarket(); body.appendChild(bt); }
    if (b.type === 'academy' && b.level > 0) { const bt = el('button', 'btn', 'Исследования'); bt.onclick = () => this.showAcademy(); body.appendChild(bt); }
    if (b.type === 'hospital' && b.level > 0) { const bt = el('button', 'btn', 'Раненые'); bt.onclick = () => this.showHospital(); body.appendChild(bt); }
    if (b.type === 'embassy' && b.level > 0) { const bt = el('button', 'btn', 'Альянс'); bt.onclick = () => this.showAlliance(); body.appendChild(bt); }
    if (b.type !== 'townhall') { const d = el('button', 'btn danger', 'Снести'); d.onclick = () => { if (confirm('Снести здание?')) g.actions.demolish(b.id); }; body.appendChild(d); }
    this.openPanel(def.name, body); this.paintIcons(body);
  }

  // ---------- армия ----------
  showArmy() {
    const g = this.game, st = g.state, res = st.player.resources;
    const body = el('div');
    const bl = Math.max(...st.buildings.filter(b => b.type === 'barracks').map(b => b.level), 0);
    body.appendChild(el('p', 'muted', bl ? `Казармы ${bl} ур. Очередь: ${st.training.length}/3` : 'Построй казармы, чтобы обучать войска.'));
    for (const tr of st.training) {
      const u = g.data.units[tr.type];
      const row = el('div', 'row timer'); row.dataset.until = tr.finish_at; row.dataset.prefix = `${u.name} ×${tr.count}: `;
      row.textContent = row.dataset.prefix + fmtTime(tr.finish_at - g.now()); body.appendChild(row);
    }
    for (const [key, u] of Object.entries(g.data.units)) {
      const have = st.units[key] || 0;
      const card = el('div', 'card');
      card.innerHTML = `<div class="card-ico"><canvas data-sheet="units" data-frame="${key}" width="64" height="64"></canvas></div>
        <div class="card-main"><b>${u.name}</b> <span class="muted">есть: ${have}</span><div class="small muted">⚔${u.atk} 🛡${u.def} ❤${u.hp} · ${fmtTime(u.time)}/шт · казармы ${u.barracks} ур.</div>
        <div>${this.costHtml(u.cost, res)}</div></div>`;
      const ctl = el('div', 'train');
      const inp = el('input'); inp.type = 'number'; inp.min = 1; inp.value = 5; inp.max = 500;
      const btn = el('button', 'btn', 'Обучить'); btn.disabled = bl < u.barracks;
      btn.onclick = () => g.actions.train(key, +inp.value);
      ctl.appendChild(inp); ctl.appendChild(btn); card.appendChild(ctl); body.appendChild(card);
    }
    this.openPanel('Армия', body); this.paintIcons(body);
  }

  // ---------- герои ----------
  showHeroes() {
    const g = this.game, st = g.state;
    const body = el('div');
    const tl = Math.max(...st.buildings.filter(b => b.type === 'tavern').map(b => b.level), 0);
    body.appendChild(el('p', 'muted', tl ? `Таверна ${tl} ур. Героев: ${st.heroes.length}/${tl}` : 'Построй таверну, чтобы нанимать героев.'));
    const busy = new Set((st.marches || []).flatMap(m => m.hero_ids));
    for (const h of st.heroes) {
      const card = el('div', 'card');
      const inj = h.injured_until > g.now();
      card.innerHTML = `<div class="card-ico"><canvas data-sheet="heroes" data-frame="${h.class}" width="80" height="80"></canvas></div>
        <div class="card-main"><b>${esc(h.name)}</b> — ${h.className}, ${h.level} ур.${inj ? ' <span class="bad">ранен</span>' : ''}${busy.has(h.id) ? ' <span class="muted">в походе</span>' : ''}
        <div class="small">⚔${h.atk} 🛡${h.def} ❤${h.hp} <span class="muted">(экип. +${h.atk - h.baseAtk}/+${h.def - h.baseDef}/+${h.hp - h.baseHp})</span></div><div class="small muted">${h.skill}</div>
        <div class="bar"><i style="width:${Math.min(100, 100 * h.xp / h.nextXp)}%"></i></div><div class="small muted">Опыт ${h.xp}/${h.nextXp}</div></div>`;
      card.style.cursor = 'pointer'; card.onclick = () => this.showHero(h.id);
      body.appendChild(card);
    }
    if (tl > 0 && st.heroes.length < tl) {
      const cost = g.data.heroCost[st.heroes.length];
      const btn = el('button', 'btn primary', `Нанять героя — ${Object.entries(cost).map(([k, v]) => `${v} ${RES_NAMES[k]}`).join(', ')}`);
      btn.onclick = () => g.actions.recruitHero(); body.appendChild(btn);
      body.appendChild(el('p', 'small muted', 'Класс героя выпадает случайно: Рыцарь, Лучница, Маг или Плут.'));
    }
    if (st.items.length) { const b = el('button', 'btn', `🎒 Инвентарь (${st.items.length})`); b.onclick = () => this.showInventory(); body.appendChild(b); }
    this.openPanel('Герои', body); this.paintIcons(body);
  }
  rarity(key) { return (this.game.data.rarities.find(r => r.key === key) || {}); }
  itemHtml(it) {
    const r = this.rarity(it.rarity);
    return `<div class="card-ico sm"><canvas data-sheet="items" data-frame="${it.slot}_${it.tier}" width="48" height="48"></canvas></div>
      <div class="card-main"><b style="color:${r.color}">${esc(it.name)}</b> <span class="small muted">${r.name}</span><div class="small">${SLOT_NAMES[it.slot]} · +${it.value} ${STAT_NAMES[it.stat]}</div></div>`;
  }
  showHero(id) {
    const g = this.game, st = g.state, h = st.heroes.find(x => x.id === id);
    if (!h) return this.showHeroes();
    const body = el('div');
    body.appendChild(el('div', 'card', `<div class="card-ico big"><canvas data-sheet="heroes" data-frame="${h.class}" width="96" height="96"></canvas></div>
      <div class="card-main"><b>${esc(h.name)}</b> — ${h.className}, ${h.level} ур.<div>⚔${h.atk} 🛡${h.def} ❤${h.hp}</div><div class="small muted">${h.skill}</div></div>`));
    body.appendChild(el('h3', null, 'Экипировка'));
    for (const slot of g.data.itemSlots) {
      const it = h.equipment.find(i => i.slot === slot);
      const row = el('div', 'card');
      if (it) {
        row.innerHTML = this.itemHtml(it);
        const b = el('button', 'btn small', 'Снять'); b.onclick = () => g.actions.equip(it.id, null, h.id); row.appendChild(b);
      } else {
        row.innerHTML = `<div class="card-ico sm empty"></div><div class="card-main muted">${SLOT_NAMES[slot]} — пусто</div>`;
        const fit = st.items.filter(i => i.slot === slot);
        if (fit.length) { const b = el('button', 'btn small', `Надеть (${fit.length})`); b.onclick = () => this.showInventory(h.id, slot); row.appendChild(b); }
      }
      body.appendChild(row);
    }
    const back = el('button', 'btn', '← Герои'); back.onclick = () => this.showHeroes(); body.appendChild(back);
    this.openPanel(h.name, body); this.paintIcons(body);
  }
  showInventory(heroId, slot) {
    const g = this.game, st = g.state;
    const body = el('div');
    const items = st.items.filter(i => !slot || i.slot === slot).sort((a, b) => b.value - a.value);
    body.appendChild(el('p', 'muted', heroId ? 'Выбери предмет для героя.' : 'Трофеи с монстров и боссов. Кузница повышает цену продажи.'));
    for (const it of items) {
      const row = el('div', 'card'); row.innerHTML = this.itemHtml(it);
      if (heroId) { const b = el('button', 'btn primary small', 'Надеть'); b.onclick = () => g.actions.equip(it.id, heroId, heroId); row.appendChild(b); }
      else {
        const sel = el('select'); sel.appendChild(new Option('Надеть на…', ''));
        for (const h of st.heroes) sel.appendChild(new Option(h.name, h.id));
        sel.onchange = () => { if (sel.value) g.actions.equip(it.id, +sel.value, +sel.value); };
        const s2 = el('button', 'btn small', `Продать ${it.price}${this.iconHtml('gold')}`); s2.onclick = () => g.actions.sellItem(it.id);
        const ctl = el('div', 'train'); ctl.append(sel, s2); row.appendChild(ctl);
      }
      body.appendChild(row);
    }
    if (!items.length) body.appendChild(el('p', 'muted', 'Пусто. Сходи на монстров.'));
    const back = el('button', 'btn', '← Назад'); back.onclick = () => heroId ? this.showHero(heroId) : this.showHeroes(); body.appendChild(back);
    this.openPanel('Инвентарь', body); this.paintIcons(body);
  }

  // ---------- рынок ----------
  showMarket() {
    const g = this.game;
    const body = el('div');
    body.innerHTML = `<p class="muted">Курс: еда 1, дерево 1, камень 1.2, железо 2.5, золото 4. Комиссия снижается с уровнем рынка.</p>`;
    const form = el('div', 'row');
    const mk = () => { const s = el('select'); for (const k of g.data.resources) s.appendChild(new Option(RES_NAMES[k], k)); return s; };
    const from = mk(), to = mk(); to.value = 'stone';
    const amt = el('input'); amt.type = 'number'; amt.value = 100; amt.min = 1;
    const btn = el('button', 'btn primary', 'Обменять'); btn.onclick = () => g.actions.trade(from.value, to.value, +amt.value);
    form.append('Отдать ', amt, from, ' → ', to, btn); body.appendChild(form);
    this.openPanel('Рынок', body);
  }

  // ---------- мир ----------
  showWorldTile(tile, o, cooldown) {
    const g = this.game, me = g.state.player;
    const body = el('div');
    const terr = { grass: 'Луга', dirt: 'Пустошь', forest: 'Лес', mountain: 'Горы', water: 'Вода', sand: 'Побережье', swamp: 'Болото', snow: 'Снега' }[tile.terrain];
    const dist = Math.abs(me.worldX - tile.x) + Math.abs(me.worldY - tile.y);
    body.appendChild(el('p', 'muted', `${terr} · ${tile.x}:${tile.y} · путь от города: ${dist}`));
    if (!o) { this.openPanel('Мир', body); return; }
    if (o.kind === 'city') {
      const mine = o.player.id === me.id;
      const ally = !mine && me.alliance && o.player.alliance_id === me.alliance.id;
      body.appendChild(el('div', 'card', `<div class="card-ico"><canvas data-sheet="world" data-frame="${mine ? 'city_player' : 'city_other'}" width="64" height="64"></canvas></div>
        <div class="card-main"><b>${esc(o.player.city_name)}</b><div class="muted">${mine ? 'Ваш город' : 'Правитель: ' + esc(o.player.username)}${ally ? ' · <span class="good">союзник</span>' : ''}</div></div>`));
      if (mine) { const b = el('button', 'btn primary', 'Войти в город'); b.onclick = () => { this.closePanel(); g.showScene('city'); }; body.appendChild(b); }
      else if (!ally) {
        const b = el('button', 'btn danger', '⚔ Набег');
        b.onclick = () => this.showMarchPicker('player', o.x, o.y, `Набег на ${o.player.city_name}`);
        body.appendChild(b);
        body.appendChild(el('p', 'small muted', 'Победа даёт до 15% ресурсов противника (сколько унесёт армия). У новичков щит 24ч, после атаки — щит 10 мин.'));
      }
      this.openPanel('Город', body); this.paintIcons(body); return;
    }
    if (o.kind === 'monster') {
      const m = o.monster;
      body.appendChild(el('div', 'card', `<div class="card-ico big"><canvas data-sheet="monsters" data-frame="${m.type}" width="96" height="96"></canvas></div>
        <div class="card-main"><b>${m.name}</b> — ${m.level} ур.<div class="bar red"><i style="width:${100 * m.hp / m.maxHp}%"></i></div><div class="small">${fmt(m.hp)} / ${fmt(m.maxHp)} HP</div>
        <div class="small muted">Добыча: ресурсы по уровню, шанс трофея ${Math.round(Math.min(60, 15 + m.level * 2))}%, опыт героям ${30 * m.level}.</div></div>`));
      const b = el('button', 'btn danger', '⚔ Атаковать'); b.onclick = () => this.showMarchPicker('monster', o.x, o.y, `${m.name} ${m.level} ур.`); body.appendChild(b);
      this.openPanel('Монстр', body); this.paintIcons(body); return;
    }
    if (o.kind === 'boss') {
      const bs = o.boss, alive = bs.dead_until <= g.now();
      body.appendChild(el('div', 'card', `<div class="card-ico big"><canvas data-sheet="bosses" data-frame="${bs.key}" width="96" height="96"></canvas></div>
        <div class="card-main"><b>${bs.name}</b> — босс ${bs.level} ур.<div class="small">⚔${bs.atk} 🛡${bs.def}</div>
        <div class="bar red"><i style="width:${alive ? 100 * bs.hp / bs.maxHp : 0}%"></i></div><div class="small">${alive ? `${fmt(bs.hp)} / ${fmt(bs.maxHp)}` : 'Возродится через ' + fmtTime(bs.dead_until - g.now())}</div>
        <div class="small muted">Награда делится по урону между всеми участниками, добивший ×1.5, каждому — трофей: ${Object.entries(bs.reward).map(([k, v]) => v + ' ' + RES_NAMES[k]).join(', ')}. Убит раз: ${bs.kills}${bs.last_killer ? ', последний: ' + esc(bs.last_killer) : ''}</div></div>`));
      const b = el('button', 'btn danger', '⚔ В бой!'); b.disabled = !alive;
      b.onclick = () => this.showMarchPicker('boss', o.x, o.y, `Бой с ${bs.name}`);
      body.appendChild(b);
      this.openPanel('Босс', body); this.paintIcons(body); return;
    }
    if (o.kind === 'node') {
      const nd = g.data.nodes[o.node];
      body.appendChild(el('div', 'card', `<div class="card-ico"><canvas data-sheet="world" data-frame="${o.node}" width="64" height="64"></canvas></div>
        <div class="card-main"><b>${nd.name}</b><div class="small muted">Даёт ${RES_NAMES[nd.resource]} — столько, сколько унесёт армия (до ${nd.amount * 2}). Сбор занимает время, потом откат ${fmtTime(nd.cooldown)}.</div></div>`));
      const b = el('button', 'btn primary', cooldown > g.now() ? 'Истощено: ' + fmtTime(cooldown - g.now()) : '⛏ Отправить сборщиков');
      b.disabled = cooldown > g.now(); b.onclick = () => this.showMarchPicker('gather', o.x, o.y, nd.name); body.appendChild(b);
      this.openPanel('Ресурсы', body); this.paintIcons(body);
    }
  }
  showMarchPicker(kind, x, y, title) {
    const g = this.game, st = g.state;
    const body = el('div');
    body.appendChild(el('p', 'muted', kind === 'gather' ? 'Чем больше воинов — тем больше унесут. Рыцари носят больше всех.' : 'Выбери войска и героев. Скорость похода — по самому медленному отряду.'));
    const inputs = {};
    for (const [k, n] of Object.entries(st.units)) {
      if (!n) continue;
      const row = el('div', 'row');
      const inp = el('input'); inp.type = 'range'; inp.min = 0; inp.max = n; inp.value = n;
      const lab = el('span', 'w', `${g.data.units[k].name}: <b>${n}</b>/${n}`);
      inp.oninput = () => { lab.querySelector('b').textContent = inp.value; preview(); };
      row.append(lab, inp); body.appendChild(row); inputs[k] = inp;
    }
    const heroBoxes = [];
    const busy = new Set((st.marches || []).flatMap(m => m.hero_ids));
    if (kind !== 'gather') for (const h of st.heroes) {
      const inj = h.injured_until > g.now(), away = busy.has(h.id);
      const l = el('label', 'row'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = !inj && !away; cb.disabled = inj || away; cb.value = h.id;
      l.append(cb, ` ${h.name} (${h.className} ${h.level} ур.)${inj ? ' — ранен' : away ? ' — в походе' : ''}`); body.appendChild(l); heroBoxes.push(cb);
    }
    if (!Object.keys(inputs).length && !heroBoxes.length) body.appendChild(el('p', 'bad', 'Нет свободных войск и героев.'));
    const info = el('p', 'small muted', '…'); body.appendChild(info);
    let timer = null;
    const preview = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const army = {}; for (const k in inputs) if (+inputs[k].value > 0) army[k] = +inputs[k].value;
        try { const r = await API.marchPreview(x, y, army); info.innerHTML = `Путь: ${r.dist} кл. · в одну сторону ${fmtTime(r.travel)} · унесут до ${fmt(r.carry)} ресурсов`; } catch (e) { info.textContent = e.message; }
      }, 150);
    };
    preview();
    const btn = el('button', 'btn ' + (kind === 'gather' ? 'primary' : 'danger'), kind === 'gather' ? 'Отправить' : 'В поход!');
    btn.onclick = () => { const army = {}; for (const k in inputs) army[k] = +inputs[k].value; g.actions.march(kind, x, y, army, heroBoxes.filter(c => c.checked).map(c => +c.value)); };
    body.appendChild(btn);
    this.openPanel(title, body);
  }
  showMarches() {
    const g = this.game, st = g.state, me = st.player;
    const body = el('div');
    const max = 1 + Math.floor(Math.max(...st.buildings.filter(b => b.type === 'townhall').map(b => b.level), 0) / 3);
    body.appendChild(el('p', 'muted', `Походов: ${st.marches.length}/${max}. Лимит растёт с ратушей (каждые 3 уровня).`));
    const KIND = { monster: '⚔ Монстр', boss: '☠ Босс', player: '🏰 Набег', gather: '⛏ Сбор' };
    for (const m of st.marches) {
      const card = el('div', 'card col');
      const army = Object.entries(m.army).filter(([, n]) => n > 0).map(([k, n]) => `${g.data.units[k].name} ×${n}`).join(', ') || 'герои';
      const until = m.status === 'going' ? m.arrive_at : m.status === 'working' ? m.work_until : m.return_at;
      const prefix = m.status === 'going' ? 'Прибытие через ' : m.status === 'working' ? 'Сбор ещё ' : 'Возвращение через ';
      card.innerHTML = `<b>${KIND[m.kind]} → ${m.target_x}:${m.target_y}</b><div class="small">${army}</div>`;
      const t = el('div', 'timer small'); t.dataset.until = until; t.dataset.prefix = prefix; t.textContent = prefix + fmtTime(until - g.now()); card.appendChild(t);
      if (Object.keys(m.loot).length) card.appendChild(el('div', 'small', 'Несут: ' + this.costHtml(m.loot)));
      if (m.status !== 'returning') { const b = el('button', 'btn', 'Отозвать'); b.onclick = () => g.actions.recall(m.id); card.appendChild(b); }
      body.appendChild(card);
    }
    if (!st.marches.length) body.appendChild(el('p', 'muted', 'Армия дома. Выбери цель на карте мира.'));
    this.openPanel('Походы', body);
  }

  // ---------- задания ----------
  showQuests() {
    const g = this.game, st = g.state;
    const body = el('div');
    body.appendChild(el('p', 'muted', `Цепочка заданий правителя. Выполнено: ${st.player.questsDone} из ${g.data.questsTotal}.`));
    for (const q of st.quests) {
      const card = el('div', 'card');
      card.innerHTML = `<div class="card-main"><b>${q.ready ? '✅ ' : '📜 '}${esc(q.title)}</b><div class="small muted">${esc(q.desc)}</div><div>Награда: ${this.costHtml(Object.fromEntries(Object.entries(q.reward).filter(([k]) => RES_NAMES[k])))}${q.reward.xpItem ? ' + предмет' : ''}</div></div>`;
      const b = el('button', 'btn primary', 'Забрать'); b.disabled = !q.ready; b.onclick = () => g.actions.claimQuest(q.id); card.appendChild(b);
      body.appendChild(card);
    }
    if (!st.quests.length) body.appendChild(el('p', 'good', 'Все задания выполнены. Ты — легенда!'));
    this.openPanel('Задания', body);
  }

  // ---------- академия ----------
  showAcademy() {
    const g = this.game, st = g.state, res = st.player.resources;
    const body = el('div');
    const al = Math.max(...st.buildings.filter(b => b.type === 'academy').map(b => b.level), 0);
    const busy = Object.entries(st.techs).find(([, t]) => t.finish_at);
    body.appendChild(el('p', 'muted', al ? `Академия ${al} ур. Одно исследование за раз. Уровень технологии ≤ уровня академии.` : 'Построй академию.'));
    for (const [key, def] of Object.entries(g.data.techs)) {
      const t = st.techs[key]; const next = def.levels[t.level];
      const card = el('div', 'card');
      card.innerHTML = `<div class="card-main"><b>${def.name}</b> <span class="muted">${t.level}/${def.max}</span><div class="small muted">${def.desc}</div>${next ? `<div>${this.costHtml(next.cost, res)} ${this.iconHtml('time')}${fmtTime(next.time)}</div>` : '<div class="good">Максимум</div>'}</div>`;
      if (t.finish_at) { const tm = el('div', 'timer small'); tm.dataset.until = t.finish_at; tm.dataset.prefix = 'Идёт: '; tm.textContent = 'Идёт: ' + fmtTime(t.finish_at - g.now()); card.appendChild(tm); }
      else if (next) { const b = el('button', 'btn primary', 'Изучить'); b.disabled = !!busy || al === 0 || t.level >= al; b.onclick = () => g.actions.research(key); card.appendChild(b); }
      body.appendChild(card);
    }
    this.openPanel('Академия', body);
  }

  // ---------- госпиталь ----------
  showHospital() {
    const g = this.game, st = g.state, res = st.player.resources;
    const body = el('div');
    const used = Object.values(st.wounded).reduce((a, b) => a + b, 0);
    body.appendChild(el('p', 'muted', `Койки: ${used}/${st.player.beds}. Лечение стоит 40% цены отряда. Без коек раненые гибнут.`));
    for (const [k, n] of Object.entries(st.wounded)) {
      const u = g.data.units[k]; const cost = {}; for (const r in u.cost) cost[r] = Math.ceil(u.cost[r] * 0.4 * n);
      const card = el('div', 'card');
      card.innerHTML = `<div class="card-ico"><canvas data-sheet="units" data-frame="${k}" width="64" height="64"></canvas></div><div class="card-main"><b>${u.name}</b> ×${n}<div>Вылечить всех: ${this.costHtml(cost, res)}</div></div>`;
      const b = el('button', 'btn primary', 'Лечить'); b.onclick = () => g.actions.heal(k, n); card.appendChild(b); body.appendChild(card);
    }
    if (!used) body.appendChild(el('p', 'good', 'Раненых нет.'));
    this.openPanel('Госпиталь', body); this.paintIcons(body);
  }

  // ---------- альянс ----------
  async showAlliance() {
    const g = this.game, st = g.state, me = st.player;
    const body = el('div', null, '<p class="muted">Загрузка…</p>'); this.openPanel('Альянс', body);
    try {
      if (me.alliance) {
        const { alliance: a } = await API.alliance(me.alliance.id);
        body.innerHTML = `<h3>[${esc(a.tag)}] ${esc(a.name)}</h3><p class="small muted">${esc(a.description || '')}</p><p>Участников: ${a.members.length}/30 · Сила: ${fmt(a.power)}</p>`;
        for (const m of a.members) {
          const row = el('div', 'row' + (m.id === me.id ? ' me' : ''), `<span class="w">${m.leader ? '👑 ' : ''}<b>${esc(m.username)}</b> — ${esc(m.city_name)} <span class="muted small">${m.world_x}:${m.world_y}</span></span><span>${this.iconHtml('power')}${m.power}</span>`);
          if (a.leader_id === me.id && m.id !== me.id) { const k = el('button', 'btn small', 'Исключить'); k.onclick = () => g.actions.allianceKick(m.id); row.appendChild(k); }
          body.appendChild(row);
        }
        const chat = el('button', 'btn primary', '💬 Чат альянса'); chat.onclick = () => this.showChat('alliance'); body.appendChild(chat);
        const leave = el('button', 'btn danger', 'Покинуть альянс'); leave.onclick = () => { if (confirm('Покинуть альянс?')) g.actions.allianceLeave(); }; body.appendChild(leave);
      } else {
        const { alliances } = await API.alliances();
        body.innerHTML = '<p class="muted">Нужно посольство. Союзники не могут нападать друг на друга и вместе бьют боссов.</p>';
        const form = el('div', 'card col');
        const name = el('input'); name.placeholder = 'Название (3–24)'; const tag = el('input'); tag.placeholder = 'Тег (2–5)'; tag.maxLength = 5;
        const b = el('button', 'btn primary', 'Создать за 500 золота'); b.onclick = () => g.actions.allianceCreate(name.value, tag.value, '');
        form.append(name, tag, b); body.appendChild(form);
        body.appendChild(el('h3', null, 'Существующие альянсы'));
        for (const a of alliances) {
          const row = el('div', 'row', `<span class="w"><b>[${esc(a.tag)}] ${esc(a.name)}</b> <span class="muted small">${a.members} чел. · сила ${fmt(a.power)}</span></span>`);
          const j = el('button', 'btn', 'Вступить'); j.onclick = () => g.actions.allianceJoin(a.id); row.appendChild(j); body.appendChild(row);
        }
        if (!alliances.length) body.appendChild(el('p', 'muted', 'Пока нет ни одного. Будь первым!'));
      }
    } catch (e) { body.innerHTML = '<p class="bad">' + esc(e.message) + '</p>'; }
  }
  showBattleResult(title, r) {
    const body = el('div');
    const lines = [];
    if (r.win != null) lines.push(`<h3 class="${r.win ? 'good' : 'bad'}">${r.win ? 'Победа!' : 'Поражение'}</h3>`);
    if (r.killed) lines.push('<h3 class="good">Босс повержен!</h3>');
    if (r.damage != null) lines.push(`Нанесено урона: <b>${fmt(r.damage)}</b>${r.bossHpLeft != null ? ` (у босса осталось ${fmt(r.bossHpLeft)})` : ''}`);
    const fa = (o) => Object.entries(o || {}).map(([k, v]) => `${this.game.data.units[k].name} ×${v}`).join(', ') || 'нет';
    if (r.dead) lines.push('Погибло: ' + fa(r.dead) + ' · Ранено: ' + fa(r.wounded)); else if (r.lost) lines.push('Потери: ' + fa(r.lost));
    if (r.item) lines.push(`Трофей: <b style="color:${this.rarity(r.item.rarity).color}">${esc(r.item.name)}</b> (+${r.item.value} ${STAT_NAMES[r.item.stat]})`);
    if (r.reward && Object.keys(r.reward).length) lines.push('Награда: ' + this.costHtml(r.reward));
    if (r.loot) lines.push('Добыча: ' + (Object.keys(r.loot).length ? this.costHtml(r.loot) : 'нет'));
    if (r.amount != null) lines.push(`Собрано: ${this.iconHtml(r.resource)}${r.amount}`);
    if (r.xpGain) lines.push(`Опыт героям: +${r.xpGain}` + (r.levelUps && r.levelUps.length ? ' · ' + r.levelUps.join(', ') : ''));
    body.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
    if (r.log) {
      const d = el('details'); d.innerHTML = '<summary>Ход боя</summary>' + r.log.map(l => `<div class="small">Раунд ${l.round}: нанесли ${l.dealt}, получили ${l.taken}</div>`).join('');
      body.appendChild(d);
    }
    const ok = el('button', 'btn primary', 'Ок'); ok.onclick = () => this.closePanel(); body.appendChild(ok);
    this.openPanel(title, body);
  }

  // ---------- соц ----------
  async showChat(channel = 'world') {
    const g = this.game;
    const body = el('div', 'chat');
    if (g.state.player.alliance) {
      const tabs = el('div', 'row');
      for (const [k, n] of [['world', '🌍 Мир'], ['alliance', '🛡 Альянс']]) { const b = el('button', 'btn' + (k === channel ? ' primary' : ''), n); b.onclick = () => this.showChat(k); tabs.appendChild(b); }
      body.appendChild(tabs);
    }
    const list = el('div', 'chat-list'); body.appendChild(list);
    const form = el('form', 'row'); const inp = el('input'); inp.placeholder = 'Сообщение…'; inp.maxLength = 200;
    const btn = el('button', 'btn primary', '➤'); form.append(inp, btn); body.appendChild(form);
    form.onsubmit = async (e) => { e.preventDefault(); if (!inp.value.trim()) return; try { await API.say(inp.value, channel); inp.value = ''; poll(); } catch (err) { this.toast(err.message, 'err'); } };
    this.openPanel(channel === 'world' ? 'Чат мира' : 'Чат альянса', body);
    this.chatSince = 0; list.innerHTML = '';
    const poll = async () => {
      try {
        const r = await API.chat(this.chatSince, channel);
        for (const m of r.messages) {
          list.appendChild(el('div', 'msg' + (m.username === g.state.player.username ? ' me' : '') + (m.username === 'Герольд' ? ' sys' : ''),
            `<b>${esc(m.username)}</b> <span class="muted small">${new Date(m.created_at * 1000).toLocaleTimeString().slice(0, 5)}</span><br>${esc(m.text)}`));
          this.chatSince = Math.max(this.chatSince, m.id);
        }
        if (r.messages.length) list.scrollTop = list.scrollHeight;
      } catch (e) { /* молча */ }
    };
    await poll(); this.chatTimer = setInterval(poll, 4000);
  }
  stopChat() { if (this.chatTimer) { clearInterval(this.chatTimer); this.chatTimer = null; } }
  showReports() {
    const body = el('div');
    for (const r of this.game.state.reports) body.appendChild(el('div', 'card col', `<b>${esc(r.title)}</b><div class="small muted">${new Date(r.created_at * 1000).toLocaleString()}</div><div class="small">${esc(r.body)}</div>`));
    if (!this.game.state.reports.length) body.appendChild(el('p', 'muted', 'Пока пусто.'));
    this.openPanel('Отчёты', body);
  }
  async showLeaderboard() {
    const body = el('div', null, '<p class="muted">Загрузка…</p>'); this.openPanel('Рейтинг', body);
    try {
      const r = await API.leaderboard(); body.innerHTML = '';
      r.players.forEach((p, i) => body.appendChild(el('div', 'row' + (p.id === this.game.state.player.id ? ' me' : ''), `<span class="w">${i + 1}. ${p.tag ? '[' + esc(p.tag) + '] ' : ''}<b>${esc(p.username)}</b> — ${esc(p.city_name)}</span><span>${this.iconHtml('power')}${p.power}</span>`)));
    } catch (e) { body.innerHTML = '<p class="bad">' + esc(e.message) + '</p>'; }
  }
  showMenu() {
    const g = this.game, body = el('div', 'menu');
    const add = (t, f) => { const b = el('button', 'btn', t); b.onclick = f; body.appendChild(b); };
    add('⚔ Армия', () => this.showArmy());
    add('🏥 Госпиталь', () => this.showHospital());
    add('📚 Академия', () => this.showAcademy());
    add('🛡 Альянс', () => this.showAlliance());
    add('⚖ Рынок', () => this.showMarket());
    add('📜 Отчёты', () => this.showReports());
    add('🏆 Рейтинг', () => this.showLeaderboard());
    add('💬 Чат мира', () => this.showChat());
    add('✏ Переименовать город', async () => { const n = prompt('Новое имя города', g.state.player.cityName); if (n) g.actions.rename(n); });
    add('🚪 Выйти', () => g.logout());
    body.appendChild(el('p', 'small muted', 'Crowns & Ruins v0.1'));
    this.openPanel('Меню', body);
  }

  // обновление таймеров в открытой панели
  tickTimers(now) {
    for (const t of this.panelBody.querySelectorAll('.timer')) {
      const left = +t.dataset.until - now;
      t.textContent = (t.dataset.prefix || 'Строится: ') + (left > 0 ? fmtTime(left) : 'готово');
    }
  }
  paintIcons(root) {
    import('./assets.js').then(({ Assets }) => {
      for (const cv of root.querySelectorAll('canvas[data-sheet]')) {
        const c = cv.getContext('2d'); const s = cv.width;
        const def = Assets.sheets[cv.dataset.sheet]?.def; const y = def?.anchor === 'bottom' ? s : s / 2;
        Assets.draw(c, cv.dataset.sheet, cv.dataset.frame, s / 2, y, s, s);
      }
    });
  }
}
export function fmt(n) { n = Math.floor(n); return n >= 100000 ? (n / 1000).toFixed(0) + 'k' : n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
