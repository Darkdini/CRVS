// Процедурный фон экрана входа: закат, замок на скале, птицы. Заменяется картинкой assets/login_bg.png.
export function drawLoginBg(canvas) {
  const dpr = Math.min(2, devicePixelRatio || 1); const r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr; canvas.height = r.height * dpr; const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  const w = r.width, h = r.height;
  const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#1a0f2a'); sky.addColorStop(.35, '#6b2d3a'); sky.addColorStop(.6, '#d87a3a'); sky.addColorStop(.75, '#f2c14e'); sky.addColorStop(1, '#3a2a1a');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  // звёзды
  c.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 60; i++) { const x = (i * 97.3) % w, y = (i * 53.7) % (h * .3); c.globalAlpha = .3 + (i % 5) / 7; c.fillRect(x, y, 1.5, 1.5); } c.globalAlpha = 1;
  // солнце
  const sun = c.createRadialGradient(w * .5, h * .62, 10, w * .5, h * .62, w * .5); sun.addColorStop(0, 'rgba(255,240,200,.95)'); sun.addColorStop(.12, 'rgba(255,200,100,.6)'); sun.addColorStop(1, 'rgba(255,200,100,0)');
  c.fillStyle = sun; c.fillRect(0, 0, w, h);
  // далёкие горы
  const mtn = (yBase, amp, color, seed) => { c.fillStyle = color; c.beginPath(); c.moveTo(0, h); let x = 0; while (x <= w + 40) { const y = yBase - Math.abs(Math.sin(x * .013 + seed) * amp + Math.sin(x * .037 + seed * 2) * amp * .3); c.lineTo(x, y); x += 20; } c.lineTo(w, h); c.fill(); };
  mtn(h * .66, 60, 'rgba(60,30,50,.7)', 1); mtn(h * .72, 50, 'rgba(40,22,35,.85)', 4);
  // скала и замок (силуэт)
  c.fillStyle = '#1a1008';
  c.beginPath(); c.moveTo(w * .15, h); c.lineTo(w * .22, h * .72); c.lineTo(w * .35, h * .66); c.lineTo(w * .65, h * .66); c.lineTo(w * .78, h * .72); c.lineTo(w * .85, h); c.fill();
  const tower = (x, tw, th) => { c.fillRect(x - tw / 2, h * .66 - th, tw, th); for (let i = -1; i <= 1; i++) c.fillRect(x + i * tw * .35 - tw * .1, h * .66 - th - tw * .18, tw * .2, tw * .18); c.beginPath(); c.moveTo(x - tw * .55, h * .66 - th - tw * .18); c.lineTo(x, h * .66 - th - tw * .9); c.lineTo(x + tw * .55, h * .66 - th - tw * .18); c.fill(); };
  c.fillRect(w * .3, h * .58, w * .4, h * .1);
  tower(w * .33, w * .07, h * .14); tower(w * .67, w * .07, h * .14); tower(w * .5, w * .1, h * .24);
  // флаг
  c.fillStyle = '#9b2b22'; c.beginPath(); c.moveTo(w * .5, h * .66 - h * .24 - w * .09); c.lineTo(w * .5 + w * .05, h * .66 - h * .24 - w * .08); c.lineTo(w * .5, h * .66 - h * .24 - w * .07); c.fill();
  // окна
  c.fillStyle = 'rgba(255,210,120,.9)'; for (let i = 0; i < 9; i++) c.fillRect(w * .33 + i * w * .04, h * .61 + (i % 2) * h * .02, 3, 5);
  // птицы
  c.strokeStyle = 'rgba(30,15,10,.8)'; c.lineWidth = 1.5; for (let i = 0; i < 7; i++) { const x = w * .2 + i * w * .09, y = h * .3 + (i % 3) * 18; c.beginPath(); c.moveTo(x - 6, y); c.quadraticCurveTo(x - 3, y - 4, x, y); c.quadraticCurveTo(x + 3, y - 4, x + 6, y); c.stroke(); }
  // туман внизу
  const fog = c.createLinearGradient(0, h * .7, 0, h); fog.addColorStop(0, 'rgba(13,10,7,0)'); fog.addColorStop(1, 'rgba(13,10,7,.95)'); c.fillStyle = fog; c.fillRect(0, h * .7, w, h * .3);
}
