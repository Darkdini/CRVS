'use strict';
// Боевая система: авто-бой по раундам. Используется для боссов и набегов.
const G = require('./gamedata');

// army: {type:count}, heroes: [{atk,def,hp,class,...}]
function armyStats(army, heroes, atkMul = 1) {
  let atk = 0, def = 0, hp = 0;
  for (const t in army) {
    const u = G.UNITS[t]; const n = army[t] || 0;
    atk += u.atk * n; def += u.def * n; hp += u.hp * n;
  }
  let heroAtk = 0, heroHp = 0, heroDef = 0;
  let armyAtkMul = 1, armyDefMul = 1;
  for (const h of heroes) {
    heroAtk += h.atk; heroHp += h.hp; heroDef += h.def;
    if (h.class === 'knight') armyDefMul += 0.15;
    if (h.class === 'archer') armyAtkMul += 0.15;
  }
  return { atk: (atk * armyAtkMul + heroAtk) * atkMul, def: def * armyDefMul + heroDef, hp: hp + heroHp };
}

// Симуляция: урон за раунд = atk * (100/(100+def)) с разбросом; до 10 раундов
function simulate(a, b, maxRounds = 10) {
  const log = [];
  let ahp = a.hp, bhp = b.hp;
  const aMax = a.hp, bMax = b.hp;
  let rounds = 0;
  for (let r = 1; r <= maxRounds && ahp > 0 && bhp > 0; r++) {
    rounds = r;
    const aScale = ahp / aMax, bScale = bhp / bMax; // ослабление при потерях
    const dA = Math.max(1, Math.floor(a.atk * aScale * (100 / (100 + b.def)) * (0.85 + Math.random() * 0.3)));
    const dB = Math.max(1, Math.floor(b.atk * bScale * (100 / (100 + a.def)) * (0.85 + Math.random() * 0.3)));
    bhp -= dA; ahp -= dB;
    log.push({ round: r, dealt: dA, taken: dB, ahp: Math.max(0, ahp), bhp: Math.max(0, bhp) });
  }
  return { log, rounds, aLeft: Math.max(0, ahp), bLeft: Math.max(0, bhp), aDamageDealt: bMax - Math.max(0, bhp), win: bhp <= 0 && ahp > 0 };
}

// Потери армии пропорционально потерянному hp
function applyLosses(army, lossRatio) {
  const lost = {};
  for (const t in army) {
    const n = army[t];
    const l = Math.min(n, Math.round(n * lossRatio));
    if (l > 0) lost[t] = l;
  }
  return lost;
}

module.exports = { armyStats, simulate, applyLosses };
