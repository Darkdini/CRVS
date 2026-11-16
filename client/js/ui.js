// DOM-интерфейс: панели, меню, модалки.
import { API } from './api.js';
import { fmtTime } from './city.js';

const RES_NAMES = { food: 'Еда', wood: 'Дерево', stone: 'Камень', iron: 'Железо', gold: 'Золото' };
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
    const g = this.game, def = g.data.buildings[b.type], res = g.state.player.resources;
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
    const g = this.game, st = g.state, res = st.player.resources;
    const body = el('div');
    const tl = Math.max(...st.buildings.filter(b => b.type === 'tavern').map(b => b.level), 0);
    body.appendChild(el('p', 'muted', tl ? `Таверна ${tl} ур. Героев: ${st.heroes.length}/${tl}` : 'Построй таверну, чтобы нанимать героев.'));
    for (const h of st.heroes) {
      const card = el('div', 'card');
      const inj = h.injured_until > g.now();
      card.innerHTML = `<div class="card-ico"><canvas data-sheet="heroes" data-frame="${h.class}" width="80" height="80"></canvas></div>
        <div class="card-main"><b>${esc(h.name)}</b> — ${h.className}, ${h.level} ур.${inj ? ' <span class="bad">ранен</span>' : ''}
        <div class="small">⚔${h.atk} 🛡${h.def} ❤${h.hp}</div><div class="small muted">${h.skill}</div>
        <div class="bar"><i style="width:${Math.min(100, 100 * h.xp / h.nextXp)}%"></i></div><div class="small muted">Опыт ${h.xp}/${h.nextXp}</div></div>`;
      body.appendChild(card);
    }
    if (tl > 0 && st.heroes.length < tl) {
      const cost = g.data.heroCost[st.heroes.length];
      const btn = el('button', 'btn primary', `Нанять героя — ${Object.entries(cost).map(([k, v]) => `${v} ${RES_NAMES[k]}`).join(', ')}`);
      btn.onclick = () => g.actions.recruitHero(); body.appendChild(btn);
      body.appendChild(el('p', 'small muted', 'Класс героя выпадает случайно: Рыцарь, Лучница, Маг или Плут.'));
    }
    this.openPanel('Герои', body); this.paintIcons(body);
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
    body.appendChild(el('p', 'muted', `${terr} · ${tile.x}:${tile.y} · путь от города: ${Math.abs(me.worldX - tile.x) + Math.abs(me.worldY - tile.y)}`));
    if (!o) { this.openPanel('Мир', body); return; }
    if (o.kind === 'city') {
      const mine = o.player.id === me.id;
      body.appendChild(el('div', 'card', `<div class="card-ico"><canvas data-sheet="world" data-frame="${mine ? 'city_player' : 'city_other'}" width="64" height="64"></canvas></div>
        <div class="card-main"><b>${esc(o.player.city_name)}</b><div class="muted">${mine ? 'Ваш город' : 'Правитель: ' + esc(o.player.username)}</div></div>`));
      if (mine) { const b = el('button', 'btn primary', 'Войти в город'); b.onclick = () => { this.closePanel(); g.showScene('city'); }; body.appendChild(b); }
      else {
        const b = el('button', 'btn danger', 'Напасть');
        b.onclick = () => this.showArmyPicker(`Набег на ${o.player.city_name}`, (army, heroIds) => g.actions.attackPlayer(o.player.id, army, heroIds));
        body.appendChild(b);
        body.appendChild(el('p', 'small muted', 'Победа даёт до 15% ресурсов противника. У новичков щит 24ч, после атаки — щит 10 мин.'));
      }
      this.openPanel('Город', body); this.paintIcons(body); return;
    }
    if (o.kind === 'boss') {
      const bs = o.boss, alive = bs.dead_until <= g.now();
      body.appendChild(el('div', 'card', `<div class="card-ico big"><canvas data-sheet="bosses" data-frame="${bs.key}" width="96" height="96"></canvas></div>
        <div class="card-main"><b>${bs.name}</b> — ${bs.level} ур.<div class="small">⚔${bs.atk} 🛡${bs.def}</div>
        <div class="bar red"><i style="width:${alive ? 100 * bs.hp / bs.maxHp : 0}%"></i></div><div class="small">${alive ? `${fmt(bs.hp)} / ${fmt(bs.maxHp)}` : 'Возродится через ' + fmtTime(bs.dead_until - g.now())}</div>
        <div class="small muted">Награда за убийство делится по урону: ${Object.entries(bs.reward).map(([k, v]) => v + ' ' + RES_NAMES[k]).join(', ')}. Убит раз: ${bs.kills}${bs.last_killer ? ', последний: ' + esc(bs.last_killer) : ''}</div></div>`));
      const b = el('button', 'btn danger', 'В бой!'); b.disabled = !alive;
      b.onclick = () => this.showArmyPicker(`Бой с ${bs.name}`, (army, heroIds) => g.actions.attackBoss(bs.key, army, heroIds));
      body.appendChild(b);
      this.openPanel('Босс', body); this.paintIcons(body); return;
    }
    if (o.kind === 'node') {
      const nd = g.data.nodes[o.node];
      body.appendChild(el('div', 'card', `<div class="card-ico"><canvas data-sheet="world" data-frame="${o.node}" width="64" height="64"></canvas></div>
        <div class="card-main"><b>${nd.name}</b><div class="small muted">Даёт ${RES_NAMES[nd.resource]} ≈${nd.amount} (больше при большой армии, меньше вдали от города). Откат ${fmtTime(nd.cooldown)}.</div></div>`));
      const b = el('button', 'btn primary', cooldown > g.now() ? 'Истощено: ' + fmtTime(cooldown - g.now()) : 'Собрать');
      b.disabled = cooldown > g.now(); b.onclick = () => g.actions.gather(o.x, o.y); body.appendChild(b);
      this.openPanel('Ресурсы', body); this.paintIcons(body);
    }
  }
  showArmyPicker(title, onConfirm) {
    const g = this.game, st = g.state;
    const body = el('div');
    body.appendChild(el('p', 'muted', 'Выбери войска и героев.'));
    const inputs = {};
    for (const [k, n] of Object.entries(st.units)) {
      if (!n) continue;
      const row = el('div', 'row');
      const inp = el('input'); inp.type = 'range'; inp.min = 0; inp.max = n; inp.value = n;
      const lab = el('span', 'w', `${g.data.units[k].name}: <b>${n}</b>/${n}`);
      inp.oninput = () => { lab.querySelector('b').textContent = inp.value; };
      row.append(lab, inp); body.appendChild(row); inputs[k] = inp;
    }
    const heroBoxes = [];
    for (const h of st.heroes) {
      const inj = h.injured_until > g.now();
      const l = el('label', 'row'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = !inj; cb.disabled = inj; cb.value = h.id;
      l.append(cb, ` ${h.name} (${h.className} ${h.level} ур.)${inj ? ' — ранен' : ''}`); body.appendChild(l); heroBoxes.push(cb);
    }
    if (!Object.keys(inputs).length && !heroBoxes.length) body.appendChild(el('p', 'bad', 'Нет войск и героев.'));
    const btn = el('button', 'btn danger', 'Отправить');
    btn.onclick = () => { const army = {}; for (const k in inputs) army[k] = +inputs[k].value; onConfirm(army, heroBoxes.filter(c => c.checked).map(c => +c.value)); };
    body.appendChild(btn);
    this.openPanel(title, body);
  }
  showBattleResult(title, r) {
    const body = el('div');
    const lines = [];
    if (r.win != null) lines.push(`<h3 class="${r.win ? 'good' : 'bad'}">${r.win ? 'Победа!' : 'Поражение'}</h3>`);
    if (r.killed) lines.push('<h3 class="good">Босс повержен!</h3>');
    if (r.damage != null) lines.push(`Нанесено урона: <b>${fmt(r.damage)}</b>${r.bossHpLeft != null ? ` (у босса осталось ${fmt(r.bossHpLeft)})` : ''}`);
    if (r.lost) lines.push('Потери: ' + (Object.entries(r.lost).map(([k, v]) => `${this.game.data.units[k].name} ×${v}`).join(', ') || 'нет'));
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
  async showChat() {
    const g = this.game;
    const body = el('div', 'chat');
    const list = el('div', 'chat-list'); body.appendChild(list);
    const form = el('form', 'row'); const inp = el('input'); inp.placeholder = 'Сообщение…'; inp.maxLength = 200;
    const btn = el('button', 'btn primary', '➤'); form.append(inp, btn); body.appendChild(form);
    form.onsubmit = async (e) => { e.preventDefault(); if (!inp.value.trim()) return; try { await API.say(inp.value); inp.value = ''; poll(); } catch (err) { this.toast(err.message, 'err'); } };
    this.openPanel('Чат мира', body);
    this.chatSince = 0; list.innerHTML = '';
    const poll = async () => {
      try {
        const r = await API.chat(this.chatSince);
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
      r.players.forEach((p, i) => body.appendChild(el('div', 'row' + (p.id === this.game.state.player.id ? ' me' : ''), `<span class="w">${i + 1}. <b>${esc(p.username)}</b> — ${esc(p.city_name)}</span><span>${this.iconHtml('power')}${p.power}</span>`)));
    } catch (e) { body.innerHTML = '<p class="bad">' + esc(e.message) + '</p>'; }
  }
  showMenu() {
    const g = this.game, body = el('div', 'menu');
    const add = (t, f) => { const b = el('button', 'btn', t); b.onclick = f; body.appendChild(b); };
    add('📜 Отчёты', () => this.showReports());
    add('🏆 Рейтинг', () => this.showLeaderboard());
    add('💬 Чат мира', () => this.showChat());
    add('⚖ Рынок', () => this.showMarket());
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
