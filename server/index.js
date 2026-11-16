'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const G = require('./gamedata');
const game = require('./game');
const battle = require('./battle');
const world = require('./world');

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
  res.json({ ok: true, resources: G.RESOURCES, citySize: G.CITY_SIZE, buildings, units: G.UNITS, heroClasses: G.HERO_CLASSES,
    bosses: G.BOSSES, nodes: G.NODES, world: G.WORLD, heroCost: [0, 1, 2, 3, 4].map(G.HERO_COST) });
});

// ---------- city ----------
app.get('/api/state', auth, wrap((req, res) => ok(res, { state: game.state(req.pid) })));
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
  const tiles = db.prepare('SELECT x,y,terrain,object FROM world_tiles').all();
  const players = db.prepare('SELECT id,username,city_name,world_x,world_y FROM players').all();
  const t = game.now();
  const bosses = db.prepare('SELECT * FROM bosses').all().map(b => ({
    ...b, ...G.BOSSES[b.key], maxHp: G.BOSSES[b.key].hp, alive: b.dead_until <= t,
  }));
  const cooldowns = db.prepare('SELECT x,y,ready_at FROM node_cooldowns WHERE player_id=? AND ready_at>?').all(req.pid, t);
  ok(res, { now: t, size: G.WORLD.size, tiles, players, bosses, cooldowns });
}));

function pickArmy(pid, wanted) {
  const have = game.getUnits(pid);
  const army = {};
  for (const t in wanted || {}) {
    const n = Math.floor(Number(wanted[t]));
    if (!G.UNITS[t] || !(n > 0)) continue;
    army[t] = Math.min(n, have[t] || 0);
  }
  return army;
}
function pickHeroes(pid, ids) {
  const all = game.getHeroes(pid);
  const t = game.now();
  return all.filter(h => (ids || []).map(Number).includes(h.id) && h.injured_until <= t);
}
function removeUnits(pid, lost) {
  for (const t in lost) db.prepare('UPDATE units SET count=MAX(0,count-?) WHERE player_id=? AND type=?').run(lost[t], pid, t);
}
const fmtRes = (r) => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ');
const fmtArmy = (a) => Object.entries(a).map(([k, v]) => `${G.UNITS[k].name} ×${v}`).join(', ') || 'без войск';

app.post('/api/boss/attack', auth, wrap((req, res) => {
  const pid = req.pid;
  const { bossKey, army: wantedArmy, heroIds } = req.body || {};
  const bossDef = G.BOSSES[bossKey];
  const boss = db.prepare('SELECT * FROM bosses WHERE key=?').get(bossKey);
  if (!bossDef || !boss) throw new Error('Нет такого босса');
  const t = game.now();
  if (boss.dead_until > t) throw new Error('Босс ещё не возродился');
  game.tick(pid);
  const army = pickArmy(pid, wantedArmy);
  const heroes = pickHeroes(pid, heroIds);
  const total = Object.values(army).reduce((a, b) => a + b, 0);
  if (total === 0 && heroes.length === 0) throw new Error('Выбери войска или героев');
  const bs = game.getBuildings(pid);
  let atkMul = game.atkBonus(bs);
  if (heroes.some(h => h.class === 'mage')) atkMul *= 1.3;
  const a = battle.armyStats(army, heroes, atkMul);
  const b = { atk: bossDef.atk, def: bossDef.def, hp: boss.hp };
  const sim = battle.simulate(a, b, 8);
  const lossRatio = a.hp > 0 ? 1 - sim.aLeft / a.hp : 0;
  const lost = battle.applyLosses(army, lossRatio);
  removeUnits(pid, lost);
  // герои: ранение, если потеряли >60%
  if (lossRatio > 0.6) for (const h of heroes) db.prepare('UPDATE heroes SET injured_until=? WHERE id=?').run(t + 300, h.id);
  db.prepare('INSERT INTO boss_damage (boss_key,player_id,damage) VALUES (?,?,?) ON CONFLICT(boss_key,player_id) DO UPDATE SET damage=damage+excluded.damage')
    .run(bossKey, pid, sim.aDamageDealt);
  const xpGain = Math.floor(bossDef.xp * Math.min(1, sim.aDamageDealt / bossDef.hp) + 20);
  const levelUps = [];
  for (const h of heroes) { const ups = game.addHeroXp(h.id, xpGain); if (ups.length) levelUps.push(`${h.name} → ${ups[ups.length - 1]} ур.`); }
  let reward = {}, killed = false;
  const newHp = boss.hp - sim.aDamageDealt;
  if (newHp <= 0) {
    killed = true;
    const me = game.getPlayer(pid);
    db.prepare('UPDATE bosses SET hp=?, dead_until=?, kills=kills+1, last_killer=? WHERE key=?').run(bossDef.hp, t + bossDef.respawn, me.username, bossKey);
    // награда всем, кто бил: пропорционально урону, добивший — x1.5
    const dmg = db.prepare('SELECT player_id, damage FROM boss_damage WHERE boss_key=?').all(bossKey);
    const sum = dmg.reduce((s, d) => s + d.damage, 0) || 1;
    for (const d of dmg) {
      const share = Math.min(1, d.damage / sum) * (d.player_id === pid ? 1.5 : 1);
      const r = {};
      for (const k in bossDef.reward) r[k] = Math.max(1, Math.floor(bossDef.reward[k] * share));
      if (heroes.some(h => h.class === 'rogue') && d.player_id === pid) for (const k in r) r[k] = Math.floor(r[k] * 1.25);
      game.give(d.player_id, r);
      if (d.player_id === pid) reward = r;
      else game.addReport(d.player_id, 'boss', `${bossDef.name} повержен`, `${me.username} добил босса. Ваша доля за урон: ${fmtRes(r)}.`);
    }
    db.prepare('DELETE FROM boss_damage WHERE boss_key=?').run(bossKey);
    db.prepare('INSERT INTO chat (player_id,username,text,created_at) VALUES (0,?,?,?)').run('Герольд', `${me.username} сразил босса «${bossDef.name}»!`, t);
  } else {
    db.prepare('UPDATE bosses SET hp=? WHERE key=?').run(newHp, bossKey);
  }
  const title = killed ? `Босс ${bossDef.name} повержен!` : `Бой с ${bossDef.name}`;
  const body = `Нанесено урона: ${sim.aDamageDealt}. Потери: ${fmtArmy(lost)}. Опыт героям: +${xpGain}.` + (killed ? ` Награда: ${fmtRes(reward)}.` : '') + (levelUps.length ? ' ' + levelUps.join(', ') : '');
  game.addReport(pid, 'boss', title, body);
  ok(res, { result: { killed, damage: sim.aDamageDealt, bossHpLeft: Math.max(0, newHp), bossMaxHp: bossDef.hp, lost, reward, xpGain, levelUps, log: sim.log, win: sim.win }, state: game.state(pid) });
}));

app.post('/api/node/gather', auth, wrap((req, res) => {
  const pid = req.pid;
  const x = +req.body.x, y = +req.body.y;
  const tile = db.prepare('SELECT * FROM world_tiles WHERE x=? AND y=?').get(x, y);
  if (!tile || !tile.object || !tile.object.startsWith('node:')) throw new Error('Здесь нечего собирать');
  const node = G.NODES[tile.object.slice(5)];
  const t = game.now();
  const cd = db.prepare('SELECT ready_at FROM node_cooldowns WHERE x=? AND y=? AND player_id=?').get(x, y, pid);
  if (cd && cd.ready_at > t) throw new Error(`Точка истощена, ждать ${Math.ceil((cd.ready_at - t) / 60)} мин`);
  game.tick(pid);
  const units = game.getUnits(pid);
  const carriers = Object.values(units).reduce((a, b) => a + b, 0);
  if (carriers < 5) throw new Error('Нужно хотя бы 5 воинов для сбора');
  const me = game.getPlayer(pid);
  const dist = Math.abs(me.world_x - x) + Math.abs(me.world_y - y);
  const amount = Math.floor(node.amount * Math.min(2, carriers / 20 + 0.5) * Math.max(0.5, 1 - dist / 120));
  game.give(pid, { [node.resource]: amount });
  db.prepare('INSERT INTO node_cooldowns (x,y,player_id,ready_at) VALUES (?,?,?,?) ON CONFLICT(x,y,player_id) DO UPDATE SET ready_at=excluded.ready_at')
    .run(x, y, pid, t + node.cooldown);
  game.addReport(pid, 'gather', `Сбор: ${node.name}`, `Собрано ${node.resource}: ${amount}.`);
  ok(res, { result: { resource: node.resource, amount }, state: game.state(pid) });
}));

app.post('/api/player/attack', auth, wrap((req, res) => {
  const pid = req.pid;
  const { targetId, army: wantedArmy, heroIds } = req.body || {};
  const target = game.getPlayer(+targetId);
  if (!target || target.id === pid) throw new Error('Неверная цель');
  const t = game.now();
  const me = game.getPlayer(pid);
  if (me.last_attack_at + 120 > t) throw new Error('Войска отдыхают, подожди пару минут');
  if (target.attacked_at + 600 > t) throw new Error('Город недавно атаковали — щит');
  if (target.created_at + 3600 * 24 > t) throw new Error('У новичка щит на сутки');
  game.tick(pid); game.tick(target.id);
  const army = pickArmy(pid, wantedArmy);
  const heroes = pickHeroes(pid, heroIds);
  if (Object.values(army).reduce((a, b) => a + b, 0) === 0) throw new Error('Нужны войска');
  const a = battle.armyStats(army, heroes, game.atkBonus(game.getBuildings(pid)));
  const tb = game.getBuildings(target.id);
  const tArmy = game.getUnits(target.id);
  const tHeroes = game.getHeroes(target.id).filter(h => h.injured_until <= t);
  const d = battle.armyStats(tArmy, tHeroes, game.atkBonus(tb));
  const wallDef = game.cityDefense(tb);
  d.def += wallDef; d.hp += wallDef * 5;
  const sim = battle.simulate(a, d, 10);
  const myLoss = a.hp > 0 ? 1 - sim.aLeft / a.hp : 0;
  const theirLoss = d.hp > 0 ? 1 - sim.bLeft / d.hp : 0;
  const lost = battle.applyLosses(army, myLoss); removeUnits(pid, lost);
  const tLost = battle.applyLosses(tArmy, theirLoss * 0.8); removeUnits(target.id, tLost);
  let loot = {};
  if (sim.win) {
    const pct = 0.15 * (heroes.some(h => h.class === 'rogue') ? 1.25 : 1);
    const cap = Object.values(army).reduce((s, n) => s + n * 30, 0);
    let carry = cap;
    for (const k of ['gold', 'iron', 'stone', 'wood', 'food']) {
      const amt = Math.min(Math.floor(target[k] * pct), carry);
      if (amt > 0) { loot[k] = amt; carry -= amt; }
    }
    game.pay(target.id, loot); game.give(pid, loot);
  }
  for (const h of heroes) game.addHeroXp(h.id, 40 + (sim.win ? 60 : 0));
  db.prepare('UPDATE players SET last_attack_at=? WHERE id=?').run(t, pid);
  db.prepare('UPDATE players SET attacked_at=? WHERE id=?').run(t, target.id);
  game.addReport(pid, 'raid', `${sim.win ? 'Победа' : 'Поражение'}: набег на ${target.city_name}`, `Потери: ${fmtArmy(lost)}. Добыча: ${fmtRes(loot) || 'нет'}.`);
  game.addReport(target.id, 'defense', `${sim.win ? 'Город разграблен' : 'Оборона выстояла'}: ${me.username}`, `Потери: ${fmtArmy(tLost)}. Потеряно: ${fmtRes(loot) || 'ничего'}.`);
  ok(res, { result: { win: sim.win, lost, loot, log: sim.log }, state: game.state(pid) });
}));

// ---------- social ----------
app.get('/api/leaderboard', auth, wrap((req, res) => {
  const rows = db.prepare('SELECT id,username,city_name FROM players').all().map(p => {
    const b = game.getBuildings(p.id), u = game.getUnits(p.id), h = game.getHeroes(p.id);
    return { ...p, power: game.computePower(b, u, h) };
  }).sort((a, b) => b.power - a.power).slice(0, 50);
  ok(res, { players: rows });
}));
app.get('/api/chat', auth, wrap((req, res) => {
  const since = +req.query.since || 0;
  ok(res, { messages: db.prepare('SELECT id,username,text,created_at FROM chat WHERE id>? ORDER BY id DESC LIMIT 50').all(since).reverse() });
}));
app.post('/api/chat', auth, wrap((req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 200);
  if (!text) throw new Error('Пустое сообщение');
  const me = game.getPlayer(req.pid);
  db.prepare('INSERT INTO chat (player_id,username,text,created_at) VALUES (?,?,?,?)').run(req.pid, me.username, text, game.now());
  ok(res, {});
}));

app.use('/api', (req, res) => fail(res, 'Не найдено', 404));
app.listen(PORT, () => console.log(`Crowns & Ruins server: http://localhost:${PORT}`));
