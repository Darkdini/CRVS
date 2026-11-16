'use strict';
// Генерация общего мира (один раз) и помощники.
const db = require('./db');
const G = require('./gamedata');

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// простой value-noise
function makeNoise(rand, size) {
  const grid = [];
  const step = 6;
  const n = Math.ceil(size / step) + 2;
  for (let i = 0; i < n * n; i++) grid.push(rand());
  const lerp = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
  return (x, y) => {
    const gx = x / step, gy = y / step;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const v = (i, j) => grid[(y0 + j) * n + (x0 + i)];
    return lerp(lerp(v(0, 0), v(1, 0), fx), lerp(v(0, 1), v(1, 1), fx), fy);
  };
}

function generateWorld() {
  const count = db.prepare('SELECT COUNT(*) c FROM world_tiles').get().c;
  if (count > 0) return;
  const S = G.WORLD.size;
  const rand = mulberry32(20261116);
  const height = makeNoise(rand, S);
  const moist = makeNoise(rand, S);
  const ins = db.prepare('INSERT INTO world_tiles (x,y,terrain,object) VALUES (?,?,?,NULL)');
  const tiles = [];
  db.exec('BEGIN');
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const h = height(x, y), m = moist(x, y);
    let t = 'grass';
    if (h < 0.3) t = 'water';
    else if (h < 0.36) t = 'sand';
    else if (h > 0.78) t = 'snow';
    else if (h > 0.68) t = 'mountain';
    else if (m > 0.62) t = 'forest';
    else if (m < 0.3 && h < 0.5) t = 'swamp';
    else if (m < 0.42) t = 'dirt';
    tiles.push({ x, y, t });
    ins.run(x, y, t);
  }
  // Боссы — на фиксированных, но проходимых местах
  const bossKeys = Object.keys(G.BOSSES);
  const upd = db.prepare('UPDATE world_tiles SET object=? WHERE x=? AND y=?');
  const insBoss = db.prepare('INSERT INTO bosses (key,x,y,hp) VALUES (?,?,?,?)');
  const placed = new Set();
  const findLand = () => {
    for (let i = 0; i < 1000; i++) {
      const x = Math.floor(rand() * S), y = Math.floor(rand() * S);
      const t = tiles[y * S + x].t;
      if (t !== 'water' && !placed.has(x + ',' + y)) { placed.add(x + ',' + y); return { x, y }; }
    }
    return null;
  };
  for (const k of bossKeys) {
    const p = findLand();
    upd.run('boss:' + k, p.x, p.y);
    insBoss.run(k, p.x, p.y, G.BOSSES[k].hp);
  }
  // Ресурсные точки
  const nodeKeys = Object.keys(G.NODES);
  for (let i = 0; i < 70; i++) {
    const p = findLand();
    if (!p) break;
    const t = tiles[p.y * S + p.x].t;
    let nk;
    if (t === 'forest') nk = 'forest_node';
    else if (t === 'mountain' || t === 'snow') nk = rand() < 0.5 ? 'stone_node' : 'iron_node';
    else if (t === 'grass') nk = rand() < 0.7 ? 'farm_node' : 'gold_node';
    else nk = nodeKeys[Math.floor(rand() * nodeKeys.length)];
    upd.run('node:' + nk, p.x, p.y);
  }
  db.exec('COMMIT');
  console.log('[world] generated', S + 'x' + S);
}

// Монстры: ~140 штук, уровень растёт от центра карты к краям? Нет — по кольцам от случайных «очагов».
function spawnMonsters() {
  const c = db.prepare('SELECT COUNT(*) c FROM monsters').get().c;
  if (c > 0) return;
  const S = G.WORLD.size;
  const rand = mulberry32(777);
  const occupied = new Set(db.prepare('SELECT x,y FROM world_tiles WHERE object IS NOT NULL').all().map(t => t.x + ',' + t.y));
  const land = db.prepare("SELECT x,y FROM world_tiles WHERE terrain != 'water'").all();
  const types = Object.entries(G.MONSTERS);
  const ins = db.prepare('INSERT INTO monsters (x,y,type,level,hp) VALUES (?,?,?,?,?)');
  db.exec('BEGIN');
  let n = 0;
  for (let i = 0; i < 4000 && n < 140; i++) {
    const t = land[Math.floor(rand() * land.length)];
    const k = t.x + ',' + t.y;
    if (occupied.has(k)) continue;
    // уровень: 1–20, чаще низкие
    const level = Math.max(1, Math.min(20, Math.floor(Math.pow(rand(), 1.7) * 20) + 1));
    const pool = types.filter(([, m]) => m.minLvl <= level);
    const [type] = pool[Math.floor(rand() * pool.length)];
    ins.run(t.x, t.y, type, level, G.monsterStats(level).hp);
    occupied.add(k); n++;
  }
  db.exec('COMMIT');
  console.log('[world] monsters spawned', n);
}

// Возрождение: мёртвые монстры возвращаются на новую клетку с полным HP
function respawnMonsters() {
  const t = Math.floor(Date.now() / 1000);
  const dead = db.prepare('SELECT * FROM monsters WHERE dead_until>0 AND dead_until<=?').all(t);
  if (!dead.length) return;
  const S = G.WORLD.size;
  const occupied = new Set([
    ...db.prepare('SELECT x,y FROM world_tiles WHERE object IS NOT NULL').all().map(t => t.x + ',' + t.y),
    ...db.prepare('SELECT x,y FROM monsters WHERE dead_until=0').all().map(t => t.x + ',' + t.y),
    ...db.prepare('SELECT world_x x, world_y y FROM players').all().map(t => t.x + ',' + t.y),
  ]);
  const land = db.prepare("SELECT x,y FROM world_tiles WHERE terrain != 'water'").all();
  for (const m of dead) {
    let spot = { x: m.x, y: m.y };
    for (let i = 0; i < 50; i++) { const c = land[Math.floor(Math.random() * land.length)]; if (!occupied.has(c.x + ',' + c.y)) { spot = c; break; } }
    occupied.add(spot.x + ',' + spot.y);
    db.prepare('UPDATE monsters SET x=?, y=?, hp=?, dead_until=0 WHERE id=?').run(spot.x, spot.y, G.monsterStats(m.level).hp, m.id);
  }
}

function findFreeCitySpot() {
  const S = G.WORLD.size;
  const taken = new Set(db.prepare('SELECT world_x x, world_y y FROM players').all().map(p => p.x + ',' + p.y));
  const mon = new Set(db.prepare('SELECT x,y FROM monsters').all().map(m => m.x + ',' + m.y));
  const rows = db.prepare("SELECT x,y FROM world_tiles WHERE terrain IN ('grass','dirt','sand') AND object IS NULL").all().filter(r => !mon.has(r.x + ',' + r.y));
  for (let i = 0; i < 2000; i++) {
    const r = rows[Math.floor(Math.random() * rows.length)];
    if (!taken.has(r.x + ',' + r.y)) return r;
  }
  return { x: Math.floor(S / 2), y: Math.floor(S / 2) };
}

module.exports = { generateWorld, findFreeCitySpot, spawnMonsters, respawnMonsters };
