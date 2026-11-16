'use strict';
// Серверная игровая логика: ресурсы, стройка, обучение, герои.
const db = require('./db');
const G = require('./gamedata');

const now = () => Math.floor(Date.now() / 1000);

function getPlayer(id) { return db.prepare('SELECT * FROM players WHERE id=?').get(id); }
function getBuildings(pid) { return db.prepare('SELECT * FROM buildings WHERE player_id=?').all(pid); }
function getUnits(pid) {
  const out = {};
  for (const r of db.prepare('SELECT type,count FROM units WHERE player_id=?').all(pid)) out[r.type] = r.count;
  return out;
}
function getHeroes(pid) {
  return db.prepare('SELECT * FROM heroes WHERE player_id=? ORDER BY id').all(pid).map(h => {
    const s = G.heroStats(h.class, h.level);
    return { ...h, ...s, className: G.HERO_CLASSES[h.class].name, nextXp: G.heroXpForLevel(h.level), skill: G.HERO_CLASSES[h.class].skill };
  });
}
function levelOf(buildings, type) {
  let m = 0;
  for (const b of buildings) if (b.type === type && b.level > m) m = b.level;
  return m;
}

function capacity(buildings) {
  let cap = G.BASE_CAPACITY;
  for (const b of buildings) if (b.level > 0) cap += G.buildingCapacity(b.type, b.level);
  return cap;
}
function production(buildings) {
  const p = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
  for (const b of buildings) {
    if (b.level === 0) continue;
    const pr = G.buildingProduction(b.type, b.level);
    for (const k in pr) p[k] += pr[k];
  }
  return p;
}
function cityDefense(buildings) {
  let d = 0;
  for (const b of buildings) if (b.level > 0) d += G.buildingDefense(b.type, b.level);
  return d;
}
function atkBonus(buildings) {
  const l = levelOf(buildings, 'blacksmith');
  return 1 + l * G.BUILDINGS.blacksmith.atkBonus;
}

// Ленивое обновление состояния игрока: производство, завершение строек и обучения.
function tick(pid) {
  const p = getPlayer(pid);
  if (!p) return null;
  const t = now();
  // завершить стройки
  db.prepare('UPDATE buildings SET level=level+1, upgrade_until=NULL WHERE player_id=? AND upgrade_until IS NOT NULL AND upgrade_until<=?').run(pid, t);
  // завершить обучение
  const done = db.prepare('SELECT * FROM training WHERE player_id=? AND finish_at<=?').all(pid, t);
  for (const tr of done) {
    db.prepare('INSERT INTO units (player_id,type,count) VALUES (?,?,?) ON CONFLICT(player_id,type) DO UPDATE SET count=count+excluded.count').run(pid, tr.type, tr.count);
    db.prepare('DELETE FROM training WHERE id=?').run(tr.id);
  }
  // производство
  const buildings = getBuildings(pid);
  const dt = Math.max(0, t - p.last_tick);
  if (dt > 0) {
    const pr = production(buildings);
    const cap = capacity(buildings);
    const upd = {};
    for (const k of G.RESOURCES) {
      const v = p[k] + pr[k] * dt / 3600;
      upd[k] = Math.min(Math.max(v, p[k]), Math.max(cap, p[k]));
    }
    db.prepare('UPDATE players SET food=?,wood=?,stone=?,iron=?,gold=?,last_tick=? WHERE id=?')
      .run(upd.food, upd.wood, upd.stone, upd.iron, upd.gold, t, pid);
  }
  return getPlayer(pid);
}

function canAfford(p, cost) {
  for (const k in cost) if ((p[k] || 0) < cost[k]) return false;
  return true;
}
function pay(pid, cost) {
  const sets = Object.keys(cost).map(k => `${k}=${k}-?`).join(',');
  db.prepare(`UPDATE players SET ${sets} WHERE id=?`).run(...Object.values(cost), pid);
}
function give(pid, res, buildings) {
  const cap = capacity(buildings || getBuildings(pid));
  const p = getPlayer(pid);
  for (const k in res) {
    if (!G.RESOURCES.includes(k)) continue;
    const v = Math.min(cap, p[k] + res[k]);
    db.prepare(`UPDATE players SET ${k}=? WHERE id=?`).run(Math.max(v, p[k]), pid);
  }
}

function state(pid) {
  const p = tick(pid);
  const buildings = getBuildings(pid);
  const heroes = getHeroes(pid);
  const units = getUnits(pid);
  const training = db.prepare('SELECT * FROM training WHERE player_id=? ORDER BY finish_at').all(pid);
  const power = computePower(buildings, units, heroes);
  return {
    now: now(),
    player: {
      id: p.id, username: p.username, cityName: p.city_name, worldX: p.world_x, worldY: p.world_y,
      resources: { food: Math.floor(p.food), wood: Math.floor(p.wood), stone: Math.floor(p.stone), iron: Math.floor(p.iron), gold: Math.floor(p.gold) },
      production: production(buildings), capacity: capacity(buildings), defense: cityDefense(buildings), power,
      atkBonus: atkBonus(buildings),
    },
    buildings, units, training, heroes,
    reports: db.prepare('SELECT * FROM reports WHERE player_id=? ORDER BY id DESC LIMIT 20').all(pid),
  };
}

function computePower(buildings, units, heroes) {
  let p = 0;
  for (const b of buildings) p += b.level * 10;
  for (const t in units) p += units[t] * (G.UNITS[t].atk + G.UNITS[t].def);
  for (const h of heroes) p += h.level * 50;
  return p;
}

function build(pid, type, x, y) {
  const def = G.BUILDINGS[type];
  if (!def) throw new Error('Неизвестное здание');
  if (x < 0 || y < 0 || x >= G.CITY_SIZE || y >= G.CITY_SIZE) throw new Error('Вне города');
  const p = tick(pid);
  const bs = getBuildings(pid);
  if (bs.some(b => b.x === x && b.y === y)) throw new Error('Клетка занята');
  if (def.unique && bs.some(b => b.type === type)) throw new Error('Такое здание уже есть');
  if (type !== 'townhall') {
    const th = levelOf(bs, 'townhall');
    const sameType = bs.filter(b => b.type === type).length;
    if (sameType >= th + 1) throw new Error(`Лимит: ${th + 1} шт. Прокачай ратушу`);
  }
  const cost = G.buildingCost(type, 1);
  if (!canAfford(p, cost)) throw new Error('Не хватает ресурсов');
  pay(pid, cost);
  // Новое здание сразу строится до 1 уровня с таймером
  const t = now() + G.buildingTime(type, 1);
  db.prepare('INSERT INTO buildings (player_id,type,x,y,level,upgrade_until) VALUES (?,?,?,?,0,?)').run(pid, type, x, y, t);
  return state(pid);
}

function upgrade(pid, buildingId) {
  const p = tick(pid);
  const b = db.prepare('SELECT * FROM buildings WHERE id=? AND player_id=?').get(buildingId, pid);
  if (!b) throw new Error('Нет такого здания');
  if (b.upgrade_until) throw new Error('Уже строится');
  const def = G.BUILDINGS[b.type];
  if (b.level >= def.maxLevel) throw new Error('Максимальный уровень');
  const bs = getBuildings(pid);
  const th = levelOf(bs, 'townhall');
  if (b.type !== 'townhall' && b.level >= th) throw new Error('Сначала прокачай ратушу');
  const busy = bs.filter(x => x.upgrade_until).length;
  if (busy >= 2) throw new Error('Строители заняты (макс. 2 стройки)');
  const cost = G.buildingCost(b.type, b.level + 1);
  if (!canAfford(p, cost)) throw new Error('Не хватает ресурсов');
  pay(pid, cost);
  db.prepare('UPDATE buildings SET upgrade_until=? WHERE id=?').run(now() + G.buildingTime(b.type, b.level + 1), b.id);
  return state(pid);
}

function demolish(pid, buildingId) {
  const b = db.prepare('SELECT * FROM buildings WHERE id=? AND player_id=?').get(buildingId, pid);
  if (!b) throw new Error('Нет такого здания');
  if (b.type === 'townhall') throw new Error('Ратушу снести нельзя');
  db.prepare('DELETE FROM buildings WHERE id=?').run(b.id);
  return state(pid);
}

function train(pid, type, count) {
  count = Math.floor(Number(count));
  const u = G.UNITS[type];
  if (!u || !(count > 0) || count > 500) throw new Error('Неверный отряд');
  const p = tick(pid);
  const bs = getBuildings(pid);
  const bl = levelOf(bs, 'barracks');
  if (bl < u.barracks) throw new Error(`Нужны казармы ${u.barracks} ур.`);
  const cost = {};
  for (const k in u.cost) cost[k] = u.cost[k] * count;
  if (!canAfford(p, cost)) throw new Error('Не хватает ресурсов');
  const queue = db.prepare('SELECT COUNT(*) c FROM training WHERE player_id=?').get(pid).c;
  if (queue >= 3) throw new Error('Очередь обучения полна');
  pay(pid, cost);
  const last = db.prepare('SELECT MAX(finish_at) m FROM training WHERE player_id=?').get(pid).m || now();
  const speed = 1 - Math.min(0.5, (bl - 1) * 0.05);
  const finish = Math.max(last, now()) + Math.ceil(u.time * count * speed);
  db.prepare('INSERT INTO training (player_id,type,count,finish_at) VALUES (?,?,?,?)').run(pid, type, count, finish);
  return state(pid);
}

function recruitHero(pid) {
  const p = tick(pid);
  const bs = getBuildings(pid);
  const tl = levelOf(bs, 'tavern');
  const heroes = getHeroes(pid);
  if (tl === 0) throw new Error('Построй таверну');
  if (heroes.length >= tl) throw new Error('Прокачай таверну для нового героя');
  const cost = G.HERO_COST(heroes.length);
  if (!canAfford(p, cost)) throw new Error('Не хватает ресурсов');
  pay(pid, cost);
  const classes = Object.keys(G.HERO_CLASSES);
  const cls = classes[Math.floor(Math.random() * classes.length)];
  const name = G.HERO_NAMES[Math.floor(Math.random() * G.HERO_NAMES.length)];
  db.prepare('INSERT INTO heroes (player_id,class,name) VALUES (?,?,?)').run(pid, cls, name);
  return state(pid);
}

function addHeroXp(heroId, xp) {
  const h = db.prepare('SELECT * FROM heroes WHERE id=?').get(heroId);
  let level = h.level, cur = h.xp + xp;
  const ups = [];
  while (level < 50 && cur >= G.heroXpForLevel(level)) { cur -= G.heroXpForLevel(level); level++; ups.push(level); }
  db.prepare('UPDATE heroes SET level=?, xp=? WHERE id=?').run(level, cur, heroId);
  return ups;
}

function trade(pid, from, to, amount) {
  amount = Math.floor(Number(amount));
  if (!G.RESOURCES.includes(from) || !G.RESOURCES.includes(to) || from === to || !(amount > 0)) throw new Error('Неверный обмен');
  const p = tick(pid);
  const bs = getBuildings(pid);
  const ml = levelOf(bs, 'market');
  if (ml === 0) throw new Error('Построй рынок');
  if (p[from] < amount) throw new Error('Не хватает ресурсов');
  const value = { food: 1, wood: 1, stone: 1.2, iron: 2.5, gold: 4 };
  const fee = 0.3 - ml * 0.04;
  const got = Math.floor(amount * value[from] / value[to] * (1 - fee));
  pay(pid, { [from]: amount });
  give(pid, { [to]: got }, bs);
  return state(pid);
}

function addReport(pid, kind, title, body) {
  db.prepare('INSERT INTO reports (player_id,kind,title,body,created_at) VALUES (?,?,?,?,?)').run(pid, kind, title, body, now());
  db.prepare('DELETE FROM reports WHERE player_id=? AND id NOT IN (SELECT id FROM reports WHERE player_id=? ORDER BY id DESC LIMIT 30)').run(pid, pid);
}

module.exports = {
  now, getPlayer, getBuildings, getUnits, getHeroes, levelOf, capacity, production, cityDefense, atkBonus,
  tick, canAfford, pay, give, state, computePower, build, upgrade, demolish, train, recruitHero, addHeroXp, trade, addReport,
};
