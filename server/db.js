'use strict';
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'game.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  city_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_tick INTEGER NOT NULL,
  food REAL NOT NULL, wood REAL NOT NULL, stone REAL NOT NULL, iron REAL NOT NULL, gold REAL NOT NULL,
  world_x INTEGER NOT NULL, world_y INTEGER NOT NULL,
  last_attack_at INTEGER NOT NULL DEFAULT 0,
  attacked_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  upgrade_until INTEGER,
  UNIQUE(player_id, x, y)
);
CREATE TABLE IF NOT EXISTS units (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(player_id, type)
);
CREATE TABLE IF NOT EXISTS training (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL, count INTEGER NOT NULL, finish_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS heroes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  class TEXT NOT NULL, name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0,
  hp_lost INTEGER NOT NULL DEFAULT 0, injured_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS world_tiles (
  x INTEGER NOT NULL, y INTEGER NOT NULL,
  terrain TEXT NOT NULL,
  object TEXT,            -- тип объекта: boss id, node id или NULL
  PRIMARY KEY(x, y)
);
CREATE TABLE IF NOT EXISTS bosses (
  key TEXT PRIMARY KEY,
  x INTEGER NOT NULL, y INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  dead_until INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  last_killer TEXT
);
CREATE TABLE IF NOT EXISTS boss_damage (
  boss_key TEXT NOT NULL, player_id INTEGER NOT NULL, damage INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(boss_key, player_id)
);
CREATE TABLE IF NOT EXISTS node_cooldowns (
  x INTEGER NOT NULL, y INTEGER NOT NULL, player_id INTEGER NOT NULL,
  ready_at INTEGER NOT NULL,
  PRIMARY KEY(x, y, player_id)
);
CREATE TABLE IF NOT EXISTS chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL, username TEXT NOT NULL,
  text TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS monsters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  x INTEGER NOT NULL, y INTEGER NOT NULL,
  type TEXT NOT NULL, level INTEGER NOT NULL,
  hp INTEGER NOT NULL, dead_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS monsters_xy ON monsters(x, y);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  hero_id INTEGER,
  slot TEXT NOT NULL, tier INTEGER NOT NULL, rarity TEXT NOT NULL, name TEXT NOT NULL,
  stat TEXT NOT NULL, value INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS research (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tech TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 0, finish_at INTEGER,
  PRIMARY KEY(player_id, tech)
);
CREATE TABLE IF NOT EXISTS wounded (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(player_id, type)
);
CREATE TABLE IF NOT EXISTS marches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,            -- monster | boss | player | gather
  target_x INTEGER NOT NULL, target_y INTEGER NOT NULL,
  target_id TEXT,                -- id монстра / ключ босса / id игрока
  army TEXT NOT NULL,            -- JSON {type:count}
  hero_ids TEXT NOT NULL,        -- JSON [id]
  status TEXT NOT NULL,          -- going | working | returning
  depart_at INTEGER NOT NULL, arrive_at INTEGER NOT NULL, work_until INTEGER, return_at INTEGER,
  travel INTEGER NOT NULL,
  loot TEXT NOT NULL DEFAULT '{}',
  result TEXT                    -- JSON итог боя
);
CREATE TABLE IF NOT EXISTS quests_done (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  PRIMARY KEY(player_id, quest_id)
);
CREATE TABLE IF NOT EXISTS stats (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  kills INTEGER NOT NULL DEFAULT 0, boss_kills INTEGER NOT NULL DEFAULT 0, gathers INTEGER NOT NULL DEFAULT 0, raids INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS alliances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL, tag TEXT UNIQUE NOT NULL,
  leader_id INTEGER NOT NULL, created_at INTEGER NOT NULL, description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL
);
`);

// миграции для старых баз
for (const sql of [
  'ALTER TABLE players ADD COLUMN alliance_id INTEGER',
  "ALTER TABLE chat ADD COLUMN channel TEXT NOT NULL DEFAULT 'world'",
  'ALTER TABLE reports ADD COLUMN data TEXT',
]) { try { db.exec(sql); } catch (e) { /* уже есть */ } }

module.exports = db;
