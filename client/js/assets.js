// Загрузка спрайт-листов по atlas.json. Если PNG нет — рисуем процедурную заглушку (placeholders.js).
import * as P from './placeholders.js';
export const Assets = {
  atlas: null,
  sheets: {},     // name -> {img, def, loaded}
  placeholders: {}, // "sheet/frame" -> canvas

  async load() {
    this.atlas = await (await fetch('assets/atlas.json')).json();
    const jobs = [];
    for (const name of Object.keys(this.atlas)) {
      if (name.startsWith('_')) continue;
      const def = this.atlas[name];
      const img = new Image();
      const entry = { img, def, loaded: false };
      this.sheets[name] = entry;
      jobs.push(new Promise(resolve => {
        img.onload = () => { entry.loaded = true; resolve(); };
        img.onerror = () => resolve();
        img.src = 'assets/' + def.file;
      }));
    }
    await Promise.all(jobs);
  },

  has(sheet) { return !!this.sheets[sheet]; },

  // Нарисовать кадр так, чтобы он занял прямоугольник w×h, опорная точка (x,y) зависит от anchor
  draw(ctx, sheet, frame, x, y, w, h) {
    const s = this.sheets[sheet];
    if (!s) return;
    const idx = s.def.frames.indexOf(frame);
    if (idx < 0) return;
    let dx = x - w / 2, dy;
    if (s.def.anchor === 'bottom') dy = y - h;
    else if (s.def.anchor === 'center') dy = y - h / 2;
    else dy = y - h / 2; // tile
    if (s.loaded) {
      // размер ячейки берём из реального размера картинки — лист может быть любого разрешения
      const cw = s.img.width / s.def.cols, ch = s.img.height / s.def.rows;
      const sx = (idx % s.def.cols) * cw, sy = Math.floor(idx / s.def.cols) * ch;
      ctx.drawImage(s.img, sx, sy, cw, ch, dx, dy, w, h);
    } else {
      ctx.drawImage(this.placeholder(sheet, frame), dx, dy, w, h);
    }
  },

  placeholder(sheet, frame) {
    const key = sheet + '/' + frame;
    if (this.placeholders[key]) return this.placeholders[key];
    const size = (sheet === 'heroes' || sheet === 'bosses') ? 384 : 256;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    const fn = { terrain: P.terrain, buildings: P.building, world: P.world, misc: P.misc, units: P.unit, heroes: P.hero, monsters: P.monster, bosses: P.boss, items: P.item, icons: P.icon }[sheet];
    if (fn) fn(ctx, frame, size); else PLACEHOLDER.generic(ctx, frame, size);
    this.placeholders[key] = cv;
    return cv;
  },
};

const COLORS = {
  grass: '#5d9b45', dirt: '#9c7a4a', forest: '#2f6b32', mountain: '#7d7f86', water: '#3b78b5', sand: '#d9c878', swamp: '#5c6b3a', snow: '#e8eef5',
  townhall: '#b8862b', farm: '#c9a24a', sawmill: '#8b5a2b', quarry: '#8d8d8d', mine: '#5c5f66', warehouse: '#a0683a', barracks: '#9a3b3b',
  tavern: '#b06a2a', wall: '#8a8a8a', tower: '#6f6f78', market: '#c76f3a', blacksmith: '#4a4a4a', academy: '#4a6fa5', hospital: '#c9d6e8', house: '#b89a6a', embassy: '#7a5aa0',
  wolf: '#6a6a7a', boar: '#6a4a3a', goblin: '#5a8a3a', bandit: '#7a4a2a', skeleton: '#d8d8c8', spider: '#3a3a3a', orc: '#4a7a3a', ogre: '#8a7a5a', harpy: '#a07a9a', wraith: '#7a9aba', troll: '#5f7f3a', minotaur: '#8a5a3a', dark_knight: '#3a3a4a', hydra: '#3a7a6a', golem: '#8a8a7a', demon: '#8a2a2a',
  road: '#a08a6a', river: '#3b78b5', flag: '#c03030', camp: '#c08a3c',
  city_player: '#e0b84a', city_other: '#b44c4c', boss_lair: '#6a2a7a', forest_node: '#2f6b32', stone_node: '#9a9a9a', iron_node: '#5a6a80', gold_node: '#e3c04b', farm_node: '#c9a24a',
  construction: '#c08a3c', tree: '#2f6b32', rock: '#8d8d8d', bush: '#4b8a3b',
  militia: '#8c7a5a', swordsman: '#6d7b8f', archer: '#4f8a4f', knight: '#c0c0c0', catapult: '#7a5a3a', scout: '#8a9a5a',
  mage: '#5a4fa0', rogue: '#4a4a4a',
  troll_king: '#5f7f3a', wolf_matriarch: '#6a6a7a', bandit_lord: '#7a3a2a', lich: '#3a6a7a', dragon: '#a03030', demon_lord: '#5a1a4a',
  food: '#d84f3a', wood: '#8b5a2b', stone: '#9a9a9a', iron: '#6a7a90', gold: '#e3c04b', power: '#c04040', time: '#4a80c0', xp: '#8a4ac0',
};
const LABELS = {
  grass: 'трава', dirt: 'земля', forest: 'лес', mountain: 'горы', water: 'вода', sand: 'песок', swamp: 'болото', snow: 'снег',
  townhall: 'Ратуша', farm: 'Ферма', sawmill: 'Лесопилка', quarry: 'Каменол.', mine: 'Рудник', warehouse: 'Склад', barracks: 'Казармы',
  tavern: 'Таверна', wall: 'Стена', tower: 'Башня', market: 'Рынок', blacksmith: 'Кузница', academy: 'Академия', hospital: 'Госпиталь', house: 'Дома', embassy: 'Посольство',
  wolf: 'Волк', boar: 'Кабан', goblin: 'Гоблин', bandit: 'Разбойник', skeleton: 'Скелет', spider: 'Паук', orc: 'Орк', ogre: 'Огр', harpy: 'Гарпия', wraith: 'Призрак', troll: 'Тролль', minotaur: 'Минотавр', dark_knight: 'Т.рыцарь', hydra: 'Гидра', golem: 'Голем', demon: 'Демон',
  city_player: 'Мой город', city_other: 'Город', boss_lair: 'Логово', forest_node: 'Лес', stone_node: 'Скалы', iron_node: 'Железо', gold_node: 'Золото', farm_node: 'Поля',
  construction: 'Стройка', tree: '', rock: '', bush: '',
  weapon: 'Оружие', armor: 'Броня', helmet: 'Шлем', boots: 'Сапоги', ring: 'Кольцо', amulet: 'Амулет',
  militia: 'Ополч.', swordsman: 'Мечник', archer: 'Лучник', knight: 'Рыцарь', catapult: 'Катап.', scout: 'Развед.', mage: 'Маг', rogue: 'Плут',
  troll_king: 'Тролль', wolf_matriarch: 'Волчица', bandit_lord: 'Атаман', lich: 'Лич', dragon: 'Дракон', demon_lord: 'Демон',
  food: 'Е', wood: 'Д', stone: 'К', iron: 'Ж', gold: 'З', power: '⚔', time: '⏱', xp: '★',
};

function label(ctx, text, x, y, size) {
  if (!text) return;
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = size / 5; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff'; ctx.fillText(text, x, y);
}
function diamond(ctx, cx, cy, w, h) {
  ctx.beginPath(); ctx.moveTo(cx, cy - h / 2); ctx.lineTo(cx + w / 2, cy); ctx.lineTo(cx, cy + h / 2); ctx.lineTo(cx - w / 2, cy); ctx.closePath();
}

const PLACEHOLDER = {
  terrain(ctx, frame, s) {
    ctx.fillStyle = COLORS[frame] || '#888';
    diamond(ctx, s / 2, s / 2, s, s / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.stroke();
    // немного текстуры
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 12; i++) { const a = (i * 37) % 100, b = (i * 53) % 100; ctx.beginPath(); ctx.arc(s * .3 + a * s / 250, s * .35 + b * s / 350, 3, 0, 7); ctx.fill(); }
  },
  buildings(ctx, frame, s) { block(ctx, frame, s, COLORS[frame]); },
  world(ctx, frame, s) {
    if (frame.endsWith('_node')) { ctx.fillStyle = COLORS[frame]; ctx.beginPath(); ctx.arc(s / 2, s * .68, s * .22, 0, 7); ctx.fill(); label(ctx, LABELS[frame], s / 2, s * .68, 30); }
    else block(ctx, frame, s, COLORS[frame]);
  },
  misc(ctx, frame, s) {
    if (frame === 'construction') { ctx.strokeStyle = '#d9b26a'; ctx.lineWidth = 8; ctx.strokeRect(s * .25, s * .35, s * .5, s * .45); ctx.beginPath(); ctx.moveTo(s * .25, s * .35); ctx.lineTo(s * .75, s * .8); ctx.moveTo(s * .75, s * .35); ctx.lineTo(s * .25, s * .8); ctx.stroke(); label(ctx, 'Стройка', s / 2, s * .9, 30); }
    else if (frame === 'road') { ctx.fillStyle = COLORS.road; diamond(ctx, s / 2, s * .75, s * .9, s * .45); ctx.fill(); }
    else if (frame === 'river') { ctx.fillStyle = COLORS.river; diamond(ctx, s / 2, s * .75, s * .9, s * .45); ctx.fill(); }
    else if (frame === 'flag') { ctx.fillStyle = '#5a3a1a'; ctx.fillRect(s * .48, s * .3, s * .04, s * .55); ctx.fillStyle = COLORS.flag; ctx.beginPath(); ctx.moveTo(s * .52, s * .3); ctx.lineTo(s * .75, s * .4); ctx.lineTo(s * .52, s * .5); ctx.fill(); }
    else if (frame === 'camp') { ctx.fillStyle = '#d8c8a8'; ctx.beginPath(); ctx.moveTo(s / 2, s * .35); ctx.lineTo(s * .75, s * .8); ctx.lineTo(s * .25, s * .8); ctx.fill(); ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(s * .8, s * .78, s * .06, 0, 7); ctx.fill(); }
    else if (frame === 'tree') { ctx.fillStyle = '#5a3a1a'; ctx.fillRect(s * .47, s * .6, s * .06, s * .25); ctx.fillStyle = COLORS.tree; ctx.beginPath(); ctx.moveTo(s / 2, s * .2); ctx.lineTo(s * .7, s * .65); ctx.lineTo(s * .3, s * .65); ctx.fill(); }
    else { ctx.fillStyle = COLORS[frame]; ctx.beginPath(); ctx.ellipse(s / 2, s * .75, s * .18, s * .12, 0, 0, 7); ctx.fill(); }
  },
  units(ctx, frame, s) { figure(ctx, frame, s, COLORS[frame]); },
  heroes(ctx, frame, s) { figure(ctx, frame, s, COLORS[frame], true); },
  monsters(ctx, frame, s) {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(s / 2, s * .9, s * .25, s * .08, 0, 0, 7); ctx.fill();
    ctx.fillStyle = COLORS[frame] || '#777'; ctx.beginPath(); ctx.arc(s / 2, s * .55, s * .28, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff5'; ctx.beginPath(); ctx.arc(s * .42, s * .5, 9, 0, 7); ctx.arc(s * .58, s * .5, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s / 2, s * .55, s * .28, 0, 7); ctx.stroke();
    label(ctx, LABELS[frame] || frame, s / 2, s * .95, 26);
  },
  items(ctx, frame, s) {
    const [slot, tier] = frame.split('_');
    const col = ['#9a9a9a', '#4aa3ff', '#b05cff', '#ffb347'][+tier] || '#999';
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(s * .1, s * .1, s * .8, s * .8);
    ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.strokeRect(s * .1, s * .1, s * .8, s * .8);
    ctx.fillStyle = col; ctx.beginPath();
    if (slot === 'weapon') { ctx.moveTo(s * .3, s * .7); ctx.lineTo(s * .7, s * .3); ctx.lineTo(s * .75, s * .35); ctx.lineTo(s * .35, s * .75); }
    else if (slot === 'armor') { ctx.moveTo(s * .3, s * .3); ctx.lineTo(s * .7, s * .3); ctx.lineTo(s * .65, s * .75); ctx.lineTo(s * .35, s * .75); }
    else if (slot === 'helmet') { ctx.arc(s / 2, s * .5, s * .22, Math.PI, 0); ctx.lineTo(s * .72, s * .65); ctx.lineTo(s * .28, s * .65); }
    else if (slot === 'boots') { ctx.moveTo(s * .35, s * .3); ctx.lineTo(s * .55, s * .3); ctx.lineTo(s * .55, s * .6); ctx.lineTo(s * .72, s * .7); ctx.lineTo(s * .35, s * .72); }
    else if (slot === 'ring') { ctx.arc(s / 2, s / 2, s * .2, 0, 7); ctx.moveTo(s / 2 + s * .1, s / 2); ctx.arc(s / 2, s / 2, s * .1, 0, 7, true); }
    else { ctx.arc(s / 2, s * .55, s * .14, 0, 7); ctx.moveTo(s * .35, s * .35); ctx.lineTo(s * .5, s * .25); ctx.lineTo(s * .65, s * .35); }
    ctx.fill('evenodd');
    label(ctx, LABELS[slot] || slot, s / 2, s * .88, 22);
  },
  bosses(ctx, frame, s) {
    ctx.fillStyle = COLORS[frame]; ctx.beginPath(); ctx.arc(s / 2, s * .5, s * .38, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff4'; ctx.beginPath(); ctx.arc(s * .4, s * .42, 12, 0, 7); ctx.arc(s * .6, s * .42, 12, 0, 7); ctx.fill();
    label(ctx, LABELS[frame], s / 2, s * .85, 34);
  },
  icons(ctx, frame, s) {
    ctx.fillStyle = COLORS[frame]; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * .42, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 8; ctx.stroke();
    label(ctx, LABELS[frame], s / 2, s / 2, 110);
  },
  generic(ctx, frame, s) { ctx.fillStyle = '#a0a'; ctx.fillRect(0, 0, s, s); label(ctx, frame, s / 2, s / 2, 24); },
};
function block(ctx, frame, s, color) {
  // изометрический кубик на основании-ромбе
  const w = s * .8, hgt = s * .36, cx = s / 2, baseY = s * .78;
  ctx.fillStyle = shade(color, -30); diamond(ctx, cx, baseY, w, w / 2); ctx.fill();
  const top = baseY - hgt;
  ctx.fillStyle = shade(color, -20); ctx.beginPath(); ctx.moveTo(cx - w / 2, baseY); ctx.lineTo(cx, baseY + w / 4); ctx.lineTo(cx, top + w / 4); ctx.lineTo(cx - w / 2, top); ctx.fill();
  ctx.fillStyle = shade(color, -45); ctx.beginPath(); ctx.moveTo(cx + w / 2, baseY); ctx.lineTo(cx, baseY + w / 4); ctx.lineTo(cx, top + w / 4); ctx.lineTo(cx + w / 2, top); ctx.fill();
  ctx.fillStyle = color; diamond(ctx, cx, top, w, w / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3; ctx.stroke();
  label(ctx, LABELS[frame] || frame, cx, top, 30);
}
function figure(ctx, frame, s, color, hero) {
  const cx = s / 2;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, s * .9, s * .2, s * .07, 0, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(cx - s * .12, s * .4, s * .24, s * .45);
  ctx.fillStyle = '#e8c39e'; ctx.beginPath(); ctx.arc(cx, s * .3, s * .11, 0, 7); ctx.fill();
  if (hero) { ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(cx - s * .12, s * .2); ctx.lineTo(cx + s * .12, s * .2); ctx.lineTo(cx + s * .1, s * .1); ctx.lineTo(cx, s * .16); ctx.lineTo(cx - s * .1, s * .1); ctx.fill(); }
  label(ctx, LABELS[frame] || frame, cx, s * .95, 26);
}
function shade(hex, d) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + d));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return `rgb(${r},${g},${b})`;
}
export { COLORS, LABELS };
