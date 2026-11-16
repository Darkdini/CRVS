'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const G = require('./gamedata');
const game = require('./game');
const battle = require('./battle');
const world = require('./world');
const marches = require('./marches');
const alliances = require('./alliances');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => { // CORS для APK/WebView
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(__dirname, '..', 'client')));

world.generateWorld();
world.spawnMonsters();
setInterval(() => { try { marches.process(); world.respawnMonsters(); } catch (e) { console.error(e); } }, 3000);

// ---------- auth ----------
function hashPassword(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString('hex'); }
const ok = (res, data) => res.json({ ok: true, ...data });
const fail = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return fail(res, 'Нужен вход', 401);
  const s = db.prepare('SELECT player_id FROM sessions WHERE token=?').get(token);
  if (!s) return fail(res, 'Сессия истекла', 401);
  req.pid = s.player_id;
  next();
}
const wrap = (fn) => (req, res) => {
  try { fn(req, res); } catch (e) { fail(res, e.message || 'Ошибка'); }
};

app.post('/api/register', wrap((req, res) => {
  const { username, password, cityName } = req.body || {};
  if (typeof username !== 'string' || !/^[\wа-яА-ЯёЁ]{3,16}$/u.test(username)) return fail(res, 'Имя: 3–16 букв/цифр');
  if (typeof password !== 'string' || password.length < 4) return fail(res, 'Пароль от 4 символов');
  const city = (typeof cityName === 'string' && cityName.trim()) ? cityName.trim().slice(0, 24) : `Град ${username}`;
  if (db.prepare('SELECT id FROM players WHERE username=? COLLATE NOCASE').get(username)) return fail(res, 'Имя занято');
  const salt = crypto.randomBytes(16).toString('hex');
  const spot = world.findFreeCitySpot();
  const t = game.now();
  const r = G.START_RESOURCES;
  const info = db.prepare(`INSERT INTO players (username,pass_hash,salt,city_name,created_at,last_tick,food,wood,stone,iron,gold,world_x,world_y)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(username, hashPassword(password, salt), salt, city, t, t, r.food, r.wood, r.stone, r.iron, r.gold, spot.x, spot.y);
  const pid = Number(info.lastInsertRowid);
  // стартовый город
  const c = Math.floor(G.CITY_SIZE / 2);
  const ins = db.prepare('INSERT INTO buildings (player_id,type,x,y,level) VALUES (?,?,?,?,1)');
  ins.run(pid, 'townhall', c, c);
  ins.run(pid, 'farm', c - 2, c);
  ins.run(pid, 'sawmill', c, c - 2);
  db.prepare('INSERT INTO units (player_id,type,count) VALUES (?,?,?)').run(pid, 'militia', 10);
  game.addReport(pid, 'info', 'Добро пожаловать!', 'Ваш город основан. Постройте каменоломню и рудник, прокачайте ратушу, наймите героя в таверне и отправляйтесь в мир.');
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token,player_id,created_at) VALUES (?,?,?)').run(token, pid, t);
  ok(res, { token, state: game.state(pid) });
}));

app.post('/api/login', wrap((req, res) => {
  const { username, password } = req.body || {};
  const p = db.prepare('SELECT * FROM players WHERE username=? COLLATE NOCASE').get(String(username || ''));
  if (!p || hashPassword(String(password || ''), p.salt) !== p.pass_hash) return fail(res, 'Неверное имя или пароль');
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token,player_id,created_at) VALUES (?,?,?)').run(token, p.id, game.now());
  ok(res, { token, state: game.state(p.id) });
}));

app.post('/api/logout', auth, wrap((req, res) => {
  db.prepare('DELETE FROM sessions WHERE token=?').run(req.headers.authorization.slice(7));
  ok(res, {});
}));

app.get('/api/gamedata', (req, res) => {
  const buildings = {};
  for (const k in G.BUILDINGS) {
    const b = G.BUILDINGS[k];
    buildings[k] = { name: b.name, desc: b.desc, unique: !!b.unique, maxLevel: b.maxLevel,
      levels: Array.from({ length: b.maxLevel }, (_, i) => ({
        level: i + 1, cost: G.buildingCost(k, i + 1), time: G.buildingTime(k, i + 1),
        production: G.buildingProduction(k, i + 1), capacity: G.buildingCapacity(k, i + 1), defense: G.buildingDefense(k, i + 1),
      })) };
  }
  const techs = {};
  for (const k in G.TECHS) techs[k] = { ...G.TECHS[k], levels: Array.from({ length: G.TECHS[k].max }, (_, i) => ({ cost: G.techCost(k, i + 1), time: G.techTime(k, i + 1) })) };
  res.json({ ok: true, resources: G.RESOURCES, citySize: G.CITY_SIZE, buildings, units: G.UNITS, heroClasses: G.HERO_CLASSES,
    bosses: G.BOSSES, nodes: G.NODES, world: G.WORLD, heroCost: [0, 1, 2, 3, 4].map(G.HERO_COST), monsters: G.MONSTERS, techs,
    itemSlots: G.ITEM_SLOTS, rarities: G.RARITIES, questsTotal: G.QUESTS.length });
});

// ---------- city ----------
app.get('/api/state', auth, wrap((req, res) => { marches.process(); ok(res, { state: game.state(req.pid) }); }));
app.post('/api/build', auth, wrap((req, res) => ok(res, { state: game.build(req.pid, req.body.type, +req.body.x, +req.body.y) })));
app.post('/api/upgrade', auth, wrap((req, res) => ok(res, { state: game.upgrade(req.pid, +req.body.id) })));
app.post('/api/demolish', auth, wrap((req, res) => ok(res, { state: game.demolish(req.pid, +req.body.id) })));
app.post('/api/train', auth, wrap((req, res) => ok(res, { state: game.train(req.pid, req.body.type, req.body.count) })));
app.post('/api/hero/recruit', auth, wrap((req, res) => ok(res, { state: game.recruitHero(req.pid) })));
app.post('/api/trade', auth, wrap((req, res) => ok(res, { state: game.trade(req.pid, req.body.from, req.body.to, req.body.amount) })));
app.post('/api/rename', auth, wrap((req, res) => {
  const name = String(req.body.cityName || '').trim().slice(0, 24);
  if (name.length < 2) throw new Error('Слишком короткое имя');
  db.prepare('UPDATE players SET city_name=? WHERE id=?').run(name, req.pid);
  ok(res, { state: game.state(req.pid) });
}));

// ---------- world ----------
app.get('/api/world', auth, wrap((req, res) => {
  marches.process();
  world.respawnMonsters();
  const tiles = db.prepare('SELECT x,y,terrain,object FROM world_tiles').all();
  const players = db.prepare('SELECT id,username,city_name,world_x,world_y,alliance_id FROM players').all();
  const alliances = db.prepare('SELECT id,tag FROM alliances').all();
  const t = game.now();
  const bosses = db.prepare('SELECT * FROM bosses').all().map(b => ({ ...b, ...G.BOSSES[b.key], maxHp: G.BOSSES[b.key].hp, alive: b.dead_until <= t }));
  const monsters = db.prepare('SELECT id,x,y,type,level,hp FROM monsters WHERE dead_until=0').all().map(m => ({ ...m, name: G.MONSTERS[m.type].name, maxHp: G.monsterStats(m.level).hp }));
  const cooldowns = db.prepare('SELECT x,y,ready_at FROM node_cooldowns WHERE player_id=? AND ready_at>?').all(req.pid, t);
  // чужие походы видны всем (как в большом мире): только позиции
  const others = db.prepare('SELECT m.id, m.player_id, m.kind, m.target_x, m.target_y, m.status, m.depart_at, m.arrive_at, m.return_at, m.travel, p.world_x, p.world_y, p.username FROM marches m JOIN players p ON p.id=m.player_id WHERE m.player_id<>?').all(req.pid);
  ok(res, { now: t, size: G.WORLD.size, tiles, players, alliances, bosses, monsters, cooldowns, others });
}));

app.post('/api/march', auth, wrap((req, res) => {
  const { kind, x, y, army, heroIds } = req.body || {};
  ok(res, { state: marches.send(req.pid, kind, x, y, army, heroIds) });
}));
app.post('/api/march/recall', auth, wrap((req, res) => ok(res, { state: marches.recall(req.pid, +req.body.id) })));
app.get('/api/march/preview', auth, wrap((req, res) => {
  const me = game.getPlayer(req.pid);
  const d = marches.dist(me.world_x, me.world_y, +req.query.x, +req.query.y);
  const army = {}; try { Object.assign(army, JSON.parse(req.query.army || '{}')); } catch (e) { }
  const techs = game.getTechs(req.pid);
  ok(res, { dist: d, travel: marches.travelTime(d, Object.keys(army).length ? army : { scout: 1 }, techs), carry: marches.armyCarry(army, game.carryBonus(techs)) });
}));

// ---------- герои/предметы/академия/госпиталь/задания ----------
app.post('/api/item/equip', auth, wrap((req, res) => ok(res, { state: game.equip(req.pid, req.body.itemId, req.body.heroId) })));
app.post('/api/item/sell', auth, wrap((req, res) => ok(res, { state: game.sellItem(req.pid, req.body.itemId) })));
app.post('/api/research', auth, wrap((req, res) => ok(res, { state: game.research(req.pid, req.body.tech) })));
app.post('/api/heal', auth, wrap((req, res) => ok(res, { state: game.heal(req.pid, req.body.type, req.body.count) })));
app.post('/api/quest/claim', auth, wrap((req, res) => ok(res, { state: game.claimQuest(req.pid, req.body.id) })));

// ---------- альянсы ----------
app.get('/api/alliances', auth, wrap((req, res) => ok(res, { alliances: alliances.list() })));
app.get('/api/alliance/:id', auth, wrap((req, res) => { const a = alliances.info(+req.params.id); if (!a) throw new Error('Нет такого альянса'); ok(res, { alliance: a }); }));
app.post('/api/alliance/create', auth, wrap((req, res) => ok(res, { state: alliances.create(req.pid, req.body.name, req.body.tag, req.body.description) })));
app.post('/api/alliance/join', auth, wrap((req, res) => ok(res, { state: alliances.join(req.pid, req.body.id) })));
app.post('/api/alliance/leave', auth, wrap((req, res) => ok(res, { state: alliances.leave(req.pid) })));
app.post('/api/alliance/kick', auth, wrap((req, res) => ok(res, { state: alliances.kick(req.pid, req.body.playerId) })));

// ---------- social ----------
app.get('/api/leaderboard', auth, wrap((req, res) => {
  const rows = db.prepare('SELECT p.id,p.username,p.city_name,a.tag FROM players p LEFT JOIN alliances a ON a.id=p.alliance_id').all().map(p => {
    const b = game.getBuildings(p.id), u = game.getUnits(p.id), h = game.getHeroes(p.id);
    return { ...p, power: game.computePower(b, u, h) + (game.getStats(p.id).kills * 5) };
  }).sort((a, b) => b.power - a.power).slice(0, 50);
  ok(res, { players: rows });
}));
function chatChannel(req) {
  if (req.query.channel === 'alliance' || (req.body && req.body.channel === 'alliance')) {
    const me = game.getPlayer(req.pid);
    if (!me.alliance_id) throw new Error('Ты не в альянсе');
    return 'alliance:' + me.alliance_id;
  }
  return 'world';
}
app.get('/api/chat', auth, wrap((req, res) => {
  const since = +req.query.since || 0;
  ok(res, { messages: db.prepare('SELECT id,username,text,created_at FROM chat WHERE id>? AND channel=? ORDER BY id DESC LIMIT 50').all(since, chatChannel(req)).reverse() });
}));
app.post('/api/chat', auth, wrap((req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 200);
  if (!text) throw new Error('Пустое сообщение');
  const me = game.getPlayer(req.pid);
  db.prepare('INSERT INTO chat (player_id,username,text,created_at,channel) VALUES (?,?,?,?,?)').run(req.pid, me.username, text, game.now(), chatChannel(req));
  ok(res, {});
}));

app.use('/api', (req, res) => fail(res, 'Не найдено', 404));
app.listen(PORT, () => console.log(`Crowns & Ruins server: http://localhost:${PORT}`));
