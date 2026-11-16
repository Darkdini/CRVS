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
    name: 'Кузница', desc: 'Усиливает атаку героев и войск, позволяет продавать трофеи дороже.',
    maxLevel: 10, base: { wood: 80, stone: 80, iron: 60 }, growth: 1.75, time: 20,
    atkBonus: 0.03,
  },
  academy: {
    name: 'Академия', desc: 'Исследования: экономика, война, логистика, медицина.',
    maxLevel: 10, base: { wood: 200, stone: 150, gold: 100 }, growth: 1.8, time: 30,
  },
  hospital: {
    name: 'Госпиталь', desc: 'Раненые в бою воины попадают сюда вместо гибели. Уровень = вместимость.',
    maxLevel: 10, base: { wood: 120, stone: 100, food: 100 }, growth: 1.7, time: 20,
    beds: 40, bedsGrowth: 1.45,
  },
  house: {
    name: 'Дома', desc: 'Жители платят налоги золотом и ускоряют обучение.',
    maxLevel: 10, base: { wood: 60, stone: 30 }, growth: 1.6, time: 10,
    produces: { gold: 8 }, prodGrowth: 1.45,
  },
  embassy: {
    name: 'Посольство', desc: 'Нужно для вступления в альянс. Уровень даёт бонус к защите от союзников.',
    maxLevel: 5, base: { wood: 150, stone: 150, gold: 150 }, growth: 1.9, time: 30,
    defense: 20, defGrowth: 1.5,
  },
};
function buildingBeds(type, level) {
  const b = BUILDINGS[type];
  if (!b.beds || level < 1) return 0;
  return Math.floor(b.beds * Math.pow(b.bedsGrowth, level - 1));
}

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

// speed — клеток в минуту, carry — сколько ресурсов уносит один воин
const UNITS = {
  militia: { name: 'Ополченец', atk: 4, def: 3, hp: 20, cost: { food: 20, wood: 10 }, time: 6, barracks: 1, speed: 10, carry: 25 },
  swordsman: { name: 'Мечник', atk: 9, def: 8, hp: 45, cost: { food: 30, iron: 15 }, time: 12, barracks: 2, speed: 8, carry: 20 },
  archer: { name: 'Лучник', atk: 12, def: 4, hp: 30, cost: { food: 25, wood: 30 }, time: 10, barracks: 3, speed: 9, carry: 15 },
  knight: { name: 'Рыцарь', atk: 22, def: 18, hp: 110, cost: { food: 80, iron: 50, gold: 20 }, time: 30, barracks: 5, speed: 16, carry: 40 },
  catapult: { name: 'Катапульта', atk: 45, def: 5, hp: 150, cost: { wood: 200, iron: 80, gold: 40 }, time: 60, barracks: 7, speed: 4, carry: 10 },
  scout: { name: 'Разведчик', atk: 2, def: 2, hp: 15, cost: { food: 15 }, time: 4, barracks: 1, speed: 24, carry: 8 },
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

// Монстры общего мира: 16 видов, уровень 1–20. Статы считаются от уровня.
const MONSTERS = {
  wolf: { name: 'Волк', minLvl: 1 }, boar: { name: 'Кабан', minLvl: 1 }, goblin: { name: 'Гоблин', minLvl: 2 }, bandit: { name: 'Разбойник', minLvl: 3 },
  skeleton: { name: 'Скелет', minLvl: 4 }, spider: { name: 'Гигантский паук', minLvl: 5 }, orc: { name: 'Орк', minLvl: 6 }, ogre: { name: 'Огр', minLvl: 7 },
  harpy: { name: 'Гарпия', minLvl: 8 }, wraith: { name: 'Призрак', minLvl: 9 }, troll: { name: 'Тролль', minLvl: 10 }, minotaur: { name: 'Минотавр', minLvl: 12 },
  dark_knight: { name: 'Тёмный рыцарь', minLvl: 14 }, hydra: { name: 'Гидра', minLvl: 16 }, golem: { name: 'Каменный голем', minLvl: 18 }, demon: { name: 'Демон', minLvl: 20 },
};
function monsterStats(level) {
  return {
    atk: Math.floor(14 * Math.pow(level, 1.35)), def: Math.floor(6 * Math.pow(level, 1.2)), hp: Math.floor(180 * Math.pow(level, 1.5)),
    xp: 30 * level, respawn: 300 + level * 60,
    loot: { food: 40 * level, wood: 40 * level, stone: 30 * level, iron: 15 * level, gold: 10 * level },
    itemChance: Math.min(0.6, 0.15 + level * 0.02),
  };
}

// Экипировка героев
const ITEM_SLOTS = ['weapon', 'armor', 'helmet', 'boots', 'ring', 'amulet'];
const ITEM_BASES = {
  weapon: { name: 'Меч', names: ['Ржавый клинок', 'Стальной меч', 'Рунный меч', 'Клинок Королей'], stat: 'atk', base: 6 },
  armor: { name: 'Доспех', names: ['Кожаный доспех', 'Кольчуга', 'Латы', 'Доспех Дракона'], stat: 'def', base: 6 },
  helmet: { name: 'Шлем', names: ['Кожаный шлем', 'Стальной шлем', 'Рогатый шлем', 'Корона Войны'], stat: 'def', base: 4 },
  boots: { name: 'Сапоги', names: ['Стоптанные сапоги', 'Сапоги странника', 'Сапоги ветра', 'Сапоги Бури'], stat: 'hp', base: 30 },
  ring: { name: 'Кольцо', names: ['Медное кольцо', 'Серебряное кольцо', 'Кольцо ярости', 'Перстень Владыки'], stat: 'atk', base: 5 },
  amulet: { name: 'Амулет', names: ['Костяной амулет', 'Амулет жизни', 'Амулет феникса', 'Сердце Горы'], stat: 'hp', base: 40 },
};
const RARITIES = [
  { key: 'common', name: 'Обычный', mult: 1, color: '#bbb', chance: 0.6 },
  { key: 'rare', name: 'Редкий', mult: 1.6, color: '#4aa3ff', chance: 0.28 },
  { key: 'epic', name: 'Эпический', mult: 2.5, color: '#b05cff', chance: 0.1 },
  { key: 'legendary', name: 'Легендарный', mult: 4, color: '#ffb347', chance: 0.02 },
];
function rollItem(level, rand = Math.random) {
  const slot = ITEM_SLOTS[Math.floor(rand() * ITEM_SLOTS.length)];
  const tier = Math.min(3, Math.floor((level - 1) / 5)); // 0..3
  let r = rand(), rarity = RARITIES[0];
  for (const rr of RARITIES) { if (r < rr.chance) { rarity = rr; break; } r -= rr.chance; }
  const base = ITEM_BASES[slot];
  const value = Math.floor(base.base * (1 + tier) * rarity.mult * (0.9 + rand() * 0.2) * (1 + level * 0.05));
  return { slot, tier, rarity: rarity.key, name: base.names[tier], stat: base.stat, value };
}
function itemSellPrice(item) {
  const r = RARITIES.find(x => x.key === item.rarity);
  return Math.floor(20 * (1 + item.tier) * r.mult);
}

// Исследования в академии
const TECHS = {
  economy: { name: 'Экономика', desc: '+6% к производству за уровень', max: 10, base: { wood: 200, stone: 200, gold: 50 }, growth: 1.7, time: 60, effect: 0.06 },
  military: { name: 'Военное дело', desc: '+5% к атаке за уровень', max: 10, base: { iron: 150, gold: 80 }, growth: 1.75, time: 90, effect: 0.05 },
  defense: { name: 'Фортификация', desc: '+5% к защите за уровень', max: 10, base: { stone: 300, iron: 50 }, growth: 1.75, time: 90, effect: 0.05 },
  logistics: { name: 'Логистика', desc: '+10% к скорости походов и +10% к грузу', max: 10, base: { food: 200, wood: 200 }, growth: 1.7, time: 75, effect: 0.10 },
  medicine: { name: 'Медицина', desc: '+10% раненых вместо погибших', max: 5, base: { food: 300, gold: 100 }, growth: 1.8, time: 120, effect: 0.10 },
};
function techCost(key, level) { return scaled(TECHS[key].base, TECHS[key].growth, level); }
function techTime(key, level) { return Math.floor(TECHS[key].time * Math.pow(1.6, level - 1)); }

// Цепочка заданий. check(ctx) — ctx: {buildings, units, heroes, kills, bossKills, gathers, techs, items}
const QUESTS = [
  { id: 'q_quarry', title: 'Построй каменоломню', desc: 'Камень нужен для стен и ратуши.', reward: { stone: 200, wood: 100 }, check: c => c.count('quarry') >= 1 },
  { id: 'q_mine', title: 'Построй рудник', desc: 'Железо — для мечей и доспехов.', reward: { iron: 100, gold: 50 }, check: c => c.count('mine') >= 1 },
  { id: 'q_th2', title: 'Ратуша 2 уровня', desc: 'Откроет больше зданий.', reward: { wood: 300, stone: 300 }, check: c => c.level('townhall') >= 2 },
  { id: 'q_barracks', title: 'Построй казармы', desc: 'Пора собирать армию.', reward: { food: 300, iron: 50 }, check: c => c.count('barracks') >= 1 },
  { id: 'q_militia', title: 'Собери 30 ополченцев', desc: 'Первые защитники города.', reward: { gold: 100, food: 200 }, check: c => c.unitsTotal() >= 30 },
  { id: 'q_monster', title: 'Убей любого монстра', desc: 'Отправь поход на монстра рядом с городом.', reward: { gold: 150, xpItem: true }, check: c => c.kills >= 1 },
  { id: 'q_tavern', title: 'Построй таверну', desc: 'Там ждут герои.', reward: { gold: 300 }, check: c => c.count('tavern') >= 1 },
  { id: 'q_hero', title: 'Найми героя', desc: 'Герой ведёт армию и получает экипировку.', reward: { gold: 200, food: 300 }, check: c => c.heroes >= 1 },
  { id: 'q_gather', title: 'Собери ресурсы на карте', desc: 'Походы за ресурсами — главный источник дохода.', reward: { wood: 400, stone: 400 }, check: c => c.gathers >= 1 },
  { id: 'q_warehouse', title: 'Построй склад', desc: 'Чтобы ресурсы не пропадали.', reward: { gold: 150 }, check: c => c.count('warehouse') >= 1 },
  { id: 'q_kills5', title: 'Убей 5 монстров', desc: 'Монстры роняют экипировку.', reward: { gold: 400, iron: 200 }, check: c => c.kills >= 5 },
  { id: 'q_wall', title: 'Построй стену', desc: 'Соседи не дремлют.', reward: { stone: 500 }, check: c => c.count('wall') >= 1 },
  { id: 'q_academy', title: 'Построй академию', desc: 'Исследования усилят всё.', reward: { gold: 300, wood: 300 }, check: c => c.count('academy') >= 1 },
  { id: 'q_tech', title: 'Заверши исследование', desc: 'Любое.', reward: { gold: 300 }, check: c => c.techLevels >= 1 },
  { id: 'q_item', title: 'Надень предмет на героя', desc: 'Экипировка в панели героя.', reward: { gold: 200 }, check: c => c.equipped >= 1 },
  { id: 'q_hospital', title: 'Построй госпиталь', desc: 'Раненые вернутся в строй.', reward: { food: 500, gold: 150 }, check: c => c.count('hospital') >= 1 },
  { id: 'q_th4', title: 'Ратуша 4 уровня', desc: 'Крупный город.', reward: { gold: 800, iron: 300 }, check: c => c.level('townhall') >= 4 },
  { id: 'q_embassy', title: 'Построй посольство и вступи в альянс', desc: 'Вместе бить боссов проще.', reward: { gold: 500 }, check: c => c.alliance },
  { id: 'q_kills25', title: 'Убей 25 монстров', desc: 'Охотник.', reward: { gold: 1500, iron: 800 }, check: c => c.kills >= 25 },
  { id: 'q_boss', title: 'Участвуй в убийстве босса', desc: 'Награда делится по урону.', reward: { gold: 2000 }, check: c => c.bossKills >= 1 },
  { id: 'q_knights', title: 'Обучи 10 рыцарей', desc: 'Тяжёлая кавалерия.', reward: { gold: 1500, food: 2000 }, check: c => (c.units.knight || 0) >= 10 },
  { id: 'q_th6', title: 'Ратуша 6 уровня', desc: 'Столица.', reward: { gold: 3000, stone: 2000, wood: 2000 }, check: c => c.level('townhall') >= 6 },
];

const ALLIANCE_COST = { gold: 500 };

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
  RESOURCES, CITY_SIZE, BUILDINGS, buildingCost, buildingTime, buildingProduction, buildingCapacity, buildingDefense, buildingBeds,
  BASE_CAPACITY, UNITS, HERO_CLASSES, HERO_NAMES, HERO_COST, heroStats, heroXpForLevel, BOSSES, WORLD, NODES, START_RESOURCES,
  MONSTERS, monsterStats, ITEM_SLOTS, ITEM_BASES, RARITIES, rollItem, itemSellPrice, TECHS, techCost, techTime, QUESTS, ALLIANCE_COST,
};
