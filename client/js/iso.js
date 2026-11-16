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
  centerOn(x, y) { this.camX = (x - y) * this.tileW / 2; this.camY = (x + y) * this.tileH / 2; }
  begin() {
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.w, this.h);
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
      } else this._drag = { start: p, last: p, moved: false };
    });
    cv.addEventListener('pointermove', e => {
      const p = this._pos(e);
      if (this._pointers && this._pointers.has(e.pointerId)) this._pointers.set(e.pointerId, p);
      if (this._pinch && this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.setZoom(this._pinch.zoom * d / this._pinch.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (this._drag) {
        const dx = p.x - this._drag.last.x, dy = p.y - this._drag.last.y;
        if (Math.hypot(p.x - this._drag.start.x, p.y - this._drag.start.y) > 6) this._drag.moved = true;
        if (this._drag.moved) { this.camX -= dx / this.zoom; this.camY -= dy / this.zoom; }
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
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = this._pos(e); this.setZoom(this.zoom * (e.deltaY < 0 ? 1.12 : 0.89), p.x, p.y); }, { passive: false });
  }
  setZoom(z, px, py) {
    z = Math.max(this.minZoom, Math.min(this.maxZoom, z));
    // зум к точке под курсором
    const before = { x: (px - this.w / 2) / this.zoom + this.camX, y: (py - this.h / 2) / this.zoom + this.camY };
    this.zoom = z;
    const after = { x: (px - this.w / 2) / this.zoom + this.camX, y: (py - this.h / 2) / this.zoom + this.camY };
    this.camX += before.x - after.x; this.camY += before.y - after.y;
  }
}
