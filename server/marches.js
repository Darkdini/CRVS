'use strict';
// Походы: армия идёт к цели по карте, дерётся/собирает, возвращается с добычей.
const db = require('./db');
const G = require('./gamedata');
const game = require('./game');
const battle = require('./battle');

const now = game.now;
const fmtRes = (r) => Object.entries(r).filter(([, v]) => v > 0).map(([k, v]) => `${RES[k] || k}: ${v}`).join(', ') || 'ничего';
const RES = { food: 'еда', wood: 'дерево', stone: 'камень', iron: 'железо', gold: 'золото' };
const fmtArmy = (a) => Object.entries(a).filter(([, v]) => v > 0).map(([k, v]) => `${G.UNITS[k].name} ×${v}`).join(', ') || 'нет';

function dist(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }
function armySpeed(army) { let s = Infinity; for (const t in army) if (army[t] > 0) s = Math.min(s, G.UNITS[t].speed); return s === Infinity ? 20 : s; }
function armyCarry(army, mul) { let c = 0; for (const t in army) c += (army[t] || 0) * G.UNITS[t].carry; return Math.floor(c * mul); }
function travelTime(d, army, techs) { return Math.max(10, Math.ceil(d / armySpeed(army) * 60 / game.speedBonus(techs))); }

function getMarch(id) {
  const m = db.prepare('SELECT * FROM marches WHERE id=?').get(id);
  return m && { ...m, army: JSON.parse(m.army), hero_ids: JSON.parse(m.hero_ids), loot: JSON.parse(m.loot) };
}

// Создать поход. kind: monster | boss | player | gather
function send(pid, kind, x, y, wantedArmy, heroIds) {
  x = +x; y = +y;
  game.tick(pid);
  const me = game.getPlayer(pid);
  const active = db.prepare('SELECT COUNT(*) c FROM marches WHERE player_id=?').get(pid).c;
  const bs = game.getBuildings(pid);
  const maxMarches = 1 + Math.floor(game.levelOf(bs, 'townhall') / 3);
  if (active >= maxMarches) throw new Error(`Лимит походов: ${maxMarches}. Прокачай ратушу`);
  const have = game.getUnits(pid);
  const army = {};
  for (const t in wantedArmy || {}) {
    const n = Math.floor(Number(wantedArmy[t]));
    if (G.UNITS[t] && n > 0) army[t] = Math.min(n, have[t] || 0);
  }
  const total = Object.values(army).reduce((a, b) => a + b, 0);
  const t = now();
  const heroes = game.getHeroes(pid).filter(h => (heroIds || []).map(Number).includes(h.id) && h.injured_until <= t);
  const busyHeroes = new Set(db.prepare('SELECT hero_ids FROM marches WHERE player_id=?').all(pid).flatMap(m => JSON.parse(m.hero_ids)));
  for (const h of heroes) if (busyHeroes.has(h.id)) throw new Error(`${h.name} уже в походе`);
  if (total === 0 && !(kind !== 'gather' && heroes.length)) throw new Error(kind === 'gather' ? 'Для сбора нужны воины' : 'Выбери войска или героев');
  if (kind === 'gather' && total < 5) throw new Error('Для сбора нужно хотя бы 5 воинов');
  let targetId = null;
  if (kind === 'monster') {
    const m = db.prepare('SELECT * FROM monsters WHERE x=? AND y=? AND dead_until=0').get(x, y);
    if (!m) throw new Error('Монстра здесь нет'); targetId = String(m.id);
  } else if (kind === 'boss') {
    const b = db.prepare('SELECT * FROM bosses WHERE x=? AND y=?').get(x, y);
    if (!b) throw new Error('Босса здесь нет'); if (b.dead_until > t) throw new Error('Босс ещё не возродился'); targetId = b.key;
  } else if (kind === 'player') {
    const p = db.prepare('SELECT * FROM players WHERE world_x=? AND world_y=?').get(x, y);
    if (!p || p.id === pid) throw new Error('Здесь нет чужого города');
    if (p.alliance_id && p.alliance_id === me.alliance_id) throw new Error('Это союзник');
    if (p.created_at + 86400 > t) throw new Error('У новичка щит на сутки');
    if (p.attacked_at + 600 > t) throw new Error('Город недавно атаковали — щит');
    if (total === 0) throw new Error('Для набега нужны войска');
    targetId = String(p.id);
  } else if (kind === 'gather') {
    const tile = db.prepare('SELECT * FROM world_tiles WHERE x=? AND y=?').get(x, y);
    if (!tile || !tile.object || !tile.object.startsWith('node:')) throw new Error('Здесь нечего собирать');
    const cd = db.prepare('SELECT ready_at FROM node_cooldowns WHERE x=? AND y=? AND player_id=?').get(x, y, pid);
    if (cd && cd.ready_at > t) throw new Error(`Точка истощена для вас, ждать ${Math.ceil((cd.ready_at - t) / 60)} мин`);
    targetId = tile.object.slice(5);
  } else throw new Error('Неизвестный тип похода');
  const techs = game.getTechs(pid);
  const d = dist(me.world_x, me.world_y, x, y);
  const travel = travelTime(d, total ? army : { scout: 1 }, techs);
  // снять войска из города
  for (const u in army) db.prepare('UPDATE units SET count=count-? WHERE player_id=? AND type=?').run(army[u], pid, u);
  db.prepare(`INSERT INTO marches (player_id,kind,target_x,target_y,target_id,army,hero_ids,status,depart_at,arrive_at,travel)
    VALUES (?,?,?,?,?,?,?,'going',?,?,?)`).run(pid, kind, x, y, targetId, JSON.stringify(army), JSON.stringify(heroes.map(h => h.id)), t, t + travel, travel);
  return game.state(pid);
}

function recall(pid, id) {
  const m = getMarch(id);
  if (!m || m.player_id !== pid) throw new Error('Нет такого похода');
  const t = now();
  if (m.status === 'returning') throw new Error('Уже возвращается');
  const elapsed = m.status === 'going' ? Math.min(m.travel, t - m.depart_at) : m.travel;
  db.prepare("UPDATE marches SET status='returning', return_at=?, work_until=NULL WHERE id=?").run(t + Math.max(5, elapsed), m.id);
  return game.state(pid);
}

// Обработка всех походов (вызывается по таймеру и при запросе состояния)
function process() {
  const t = now();
  for (const row of db.prepare("SELECT id FROM marches WHERE (status='going' AND arrive_at<=?) OR (status='working' AND work_until<=?) OR (status='returning' AND return_at<=?)").all(t, t, t)) {
    const m = getMarch(row.id);
    try {
      if (m.status === 'going') arrive(m);
      else if (m.status === 'working') finishWork(m);
      else finishReturn(m);
    } catch (e) { console.error('[march]', m.id, e); db.prepare("UPDATE marches SET status='returning', return_at=? WHERE id=?").run(t + m.travel, m.id); }
  }
}

function heroesOf(m) { return game.getHeroes(m.player_id).filter(h => m.hero_ids.includes(h.id)); }
function startReturn(m, loot, result) {
  const t = now();
  db.prepare("UPDATE marches SET status='returning', return_at=?, loot=?, result=? WHERE id=?").run(t + m.travel, JSON.stringify(loot || {}), result ? JSON.stringify(result) : null, m.id);
}
function applyLosses(m, lossRatio) {
  const pid = m.player_id;
  const lost = battle.applyLosses(m.army, lossRatio);
  const { dead, wounded } = game.addWounded(pid, lost, game.getTechs(pid), game.getBuildings(pid));
  const left = { ...m.army }; for (const u in lost) left[u] -= lost[u];
  db.prepare('UPDATE marches SET army=? WHERE id=?').run(JSON.stringify(left), m.id);
  m.army = left;
  return { lost, dead, wounded };
}

function arrive(m) {
  const pid = m.player_id, t = now();
  const heroes = heroesOf(m);
  const bs = game.getBuildings(pid), techs = game.getTechs(pid);
  const atkMul = game.atkBonus(bs, techs);
  if (m.kind === 'gather') {
    const node = G.NODES[m.target_id];
    const carry = armyCarry(m.army, game.carryBonus(techs));
    const amount = Math.min(carry, node.amount * 2);
    const duration = Math.max(20, Math.ceil(amount / Math.max(1, Object.values(m.army).reduce((a, b) => a + b, 0)) * 6));
    db.prepare("UPDATE marches SET status='working', work_until=?, loot=? WHERE id=?").run(t + duration, JSON.stringify({ [node.resource]: amount }), m.id);
    db.prepare('INSERT INTO node_cooldowns (x,y,player_id,ready_at) VALUES (?,?,?,?) ON CONFLICT(x,y,player_id) DO UPDATE SET ready_at=excluded.ready_at').run(m.target_x, m.target_y, pid, t + duration + node.cooldown);
    return;
  }
  if (m.kind === 'monster') {
    const mon = db.prepare('SELECT * FROM monsters WHERE id=?').get(+m.target_id);
    if (!mon || mon.dead_until > 0 || mon.x !== m.target_x || mon.y !== m.target_y) { game.addReport(pid, 'monster', 'Монстр ушёл', 'Цель исчезла до прихода армии.'); return startReturn(m, {}, { win: false, gone: true }); }
    const ms = G.monsterStats(mon.level);
    const a = battle.armyStats(m.army, heroes, atkMul * (heroes.some(h => h.class === 'mage') ? 1.15 : 1));
    a.def *= game.defBonus(techs);
    const sim = battle.simulate(a, { atk: ms.atk, def: ms.def, hp: mon.hp }, 10);
    const lossRatio = a.hp > 0 ? 1 - sim.aLeft / a.hp : 0;
    const { lost, dead, wounded } = applyLosses(m, lossRatio);
    const xpGain = Math.floor(ms.xp * Math.min(1, sim.aDamageDealt / ms.hp)) + 10;
    const levelUps = [];
    for (const h of heroes) { const ups = game.addHeroXp(h.id, xpGain); if (ups.length) levelUps.push(`${h.name} → ${ups[ups.length - 1]} ур.`); }
    let loot = {}, item = null;
    const name = `${G.MONSTERS[mon.type].name} ${mon.level} ур.`;
    if (sim.win) {
      db.prepare('UPDATE monsters SET hp=?, dead_until=? WHERE id=?').run(ms.hp, t + ms.respawn, mon.id);
      game.bumpStat(pid, 'kills');
      const carry = armyCarry(m.army, game.carryBonus(techs)) + heroes.length * 200;
      const rogue = heroes.some(h => h.class === 'rogue') ? 1.25 : 1;
      let left = carry;
      for (const k of ['gold', 'iron', 'stone', 'wood', 'food']) { const v = Math.min(left, Math.floor(ms.loot[k] * rogue)); if (v > 0) { loot[k] = v; left -= v; } }
      if (Math.random() < ms.itemChance) item = game.dropItem(pid, mon.level);
    } else {
      db.prepare('UPDATE monsters SET hp=? WHERE id=?').run(Math.max(1, sim.bLeft), mon.id);
      if (lossRatio > 0.6) for (const h of heroes) db.prepare('UPDATE heroes SET injured_until=? WHERE id=?').run(t + 300, h.id);
    }
    const result = { kind: 'monster', target: name, win: sim.win, damage: sim.aDamageDealt, lost, dead, wounded, loot, item, xpGain, levelUps, log: sim.log };
    game.addReport(pid, 'monster', `${sim.win ? 'Победа' : 'Поражение'}: ${name}`,
      `Урон ${sim.aDamageDealt}. Погибло: ${fmtArmy(dead)}. Ранено: ${fmtArmy(wounded)}. Добыча: ${fmtRes(loot)}.${item ? ` Трофей: ${item.name} (${item.rarity}).` : ''} Опыт +${xpGain}.`);
    return startReturn(m, loot, result);
  }
  if (m.kind === 'boss') {
    const bossDef = G.BOSSES[m.target_id];
    const boss = db.prepare('SELECT * FROM bosses WHERE key=?').get(m.target_id);
    if (boss.dead_until > t) { game.addReport(pid, 'boss', 'Босс мёртв', 'Кто-то добил босса раньше вас.'); return startReturn(m, {}, { win: false, gone: true }); }
    const a = battle.armyStats(m.army, heroes, atkMul * (heroes.some(h => h.class === 'mage') ? 1.3 : 1));
    a.def *= game.defBonus(techs);
    const sim = battle.simulate(a, { atk: bossDef.atk, def: bossDef.def, hp: boss.hp }, 8);
    const lossRatio = a.hp > 0 ? 1 - sim.aLeft / a.hp : 0;
    const { lost, dead, wounded } = applyLosses(m, lossRatio);
    if (lossRatio > 0.6) for (const h of heroes) db.prepare('UPDATE heroes SET injured_until=? WHERE id=?').run(t + 300, h.id);
    db.prepare('INSERT INTO boss_damage (boss_key,player_id,damage) VALUES (?,?,?) ON CONFLICT(boss_key,player_id) DO UPDATE SET damage=damage+excluded.damage').run(m.target_id, pid, sim.aDamageDealt);
    const xpGain = Math.floor(bossDef.xp * Math.min(1, sim.aDamageDealt / bossDef.hp) + 20);
    const levelUps = [];
    for (const h of heroes) { const ups = game.addHeroXp(h.id, xpGain); if (ups.length) levelUps.push(`${h.name} → ${ups[ups.length - 1]} ур.`); }
    let reward = {}, killed = false, item = null;
    const newHp = boss.hp - sim.aDamageDealt;
    if (newHp <= 0) {
      killed = true;
      const me = game.getPlayer(pid);
      db.prepare('UPDATE bosses SET hp=?, dead_until=?, kills=kills+1, last_killer=? WHERE key=?').run(bossDef.hp, t + bossDef.respawn, me.username, m.target_id);
      const dmg = db.prepare('SELECT player_id, damage FROM boss_damage WHERE boss_key=?').all(m.target_id);
      const sum = dmg.reduce((s, d) => s + d.damage, 0) || 1;
      for (const d of dmg) {
        const share = Math.min(1, d.damage / sum) * (d.player_id === pid ? 1.5 : 1);
        const r = {}; for (const k in bossDef.reward) r[k] = Math.max(1, Math.floor(bossDef.reward[k] * share));
        if (d.player_id === pid && heroes.some(h => h.class === 'rogue')) for (const k in r) r[k] = Math.floor(r[k] * 1.25);
        game.bumpStat(d.player_id, 'boss_kills');
        const it = game.dropItem(d.player_id, 5 + bossDef.level * 3);
        if (d.player_id === pid) { reward = r; item = it; }
        else { game.give(d.player_id, r); game.addReport(d.player_id, 'boss', `${bossDef.name} повержен`, `${me.username} добил босса. Ваша доля: ${fmtRes(r)}. Трофей: ${it.name}.`); }
      }
      db.prepare('DELETE FROM boss_damage WHERE boss_key=?').run(m.target_id);
      db.prepare("INSERT INTO chat (player_id,username,text,created_at,channel) VALUES (0,?,?,?,'world')").run('Герольд', `${me.username} сразил босса «${bossDef.name}»!`, t);
    } else db.prepare('UPDATE bosses SET hp=? WHERE key=?').run(newHp, m.target_id);
    const result = { kind: 'boss', target: bossDef.name, win: sim.win, killed, damage: sim.aDamageDealt, bossHpLeft: Math.max(0, newHp), bossMaxHp: bossDef.hp, lost, dead, wounded, loot: reward, item, xpGain, levelUps, log: sim.log };
    game.addReport(pid, 'boss', killed ? `Босс ${bossDef.name} повержен!` : `Бой с ${bossDef.name}`,
      `Урон ${sim.aDamageDealt}. Погибло: ${fmtArmy(dead)}. Ранено: ${fmtArmy(wounded)}. Опыт +${xpGain}.` + (killed ? ` Награда: ${fmtRes(reward)}. Трофей: ${item.name}.` : ''));
    return startReturn(m, reward, result);
  }
  if (m.kind === 'player') {
    const target = game.getPlayer(+m.target_id);
    const me = game.getPlayer(pid);
    if (!target) return startReturn(m, {}, { win: false, gone: true });
    game.tick(target.id);
    const a = battle.armyStats(m.army, heroes, atkMul); a.def *= game.defBonus(techs);
    const tb = game.getBuildings(target.id), tTechs = game.getTechs(target.id);
    const tArmy = game.getUnits(target.id);
    const tHeroes = game.getHeroes(target.id).filter(h => h.injured_until <= t);
    const d = battle.armyStats(tArmy, tHeroes, game.atkBonus(tb, tTechs));
    const wallDef = game.cityDefense(tb, tTechs);
    d.def = d.def * game.defBonus(tTechs) + wallDef; d.hp += wallDef * 5;
    const sim = battle.simulate(a, d, 10);
    const myLoss = a.hp > 0 ? 1 - sim.aLeft / a.hp : 0;
    const theirLoss = d.hp > 0 ? 1 - sim.bLeft / d.hp : 0;
    const { lost, dead, wounded } = applyLosses(m, myLoss);
    const tLost = battle.applyLosses(tArmy, theirLoss * 0.8);
    for (const u in tLost) db.prepare('UPDATE units SET count=MAX(0,count-?) WHERE player_id=? AND type=?').run(tLost[u], target.id, u);
    const tw = game.addWounded(target.id, tLost, tTechs, tb);
    let loot = {};
    if (sim.win) {
      const pct = 0.15 * (heroes.some(h => h.class === 'rogue') ? 1.25 : 1);
      let carry = armyCarry(m.army, game.carryBonus(techs));
      const fresh = game.getPlayer(target.id);
      for (const k of ['gold', 'iron', 'stone', 'wood', 'food']) { const amt = Math.min(Math.floor(fresh[k] * pct), carry); if (amt > 0) { loot[k] = amt; carry -= amt; } }
      game.pay(target.id, loot);
      game.bumpStat(pid, 'raids');
    }
    for (const h of heroes) game.addHeroXp(h.id, 40 + (sim.win ? 60 : 0));
    db.prepare('UPDATE players SET attacked_at=? WHERE id=?').run(t, target.id);
    const result = { kind: 'player', target: target.city_name, win: sim.win, lost, dead, wounded, loot, log: sim.log };
    game.addReport(pid, 'raid', `${sim.win ? 'Победа' : 'Поражение'}: набег на ${target.city_name}`, `Погибло: ${fmtArmy(dead)}. Ранено: ${fmtArmy(wounded)}. Добыча: ${fmtRes(loot)}.`);
    game.addReport(target.id, 'defense', `${sim.win ? 'Город разграблен' : 'Оборона выстояла'}: ${me.username}`, `Погибло: ${fmtArmy(tw.dead)}. Ранено: ${fmtArmy(tw.wounded)}. Потеряно: ${fmtRes(loot)}.`);
    return startReturn(m, loot, result);
  }
}

function finishWork(m) {
  if (m.kind === 'gather') { game.bumpStat(m.player_id, 'gathers'); }
  startReturn(m, m.loot, { kind: 'gather', loot: m.loot });
}

function finishReturn(m) {
  const pid = m.player_id;
  for (const u in m.army) if (m.army[u] > 0) db.prepare('INSERT INTO units (player_id,type,count) VALUES (?,?,?) ON CONFLICT(player_id,type) DO UPDATE SET count=count+excluded.count').run(pid, u, m.army[u]);
  game.give(pid, m.loot);
  if (Object.keys(m.loot).length) game.addReport(pid, 'return', 'Армия вернулась', `Доставлено: ${fmtRes(m.loot)}.`);
  db.prepare('DELETE FROM marches WHERE id=?').run(m.id);
}

module.exports = { send, recall, process, travelTime, armyCarry, dist };
