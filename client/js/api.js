// Обёртка над REST API. Базовый URL задаётся в config.js (для APK — адрес сервера).
import { CONFIG } from './config.js';

export const API = {
  token: localStorage.getItem('crvs_token') || null,
  setToken(t) { this.token = t; if (t) localStorage.setItem('crvs_token', t); else localStorage.removeItem('crvs_token'); },
  async call(path, body, method) {
    const opts = { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' } };
    if (this.token) opts.headers.Authorization = 'Bearer ' + this.token;
    if (body) opts.body = JSON.stringify(body);
    let r;
    try { r = await fetch(CONFIG.API_URL + path, opts); }
    catch (e) { throw new Error('Нет связи с сервером'); }
    const j = await r.json().catch(() => ({ ok: false, error: 'Плохой ответ сервера' }));
    if (r.status === 401) { this.setToken(null); window.dispatchEvent(new Event('crvs:logout')); }
    if (!j.ok) throw new Error(j.error || 'Ошибка');
    return j;
  },
  register: (d) => API.call('/api/register', d),
  login: (d) => API.call('/api/login', d),
  logout: () => API.call('/api/logout', {}),
  gamedata: () => API.call('/api/gamedata'),
  state: () => API.call('/api/state'),
  build: (type, x, y) => API.call('/api/build', { type, x, y }),
  upgrade: (id) => API.call('/api/upgrade', { id }),
  demolish: (id) => API.call('/api/demolish', { id }),
  train: (type, count) => API.call('/api/train', { type, count }),
  recruitHero: () => API.call('/api/hero/recruit', {}),
  trade: (from, to, amount) => API.call('/api/trade', { from, to, amount }),
  rename: (cityName) => API.call('/api/rename', { cityName }),
  world: () => API.call('/api/world'),
  march: (kind, x, y, army, heroIds) => API.call('/api/march', { kind, x, y, army, heroIds }),
  recall: (id) => API.call('/api/march/recall', { id }),
  marchPreview: (x, y, army) => API.call('/api/march/preview?' + new URLSearchParams({ x, y, army: JSON.stringify(army) })),
  equip: (itemId, heroId) => API.call('/api/item/equip', { itemId, heroId }),
  sellItem: (itemId) => API.call('/api/item/sell', { itemId }),
  research: (tech) => API.call('/api/research', { tech }),
  heal: (type, count) => API.call('/api/heal', { type, count }),
  claimQuest: (id) => API.call('/api/quest/claim', { id }),
  alliances: () => API.call('/api/alliances'),
  alliance: (id) => API.call('/api/alliance/' + id),
  allianceCreate: (name, tag, description) => API.call('/api/alliance/create', { name, tag, description }),
  allianceJoin: (id) => API.call('/api/alliance/join', { id }),
  allianceLeave: () => API.call('/api/alliance/leave', {}),
  allianceKick: (playerId) => API.call('/api/alliance/kick', { playerId }),
  leaderboard: () => API.call('/api/leaderboard'),
  chat: (since, channel) => API.call('/api/chat?since=' + (since || 0) + '&channel=' + (channel || 'world')),
  say: (text, channel) => API.call('/api/chat', { text, channel: channel || 'world' }),
};
