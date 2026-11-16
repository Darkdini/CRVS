// Общие игровые данные (баланс). Отдаются клиенту через /api/gamedata.
'use strict';

const RESOURCES = ['food', 'wood', 'stone', 'iron', 'gold'];

const CITY_SIZE = 10; // 10x10 тайлов

// Стоимость уровня L: base * growth^(L-1)
function scaled(base, growth, level) {
  const out = {};
  for (const k of Object.keys(base)) out[k] = Math.floor(base[k] * Math.pow(growth, level - 1));
  return out;
}

const BUILDINGS = {
  townhall: {
    name: 'Ратуша', desc: 'Сердце города. Повышает лимит уровня остальных зданий и даёт золото.',
    unique: true, maxLevel: 10, base: { wood: 100, stone: 100 }, growth: 1.9, time: 20,
    produces: { gold: 20 }, prodGrowth: 1.5,
  },
  farm: {
    name: 'Ферма', desc: 'Производит еду для армии и героев.',
    maxLevel: 10, base: { wood: 40 }, growth: 1.6, time: 10,
    produces: { food: 60 }, prodGrowth: 1.45,
  },
  sawmill: {
    name: 'Лесопилка', desc: 'Добывает дерево.',
    maxLevel: 10, base: { wood: 30, stone: 20 }, growth: 1.6, time: 10,
    produces: { wood: 50 }, prodGrowth: 1.45,
  },
  quarry: {
    name: 'Каменоломня', desc: 'Добывает камень.',
    maxLevel: 10, base: { wood: 60 }, growth: 1.6, time: 12,
    produces: { stone: 40 }, prodGrowth: 1.45,
  },
  mine: {
    name: 'Рудник', desc: 'Добывает железо для оружия.',
    maxLevel: 10, base: { wood: 80, stone: 60 }, growth: 1.65, time: 15,
    produces: { iron: 25 }, prodGrowth: 1.45,
  },
  warehouse: {
    name: 'Склад', desc: 'Увеличивает вместимость ресурсов.',
    maxLevel: 10, base: { wood: 80, stone: 80 }, growth: 1.7, time: 15,
    capacity: 2000, capGrowth: 1.6,
  },
  barracks: {
    name: 'Казармы', desc: 'Обучение воинов. Уровень открывает новые отряды.',
    maxLevel: 10, base: { wood: 120, stone: 80, iron: 20 }, growth: 1.7, time: 20,
  },
  tavern: {
    name: 'Таверна', desc: 'Здесь нанимают героев. Уровень = число героев.',
    maxLevel: 5, base: { wood: 150, stone: 50, gold: 100 }, growth: 2.0, time: 25,
  },
  wall: {
    name: 'Стена', desc: 'Защита города от набегов.',
    maxLevel: 10, base: { stone: 150 }, growth: 1.7, time: 20,
    defense: 50, defGrowth: 1.5,
  },
  tower: {
    name: 'Башня', desc: 'Стреляет по нападающим.',
    maxLevel: 10, base: { stone: 100, wood: 50, iron: 30 }, growth: 1.7, time: 18,
    defense: 30, defGrowth: 1.5,
  },
  market: {
    name: 'Рынок', desc: 'Обмен ресурсов. Уровень снижает комиссию.',
    maxLevel: 5, base: { wood: 100, gold: 50 }, growth: 1.8, time: 15,
  },
  blacksmith: {
    name: 'Кузница', desc: 'Усиливает атаку героев и войск.',
    maxLevel: 10, base: { wood: 80, stone: 80, iron: 60 }, growth: 1.75, time: 20,
    atkBonus: 0.03,
  },
};

function buildingCost(type, level) {
  const b = BUILDINGS[type];
  return scaled(b.base, b.growth, level);
}
function buildingTime(type, level) {
  const b = BUILDINGS[type];
  return Math.floor(b.time * Math.pow(1.5, level - 1)); // секунды
}
function buildingProduction(type, level) {
  const b = BUILDINGS[type];
  if (!b.produces) return {};
  return scaled(b.produces, b.prodGrowth, level); // в час
}
function buildingCapacity(type, level) {
  const b = BUILDINGS[type];
  if (!b.capacity) return 0;
  return Math.floor(b.capacity * Math.pow(b.capGrowth, level - 1));
}
function buildingDefense(type, level) {
  const b = BUILDINGS[type];
  if (!b.defense) return 0;
  return Math.floor(b.defense * Math.pow(b.defGrowth, level - 1));
}

const BASE_CAPACITY = 1500;

const UNITS = {
  militia: { name: 'Ополченец', atk: 4, def: 3, hp: 20, cost: { food: 20, wood: 10 }, time: 6, barracks: 1 },
  swordsman: { name: 'Мечник', atk: 9, def: 8, hp: 45, cost: { food: 30, iron: 15 }, time: 12, barracks: 2 },
  archer: { name: 'Лучник', atk: 12, def: 4, hp: 30, cost: { food: 25, wood: 30 }, time: 10, barracks: 3 },
  knight: { name: 'Рыцарь', atk: 22, def: 18, hp: 110, cost: { food: 80, iron: 50, gold: 20 }, time: 30, barracks: 5 },
  catapult: { name: 'Катапульта', atk: 45, def: 5, hp: 150, cost: { wood: 200, iron: 80, gold: 40 }, time: 60, barracks: 7 },
  scout: { name: 'Разведчик', atk: 2, def: 2, hp: 15, cost: { food: 15 }, time: 4, barracks: 1 },
};

const HERO_CLASSES = {
  knight: { name: 'Рыцарь', atk: 25, def: 25, hp: 300, growth: { atk: 4, def: 4, hp: 40 }, skill: 'Щит: +15% защиты армии' },
  archer: { name: 'Лучница', atk: 38, def: 12, hp: 220, growth: { atk: 6, def: 2, hp: 28 }, skill: 'Залп: +15% атаки армии' },
  mage: { name: 'Маг', atk: 50, def: 8, hp: 180, growth: { atk: 8, def: 1, hp: 22 }, skill: 'Огненный шар: урон по боссу x1.3' },
  rogue: { name: 'Плут', atk: 32, def: 15, hp: 240, growth: { atk: 5, def: 3, hp: 30 }, skill: 'Грабёж: +25% добычи' },
};
const HERO_NAMES = ['Олег', 'Ингрид', 'Радомир', 'Ярослава', 'Бьорн', 'Милана', 'Горан', 'Зара', 'Велимир', 'Агата', 'Сигурд', 'Ива'];
const HERO_COST = (n) => ({ gold: 200 * Math.pow(2, n) , food: 100 * (n + 1) });

function heroStats(cls, level) {
  const c = HERO_CLASSES[cls];
  return {
    atk: c.atk + c.growth.atk * (level - 1),
    def: c.def + c.growth.def * (level - 1),
    hp: c.hp + c.growth.hp * (level - 1),
  };
}
function heroXpForLevel(level) { return 100 * level * level; }

// Боссы общего мира. hp — общее, игроки бьют его вместе.
const BOSSES = {
  troll_king: { name: 'Король троллей', level: 1, atk: 60, def: 30, hp: 4000, respawn: 1800, reward: { gold: 300, iron: 100 }, xp: 150 },
  wolf_matriarch: { name: 'Волчица-матриарх', level: 2, atk: 90, def: 20, hp: 7000, respawn: 2400, reward: { gold: 500, food: 400 }, xp: 250 },
  bandit_lord: { name: 'Атаман разбойников', level: 3, atk: 130, def: 60, hp: 12000, respawn: 3600, reward: { gold: 900, wood: 500, stone: 500 }, xp: 400 },
  lich: { name: 'Лич', level: 4, atk: 220, def: 80, hp: 25000, respawn: 5400, reward: { gold: 1800, iron: 600 }, xp: 700 },
  dragon: { name: 'Древний дракон', level: 5, atk: 400, def: 150, hp: 60000, respawn: 7200, reward: { gold: 4000, iron: 1500, stone: 1500 }, xp: 1500 },
  demon_lord: { name: 'Владыка демонов', level: 6, atk: 700, def: 250, hp: 150000, respawn: 14400, reward: { gold: 10000, iron: 4000, food: 4000 }, xp: 4000 },
};

const WORLD = {
  size: 48,
  terrains: ['grass', 'dirt', 'forest', 'mountain', 'water', 'sand', 'swamp', 'snow'],
};

// Ресурсные точки мира
const NODES = {
  forest_node: { name: 'Густой лес', resource: 'wood', amount: 400, cooldown: 900 },
  stone_node: { name: 'Скалы', resource: 'stone', amount: 350, cooldown: 900 },
  iron_node: { name: 'Железная жила', resource: 'iron', amount: 200, cooldown: 1200 },
  gold_node: { name: 'Золотой прииск', resource: 'gold', amount: 150, cooldown: 1800 },
  farm_node: { name: 'Плодородные поля', resource: 'food', amount: 450, cooldown: 900 },
};

const START_RESOURCES = { food: 600, wood: 600, stone: 400, iron: 150, gold: 300 };

module.exports = {
  RESOURCES, CITY_SIZE, BUILDINGS, buildingCost, buildingTime, buildingProduction, buildingCapacity, buildingDefense,
  BASE_CAPACITY, UNITS, HERO_CLASSES, HERO_NAMES, HERO_COST, heroStats, heroXpForLevel, BOSSES, WORLD, NODES, START_RESOURCES,
};
