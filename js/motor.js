'use strict';
// ===== Сборка мотора из бензопилы: этапы-мини-игры =====

function drawSaw(ctx, x, y, s = 1, open = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // шина
  ctx.fillStyle = '#9e9e9e'; roundRect(ctx, 110, -20, 200, 40, 20); ctx.fill();
  ctx.strokeStyle = '#616161'; ctx.lineWidth = 4; roundRect(ctx, 110, -20, 200, 40, 20); ctx.stroke();
  // корпус
  ctx.fillStyle = open ? '#455a64' : '#ef6c00';
  roundRect(ctx, -150, -90, 270, 170, 30); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; roundRect(ctx, -150, 30, 270, 50, 20); ctx.fill();
  // ручка
  ctx.strokeStyle = '#212121'; ctx.lineWidth = 18;
  ctx.beginPath(); ctx.moveTo(-150, -40); ctx.quadraticCurveTo(-230, -40, -230, 20); ctx.lineTo(-150, 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-60, -90); ctx.quadraticCurveTo(-20, -150, 60, -90); ctx.stroke();
  ctx.restore();
}

// ---------- 1. Разборка: болты
class BoltsGame {
  start(api) {
    this.api = api; this.t = 0; this.tool = 'key'; this.hold = null;
    const pos = [[250, 140], [400, 120], [520, 150], [240, 300], [380, 320], [520, 300], [310, 220], [460, 220]];
    const rusty = new Set(); while (rusty.size < 3) rusty.add(randi(0, 7));
    this.bolts = pos.map((p, i) => ({ x: p[0], y: p[1], rusty: rusty.has(i), soak: 0, soaking: false, prog: 0, stripped: false, removed: false, rot: rand(0, 6) }));
    this.drops = [];
    this.msg = 'Зажми болт ключом, чтобы открутить. Рыжие — закисли!';
    this.ui();
  }
  ui() {
    const left = this.bolts.filter(b => !b.removed).length;
    this.api.info(`<div class="mg-sec"><b>🔧 Разборка</b><div class="small">Осталось болтов: <b>${left}</b></div></div>
      <div class="mg-sec small">Ржавый болт сначала <b>побрызгай смазкой</b> и подожди, пока впитается. Иначе сорвёшь грани — и придётся долго высверливать.</div>
      <div class="mg-log"><div>${this.msg}</div></div>`);
    this.api.buttons([
      { label: '🔧 Ключ', active: this.tool === 'key', onClick: () => { this.tool = 'key'; this.ui(); } },
      { label: '🧴 Смазка', active: this.tool === 'wd', onClick: () => { this.tool = 'wd'; this.ui(); } },
    ]);
  }
  boltAt(x, y) { return this.bolts.find(b => !b.removed && dist(x, y, b.x, b.y) < 28); }
  down(x, y) {
    const b = this.boltAt(x, y); if (!b) return;
    if (this.tool === 'wd') {
      if (!b.rusty || b.soak >= 1) { this.msg = 'Этот болт и так нормальный.'; this.ui(); return; }
      b.soaking = true; Sfx.noise(0.5, 0.2, 3000, 'highpass');
      for (let i = 0; i < 10; i++) this.drops.push({ x: b.x + rand(-15, 15), y: b.y - 20, vy: rand(20, 60), life: 1 });
      this.msg = 'Пшшш… Ждём, пока впитается.'; this.ui();
    } else this.hold = b;
  }
  up() { this.hold = null; }
  update(dt) {
    this.t += dt;
    for (const b of this.bolts) if (b.soaking && b.soak < 1) { b.soak = Math.min(1, b.soak + dt / 2.5); if (b.soak >= 1) { this.msg = 'Смазка впиталась — можно крутить.'; this.ui(); } }
    const b = this.hold;
    if (b && !b.removed) {
      const speed = b.stripped ? 1 / 5 : 1 / 1.1;
      b.prog += dt * speed;
      b.rot += dt * (b.stripped ? 20 : 4);
      if (Math.random() < dt * 8) b.stripped ? Sfx.noise(0.08, 0.15, 2500, 'bandpass') : Sfx.ratchet();
      if (b.rusty && b.soak < 1 && !b.stripped && b.prog > 0.35) {
        b.stripped = true; b.prog = 0; this.hold = null;
        Sfx.error(); this.msg = '😱 Сорвал грани! Теперь только высверливать (зажми и жди).'; this.ui();
      }
      if (b.prog >= 1) {
        b.removed = true; this.hold = null; Sfx.tone(600, 0.1, 'triangle', 0.15); Sfx.tone(400, 0.15, 'triangle', 0.1, 0, 0.12);
        this.msg = b.stripped ? 'Высверлил. Фух.' : 'Болт откручен!';
        this.ui();
        if (this.bolts.every(b => b.removed)) Motor.complete('Крышка снята! Внутри… опилки и мышиное гнездо.');
      }
    }
    for (const d of this.drops) { d.y += d.vy * dt; d.life -= dt; }
    this.drops = this.drops.filter(d => d.life > 0);
  }
  draw(ctx) {
    ctx.fillStyle = '#3e2723'; ctx.fillRect(0, 0, 800, 450);
    drawSaw(ctx, 380, 230, 1);
    for (const b of this.bolts) {
      if (b.removed) { ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, TAU); ctx.fill(); continue; }
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      ctx.fillStyle = b.rusty && b.soak < 1 ? (b.soak > 0 ? '#a1887f' : '#8d4a1f') : '#b0bec5';
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = b.stripped ? '#5d4037' : '#78909c'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
      if (b.stripped) { ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke(); }
      ctx.restore();
      if (b.prog > 0) {
        ctx.strokeStyle = b.stripped ? '#ff7043' : '#69f0ae'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(b.x, b.y, 25, -Math.PI / 2, -Math.PI / 2 + TAU * b.prog); ctx.stroke();
      }
      if (b.soaking && b.soak < 1) {
        ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * b.soak); ctx.stroke();
      }
    }
    ctx.fillStyle = '#4fc3f7'; for (const d of this.drops) ctx.fillRect(d.x, d.y, 3, 6);
  }
}

// ---------- 2. Чистка карбюратора
class CleanGame {
  start(api) {
    this.api = api; this.t = 0; this.held = false; this.mx = 0; this.my = 0;
    this.gw = 40; this.gh = 22; this.grid = [];
    for (let i = 0; i < this.gw * this.gh; i++) this.grid.push(rand(0.6, 1));
    this.jet = { x: 400, y: 225, clicks: 0, timer: 0, done: false };
    this.api.buttons([]);
    this.ui();
  }
  clean() { let s = 0; for (const v of this.grid) s += v; return 1 - s / this.grid.length; }
  ui() {
    const c = Math.round(this.clean() * 100);
    this.api.info(`<div class="mg-sec"><b>🧽 Чистка карбюратора</b></div>
      <div class="mg-sec">Чистота: <b>${c}%</b> (нужно 95%)<div class="bar"><i style="width:${c}%"></i></div></div>
      <div class="mg-sec small">Води пальцем/мышкой с зажатой кнопкой — оттираешь нагар очистителем.</div>
      <div class="mg-sec small">${this.clean() > 0.6 ? (this.jet.done ? '✅ Жиклёр продут!' : '👉 Появился жиклёр в центре! <b>Быстро тыкни по нему 5 раз</b>, чтобы продуть.') : 'Где-то под грязью есть жиклёр…'}</div>`);
  }
  down(x, y) {
    this.held = true; this.mx = x; this.my = y;
    if (this.clean() > 0.6 && !this.jet.done && dist(x, y, this.jet.x, this.jet.y) < 30) {
      this.jet.clicks++; this.jet.timer = 1.5; Sfx.noise(0.15, 0.3, 2000, 'bandpass');
      if (this.jet.clicks >= 5) { this.jet.done = true; Sfx.success(); this.ui(); this.check(); }
    }
  }
  move(x, y) { this.mx = x; this.my = y; }
  up() { this.held = false; }
  check() { if (this.clean() >= 0.95 && this.jet.done) Motor.complete('Карбюратор блестит как новый!'); }
  update(dt) {
    this.t += dt;
    if (this.jet.timer > 0) { this.jet.timer -= dt; if (this.jet.timer <= 0 && !this.jet.done) this.jet.clicks = 0; }
    if (this.held) {
      const cw = 560 / this.gw, ch = 300 / this.gh;
      let changed = false;
      for (let gy = 0; gy < this.gh; gy++) for (let gx = 0; gx < this.gw; gx++) {
        const cx = 120 + gx * cw + cw / 2, cy = 75 + gy * ch + ch / 2;
        const d = dist(cx, cy, this.mx, this.my);
        if (d < 34) { const i = gy * this.gw + gx; if (this.grid[i] > 0) { this.grid[i] = Math.max(0, this.grid[i] - dt * 2.2 * (1 - d / 40)); changed = true; } }
      }
      if (changed && Math.random() < dt * 10) Sfx.noise(0.05, 0.05, 5000, 'highpass');
      if (changed && Math.floor(this.t * 6) !== Math.floor((this.t - dt) * 6)) { this.ui(); this.check(); }
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#263238'; ctx.fillRect(0, 0, 800, 450);
    // карбюратор
    ctx.fillStyle = '#cfd8dc'; roundRect(ctx, 120, 75, 560, 300, 40); ctx.fill();
    ctx.fillStyle = '#b0bec5'; ctx.beginPath(); ctx.arc(400, 225, 90, 0, TAU); ctx.fill();
    ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.arc(400, 225, 55, 0, TAU); ctx.fill();
    ctx.fillStyle = '#eceff1'; [[200, 130], [600, 130], [200, 320], [600, 320]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); });
    if (this.clean() > 0.6) {
      ctx.fillStyle = this.jet.done ? '#212121' : '#4e342e';
      ctx.beginPath(); ctx.arc(this.jet.x, this.jet.y, 12, 0, TAU); ctx.fill();
      if (!this.jet.done) { ctx.strokeStyle = `rgba(255,235,59,${0.5 + 0.5 * Math.sin(this.t * 8)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.jet.x, this.jet.y, 24, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${this.jet.clicks}/5`, this.jet.x, this.jet.y - 32); }
    }
    // грязь
    const cw = 560 / this.gw, ch = 300 / this.gh;
    for (let gy = 0; gy < this.gh; gy++) for (let gx = 0; gx < this.gw; gx++) {
      const v = this.grid[gy * this.gw + gx];
      if (v <= 0.02) continue;
      ctx.fillStyle = `rgba(${50 + gx % 3 * 8},${35 + gy % 2 * 6},20,${v * 0.95})`;
      ctx.fillRect(120 + gx * cw, 75 + gy * ch, cw + 0.5, ch + 0.5);
    }
    if (this.held) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(this.mx, this.my, 34, 0, TAU); ctx.fill(); }
  }
}

// ---------- 3. Замена деталей + зазор свечи
class PartsGame {
  start(api) {
    this.api = api; this.t = 0; this.drag = null; this.phase = 'place'; this.gap = 0.8;
    this.slots = [
      { id: 'plug', x: 250, y: 110, label: 'свеча', shape: 'plug' },
      { id: 'hose', x: 240, y: 300, label: 'шланг', shape: 'hose' },
      { id: 'mem', x: 420, y: 230, label: 'мембрана', shape: 'mem' },
    ];
    const tray = [['plug', 'plug'], ['hose', 'hose'], ['mem', 'mem'], ['bolt', 'bolt'], ['spring', 'spring'], ['washer', 'washer']];
    tray.sort(() => Math.random() - 0.5);
    this.parts = tray.map(([id, shape], i) => ({ id, shape, hx: 640 + (i % 2) * 90, hy: 80 + Math.floor(i / 2) * 110, x: 0, y: 0, placed: false }));
    this.parts.forEach(p => { p.x = p.hx; p.y = p.hy; });
    this.msg = 'Перетащи новые детали на свои места. Лишние детали… останутся лишними.';
    this.ui();
  }
  ui() {
    if (this.phase === 'gap') {
      this.api.info(`<div class="mg-sec"><b>⚡ Зазор свечи</b></div><div class="mg-sec">Зазор: <b style="font-size:22px">${this.gap.toFixed(2)} мм</b></div>
        <div class="mg-sec small">В инструкции к пиле: <i>«зазор свечи 0.5 мм»</i>. Подгибай электрод.</div>`);
      this.api.buttons([
        { label: '− 0.05', onClick: () => { this.gap = Math.max(0.2, this.gap - 0.05); Sfx.ratchet(); this.ui(); } },
        { label: '+ 0.05', onClick: () => { this.gap = Math.min(1.2, this.gap + 0.05); Sfx.ratchet(); this.ui(); } },
        { label: '✅ Вкрутить свечу', cls: 'primary', onClick: () => {
          if (Math.abs(this.gap - 0.5) < 0.026) Motor.complete('Свеча, шланг и мембраны на месте!');
          else { Sfx.error(); this.msg = this.gap > 0.5 ? 'Искра слабая — слишком большой зазор.' : 'Искры почти нет — зазор маленький.'; UI.toast(this.msg, 'bad'); }
        } },
      ]);
      return;
    }
    this.api.info(`<div class="mg-sec"><b>🧩 Замена деталей</b></div><div class="mg-log"><div>${this.msg}</div></div>`);
    this.api.buttons([]);
  }
  down(x, y) {
    if (this.phase !== 'place') return;
    this.drag = this.parts.find(p => !p.placed && dist(x, y, p.x, p.y) < 40) || null;
    if (this.drag) { this.ox = this.drag.x - x; this.oy = this.drag.y - y; }
  }
  move(x, y) { if (this.drag) { this.drag.x = x + this.ox; this.drag.y = y + this.oy; } }
  up() {
    const p = this.drag; this.drag = null; if (!p) return;
    const slot = this.slots.find(s => dist(p.x, p.y, s.x, s.y) < 55);
    if (slot && slot.id === p.id) {
      p.placed = true; p.x = slot.x; p.y = slot.y; Sfx.tone(500, 0.08, 'triangle', 0.15);
      this.msg = 'Встало как родное!';
      if (this.slots.every(s => this.parts.find(q => q.id === s.id).placed)) { this.phase = 'gap'; Sfx.success(); }
    } else {
      if (slot) { Sfx.error(); this.msg = 'Не подходит!'; }
      else if (['bolt', 'spring', 'washer'].includes(p.id) && p.x < 600) { this.msg = 'Это лишняя деталь… Откуда она вообще?'; }
      p.x = p.hx; p.y = p.hy;
    }
    this.ui();
  }
  shape(ctx, s, x, y, ghost) {
    ctx.save(); ctx.translate(x, y);
    ctx.globalAlpha = ghost ? 0.3 : 1;
    ctx.fillStyle = ghost ? '#000' : null;
    if (s === 'plug') {
      if (!ghost) ctx.fillStyle = '#eceff1'; ctx.fillRect(-10, -35, 20, 40);
      if (!ghost) ctx.fillStyle = '#90a4ae'; ctx.fillRect(-14, 0, 28, 14); ctx.fillRect(-6, 14, 12, 18);
    } else if (s === 'hose') {
      ctx.strokeStyle = ghost ? '#000' : '#ffb300'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(-35, -10); ctx.bezierCurveTo(-10, 30, 10, -30, 35, 10); ctx.stroke();
    } else if (s === 'mem') {
      if (!ghost) ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.ellipse(0, 0, 32, 22, 0, 0, TAU); ctx.fill();
      if (!ghost) { ctx.fillStyle = '#424242'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); }
    } else if (s === 'bolt') {
      ctx.fillStyle = '#9e9e9e'; ctx.fillRect(-5, -20, 10, 40); ctx.fillRect(-12, -26, 24, 8);
    } else if (s === 'spring') {
      ctx.strokeStyle = '#bdbdbd'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= 40; i++) ctx.lineTo(Math.sin(i * 1.2) * 10, -20 + i);
      ctx.stroke();
    } else if (s === 'washer') {
      ctx.strokeStyle = '#bdbdbd'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  update(dt) { this.t += dt; }
  draw(ctx) {
    ctx.fillStyle = '#37474f'; ctx.fillRect(0, 0, 800, 450);
    drawSaw(ctx, 300, 240, 0.95, true);
    ctx.fillStyle = '#263238'; roundRect(ctx, 600, 30, 190, 390, 14); ctx.fill();
    ctx.fillStyle = '#90a4ae'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Коробка с деталями', 695, 52);
    for (const s of this.slots) {
      const p = this.parts.find(q => q.id === s.id);
      if (!p.placed) {
        this.shape(ctx, s.shape, s.x, s.y, true);
        ctx.strokeStyle = `rgba(255,235,59,${0.4 + 0.3 * Math.sin(this.t * 4)})`; ctx.setLineDash([6, 5]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 48, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    for (const p of this.parts) if (p !== this.drag) this.shape(ctx, p.shape, p.x, p.y, false);
    if (this.drag) this.shape(ctx, this.drag.shape, this.drag.x, this.drag.y, false);
    if (this.phase === 'gap') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, 800, 450);
      ctx.save(); ctx.translate(400, 230);
      ctx.fillStyle = '#eceff1'; ctx.fillRect(-30, -200, 60, 120);
      ctx.fillStyle = '#90a4ae'; ctx.fillRect(-40, -80, 80, 70);
      ctx.fillStyle = '#bdbdbd'; ctx.fillRect(-8, -10, 16, 50);
      const g = this.gap * 120;
      ctx.fillStyle = '#9e9e9e'; ctx.fillRect(-40, 40 + g, 60, 14); ctx.fillRect(-40, -10, 14, 64 + g);
      if (Math.abs(this.gap - 0.5) < 0.026 && Math.sin(this.t * 20) > 0) { ctx.strokeStyle = '#80d8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(4, 40 + g / 2); ctx.lineTo(-3, 40 + g); ctx.stroke(); }
      ctx.restore();
    }
  }
}

// ---------- 4. Токарный станок: тайминг
class LatheGame {
  start(api) {
    this.api = api; this.t = 0; this.pos = 0; this.dir = 1; this.speed = 0.7;
    this.zone = 0.22; this.zc = rand(0.3, 0.7); this.hits = 0; this.miss = 0; this.need = 6; this.flash = 0; this.sparks = []; this.over = false;
    this.ui();
  }
  ui() {
    this.api.info(`<div class="mg-sec"><b>⚙️ Вал и звёздочка</b></div>
      <div class="mg-sec">Проходов: <b>${this.hits}/${this.need}</b><br>Промахи: <b style="color:${this.miss ? '#ff5252' : '#fff'}">${this.miss}/3</b></div>
      <div class="mg-sec small">Жми <b>«Резец!»</b> (или пробел), когда бегунок в зелёной зоне. Каждый проход точнее и быстрее. 3 промаха — заготовка в брак!</div>`);
    this.api.buttons([{ label: '🔪 Резец!', cls: 'primary', onClick: () => this.cut() }]);
  }
  key(code) { if (code === 'Space' || code === 'Enter') this.cut(); }
  down(x, y) { if (y > 330) this.cut(); }
  cut() {
    if (this.over) return;
    if (Math.abs(this.pos - this.zc) <= this.zone / 2) {
      this.hits++; this.flash = 0.3; Sfx.noise(0.25, 0.3, 3000, 'bandpass');
      for (let i = 0; i < 25; i++) this.sparks.push({ x: 400, y: 190, vx: rand(-200, 200), vy: rand(-250, -50), life: rand(0.3, 0.8) });
      this.zone *= 0.84; this.speed *= 1.15; this.zc = rand(0.15, 0.85);
      if (this.hits >= this.need) { this.over = true; setTimeout(() => Motor.complete('Звёздочка выточена и насажена на вал!'), 600); }
    } else {
      this.miss++; Sfx.error(); this.flash = -0.3;
      if (this.miss >= 3) {
        this.over = true;
        S.inv.sprocket = Math.max(0, (S.inv.sprocket || 0) - 1); Save.save();
        setTimeout(() => { UI.modal('Брак! 💢', 'Резец сорвался и запорол заготовку.<br>Звёздочку придётся купить заново.'); MG.close(false); }, 500);
      }
    }
    this.ui();
  }
  update(dt) {
    this.t += dt;
    if (!this.over) {
      this.pos += this.dir * this.speed * dt;
      if (this.pos > 1) { this.pos = 1; this.dir = -1; } if (this.pos < 0) { this.pos = 0; this.dir = 1; }
    }
    this.flash = this.flash > 0 ? Math.max(0, this.flash - dt) : Math.min(0, this.flash + dt);
    for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 600 * dt; s.life -= dt; }
    this.sparks = this.sparks.filter(s => s.life > 0);
  }
  draw(ctx) {
    ctx.fillStyle = this.flash < 0 ? '#4a1414' : '#263238'; ctx.fillRect(0, 0, 800, 450);
    // станок
    ctx.fillStyle = '#546e7a'; ctx.fillRect(60, 250, 680, 40);
    ctx.fillStyle = '#37474f'; ctx.fillRect(80, 120, 120, 140);
    ctx.fillStyle = '#78909c'; ctx.fillRect(200, 175, 400, 30);
    // заготовка-звёздочка
    ctx.save(); ctx.translate(400, 190); ctx.rotate(this.t * 25);
    const teeth = Math.min(this.hits * 3, 18);
    ctx.fillStyle = '#b0bec5'; ctx.beginPath();
    for (let i = 0; i < 36; i++) { const a = i * TAU / 36; const r = i % 2 && i / 2 < teeth ? 52 : 62; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#455a64'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
    ctx.restore();
    // резец
    ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.moveTo(470 - (this.flash > 0 ? 8 : 0), 190); ctx.lineTo(540, 175); ctx.lineTo(540, 205); ctx.closePath(); ctx.fill();
    for (const s of this.sparks) { ctx.fillStyle = `rgba(255,200,0,${s.life * 1.5})`; ctx.fillRect(s.x, s.y, 3, 3); }
    // шкала
    const bx = 100, by = 350, bw = 600;
    ctx.fillStyle = '#111'; roundRect(ctx, bx - 6, by - 6, bw + 12, 44, 10); ctx.fill();
    ctx.fillStyle = '#b71c1c'; ctx.fillRect(bx, by, bw, 32);
    ctx.fillStyle = '#00c853'; ctx.fillRect(bx + (this.zc - this.zone / 2) * bw, by, this.zone * bw, 32);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + this.pos * bw - 3, by - 8, 6, 48);
  }
}

// ---------- 5. Сварка рамы: веди по шву
class WeldGame {
  start(api) {
    this.api = api; this.t = 0; this.held = false; this.mx = 0; this.my = 0;
    this.seams = [
      [[150, 150], [300, 140], [450, 160], [620, 150]],
      [[200, 330], [260, 250], [330, 200], [420, 180]],
      [[480, 330], [520, 260], [600, 230], [660, 260], [680, 330]],
    ];
    this.si = 0; this.prog = 0; this.defects = 0; this.cool = 0; this.sparks = []; this.done = [];
    this.build();
    this.ui();
  }
  build() {
    // разбиваем шов на точки через 4px
    const s = this.seams[this.si], pts = [];
    for (let i = 0; i < s.length - 1; i++) {
      const [ax, ay] = s[i], [bx, by] = s[i + 1];
      const n = Math.ceil(dist(ax, ay, bx, by) / 4);
      for (let k = 0; k < n; k++) pts.push([lerp(ax, bx, k / n), lerp(ay, by, k / n)]);
    }
    pts.push(s[s.length - 1]);
    this.pts = pts; this.prog = 0; this.defects = 0;
  }
  ui() {
    this.api.info(`<div class="mg-sec"><b>🔥 Сварка рамы</b></div>
      <div class="mg-sec">Шов: <b>${this.si + 1}/${this.seams.length}</b><div class="bar"><i style="width:${Math.round(this.prog / (this.pts.length - 1) * 100)}%"></i></div></div>
      <div class="mg-sec">Непровары: <b style="color:${this.defects > 2 ? '#ff5252' : '#fff'}">${this.defects}/5</b></div>
      <div class="mg-sec small">Зажми у начала шва (жёлтая точка) и веди электрод по линии. Сойдёшь с линии — непровар. 5 непроваров — шов переваривать.</div>`);
    this.api.buttons([]);
  }
  down(x, y) { this.held = true; this.mx = x; this.my = y; }
  move(x, y) { this.mx = x; this.my = y; }
  up() { this.held = false; }
  update(dt) {
    this.t += dt; this.cool -= dt;
    if (this.held && this.si < this.seams.length) {
      const [px, py] = this.pts[this.prog];
      const d = dist(this.mx, this.my, px, py);
      if (d < 26) {
        // продвигаемся к ближайшей точке впереди
        let best = this.prog;
        for (let i = this.prog; i < Math.min(this.pts.length, this.prog + 12); i++) if (dist(this.mx, this.my, this.pts[i][0], this.pts[i][1]) < 16) best = i;
        if (best > this.prog) { this.prog = best; if (Math.random() < 0.5) Sfx.noise(0.06, 0.12, 3000, 'highpass'); }
        for (let i = 0; i < 2; i++) this.sparks.push({ x: this.mx, y: this.my, vx: rand(-150, 150), vy: rand(-180, 40), life: rand(0.2, 0.5) });
        if (this.prog >= this.pts.length - 1) {
          this.done.push(this.pts); this.si++; Sfx.success();
          if (this.si >= this.seams.length) { this.held = false; Motor.complete('Рама сварена! Петрович одобрительно кивнул.'); return; }
          this.build(); this.held = false;
        }
      } else if (this.prog > 0 && this.cool <= 0) {
        this.defects++; this.cool = 0.5; Sfx.error();
        if (this.defects >= 5) { UI.toast('Шов кривой — срезаем и варим заново', 'bad'); this.build(); }
      }
      if (Math.floor(this.t * 5) !== Math.floor((this.t - dt) * 5)) this.ui();
    }
    for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 500 * dt; s.life -= dt; }
    this.sparks = this.sparks.filter(s => s.life > 0);
  }
  draw(ctx) {
    ctx.fillStyle = '#0b0f0d'; ctx.fillRect(0, 0, 800, 450);
    // заготовки (видны тускло — маска сварщика)
    ctx.strokeStyle = '#2e3b33'; ctx.lineWidth = 18;
    for (const s of this.seams) { ctx.beginPath(); s.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.stroke(); }
    // готовые швы
    ctx.strokeStyle = '#8d8d6e'; ctx.lineWidth = 6;
    for (const pts of this.done) { ctx.beginPath(); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.stroke(); }
    if (this.si < this.seams.length) {
      ctx.setLineDash([5, 7]); ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 2;
      ctx.beginPath(); this.pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.stroke(); ctx.setLineDash([]);
      // текущий шов: горячий
      ctx.lineWidth = 7;
      for (let i = 1; i <= this.prog; i++) {
        const age = (this.prog - i) / 40;
        ctx.strokeStyle = age < 1 ? `rgb(255,${Math.round(120 + age * 80)},${Math.round(age * 100)})` : '#8d8d6e';
        ctx.beginPath(); ctx.moveTo(this.pts[i - 1][0], this.pts[i - 1][1]); ctx.lineTo(this.pts[i][0], this.pts[i][1]); ctx.stroke();
      }
      const [px, py] = this.pts[this.prog];
      ctx.fillStyle = `rgba(255,235,59,${0.5 + 0.5 * Math.sin(this.t * 10)})`; ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill();
    }
    if (this.held) {
      const g = ctx.createRadialGradient(this.mx, this.my, 0, this.mx, this.my, 70);
      g.addColorStop(0, 'rgba(220,240,255,0.95)'); g.addColorStop(0.15, 'rgba(120,200,255,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.mx, this.my, 70, 0, TAU); ctx.fill();
    }
    for (const s of this.sparks) { ctx.fillStyle = `rgba(255,220,120,${s.life * 2})`; ctx.fillRect(s.x, s.y, 2, 2); }
    ctx.fillStyle = '#4caf50'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('Вид через маску сварщика', 12, 20);
  }
}

// ---------- 6. Колесо и цепь
class ChainGame {
  start(api) {
    this.api = api; this.t = 0; this.tension = 20; this.align = randi(4, 7) * (Math.random() < 0.5 ? -1 : 1); this.spin = 0; this.jump = 0;
    this.ui();
  }
  ok() { return this.tension >= 55 && this.tension <= 70 && this.align === 0; }
  ui() {
    const tStr = this.tension < 55 ? 'провисает' : this.tension > 70 ? 'перетянута' : 'в самый раз';
    this.api.info(`<div class="mg-sec"><b>🛞 Колесо и цепь</b></div>
      <div class="mg-sec">Натяжение: <b>${tStr}</b><div class="bar"><i style="width:${this.tension}%"></i></div></div>
      <div class="mg-sec">Соосность: <b>${this.align === 0 ? 'ровно ✓' : (this.align > 0 ? 'колесо смотрит вправо' : 'колесо смотрит влево')}</b></div>
      <div class="mg-sec small">Цепь должна чуть-чуть провисать (пальцем на 1 см). Колесо — строго в линию со звёздочкой. «Крутануть» — проверить.</div>`);
    this.api.buttons([
      { label: '⬅ Натяжитель', onClick: () => { this.tension = Math.max(0, this.tension - 5); Sfx.ratchet(); this.ui(); } },
      { label: 'Натяжитель ➡', onClick: () => { this.tension = Math.min(100, this.tension + 5); Sfx.ratchet(); this.ui(); } },
      { label: '↺ Ось', onClick: () => { this.align--; Sfx.ratchet(); this.ui(); } },
      { label: 'Ось ↻', onClick: () => { this.align++; Sfx.ratchet(); this.ui(); } },
      { label: '🌀 Крутануть', onClick: () => this.test() },
      { label: '🔩 Затянуть гайки', cls: 'primary', onClick: () => {
        if (this.ok()) Motor.complete('Колесо стоит ровно, цепь натянута!');
        else { Sfx.error(); UI.toast(this.tension > 70 ? 'Перетянул — цепь звенит как струна!' : this.tension < 55 ? 'Цепь слетит на первой кочке!' : 'Колесо кривое — цепь будет слетать', 'bad'); }
      } },
    ]);
  }
  test() {
    this.spin = 2;
    if (this.align !== 0 || this.tension < 55) { this.jump = 1.2; Sfx.noise(0.4, 0.3, 800); setTimeout(() => UI.toast('Цепь спрыгнула! 😬', 'bad'), 500); }
    else if (this.tension > 70) { Sfx.tone(200, 0.4, 'sawtooth', 0.08); setTimeout(() => UI.toast('Туго крутится, скрипит', 'bad'), 400); }
    else { Sfx.noise(0.6, 0.15, 1500, 'bandpass'); setTimeout(() => UI.toast('Крутится ровно и тихо 👌', 'good'), 400); }
  }
  update(dt) { this.t += dt; this.spin = Math.max(0, this.spin - dt); this.jump = Math.max(0, this.jump - dt); }
  draw(ctx) {
    ctx.fillStyle = '#37474f'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#263238'; ctx.fillRect(0, 380, 800, 70);
    const sx = 240, sy = 200, wx = 520 + this.tension * 0.6, wy = 280;
    const rot = this.t * (this.spin > 0 ? 12 : 0);
    // звёздочка мотора
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
    ctx.fillStyle = '#b0bec5'; ctx.beginPath(); for (let i = 0; i < 20; i++) { const a = i * TAU / 20, r = i % 2 ? 26 : 32; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    ctx.restore();
    // колесо (вид сверху-сбоку — наклон показывает соосность)
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(rot);
    ctx.scale(1 - Math.abs(this.align) * 0.05, 1);
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(0, 0, 90, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 3;
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 88, Math.sin(a) * 88); ctx.lineTo(Math.cos(a) * 100, Math.sin(a) * 100); ctx.stroke(); }
    ctx.fillStyle = '#616161'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b0bec5'; ctx.beginPath(); for (let i = 0; i < 30; i++) { const a = i * TAU / 30, r = i % 2 ? 30 : 36; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    ctx.restore();
    // цепь
    const sag = Math.max(0, 60 - this.tension) * 1.4 + 6 + (this.jump > 0 ? Math.sin(this.t * 40) * 25 : 0);
    ctx.strokeStyle = '#757575'; ctx.lineWidth = 6; ctx.setLineDash([6, 3]);
    ctx.beginPath(); ctx.moveTo(sx, sy - 30); ctx.lineTo(wx, wy - 36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx, sy + 30); ctx.quadraticCurveTo((sx + wx) / 2, (sy + wy) / 2 + 36 + sag, wx, wy + 36); ctx.stroke();
    ctx.setLineDash([]);
    // индикатор соосности
    ctx.strokeStyle = this.align === 0 ? '#69f0ae' : '#ff5252'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(wx, 140); ctx.lineTo(wx + this.align * 8, 120); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('соосность', wx, 110);
  }
}

// ---------- 7. Первый запуск: подсос и стартер
class StartGame {
  start(api) {
    this.api = api; this.t = 0; this.choke = false; this.pop = false; this.flooded = false; this.running = false;
    this.handle = { y: 0, drag: false, startY: 0, startT: 0 }; this.dry = 0; this.drying = false; this.pulls = 0; this.smoke = [];
    this.msg = 'Холодный мотор: включи подсос, потом резко дёрни шнур вниз.';
    this.ui();
  }
  ui() {
    this.api.info(`<div class="mg-sec"><b>🔥 Первый запуск</b></div>
      <div class="mg-sec">Подсос: <b>${this.choke ? 'ВКЛ' : 'выкл'}</b> · Рывков: ${this.pulls}</div>
      <div class="mg-sec small">Тяни ручку стартера <b>резко вниз</b>. Как мотор «чихнёт» — выключай подсос. Перестараешься с подсосом — зальёшь свечу.</div>
      <div class="mg-log"><div>${this.msg}</div></div>`);
    const b = [];
    if (this.running) b.push({ label: '✅ Отлично!', cls: 'primary', onClick: () => Motor.complete('ДРРРРРРР! Мотор завёлся! Соседи в восторге (нет).') });
    else {
      b.push({ label: this.choke ? '🟢 Подсос ВКЛ' : '⚪ Подсос выкл', active: this.choke, onClick: () => { this.choke = !this.choke; Sfx.click(); this.ui(); } });
      if (this.flooded) b.push({ label: this.drying ? '⏳ Сушим…' : '🔧 Выкрутить и просушить свечу', disabled: this.drying, onClick: () => { this.drying = true; this.dry = 0; this.ui(); } });
    }
    this.api.buttons(b);
  }
  down(x, y) { if (!this.running && dist(x, y, 200, 180 + this.handle.y) < 50) { this.handle.drag = true; this.handle.startY = y; this.handle.startT = this.t; } }
  move(x, y) { if (this.handle.drag) { this.handle.y = clamp(y - this.handle.startY, 0, 220); if (Math.random() < 0.3) Sfx.ratchet(); } }
  up() {
    if (!this.handle.drag) return;
    this.handle.drag = false;
    const len = this.handle.y, time = this.t - this.handle.startT;
    if (len > 150 && time < 0.6) this.pull(); else if (len > 30) { this.msg = 'Слабо дёрнул! Резче и до конца.'; this.ui(); }
  }
  pull() {
    this.pulls++;
    Sfx.noise(0.3, 0.2, 600);
    // залезть в бак
    S.tank.fuel = Math.max(0, S.tank.fuel - 2);
    if (this.flooded) { this.msg = 'Тишина. Свеча мокрая — залил.'; this.ui(); return; }
    if (this.choke) {
      if (this.pop) {
        if (Math.random() < 0.6) { this.flooded = true; this.pop = false; this.msg = '💧 Залил свечу! Надо было выключить подсос.'; Sfx.error(); }
        else { this.msg = 'Чих-пых… Выключи подсос!'; Sfx.pop(); }
      } else if (Math.random() < 0.35) { this.pop = true; this.msg = '💨 ЧИХ! Схватило! Теперь выключи подсос и дёргай.'; Sfx.pop(); this.puff(); }
      else this.msg = 'Пока не схватывает. Ещё!';
    } else {
      const chance = this.pop ? 0.55 : 0.07;
      if (Math.random() < chance) { this.running = true; this.msg = '🎉 ЗАВЁЛСЯ!'; Sfx.success(); Sfx.setEngine(true, 0.25); this.puff(); this.puff(); }
      else this.msg = this.pop ? 'Почти! Ещё раз!' : 'Не схватывает… На холодную без подсоса тяжело.';
    }
    this.ui();
  }
  puff() { for (let i = 0; i < 12; i++) this.smoke.push({ x: 600, y: 160, vx: rand(20, 80), vy: rand(-60, -20), life: rand(1, 2) }); }
  update(dt) {
    this.t += dt;
    if (!this.handle.drag && this.handle.y > 0) this.handle.y = Math.max(0, this.handle.y - dt * 900);
    if (this.drying) { this.dry += dt / 3; if (this.dry >= 1) { this.drying = false; this.flooded = false; this.choke = false; this.msg = 'Свеча сухая. Подсос выключен. Пробуй.'; this.ui(); } }
    if (this.running) { Sfx.setEngine(true, 0.2 + Math.sin(this.t * 3) * 0.03); if (Math.random() < dt * 8) this.puff(); }
    for (const s of this.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
    this.smoke = this.smoke.filter(s => s.life > 0);
  }
  draw(ctx) {
    ctx.fillStyle = '#455a64'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#37474f'; ctx.fillRect(0, 360, 800, 90);
    const shake = this.running ? Math.sin(this.t * 70) * 2 : 0;
    ctx.save(); ctx.translate(shake, 0);
    drawSaw(ctx, 470, 200, 0.9);
    ctx.restore();
    // шнур и ручка
    const hy = 180 + this.handle.y;
    ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(335, 170); ctx.lineTo(200, hy); ctx.stroke();
    ctx.fillStyle = '#212121'; roundRect(ctx, 165, hy - 12, 70, 24, 10); ctx.fill();
    if (!this.running && this.handle.y === 0) { ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(this.t * 5)})`; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⬇ тяни', 200, 230); }
    for (const s of this.smoke) { ctx.fillStyle = `rgba(200,200,220,${s.life * 0.3})`; ctx.beginPath(); ctx.arc(s.x, s.y, 14 + (2 - s.life) * 10, 0, TAU); ctx.fill(); }
    if (this.drying) { ctx.fillStyle = '#000a'; ctx.fillRect(250, 400, 300, 20); ctx.fillStyle = '#ffb300'; ctx.fillRect(250, 400, 300 * this.dry, 20); }
  }
  exit() { Sfx.setEngine(false); }
}

// ---------- 8. Регулировка карбюратора (винты L и H)
class TuneGame {
  start(api) {
    this.api = api; this.t = 0; this.L = 50; this.H = 50; this.tL = randi(25, 75); this.tH = randi(25, 75);
    this.gas = false; this.rpm = 0.2; this.temp = 0.3; this.good = 0; this.done = false;
    this.ui();
    this.renderSliders();
  }
  renderSliders() {
    const box = document.createElement('div');
    box.className = 'mg-sliders';
    box.innerHTML = `<label>Винт L (холостой) <input type="range" min="0" max="100" value="${this.L}" id="tuneL"></label>
      <label>Винт H (максимал) <input type="range" min="0" max="100" value="${this.H}" id="tuneH"></label>`;
    $('#mg-info').appendChild(box);
    $('#tuneL').oninput = e => { this.L = +e.target.value; Sfx.ratchet(); };
    $('#tuneH').oninput = e => { this.H = +e.target.value; Sfx.ratchet(); };
  }
  ui() {
    this.api.info(`<div class="mg-sec"><b>🎛️ Регулировка карбюратора</b></div>
      <div class="mg-sec small">Крути <b>L</b>, пока холостые не станут ровными (стрелка «Стабильность» в зелёном).<br>Потом зажми <b>«ГАЗ»</b> и крути <b>H</b>: нужны максимальные обороты, но <b>без перегрева</b> (слишком бедная смесь греет мотор).</div>
      <div class="mg-sec small" id="tuneStatus">Держи обе стрелки в зелёном 2 секунды.</div>`);
    this.api.buttons([{ label: '🔥 ГАЗ (держать)', cls: 'primary', hold: on => { this.gas = on; } }]);
  }
  update(dt) {
    this.t += dt;
    const dL = Math.abs(this.L - this.tL), dH = this.H - this.tH;
    this.stab = clamp(100 - dL * 3.5 + Math.sin(this.t * 7) * (dL / 4), 0, 100);
    const target = this.gas ? clamp(1 - Math.abs(dH) / 45, 0.2, 1) : 0.18 + (100 - this.stab) / 400 * Math.sin(this.t * 9);
    this.rpm = lerp(this.rpm, target, dt * 4);
    const lean = this.gas && dH < -6;
    this.temp = clamp(this.temp + (lean ? dt * 0.25 * (-dH / 20) : -dt * 0.15), 0.2, 1);
    Sfx.setEngine(!this.done, this.rpm);
    const ok = this.stab >= 85 && this.gas && this.rpm >= 0.9 && this.temp < 0.7;
    this.good = ok ? this.good + dt : 0;
    if (this.good >= 2 && !this.done) {
      this.done = true; Sfx.setEngine(false);
      S.tank.fuel = Math.max(0, S.tank.fuel - 20);
      Motor.complete('Мотор поёт! Снегокат с мотором готов! 🏁');
    }
    if (this.temp >= 1 && !this.done) {
      this.temp = 0.5; this.H = Math.min(100, this.H + 10); const el = $('#tuneH'); if (el) el.value = this.H;
      Sfx.error(); UI.toast('🔥 Перегрев! Мотор заглох. Смесь слишком бедная — открой H.', 'bad');
    }
    const st = $('#tuneStatus');
    if (st && Math.floor(this.t * 4) !== Math.floor((this.t - dt) * 4)) st.innerHTML = ok ? `Держи… ${(2 - this.good).toFixed(1)} с` : (this.temp > 0.7 ? '🔥 Температура высокая!' : 'Держи обе стрелки в зелёном 2 секунды.');
  }
  gauge(ctx, x, y, label, v, zone, color) {
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(x, y, 80, Math.PI, 0); ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#424242'; ctx.beginPath(); ctx.arc(x, y, 64, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, 64, Math.PI + zone[0] * Math.PI, Math.PI + zone[1] * Math.PI); ctx.stroke();
    const a = Math.PI + clamp(v, 0, 1) * Math.PI;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 70, y + Math.sin(a) * 70); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x, y + 22);
  }
  draw(ctx) {
    ctx.fillStyle = '#263238'; ctx.fillRect(0, 0, 800, 450);
    const shake = Math.sin(this.t * 80) * (1 + this.rpm * 3);
    ctx.save(); ctx.translate(shake, 0); drawSaw(ctx, 420, 140, 0.55); ctx.restore();
    this.gauge(ctx, 150, 380, 'Стабильность', this.stab / 100, [0.85, 1], '#00c853');
    this.gauge(ctx, 400, 380, 'Обороты ×1000', this.rpm, [0.9, 1], '#00c853');
    this.gauge(ctx, 650, 380, 'Температура', this.temp, [0.7, 1], '#d50000');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
    ctx.fillText(Math.round(this.rpm * 13000) + ' об/мин', 400, 300);
  }
  exit() { Sfx.setEngine(false); }
}

const MOTOR_GAMES = { bolts: BoltsGame, clean: CleanGame, parts: PartsGame, lathe: LatheGame, weld: WeldGame, chain: ChainGame, start: StartGame, tune: TuneGame };

const Motor = {
  stage() { return MOTOR_STAGES[S.motor.stage]; },
  missing(st) {
    const out = [];
    for (const k in st.req) if ((S.inv[k] || 0) < st.req[k]) out.push(ITEMS[k].name);
    if (st.fuel && S.tank.fuel < st.fuel) out.push(`смесь в баке ≥ ${st.fuel} мл`);
    return out;
  },
  begin() {
    const st = this.stage();
    if (!st) return;
    const miss = this.missing(st);
    if (miss.length) { UI.toast('Не хватает: ' + miss.join(', '), 'bad'); return; }
    if (st.id === 'buy') { this.completing = false; this.complete('Пила в гараже. Пахнет бензином и приключениями.'); return; }
    this.completing = false;
    MG.open(`Мотор: ${st.name}`, new MOTOR_GAMES[st.id]());
  },
  complete(msg) {
    if (this.completing) return;
    this.completing = true;
    const st = this.stage();
    for (const k in st.req) S.inv[k] = Math.max(0, (S.inv[k] || 0) - st.req[k]);
    S.motor.stage++;
    if (S.motor.stage >= MOTOR_STAGES.length) {
      S.motor.done = true; S.mods.motor = true; S.motor.health = 100;
      App.ach('motor');
    }
    Save.save();
    Sfx.success();
    setTimeout(() => {
      MG.close(false);
      UI.modal(`${st.icon} ${st.name} — готово!`, `<p>${msg}</p>${S.motor.done
        ? '<p><b>Теперь снегокат едет сам!</b> На горке держи <b>W / ↑</b> — газ. Следи за топливом и правильно мешай смесь 1:50.</p>'
        : `<p>Следующий этап: <b>${MOTOR_STAGES[S.motor.stage].name}</b></p>`}`);
    }, 300);
  },
};
