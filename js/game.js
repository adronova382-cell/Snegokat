'use strict';
/* ==========================================================
   Лунный сад — игровая логика (без DOM).
   ========================================================== */

const SAVE_KEY = 'luna-garden-save-v1';
let S = null;              // состояние игры
const EVENTS = [];         // события для интерфейса (тосты), забираются UI

function now() { return Date.now(); }
function key(sp, mut) { return sp + '|' + (mut || 'normal'); }
function unkey(k) { const [sp, mut] = k.split('|'); return { sp, mut: mut || 'normal' }; }
function emit(text, kind) { EVENTS.push({ text, kind: kind || 'info' }); }
function news(text) {
  S.news.unshift({ t: now(), text });
  if (S.news.length > 40) S.news.length = 40;
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------- состояние ---------- */

function newState() {
  const t = now();
  const discovered = {};
  SPECIES_LIST.forEach((s) => { if (s.seed) discovered[s.id] = true; });
  return {
    v: 1,
    pid: Math.random().toString(36).slice(2, 10),
    name: 'Садовод',
    startedAt: t,
    coins: CONFIG.startCoins,
    beds: Array(CONFIG.startBeds).fill(null),
    moonBeds: Array(CONFIG.moonStartBeds).fill(null),
    hasTicket: false,
    ticketAt: null,
    seeds: { 'daisy|normal': 3, 'tulip|normal': 2, 'clover|normal': 2 },
    plants: {},
    up: { fert: 0, green: 0, dome: 0, incub: 0 },
    lab: [null],
    discovered,
    recipes: {},      // child -> true (рецепт открыт)
    hints: {},        // child -> true (подсказка куплена)
    badCombos: {},    // 'a+b' -> true (уже давали сорняк)
    muts: {},         // sp -> { mut: true }
    sectors: Array(CONFIG.sectors).fill(null),
    rivals: Object.fromEntries(CONFIG.rivals.map((r) => [r.id, { done: 0 }])),
    rivalWon: null,
    wonAt: null,
    wonFirst: false,
    trade: { pending: {}, used: {} },
    stats: { earned: 0, harvested: 0, crosses: 0, sold: 0 },
    news: [],
    seenHelp: false,
  };
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.v === 1) {
        const base = newState();
        S = Object.assign(base, saved);
        S.up = Object.assign(base.up, saved.up);
        S.trade = Object.assign({ pending: {}, used: {} }, saved.trade);
        CONFIG.rivals.forEach((r) => { if (!S.rivals[r.id]) S.rivals[r.id] = { done: 0 }; });
        return;
      }
    }
  } catch (e) { /* испорченное или недоступное сохранение — начинаем заново */ }
  S = newState();
}

function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* хранилище недоступно */ }
}

function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  S = newState();
}

/* ---------- инвентарь ---------- */

function addItem(bag, k, n) { bag[k] = (bag[k] || 0) + n; }
function takeItem(bag, k, n) {
  if ((bag[k] || 0) < n) return false;
  bag[k] -= n;
  if (bag[k] <= 0) delete bag[k];
  return true;
}
function discover(sp, mut) {
  if (!S.discovered[sp]) {
    S.discovered[sp] = true;
    emit('Новый вид в альбоме: ' + SPECIES[sp].name + '!', 'good');
  }
  if (mut && mut !== 'normal') {
    S.muts[sp] = S.muts[sp] || {};
    S.muts[sp][mut] = true;
  }
}
function spend(c) {
  if (S.coins < c) { emit('Не хватает монет', 'bad'); return false; }
  S.coins -= c;
  return true;
}
function earn(c) { S.coins += c; S.stats.earned += c; }

/* ---------- Луна: фазы ---------- */

function cycleMs() { return CONFIG.moonCycleMin * 60000; }
function phaseAt(t) { return Math.floor(((t % cycleMs()) / cycleMs()) * 8); }
function phaseFactor(t) {
  const p = phaseAt(t);
  return p === 4 ? 5 : (p === 3 || p === 5) ? 2 : 1;
}
function nextFullMoon(t) {
  const c = cycleMs(), seg = c / 8, pos = t % c;
  if (pos < 4 * seg) return t + (4 * seg - pos);
  if (pos < 5 * seg) return t;
  return t + (c - pos) + 4 * seg;
}
function fullMoonEnd(t) {
  const c = cycleMs(), seg = c / 8, pos = t % c;
  return t + (5 * seg - pos);
}

/* ---------- рост и мутации ---------- */

function bedsOf(loc) { return loc === 'moon' ? S.moonBeds : S.beds; }
function canPlant(sp, loc) {
  if (loc === 'moon' && !S.hasTicket) return false;
  if (SPECIES[sp].where === 'moon') return loc === 'moon';
  return true;
}
function growTime(sp, loc) {
  const base = SPECIES[sp].grow * 1000;
  return Math.round(base * (loc === 'moon' ? Math.pow(0.9, S.up.dome) : Math.pow(0.93, S.up.fert)));
}
function luck(loc) {
  let l = 1 + 0.15 * S.up.green;
  if (loc === 'moon') l *= 1 + 0.25 * S.up.incub;
  return l;
}
function mutationChances(loc, t) {
  const L = luck(loc);
  const out = {};
  ['lunar', 'rainbow', 'golden', 'big'].forEach((m) => {
    let ch = MUT[m].chance * L;
    if (m === 'lunar') ch *= phaseFactor(t) * (loc === 'moon' ? CONFIG.moonLunarMult : 1);
    out[m] = Math.min(ch, 0.9);
  });
  return out;
}
function rollMutation(loc, t, carried) {
  const ch = mutationChances(loc, t);
  let got = 'normal';
  for (const m of ['lunar', 'rainbow', 'golden', 'big']) {
    if (Math.random() < ch[m]) { got = m; break; }
  }
  if (carried && MUT[carried].rank > MUT[got].rank) got = carried;
  return got;
}

function plant(loc, idx, seedKey) {
  const beds = bedsOf(loc);
  if (idx < 0 || idx >= beds.length || beds[idx]) return false;
  const { sp, mut } = unkey(seedKey);
  if (!SPECIES[sp]) return false;
  if (!canPlant(sp, loc)) { emit(SPECIES[sp].name + ' растёт только на Луне', 'bad'); return false; }
  if (!takeItem(S.seeds, seedKey, 1)) return false;
  const t = now();
  beds[idx] = { sp, mut, at: t, ready: t + growTime(sp, loc) };
  return true;
}

function plantAll(loc, seedKey) {
  const beds = bedsOf(loc);
  let n = 0;
  for (let i = 0; i < beds.length; i++) {
    if (!beds[i] && (S.seeds[seedKey] || 0) > 0) { if (plant(loc, i, seedKey)) n++; }
  }
  return n;
}

function harvest(loc, idx) {
  const beds = bedsOf(loc);
  const b = beds[idx];
  if (!b || now() < b.ready) return null;
  const mut = rollMutation(loc, b.ready, b.mut === 'normal' ? null : b.mut);
  addItem(S.plants, key(b.sp, mut), 1);
  discover(b.sp, mut);
  S.stats.harvested++;
  const dropChance = SPECIES[b.sp].tier <= 4 ? 0.6 : 0.4;
  let seed = false;
  if (b.sp !== 'weed' && Math.random() < dropChance) { addItem(S.seeds, key(b.sp, 'normal'), 1); seed = true; }
  beds[idx] = null;
  if (mut !== 'normal') {
    emit(MUT[mut].icon + ' ' + MUT[mut].name + ' мутация: ' + SPECIES[b.sp].name + '!', mut === 'lunar' ? 'lunar' : 'good');
    if (mut === 'lunar') news('Вы вырастили лунную мутацию: ' + SPECIES[b.sp].name);
  }
  return { sp: b.sp, mut, seed };
}

function harvestAll(loc) {
  const beds = bedsOf(loc);
  let n = 0, seeds = 0;
  for (let i = 0; i < beds.length; i++) {
    const r = harvest(loc, i);
    if (r) { n++; if (r.seed) seeds++; }
  }
  if (n) emit('Собрано: ' + n + (seeds ? ', семян: ' + seeds : ''), 'info');
  return n;
}

/* ---------- рынок ---------- */

function marketSlot(t) { return Math.floor(t / (CONFIG.marketSlotMin * 60000)); }
function marketMultSlot(sp, slot) { return 0.7 + ((hash(sp + ':' + slot) % 1000) / 1000) * 0.8; }
function marketMult(sp, t) { return marketMultSlot(sp, marketSlot(t)); }
function marketTrend(sp, t) {
  const s = marketSlot(t);
  return marketMultSlot(sp, s) - marketMultSlot(sp, s - 1);
}
function nextMarketChange(t) { const len = CONFIG.marketSlotMin * 60000; return (marketSlot(t) + 1) * len; }
function marketPrice(sp, mut, t) {
  return Math.max(1, Math.round(SPECIES[sp].price * MUT[mut].mult * marketMult(sp, t || now())));
}
function isLunarItem(sp, mut) { return SPECIES[sp].lunar || mut === 'lunar'; }
function moonPostPrice(sp, mut) {
  return Math.round(SPECIES[sp].price * MUT[mut].mult * CONFIG.moonPostMult);
}

function sell(k, n, venue) {
  const { sp, mut } = unkey(k);
  n = Math.min(n, S.plants[k] || 0);
  if (n <= 0) return 0;
  if (venue === 'moon' && !isLunarItem(sp, mut)) { emit('Лунная почта берёт только лунное', 'bad'); return 0; }
  const price = venue === 'moon' ? moonPostPrice(sp, mut) : marketPrice(sp, mut);
  takeItem(S.plants, k, n);
  earn(price * n);
  S.stats.sold += n;
  emit('Продано: ' + SPECIES[sp].name + ' ×' + n + ' за ' + fmt(price * n) + ' 🪙', 'coin');
  return price * n;
}

function sellAllNormal() {
  let total = 0, n = 0;
  Object.keys(S.plants).forEach((k) => {
    const { sp, mut } = unkey(k);
    if (mut !== 'normal') return;
    const c = S.plants[k];
    total += marketPrice(sp, mut) * c;
    n += c;
    delete S.plants[k];
  });
  if (n) { earn(total); S.stats.sold += n; emit('Продано ' + n + ' растений за ' + fmt(total) + ' 🪙', 'coin'); }
  return total;
}

/* ---------- магазин ---------- */

function buySeed(sp, n) {
  const s = SPECIES[sp];
  if (!s.seed) return false;
  if (!spend(s.seed * n)) return false;
  addItem(S.seeds, key(sp, 'normal'), n);
  return true;
}
function buyMoonSeed(sp, n) {
  const s = SPECIES[sp];
  if (!s.moonSeed) return false;
  if (!spend(s.moonSeed * n)) return false;
  addItem(S.seeds, key(sp, 'normal'), n);
  discover(sp);
  return true;
}

const UPGRADES = {
  beds:     { name: 'Новая грядка',      icon: '🟫', where: 'earth', max: CONFIG.maxBeds - CONFIG.startBeds, desc: '+1 грядка в саду',
              cost: (n) => Math.round(60 * Math.pow(1.85, n)), level: () => S.beds.length - CONFIG.startBeds },
  fert:     { name: 'Удобрения',         icon: '🧴', where: 'earth', max: 10, desc: '−7% к времени роста на Земле',
              cost: (n) => Math.round(150 * Math.pow(2.3, n)), level: () => S.up.fert },
  green:    { name: 'Теплица',           icon: '🏡', where: 'earth', max: 10, desc: '+15% к шансу мутаций везде',
              cost: (n) => Math.round(400 * Math.pow(2.4, n)), level: () => S.up.green },
  lab:      { name: 'Слот лаборатории',  icon: '🧪', where: 'earth', max: 2, desc: 'Ещё одно скрещивание параллельно',
              cost: (n) => [800, 25000][n], level: () => S.lab.length - 1 },
  moonBeds: { name: 'Лунная грядка',     icon: '🪨', where: 'moon', max: CONFIG.moonMaxBeds - CONFIG.moonStartBeds, desc: '+1 грядка на базе',
              cost: (n) => Math.round(250000 * Math.pow(1.6, n)), level: () => S.moonBeds.length - CONFIG.moonStartBeds },
  dome:     { name: 'Купол',             icon: '🫧', where: 'moon', max: 8, desc: '−10% к времени роста на Луне',
              cost: (n) => Math.round(400000 * Math.pow(2, n)), level: () => S.up.dome },
  incub:    { name: 'Лунный инкубатор',  icon: '🔮', where: 'moon', max: 8, desc: '+25% к шансу мутаций на Луне',
              cost: (n) => Math.round(600000 * Math.pow(2.1, n)), level: () => S.up.incub },
};

function upgradeCost(id) {
  const u = UPGRADES[id], lvl = u.level();
  return lvl >= u.max ? null : u.cost(lvl);
}
function buyUpgrade(id) {
  const u = UPGRADES[id];
  if (u.where === 'moon' && !S.hasTicket) return false;
  const c = upgradeCost(id);
  if (c == null || !spend(c)) return false;
  if (id === 'beds') S.beds.push(null);
  else if (id === 'lab') S.lab.push(null);
  else if (id === 'moonBeds') S.moonBeds.push(null);
  else S.up[id]++;
  emit(u.icon + ' ' + u.name + ': улучшено', 'good');
  return true;
}

function buyTicket() {
  if (S.hasTicket) return false;
  if (!spend(CONFIG.ticketPrice)) return false;
  S.hasTicket = true;
  S.ticketAt = now();
  emit('🚀 Билет куплен! Лунная база открыта', 'lunar');
  news(S.name + ' прилетает на Луну за ' + fmtTime(S.ticketAt - S.startedAt));
  return true;
}

/* ---------- лаборатория ---------- */

function labTime(a, b) {
  const t = Math.max(SPECIES[a].tier, SPECIES[b].tier, 1);
  return Math.round(CONFIG.labBaseSec * Math.pow(t, 1.5)) * 1000;
}

function startCross(slot, ka, kb) {
  if (slot < 0 || slot >= S.lab.length || S.lab[slot]) return false;
  if (!ka || !kb) return false;
  if (ka === kb) {
    if ((S.plants[ka] || 0) < 2) { emit('Для клонирования нужно 2 одинаковых растения', 'bad'); return false; }
  } else if (!(S.plants[ka] > 0) || !(S.plants[kb] > 0)) return false;
  takeItem(S.plants, ka, 1);
  takeItem(S.plants, kb, 1);
  const t = now();
  const A = unkey(ka), B = unkey(kb);
  S.lab[slot] = { a: ka, b: kb, at: t, ready: t + labTime(A.sp, B.sp) };
  return true;
}

function inherit(ma, mb) {
  const ra = MUT[ma].rank, rb = MUT[mb].rank;
  if (ra === 0 && rb === 0) return 'normal';
  if (ma === mb) return Math.random() < 0.5 ? ma : 'normal';
  const low = ra < rb ? ma : mb, high = ra < rb ? mb : ma;
  if (MUT[low].rank === 0) return Math.random() < 0.15 ? high : 'normal';
  return Math.random() < 0.25 ? low : 'normal';
}

/* Что известно игроку о паре (для подсказки в интерфейсе). */
function crossPreview(ka, kb) {
  if (!ka || !kb) return null;
  const A = unkey(ka), B = unkey(kb);
  if (A.sp === B.sp) return { kind: 'clone', sp: A.sp };
  const pk = pairKey(A.sp, B.sp);
  const r = RECIPES[pk];
  if (r && (S.recipes[r.child] || S.hints[r.child])) return { kind: 'known', sp: r.child, chance: r.chance };
  if (S.badCombos[pk]) return { kind: 'weed' };
  return { kind: 'unknown' };
}

function collectCross(slot) {
  const job = S.lab[slot];
  if (!job || now() < job.ready) return null;
  S.lab[slot] = null;
  S.stats.crosses++;
  const A = unkey(job.a), B = unkey(job.b);
  const mut = inherit(A.mut, B.mut);
  let res;
  if (A.sp === B.sp) {
    res = { type: 'clone', sp: A.sp, n: 2, mut };
  } else {
    const pk = pairKey(A.sp, B.sp);
    const r = RECIPES[pk];
    if (!r) {
      S.badCombos[pk] = true;
      addItem(S.plants, key('weed', 'normal'), 1);
      discover('weed');
      emit('🌾 Эксперимент не удался: вырос сорняк', 'bad');
      return { type: 'weed' };
    }
    let ch = r.chance;
    if (A.mut === 'lunar' || B.mut === 'lunar') ch += 0.2;
    if (Math.random() < ch) {
      res = { type: 'new', sp: r.child, n: 1 + (Math.random() < 0.3 ? 1 : 0), mut };
      if (!S.recipes[r.child]) { S.recipes[r.child] = true; emit('📖 Открыт рецепт: ' + SPECIES[r.child].name, 'good'); }
      if (r.child === 'lunarBud') news(S.name + ' вывел Лунный бутон!');
    } else {
      res = { type: 'fail', sp: Math.random() < 0.5 ? A.sp : B.sp, n: 1, mut: 'normal' };
    }
  }
  addItem(S.seeds, key(res.sp, res.mut), res.n);
  discover(res.sp, res.mut === 'normal' ? null : res.mut);
  const mtxt = res.mut !== 'normal' ? ' (' + MUT[res.mut].icon + ' ' + MUT[res.mut].name.toLowerCase() + ')' : '';
  if (res.type === 'fail') emit('Не вышло: получено семя «' + SPECIES[res.sp].name + '»', 'bad');
  else emit('🧪 Семена «' + SPECIES[res.sp].name + '» ×' + res.n + mtxt, 'good');
  return res;
}

function hintCost(child) { return Math.round(50 * Math.pow(SPECIES[child].tier, 3.2)); }
function buyHint(child) {
  if (!RECIPE_OF[child] || S.hints[child] || S.recipes[child]) return false;
  if (!spend(hintCost(child))) return false;
  S.hints[child] = true;
  return true;
}

/* ---------- гонка за Луну ---------- */

function ownedCount(owner) { return S.sectors.filter((x) => x === owner).length; }
function sectorCost(i) {
  let c = CONFIG.sectorBaseCost * Math.pow(CONFIG.sectorCostGrowth, ownedCount('me'));
  if (S.sectors[i] && S.sectors[i] !== 'me') c *= CONFIG.recaptureMult;
  return Math.round(c);
}
function captureSector(i) {
  if (!S.hasTicket || S.sectors[i] === 'me') return false;
  const was = S.sectors[i];
  if (!spend(sectorCost(i))) return false;
  S.sectors[i] = 'me';
  const rv = was && CONFIG.rivals.find((r) => r.id === was);
  emit('🚩 Сектор ' + (i + 1) + ' ваш' + (rv ? ' (отбит у: ' + rv.name + ')' : ''), 'lunar');
  news(S.name + (rv ? ' отбивает сектор ' + (i + 1) + ' у ' + rv.name : ' захватывает сектор ' + (i + 1)));
  checkWin();
  return true;
}
function checkWin() {
  if (!S.wonAt && ownedCount('me') >= CONFIG.sectorsToWin) {
    S.wonAt = now();
    S.wonFirst = !S.rivalWon;
    news('🏆 ' + S.name + ' захватывает Луну!');
    emit('🏆 Луна ваша!', 'lunar');
  }
}

function rivalNextTime(r) {
  return S.startedAt + r.arriveH * 3600000 + S.rivals[r.id].done * r.everyMin * 60000;
}
function rivalStatus(r) {
  const t = now(), arrive = S.startedAt + r.arriveH * 3600000;
  if (t < arrive) return { landed: false, pct: (t - S.startedAt) / (arrive - S.startedAt), eta: arrive - t };
  return { landed: true, sectors: ownedCount(r.id), next: rivalNextTime(r) - t };
}

/* Соперники действуют по реальному времени — даже пока игра закрыта. */
function processRivals() {
  const t = now();
  let changed = false;
  for (let guard = 0; guard < 500; guard++) {
    let best = null, bt = Infinity;
    for (const r of CONFIG.rivals) {
      const nt = rivalNextTime(r);
      if (nt <= t && nt < bt) { bt = nt; best = r; }
    }
    if (!best) break;
    const st = S.rivals[best.id];
    if (st.done === 0) news(best.icon + ' ' + best.name + ' высаживается на Луну');
    st.done++;
    const free = [];
    S.sectors.forEach((o, i) => { if (!o) free.push(i); });
    if (free.length) {
      const i = free[hash(best.id + st.done + S.pid) % free.length];
      S.sectors[i] = best.id;
      changed = true;
      news(best.icon + ' ' + best.name + ' захватывает сектор ' + (i + 1));
    }
    if (!S.rivalWon && !S.wonAt && ownedCount(best.id) >= CONFIG.sectorsToWin) {
      S.rivalWon = { id: best.id, at: bt };
      news('⚠️ ' + best.name + ' захватил Луну! Отбивайте сектора');
      emit('⚠️ ' + best.name + ' захватил большинство секторов Луны', 'bad');
    }
  }
  return changed;
}

function tick() { return processRivals(); }

/* ---------- форматирование (общее для логики и UI) ---------- */

function fmt(n) {
  n = Math.floor(n);
  const a = Math.abs(n);
  if (a < 100000) return n.toLocaleString('ru-RU');
  if (a < 1e6) return Math.round(n / 1e3) + ' тыс';
  if (a < 1e9) return (n / 1e6).toFixed(2).replace('.', ',') + ' млн';
  return (n / 1e9).toFixed(2).replace('.', ',') + ' млрд';
}
function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (x) => String(x).padStart(2, '0');
  if (h >= 24) return Math.floor(h / 24) + 'д ' + (h % 24) + 'ч';
  if (h) return h + 'ч ' + p(m) + 'м';
  if (m) return m + 'м ' + p(sec) + 'с';
  return sec + 'с';
}
