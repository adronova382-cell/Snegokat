'use strict';
// ===== Горка: физика, трюки, стройка лопатой, ночь =====
const G = 600;              // гравитация, единиц/с² (40 единиц ≈ 1 м)
const UNITS_PER_M = 40;

const Ride = {
  W: 6000, STEP: 10, N: 601, START_EDIT: 1150, END_EDIT: 5750,
  h: null, ice: null, active: false, mode: 'ride', terrainDirty: false,
  K: {}, keyEdge: {},
  cam: { x: 0, y: 0, z: 1 },
  tool: 'raise',
  brush: { on: false, sx: 0, sy: 0, wx: 0, wy: 0 },
  popups: [], parts: [], flakes: [],

  // ---------- инициализация
  init() {
    this.cv = $('#ride-canvas');
    this.ctx = this.cv.getContext('2d');
    this.dark = document.createElement('canvas');
    this.dctx = this.dark.getContext('2d');
    window.addEventListener('resize', () => this.resize());
    this.resize();
    for (let i = 0; i < 140; i++) this.flakes.push({ x: Math.random(), y: Math.random(), s: rand(1, 3), v: rand(20, 60) });
    this.stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.6, s: rand(0.5, 1.8), p: rand(0, 6) }));

    const map = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', Space: 'push', KeyQ: 'sigL', KeyE: 'sigR', KeyH: 'horn', KeyZ: 'KeyZ', KeyX: 'KeyX', KeyC: 'KeyC', KeyV: 'KeyV' };
    window.addEventListener('keydown', e => {
      if (!this.active || MG.game || UI.modalOpen()) return;
      const k = map[e.code];
      if (k) { if (!this.K[k]) this.keyEdge[k] = true; this.K[k] = true; e.preventDefault(); }
      if (e.code === 'KeyR') this.restart();
      if (e.code === 'KeyB') this.toggleBuild();
      if (e.code === 'KeyN') this.toggleNight();
      if (e.code === 'KeyL') this.toggleHead();
    });
    window.addEventListener('keyup', e => { const k = map[e.code]; if (k) this.K[k] = false; });
    window.addEventListener('blur', () => { this.K = {}; });

    // тач-кнопки
    $$('#touch [data-k]').forEach(b => {
      const k = b.dataset.k;
      const on = e => { e.preventDefault(); if (!this.K[k]) this.keyEdge[k] = true; this.K[k] = true; b.classList.add('on'); };
      const off = e => { e.preventDefault(); this.K[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
    $('#r-garage').onclick = () => { Sfx.click(); App.go('garage'); };
    $('#r-build').onclick = () => { Sfx.click(); this.toggleBuild(); };
    $('#r-night').onclick = () => { Sfx.click(); this.toggleNight(); };
    $('#r-restart').onclick = () => { Sfx.click(); this.restart(); };
    $('#r-light').onclick = () => { Sfx.click(); this.toggleHead(); };

    // стройка
    $$('#build-bar [data-tool]').forEach(b => b.onclick = () => { Sfx.click(); this.tool = b.dataset.tool; this.updateBuildBar(); });
    $('#b-reset').onclick = () => UI.modal('Сбросить горку?', 'Все постройки исчезнут, снег вернётся в запас.', [
      { label: 'Сбросить', cls: 'danger', onClick: () => { this.genTerrain(); S.snow = 600; this.terrainDirty = true; this.persist(); this.updateBuildBar(); } },
      { label: 'Отмена' },
    ]);
    const pan = (dir, on) => { this.K[dir > 0 ? 'panR' : 'panL'] = on; };
    [['#b-left', -1], ['#b-right', 1]].forEach(([id, d]) => {
      const b = $(id);
      b.addEventListener('pointerdown', e => { e.preventDefault(); pan(d, true); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => pan(d, false)));
    });

    const wpos = e => {
      const r = this.cv.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      return [sx, sy, (sx - this.vw * 0.35) / this.cam.z + this.cam.x, (this.vh * 0.62 - sy) / this.cam.z + this.cam.y];
    };
    this.cv.addEventListener('pointerdown', e => {
      if (this.mode !== 'build') return;
      e.preventDefault();
      this.cv.setPointerCapture(e.pointerId);
      const [sx, sy, wx, wy] = wpos(e);
      Object.assign(this.brush, { on: true, sx, sy, wx, wy });
      if (this.tool === 'kicker' || this.tool === 'bigkicker' || this.tool === 'landing') { this.stamp(this.tool, wx); this.brush.on = false; }
    });
    this.cv.addEventListener('pointermove', e => {
      const [sx, sy, wx, wy] = wpos(e);
      Object.assign(this.brush, { sx, sy, wx, wy, hover: true });
    });
    const up = () => { if (this.brush.on) { this.brush.on = false; this.persist(); } };
    this.cv.addEventListener('pointerup', up);
    this.cv.addEventListener('pointercancel', up);
    this.cv.addEventListener('wheel', e => { if (this.mode === 'build') { this.cam.x += (e.deltaY + e.deltaX) * 1.2; e.preventDefault(); } }, { passive: false });
  },

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.cv.width = this.vw * this.dpr; this.cv.height = this.vh * this.dpr;
    this.dark.width = this.cv.width; this.dark.height = this.cv.height;
    this.cam.z = clamp(Math.min(this.vh / 620, this.vw / 980), 0.42, 1.7);
  },

  // ---------- рельеф
  genTerrain() {
    const h = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) {
      const x = i * this.STEP;
      if (x <= 160) h[i] = 520;
      else if (x < 1100) h[i] = 260 * (1 + Math.cos(Math.PI * (x - 160) / 940));
      else h[i] = Math.sin(x * 0.004) * 4;
      if (x > 5800) h[i] = Math.min(400, (x - 5800) * 1.6);
    }
    this.h = h;
    this.ice = new Uint8Array(this.N);
    // стартовые постройки
    this.stamp('kicker', 1700, true);
    this.stamp('landing', 2120, true);
    this.stamp('kicker', 3000, true);
  },
  loadTerrain() {
    if (S.terrain && S.terrain.length === this.N) {
      this.h = Float32Array.from(S.terrain);
      this.ice = new Uint8Array(this.N);
      if (S.ice) for (let i = 0; i < this.N; i++) this.ice[i] = S.ice.charCodeAt(i) === 49 ? 1 : 0;
    } else this.genTerrain();
  },
  persist() {
    if (!this.h || !this.terrainDirty) return;
    S.terrain = Array.from(this.h, v => Math.round(v * 10) / 10);
    S.ice = Array.from(this.ice).join('');
    this.terrainDirty = false;
    Save.dirty();
  },
  H(x) {
    const f = clamp(x / this.STEP, 0, this.N - 1.0001);
    const i = Math.floor(f), t = f - i;
    return this.h[i] + (this.h[i + 1] - this.h[i]) * t;
  },
  slope(x, d = 6) { return Math.atan2(this.H(x + d) - this.H(x - d), 2 * d); },
  // наклон «под полозом» — по точке позади (по ходу движения), чтобы кромка трамплина подбрасывала
  pslope(x, dir) { const d = 5; return dir >= 0 ? Math.atan2(this.H(x) - this.H(x - d), d) : Math.atan2(this.H(x + d) - this.H(x), d); },
  isIce(x) { return this.ice[clamp(Math.round(x / this.STEP), 0, this.N - 1)] === 1; },

  // ---------- стройка
  stamp(kind, wx, free) {
    const shapes = {
      kicker: { H: 65, L: 140 },
      bigkicker: { H: 105, L: 220 },
      landing: { H: 85, L: 340 },
    };
    const s = shapes[kind];
    const add = new Map();
    for (let i = 0; i < this.N; i++) {
      const x = i * this.STEP;
      let v = 0;
      if (kind === 'landing') {
        if (x >= wx - 110 && x < wx) v = s.H * (0.5 - 0.5 * Math.cos(Math.PI * (x - (wx - 110)) / 110));
        else if (x >= wx && x <= wx + s.L) v = s.H * (0.5 + 0.5 * Math.cos(Math.PI * (x - wx) / s.L));
      } else {
        if (x >= wx - s.L && x <= wx) v = s.H * Math.pow((x - (wx - s.L)) / s.L, 2);
        else if (x > wx && x < wx + 30) v = s.H * (1 - (x - wx) / 30);
      }
      if (v > 0) {
        if (!free && (x < this.START_EDIT || x > this.END_EDIT)) continue;
        add.set(i, Math.min(v, 650 - this.h[i]));
      }
    }
    let cost = 0; add.forEach(v => cost += Math.max(0, v) * this.STEP / 100);
    if (!free) {
      if (cost > S.snow) { UI.toast(`Мало снега: нужно ${Math.ceil(cost)}, есть ${Math.floor(S.snow)}. Покопай где-нибудь или купи самосвал.`, 'bad'); Sfx.error(); return; }
      S.snow -= cost; S.snowMoved += cost;
      if (S.snowMoved >= 1000) App.ach('builder');
      Sfx.noise(0.4, 0.3, 700);
      this.terrainDirty = true;
    }
    add.forEach((v, i) => { this.h[i] += Math.max(0, v); });
    if (!free) { this.persist(); this.updateBuildBar(); }
  },
  applyBrush(dt) {
    const b = this.brush; if (!b.on) return;
    const big = !!S.tools.shovel2;
    const R = big ? 90 : 60, rate = big ? 280 : 170;
    const i0 = Math.max(0, Math.ceil((b.wx - R) / this.STEP)), i1 = Math.min(this.N - 1, Math.floor((b.wx + R) / this.STEP));
    let moved = 0;
    const old = this.h.slice(Math.max(0, i0 - 2), Math.min(this.N, i1 + 3));
    const base = Math.max(0, i0 - 2);
    for (let i = i0; i <= i1; i++) {
      const x = i * this.STEP;
      if (x < this.START_EDIT || x > this.END_EDIT) continue;
      const w = 0.5 + 0.5 * Math.cos(Math.PI * Math.abs(x - b.wx) / R);
      let dh = 0;
      if (this.tool === 'raise') {
        if (this.h[i] < b.wy) dh = Math.min(rate * dt * w, b.wy - this.h[i]);
        const cost = dh * this.STEP / 100;
        if (cost > S.snow) dh = S.snow * 100 / this.STEP;
        dh = Math.min(dh, 650 - this.h[i]);
      } else if (this.tool === 'dig') {
        if (this.h[i] > b.wy) dh = -Math.min(rate * dt * w, this.h[i] - b.wy);
        dh = Math.max(dh, -60 - this.h[i]);
      } else if (this.tool === 'smooth') {
        let avg = 0, n = 0;
        for (let k = -3; k <= 3; k++) { const j = i + k - base; if (j >= 0 && j < old.length) { avg += old[j]; n++; } }
        dh = (avg / n - this.h[i]) * Math.min(1, 8 * dt) * w;
        if (dh > 0 && dh * this.STEP / 100 > S.snow) dh = 0;
      } else if (this.tool === 'ice' || this.tool === 'unice') {
        if (Math.abs(x - b.wx) < R * 0.7) {
          const v = this.tool === 'ice' ? 1 : 0;
          if (this.ice[i] !== v) { this.ice[i] = v; this.terrainDirty = true; }
        }
        continue;
      }
      if (dh) {
        this.h[i] += dh;
        const c = dh * this.STEP / 100;
        S.snow = Math.max(0, S.snow - c);
        moved += Math.abs(c);
      }
    }
    if (moved > 0) {
      this.terrainDirty = true;
      S.snowMoved += moved;
      if (S.snowMoved >= 1000) App.ach('builder');
      if (Math.random() < dt * 6) Sfx.noise(0.15, 0.12, 900);
      if (Math.random() < dt * 20) this.parts.push({ x: b.wx + rand(-20, 20), y: this.H(b.wx) + 5, vx: rand(-80, 80), vy: rand(60, 200), life: 0.7, type: 'snow' });
      this.updateBuildBarSnow();
    }
  },
  updateBuildBar() {
    $$('#build-bar [data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === this.tool);
      if (b.dataset.tool === 'ice' || b.dataset.tool === 'unice') b.classList.toggle('hidden', !S.tools.bucket);
    });
    this.updateBuildBarSnow();
  },
  updateBuildBarSnow() { $('#b-snow').textContent = Math.floor(S.snow); },
  toggleBuild() {
    this.mode = this.mode === 'build' ? 'ride' : 'build';
    $('#build-bar').classList.toggle('hidden', this.mode !== 'build');
    $('#touch').classList.toggle('hidden', this.mode === 'build' || !this.touchUI);
    $('#r-build').innerHTML = this.mode === 'build' ? '🛷 Кататься' : '🪏 Стройка';
    this.persist();
    this.restart(true);
    if (this.mode === 'build') { this.cam.x = 1500; this.updateBuildBar(); if (!S.stats.builtHint) { S.stats.builtHint = 1; UI.toast('Зажми на экране, чтобы насыпать снег до этой высоты. Двигай камеру стрелками/колесом.'); } }
  },
  toggleNight() {
    S.settings.night = !S.settings.night;
    $('#r-night').innerHTML = S.settings.night ? '☀️ День' : '🌙 Ночь';
    if (S.settings.night && !S.mods.headlight) UI.toast('Ночью без фары ничего не видно! Спаяй фару в гараже.');
    Save.dirty();
  },
  toggleHead() {
    if (!S.mods.headlight) { UI.toast('Фары нет — спаяй в гараже 🔦'); return; }
    S.modOn.headlight = !S.modOn.headlight; Sfx.click(); Save.dirty();
  },

  // ---------- вход/выход
  enter() {
    this.active = true;
    this.loadTerrain();
    this.resize();
    this.touchUI = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.mode = 'ride';
    $('#build-bar').classList.add('hidden');
    $('#touch').classList.toggle('hidden', !this.touchUI);
    $('#r-build').innerHTML = '🪏 Стройка';
    $('#r-night').innerHTML = S.settings.night ? '☀️ День' : '🌙 Ночь';
    $('#r-light').classList.toggle('hidden', !S.mods.headlight);
    $$('#touch [data-need]').forEach(b => b.classList.toggle('hidden', !S.mods[b.dataset.need]));
    this.restart(true);
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    const loop = now => {
      if (!this.active) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    if (S.stats.runs === 0) setTimeout(() => this.showHelp(), 300);
  },
  exit() {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.persist();
    Sfx.setEngine(false);
    Sfx.stopMusic();
    Save.save();
  },
  showHelp() {
    UI.modal('Как кататься 🛷', `
      <table class="keys">
      <tr><td><kbd>Пробел</kbd></td><td>оттолкнуться ногой</td></tr>
      <tr><td><kbd>←</kbd> <kbd>→</kbd> / <kbd>A</kbd> <kbd>D</kbd></td><td>вращение в воздухе (сальто)</td></tr>
      <tr><td><kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> <kbd>V</kbd></td><td>трюки: Супермен, Без рук, Канкан, Шпагат — <b>держи</b> в воздухе и отпусти до приземления!</td></tr>
      <tr><td><kbd>↓</kbd> / <kbd>S</kbd></td><td>тормоз</td></tr>
      <tr><td><kbd>↑</kbd> / <kbd>W</kbd></td><td>газ (когда соберёшь мотор)</td></tr>
      <tr><td><kbd>Q</kbd> <kbd>E</kbd> <kbd>H</kbd> <kbd>L</kbd></td><td>поворотники, клаксон, фара</td></tr>
      <tr><td><kbd>B</kbd> <kbd>N</kbd> <kbd>R</kbd></td><td>стройка, ночь, заново</td></tr>
      </table>
      <p>Приземляйся полозьями <b>вдоль склона</b>. Разные трюки в одном прыжке умножают очки. Очки → монеты → детали.</p>`, [{ label: 'Погнали!', cls: 'primary' }]);
  },

  restart(silent) {
    const x = 70;
    this.p = {
      x, y: this.H(x), vx: 0, vy: 0, s: 0, ang: 0, angV: 0, ground: true, air: 0, rot: 0, takeX: x, takeY: 0,
      trick: null, trickT: 0, tricks: {}, recover: 0, joints: Sled.makeJoints('sit'),
      crashed: false, crashT: 0, rider: null, pushCD: 0, pushT: 0, stopT: 0, wheelRot: 0,
      lastSig: -99, engine: false, maxX: x, seized: false, hornCD: 0, lowFuelWarn: false,
    };
    this.run = { started: false, score: 0, time: 0, jumps: 0, bestJump: 0, maxSpeed: 0, flips: 0, ended: false, wentFar: false, list: [] };
    this.cam.x = x + 200; this.cam.y = this.p.y;
    this.popups = []; this.parts = [];
    Sfx.setEngine(false);
    if (!silent) Sfx.click();
  },

  // ---------- игровой цикл
  update(dt) {
    this.t = (this.t || 0) + dt;
    if (this.mode === 'build') {
      const pan = (this.K.left || this.K.panL ? -1 : 0) + (this.K.right || this.K.panR ? 1 : 0);
      this.cam.x = clamp(this.cam.x + pan * 700 * dt, 0, this.W);
      this.cam.y = lerp(this.cam.y, this.H(this.cam.x) + 80, dt * 3);
      this.applyBrush(dt);
    } else if (!this.run.ended && !UI.modalOpen()) {
      const n = 4;
      for (let i = 0; i < n; i++) this.step(dt / n);
      this.control(dt);
      // камера
      const p = this.p;
      const tx = (p.crashed && p.rider ? p.rider.x : p.x) + clamp(p.vx || p.s, -400, 900) * 0.25;
      const ty = (p.crashed && p.rider ? p.rider.y : p.y) + 40;
      this.cam.x = lerp(this.cam.x, tx, 1 - Math.exp(-dt * 4));
      this.cam.y = lerp(this.cam.y, ty, 1 - Math.exp(-dt * 3));
    }
    // частицы
    for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= (q.type === 'smoke' ? -20 : 500) * dt; q.life -= dt; }
    this.parts = this.parts.filter(q => q.life > 0);
    for (const pp of this.popups) pp.t += dt;
    this.popups = this.popups.filter(pp => pp.t < 2.2);
    this.keyEdge = {};
  },

  motorReady() { return S.mods.motor && !S.motor.seized && S.motor.health > 0 && S.tank.fuel > 0.5; },

  control(dt) {
    const p = this.p, K = this.K, E = this.keyEdge;
    // клаксон
    if (S.mods.horn && E.horn) { Sfx.hornTone(); }
    // поворотники
    if (S.mods.turn && (K.sigL || K.sigR)) p.lastSig = this.t;
    // толчок
    p.pushCD -= dt; p.pushT -= dt;
    if (E.push && p.ground && !p.crashed && p.pushCD <= 0 && Math.abs(p.s) < 280) {
      p.s += 120; p.pushCD = 0.4; p.pushT = 0.35;
      this.run.started = true;
      Sfx.noise(0.12, 0.15, 800);
    }
    // мотор
    const gas = K.gas && this.motorReady() && !p.crashed;
    if (S.mods.motor && K.gas && !this.motorReady() && !p.fuelMsgT) {
      p.fuelMsgT = 1;
      this.popup(S.motor.health <= 0 ? 'Мотор заклинило!' : 'Бак пуст! ⛽', '#ff5252');
    }
    if (p.fuelMsgT) { p.fuelMsgT -= dt; if (p.fuelMsgT <= 0) p.fuelMsgT = 0; }
    if (gas) { p.engine = true; this.run.started = true; }
    if (p.engine && this.motorReady()) {
      const use = (gas ? 7 : 0.25) * dt;
      const tot = S.tank.fuel + S.tank.oil;
      const ratio = S.tank.oil > 0 ? S.tank.fuel / S.tank.oil : 999;
      S.tank.fuel = Math.max(0, S.tank.fuel - use * S.tank.fuel / tot);
      S.tank.oil = Math.max(0, S.tank.oil - use * S.tank.oil / tot);
      if (gas && ratio > 70) {
        S.motor.health -= dt * (ratio > 150 ? 8 : 1.5);
        if (Math.random() < dt * 0.5) this.popup('Мотор греется! Мало масла', '#ffab40');
        if (S.motor.health <= 0) { S.motor.health = 0; this.popup('💥 ЗАКЛИНИЛО! Нужна поршневая', '#ff1744'); Sfx.crash(); p.engine = false; }
      }
      if (gas && ratio < 30 && Math.random() < dt * 20) this.parts.push({ x: p.x - 70, y: p.y + 30, vx: rand(-40, 0), vy: rand(10, 40), life: 1.5, type: 'smoke', dark: true });
      if (S.tank.fuel < 40 && !p.lowFuelWarn) { p.lowFuelWarn = true; this.popup('Топливо на исходе!', '#ffab40'); }
      p.rpm = lerp(p.rpm || 0.15, gas ? (p.ground ? clamp(0.5 + Math.abs(p.s) / 1400, 0, 1) : 1) : 0.15, dt * 6);
      Sfx.setEngine(true, p.rpm);
      if (gas && Math.random() < dt * 25) this.parts.push({ x: p.x - 75 * Math.cos(p.ang), y: p.y + 26, vx: rand(-60, -20), vy: rand(10, 30), life: 0.8, type: 'smoke' });
    } else if (p.engine) { p.engine = false; Sfx.setEngine(false); }
    p.gas = gas;

    // музыка
    if (S.mods.speaker && S.modOn.speaker && this.run.started && !this.run.ended) Sfx.startMusic(); else Sfx.stopMusic();

    // трюки в воздухе
    if (!p.ground && !p.crashed) {
      let held = null;
      for (const k in TRICKS) if (K[k]) held = k;
      if (held !== p.trick) {
        if (p.trick && !held) p.recover = 0.16;
        p.trick = held;
        if (held) Sfx.trick();
      }
      if (p.trick) p.tricks[p.trick] = (p.tricks[p.trick] || 0) + dt;
      if (p.recover > 0) p.recover -= dt;
    }
    // поза
    let pose = 'sit';
    if (p.trick) pose = TRICKS[p.trick].pose;
    else if (p.pushT > 0) pose = 'push';
    else if (K.brake && p.ground) pose = 'back';
    else if (gas || (p.ground && p.s > 500)) pose = 'lean';
    Sled.blendJoints(p.joints, pose, 1 - Math.exp(-dt * (p.trick ? 14 : 10)));

    // скорость / рекорды
    const speedKmh = Math.abs(p.ground ? p.s : Math.hypot(p.vx, p.vy)) / UNITS_PER_M * 3.6;
    p.kmh = speedKmh;
    if (!p.crashed) this.run.maxSpeed = Math.max(this.run.maxSpeed, speedKmh);
    if (S.mods.speedo && speedKmh >= 50) App.ach('speed');
    if (p.x > 1300) this.run.wentFar = true;
    if (this.run.wentFar && S.mods.motor && p.x < 260 && p.ground) App.ach('climb');
    p.maxX = Math.max(p.maxX, p.x);
    if (p.x > 40) this.run.started = this.run.started || Math.abs(p.s) > 20;
    if (this.run.started) this.run.time += dt;

    // снежная пыль
    if (p.ground && !p.crashed && Math.abs(p.s) > 150 && Math.random() < dt * 30) {
      this.parts.push({ x: p.x - 40, y: p.y + 2, vx: -p.s * 0.2 + rand(-40, 40), vy: rand(40, 140), life: 0.6, type: 'snow' });
    }
    // конец заезда
    if (p.crashed) {
      p.crashT += dt;
      if (p.crashT > 2.2) this.endRun(true);
    } else if (this.run.started && p.ground && Math.abs(p.s) < 10 && !gas) {
      p.stopT += dt;
      if (p.stopT > (S.mods.motor ? 3 : 1.6)) this.endRun(false);
    } else p.stopT = 0;
  },

  step(dt) {
    const p = this.p;
    if (p.crashed) {
      const r = p.rider;
      r.vy -= G * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.va * dt;
      const gh = this.H(r.x);
      if (r.y < gh + 6) { r.y = gh + 6; r.vy = Math.abs(r.vy) * 0.3; r.vx *= 0.7; r.va *= 0.6; if (Math.abs(r.vy) > 60) Sfx.land(0.2); }
      // снегокат скользит дальше сам
      if (p.ground) {
        const th = this.slope(p.x);
        p.s += (-G * Math.sin(th)) * dt; p.s *= (1 - 1.5 * dt);
        p.x = clamp(p.x + p.s * Math.cos(th) * dt, 5, this.W - 5); p.y = this.H(p.x); p.ang = lerp(p.ang, th, 0.2);
      } else {
        p.vy -= G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.ang += p.angV * dt;
        if (p.y <= this.H(p.x)) { p.ground = true; p.y = this.H(p.x); p.s = p.vx * 0.4; }
      }
      return;
    }
    if (p.ground) {
      const dir = p.s >= 0 ? 1 : -1;
      const th = this.pslope(p.x, dir);
      const ice = this.isIce(p.x);
      const mu = ice ? 0.01 : (S.tools.wax ? 0.025 : 0.045);
      let a = -G * Math.sin(th);
      if (p.gas) {
        let thrust = 270 * (1 - clamp(p.s / 820, -0.2, 1));
        const ratio = S.tank.oil > 0 ? S.tank.fuel / S.tank.oil : 999;
        if (ratio < 30) thrust *= 0.75;
        a += thrust * (ice ? 0.35 : 1);
        p.wheelRot += dt * 40;
      }
      const fr = mu * G * Math.cos(th) + (this.K.brake ? 380 : 0) + 0.00008 * p.s * p.s;
      if (Math.abs(p.s) < 4 && Math.abs(a) <= fr) p.s = 0;
      else {
        p.s += a * dt;
        const sg = Math.sign(p.s);
        p.s -= sg * fr * dt;
        if (Math.sign(p.s) !== sg) p.s = 0;
      }
      const vx = p.s * Math.cos(th), vy = p.s * Math.sin(th);
      let nx = p.x + vx * dt;
      if (nx < 8) { nx = 8; p.s = Math.max(0, p.s); }
      if (nx > this.W - 8) { nx = this.W - 8; p.s = Math.min(0, p.s); }
      const by = p.y + vy * dt - 0.5 * G * dt * dt;
      const gh = this.H(nx);
      if (gh < by - 1.2 && Math.abs(p.s) > 60) {
        p.ground = false; p.x = nx; p.y = by; p.vx = vx; p.vy = vy - G * dt;
        p.ang = Math.atan2(vy, vx) + (dir < 0 ? Math.PI : 0); p.ang = wrapAngle(p.ang);
        p.air = 0; p.rot = 0; p.takeX = nx; p.takeY = by; p.tricks = {}; p.trick = null; p.recover = 0; p.angV = 0; p.peak = by;
        p.sigBonus = this.t - p.lastSig < 2.5;
      } else {
        p.x = nx; p.y = gh;
        const th2 = this.pslope(nx, dir);
        p.s = vx * Math.cos(th2) + vy * Math.sin(th2);
      }
      const sa = Math.atan2(this.H(p.x + 30) - this.H(p.x - 30), 60);
      p.ang = lerp(p.ang, sa, 0.35);
    } else {
      p.air += dt;
      p.vy -= G * dt;
      p.vx *= (1 - 0.02 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.peak = Math.max(p.peak, p.y);
      if (p.x < 8) { p.x = 8; p.vx = Math.abs(p.vx) * 0.3; }
      if (p.x > this.W - 8) { p.x = this.W - 8; p.vx = -Math.abs(p.vx) * 0.3; }
      const input = (this.K.left ? 1 : 0) - (this.K.right ? 1 : 0);
      const rs = S.tools.grips ? 8.0 : 6.4;
      p.angV = lerp(p.angV, input * rs, 1 - Math.exp(-dt * (input ? 9 : 2.5)));
      p.ang += p.angV * dt; p.rot += p.angV * dt;
      // без вращения снегокат плавно ложится по траектории — так проще приземляться
      if (!input && Math.abs(p.angV) < 1.5) {
        const va = Math.atan2(p.vy, p.vx) + (p.vx < 0 ? Math.PI : 0);
        const dd = wrapAngle(va - p.ang);
        if (Math.abs(dd) < 1.2) p.ang += clamp(dd, -1, 1) * (1 - Math.exp(-dt * 1.6));
      }
      if (p.gas) p.wheelRot += dt * 60;
      if (p.y <= this.H(p.x)) this.land();
    }
  },

  land() {
    const p = this.p;
    const th = this.slope(p.x);
    const diff = wrapAngle(p.ang - th);
    const vn = -p.vx * Math.sin(th) + p.vy * Math.cos(th);
    const impact = -vn;
    p.y = this.H(p.x);
    p.ground = true;
    p.s = p.vx * Math.cos(th) + p.vy * Math.sin(th);
    if (p.air < 0.3 && Math.abs(diff) < 1.2) { p.ang = th; return; }
    const tol = 0.62 + (S.tools.seat ? 0.22 : 0);
    const maxImpact = S.tools.seat ? 1400 : 1050;
    let reason = null;
    if (Math.abs(diff) > tol) reason = Math.abs(diff) > 2.2 ? 'Приземлился на голову!' : 'Кривое приземление';
    else if (p.trick || p.recover > 0) reason = 'Не успел сесть обратно!';
    else if (impact > maxImpact) reason = 'Слишком жёстко!';
    if (reason) { this.crash(reason); return; }
    p.ang = th;
    Sfx.land(clamp(impact / 1000, 0, 1));
    for (let i = 0; i < 14; i++) this.parts.push({ x: p.x + rand(-40, 30), y: p.y + 2, vx: rand(-120, 120) + p.s * 0.2, vy: rand(60, 220), life: 0.8, type: 'snow' });
    this.scoreJump(Math.abs(diff));
  },

  scoreJump(diff) {
    const p = this.p;
    const items = [];
    let pts = 0, kinds = 0;
    const flips = Math.floor((Math.abs(p.rot) + 0.75) / TAU);
    if (flips > 0) {
      const pre = ['', '', 'Двойной ', 'Тройной ', 'Четверной ', 'Безумный '][Math.min(flips, 5)];
      const name = pre + (p.rot > 0 ? 'бэкфлип' : 'фронтфлип');
      const v = 500 * flips * (flips + 1) / 2;
      items.push([name, v]); pts += v; kinds++;
      this.run.flips += flips; S.stats.flips += flips;
      App.ach('first_flip');
      if (flips >= 2) App.ach('double');
      if (flips >= 3) App.ach('triple');
    }
    for (const k in p.tricks) {
      const t = p.tricks[k];
      if (t < 0.25) continue;
      const v = Math.round(100 + TRICKS[k].rate * t);
      items.push([`${TRICKS[k].name} ${t.toFixed(1)}с`, v]); pts += v; kinds++;
    }
    if (p.air > 0.7) { const v = Math.round(p.air * 120); items.push([`Полёт ${p.air.toFixed(1)} с`, v]); pts += v; }
    const d = Math.abs(p.x - p.takeX);
    if (d > 200) { const v = Math.round((d - 200) * 0.8); items.push([`Дальность ${(d / UNITS_PER_M).toFixed(1)} м`, v]); pts += v; }
    if (p.sigBonus && S.mods.turn) { items.push(['Показал поворотник 😇', 100]); pts += 100; App.ach('signal'); }
    if (diff < 0.12 && pts > 0) { const v = Math.round(pts * 0.15); items.push(['Чистое приземление', v]); pts += v; }
    const mult = Math.max(1, kinds);
    const total = Math.round(pts * mult);
    if (p.air >= 2) App.ach('big_air');
    if (d / UNITS_PER_M >= 20) App.ach('long_jump');
    if (kinds >= 3) App.ach('combo3');
    S.stats.bestAir = Math.max(S.stats.bestAir, p.air);
    S.stats.bestDist = Math.max(S.stats.bestDist, d / UNITS_PER_M);
    if (total > 0) {
      this.run.score += total; this.run.jumps++;
      this.run.bestJump = Math.max(this.run.bestJump, total);
      this.run.list.push(...items.map(i => i[0]));
      items.forEach((it, i) => setTimeout(() => this.popup(`${it[0]} +${it[1]}`, '#fff'), i * 140));
      setTimeout(() => this.popup(mult > 1 ? `КОМБО ×${mult} = ${total}` : `+${total}`, mult > 1 ? '#ffd740' : '#69f0ae', true), items.length * 140);
      Sfx.coin();
    }
  },

  crash(reason) {
    const p = this.p;
    p.crashed = true; p.crashT = 0; p.trick = null;
    p.rider = { x: p.x, y: p.y + 30, vx: p.vx * 0.8, vy: Math.abs(p.vy) * 0.3 + 150, a: p.ang, va: rand(-8, 8) };
    p.s = p.vx * 0.3; p.angV = rand(-4, 4);
    S.stats.crashes++;
    if (S.stats.crashes >= 10) App.ach('crash10');
    Sfx.crash();
    for (let i = 0; i < 30; i++) this.parts.push({ x: p.x + rand(-30, 30), y: p.y + 5, vx: rand(-200, 200), vy: rand(100, 300), life: 1, type: 'snow' });
    this.popup('💥 ' + reason, '#ff5252', true);
  },

  popup(text, color, big) { this.popups.push({ text, color, big, t: 0, off: this.popups.filter(p => p.t < 0.3).length }); },

  endRun(crashed) {
    if (this.run.ended) return;
    this.run.ended = true;
    Sfx.setEngine(false); Sfx.stopMusic();
    const r = this.run, p = this.p;
    const distM = Math.max(0, (p.maxX - 1100) / UNITS_PER_M);
    let coins = r.score / 12 + distM * 0.3;
    const mults = [];
    const night = S.settings.night && S.mods.headlight && S.modOn.headlight;
    if (night) { coins *= 1.5; mults.push('🌙 ночь ×1.5'); App.ach('night'); }
    if (S.mods.underglow && S.modOn.underglow) { coins *= 1.1; mults.push('🌈 подсветка ×1.1'); }
    if (S.mods.speaker && S.modOn.speaker) { coins *= 1.1; mults.push('🎵 музыка ×1.1'); }
    coins = Math.max(r.started ? 1 : 0, Math.round(coins));
    S.stats.runs++;
    S.stats.best = Math.max(S.stats.best, r.score);
    if (S.mods.speedo) S.stats.maxSpeed = Math.max(S.stats.maxSpeed, r.maxSpeed);
    App.ach('first_ride');
    App.addCoins(coins);
    Save.save();
    const best = r.score >= S.stats.best && r.score > 0;
    UI.modal(crashed ? 'Упал! 🤕' : 'Заезд окончен 🏁', `
      <div class="summary">
        <div class="big-num">${fmt(r.score)}<small> очков${best ? ' — рекорд! 🏆' : ''}</small></div>
        <div>Прыжков с трюками: <b>${r.jumps}</b> · Сальто: <b>${r.flips}</b></div>
        <div>Дальше всего: <b>${distM.toFixed(0)} м</b>${S.mods.speedo ? ` · Макс. скорость: <b>${r.maxSpeed.toFixed(0)} км/ч</b>` : ''}</div>
        ${mults.length ? `<div class="small">${mults.join(' · ')}</div>` : ''}
        <div class="coins-earned">+${coins} 🪙</div>
      </div>`, [
      { label: '↺ Ещё раз', cls: 'primary', onClick: () => this.restart() },
      { label: '🪏 Стройка', onClick: () => { this.restart(true); this.toggleBuild(); } },
      { label: '🏠 Гараж', onClick: () => App.go('garage') },
    ]);
  },

  // ---------- отрисовка
  w2s(x, y) { return [(x - this.cam.x) * this.cam.z + this.vw * 0.35, this.vh * 0.62 - (y - this.cam.y) * this.cam.z]; },

  render() {
    const ctx = this.ctx, W = this.vw, H = this.vh, z = this.cam.z, d = this.dpr;
    const night = S.settings.night;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.drawBackground(ctx, W, H, night);

    // мир (ось Y вверх)
    ctx.setTransform(d * z, 0, 0, -d * z, d * (W * 0.35 - this.cam.x * z), d * (H * 0.62 + this.cam.y * z));
    const x0 = this.cam.x - (W * 0.35) / z - 50, x1 = this.cam.x + (W * 0.65) / z + 50;
    const yBottom = this.cam.y - (H * 0.4) / z - 50;
    this.drawDecor(ctx, x0, x1, night);
    this.drawTerrain(ctx, x0, x1, yBottom);
    this.drawSledWorld(ctx);
    // частицы
    for (const q of this.parts) {
      if (q.type === 'snow') { ctx.fillStyle = `rgba(255,255,255,${q.life})`; ctx.fillRect(q.x, q.y, 4, 4); }
      else { ctx.fillStyle = q.dark ? `rgba(60,60,70,${q.life * 0.35})` : `rgba(220,220,230,${q.life * 0.35})`; ctx.beginPath(); ctx.arc(q.x, q.y, 6 + (1.5 - q.life) * 8, 0, TAU); ctx.fill(); }
    }
    if (this.mode === 'build') this.drawBuild(ctx, x0, x1);

    // ночь
    if (night) this.drawNight(ctx, W, H);

    // снегопад
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const f of this.flakes) {
      f.y += f.v / H * 0.016; f.x += (Math.sin(this.t + f.s * 10) * 10 - (this.p.s || 0) * 0.02) / W * 0.016;
      if (f.y > 1) { f.y = 0; f.x = Math.random(); }
      f.x = (f.x + 1) % 1;
      ctx.fillRect(f.x * W, f.y * H, f.s, f.s);
    }
    this.drawHUD(ctx, W, H);
  },

  bgHill(x, a, b) { return Math.sin(x * a) * 0.5 + Math.sin(x * b + 1.3) * 0.3 + Math.sin(x * a * 2.7 + 4) * 0.2; },

  drawBackground(ctx, W, H, night) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (night) { g.addColorStop(0, '#030616'); g.addColorStop(1, '#1b2550'); }
    else { g.addColorStop(0, '#6fb1ff'); g.addColorStop(0.7, '#cfe6ff'); g.addColorStop(1, '#eef6ff'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (night) {
      for (const s of this.stars) { ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(this.t * 2 + s.p)})`; ctx.fillRect(s.x * W, s.y * H, s.s, s.s); }
      ctx.fillStyle = '#fffde7'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.15, 28, 0, TAU); ctx.fill();
      ctx.fillStyle = '#030616'; ctx.beginPath(); ctx.arc(W * 0.8 + 12, H * 0.15 - 6, 24, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,250,220,0.9)'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.14, 34, 0, TAU); ctx.fill();
    }
    const horizon = H * 0.62 + this.cam.y * this.cam.z * 0.1;
    // дальние горы
    ctx.fillStyle = night ? '#18204a' : '#b3c7e6';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, horizon - 120 - this.bgHill((x + this.cam.x * 0.05) * 0.004, 1, 2.3) * 80);
    ctx.lineTo(W, H); ctx.fill();
    // ёлки и дома
    ctx.fillStyle = night ? '#121a38' : '#93aed6';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, horizon - 50 - this.bgHill((x + this.cam.x * 0.15) * 0.006, 1, 1.7) * 30);
    ctx.lineTo(W, H); ctx.fill();
    // панельки
    const off = this.cam.x * 0.25;
    for (let i = Math.floor(off / 260) - 1; i < Math.floor((off + W) / 260) + 1; i++) {
      const bx = i * 260 - off, bh = 90 + ((i * 37) % 5) * 18, bw = 110;
      if ((i * 7) % 3 === 0) continue;
      ctx.fillStyle = night ? '#0f1530' : '#a9bcd9';
      ctx.fillRect(bx, horizon - 40 - bh, bw, bh + 40);
      for (let wy = 0; wy < bh / 18 - 1; wy++) for (let wx = 0; wx < 6; wx++) {
        const lit = ((i * 13 + wx * 7 + wy * 3) % 5) < 2;
        ctx.fillStyle = night ? (lit ? '#ffd54f' : '#1a2348') : '#8ea6c9';
        ctx.fillRect(bx + 8 + wx * 17, horizon - 30 - bh + wy * 18, 9, 10);
      }
    }
    // ближние ёлки
    const off2 = this.cam.x * 0.4;
    ctx.fillStyle = night ? '#0b1a1a' : '#5d8a7a';
    for (let i = Math.floor(off2 / 90) - 1; i < Math.floor((off2 + W) / 90) + 1; i++) {
      if ((i * 11) % 4 === 0) continue;
      const tx = i * 90 - off2 + ((i * 29) % 40), th = 50 + ((i * 17) % 4) * 15, ty = horizon - 10;
      ctx.beginPath(); ctx.moveTo(tx, ty - th); ctx.lineTo(tx + th * 0.35, ty); ctx.lineTo(tx - th * 0.35, ty); ctx.fill();
    }
  },

  drawTree(ctx, x, s) {
    const y = this.H(x) - 2;
    ctx.fillStyle = '#4e342e'; ctx.fillRect(x - 4 * s, y, 8 * s, 18 * s);
    for (let i = 0; i < 3; i++) {
      const by = y + 14 * s + i * 22 * s, w = (34 - i * 8) * s;
      ctx.fillStyle = '#1b5e20';
      ctx.beginPath(); ctx.moveTo(x - w, by); ctx.lineTo(x + w, by); ctx.lineTo(x, by + 34 * s); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(x - w * 0.6, by + 10 * s); ctx.lineTo(x + w * 0.5, by + 12 * s); ctx.lineTo(x, by + 34 * s); ctx.fill();
    }
  },

  drawDecor(ctx, x0, x1, night) {
    // ёлки на стартовой горе
    [[20, 1.2], [300, 1], [520, 1.3], [780, 0.9], [980, 1.1]].forEach(([x, s]) => { if (x > x0 - 100 && x < x1 + 100) this.drawTree(ctx, x, s); });
    // флаг старт
    if (x0 < 200) {
      const y = this.H(150);
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(150, y); ctx.lineTo(150, y + 110); ctx.stroke();
      ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.moveTo(150, y + 110); ctx.lineTo(205, y + 98); ctx.lineTo(150, y + 84); ctx.fill();
    }
    // снеговик
    if (x0 < 1300 && x1 > 1150) {
      const x = 1240, y = this.H(x);
      ctx.fillStyle = '#fff';
      [[0, 18, 20], [0, 48, 14], [0, 70, 10]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#ff6d00'; ctx.beginPath(); ctx.moveTo(x + 8, y + 72); ctx.lineTo(x + 22, y + 69); ctx.lineTo(x + 8, y + 67); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(x - 8, y + 80, 16, 10); ctx.fillRect(x - 11, y + 79, 22, 3);
    }
    // забор в конце
    if (x1 > 5700) {
      for (let x = 5760; x < 6000; x += 24) {
        const y = this.H(x);
        ctx.fillStyle = '#6d4c41'; ctx.fillRect(x, y - 5, 12, 70);
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y + 64, 14, 6);
      }
    }
    // метки расстояния
    ctx.save();
    for (let m = 30; m * UNITS_PER_M < this.END_EDIT; m += 10) {
      const wx = m * UNITS_PER_M;
      if (wx < x0 || wx > x1) continue;
      const y = this.H(wx);
      ctx.strokeStyle = night ? '#90a4ae' : '#546e7a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(wx, y); ctx.lineTo(wx, y + 40); ctx.stroke();
      ctx.fillStyle = m % 50 === 0 ? '#e53935' : '#ff7043'; ctx.fillRect(wx, y + 30, 18, 10);
    }
    ctx.restore();
  },

  drawTerrain(ctx, x0, x1, yBottom) {
    const night = S.settings.night;
    const step = this.STEP;
    const a = Math.max(0, Math.floor(x0 / step)), b = Math.min(this.N - 1, Math.ceil(x1 / step));
    const g = ctx.createLinearGradient(0, this.cam.y + 200, 0, yBottom);
    g.addColorStop(0, night ? '#c5d3f0' : '#ffffff'); g.addColorStop(1, night ? '#7d8fc0' : '#cddcf0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a * step, yBottom - 1000);
    for (let i = a; i <= b; i++) ctx.lineTo(i * step, this.h[i]);
    ctx.lineTo(b * step, yBottom - 1000);
    ctx.closePath(); ctx.fill();
    // кромка
    ctx.strokeStyle = night ? '#9fb3e0' : '#b3cde8'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = a; i <= b; i++) ctx.lineTo(i * step, this.h[i] - 4);
    ctx.stroke();
    // лёд
    ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 5;
    ctx.beginPath();
    let open = false;
    for (let i = a; i <= b; i++) {
      if (this.ice[i]) { if (!open) { ctx.moveTo(i * step, this.h[i] + 1); open = true; } else ctx.lineTo(i * step, this.h[i] + 1); }
      else open = false;
    }
    ctx.stroke();
  },

  sledLights() {
    const p = this.p, K = this.K;
    return {
      head: S.mods.headlight && S.modOn.headlight,
      glow: S.mods.underglow && S.modOn.underglow,
      brake: S.mods.stoplight && !!K.brake,
      left: S.mods.turn && !!K.sigL,
      right: S.mods.turn && !!K.sigR,
    };
  },

  drawSledWorld(ctx) {
    const p = this.p;
    const opts = {
      t: this.t, joints: p.joints, mods: S.mods, paint: S.paint, glow: S.glow,
      lights: this.sledLights(), wheelRot: p.wheelRot, throttle: p.gas, engineOn: p.engine,
      noRider: p.crashed, music: Sfx.musicTimer, alarmBlink: false,
    };
    if (this.mode === 'ride' && p.ground && !p.crashed) p.wheelRot += (p.s / 12) * (1 / 60) * (p.gas ? 1.5 : 1) * (S.mods.motor ? 1 : 0);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ang);
    Sled.draw(ctx, opts);
    ctx.restore();
    if (p.crashed && p.rider) {
      const r = p.rider;
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a);
      Sled.drawRider(ctx, Sled.makeJoints('sprawl'), true);
      ctx.restore();
    }
  },

  drawBuild(ctx, x0, x1) {
    // запретные зоны
    ctx.fillStyle = 'rgba(255,0,0,0.08)';
    if (x0 < this.START_EDIT) ctx.fillRect(x0, -200, this.START_EDIT - x0, 1200);
    if (x1 > this.END_EDIT) ctx.fillRect(this.END_EDIT, -200, x1 - this.END_EDIT, 1200);
    // сетка высот
    ctx.strokeStyle = 'rgba(0,60,120,0.12)'; ctx.lineWidth = 1;
    for (let y = 0; y <= 650; y += 50) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    const b = this.brush;
    if (!b.hover && !b.on) return;
    const R = S.tools.shovel2 ? 90 : 60;
    if (['kicker', 'bigkicker', 'landing'].includes(this.tool)) {
      const s = { kicker: [65, 140], bigkicker: [105, 220], landing: [85, 340] }[this.tool];
      ctx.strokeStyle = 'rgba(255,111,0,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.beginPath();
      if (this.tool === 'landing') {
        for (let x = b.wx - 110; x < b.wx; x += 10) ctx.lineTo(x, this.H(x) + s[0] * (0.5 - 0.5 * Math.cos(Math.PI * (x - b.wx + 110) / 110)));
        for (let x = b.wx; x <= b.wx + s[1]; x += 10) ctx.lineTo(x, this.H(x) + s[0] * (0.5 + 0.5 * Math.cos(Math.PI * (x - b.wx) / s[1])));
      } else {
        for (let x = b.wx - s[1]; x <= b.wx; x += 10) ctx.lineTo(x, this.H(x) + s[0] * Math.pow((x - b.wx + s[1]) / s[1], 2));
        ctx.lineTo(b.wx + 30, this.H(b.wx + 30));
      }
      ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = this.tool === 'dig' ? 'rgba(121,85,72,0.9)' : this.tool === 'ice' ? 'rgba(3,169,244,0.9)' : 'rgba(30,136,229,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(b.wx, b.wy, R, R * 0.4, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.wx, this.H(b.wx)); ctx.lineTo(b.wx, b.wy); ctx.stroke();
      // лопата
      ctx.save(); ctx.translate(b.wx + 10, b.wy + 10); ctx.rotate(0.5);
      ctx.fillStyle = '#8d6e63'; ctx.fillRect(-2, 0, 4, 60);
      ctx.fillStyle = '#90a4ae'; roundRect(ctx, -10, -18, 20, 22, 4); ctx.fill();
      ctx.restore();
    }
  },

  drawNight(ctx, W, H) {
    const d = this.dpr, z = this.cam.z, p = this.p;
    const dc = this.dctx;
    dc.setTransform(1, 0, 0, 1, 0, 0);
    dc.globalCompositeOperation = 'source-over';
    dc.clearRect(0, 0, this.dark.width, this.dark.height);
    dc.fillStyle = 'rgba(2,4,16,0.9)';
    dc.fillRect(0, 0, this.dark.width, this.dark.height);
    dc.globalCompositeOperation = 'destination-out';
    dc.setTransform(d, 0, 0, d, 0, 0);
    // лунный свет вокруг
    const [px, py] = this.w2s(p.x, p.y + 40);
    let g = dc.createRadialGradient(px, py, 0, px, py, 140 * z);
    g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    dc.fillStyle = g; dc.beginPath(); dc.arc(px, py, 140 * z, 0, TAU); dc.fill();
    const L = this.sledLights();
    if (L.head && !p.crashed) {
      const c = Math.cos(p.ang), s = Math.sin(p.ang);
      const lx = p.x + 25 * c - 44 * s, ly = p.y + 25 * s + 44 * c;
      const [sx, sy] = this.w2s(lx, ly);
      const ang = -p.ang + 0.12, len = 620 * z;
      g = dc.createRadialGradient(sx, sy, 0, sx, sy, len);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = g;
      dc.beginPath(); dc.moveTo(sx, sy); dc.arc(sx, sy, len, ang - 0.36, ang + 0.36); dc.closePath(); dc.fill();
    }
    // окна домов и фонари — просто подсветим подсветку днища
    if (L.glow) {
      const [gx, gy] = this.w2s(p.x - 10 * Math.cos(p.ang), p.y);
      g = dc.createRadialGradient(gx, gy, 0, gx, gy, 110 * z);
      g.addColorStop(0, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = g; dc.beginPath(); dc.arc(gx, gy, 110 * z, 0, TAU); dc.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.dark, 0, 0);
    // цветной отсвет
    if (L.glow) {
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const [gx, gy] = this.w2s(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 120 * z);
      gg.addColorStop(0, hexA(S.glow, 0.35)); gg.addColorStop(1, hexA(S.glow, 0));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, 120 * z, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  },

  drawHUD(ctx, W, H) {
    const p = this.p;
    ctx.textBaseline = 'alphabetic';
    if (this.mode === 'build') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(ctx, 10, 58, 250, 34, 10); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`Высота: ${Math.max(0, Math.round(this.brush.wy / UNITS_PER_M * 10) / 10)} м  ·  X: ${Math.round(this.brush.wx / UNITS_PER_M)} м`, 20, 80);
      return;
    }
    // очки
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(ctx, 10, 58, 190, 54, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.font = 'bold 22px sans-serif'; ctx.fillText(fmt(this.run.score), 22, 86);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#cfd8dc'; ctx.fillText(`очков · рекорд ${fmt(S.stats.best)}`, 22, 103);
    // текущий прыжок
    if (!p.ground && !p.crashed && p.air > 0.3) {
      const parts = [];
      const fl = Math.abs(p.rot) / TAU;
      if (fl > 0.5) parts.push(`🔄 ${fl.toFixed(1)}`);
      for (const k in p.tricks) if (p.tricks[k] > 0.1) parts.push(`${TRICKS[k].name} ${p.tricks[k].toFixed(1)}`);
      ctx.textAlign = 'center'; ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#ffd740'; ctx.fillText(parts.join('  +  ') || `В воздухе ${p.air.toFixed(1)} с`, W / 2, 90);
    }
    // справа: спидометр, бак
    let ry = 58;
    ctx.textAlign = 'right';
    if (S.mods.speedo) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; roundRect(ctx, W - 140, ry, 130, 44, 8); ctx.fill();
      ctx.fillStyle = '#29b6f6'; ctx.font = 'bold 24px monospace'; ctx.fillText(`${Math.round(p.kmh || 0)}`, W - 62, ry + 32);
      ctx.font = '12px monospace'; ctx.fillText('км/ч', W - 20, ry + 32);
      ry += 52;
    }
    if (S.mods.motor) {
      const cap = S.tools.bigtank ? 1200 : 500;
      const f = (S.tank.fuel + S.tank.oil) / cap;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, W - 140, ry, 130, 40, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`⛽ ${Math.round(S.tank.fuel + S.tank.oil)} мл`, W - 132, ry + 15);
      ctx.fillStyle = '#424242'; ctx.fillRect(W - 132, ry + 22, 114, 8);
      ctx.fillStyle = f < 0.15 ? '#ff5252' : '#ffab00'; ctx.fillRect(W - 132, ry + 22, 114 * clamp(f, 0, 1), 8);
      ctx.textAlign = 'right'; ctx.fillStyle = S.motor.health < 40 ? '#ff5252' : '#b2ff59';
      ctx.fillText(`мотор ${Math.round(S.motor.health)}%`, W - 18, ry + 15);
      ry += 48;
    }
    // всплывашки
    ctx.textAlign = 'center';
    this.popups.forEach((pp, i) => {
      const a = clamp(2.2 - pp.t, 0, 1);
      const y = H * 0.32 - pp.t * 30 + (i % 6) * 26;
      ctx.font = `bold ${pp.big ? 28 : 18}px sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = `rgba(0,0,0,${a * 0.6})`; ctx.strokeText(pp.text, W / 2, y);
      ctx.fillStyle = pp.color; ctx.globalAlpha = a; ctx.fillText(pp.text, W / 2, y); ctx.globalAlpha = 1;
    });
    // подсказка на старте
    if (!this.run.started && this.mode === 'ride') {
      ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(this.t * 4)})`;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4;
      const msg = this.touchUI ? 'Жми «Толчок», чтобы поехать!' : 'Жми ПРОБЕЛ, чтобы оттолкнуться!';
      ctx.strokeText(msg, W / 2, H * 0.22); ctx.fillText(msg, W / 2, H * 0.22);
    }
  },
};
