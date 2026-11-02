'use strict';
/* ==========================================================
   Лунный сад — данные игры.
   Весь баланс собран здесь: цены, время роста, шансы, соперники.
   ========================================================== */

const CONFIG = {
  startCoins: 30,
  startBeds: 4,
  maxBeds: 16,

  ticketPrice: 1_500_000,      // билет на Луну

  moonStartBeds: 3,
  moonMaxBeds: 12,
  moonLunarMult: 6,            // на Луне лунная мутация выпадает в 6 раз чаще

  sectors: 12,                 // секторов на Луне
  sectorsToWin: 7,             // сколько нужно для захвата Луны
  sectorBaseCost: 2_000_000,
  sectorCostGrowth: 1.45,      // каждый следующий сектор дороже
  recaptureMult: 2,            // отбить сектор у соперника — вдвое дороже

  moonCycleMin: 24,            // полный цикл фаз Луны, минут реального времени
  marketSlotMin: 10,           // как часто меняются цены на рынке, минут
  moonPostMult: 3,             // Лунная почта платит втрое больше за лунное
  labBaseSec: 30,              // базовое время скрещивания

  // Соперники в гонке за Луну. Время — реальное, от начала игры.
  rivals: [
    { id: 'krot',   name: 'АгроКорп «Кротов»', icon: '🦔', color: '#d9773b', arriveH: 24, everyMin: 120 },
    { id: 'tykva',  name: 'Мадам Тыква',       icon: '🎃', color: '#c9a227', arriveH: 36, everyMin: 100 },
    { id: 'kaktus', name: 'Синдикат Кактусов', icon: '🌵', color: '#3f9d6b', arriveH: 48, everyMin: 90 },
  ],
};

/* Мутации — от обычной к самой редкой. chance — базовый шанс при сборе. */
const MUTATIONS = [
  { id: 'normal',  name: 'Обычная',  icon: '',   mult: 1,  chance: 0 },
  { id: 'big',     name: 'Крупная',  icon: '🔸', mult: 2,  chance: 0.10 },
  { id: 'golden',  name: 'Золотая',  icon: '✨', mult: 5,  chance: 0.03 },
  { id: 'rainbow', name: 'Радужная', icon: '🌈', mult: 12, chance: 0.008 },
  { id: 'lunar',   name: 'Лунная',   icon: '🌙', mult: 40, chance: 0.0015 },
];
const MUT = {};
MUTATIONS.forEach((m, i) => { MUT[m.id] = Object.assign({ rank: i }, m); });

/* Растения.
   tier — уровень, grow — секунды роста, price — базовая цена продажи,
   seed — цена семян в магазине (0 = не продаётся),
   moonSeed — цена семян на Лунной почте,
   where — 'any' или 'moon' (только на лунной базе),
   lunar — лунное растение (берёт Лунная почта), hue — сдвиг цвета эмодзи. */
const SPECIES_LIST = [
  // ── Земля, уровень 1 (магазин)
  { id: 'daisy',     name: 'Ромашка',    emoji: '🌼', tier: 1, grow: 20, price: 8,  seed: 4 },
  { id: 'tulip',     name: 'Тюльпан',    emoji: '🌷', tier: 1, grow: 30, price: 12, seed: 6 },
  { id: 'clover',    name: 'Клевер',     emoji: '☘️', tier: 1, grow: 25, price: 10, seed: 5 },
  { id: 'mint',      name: 'Мята',       emoji: '🌿', tier: 1, grow: 35, price: 14, seed: 7 },
  { id: 'cactus',    name: 'Кактус',     emoji: '🌵', tier: 1, grow: 45, price: 18, seed: 9 },
  { id: 'mushroom',  name: 'Гриб',       emoji: '🍄', tier: 1, grow: 50, price: 22, seed: 11 },
  { id: 'sunflower', name: 'Подсолнух',  emoji: '🌻', tier: 1, grow: 60, price: 26, seed: 13 },

  // ── Уровень 2
  { id: 'rose',       name: 'Роза',           emoji: '🌹', tier: 2, grow: 120, price: 90 },
  { id: 'sakura',     name: 'Сакура',         emoji: '🌸', tier: 2, grow: 110, price: 80 },
  { id: 'lotus',      name: 'Лотос',          emoji: '🪷', tier: 2, grow: 150, price: 120 },
  { id: 'lucky',      name: 'Четырёхлистник', emoji: '🍀', tier: 2, grow: 130, price: 100 },
  { id: 'pepper',     name: 'Огнецвет',       emoji: '🌶️', tier: 2, grow: 180, price: 150 },
  { id: 'glowshroom', name: 'Светогриб',      emoji: '🍄', tier: 2, grow: 160, price: 130, hue: 170 },
  { id: 'hibiscus',   name: 'Гибискус',       emoji: '🌺', tier: 2, grow: 140, price: 110 },
  { id: 'aloe',       name: 'Алоэ',           emoji: '🪴', tier: 2, grow: 150, price: 115 },

  // ── Уровень 3
  { id: 'crystalRose',  name: 'Хрустальная роза', emoji: '🌹', tier: 3, grow: 420, price: 700, hue: 190 },
  { id: 'goldLotus',    name: 'Золотой лотос',    emoji: '🪷', tier: 3, grow: 480, price: 800, hue: 50 },
  { id: 'phoenix',      name: 'Фениксоцвет',      emoji: '🔥', tier: 3, grow: 540, price: 900 },
  { id: 'frostFern',    name: 'Морозник',         emoji: '❄️', tier: 3, grow: 450, price: 750 },
  { id: 'starBloom',    name: 'Звездоцвет',       emoji: '💫', tier: 3, grow: 500, price: 850 },
  { id: 'thunder',      name: 'Грозовик',         emoji: '⚡', tier: 3, grow: 520, price: 880 },
  { id: 'dragonCactus', name: 'Драконий кактус',  emoji: '🐉', tier: 3, grow: 600, price: 1000 },

  // ── Уровень 4
  { id: 'nebula',     name: 'Туманник',       emoji: '🌌', tier: 4, grow: 1200, price: 5000 },
  { id: 'solar',      name: 'Солнцецвет',     emoji: '☀️', tier: 4, grow: 1200, price: 5200 },
  { id: 'eclipse',    name: 'Затменник',      emoji: '🌑', tier: 4, grow: 1300, price: 5600 },
  { id: 'dragonRose', name: 'Драконья роза',  emoji: '🥀', tier: 4, grow: 1100, price: 4800 },

  // ── Уровень 5 — вершина земной селекции
  { id: 'comet',    name: 'Кометник',     emoji: '☄️', tier: 5, grow: 2100, price: 28000 },
  { id: 'lunarBud', name: 'Лунный бутон', emoji: '🌙', tier: 5, grow: 2400, price: 45000, lunar: true },

  // ── Лунные растения (растут только на лунной базе)
  { id: 'moonMoss',     name: 'Лунный мох',          emoji: '🌫️', tier: 6, grow: 300,  price: 9000,   moonSeed: 20000,  where: 'moon', lunar: true },
  { id: 'craterLily',   name: 'Кратерная лилия',     emoji: '🪷', tier: 6, grow: 480,  price: 22000,  moonSeed: 50000,  where: 'moon', lunar: true, hue: 200 },
  { id: 'starPollen',   name: 'Пыльцевик',           emoji: '🌟', tier: 6, grow: 720,  price: 50000,  moonSeed: 120000, where: 'moon', lunar: true },
  { id: 'moonShroom',   name: 'Лунный гриб',         emoji: '🍄', tier: 6, grow: 400,  price: 15000,  where: 'moon', lunar: true, hue: 240 },
  { id: 'seleneOrchid', name: 'Селенитовая орхидея', emoji: '💮', tier: 7, grow: 900,  price: 120000, where: 'moon', lunar: true },
  { id: 'cosmoVine',    name: 'Космолиана',          emoji: '🌀', tier: 7, grow: 1200, price: 260000, where: 'moon', lunar: true },
  { id: 'seleneTree',   name: 'Древо Селены',        emoji: '🌳', tier: 8, grow: 1800, price: 600000, where: 'moon', lunar: true, hue: 160 },
  { id: 'moonHeart',    name: 'Сердце Луны',         emoji: '💎', tier: 9, grow: 3000, price: 2000000, where: 'moon', lunar: true },

  // ── Неудачный эксперимент
  { id: 'weed', name: 'Сорняк', emoji: '🌾', tier: 0, grow: 10, price: 1 },
];

const SPECIES = {};
SPECIES_LIST.forEach((s) => { SPECIES[s.id] = Object.assign({ where: 'any', lunar: false, hue: 0, seed: 0, moonSeed: 0 }, s); });

/* Рецепты скрещивания: [родитель A, родитель B, потомок, шанс успеха].
   Порядок родителей не важен. Скрещивание одинаковых растений даёт 2 семени того же вида. */
const RECIPE_LIST = [
  // уровень 2
  ['daisy', 'tulip', 'rose'],
  ['daisy', 'clover', 'sakura'],
  ['tulip', 'mint', 'lotus'],
  ['clover', 'mint', 'lucky'],
  ['cactus', 'sunflower', 'pepper'],
  ['mushroom', 'clover', 'glowshroom'],
  ['tulip', 'sunflower', 'hibiscus'],
  ['cactus', 'mint', 'aloe'],
  // уровень 3
  ['rose', 'glowshroom', 'crystalRose'],
  ['lotus', 'hibiscus', 'goldLotus'],
  ['pepper', 'hibiscus', 'phoenix'],
  ['aloe', 'lotus', 'frostFern'],
  ['sakura', 'glowshroom', 'starBloom'],
  ['lucky', 'pepper', 'thunder'],
  ['aloe', 'pepper', 'dragonCactus'],
  // уровень 4
  ['starBloom', 'frostFern', 'nebula'],
  ['goldLotus', 'phoenix', 'solar'],
  ['crystalRose', 'thunder', 'eclipse'],
  ['dragonCactus', 'crystalRose', 'dragonRose'],
  // уровень 5
  ['solar', 'nebula', 'comet', 0.6],
  ['nebula', 'eclipse', 'lunarBud', 0.4],
  // Луна
  ['moonMoss', 'mushroom', 'moonShroom'],
  ['moonMoss', 'craterLily', 'seleneOrchid', 0.7],
  ['starPollen', 'comet', 'cosmoVine', 0.6],
  ['seleneOrchid', 'lunarBud', 'seleneTree', 0.5],
  ['seleneTree', 'cosmoVine', 'moonHeart', 0.35],
];

function pairKey(a, b) { return a < b ? a + '+' + b : b + '+' + a; }
const RECIPES = {};        // 'a+b' -> { a, b, child, chance }
const RECIPE_OF = {};      // child -> рецепт
RECIPE_LIST.forEach(([a, b, child, chance]) => {
  const r = { a, b, child, chance: chance == null ? 1 : chance };
  RECIPES[pairKey(a, b)] = r;
  RECIPE_OF[child] = r;
});

const PHASES = [
  { e: '🌑', n: 'Новолуние' },
  { e: '🌒', n: 'Молодая луна' },
  { e: '🌓', n: 'Первая четверть' },
  { e: '🌔', n: 'Растущая луна' },
  { e: '🌕', n: 'Полнолуние' },
  { e: '🌖', n: 'Убывающая луна' },
  { e: '🌗', n: 'Последняя четверть' },
  { e: '🌘', n: 'Старая луна' },
];
