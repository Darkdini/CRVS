'use strict';
const db = require('./db');
const G = require('./gamedata');
const game = require('./game');

function info(id) {
  const a = db.prepare('SELECT * FROM alliances WHERE id=?').get(id);
  if (!a) return null;
  const members = db.prepare('SELECT id,username,city_name,world_x,world_y FROM players WHERE alliance_id=?').all(id).map(p => ({
    ...p, power: game.computePower(game.getBuildings(p.id), game.getUnits(p.id), game.getHeroes(p.id)), leader: p.id === a.leader_id,
  })).sort((x, y) => y.power - x.power);
  return { ...a, members, power: members.reduce((s, m) => s + m.power, 0) };
}
function list() {
  return db.prepare('SELECT a.*, (SELECT COUNT(*) FROM players p WHERE p.alliance_id=a.id) members FROM alliances a ORDER BY id').all()
    .map(a => ({ ...a, power: db.prepare('SELECT id FROM players WHERE alliance_id=?').all(a.id).reduce((s, p) => s + game.computePower(game.getBuildings(p.id), game.getUnits(p.id), game.getHeroes(p.id)), 0) }))
    .sort((x, y) => y.power - x.power);
}
function requireEmbassy(pid) {
  if (game.levelOf(game.getBuildings(pid), 'embassy') === 0) throw new Error('Построй посольство');
}
function create(pid, name, tag, description) {
  name = String(name || '').trim().slice(0, 24); tag = String(tag || '').trim().toUpperCase().slice(0, 5);
  if (name.length < 3 || tag.length < 2) throw new Error('Имя от 3 символов, тег 2–5');
  const p = game.tick(pid);
  if (p.alliance_id) throw new Error('Ты уже в альянсе');
  requireEmbassy(pid);
  if (!game.canAfford(p, G.ALLIANCE_COST)) throw new Error('Нужно 500 золота');
  if (db.prepare('SELECT id FROM alliances WHERE name=? COLLATE NOCASE OR tag=?').get(name, tag)) throw new Error('Имя или тег заняты');
  game.pay(pid, G.ALLIANCE_COST);
  const r = db.prepare('INSERT INTO alliances (name,tag,leader_id,created_at,description) VALUES (?,?,?,?,?)').run(name, tag, pid, game.now(), String(description || '').slice(0, 200));
  db.prepare('UPDATE players SET alliance_id=? WHERE id=?').run(Number(r.lastInsertRowid), pid);
  return game.state(pid);
}
function join(pid, id) {
  const p = game.getPlayer(pid);
  if (p.alliance_id) throw new Error('Ты уже в альянсе');
  requireEmbassy(pid);
  const a = db.prepare('SELECT * FROM alliances WHERE id=?').get(+id);
  if (!a) throw new Error('Нет такого альянса');
  if (db.prepare('SELECT COUNT(*) c FROM players WHERE alliance_id=?').get(a.id).c >= 30) throw new Error('Альянс полон');
  db.prepare('UPDATE players SET alliance_id=? WHERE id=?').run(a.id, pid);
  db.prepare("INSERT INTO chat (player_id,username,text,created_at,channel) VALUES (0,?,?,?,?)").run('Герольд', `${p.username} вступил в альянс`, game.now(), 'alliance:' + a.id);
  return game.state(pid);
}
function leave(pid) {
  const p = game.getPlayer(pid);
  if (!p.alliance_id) throw new Error('Ты не в альянсе');
  const a = db.prepare('SELECT * FROM alliances WHERE id=?').get(p.alliance_id);
  db.prepare('UPDATE players SET alliance_id=NULL WHERE id=?').run(pid);
  const rest = db.prepare('SELECT id FROM players WHERE alliance_id=? ORDER BY id').all(a.id);
  if (!rest.length) db.prepare('DELETE FROM alliances WHERE id=?').run(a.id);
  else if (a.leader_id === pid) db.prepare('UPDATE alliances SET leader_id=? WHERE id=?').run(rest[0].id, a.id);
  return game.state(pid);
}
function kick(pid, targetId) {
  const p = game.getPlayer(pid);
  const a = p.alliance_id && db.prepare('SELECT * FROM alliances WHERE id=?').get(p.alliance_id);
  if (!a || a.leader_id !== pid) throw new Error('Только глава альянса');
  const t = game.getPlayer(+targetId);
  if (!t || t.alliance_id !== a.id || t.id === pid) throw new Error('Неверная цель');
  db.prepare('UPDATE players SET alliance_id=NULL WHERE id=?').run(t.id);
  return game.state(pid);
}
module.exports = { info, list, create, join, leave, kick };
