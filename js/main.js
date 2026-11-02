'use strict';
// ===== Точка входа =====
const App = {
  screen: 'title',
  go(name) {
    const prev = this.screen;
    if (prev === 'ride' && name !== 'ride') Ride.exit();
    UI.closeModal();
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + name));
    this.screen = name;
    if (name === 'garage') Garage.enter(prev === 'ride');
    if (name === 'ride') Ride.enter();
  },
  addCoins(n) {
    S.coins += n;
    if (n > 0) S.stats.earned += n;
    Garage.updateCoins();
    if (S.coins >= 3000) this.ach('rich');
    Save.dirty();
  },
  ach(id) {
    if (S.ach[id]) return;
    const a = ACH.find(x => x.id === id);
    if (!a) return;
    S.ach[id] = Date.now();
    if (a.reward) { S.coins += a.reward; S.stats.earned += a.reward; }
    UI.toast(`🏆 <b>${a.name}</b>${a.reward ? ` +${a.reward} 🪙` : ''}<br><small>${a.desc}</small>`, 'ach');
    Sfx.success();
    Garage.updateCoins();
    Save.dirty();
  },
  init() {
    Save.load();
    MG.init();
    Ride.init();
    Garage.init();
    const has = Save.has() && S.stats.introSeen;
    $('#t-continue').textContent = has ? `▶ Продолжить (${fmt(S.coins)} 🪙)` : '▶ Играть';
    $('#t-continue').onclick = () => {
      Sfx.init();
      Sfx.tone(523, 0.1, 'triangle', 0.15); Sfx.tone(784, 0.2, 'triangle', 0.15, 0, 0.1);
      this.go('garage');
      if (!S.stats.introSeen) {
        S.stats.introSeen = 1; Save.dirty();
        UI.modal('❄️ Зима. Двор. Снегокат.', `
          <p>У тебя есть старенький снегокат, лопата и дедовский паяльник.</p>
          <p>🛷 <b>Катайся с горки</b>, крути сальто и трюки — получай монеты.<br>
          🪏 <b>Строй трамплины лопатой</b> — прямо на горке, во вкладке «Стройка».<br>
          🔥 <b>Паяй электронику</b>: фары, поворотники, стоп-сигнал, сигнализацию, спидометр, колонку.<br>
          🪚 <b>Собери мотор из старой бензопилы</b> — самое сложное. И тогда снегокат поедет сам!</p>
          <p>Дед оставил набор на <b>фару</b>: аккумулятор, тумблер, светодиод. Начни с неё во вкладке «Электроника».</p>
          <p class="small muted">Прогресс сохраняется автоматически.</p>`, [{ label: 'Поехали!', cls: 'primary' }]);
      }
    };
    document.addEventListener('pointerdown', () => Sfx.init(), { once: true });
  },
};
window.addEventListener('load', () => App.init());
