// Точка входа: авторизация, игровой цикл, действия.
import { API } from './api.js';
import { Assets } from './assets.js';
import { CityScene } from './city.js';
import { WorldScene } from './world.js';
import { UI } from './ui.js';
import { BattleReplay } from './battlefx.js';
import { SFX } from './sfx.js';
import { drawLoginBg } from './loginbg.js';

const $ = (s) => document.querySelector(s);

const game = {
  data: null, state: null, ui: null, city: null, world: null, scene: 'city', serverOffset: 0,
  now() { return Math.floor(Date.now() / 1000) + this.serverOffset; },
  setState(st) {
    this.state = st; this.serverOffset = st.now - Math.floor(Date.now() / 1000);
    this.ui.renderTop();
    if (this.city) this.city.onState(st);
    // ближайший таймер — обновим после него
    const times = [...st.buildings.filter(b => b.upgrade_until).map(b => b.upgrade_until), ...st.training.map(t => t.finish_at),
      ...st.marches.map(m => m.status === 'going' ? m.arrive_at : m.status === 'working' ? m.work_until : m.return_at),
      ...Object.values(st.techs).filter(t => t.finish_at).map(t => t.finish_at)];
    // новые отчёты → уведомление
    const top = st.reports[0];
    if (top && this._lastReport && top.id > this._lastReport) {
      for (const r of st.reports.filter(r => r.id > this._lastReport).reverse()) this.ui.toast('📜 ' + r.title, r.kind === 'defense' ? 'err' : '', r.data ? () => this.battle.open(r.data, r.title) : null);
      if (this.scene === 'world') this.loadWorld();
    }
    if (top) this._lastReport = top.id;
    clearTimeout(this._refreshTimer);
    if (times.length) this._refreshTimer = setTimeout(() => this.refresh(), Math.max(500, (Math.min(...times) - this.now()) * 1000 + 500));
  },
  async refresh() { try { const r = await API.state(); this.setState(r.state); if (this.ui.isOpen() && this._reopen) this._reopen(); } catch (e) { } },
  showScene(name) {
    this.scene = name;
    $('#canvas-city').style.display = name === 'city' ? 'block' : 'none';
    $('#canvas-world').style.display = name === 'world' ? 'block' : 'none';
    $('#scene-title').textContent = name === 'city' ? this.state.player.cityName : 'Мир';
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.scene === name));
    if (name === 'world') this.loadWorld();
    this.city.view.resize(); this.world.view.resize();
  },
  async loadWorld() { try { const r = await API.world(); this.serverOffset = r.now - Math.floor(Date.now() / 1000); this.world.setWorld(r); } catch (e) { this.ui.toast(e.message, 'err'); } },
  async logout() { try { await API.logout(); } catch (e) { } API.setToken(null); location.reload(); },
};

// Действия: вызывают API, обновляют состояние, показывают ошибки
function act(fn, after) {
  return async (...args) => {
    try {
      const r = await fn(...args);
      if (r.state) game.setState(r.state);
      if (after) after(r, ...args); else game.ui.closePanel();
    } catch (e) { game.ui.toast(e.message, 'err'); SFX.error(); }
  };
}
game.actions = {
  build: act((t, x, y) => API.build(t, x, y), () => { game.city.buildMode = null; game.ui.closePanel(); game.ui.toast('Стройка начата'); SFX.build(); }),
  upgrade: act((id) => API.upgrade(id), (r, id) => { const b = game.state.buildings.find(b => b.id === id); game.ui.showBuilding(b); SFX.build(); }),
  demolish: act((id) => API.demolish(id)),
  train: act((t, n) => API.train(t, n), () => { game.ui.showArmy(); game.ui.toast('Обучение начато'); }),
  recruitHero: act(() => API.recruitHero(), () => { game.ui.showHeroes(); game.ui.toast('Новый герой в таверне!'); }),
  trade: act((f, t, a) => API.trade(f, t, a), () => { game.ui.showMarket(); game.ui.toast('Обмен выполнен'); }),
  rename: act((n) => API.rename(n), () => game.ui.closePanel()),
  march: act((k, x, y, a, h) => API.march(k, x, y, a, h), () => { game.ui.toast('Армия выступила'); game.ui.showMarches(); SFX.march(); }),
  recall: act((id) => API.recall(id), () => game.ui.showMarches()),
  equip: act((item, hero) => API.equip(item, hero), (r, item, hero, back) => back ? game.ui.showHero(back) : game.ui.showInventory()),
  sellItem: act((id) => API.sellItem(id), () => { game.ui.toast('Продано'); game.ui.showInventory(); SFX.coin(); }),
  research: act((t) => API.research(t), () => { game.ui.toast('Исследование начато'); game.ui.showAcademy(); }),
  heal: act((t, n) => API.heal(t, n), () => { game.ui.toast('Вылечены'); game.ui.showHospital(); }),
  claimQuest: act((id) => API.claimQuest(id), () => { game.ui.toast('Награда получена!'); game.ui.showQuests(); SFX.coin(); }),
  allianceCreate: act((n, t, d) => API.allianceCreate(n, t, d), () => game.ui.showAlliance()),
  allianceJoin: act((id) => API.allianceJoin(id), () => game.ui.showAlliance()),
  allianceLeave: act(() => API.allianceLeave(), () => game.ui.showAlliance()),
  allianceKick: act((id) => API.allianceKick(id), () => game.ui.showAlliance()),
};

async function start(state) {
  $('#auth').style.display = 'none'; $('#game').style.display = 'flex';
  game.ui = new UI(game);
  game.battle = new BattleReplay(game);
  game.city = new CityScene($('#canvas-city'), game);
  game.world = new WorldScene($('#canvas-world'), game);
  game.setState(state);
  $('#backdrop').onclick = () => game.ui.closePanel();
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => {
    const s = b.dataset.scene;
    if (s === 'city' || s === 'world') { game.ui.closePanel(); game.showScene(s); }
    else if (s === 'heroes') game.ui.showHeroes();
    else if (s === 'quests') game.ui.showQuests();
    else if (s === 'menu') game.ui.showMenu();
  });
  $('#btn-quests').onclick = () => game.ui.showQuests();
  $('#btn-marches').onclick = () => game.ui.showMarches();
  $('#btn-hospital').onclick = () => game.ui.showHospital();
  $('#btn-center').onclick = () => { const v = game.scene === 'city' ? game.city.view : game.world.view; if (game.scene === 'city') { const c = game.data.citySize / 2 - .5; v.panTo(c, c + 1); } else v.panTo(game.state.player.worldX, game.state.player.worldY); };
  game.showScene('city');
  setInterval(() => game.refresh(), 20000);
  setInterval(() => { if (game.scene === 'world') game.loadWorld(); }, 15000);
  let last = 0, prev = performance.now();
  const loop = (ts) => {
    const dt = Math.min(0.05, (ts - prev) / 1000); prev = ts;
    const now = game.now();
    if (game.scene === 'city') game.city.draw(now, dt); else game.world.draw(now, dt);
    if (ts - last > 1000) { last = ts; game.ui.tickTimers(now); if (game.state) { predict(); game.ui.renderTop(); } }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
// клиентское предсказание прироста ресурсов между обновлениями
function predict() {
  const p = game.state.player; const dt = game.now() - game.state.now;
  if (!game._base) game._base = { ...p.resources, at: game.state.now };
  if (game._base.at !== game.state.now) game._base = { ...p.resources, at: game.state.now };
  for (const k of game.data.resources) p.resources[k] = Math.min(Math.max(p.capacity, game._base[k]), game._base[k] + p.production[k] * dt / 3600);
}

// ---------- auth ----------
async function boot() {
  const prog = (p, t) => { $('#loading-fill').style.width = p + '%'; $('#loading-text').textContent = t; };
  prog(10, 'Загрузка графики…');
  await Assets.load();
  if (Assets.sheets.icons && Assets.sheets.icons.loaded) document.body.classList.add('has-icons');
  prog(60, 'Загрузка мира…');
  game.data = await API.gamedata();
  prog(90, 'Почти готово…');
  if (API.token) {
    try { const r = await API.state(); return start(r.state); } catch (e) { API.setToken(null); }
  }
  $('#loading').style.display = 'none'; $('#auth').style.display = 'flex';
  drawLoginBg($('#login-bg')); window.addEventListener('resize', () => $('#auth').style.display !== 'none' && drawLoginBg($('#login-bg')));
}
document.addEventListener('pointerdown', () => SFX.init(), { once: true });
document.addEventListener('click', (e) => { if (e.target.closest('.btn, #nav button, .tbtn, .card')) SFX.click(); });
const authForm = $('#auth-form');
let mode = 'login';
$('#auth-toggle').onclick = (e) => { e.preventDefault(); mode = mode === 'login' ? 'register' : 'login'; $('#auth-city').style.display = mode === 'register' ? 'block' : 'none'; $('#auth-submit').textContent = mode === 'login' ? 'Войти' : 'Создать город'; $('#auth-toggle').textContent = mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'; };
authForm.onsubmit = async (e) => {
  e.preventDefault(); $('#auth-error').textContent = '';
  const d = { username: $('#auth-user').value.trim(), password: $('#auth-pass').value, cityName: $('#auth-city').value.trim() };
  try { const r = mode === 'login' ? await API.login(d) : await API.register(d); API.setToken(r.token); start(r.state); }
  catch (err) { $('#auth-error').textContent = err.message; }
};
window.addEventListener('crvs:logout', () => location.reload());
game.sfx = SFX;
window.__game = game; // для отладки и автотестов
boot().catch(e => { $('#loading').textContent = 'Ошибка: ' + e.message; });
