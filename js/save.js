'use strict';
// ===== Сохранение прогресса (localStorage) =====
const SAVE_KEY = 'snegokat_save_v1';
let S = null;

function defaultSave() {
  return {
    v: 1,
    coins: 150,
    // стартовый набор от деда: всё на первую фару
    inv: { solder: 12, wire: 6, battery: 1, switch: 1, led_w: 1 },
    tools: { iron: true },
    mods: {},
    modOn: { headlight: true, underglow: true, speaker: true },
    paint: '#e53935',
    glow: '#00e5ff',
    motor: { stage: 0, done: false, health: 100 },
    tank: { fuel: 0, oil: 0 },
    terrain: null,
    ice: null,
    snow: 600,
    snowMoved: 0,
    stats: { runs: 0, best: 0, bestAir: 0, bestDist: 0, maxSpeed: 0, flips: 0, earned: 0, crashes: 0, solders: 0, playTime: 0 },
    ach: {},
    settings: { sound: true, music: true, night: false },
    created: Date.now(),
    saved: 0,
  };
}

function deepMerge(base, data) {
  for (const k in data) {
    if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      deepMerge(base[k], data[k]);
    } else {
      base[k] = data[k];
    }
  }
  return base;
}

const Save = {
  timer: null,
  has() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  },
  load() {
    S = defaultSave();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) deepMerge(S, JSON.parse(raw));
    } catch (e) { console.warn('save load failed', e); }
    return S;
  },
  save() {
    if (!S) return;
    clearTimeout(this.timer); this.timer = null;
    S.saved = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { console.warn('save failed', e); }
  },
  dirty() {
    if (this.timer) return;
    this.timer = setTimeout(() => this.save(), 400);
  },
  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    S = defaultSave();
    this.save();
  },
  exportCode() {
    return btoa(unescape(encodeURIComponent(JSON.stringify(S))));
  },
  importCode(code) {
    const data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!data || typeof data !== 'object' || data.v !== 1) throw new Error('bad save');
    S = deepMerge(defaultSave(), data);
    this.save();
  },
};

// сохраняемся при выходе / сворачивании
window.addEventListener('beforeunload', () => { if (typeof Ride !== 'undefined') Ride.persist(); Save.save(); });
window.addEventListener('pagehide', () => { if (typeof Ride !== 'undefined') Ride.persist(); Save.save(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (typeof Ride !== 'undefined') Ride.persist(); Save.save(); }
});
setInterval(() => { if (S) { S.stats.playTime += 5; Save.save(); } }, 5000);
