// Процедурная графика-заглушка: рисуется, пока нет PNG-листов. Выглядит как настоящие изометрические спрайты.
const C = {
  grass: ['#6aa84f', '#4f8a3a'], dirt: ['#a8865a', '#8a6a44'], forest: ['#3d7a3a', '#2a5a2a'], mountain: ['#8a8c92', '#5f6168'], water: ['#3f86c8', '#2a5f9a'], sand: ['#e2cf86', '#c9b36a'], swamp: ['#6a7a3a', '#4a5a2a'], snow: ['#eef2f8', '#c8d2e0'],
};
const ROOF = { townhall: '#8a2a2a', farm: '#c9a24a', sawmill: '#6a4a2a', quarry: '#7a7a7a', mine: '#5a5a66', warehouse: '#7a5a3a', barracks: '#8a2a2a', tavern: '#a0602a', wall: '#7a7a7a', tower: '#6a6a74', market: '#c04a3a', blacksmith: '#3a3a3a', academy: '#2c5d9b', hospital: '#b03030', house: '#a0602a', embassy: '#6a3aa0' };
const WALL = { townhall: '#d8c8a8', farm: '#c8a070', sawmill: '#9a6a3a', quarry: '#a8a8a8', mine: '#8a8a8a', warehouse: '#b08a5a', barracks: '#9a9aa0', tavern: '#c8a070', wall: '#9a9a9a', tower: '#8a8a90', market: '#d8c8a8', blacksmith: '#6a6a6a', academy: '#e0d8c8', hospital: '#f0ece0', house: '#d8c8a8', embassy: '#e8e0d0' };
const MON = { wolf: '#8a8a9a', boar: '#6a4a3a', goblin: '#6a9a3a', bandit: '#7a4a2a', skeleton: '#e0e0d0', spider: '#2a2a2a', orc: '#4a7a3a', ogre: '#9a8a6a', harpy: '#b08ab0', wraith: '#8ab0d0', troll: '#5f7f3a', minotaur: '#8a5a3a', dark_knight: '#3a3a4a', hydra: '#3a8a6a', golem: '#8a8a7a', demon: '#a02a2a' };
const BOSS = { troll_king: '#5f7f3a', wolf_matriarch: '#6a6a7a', bandit_lord: '#7a3a2a', lich: '#3a6a7a', dragon: '#b03030', demon_lord: '#5a1a4a' };
const UNIT = { militia: '#8c7a5a', swordsman: '#6d7b8f', archer: '#4f8a4f', knight: '#c0c0cc', catapult: '#7a5a3a', scout: '#8a9a5a', mage: '#5a4fa0', rogue: '#3a3a3a' };

function shade(hex, d) { const n = parseInt(hex.slice(1), 16); const c = v => Math.max(0, Math.min(255, v + d)); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; }
function diamond(ctx, cx, cy, w, h) { ctx.beginPath(); ctx.moveTo(cx, cy - h / 2); ctx.lineTo(cx + w / 2, cy); ctx.lineTo(cx, cy + h / 2); ctx.lineTo(cx - w / 2, cy); ctx.closePath(); }
function rnd(seed) { let a = seed * 9301 + 49297; return () => (a = (a * 9301 + 49297) % 233280) / 233280; }

// ---------- местность ----------
export function terrain(ctx, frame, s) {
  const [a, b] = C[frame] || ['#888', '#666'];
  const g = ctx.createLinearGradient(0, s * .25, 0, s * .75); g.addColorStop(0, a); g.addColorStop(1, b);
  diamond(ctx, s / 2, s / 2, s, s / 2); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const r = rnd(frame.length * 17);
  if (frame === 'grass' || frame === 'forest' || frame === 'swamp') {
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const x = s * .1 + r() * s * .8, y = s * .3 + r() * s * .4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 7); ctx.stroke(); }
    if (frame === 'forest') for (let i = 0; i < 7; i++) { const x = s * .2 + r() * s * .6, y = s * .3 + r() * s * .35; const rr = s * .07 + r() * s * .05; ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 4, rr, rr * .6, 0, 0, 7); ctx.fill(); ctx.fillStyle = shade('#3d7a3a', 20 - i * 6); ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); }
    if (frame === 'swamp') for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(40,70,60,.5)'; ctx.beginPath(); ctx.ellipse(s * .25 + r() * s * .5, s * .35 + r() * s * .3, s * .08, s * .04, 0, 0, 7); ctx.fill(); }
  } else if (frame === 'water') {
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const x = s * .15 + r() * s * .7, y = s * .3 + r() * s * .4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - 4, x + 22, y); ctx.stroke(); }
  } else if (frame === 'mountain') {
    for (let i = 0; i < 4; i++) { const x = s * .2 + r() * s * .6, y = s * .35 + r() * s * .3, w = s * .18; ctx.fillStyle = shade('#8a8c92', -30); ctx.beginPath(); ctx.moveTo(x - w, y + w * .4); ctx.lineTo(x, y - w * .6); ctx.lineTo(x + w, y + w * .4); ctx.fill(); ctx.fillStyle = shade('#8a8c92', 25); ctx.beginPath(); ctx.moveTo(x, y - w * .6); ctx.lineTo(x + w, y + w * .4); ctx.lineTo(x + w * .3, y + w * .4); ctx.fill(); ctx.fillStyle = '#eef2f8'; ctx.beginPath(); ctx.moveTo(x, y - w * .6); ctx.lineTo(x + w * .25, y - w * .3); ctx.lineTo(x - w * .25, y - w * .3); ctx.fill(); }
  } else if (frame === 'dirt' || frame === 'sand') {
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc(s * .1 + r() * s * .8, s * .3 + r() * s * .4, 2 + r() * 2, 0, 7); ctx.fill(); }
  } else if (frame === 'snow') {
    ctx.fillStyle = 'rgba(120,150,200,.25)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(s * .2 + r() * s * .6, s * .35 + r() * s * .3, s * .1, s * .04, 0, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.5; diamond(ctx, s / 2, s / 2, s, s / 2); ctx.stroke();
}

// ---------- здания ----------
function box(ctx, cx, baseY, w, h, color, roof) {
  // стены
  ctx.fillStyle = shade(color, -10); ctx.beginPath(); ctx.moveTo(cx - w / 2, baseY); ctx.lineTo(cx, baseY + w / 4); ctx.lineTo(cx, baseY + w / 4 - h); ctx.lineTo(cx - w / 2, baseY - h); ctx.fill();
  ctx.fillStyle = shade(color, -45); ctx.beginPath(); ctx.moveTo(cx + w / 2, baseY); ctx.lineTo(cx, baseY + w / 4); ctx.lineTo(cx, baseY + w / 4 - h); ctx.lineTo(cx + w / 2, baseY - h); ctx.fill();
  // брёвна/кладка
  ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1.5;
  for (let y = 10; y < h; y += 14) { ctx.beginPath(); ctx.moveTo(cx - w / 2, baseY - h + y); ctx.lineTo(cx, baseY - h + y + w / 4); ctx.lineTo(cx + w / 2, baseY - h + y); ctx.stroke(); }
  if (roof) {
    // двускатная крыша
    const top = baseY - h, rh = w * .38;
    ctx.fillStyle = shade(roof, 15); ctx.beginPath(); ctx.moveTo(cx - w / 2 - 6, top + 3); ctx.lineTo(cx, top + w / 4 + 3); ctx.lineTo(cx - w / 4, top - rh / 2 + w / 8); ctx.lineTo(cx - w / 4, top - rh / 2 + w / 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(cx - w / 2 - 6, top + 3); ctx.lineTo(cx - w / 4, top - rh + w / 8 + 6); ctx.lineTo(cx + w / 4, top - rh - w / 8 + 6 + w / 4); ctx.lineTo(cx, top + w / 4 + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(roof, -40); ctx.beginPath(); ctx.moveTo(cx + w / 2 + 6, top + 3); ctx.lineTo(cx + w / 4, top - rh - w / 8 + 6 + w / 4); ctx.lineTo(cx + w / 4, top - rh / 2); ctx.lineTo(cx + w / 2 + 6, top - w / 4 + 3); ctx.closePath(); ctx.fill();
    // черепица
    ctx.strokeStyle = 'rgba(0,0,0,.15)';
    for (let i = 1; i < 5; i++) { const t = i / 5; ctx.beginPath(); ctx.moveTo(cx - w / 2 - 6 + (cx - w / 4 - (cx - w / 2 - 6)) * t, top + 3 + (top - rh + w / 8 + 6 - top - 3) * t); ctx.lineTo(cx + (cx + w / 4 - cx) * t, top + w / 4 + 3 + (top - rh - w / 8 + 6 + w / 4 - top - w / 4 - 3) * t); ctx.stroke(); }
  }
}
function windows(ctx, cx, baseY, w, h, n = 2) {
  ctx.fillStyle = '#ffd98a';
  for (let i = 0; i < n; i++) { const t = (i + 1) / (n + 1); const x = cx - w / 2 + (w / 2) * t, y = baseY - h / 2 + (w / 4) * t; ctx.fillRect(x - 4, y - 8, 8, 10); }
  ctx.fillStyle = '#4a2a10'; ctx.fillRect(cx + w * .18 - 6, baseY - h * .45 + w * .09, 12, h * .45);
}
export function building(ctx, frame, s) {
  const cx = s / 2, baseY = s * .78, w = s * .72;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; diamond(ctx, cx, baseY + 2, s * .95, s * .48); ctx.fill();
  const ground = frame === 'farm' ? '#b89a4a' : frame === 'quarry' || frame === 'mine' ? '#8a8a8a' : '#6aa84f';
  ctx.fillStyle = ground; diamond(ctx, cx, baseY, s * .9, s * .45); ctx.fill();
  const wall = WALL[frame] || '#c8a070', roof = ROOF[frame] || '#8a4a2a';
  switch (frame) {
    case 'townhall': box(ctx, cx, baseY, w, s * .34, wall, roof); windows(ctx, cx, baseY, w, s * .34, 3); box(ctx, cx + w * .05, baseY - s * .3, w * .3, s * .22, wall, roof); flag(ctx, cx + w * .05, baseY - s * .62, '#2c5d9b'); break;
    case 'farm': box(ctx, cx - w * .15, baseY, w * .55, s * .2, wall, roof); windows(ctx, cx - w * .15, baseY, w * .55, s * .2, 1); windmill(ctx, cx + w * .28, baseY + 6); break;
    case 'sawmill': box(ctx, cx, baseY, w * .8, s * .2, wall, roof); wheel(ctx, cx + w * .42, baseY - s * .08, s * .11, '#6a4a2a'); logs(ctx, cx - w * .3, baseY + 10); break;
    case 'quarry': pit(ctx, cx, baseY, s); crane(ctx, cx + w * .25, baseY - 4); break;
    case 'mine': rock(ctx, cx, baseY, s * .6, '#6a6a74'); ctx.fillStyle = '#1a1008'; ctx.beginPath(); ctx.arc(cx - w * .1, baseY - s * .02, s * .09, Math.PI, 0); ctx.lineTo(cx, baseY + 4); ctx.fill(); ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - w * .2, baseY + 4); ctx.lineTo(cx - w * .2, baseY - s * .12); ctx.lineTo(cx, baseY - s * .12); ctx.lineTo(cx, baseY + 4); ctx.stroke(); break;
    case 'warehouse': box(ctx, cx, baseY, w * .85, s * .26, wall, roof); barrels(ctx, cx + w * .32, baseY + 8); break;
    case 'barracks': box(ctx, cx, baseY, w * .8, s * .26, wall, roof); windows(ctx, cx, baseY, w * .8, s * .26, 2); flag(ctx, cx - w * .3, baseY - s * .44, '#9b2b22'); break;
    case 'tavern': box(ctx, cx, baseY, w * .75, s * .32, wall, roof); windows(ctx, cx, baseY, w * .75, s * .32, 3); sign(ctx, cx + w * .36, baseY - s * .2); break;
    case 'wall': crenel(ctx, cx, baseY, w, s * .22, '#9a9a9a'); break;
    case 'tower': box(ctx, cx, baseY, w * .42, s * .5, '#8a8a90'); crenel(ctx, cx, baseY - s * .5, w * .5, s * .08, '#8a8a90'); fire(ctx, cx, baseY - s * .58); break;
    case 'market': stall(ctx, cx - w * .2, baseY - 2, '#c04a3a'); stall(ctx, cx + w * .18, baseY + 8, '#2c5d9b'); break;
    case 'blacksmith': box(ctx, cx, baseY, w * .7, s * .22, wall, roof); ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(cx - w * .12, baseY - s * .06, s * .05, 0, 7); ctx.fill(); chimney(ctx, cx + w * .2, baseY - s * .4); break;
    case 'academy': box(ctx, cx, baseY, w * .78, s * .3, wall, roof); windows(ctx, cx, baseY, w * .78, s * .3, 3); dome(ctx, cx, baseY - s * .3 - w * .1, s * .14, '#4a8ad0'); break;
    case 'hospital': box(ctx, cx, baseY, w * .78, s * .28, wall, roof); windows(ctx, cx, baseY, w * .78, s * .28, 3); ctx.fillStyle = '#e03030'; ctx.fillRect(cx - w * .32, baseY - s * .25, 6, 18); ctx.fillRect(cx - w * .32 - 6, baseY - s * .19, 18, 6); break;
    case 'house': box(ctx, cx - w * .2, baseY, w * .4, s * .18, wall, roof); box(ctx, cx + w * .22, baseY + 4, w * .36, s * .16, shade(wall, -15), shade(roof, -10)); windows(ctx, cx - w * .2, baseY, w * .4, s * .18, 1); break;
    case 'embassy': box(ctx, cx, baseY, w * .8, s * .3, wall, roof); windows(ctx, cx, baseY, w * .8, s * .3, 3); flag(ctx, cx - w * .3, baseY - s * .46, '#6a3aa0'); flag(ctx, cx + w * .1, baseY - s * .52, '#f2c14e'); break;
    default: box(ctx, cx, baseY, w * .7, s * .25, wall, roof);
  }
}
function flag(ctx, x, y, color) { ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 36); ctx.stroke(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - 36); ctx.lineTo(x + 22, y - 30); ctx.lineTo(x, y - 22); ctx.fill(); }
function windmill(ctx, x, y) { ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.lineTo(x + 9, y - 50); ctx.lineTo(x - 9, y - 50); ctx.fill(); ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.moveTo(x - 12, y - 50); ctx.lineTo(x + 12, y - 50); ctx.lineTo(x, y - 62); ctx.fill(); ctx.strokeStyle = '#e8d8b8'; ctx.lineWidth = 4; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; ctx.beginPath(); ctx.moveTo(x, y - 50); ctx.lineTo(x + Math.cos(a) * 28, y - 50 + Math.sin(a) * 28); ctx.stroke(); } }
function wheel(ctx, x, y, r, color) { ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); } ctx.fillStyle = '#3f86c8'; ctx.beginPath(); ctx.ellipse(x, y + r + 2, r * 1.3, r * .3, 0, 0, 7); ctx.fill(); }
function logs(ctx, x, y) { ctx.fillStyle = '#8a5a2a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + i * 12, y, 7, 5, 0, 0, 7); ctx.fill(); } ctx.fillStyle = '#c8a070'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + i * 12 - 4, y, 3, 0, 7); ctx.fill(); } }
function pit(ctx, cx, baseY, s) { ctx.fillStyle = '#5a5a5a'; diamond(ctx, cx, baseY - 2, s * .6, s * .3); ctx.fill(); ctx.fillStyle = '#3a3a3a'; diamond(ctx, cx, baseY + 2, s * .4, s * .2); ctx.fill(); ctx.fillStyle = '#a8a8a8'; for (let i = 0; i < 4; i++) ctx.fillRect(cx - s * .3 + i * 12, baseY - s * .15 - (i % 2) * 8, 10, 8); }
function crane(ctx, x, y) { ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 48); ctx.lineTo(x - 30, y - 30); ctx.stroke(); ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 30, y - 30); ctx.lineTo(x - 30, y - 10); ctx.stroke(); ctx.fillStyle = '#a8a8a8'; ctx.fillRect(x - 36, y - 10, 12, 10); }
function rock(ctx, cx, baseY, w, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(cx - w / 2, baseY); ctx.lineTo(cx - w * .3, baseY - w * .45); ctx.lineTo(cx + w * .1, baseY - w * .55); ctx.lineTo(cx + w / 2, baseY - w * .1); ctx.lineTo(cx + w * .3, baseY + 6); ctx.fill(); ctx.fillStyle = shade(color, 25); ctx.beginPath(); ctx.moveTo(cx - w * .3, baseY - w * .45); ctx.lineTo(cx + w * .1, baseY - w * .55); ctx.lineTo(cx, baseY - w * .2); ctx.fill(); }
function barrels(ctx, x, y) { for (let i = 0; i < 2; i++) { ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x + i * 14 - 6, y - 16, 12, 16); ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x + i * 14 - 6, y - 12, 12, 2); ctx.fillRect(x + i * 14 - 6, y - 5, 12, 2); } }
function sign(ctx, x, y) { ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 8, y); ctx.stroke(); ctx.fillStyle = '#f2c14e'; ctx.fillRect(x - 2, y, 12, 10); }
function crenel(ctx, cx, baseY, w, h, color) { box(ctx, cx, baseY, w, h, color); ctx.fillStyle = shade(color, -5); for (let i = 0; i < 4; i++) { const t = i / 4; ctx.fillRect(cx - w / 2 + (w / 2) * t - 1, baseY - h + (w / 4) * t - 8, 7, 8); ctx.fillRect(cx + (w / 2) * t + 2, baseY + w / 4 - h - (w / 4) * t - 8, 7, 8); } }
function fire(ctx, x, y) { ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x, y - 22, x + 7, y); ctx.fill(); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x, y - 12, x + 3, y); ctx.fill(); }
function stall(ctx, x, y, color) { ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x - 18, y - 16, 36, 14); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 24, y - 20); ctx.lineTo(x + 24, y - 20); ctx.lineTo(x + 18, y - 34); ctx.lineTo(x - 18, y - 34); ctx.fill(); ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 22 + i * 12, y - 20, 5, 4); ctx.fillStyle = '#e03030'; ctx.beginPath(); ctx.arc(x - 8, y - 20, 4, 0, 7); ctx.arc(x + 4, y - 19, 4, 0, 7); ctx.fill(); }
function chimney(ctx, x, y) { ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x - 5, y, 10, 16); ctx.fillStyle = 'rgba(200,200,200,.5)'; ctx.beginPath(); ctx.arc(x + 2, y - 8, 6, 0, 7); ctx.arc(x + 8, y - 18, 8, 0, 7); ctx.fill(); }
function dome(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill(); ctx.fillStyle = shade(color, 40); ctx.beginPath(); ctx.arc(x - r * .3, y - r * .3, r * .3, 0, 7); ctx.fill(); ctx.fillStyle = '#f2c14e'; ctx.fillRect(x - 2, y - r - 10, 4, 10); }

// ---------- объекты мира ----------
export function world(ctx, frame, s) {
  const cx = s / 2, baseY = s * .78;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; diamond(ctx, cx, baseY + 2, s * .95, s * .48); ctx.fill();
  if (frame === 'city_player' || frame === 'city_other') {
    const enemy = frame === 'city_other';
    const wall = enemy ? '#6a6a70' : '#d8c8a8', roof = enemy ? '#7a1a1a' : '#2c5d9b';
    ctx.fillStyle = '#6aa84f'; diamond(ctx, cx, baseY, s * .9, s * .45); ctx.fill();
    crenel(ctx, cx, baseY, s * .72, s * .14, wall);
    box(ctx, cx, baseY - s * .1, s * .34, s * .36, wall, roof);
    box(ctx, cx - s * .22, baseY - s * .06, s * .16, s * .2, wall, roof); box(ctx, cx + s * .22, baseY - s * .06, s * .16, s * .2, wall, roof);
    flag(ctx, cx, baseY - s * .56, enemy ? '#9b2b22' : '#f2c14e');
    return;
  }
  if (frame === 'boss_lair') { rock(ctx, cx, baseY, s * .8, '#3a3040'); ctx.fillStyle = '#120a18'; ctx.beginPath(); ctx.ellipse(cx, baseY - s * .08, s * .18, s * .2, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(180,80,255,.5)'; ctx.beginPath(); ctx.ellipse(cx, baseY - s * .05, s * .12, s * .1, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#e8e8d8'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx - s * .3 + i * s * .12, baseY + 2, 6, 0, 7); ctx.fill(); } return; }
  ctx.fillStyle = frame === 'farm_node' ? '#c9a24a' : frame === 'forest_node' ? '#4f8a3a' : '#8a8a8a'; diamond(ctx, cx, baseY, s * .8, s * .4); ctx.fill();
  if (frame === 'forest_node') { for (let i = 0; i < 3; i++) tree(ctx, cx - s * .2 + i * s * .2, baseY - (i % 2) * 10, s * .3); return; }
  if (frame === 'farm_node') { ctx.strokeStyle = '#8a6a2a'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - s * .3 + i * s * .1, baseY + 4 - i * 3); ctx.lineTo(cx + i * s * .05, baseY - s * .2 + i * 2); ctx.stroke(); } return; }
  rock(ctx, cx, baseY, s * .6, frame === 'iron_node' ? '#5a6a80' : frame === 'gold_node' ? '#8a7a5a' : '#8a8a8a');
  if (frame === 'gold_node') { ctx.fillStyle = '#f2c14e'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx - 20 + i * 14, baseY - 20 - (i % 2) * 10, 5, 0, 7); ctx.fill(); } }
  if (frame === 'iron_node') { ctx.fillStyle = '#2a3040'; for (let i = 0; i < 3; i++) ctx.fillRect(cx - 18 + i * 14, baseY - 22 - (i % 2) * 8, 8, 8); }
}
function tree(ctx, x, y, h) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 2, h * .35, h * .14, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - h * .05, y - h * .35, h * .1, h * .37); for (let i = 0; i < 3; i++) { ctx.fillStyle = shade('#3d8a3a', i * 18); ctx.beginPath(); ctx.arc(x - h * .08 + i * h * .06, y - h * .45 - i * h * .18, h * (.3 - i * .05), 0, 7); ctx.fill(); } ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x - h * .1, y - h * .65, h * .1, 0, 7); ctx.fill(); }
export function misc(ctx, frame, s) {
  const cx = s / 2, baseY = s * .85;
  if (frame === 'tree') tree(ctx, cx, baseY, s * .75);
  else if (frame === 'rock') rock(ctx, cx, baseY, s * .45, '#8a8c92');
  else if (frame === 'bush') { for (let i = 0; i < 3; i++) { ctx.fillStyle = shade('#4b8a3b', i * 15); ctx.beginPath(); ctx.arc(cx - 14 + i * 14, baseY - 14 - (i % 2) * 8, 16, 0, 7); ctx.fill(); } ctx.fillStyle = '#e03030'; ctx.beginPath(); ctx.arc(cx - 6, baseY - 18, 3, 0, 7); ctx.arc(cx + 8, baseY - 24, 3, 0, 7); ctx.fill(); }
  else if (frame === 'construction') { ctx.fillStyle = '#8a7a5a'; diamond(ctx, cx, s * .78, s * .8, s * .4); ctx.fill(); ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 5; ctx.strokeRect(s * .28, s * .35, s * .44, s * .4); ctx.beginPath(); ctx.moveTo(s * .28, s * .35); ctx.lineTo(s * .72, s * .75); ctx.moveTo(s * .72, s * .35); ctx.lineTo(s * .28, s * .75); ctx.stroke(); ctx.fillStyle = '#a8a8a8'; for (let i = 0; i < 3; i++) ctx.fillRect(s * .3 + i * 14, s * .72, 12, 9); crane(ctx, s * .78, s * .8); }
  else if (frame === 'road') { ctx.fillStyle = '#a08a6a'; diamond(ctx, cx, s / 2, s, s / 2); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.arc(s * .2 + (i * 37 % 60) / 100 * s, s * .35 + (i * 53 % 30) / 100 * s, 4, 0, 7); ctx.fill(); } }
  else if (frame === 'river') terrain(ctx, 'water', s);
  else if (frame === 'flag') flag(ctx, cx, baseY, '#9b2b22');
  else if (frame === 'camp') { ctx.fillStyle = '#d8c8a8'; ctx.beginPath(); ctx.moveTo(cx, s * .4); ctx.lineTo(cx + s * .25, baseY); ctx.lineTo(cx - s * .25, baseY); ctx.fill(); ctx.fillStyle = '#8a7a5a'; ctx.beginPath(); ctx.moveTo(cx, s * .4); ctx.lineTo(cx + s * .25, baseY); ctx.lineTo(cx + s * .05, baseY); ctx.fill(); fire(ctx, cx + s * .33, baseY); }
}

// ---------- персонажи ----------
function figure(ctx, cx, baseY, h, color, opts = {}) {
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, baseY, h * .22, h * .07, 0, 0, 7); ctx.fill();
  // ноги
  ctx.fillStyle = shade(color, -50); ctx.fillRect(cx - h * .11, baseY - h * .3, h * .09, h * .3); ctx.fillRect(cx + h * .02, baseY - h * .3, h * .09, h * .3);
  // тело
  const g = ctx.createLinearGradient(cx - h * .15, 0, cx + h * .15, 0); g.addColorStop(0, shade(color, 25)); g.addColorStop(1, shade(color, -35));
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - h * .16, baseY - h * .68, h * .32, h * .42, h * .06); ctx.fill();
  // голова
  ctx.fillStyle = opts.skin || '#e8c39e'; ctx.beginPath(); ctx.arc(cx, baseY - h * .78, h * .12, 0, 7); ctx.fill();
  if (opts.helmet) { ctx.fillStyle = opts.helmet; ctx.beginPath(); ctx.arc(cx, baseY - h * .8, h * .13, Math.PI, 0); ctx.fill(); }
  if (opts.hood) { ctx.fillStyle = opts.hood; ctx.beginPath(); ctx.arc(cx, baseY - h * .78, h * .14, Math.PI * .9, Math.PI * 2.1); ctx.fill(); }
  // оружие
  ctx.strokeStyle = opts.weaponColor || '#d8d8e0'; ctx.lineWidth = h * .035; ctx.lineCap = 'round';
  if (opts.weapon === 'sword') { ctx.beginPath(); ctx.moveTo(cx + h * .2, baseY - h * .35); ctx.lineTo(cx + h * .32, baseY - h * .85); ctx.stroke(); }
  if (opts.weapon === 'bow') { ctx.beginPath(); ctx.arc(cx + h * .24, baseY - h * .55, h * .22, -Math.PI * .45, Math.PI * .45); ctx.stroke(); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + h * .24 + h * .22 * Math.cos(-Math.PI * .45), baseY - h * .55 + h * .22 * Math.sin(-Math.PI * .45)); ctx.lineTo(cx + h * .24 + h * .22 * Math.cos(Math.PI * .45), baseY - h * .55 + h * .22 * Math.sin(Math.PI * .45)); ctx.stroke(); }
  if (opts.weapon === 'staff') { ctx.strokeStyle = '#8a5a2a'; ctx.beginPath(); ctx.moveTo(cx + h * .22, baseY - h * .1); ctx.lineTo(cx + h * .22, baseY - h * .95); ctx.stroke(); ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(cx + h * .22, baseY - h * .98, h * .07, 0, 7); ctx.fill(); }
  if (opts.weapon === 'pitchfork') { ctx.strokeStyle = '#8a5a2a'; ctx.beginPath(); ctx.moveTo(cx + h * .22, baseY - h * .1); ctx.lineTo(cx + h * .22, baseY - h * .85); ctx.stroke(); ctx.strokeStyle = '#aaa'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + h * .22 + i * h * .05, baseY - h * .85); ctx.lineTo(cx + h * .22 + i * h * .05, baseY - h * .95); ctx.stroke(); } }
  if (opts.weapon === 'daggers') { ctx.beginPath(); ctx.moveTo(cx - h * .2, baseY - h * .4); ctx.lineTo(cx - h * .3, baseY - h * .6); ctx.moveTo(cx + h * .2, baseY - h * .4); ctx.lineTo(cx + h * .3, baseY - h * .6); ctx.stroke(); }
  if (opts.shield) { ctx.fillStyle = opts.shield; ctx.beginPath(); ctx.ellipse(cx - h * .22, baseY - h * .5, h * .1, h * .14, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2; ctx.stroke(); }
  if (opts.cape) { ctx.fillStyle = opts.cape; ctx.beginPath(); ctx.moveTo(cx - h * .14, baseY - h * .66); ctx.lineTo(cx - h * .3, baseY - h * .2); ctx.lineTo(cx - h * .1, baseY - h * .28); ctx.fill(); }
}
function horse(ctx, cx, baseY, h, color) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, baseY, h * .4, h * .1, 0, 0, 7); ctx.fill(); ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(cx - h * .35, baseY - h * .45, h * .62, h * .25, h * .1); ctx.fill(); ctx.fillRect(cx - h * .3, baseY - h * .22, h * .07, h * .22); ctx.fillRect(cx + h * .15, baseY - h * .22, h * .07, h * .22); ctx.beginPath(); ctx.roundRect(cx + h * .2, baseY - h * .62, h * .14, h * .3, h * .05); ctx.fill(); ctx.fillStyle = shade(color, -40); ctx.fillRect(cx + h * .24, baseY - h * .66, h * .04, h * .08); }
export function unit(ctx, frame, s) {
  const cx = s / 2, baseY = s * .9, color = UNIT[frame] || '#888';
  if (frame === 'knight') { horse(ctx, cx, baseY, s * .7, '#5a3a2a'); figure(ctx, cx - s * .02, baseY - s * .22, s * .5, color, { helmet: '#c0c0cc', weapon: 'sword', shield: '#2c5d9b', cape: '#9b2b22' }); return; }
  if (frame === 'scout') { horse(ctx, cx, baseY, s * .66, '#8a6a4a'); figure(ctx, cx - s * .02, baseY - s * .2, s * .42, color, { hood: '#5a4a2a' }); return; }
  if (frame === 'catapult') { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, baseY, s * .35, s * .1, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(cx - s * .3, baseY - s * .18, s * .6, s * .1); ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.arc(cx - s * .22, baseY - s * .06, s * .07, 0, 7); ctx.arc(cx + s * .22, baseY - s * .06, s * .07, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = s * .04; ctx.beginPath(); ctx.moveTo(cx - s * .05, baseY - s * .18); ctx.lineTo(cx + s * .18, baseY - s * .62); ctx.stroke(); ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.arc(cx + s * .2, baseY - s * .66, s * .07, 0, 7); ctx.fill(); figure(ctx, cx - s * .32, baseY - 4, s * .4, '#8c7a5a'); return; }
  const o = { militia: { weapon: 'pitchfork', hood: '#6a5a3a' }, swordsman: { helmet: '#9a9aa8', weapon: 'sword', shield: '#9b2b22' }, archer: { hood: '#2a5a2a', weapon: 'bow', weaponColor: '#8a5a2a' } }[frame] || {};
  figure(ctx, cx, baseY, s * .72, color, o);
}
export function hero(ctx, frame, s) {
  const cx = s / 2, baseY = s * .92, color = { knight: '#e0c060', archer: '#3a8a4a', mage: '#4a4fb0', rogue: '#3a3a3a' }[frame] || '#888';
  // ореол
  const g = ctx.createRadialGradient(cx, baseY - s * .4, s * .05, cx, baseY - s * .4, s * .45); g.addColorStop(0, 'rgba(242,193,78,.35)'); g.addColorStop(1, 'rgba(242,193,78,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const o = { knight: { helmet: '#f2c14e', weapon: 'sword', shield: '#2c5d9b', cape: '#9b2b22' }, archer: { hood: '#2a6a3a', weapon: 'bow', weaponColor: '#c0c0ff', cape: '#2a6a3a' }, mage: { hood: '#2a2a80', weapon: 'staff', cape: '#4a4fb0' }, rogue: { hood: '#1a1a1a', weapon: 'daggers', cape: '#2a2a2a' } }[frame] || {};
  figure(ctx, cx, baseY, s * .82, color, o);
}
export function monster(ctx, frame, s) {
  const cx = s / 2, baseY = s * .9, color = MON[frame] || '#777', h = s * .75;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, baseY, h * .3, h * .09, 0, 0, 7); ctx.fill();
  const quad = ['wolf', 'boar', 'spider', 'hydra'].includes(frame);
  if (quad) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(cx, baseY - h * .3, h * .36, h * .2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = shade(color, -40); for (let i = 0; i < 4; i++) ctx.fillRect(cx - h * .3 + i * h * .18, baseY - h * .2, h * .07, h * .2);
    ctx.fillStyle = shade(color, 10); ctx.beginPath(); ctx.arc(cx + h * .32, baseY - h * .42, h * .14, 0, 7); ctx.fill();
    if (frame === 'hydra') { ctx.beginPath(); ctx.arc(cx + h * .1, baseY - h * .6, h * .12, 0, 7); ctx.arc(cx - h * .15, baseY - h * .52, h * .11, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ff4'; ctx.beginPath(); ctx.arc(cx + h * .37, baseY - h * .45, 3, 0, 7); ctx.fill();
    if (frame === 'spider') { ctx.strokeStyle = shade(color, -10); ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx, baseY - h * .3); ctx.lineTo(cx - h * .5 + i * h * .33, baseY - h * .05); ctx.stroke(); } }
  } else {
    const big = ['ogre', 'troll', 'golem', 'minotaur', 'demon'].includes(frame);
    const g = ctx.createLinearGradient(cx - h * .2, 0, cx + h * .2, 0); g.addColorStop(0, shade(color, 25)); g.addColorStop(1, shade(color, -35));
    const bw = big ? h * .5 : h * .34, bh = big ? h * .5 : h * .42;
    ctx.fillStyle = shade(color, -50); ctx.fillRect(cx - bw * .35, baseY - h * .3, bw * .25, h * .3); ctx.fillRect(cx + bw * .1, baseY - h * .3, bw * .25, h * .3);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - bw / 2, baseY - h * .3 - bh, bw, bh, h * .08); ctx.fill();
    ctx.fillStyle = shade(color, 10); ctx.beginPath(); ctx.arc(cx, baseY - h * .3 - bh - h * .1, h * .14, 0, 7); ctx.fill();
    if (['minotaur', 'demon', 'dark_knight'].includes(frame)) { ctx.strokeStyle = frame === 'dark_knight' ? '#888' : '#e8e0d0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - h * .1, baseY - h * .3 - bh - h * .15); ctx.lineTo(cx - h * .2, baseY - h * .3 - bh - h * .3); ctx.moveTo(cx + h * .1, baseY - h * .3 - bh - h * .15); ctx.lineTo(cx + h * .2, baseY - h * .3 - bh - h * .3); ctx.stroke(); }
    if (frame === 'harpy' || frame === 'wraith') { ctx.fillStyle = frame === 'harpy' ? '#d0b0d0' : 'rgba(160,200,240,.5)'; ctx.beginPath(); ctx.moveTo(cx - bw / 2, baseY - h * .5); ctx.lineTo(cx - h * .5, baseY - h * .75); ctx.lineTo(cx - bw / 2, baseY - h * .65); ctx.moveTo(cx + bw / 2, baseY - h * .5); ctx.lineTo(cx + h * .5, baseY - h * .75); ctx.lineTo(cx + bw / 2, baseY - h * .65); ctx.fill(); }
    ctx.fillStyle = frame === 'skeleton' ? '#000' : '#ff4'; ctx.beginPath(); ctx.arc(cx - h * .05, baseY - h * .3 - bh - h * .1, 3, 0, 7); ctx.arc(cx + h * .05, baseY - h * .3 - bh - h * .1, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = h * .04; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + bw / 2, baseY - h * .4); ctx.lineTo(cx + bw / 2 + h * .18, baseY - h * .9); ctx.stroke();
  }
}
export function boss(ctx, frame, s) {
  const cx = s / 2, baseY = s * .92, color = BOSS[frame] || '#777', h = s * .85;
  const g = ctx.createRadialGradient(cx, baseY - h * .4, h * .1, cx, baseY - h * .4, h * .55); g.addColorStop(0, 'rgba(255,60,60,.3)'); g.addColorStop(1, 'rgba(255,60,60,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, baseY, h * .38, h * .1, 0, 0, 7); ctx.fill();
  if (frame === 'dragon') {
    ctx.fillStyle = shade(color, -30); ctx.beginPath(); ctx.moveTo(cx - h * .1, baseY - h * .45); ctx.lineTo(cx - h * .55, baseY - h * .85); ctx.lineTo(cx - h * .3, baseY - h * .35); ctx.moveTo(cx + h * .1, baseY - h * .45); ctx.lineTo(cx + h * .55, baseY - h * .85); ctx.lineTo(cx + h * .3, baseY - h * .35); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(cx, baseY - h * .3, h * .36, h * .22, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + h * .3, baseY - h * .62, h * .16, h * .11, -.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.moveTo(cx + h * .44, baseY - h * .64); ctx.lineTo(cx + h * .62, baseY - h * .72); ctx.lineTo(cx + h * .6, baseY - h * .58); ctx.fill();
  } else {
    const gg = ctx.createLinearGradient(cx - h * .3, 0, cx + h * .3, 0); gg.addColorStop(0, shade(color, 30)); gg.addColorStop(1, shade(color, -40));
    ctx.fillStyle = shade(color, -50); ctx.fillRect(cx - h * .22, baseY - h * .32, h * .16, h * .32); ctx.fillRect(cx + h * .06, baseY - h * .32, h * .16, h * .32);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.roundRect(cx - h * .3, baseY - h * .32 - h * .5, h * .6, h * .5, h * .1); ctx.fill();
    ctx.fillStyle = shade(color, 10); ctx.beginPath(); ctx.arc(cx, baseY - h * .92, h * .15, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2c14e'; if (frame === 'troll_king' || frame === 'demon_lord') { ctx.beginPath(); ctx.moveTo(cx - h * .14, baseY - h * 1.02); ctx.lineTo(cx - h * .08, baseY - h * 1.15); ctx.lineTo(cx, baseY - h * 1.04); ctx.lineTo(cx + h * .08, baseY - h * 1.15); ctx.lineTo(cx + h * .14, baseY - h * 1.02); ctx.fill(); }
    ctx.fillStyle = '#ff3'; ctx.beginPath(); ctx.arc(cx - h * .06, baseY - h * .93, 4, 0, 7); ctx.arc(cx + h * .06, baseY - h * .93, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = frame === 'lich' ? '#6ad0ff' : '#5a3a1a'; ctx.lineWidth = h * .05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + h * .3, baseY - h * .5); ctx.lineTo(cx + h * .5, baseY - h * 1.05); ctx.stroke();
    if (frame === 'lich') { ctx.fillStyle = '#6aff9a'; ctx.beginPath(); ctx.arc(cx + h * .5, baseY - h * 1.08, h * .07, 0, 7); ctx.fill(); }
  }
}
export function item(ctx, frame, s) {
  const [slot, tier] = frame.split('_');
  const col = ['#a8a8a8', '#4aa3ff', '#b05cff', '#ffb347'][+tier] || '#999';
  const g = ctx.createRadialGradient(s / 2, s / 2, s * .05, s / 2, s / 2, s * .5); g.addColorStop(0, shade(col, -60)); g.addColorStop(1, '#1a120a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(s * .06, s * .06, s * .88, s * .88, s * .12); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = s * .035; ctx.stroke();
  const m = shade(col, 20), d = shade(col, -50);
  ctx.lineJoin = 'round';
  ctx.fillStyle = m; ctx.strokeStyle = d; ctx.lineWidth = s * .02; ctx.beginPath();
  if (slot === 'weapon') { ctx.moveTo(s * .3, s * .72); ctx.lineTo(s * .68, s * .28); ctx.lineTo(s * .74, s * .34); ctx.lineTo(s * .36, s * .78); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#8a5a2a'; ctx.fillRect(s * .22, s * .7, s * .12, s * .12); }
  else if (slot === 'armor') { ctx.moveTo(s * .28, s * .28); ctx.lineTo(s * .72, s * .28); ctx.lineTo(s * .76, s * .45); ctx.lineTo(s * .66, s * .78); ctx.lineTo(s * .34, s * .78); ctx.lineTo(s * .24, s * .45); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (slot === 'helmet') { ctx.arc(s / 2, s * .5, s * .24, Math.PI, 0); ctx.lineTo(s * .74, s * .66); ctx.lineTo(s * .26, s * .66); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = d; ctx.fillRect(s * .46, s * .5, s * .08, s * .16); }
  else if (slot === 'boots') { ctx.moveTo(s * .34, s * .26); ctx.lineTo(s * .56, s * .26); ctx.lineTo(s * .56, s * .58); ctx.lineTo(s * .76, s * .68); ctx.lineTo(s * .76, s * .76); ctx.lineTo(s * .34, s * .76); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (slot === 'ring') { ctx.arc(s / 2, s * .55, s * .2, 0, 7); ctx.moveTo(s / 2 + s * .11, s * .55); ctx.arc(s / 2, s * .55, s * .11, 0, 7, true); ctx.fill('evenodd'); ctx.stroke(); ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(s / 2, s * .33, s * .07, 0, 7); ctx.fill(); }
  else { ctx.strokeStyle = m; ctx.lineWidth = s * .03; ctx.arc(s / 2, s * .42, s * .22, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.fillStyle = m; ctx.beginPath(); ctx.moveTo(s / 2, s * .78); ctx.lineTo(s * .38, s * .58); ctx.lineTo(s / 2, s * .48); ctx.lineTo(s * .62, s * .58); ctx.closePath(); ctx.fill(); }
  // блик
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(s * .3, s * .2, s * .14, s * .06, -.5, 0, 7); ctx.fill();
}
export function icon(ctx, frame, s) {
  const col = { food: '#e05a3a', wood: '#a0642c', stone: '#a8a8a8', iron: '#7a8aa0', gold: '#f2c14e', power: '#d04040', time: '#4a90e0', xp: '#9a5ad0' }[frame] || '#888';
  const g = ctx.createRadialGradient(s * .4, s * .35, s * .05, s / 2, s / 2, s * .45); g.addColorStop(0, shade(col, 60)); g.addColorStop(1, shade(col, -40));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * .42, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = s * .04; ctx.stroke();
  const t = { food: '🍞', wood: '🪵', stone: '🪨', iron: '⛓', gold: '💰', power: '⚔', time: '⏳', xp: '⭐' }[frame];
  ctx.font = `${s * .5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, s / 2, s * .53);
}
