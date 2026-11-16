// Точка входа: авторизация, игровой цикл, действия.
import { API } from './api.js';
import { Assets } from './assets.js';
import { CityScene } from './city.js';
import { WorldScene } from './world.js';
import { UI } from './ui.js';

const $ = (s) => document.querySelector(s);

const game = {
  data: null, state: null, ui: null, city: null, world: null, scene: 'city', serverOffset: 0,
  now() { return Math.floor(Date.now() / 1000) + this.serverOffset; },
  setState(st) {
    this.state = st; this.serverOffset = st.now - Math.floor(Date.now() / 1000);
    this.ui.renderTop();
    // ближайший таймер — обновим после него
    const times = [...st.buildings.filter(b => b.upgrade_until).map(b => b.upgrade_until), ...st.training.map(t => t.finish_at)];
    clearTimeout(this._refreshTimer);
    if (times.length) this._refreshTimer = setTimeout(() => this.refresh(), Math.max(500, (Math.min(...times) - this.now()) * 1000 + 500));
  },
  async refresh() { try { const r = await API.state(); this.setState(r.state); if (this.ui.isOpen() && this._reopen) this._reopen(); } catch (e) { } },
  showScene(name) {
    this.scene = name;
    $('#canvas-city').style.display = name === 'city' ? 'block' : 'none';
    $('#canvas-world').style.display = name === 'world' ? 'block' : 'none';
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
    } catch (e) { game.ui.toast(e.message, 'err'); }
  };
}
game.actions = {
  build: act((t, x, y) => API.build(t, x, y), () => { game.city.buildMode = null; game.ui.closePanel(); game.ui.toast('Стройка начата'); }),
  upgrade: act((id) => API.upgrade(id), (r, id) => { const b = game.state.buildings.find(b => b.id === id); game.ui.showBuilding(b); }),
  demolish: act((id) => API.demolish(id)),
  train: act((t, n) => API.train(t, n), () => { game.ui.showArmy(); game.ui.toast('Обучение начато'); }),
  recruitHero: act(() => API.recruitHero(), () => { game.ui.showHeroes(); game.ui.toast('Новый герой в таверне!'); }),
  trade: act((f, t, a) => API.trade(f, t, a), () => { game.ui.showMarket(); game.ui.toast('Обмен выполнен'); }),
  rename: act((n) => API.rename(n), () => game.ui.closePanel()),
  attackBoss: act((k, a, h) => API.attackBoss(k, a, h), (r) => { game.ui.showBattleResult('Итог боя', r.result); game.loadWorld(); }),
  attackPlayer: act((id, a, h) => API.attackPlayer(id, a, h), (r) => { game.ui.showBattleResult('Итог набега', r.result); }),
  gather: act((x, y) => API.gather(x, y), (r) => { game.ui.showBattleResult('Сбор ресурсов', r.result); game.loadWorld(); }),
};

async function start(state) {
  $('#auth').style.display = 'none'; $('#game').style.display = 'flex';
  game.ui = new UI(game);
  game.city = new CityScene($('#canvas-city'), game);
  game.world = new WorldScene($('#canvas-world'), game);
  game.setState(state);
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => {
    const s = b.dataset.scene;
    if (s === 'city' || s === 'world') { game.ui.closePanel(); game.showScene(s); }
    else if (s === 'heroes') game.ui.showHeroes();
    else if (s === 'army') game.ui.showArmy();
    else if (s === 'menu') game.ui.showMenu();
  });
  $('#btn-center').onclick = () => { const v = game.scene === 'city' ? game.city.view : game.world.view; if (game.scene === 'city') { const c = game.data.citySize / 2 - .5; v.centerOn(c, c); } else v.centerOn(game.state.player.worldX, game.state.player.worldY); };
  game.showScene('city');
  setInterval(() => game.refresh(), 30000);
  let last = 0;
  const loop = (ts) => {
    const now = game.now();
    if (game.scene === 'city') game.city.draw(now); else game.world.draw(now);
    if (ts - last > 1000) { last = ts; game.ui.tickTimers(now); if (game.state) game.ui.renderTop(); predict(); }
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
  $('#loading').textContent = 'Загрузка ресурсов…';
  await Assets.load();
  game.data = await API.gamedata();
  if (API.token) {
    try { const r = await API.state(); return start(r.state); } catch (e) { API.setToken(null); }
  }
  $('#loading').style.display = 'none'; $('#auth').style.display = 'flex';
}
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
boot().catch(e => { $('#loading').textContent = 'Ошибка: ' + e.message; });
