'use strict';
// ===== Гараж: тюнинг, электроника, мотор, магазин, достижения =====
const Garage = {
  tab: 'sled', shopCat: 'radio', raf: 0,

  init() {
    $$('#g-tabs [data-tab]').forEach(b => b.onclick = () => { Sfx.click(); this.tab = b.dataset.tab; this.render(); });
    $('#btn-go').onclick = () => { Sfx.click(); App.go('ride'); };
    // делегирование кликов
    $('#g-body').addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      Sfx.click();
      this.act(el.dataset.act, el.dataset.id, el);
    });
  },

  enter(fromRide) {
    this.render();
    if (fromRide) this.theftCheck();
  },

  updateCoins() { const c = $('#g-coins'); if (c) c.textContent = fmt(S.coins); },

  theftCheck() {
    if (S.stats.runs < 3 || Math.random() > 0.12 || S.coins < 150) return;
    setTimeout(() => {
      if (S.mods.alarm) {
        Sfx.alarm(2);
        App.ach('thief');
        UI.modal('🚨 УИУИУИ!', 'Пока ты катался, какой-то тип полез к снегокату. <b>Сигналка заорала</b> — он сбежал, роняя шапку.<br>Сосед дал тебе <b>40 🪙</b> за бдительность.', [{ label: 'Ха!', onClick: () => App.addCoins(40) }]);
      } else {
        const lost = Math.min(250, Math.round(S.coins * 0.15));
        S.coins -= lost; Save.save(); this.updateCoins();
        UI.modal('😱 Обокрали!', `Пока ты катался, кто-то залез в гараж и стащил <b>${lost} 🪙</b> из банки на полке.<br><small>Спаяй сигнализацию — и такого не будет.</small>`, [{ label: 'Эх…' }]);
      }
    }, 400);
  },

  render() {
    this.updateCoins();
    $$('#g-tabs [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === this.tab));
    const body = $('#g-body');
    cancelAnimationFrame(this.raf);
    const fn = { sled: 'renderSled', electro: 'renderElectro', motor: 'renderMotor', shop: 'renderShop', ach: 'renderAch', settings: 'renderSettings' }[this.tab];
    body.innerHTML = this[fn]();
    if (this.tab === 'sled') this.startPreview();
    if (this.tab === 'sled' && (S.mods.motor || S.motor.stage >= 7)) this.bindFuel();
  },

  invCount(id) {
    const it = ITEMS[id];
    if (it.tool) return S.tools[id] ? 'есть' : '';
    const n = S.inv[id] || 0;
    return n ? `${fmt(n)}${it.unit ? ' ' + it.unit : ' шт'}` : '';
  },

  // ---------- вкладка «Снегокат»
  renderSled() {
    const installed = PROJECTS.filter(p => S.mods[p.id]);
    const toggles = installed.filter(p => ['headlight', 'underglow', 'speaker'].includes(p.id)).map(p =>
      `<button class="chip ${S.modOn[p.id] ? 'on' : ''}" data-act="toggle" data-id="${p.id}">${p.icon} ${p.name}: ${S.modOn[p.id] ? 'вкл' : 'выкл'}</button>`).join('');
    const upgrades = Object.keys(ITEMS).filter(k => ITEMS[k].cat === 'upgrade' && ITEMS[k].tool && S.tools[k]).map(k => `<span class="tag">${ITEMS[k].icon} ${ITEMS[k].name}</span>`).join('');
    let fuel = '';
    if (S.mods.motor || S.motor.stage >= 7) {
      const cap = S.tools.bigtank ? 1200 : 500;
      const tot = S.tank.fuel + S.tank.oil;
      const ratio = S.tank.oil > 0 ? Math.round(S.tank.fuel / S.tank.oil) : null;
      fuel = `<div class="card">
        <h3>⛽ Заправка</h3>
        <div class="row"><span>В баке: <b>${Math.round(tot)} / ${cap} мл</b> ${tot > 0 ? `· смесь ${ratio ? '1:' + ratio : 'БЕЗ МАСЛА ⚠️'}` : ''}</span></div>
        <div class="bar"><i style="width:${Math.min(100, tot / cap * 100)}%"></i></div>
        <div class="row small">В канистре: бензин <b>${fmt(S.inv.petrol || 0)} мл</b> · масло 2Т <b>${fmt(S.inv.oil || 0)} мл</b></div>
        <div class="mix">
          <label>Бензин, мл <input type="number" id="mixP" min="0" step="50" value="${Math.min(S.inv.petrol || 0, Math.max(0, Math.round((cap - tot) / 50) * 50))}"></label>
          <label>Масло, мл <input type="number" id="mixO" min="0" step="1" value="0"></label>
          <div id="mixRatio" class="small"></div>
        </div>
        <div class="row">
          <button class="btn primary" data-act="fill">Смешать и залить</button>
          <button class="btn" data-act="drain">Слить бак</button>
          <button class="btn" data-act="manual">📖 Инструкция к пиле</button>
        </div>
        ${S.mods.motor ? `<div class="row">Состояние мотора: <b style="color:${S.motor.health < 40 ? '#ff5252' : '#b2ff59'}">${Math.round(S.motor.health)}%</b>
          ${S.motor.health < 100 ? `<button class="btn small" data-act="repair" ${S.inv.pistonkit ? '' : 'disabled'}>🔩 Перебрать (поршневая: ${S.inv.pistonkit || 0})</button>` : ''}</div>` : ''}
      </div>`;
    }
    return `
      <div class="grid2">
        <div class="card preview-card">
          <canvas id="g-preview" width="640" height="300"></canvas>
          <div class="row wrap">${toggles || '<span class="small muted">Электроника пока не установлена — загляни во вкладку «Электроника».</span>'}</div>
        </div>
        <div>
          <div class="card">
            <h3>🎨 Покраска рамы</h3>
            <div class="swatches">${PAINTS.map(c => `<button class="sw ${S.paint === c ? 'sel' : ''}" style="background:${c}" data-act="paint" data-id="${c}"></button>`).join('')}</div>
            ${S.mods.underglow ? `<h3>🌈 Цвет подсветки</h3><div class="swatches">${GLOWS.map(c => `<button class="sw glow ${S.glow === c ? 'sel' : ''}" style="background:${c};box-shadow:0 0 12px ${c}" data-act="glow" data-id="${c}"></button>`).join('')}</div>` : ''}
            ${S.mods.alarm ? `<div class="row"><button class="btn" data-act="testalarm">🚨 Проверить сигналку</button></div>` : ''}
            ${S.mods.horn ? `<div class="row"><button class="btn" data-act="testhorn">📯 Бибикнуть</button></div>` : ''}
          </div>
          <div class="card">
            <h3>🛠️ Установлено</h3>
            <div class="row wrap">${installed.map(p => `<span class="tag">${p.icon} ${p.name}</span>`).join('')}${S.mods.motor ? '<span class="tag hot">🔥 Мотор от бензопилы</span>' : ''}${upgrades}
            ${!installed.length && !upgrades && !S.mods.motor ? '<span class="small muted">Пока стоковый снегокат</span>' : ''}</div>
          </div>
          ${fuel}
        </div>
      </div>`;
  },

  bindFuel() {
    const upd = () => {
      const p = +$('#mixP').value || 0, o = +$('#mixO').value || 0;
      $('#mixRatio').textContent = p > 0 ? (o > 0 ? `Получится смесь 1:${Math.round(p / o)}` : 'Без масла! Мотор такое не любит.') : '';
    };
    $('#mixP').oninput = upd; $('#mixO').oninput = upd; upd();
  },

  startPreview() {
    const cv = $('#g-preview'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const joints = Sled.makeJoints('sit');
    let t = 0, last = performance.now();
    const loop = now => {
      if (!$('#g-preview') || App.screen !== 'garage' || this.tab !== 'sled') return;
      t += (now - last) / 1000; last = now;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, 300);
      g.addColorStop(0, '#2b3242'); g.addColorStop(1, '#151a24');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 640, 300);
      // полки на стене
      ctx.fillStyle = '#3b4356'; ctx.fillRect(30, 60, 160, 8); ctx.fillRect(450, 80, 160, 8);
      ctx.font = '26px serif'; ctx.fillText('🔋🧰', 50, 56); ctx.fillText('🛢️🪚', 480, 76);
      ctx.fillStyle = '#1e2330'; ctx.fillRect(0, 250, 640, 50);
      // лампа
      const lg = ctx.createRadialGradient(320, 0, 10, 320, 0, 260);
      lg.addColorStop(0, 'rgba(255,240,200,0.25)'); lg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, 640, 300);
      ctx.setTransform(2.4, 0, 0, -2.4, 340, 250);
      Sled.draw(ctx, {
        t, joints, mods: S.mods, paint: S.paint, glow: S.glow, engineOn: false, music: false,
        lights: { head: S.mods.headlight && S.modOn.headlight, glow: S.mods.underglow && S.modOn.underglow, left: S.mods.turn && Math.sin(t * 0.8) > 0.5, right: S.mods.turn && Math.sin(t * 0.8) < -0.5, brake: S.mods.stoplight && Math.sin(t * 0.5) > 0.7 },
        alarmBlink: true, noRider: true,
      });
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  // ---------- вкладка «Электроника»
  renderElectro() {
    const tools = `<div class="card small">🔥 Паяльник: <b>${S.tools.station ? 'паяльная станция' : 'дедовский 40 Вт'}</b> · 🧵 Припой: <b>${S.inv.solder || 0}</b> точек · 〽️ Провода: <b>${S.inv.wire || 0}</b> · 📟 Мультиметр: <b>${S.tools.multimeter ? 'есть' : 'нет'}</b></div>`;
    return tools + `<div class="cards">` + PROJECTS.map(p => {
      const done = S.mods[p.id];
      const parts = Object.entries(p.parts).map(([k, n]) => {
        const have = S.inv[k] || 0;
        return `<span class="part ${have >= n ? 'ok' : 'no'}">${ITEMS[k].icon} ${ITEMS[k].name}${n > 1 ? ' ×' + n : ''} <small>(${have})</small></span>`;
      }).join('');
      const wiresNeed = p.nets.reduce((a, n) => a + n.length - 1, 0);
      const can = Solder.canStart(p);
      const missing = Object.entries(p.parts).filter(([k, n]) => (S.inv[k] || 0) < n);
      const cost = missing.reduce((a, [k, n]) => a + Math.ceil((n - (S.inv[k] || 0))) * ITEMS[k].price, 0);
      return `<div class="card proj ${done ? 'done' : ''}">
        <h3>${p.icon} ${p.name} <span class="diff">${'🔧'.repeat(p.diff)}</span></h3>
        <div class="small">${p.desc}</div>
        <div class="small eff">✨ ${p.effect}</div>
        ${done ? '<div class="badge">✅ Установлено</div>' : `
        <div class="parts">${parts}</div>
        <div class="small muted">Нужно ~${wiresNeed} проводов и ~${wiresNeed * 2} точек пайки</div>
        <div class="row">
          <button class="btn primary" data-act="solder" data-id="${p.id}" ${can ? '' : 'disabled'}>🔥 Паять</button>
          ${!can ? `<button class="btn" data-act="buykit" data-id="${p.id}" ${S.coins >= cost ? '' : 'disabled'}>🛒 Докупить детали (${cost} 🪙)</button>` : ''}
        </div>`}
      </div>`;
    }).join('') + `</div>`;
  },

  // ---------- вкладка «Мотор»
  renderMotor() {
    if (S.motor.done) {
      return `<div class="card hero"><h2>🔥 Мотор готов!</h2>
        <p>Бывшая бензопила теперь толкает снегокат. Держи <b>W / ↑</b> на горке. Можно заезжать обратно наверх!</p>
        <p>Состояние: <b>${Math.round(S.motor.health)}%</b> · В баке: <b>${Math.round(S.tank.fuel + S.tank.oil)} мл</b></p>
        <p class="small">Заправка — во вкладке «Снегокат». Мешай смесь правильно, иначе мотор заклинит!</p></div>`;
    }
    const cur = S.motor.stage;
    return `<div class="card small">Самый сложный проект: из старой бензопилы сделать мотор для снегоката. ${MOTOR_STAGES.length} этапов, много деталей и терпения.</div>
      <div class="stages">` + MOTOR_STAGES.map((st, i) => {
      const state = i < cur ? 'done' : i === cur ? 'cur' : 'locked';
      let body = '';
      if (state === 'cur') {
        const req = Object.entries(st.req).map(([k, n]) => {
          const have = S.inv[k] || 0;
          return `<span class="part ${have >= n ? 'ok' : 'no'}">${ITEMS[k].icon} ${ITEMS[k].name} <small>(${have})</small></span>`;
        }).join('');
        const fuelReq = st.fuel ? `<span class="part ${S.tank.fuel >= st.fuel ? 'ok' : 'no'}">⛽ смесь в баке ≥ ${st.fuel} мл <small>(${Math.round(S.tank.fuel)})</small></span>` : '';
        const miss = Motor.missing(st);
        body = `<div class="small">${st.desc}</div><div class="parts">${req}${fuelReq}</div>
          ${st.fuel ? '<div class="small muted">Бензин и масло покупаются в магазине, смешиваются во вкладке «Снегокат».</div>' : ''}
          <button class="btn primary" data-act="motor" ${miss.length ? 'disabled' : ''}>${st.id === 'buy' ? '🚚 Притащить в гараж' : '▶ Начать'}</button>`;
      }
      return `<div class="stage ${state}"><div class="num">${state === 'done' ? '✓' : i + 1}</div><div class="sbody"><b>${st.icon} ${st.name}</b>${body}</div></div>`;
    }).join('') + '</div>';
  },

  // ---------- вкладка «Магазин»
  renderShop() {
    const cats = Object.entries(CATS).map(([k, v]) => `<button class="chip ${this.shopCat === k ? 'on' : ''}" data-act="cat" data-id="${k}">${v}</button>`).join('');
    const items = Object.entries(ITEMS).filter(([, it]) => it.cat === this.shopCat).map(([id, it]) => {
      const owned = it.tool && S.tools[id];
      const cnt = this.invCount(id);
      return `<div class="item">
        <div class="ico">${it.icon}</div>
        <div class="info"><b>${it.name}</b>${it.pack ? ` <small>(${it.pack} ${it.unit})</small>` : ''}<div class="small muted">${it.desc || ''}</div>${cnt && !owned ? `<div class="small have">В наличии: ${cnt}</div>` : ''}</div>
        ${owned ? '<span class="badge">✓ Есть</span>' : `<button class="btn buy" data-act="buy" data-id="${id}" ${S.coins >= it.price ? '' : 'disabled'}>${it.price} 🪙</button>`}
      </div>`;
    }).join('');
    const flea = this.shopCat === 'flea' ? '<div class="card small">🏚️ Барахолка: дядьки в гаражах продают всякое. Возврата нет.</div>' : '';
    return `<div class="row wrap cats">${cats}</div>${flea}<div class="items">${items}</div>`;
  },

  // ---------- вкладка «Достижения»
  renderAch() {
    const st = S.stats;
    const got = ACH.filter(a => S.ach[a.id]).length;
    return `<div class="card stats">
        <div><b>${st.runs}</b><small>заездов</small></div>
        <div><b>${fmt(st.best)}</b><small>рекорд очков</small></div>
        <div><b>${st.flips}</b><small>сальто</small></div>
        <div><b>${st.bestAir.toFixed(1)} с</b><small>макс. в воздухе</small></div>
        <div><b>${st.bestDist.toFixed(1)} м</b><small>самый дальний прыжок</small></div>
        <div><b>${S.mods.speedo ? st.maxSpeed.toFixed(0) + ' км/ч' : '—'}</b><small>макс. скорость</small></div>
        <div><b>${st.crashes}</b><small>падений</small></div>
        <div><b>${fmt(st.earned)}</b><small>заработано 🪙</small></div>
      </div>
      <h3 class="pad">🏆 Достижения ${got}/${ACH.length}</h3>
      <div class="achs">${ACH.map(a => `<div class="ach ${S.ach[a.id] ? 'got' : ''}"><b>${S.ach[a.id] ? '🏆' : '🔒'} ${a.name}</b><small>${a.desc}${a.reward ? ` · +${a.reward} 🪙` : ''}</small></div>`).join('')}</div>`;
  },

  // ---------- вкладка «Настройки»
  renderSettings() {
    const saved = S.saved ? new Date(S.saved).toLocaleString('ru-RU') : '—';
    return `<div class="card">
      <h3>⚙️ Настройки</h3>
      <div class="row"><button class="chip ${S.settings.sound ? 'on' : ''}" data-act="set" data-id="sound">🔊 Звук: ${S.settings.sound ? 'вкл' : 'выкл'}</button>
      <button class="chip ${S.settings.music ? 'on' : ''}" data-act="set" data-id="music">🎵 Музыка из колонки: ${S.settings.music ? 'вкл' : 'выкл'}</button></div>
    </div>
    <div class="card">
      <h3>💾 Сохранение</h3>
      <p class="small">Прогресс сохраняется автоматически: после каждого действия, каждые 5 секунд и при закрытии вкладки.<br>Последнее сохранение: <b>${saved}</b> · В игре: <b>${Math.round(S.stats.playTime / 60)} мин</b></p>
      <div class="row wrap">
        <button class="btn" data-act="export">📤 Код сохранения</button>
        <button class="btn" data-act="import">📥 Загрузить из кода</button>
        <button class="btn danger" data-act="reset">🗑️ Начать заново</button>
      </div>
    </div>
    <div class="card small muted">Снегокат v1.0 · сделано с паяльником и любовью ❄️</div>`;
  },

  // ---------- действия
  act(a, id) {
    switch (a) {
      case 'toggle': S.modOn[id] = !S.modOn[id]; break;
      case 'paint': S.paint = id; break;
      case 'glow': S.glow = id; break;
      case 'cat': this.shopCat = id; break;
      case 'buy': this.buy(id); break;
      case 'solder': Solder.start(PROJECTS.find(p => p.id === id)); return;
      case 'buykit': this.buyKit(PROJECTS.find(p => p.id === id)); break;
      case 'motor': Motor.begin(); break;
      case 'testalarm': Sfx.alarm(1.5); return;
      case 'testhorn': Sfx.hornTone(); return;
      case 'fill': this.fill(); break;
      case 'drain':
        UI.modal('Слить бак?', 'Смесь из бака уйдёт в сугроб. Безвозвратно.', [
          { label: 'Слить', cls: 'danger', onClick: () => { S.tank.fuel = 0; S.tank.oil = 0; Save.save(); this.render(); } }, { label: 'Отмена' }]);
        return;
      case 'manual':
        UI.modal('📖 Инструкция к бензопиле', `<p>«…Двигатель двухтактный. Работает на <b>смеси бензина и масла 2Т в пропорции 1:50</b> (на 1 литр бензина — 20 мл масла).</p>
          <p>Смесь беднее (меньше масла) — <b>задиры и заклинивание поршня</b>.<br>Смесь богаче (больше масла) — дым, нагар, мотор слабее.</p><p>Чистый бензин не заливать НИКОГДА.»</p>`);
        return;
      case 'repair':
        if (S.inv.pistonkit > 0) { S.inv.pistonkit--; S.motor.health = 100; S.motor.seized = false; Sfx.success(); UI.toast('Мотор перебран — как новый!', 'good'); }
        break;
      case 'set': S.settings[id] = !S.settings[id]; if (id === 'sound' && S.settings.sound) Sfx.init(); break;
      case 'export': {
        const code = Save.exportCode();
        UI.modal('📤 Код сохранения', `<p class="small">Скопируй и сохрани где-нибудь. На другом устройстве вставь через «Загрузить из кода».</p><textarea class="code" readonly onclick="this.select()">${code}</textarea>`, [
          { label: '📋 Скопировать', keep: true, onClick: () => { navigator.clipboard && navigator.clipboard.writeText(code).then(() => UI.toast('Скопировано!', 'good')); } }, { label: 'Закрыть' }]);
        return;
      }
      case 'import':
        UI.modal('📥 Загрузить сохранение', `<textarea class="code" id="impCode" placeholder="Вставь код сюда"></textarea>`, [
          { label: 'Загрузить', cls: 'primary', onClick: () => {
            try { Save.importCode($('#impCode').value); Ride.h = null; UI.toast('Сохранение загружено!', 'good'); this.render(); }
            catch (e) { UI.toast('Код не подходит 😕', 'bad'); }
          } }, { label: 'Отмена' }]);
        return;
      case 'reset':
        UI.modal('Начать заново?', 'Весь прогресс, детали и постройки будут удалены. Точно?', [
          { label: 'Да, всё удалить', cls: 'danger', onClick: () => { Save.reset(); Ride.h = null; this.tab = 'sled'; this.render(); UI.toast('Новая игра. Дед снова подарил набор на фару 🎁'); } },
          { label: 'Отмена' }]);
        return;
    }
    Save.dirty();
    this.render();
  },

  buy(id) {
    const it = ITEMS[id];
    if (S.coins < it.price) { Sfx.error(); return; }
    S.coins -= it.price;
    if (id === 'snow') S.snow += 400;
    else if (it.tool) S.tools[id] = true;
    else S.inv[id] = (S.inv[id] || 0) + (it.pack || 1);
    Sfx.buy();
    UI.toast(`${it.icon} Куплено: ${it.name}`);
    Save.dirty();
  },

  buyKit(p) {
    let cost = 0;
    const need = Object.entries(p.parts).filter(([k, n]) => (S.inv[k] || 0) < n);
    need.forEach(([k, n]) => cost += (n - (S.inv[k] || 0)) * ITEMS[k].price);
    if (S.coins < cost) { Sfx.error(); return; }
    S.coins -= cost;
    need.forEach(([k, n]) => { S.inv[k] = n; });
    Sfx.buy();
    UI.toast(`Детали для «${p.name}» куплены`);
  },

  fill() {
    const cap = S.tools.bigtank ? 1200 : 500;
    const p = Math.max(0, Math.round(+$('#mixP').value || 0)), o = Math.max(0, Math.round(+$('#mixO').value || 0));
    if (p + o === 0) return;
    if (p > (S.inv.petrol || 0)) { UI.toast('Столько бензина нет — купи в магазине', 'bad'); return; }
    if (o > (S.inv.oil || 0)) { UI.toast('Столько масла нет — купи в магазине', 'bad'); return; }
    if (S.tank.fuel + S.tank.oil + p + o > cap + 0.5) { UI.toast(`Не влезет! Бак ${cap} мл`, 'bad'); return; }
    S.inv.petrol -= p; S.inv.oil -= o;
    S.tank.fuel += p; S.tank.oil += o;
    Sfx.noise(0.8, 0.15, 600, 'bandpass');
    const r = S.tank.oil > 0 ? S.tank.fuel / S.tank.oil : Infinity;
    UI.toast(r === Infinity ? '⚠️ В баке чистый бензин! Мотору будет плохо.' : r > 70 ? '⚠️ Масла маловато…' : r < 30 ? '💨 Будет дымить — масла многовато' : '👌 Смесь что надо', r >= 30 && r <= 70 ? 'good' : 'bad');
  },
};
