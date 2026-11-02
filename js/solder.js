'use strict';
// ===== Мини-игра «Пайка»: соединяем выводы проводами, паяем точки, включаем =====

// типы компонентов: размеры и выводы (смещения от центра)
const CT = {
  battery: { name: 'Аккумулятор', w: 130, h: 46, pins: { '+': [80, 0], '-': [-80, 0] }, pol: true },
  switch: { name: 'Тумблер', w: 64, h: 44, pins: { '1': [-20, 36], '2': [20, 36] }, closes: ['1', '2'] },
  tact: { name: 'Кнопка', w: 44, h: 44, pins: { '1': [-34, 0], '2': [34, 0] }, closes: ['1', '2'] },
  led: { name: 'Светодиод', w: 34, h: 40, pins: { 'A': [-11, 42], 'K': [11, 38] }, pol: true },
  res: { name: 'Резистор', w: 60, h: 18, pins: { '1': [-46, 0], '2': [46, 0] } },
  strip: { name: 'LED-лента', w: 220, h: 30, pins: { '+': [-124, -12], '-': [-124, 12] }, pol: true },
  buzzer: { name: 'Пищалка', w: 50, h: 50, pins: { '+': [-13, 40], '-': [13, 40] }, pol: true },
  tilt: { name: 'Датчик наклона', w: 54, h: 24, pins: { '1': [-40, 0], '2': [40, 0] }, closes: ['1', '2'] },
  micro: { name: 'Концевик', w: 52, h: 32, pins: { '1': [-17, 30], '2': [17, 30] }, closes: ['1', '2'] },
  mcu: { name: 'Ардуинка', w: 220, h: 70, pins: { VIN: [-90, 48], GND: [-54, 48], '5V': [-18, 48], D2: [18, 48], A4: [54, 48], A5: [90, 48] } },
  oled: { name: 'Дисплей', w: 130, h: 70, pins: { VCC: [-45, 48], GND: [-15, 48], SCL: [15, 48], SDA: [45, 48] } },
  hall: { name: 'Датчик Холла', w: 70, h: 28, pins: { VCC: [-22, 32], GND: [0, 32], OUT: [22, 32] } },
  bt: { name: 'BT-модуль', w: 100, h: 50, pins: { VCC: [-30, 38], GND: [0, 38], OUT: [30, 38] } },
  amp: { name: 'Усилитель', w: 120, h: 56, pins: { VCC: [-42, -41], GND: [-14, -41], IN: [14, -41], 'O+': [-20, 41], 'O-': [20, 41] } },
  spk: { name: 'Динамик', w: 74, h: 74, pins: { '+': [-15, 50], '-': [15, 50] }, pol: true },
};
const PIN_LABEL = {
  battery: { '+': '+', '-': '−' }, led: { A: 'A+', K: 'K−' }, buzzer: { '+': '+', '-': '−' }, strip: { '+': '+', '-': '−' },
  spk: { '+': '+', '-': '−' }, amp: { 'O-': 'O−' },
};
// какая деталь магазина соответствует компоненту (для «сгорело — нужна новая»)
const COMP_ITEM = { battery: 'battery', led: null, buzzer: 'buzzer' };

class SolderGame {
  constructor(p) {
    this.p = p;
    this.comps = p.comps.map(c => ({ ...c, T: CT[c.t], burnt: false }));
    this.wires = [];
    this.joints = {};
    this.tool = 'wire';
    this.pending = null;
    this.mouse = { x: -100, y: -100 };
    this.heating = null;
    this.fx = [];
    this.t = 0;
    this.lit = false;
    this.flags = {};
    this.done = false;
    this.log = [];
    this.station = !!S.tools.station;
    this.colorIdx = 0;
    this.colors = ['#e53935', '#212121', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#00acc1'];
  }

  start(api) {
    this.api = api;
    this.say('Выбери «Провод» и соедини выводы. Потом пропаяй каждую точку паяльником и жми «Включить».');
    this.refresh();
  }

  say(msg, cls = '') {
    this.log.unshift({ msg, cls });
    this.log = this.log.slice(0, 4);
    this.refresh();
  }

  refresh() {
    const p = this.p;
    const html = `
      <div class="mg-sec"><b>${p.icon} ${p.name}</b><div class="small">${p.desc}</div></div>
      <div class="mg-sec"><b>Схема:</b><ol class="hint">${p.hint.map(h => `<li>${h}</li>`).join('')}</ol></div>
      <div class="mg-sec res-row"><span>〽️ Провода: <b>${S.inv.wire || 0}</b></span><span>🧵 Припой: <b>${S.inv.solder || 0}</b></span></div>
      <div class="mg-sec small">${this.tool === 'iron'
        ? '🔥 Зажми точку и отпусти, когда стрелка в <span style="color:#69f0ae">зелёной зоне</span>. Рано — холодная пайка, поздно — перегрев.'
        : this.tool === 'cut' ? '✂️ Нажми на провод, чтобы его убрать.' : '〽️ Нажми на вывод, потом на другой вывод.'}</div>
      <div class="mg-log">${this.log.map(l => `<div class="${l.cls}">${l.msg}</div>`).join('')}</div>`;
    this.api.info(html);
    const btns = [
      { label: '〽️ Провод', active: this.tool === 'wire', onClick: () => { this.tool = 'wire'; this.pending = null; this.refresh(); } },
      { label: '🔥 Паяльник', active: this.tool === 'iron', onClick: () => { this.tool = 'iron'; this.pending = null; this.refresh(); } },
      { label: '✂️ Убрать', active: this.tool === 'cut', onClick: () => { this.tool = 'cut'; this.pending = null; this.refresh(); } },
    ];
    if (S.tools.multimeter) btns.push({ label: '📟 Прозвонить', onClick: () => this.test(true) });
    btns.push({ label: '⚡ Включить', cls: 'primary', onClick: () => this.test(false) });
    if (this.done) {
      this.api.buttons([{ label: '✅ Поставить на снегокат', cls: 'primary', onClick: () => this.install() }]);
    } else this.api.buttons(btns);
  }

  pinPos(key) {
    const [cid, pin] = key.split('.');
    const c = this.comps.find(c => c.id === cid);
    const o = c.T.pins[pin];
    return [c.x + o[0], c.y + o[1]];
  }
  allPins() {
    const out = [];
    for (const c of this.comps) for (const pin in c.T.pins) {
      const o = c.T.pins[pin];
      out.push({ key: c.id + '.' + pin, x: c.x + o[0], y: c.y + o[1], c, pin });
    }
    return out;
  }
  pinAt(x, y, r = 17) {
    let best = null, bd = r;
    for (const p of this.allPins()) {
      const d = dist(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  pinName(key) {
    const [cid, pin] = key.split('.');
    const c = this.comps.find(c => c.id === cid);
    const lab = (PIN_LABEL[c.t] && PIN_LABEL[c.t][pin]) || pin;
    return `${c.label || c.T.name} [${lab}]`;
  }
  wirePath(w) {
    const [ax, ay] = this.pinPos(w.a), [bx, by] = this.pinPos(w.b);
    const mx = (ax + bx) / 2, my = (ay + by) / 2 + Math.min(60, dist(ax, ay, bx, by) * 0.18);
    return [ax, ay, mx, my, bx, by];
  }
  wireAt(x, y) {
    for (const w of this.wires) {
      const [ax, ay, mx, my, bx, by] = this.wirePath(w);
      for (let i = 0; i <= 20; i++) {
        const t = i / 20, u = 1 - t;
        const px = u * u * ax + 2 * u * t * mx + t * t * bx, py = u * u * ay + 2 * u * t * my + t * t * by;
        if (dist(x, y, px, py) < 9) return w;
      }
    }
    return null;
  }
  wiresAt(key) { return this.wires.filter(w => w.a === key || w.b === key); }

  // ---------- ввод
  down(x, y) {
    if (this.done) return;
    this.mouse.x = x; this.mouse.y = y;
    const pin = this.pinAt(x, y);
    if (this.tool === 'wire') {
      if (!pin) { this.pending = null; return; }
      if (this.pending && this.pending !== pin.key) { this.connect(this.pending, pin.key); this.pending = null; }
      else { this.pending = pin.key; this.dragStart = pin.key; Sfx.click(); }
    } else if (this.tool === 'iron') {
      if (!pin) return;
      if (!this.joints[pin.key]) { this.say('Сначала подведи к этому выводу провод.', 'warn'); return; }
      if ((S.inv.solder || 0) <= 0) { this.say('Кончился припой! Купи в магазине.', 'bad'); Sfx.error(); return; }
      S.inv.solder--; Save.dirty();
      const j = this.joints[pin.key];
      const w = this.station ? 0.26 : 0.17;
      const c = rand(0.5, 0.78);
      j.zone = [c - w / 2, c + w / 2];
      j.heat = 0;
      j.state = 'none';
      this.heating = pin.key;
      Sfx.setSizzle(true);
      this.refresh();
    } else if (this.tool === 'cut') {
      const w = this.wireAt(x, y);
      if (w) {
        this.wires.splice(this.wires.indexOf(w), 1);
        S.inv.wire = (S.inv.wire || 0) + 1;
        for (const k of [w.a, w.b]) if (!this.wiresAt(k).length) delete this.joints[k];
          else if (this.joints[k]) this.joints[k].state = 'none';
        Sfx.click();
        this.lit = false;
        this.refresh();
      }
    }
  }
  move(x, y) { this.mouse.x = x; this.mouse.y = y; }
  up(x, y) {
    if (this.tool === 'wire' && this.dragStart) {
      const pin = this.pinAt(x, y);
      if (pin && pin.key !== this.dragStart) { this.connect(this.dragStart, pin.key); this.pending = null; }
      this.dragStart = null;
    }
    if (this.heating) this.finishJoint();
  }

  connect(a, b) {
    if (a.split('.')[0] === b.split('.')[0]) { this.say('Выводы одной детали соединять нельзя — это закоротит её.', 'warn'); return; }
    if (this.wires.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a))) { this.say('Такой провод уже есть.', 'warn'); return; }
    if ((S.inv.wire || 0) <= 0) { this.say('Кончились провода! Купи в магазине.', 'bad'); Sfx.error(); return; }
    S.inv.wire--; Save.dirty();
    this.wires.push({ a, b, color: this.colors[this.colorIdx++ % this.colors.length] });
    for (const k of [a, b]) {
      if (!this.joints[k]) this.joints[k] = { state: 'none', heat: 0 };
      else this.joints[k].state = 'none'; // новый провод — надо перепаять точку
    }
    this.lit = false;
    Sfx.click();
    this.refresh();
  }

  finishJoint() {
    const key = this.heating;
    this.heating = null;
    Sfx.setSizzle(false);
    const j = this.joints[key];
    if (!j) return;
    const [px, py] = this.pinPos(key);
    if (j.heat < j.zone[0]) { j.state = 'cold'; this.say('Холодная пайка — серый комок. Перепаяй!', 'warn'); }
    else if (j.heat <= j.zone[1]) {
      j.state = 'good';
      Sfx.tone(1200, 0.06, 'sine', 0.08);
      for (let i = 0; i < 6; i++) this.fx.push({ x: px, y: py, vx: rand(-20, 20), vy: rand(-60, -20), life: 0.8, type: 'smoke' });
    } else { j.state = 'burnt'; this.say('Перегрел — изоляция поплавилась. Перепаяй!', 'warn'); }
    this.refresh();
  }

  update(dt) {
    this.t += dt;
    if (this.heating) {
      const j = this.joints[this.heating];
      j.heat += dt * (this.station ? 0.55 : 0.62);
      const [px, py] = this.pinPos(this.heating);
      if (Math.random() < 0.5) this.fx.push({ x: px + rand(-4, 4), y: py, vx: rand(-15, 15), vy: rand(-50, -25), life: 1, type: 'smoke' });
      if (j.heat >= 1.05) this.finishJoint();
    }
    for (const f of this.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; if (f.type === 'spark') f.vy += 300 * dt; }
    this.fx = this.fx.filter(f => f.life > 0);
  }

  // ---------- проверка схемы
  analyze() {
    const parent = {};
    const find = k => { while (parent[k] && parent[k] !== k) k = parent[k]; return k; };
    const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    const pins = this.allPins().map(p => p.key);
    const good = k => this.joints[k] && this.joints[k].state === 'good';
    const reset = () => pins.forEach(k => parent[k] = k);
    reset();
    for (const w of this.wires) if (good(w.a) && good(w.b)) uni(w.a, w.b);
    const wiring = {}; pins.forEach(k => wiring[k] = find(k));
    // с замкнутыми выключателями — для поиска КЗ
    for (const c of this.comps) if (c.T.closes) uni(c.id + '.' + c.T.closes[0], c.id + '.' + c.T.closes[1]);
    const power = {}; pins.forEach(k => power[k] = find(k));
    // «полная» проводка без учёта качества пайки (для подсказок)
    reset();
    for (const w of this.wires) uni(w.a, w.b);
    const raw = {}; pins.forEach(k => raw[k] = find(k));
    return { wiring, power, raw };
  }

  matches(part, swap) {
    const m = k => (swap && swap[k]) || k;
    const nets = this.p.nets;
    for (const n of nets) for (let i = 1; i < n.length; i++) if (part[m(n[0])] !== part[m(n[i])]) return false;
    for (let a = 0; a < nets.length; a++) for (let b = a + 1; b < nets.length; b++)
      if (part[m(nets[a][0])] === part[m(nets[b][0])]) return false;
    return true;
  }

  test(dry) {
    if (this.done) return;
    const { wiring, power, raw } = this.analyze();
    const p = this.p;
    const marks = [];
    // 1. КЗ
    const bat = 'bat';
    if (power[bat + '.+'] === power[bat + '.-']) {
      if (dry) { this.say('📟 Пищит прозвонка между + и − ! Это КОРОТКОЕ ЗАМЫКАНИЕ. Не включай!', 'bad'); Sfx.tone(2000, 0.5, 'square', 0.08); return; }
      this.boom('bat');
      this.say('💥 КОРОТКОЕ ЗАМЫКАНИЕ! Аккумулятор вздулся и сгорел.', 'bad');
      App.ach('short');
      this.consumeBurnt('battery');
      return;
    }
    // 2. всё верно?
    if (this.matches(wiring)) {
      if (dry) { this.say('📟 Прозвонка: всё звонится как надо! Можно включать.', 'good'); Sfx.tone(1500, 0.15, 'sine', 0.1); return; }
      this.win();
      return;
    }
    // 3. полярность
    for (const c of this.comps) {
      if (!c.T.pol) continue;
      const ks = Object.keys(c.T.pins);
      const swap = { [c.id + '.' + ks[0]]: c.id + '.' + ks[1], [c.id + '.' + ks[1]]: c.id + '.' + ks[0] };
      if (this.matches(wiring, swap)) {
        this.say(`${dry ? '📟 ' : ''}${c.label || c.T.name}: перепутана полярность! ${c.t === 'led' ? 'Длинная нога (A) — к плюсу.' : c.t === 'battery' ? 'Перепутал + и − аккумулятора.' : 'Плюс к плюсу.'}`, 'warn');
        if (!dry) Sfx.error();
        return;
      }
    }
    // 4. лишние соединения (в т.ч. резистор в обход)
    const nets = p.nets;
    for (let a = 0; a < nets.length; a++) for (let b = a + 1; b < nets.length; b++) {
      if (wiring[nets[a][0]] !== wiring[nets[b][0]]) continue;
      const ra = this.comps.find(c => c.t === 'res' && (nets[a].includes(c.id + '.1') && nets[b].includes(c.id + '.2') || nets[a].includes(c.id + '.2') && nets[b].includes(c.id + '.1')));
      if (ra && !dry) {
        const led = this.comps.find(c => c.t === 'led' && (nets[a].concat(nets[b]).includes(c.id + '.A')));
        if (led) {
          this.boom(led.id);
          this.say(`💥 ${led.label || 'Светодиод'} вспыхнул и сгорел — ток пошёл в обход резистора!`, 'bad');
          const item = { '#ffffff': 'led_w', '#ff1744': 'led_r', '#ff9100': 'led_o' }[led.color] || 'led_r';
          this.consumeBurnt(item);
          return;
        }
      }
      this.say(`${dry ? '📟 ' : ''}Лишнее соединение: ${this.pinName(nets[a][0])} и ${this.pinName(nets[b][0])} не должны быть соединены.`, 'warn');
      marks.push(nets[a][0], nets[b][0]);
      this.marks = { keys: marks, t: 3 };
      if (!dry) Sfx.error();
      return;
    }
    // 5. не хватает соединений
    for (const n of nets) for (let i = 1; i < n.length; i++) {
      if (wiring[n[0]] === wiring[n[i]]) continue;
      if (raw[n[0]] === raw[n[i]]) {
        const bad = this.wires.flatMap(w => [w.a, w.b]).filter(k => this.joints[k] && this.joints[k].state !== 'good');
        this.say(`${dry ? '📟 ' : ''}Нет контакта: провод есть, но не пропаян или плохая пайка.`, 'warn');
        this.marks = { keys: bad, t: 3 };
      } else {
        this.say(`${dry ? '📟 ' : ''}Цепь не замкнута: нужно соединить ${this.pinName(n[0])} и ${this.pinName(n[i])}.`, 'warn');
        this.marks = { keys: [n[0], n[i]], t: 3 };
      }
      if (!dry) Sfx.error();
      return;
    }
  }

  boom(cid) {
    const c = this.comps.find(c => c.id === cid);
    c.burnt = true;
    Sfx.bang();
    for (let i = 0; i < 40; i++) this.fx.push({ x: c.x, y: c.y, vx: rand(-160, 160), vy: rand(-200, 40), life: rand(0.4, 1.2), type: 'spark' });
    for (let i = 0; i < 25; i++) this.fx.push({ x: c.x + rand(-20, 20), y: c.y, vx: rand(-20, 20), vy: rand(-60, -20), life: rand(1, 2.5), type: 'bigsmoke' });
  }
  consumeBurnt(item) {
    S.inv[item] = Math.max(0, (S.inv[item] || 0) - 1);
    Save.dirty();
    const need = this.p.parts[item] || 1;
    if ((S.inv[item] || 0) >= need) {
      setTimeout(() => {
        this.comps.forEach(c => { c.burnt = false; });
        this.say(`Поставил запасной ${ITEMS[item].name.toLowerCase()}. Исправь ошибку!`, '');
      }, 1500);
    } else {
      setTimeout(() => {
        UI.modal('Сгорело 🔥', `Нет запасного: <b>${ITEMS[item].name}</b>.<br>Купи новый в магазине и попробуй снова.`);
        MG.close(false);
      }, 1600);
    }
  }

  win() {
    this.lit = true;
    Sfx.success();
    if (this.p.id === 'horn' || this.p.id === 'alarm') Sfx.hornTone();
    if (this.p.firmware) {
      this.say('Схема ожила! Прошиваем ардуинку… ⏳', 'good');
      this.flash = 0;
      const tick = () => {
        this.flash += 0.1;
        this.say(`Загрузка скетча: ${Math.min(100, Math.round(this.flash * 100))}%`, 'good');
        if (this.flash < 1) setTimeout(tick, 220);
        else { this.say('Прошивка готова! Дисплей показывает 0 км/ч.', 'good'); this.done = true; this.refresh(); }
      };
      setTimeout(tick, 300);
    } else {
      this.say('Работает! 🎉', 'good');
      this.done = true;
      this.refresh();
    }
  }

  install() {
    for (const k in this.p.parts) S.inv[k] = Math.max(0, (S.inv[k] || 0) - this.p.parts[k]);
    S.mods[this.p.id] = true;
    S.modOn[this.p.id] = true;
    S.stats.solders++;
    App.ach('first_solder');
    if (PROJECTS.every(p => S.mods[p.id])) App.ach('all_electro');
    Save.save();
    UI.toast(`${this.p.icon} ${this.p.name} установлено на снегокат!`, 'good');
    MG.close(false);
  }

  // ---------- отрисовка
  draw(ctx) {
    const W = 800, H = 450;
    // стол
    ctx.fillStyle = '#5d4037'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 18; i++) ctx.fillRect(0, i * 26 + (i % 3) * 3, W, 2);
    // термоковрик
    ctx.fillStyle = '#26695c'; roundRect(ctx, 20, 20, W - 40, H - 40, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (let x = 40; x < W - 20; x += 20) { ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, H - 20); ctx.stroke(); }
    for (let y = 40; y < H - 20; y += 20) { ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke(); }

    for (const c of this.comps) this.drawComp(ctx, c);

    // провода
    for (const w of this.wires) {
      const [ax, ay, mx, my, bx, by] = this.wirePath(w);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(ax, ay + 3); ctx.quadraticCurveTo(mx, my + 3, bx, by + 3); ctx.stroke();
      ctx.strokeStyle = w.color; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
    }
    // тянущийся провод
    const from = this.pending || this.dragStart;
    if (this.tool === 'wire' && from) {
      const [ax, ay] = this.pinPos(from);
      ctx.setLineDash([8, 6]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(this.mouse.x, this.mouse.y); ctx.stroke(); ctx.setLineDash([]);
    }
    // выводы и точки пайки
    const hover = this.pinAt(this.mouse.x, this.mouse.y);
    for (const p of this.allPins()) {
      const j = this.joints[p.key];
      ctx.fillStyle = '#b87333';
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3e2723'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, TAU); ctx.fill();
      if (j) {
        if (j.state === 'good') {
          const g = ctx.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, 8);
          g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#cfd8dc'); g.addColorStop(1, '#78909c');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, TAU); ctx.fill();
        } else if (j.state === 'cold') {
          ctx.fillStyle = '#757575'; ctx.beginPath(); ctx.arc(p.x + 1, p.y, 7, 0, TAU); ctx.arc(p.x - 3, p.y - 2, 5, 0, TAU); ctx.fill();
        } else if (j.state === 'burnt') {
          ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, TAU); ctx.fill();
        } else {
          ctx.strokeStyle = '#ffcc80'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      const lab = (PIN_LABEL[p.c.t] && PIN_LABEL[p.c.t][p.pin]) || p.pin;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      const ly = p.y + (p.y >= p.c.y ? 20 : -13);
      ctx.fillText(lab, p.x, ly);
    }
    if (this.marks && this.marks.t > 0) {
      this.marks.t -= 1 / 60;
      for (const k of this.marks.keys) {
        const [x, y] = this.pinPos(k);
        ctx.strokeStyle = `rgba(255,23,68,${0.5 + 0.5 * Math.sin(this.t * 12)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.stroke();
      }
    }
    if (hover && !this.heating) {
      ctx.strokeStyle = '#fff59d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hover.x, hover.y, 13, 0, TAU); ctx.stroke();
      const txt = this.pinName(hover.key);
      ctx.font = '13px sans-serif';
      const tw = ctx.measureText(txt).width + 14;
      const tx = clamp(hover.x - tw / 2, 4, W - tw - 4), ty = hover.y - 42 < 4 ? hover.y + 24 : hover.y - 42;
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; roundRect(ctx, tx, ty, tw, 22, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(txt, tx + 7, ty + 15);
    }

    // эффекты
    for (const f of this.fx) {
      if (f.type === 'spark') { ctx.fillStyle = `rgba(255,${150 + Math.random() * 100 | 0},0,${f.life})`; ctx.fillRect(f.x, f.y, 3, 3); }
      else {
        const big = f.type === 'bigsmoke';
        ctx.fillStyle = big ? `rgba(40,40,40,${f.life * 0.3})` : `rgba(230,230,230,${f.life * 0.35})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, (big ? 18 : 6) + (1 - f.life) * 10, 0, TAU); ctx.fill();
      }
    }

    // паяльник и шкала нагрева
    if (this.tool === 'iron') {
      const { x, y } = this.mouse;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6);
      ctx.fillStyle = this.heating ? '#ff7043' : '#b0bec5'; ctx.fillRect(-2, -38, 4, 38);
      ctx.fillStyle = '#263238'; roundRect(ctx, -7, -110, 14, 74, 5); ctx.fill();
      ctx.fillStyle = '#ffca28'; ctx.fillRect(-7, -60, 14, 4);
      ctx.restore();
    }
    if (this.heating) {
      const j = this.joints[this.heating];
      const [px, py] = this.pinPos(this.heating);
      const bx = clamp(px - 60, 10, W - 130), by = py - 60 < 10 ? py + 30 : py - 60;
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; roundRect(ctx, bx - 4, by - 4, 128, 22, 6); ctx.fill();
      ctx.fillStyle = '#455a64'; ctx.fillRect(bx, by, 120, 14);
      ctx.fillStyle = '#00c853'; ctx.fillRect(bx + j.zone[0] * 120, by, (j.zone[1] - j.zone[0]) * 120, 14);
      ctx.fillStyle = '#d50000'; ctx.fillRect(bx + j.zone[1] * 120, by, (1 - j.zone[1]) * 120, 14);
      ctx.fillStyle = '#fff'; ctx.fillRect(bx + clamp(j.heat, 0, 1) * 120 - 2, by - 3, 4, 20);
    }
    // проверка удачи — свечение
    if (this.lit) {
      for (const c of this.comps) {
        let col = null;
        if (c.t === 'led') col = c.color;
        if (c.t === 'strip') col = `hsl(${(this.t * 120) % 360},100%,60%)`;
        if (c.t === 'oled') col = '#29b6f6';
        if (!col) continue;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.t === 'strip' ? 140 : 60);
        g.addColorStop(0, col.startsWith('#') ? hexA(col, 0.9) : col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.t === 'strip' ? 140 : 60, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
  }

  drawComp(ctx, c) {
    const { x, y } = c, T = c.T;
    ctx.save();
    ctx.translate(x, y);
    // ножки к выводам
    ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 2.5;
    for (const pin in T.pins) {
      const [px, py] = T.pins[pin];
      ctx.beginPath(); ctx.moveTo(clamp(px, -T.w / 2 + 4, T.w / 2 - 4), clamp(py, -T.h / 2 + 4, T.h / 2 - 4)); ctx.lineTo(px, py); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(ctx, -T.w / 2 + 4, -T.h / 2 + 5, T.w, T.h, 8); ctx.fill();
    const lit = this.lit;
    switch (c.t) {
      case 'battery': {
        const g = ctx.createLinearGradient(0, -23, 0, 23);
        g.addColorStop(0, '#42a5f5'); g.addColorStop(0.5, '#1565c0'); g.addColorStop(1, '#0d47a1');
        ctx.fillStyle = g; roundRect(ctx, -65, -23, 130, 46, 10); ctx.fill();
        ctx.fillStyle = '#cfd8dc'; ctx.fillRect(62, -8, 6, 16);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('18650  3.7V', 0, 5);
        ctx.font = 'bold 18px sans-serif'; ctx.fillText('+', 50, 7); ctx.fillText('−', -50, 7);
        break;
      }
      case 'switch':
        ctx.fillStyle = '#263238'; roundRect(ctx, -32, -22, 64, 44, 6); ctx.fill();
        ctx.fillStyle = '#b0bec5'; ctx.beginPath(); ctx.arc(0, -4, 9, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(lit ? 12 : -12, -26); ctx.stroke();
        break;
      case 'tact':
        ctx.fillStyle = '#212121'; roundRect(ctx, -22, -22, 44, 44, 4); ctx.fill();
        ctx.fillStyle = '#9e9e9e'; ctx.fillRect(-22, -22, 4, 4); ctx.fillRect(18, -22, 4, 4); ctx.fillRect(-22, 18, 4, 4); ctx.fillRect(18, 18, 4, 4);
        ctx.fillStyle = '#424242'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
        break;
      case 'led': {
        ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-11, 10); ctx.lineTo(-11, 42); ctx.moveTo(11, 10); ctx.lineTo(11, 38); ctx.stroke();
        ctx.fillStyle = c.burnt ? '#212121' : hexA(c.color === '#ffffff' ? '#e0f7fa' : c.color, lit ? 1 : 0.55);
        ctx.beginPath(); ctx.arc(0, -4, 15, Math.PI, 0); ctx.lineTo(15, 12); ctx.lineTo(-15, 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-8, -10, 4, 12);
        break;
      }
      case 'res':
        ctx.fillStyle = '#d7b98e'; roundRect(ctx, -30, -9, 60, 18, 8); ctx.fill();
        ['#795548', '#212121', '#795548', '#ffd600'].forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(-18 + i * 10, -9, 5, 18); });
        break;
      case 'strip':
        ctx.fillStyle = '#eceff1'; roundRect(ctx, -110, -15, 220, 30, 4); ctx.fill();
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = lit ? `hsl(${(i * 40 + this.t * 200) % 360},100%,60%)` : '#ffe082';
          ctx.fillRect(-96 + i * 23, -7, 12, 14);
        }
        break;
      case 'buzzer':
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.fill();
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', -13, 20);
        break;
      case 'tilt':
        ctx.fillStyle = '#90a4ae'; roundRect(ctx, -27, -12, 54, 24, 10); ctx.fill();
        ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.arc(-8 + Math.sin(this.t * 3) * 6, 0, 6, 0, TAU); ctx.fill();
        break;
      case 'micro':
        ctx.fillStyle = '#212121'; roundRect(ctx, -26, -16, 52, 32, 4); ctx.fill();
        ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, -18); ctx.lineTo(22, -26); ctx.stroke();
        break;
      case 'mcu':
        ctx.fillStyle = '#0d47a1'; roundRect(ctx, -110, -35, 220, 70, 6); ctx.fill();
        ctx.fillStyle = '#212121'; ctx.fillRect(-30, -18, 50, 30);
        ctx.fillStyle = '#cfd8dc'; ctx.fillRect(-108, -12, 22, 22);
        ctx.fillStyle = lit ? '#76ff03' : '#33691e'; ctx.fillRect(70, -25, 8, 6);
        ctx.fillStyle = '#fff'; ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.fillText('NANO', 50, 10);
        break;
      case 'oled':
        ctx.fillStyle = '#1a237e'; roundRect(ctx, -65, -35, 130, 70, 4); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillRect(-55, -28, 110, 50);
        if (lit) { ctx.fillStyle = '#29b6f6'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.fillText(this.done ? '0 км/ч' : '...', 0, 4); }
        break;
      case 'hall':
        ctx.fillStyle = '#004d40'; roundRect(ctx, -35, -14, 70, 28, 3); ctx.fill();
        ctx.fillStyle = '#111'; ctx.fillRect(-8, -8, 16, 12);
        ctx.fillStyle = '#e53935'; ctx.fillRect(22, -10, 8, 8);
        break;
      case 'bt':
        ctx.fillStyle = '#01579b'; roundRect(ctx, -50, -25, 100, 50, 4); ctx.fill();
        ctx.fillStyle = '#cfd8dc'; ctx.fillRect(-40, -15, 40, 22);
        ctx.fillStyle = lit ? '#2979ff' : '#1a237e'; ctx.beginPath(); ctx.arc(30, -10, 4, 0, TAU); ctx.fill();
        break;
      case 'amp':
        ctx.fillStyle = '#b71c1c'; roundRect(ctx, -60, -28, 120, 56, 4); ctx.fill();
        ctx.fillStyle = '#212121'; ctx.fillRect(-14, -10, 28, 20);
        break;
      case 'spk':
        ctx.fillStyle = '#37474f'; ctx.beginPath(); ctx.arc(0, 0, 37, 0, TAU); ctx.fill();
        ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(0, 0, 26 + (lit ? Math.sin(this.t * 30) * 2 : 0), 0, TAU); ctx.fill();
        ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
        break;
    }
    if (c.burnt) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, -T.w / 2, -T.h / 2, T.w, T.h, 8); ctx.fill();
    }
    // подпись
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    const pinsBelow = Object.values(T.pins).some(p => p[1] > T.h / 2);
    ctx.fillText(c.label || T.name, 0, pinsBelow ? -T.h / 2 - 8 : T.h / 2 + 18);
    ctx.restore();
  }

  exit(byUser) {
    if (byUser && !this.done && this.wires.length) UI.toast('Схему бросил. Провода и припой не вернуть 🙃');
  }
}

const Solder = {
  canStart(p) {
    for (const k in p.parts) if ((S.inv[k] || 0) < p.parts[k]) return false;
    return true;
  },
  start(p) {
    if (!this.canStart(p)) { UI.toast('Не хватает деталей!', 'bad'); return; }
    MG.open(`Пайка: ${p.name}`, new SolderGame(p));
  },
};
