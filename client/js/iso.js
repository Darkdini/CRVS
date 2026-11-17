// Изометрическая камера + ввод (мышь, тач, колесо, пинч).
export class IsoView {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileW = opts.tileW || 128;   // ширина ромба при zoom=1
    this.tileH = this.tileW / 2;
    this.zoom = opts.zoom || 1;
    this.minZoom = opts.minZoom || 0.35; this.maxZoom = opts.maxZoom || 2.5;
    this.camX = 0; this.camY = 0;      // мировые координаты центра экрана (в экранных единицах при zoom=1)
    this.velX = 0; this.velY = 0;      // инерция
    this.targetZoom = this.zoom; this.zoomAnchor = null;
    this.flyTo = null;
    this.onTap = null; this.onHover = null;
    this._drag = null; this._pinch = null;
    this._bind();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.floor(r.width * dpr); this.canvas.height = Math.floor(r.height * dpr);
    this.dpr = dpr; this.w = r.width; this.h = r.height;
  }
  // мир (тайл x,y, высота z) -> экран
  toScreen(x, y, z = 0) {
    const sx = (x - y) * this.tileW / 2, sy = (x + y) * this.tileH / 2 - z;
    return { x: (sx - this.camX) * this.zoom + this.w / 2, y: (sy - this.camY) * this.zoom + this.h / 2 };
  }
  toTile(px, py) {
    const sx = (px - this.w / 2) / this.zoom + this.camX, sy = (py - this.h / 2) / this.zoom + this.camY;
    const x = (sx / (this.tileW / 2) + sy / (this.tileH / 2)) / 2, y = (sy / (this.tileH / 2) - sx / (this.tileW / 2)) / 2;
    return { x: Math.floor(x), y: Math.floor(y), fx: x, fy: y };
  }
  centerOn(x, y) { this.camX = (x - y) * this.tileW / 2; this.camY = (x + y) * this.tileH / 2; this.velX = this.velY = 0; this.flyTo = null; }
  // плавный перелёт камеры к тайлу
  panTo(x, y) { this.flyTo = { x: (x - y) * this.tileW / 2, y: (x + y) * this.tileH / 2 }; }
  update(dt) {
    if (this.flyTo) {
      const k = 1 - Math.pow(0.001, dt);
      this.camX += (this.flyTo.x - this.camX) * k; this.camY += (this.flyTo.y - this.camY) * k;
      if (Math.hypot(this.flyTo.x - this.camX, this.flyTo.y - this.camY) < 0.5) this.flyTo = null;
    } else if (!this._drag || !this._drag.moved) {
      this.camX += this.velX * dt; this.camY += this.velY * dt;
      const f = Math.pow(0.02, dt); this.velX *= f; this.velY *= f;
    }
    if (Math.abs(this.targetZoom - this.zoom) > 0.0005) {
      const a = this.zoomAnchor || { x: this.w / 2, y: this.h / 2 };
      const z = this.zoom + (this.targetZoom - this.zoom) * (1 - Math.pow(0.0005, dt));
      this._applyZoom(z, a.x, a.y);
    }
  }
  shake(power = 6) { this._shake = { p: power, t: 0 }; }
  begin() {
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.w, this.h);
    if (this._shake) { this._shake.t += 0.016; const k = Math.max(0, 1 - this._shake.t / 0.35) * this._shake.p; c.translate((Math.random() - .5) * k, (Math.random() - .5) * k); if (k <= 0) this._shake = null; }
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  }
  diamond(x, y, color, stroke) {
    const c = this.ctx, tw = this.tileW * this.zoom, th = this.tileH * this.zoom;
    const p = this.toScreen(x, y);
    c.beginPath(); c.moveTo(p.x, p.y - th / 2); c.lineTo(p.x + tw / 2, p.y); c.lineTo(p.x, p.y + th / 2); c.lineTo(p.x - tw / 2, p.y); c.closePath();
    if (color) { c.fillStyle = color; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  }
  visibleBounds(size) {
    // грубая отсечка по углам экрана
    const corners = [this.toTile(0, 0), this.toTile(this.w, 0), this.toTile(0, this.h), this.toTile(this.w, this.h)];
    const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
    return { x0: Math.max(0, Math.min(...xs) - 2), x1: Math.min(size - 1, Math.max(...xs) + 2), y0: Math.max(0, Math.min(...ys) - 2), y1: Math.min(size - 1, Math.max(...ys) + 2) };
  }
  _pos(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  _bind() {
    const cv = this.canvas;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      const p = this._pos(e);
      this._pointers = this._pointers || new Map();
      this._pointers.set(e.pointerId, p);
      if (this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        this._pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom }; this._drag = null;
      } else { this._drag = { start: p, last: p, moved: false, t: performance.now() }; this.velX = this.velY = 0; this.flyTo = null; }
    });
    cv.addEventListener('pointermove', e => {
      const p = this._pos(e);
      if (this._pointers && this._pointers.has(e.pointerId)) this._pointers.set(e.pointerId, p);
      if (this._pinch && this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this._applyZoom(Math.max(this.minZoom, Math.min(this.maxZoom, this._pinch.zoom * d / this._pinch.dist)), (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.targetZoom = this.zoom; return;
      }
      if (this._drag) {
        const dx = p.x - this._drag.last.x, dy = p.y - this._drag.last.y;
        if (Math.hypot(p.x - this._drag.start.x, p.y - this._drag.start.y) > 6) this._drag.moved = true;
        if (this._drag.moved) { this.camX -= dx / this.zoom; this.camY -= dy / this.zoom; this.flyTo = null;
          const nowT = performance.now(); const dtm = Math.max(8, nowT - (this._drag.t || nowT)); this._drag.t = nowT;
          this.velX = -dx / this.zoom / dtm * 1000 * .6; this.velY = -dy / this.zoom / dtm * 1000 * .6; }
        this._drag.last = p;
      } else if (this.onHover) this.onHover(this.toTile(p.x, p.y));
    });
    const up = e => {
      if (this._pointers) this._pointers.delete(e.pointerId);
      if (this._pointers && this._pointers.size < 2) this._pinch = null;
      if (this._drag && !this._drag.moved && this.onTap) { const p = this._pos(e); this.onTap(this.toTile(p.x, p.y), p); }
      this._drag = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = this._pos(e); this.setZoom(this.targetZoom * (e.deltaY < 0 ? 1.15 : 0.87), p.x, p.y); }, { passive: false });
  }
  setZoom(z, px, py) { this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, z)); this.zoomAnchor = { x: px, y: py }; }
  _applyZoom(z, px, py) {
    z = Math.max(this.minZoom, Math.min(this.maxZoom, z));
    // зум к точке под курсором
    const before = { x: (px - this.w / 2) / this.zoom + this.camX, y: (py - this.h / 2) / this.zoom + this.camY };
    this.zoom = z;
    const after = { x: (px - this.w / 2) / this.zoom + this.camX, y: (py - this.h / 2) / this.zoom + this.camY };
    this.camX += before.x - after.x; this.camY += before.y - after.y;
  }
}
