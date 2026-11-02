'use strict';
// ===== Тосты, модальные окна, раннер мини-игр =====
const UI = {
  toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  },
  // buttons: [{label, cls, onClick, keep}]
  modal(title, html, buttons = [{ label: 'OK' }]) {
    $('#modal-title').innerHTML = title;
    $('#modal-body').innerHTML = html;
    const box = $('#modal-btns');
    box.innerHTML = '';
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.cls || '');
      el.innerHTML = b.label;
      el.onclick = () => {
        Sfx.click();
        if (!b.keep) UI.closeModal();
        if (b.onClick) b.onClick();
      };
      box.appendChild(el);
    });
    $('#modal').classList.remove('hidden');
  },
  closeModal() { $('#modal').classList.add('hidden'); },
  modalOpen() { return !$('#modal').classList.contains('hidden'); },
};

// Раннер мини-игр: игра — объект с методами start(api), update(dt), draw(ctx), down/move/up(x,y), key(code), exit()
const MG = {
  game: null, raf: 0, last: 0,
  init() {
    this.cv = $('#mg-canvas');
    this.ctx = this.cv.getContext('2d');
    const pos = e => {
      const r = this.cv.getBoundingClientRect();
      return [(e.clientX - r.left) * this.cv.width / r.width, (e.clientY - r.top) * this.cv.height / r.height];
    };
    this.cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.cv.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      this.game && this.game.down && this.game.down(x, y);
    });
    this.cv.addEventListener('pointermove', e => {
      const [x, y] = pos(e);
      this.game && this.game.move && this.game.move(x, y, e.buttons > 0 || e.pointerType === 'touch');
    });
    const up = e => { const [x, y] = pos(e); this.game && this.game.up && this.game.up(x, y); };
    this.cv.addEventListener('pointerup', up);
    this.cv.addEventListener('pointercancel', up);
    $('#mg-close').onclick = () => this.close(true);
    window.addEventListener('keydown', e => {
      if (!this.game) return;
      if (e.code === 'Escape') { this.close(true); return; }
      if (this.game.key) { this.game.key(e.code); e.preventDefault(); }
    });
  },
  open(title, game) {
    this.game = game;
    $('#mg-title').textContent = title;
    $('#mg-info').innerHTML = '';
    $('#mg-btns').innerHTML = '';
    $('#mg').classList.remove('hidden');
    const api = {
      info: html => { $('#mg-info').innerHTML = html; },
      buttons: list => this.setButtons(list),
      close: () => this.close(false),
    };
    game.start(api);
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    const loop = now => {
      if (!this.game) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.game.update && this.game.update(dt);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.game.draw(this.ctx);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  setButtons(list) {
    const box = $('#mg-btns');
    box.innerHTML = '';
    list.forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.cls || '') + (b.active ? ' active' : '');
      el.innerHTML = b.label;
      el.disabled = !!b.disabled;
      if (b.hold) {
        el.addEventListener('pointerdown', e => { e.preventDefault(); b.hold(true); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => b.hold(false)));
      } else {
        el.onclick = () => { Sfx.click(); b.onClick && b.onClick(); };
      }
      box.appendChild(el);
    });
  },
  close(byUser) {
    if (!this.game) return;
    const g = this.game;
    this.game = null;
    cancelAnimationFrame(this.raf);
    Sfx.setSizzle(false);
    Sfx.setEngine(false);
    $('#mg').classList.add('hidden');
    if (g.exit) g.exit(byUser);
    Save.dirty();
    if (typeof Garage !== 'undefined') Garage.render();
  },
};
