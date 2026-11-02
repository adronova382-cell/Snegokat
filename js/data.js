'use strict';
// ===== Игровые данные: предметы, схемы, достижения, этапы мотора =====

const CATS = {
  radio: '📻 Радиодетали',
  tools: '🧰 Инструмент и расходники',
  auto: '⛽ Автозапчасти и ГСМ',
  flea: '🏚️ Барахолка',
  upgrade: '⭐ Улучшения',
};

const ITEMS = {
  // --- радиодетали
  battery: { name: 'Аккумулятор 18650', price: 60, cat: 'radio', icon: '🔋', desc: 'Литиевый, 3.7 В. Не замыкать плюс с минусом!' },
  switch: { name: 'Тумблер', price: 15, cat: 'radio', icon: '🎚️', desc: 'Включил — горит, выключил — нет.' },
  tact: { name: 'Тактовая кнопка', price: 8, cat: 'radio', icon: '🔘', desc: 'Замыкает, только пока нажата.' },
  led_w: { name: 'Светодиод белый 1 Вт', price: 12, cat: 'radio', icon: '💡', desc: 'Яркий, для фары.' },
  led_r: { name: 'Светодиод красный', price: 10, cat: 'radio', icon: '🔴' },
  led_o: { name: 'Светодиод оранжевый', price: 10, cat: 'radio', icon: '🟠' },
  res: { name: 'Резистор 100 Ом', price: 4, cat: 'radio', icon: '〰️', desc: 'Ограничивает ток. Без него светодиод сгорит.' },
  strip: { name: 'Светодиодная RGB-лента', price: 90, cat: 'radio', icon: '🌈', desc: 'Резисторы уже встроены.' },
  buzzer: { name: 'Пьезо-пищалка', price: 25, cat: 'radio', icon: '📢', desc: 'Полярная! Плюс к плюсу.' },
  tilt: { name: 'Датчик наклона', price: 30, cat: 'radio', icon: '📐', desc: 'Шарик внутри замыкает контакты, если трясти.' },
  micro: { name: 'Концевик (микрик)', price: 15, cat: 'radio', icon: '🖲️', desc: 'Срабатывает от тормозной ручки.' },
  mcu: { name: 'Ардуинка Нано (клон)', price: 160, cat: 'radio', icon: '🧠', desc: 'Маленький компьютер.' },
  oled: { name: 'OLED-дисплей 0.96"', price: 120, cat: 'radio', icon: '📟' },
  hall: { name: 'Датчик Холла + магнит', price: 45, cat: 'radio', icon: '🧲', desc: 'Считает обороты по магниту.' },
  bt: { name: 'Bluetooth-аудиомодуль', price: 90, cat: 'radio', icon: '📶' },
  amp: { name: 'Усилитель PAM8403', price: 60, cat: 'radio', icon: '🎛️' },
  spk: { name: 'Динамик 3 Вт', price: 55, cat: 'radio', icon: '🔈' },
  // --- инструмент и расходники
  solder: { name: 'Припой с канифолью', price: 30, cat: 'tools', icon: '🧵', pack: 10, unit: 'точек', desc: '10 точек пайки.' },
  wire: { name: 'Провода', price: 20, cat: 'tools', icon: '〽️', pack: 5, unit: 'шт', desc: '5 проводков.' },
  multimeter: { name: 'Мультиметр', price: 220, cat: 'tools', icon: '📟', tool: true, desc: 'Кнопка «Прозвонить»: найдёт ошибки и КЗ ДО включения.' },
  station: { name: 'Паяльная станция', price: 450, cat: 'tools', icon: '🔥', tool: true, desc: 'Держит температуру: зона идеальной пайки шире.' },
  // --- автозапчасти / ГСМ
  wd40: { name: 'Проникающая смазка', price: 70, cat: 'auto', icon: '🧴', desc: 'Для закисших болтов.' },
  carbclean: { name: 'Очиститель карбюратора', price: 80, cat: 'auto', icon: '🧯' },
  plug: { name: 'Свеча зажигания', price: 60, cat: 'auto', icon: '⚡' },
  carbkit: { name: 'Ремкомплект карбюратора', price: 120, cat: 'auto', icon: '🧩', desc: 'Мембраны и прокладки.' },
  fuelhose: { name: 'Топливный шланг', price: 40, cat: 'auto', icon: '🪱' },
  electrodes: { name: 'Электроды для сварки', price: 50, cat: 'auto', icon: '🥢', desc: 'Сварку даст сосед Петрович.' },
  petrol: { name: 'Бензин АИ-92', price: 65, cat: 'auto', icon: '⛽', pack: 1000, unit: 'мл', desc: '1 литр.' },
  oil: { name: 'Масло 2Т', price: 45, cat: 'auto', icon: '🛢️', pack: 100, unit: 'мл', desc: '100 мл. Для двухтактных моторов.' },
  pistonkit: { name: 'Поршневая группа', price: 400, cat: 'auto', icon: '🔩', desc: 'Ремонт мотора, если его заклинило.' },
  // --- барахолка
  chainsaw: { name: 'Старая бензопила', price: 700, cat: 'flea', icon: '🪚', desc: '«Работала, когда ставили в сарай. Лет 15 назад.»' },
  wheel: { name: 'Колесо с шипами', price: 350, cat: 'flea', icon: '🛞', desc: 'От детского квадроцикла. Шипы — саморезы.' },
  chain: { name: 'Цепь', price: 150, cat: 'flea', icon: '⛓️' },
  sprocket: { name: 'Звёздочка-заготовка', price: 120, cat: 'flea', icon: '⚙️', desc: 'Нужно выточить. Можно запороть.' },
  metal: { name: 'Профиль и уголок', price: 180, cat: 'flea', icon: '📏', desc: 'Для рамы мотора.' },
  // --- улучшения
  wax: { name: 'Парафин для полозьев', price: 140, cat: 'upgrade', icon: '🕯️', tool: true, desc: 'Меньше трение — выше скорость.' },
  grips: { name: 'Грипсы на руль', price: 70, cat: 'upgrade', icon: '✊', tool: true, desc: 'Сальто крутится быстрее.' },
  seat: { name: 'Мягкое сиденье', price: 160, cat: 'upgrade', icon: '🛋️', tool: true, desc: 'Прощает кривые и жёсткие приземления.' },
  shovel2: { name: 'Большая лопата', price: 200, cat: 'upgrade', icon: '🪏', tool: true, desc: 'Строить горку быстрее и шире.' },
  bucket: { name: 'Ведро для заливки', price: 90, cat: 'upgrade', icon: '🪣', tool: true, desc: 'Заливай дорожки льдом — скользко и быстро!' },
  bigtank: { name: 'Увеличенный бак', price: 250, cat: 'upgrade', icon: '🛢️', tool: true, desc: 'Бак 1.2 л вместо 0.5 л.' },
  snow: { name: 'Самосвал снега', price: 100, cat: 'upgrade', icon: '🚚', desc: '+400 снега для стройки горок.' },
};

// ===== Электронные проекты (пайка) =====
const PROJECTS = [
  {
    id: 'headlight', name: 'Фара', icon: '🔦', diff: 1,
    desc: 'Аккумулятор, тумблер и яркий светодиод. Классика.',
    effect: 'Свет ночью (клавиша L). Ночные заезды ×1.5 монет.',
    parts: { battery: 1, switch: 1, led_w: 1 },
    comps: [
      { id: 'bat', t: 'battery', x: 190, y: 340 },
      { id: 'sw', t: 'switch', x: 400, y: 140 },
      { id: 'led', t: 'led', x: 620, y: 250, color: '#ffffff', label: 'Белый LED' },
    ],
    nets: [['bat.+', 'sw.1'], ['sw.2', 'led.A'], ['led.K', 'bat.-']],
    hint: ['Плюс аккумулятора → тумблер', 'Тумблер → анод светодиода (A+)', 'Катод светодиода (K−) → минус аккумулятора'],
  },
  {
    id: 'horn', name: 'Клаксон', icon: '📯', diff: 1,
    desc: 'Тактовая кнопка и пищалка. Бип-бип!',
    effect: 'Клаксон на клавишу H.',
    parts: { battery: 1, tact: 1, buzzer: 1 },
    comps: [
      { id: 'bat', t: 'battery', x: 200, y: 350 },
      { id: 'bt', t: 'tact', x: 400, y: 130 },
      { id: 'bz', t: 'buzzer', x: 620, y: 260 },
    ],
    nets: [['bat.+', 'bt.1'], ['bt.2', 'bz.+'], ['bz.-', 'bat.-']],
    hint: ['Плюс → кнопка', 'Кнопка → плюс пищалки', 'Минус пищалки → минус аккумулятора'],
  },
  {
    id: 'stoplight', name: 'Стоп-сигнал', icon: '🛑', diff: 2,
    desc: 'Концевик на тормозе зажигает красный светодиод. Не забудь резистор!',
    effect: 'Красный свет при торможении (S / ↓).',
    parts: { battery: 1, micro: 1, res: 1, led_r: 1 },
    comps: [
      { id: 'bat', t: 'battery', x: 180, y: 360 },
      { id: 'mic', t: 'micro', x: 180, y: 130 },
      { id: 'r', t: 'res', x: 430, y: 140 },
      { id: 'led', t: 'led', x: 650, y: 250, color: '#ff1744', label: 'Красный LED' },
    ],
    nets: [['bat.+', 'mic.1'], ['mic.2', 'r.1'], ['r.2', 'led.A'], ['led.K', 'bat.-']],
    hint: ['Плюс → концевик', 'Концевик → резистор', 'Резистор → анод (A+)', 'Катод (K−) → минус'],
  },
  {
    id: 'underglow', name: 'Подсветка днища', icon: '🌈', diff: 1,
    desc: 'RGB-лента под рамой. Цвет выбирается в гараже.',
    effect: 'Неоновое свечение. +10% монет за стиль.',
    parts: { battery: 1, switch: 1, strip: 1 },
    comps: [
      { id: 'bat', t: 'battery', x: 190, y: 350 },
      { id: 'sw', t: 'switch', x: 170, y: 120 },
      { id: 'st', t: 'strip', x: 540, y: 250 },
    ],
    nets: [['bat.+', 'sw.1'], ['sw.2', 'st.+'], ['st.-', 'bat.-']],
    hint: ['Плюс → тумблер', 'Тумблер → плюс ленты', 'Минус ленты → минус аккумулятора'],
  },
  {
    id: 'turn', name: 'Поворотники', icon: '↔️', diff: 3,
    desc: 'Две тактовые кнопки, два оранжевых светодиода и два резистора.',
    effect: 'Поворотники на Q / E. Показал поворот перед трамплином — бонус!',
    parts: { battery: 1, tact: 2, res: 2, led_o: 2 },
    comps: [
      { id: 'bat', t: 'battery', x: 400, y: 395 },
      { id: 'bl', t: 'tact', x: 100, y: 200, label: 'Кнопка Л' },
      { id: 'br', t: 'tact', x: 700, y: 200, label: 'Кнопка П' },
      { id: 'rl', t: 'res', x: 250, y: 90 },
      { id: 'rr', t: 'res', x: 550, y: 90 },
      { id: 'll', t: 'led', x: 310, y: 230, color: '#ff9100', label: 'LED Л' },
      { id: 'lr', t: 'led', x: 490, y: 230, color: '#ff9100', label: 'LED П' },
    ],
    nets: [['bat.+', 'bl.1', 'br.1'], ['bl.2', 'rl.1'], ['rl.2', 'll.A'], ['br.2', 'rr.1'], ['rr.2', 'lr.A'], ['ll.K', 'lr.K', 'bat.-']],
    hint: ['Плюс → обе кнопки', 'Кнопка Л → резистор → анод LED Л', 'Кнопка П → резистор → анод LED П', 'Оба катода (K−) → минус'],
  },
  {
    id: 'alarm', name: 'Сигнализация', icon: '🚨', diff: 3,
    desc: 'Датчик наклона + пищалка + красный индикатор. Если тронут снегокат — орёт.',
    effect: 'Защищает гараж от воришек. Мигающий светодиод на раме.',
    parts: { battery: 1, switch: 1, tilt: 1, buzzer: 1, res: 1, led_r: 1 },
    comps: [
      { id: 'bat', t: 'battery', x: 400, y: 400 },
      { id: 'sw', t: 'switch', x: 110, y: 130 },
      { id: 'tl', t: 'tilt', x: 330, y: 110 },
      { id: 'r', t: 'res', x: 560, y: 110 },
      { id: 'led', t: 'led', x: 700, y: 210, color: '#ff1744', label: 'Индикатор' },
      { id: 'bz', t: 'buzzer', x: 330, y: 250 },
    ],
    nets: [['bat.+', 'sw.1'], ['sw.2', 'tl.1', 'r.1'], ['r.2', 'led.A'], ['tl.2', 'bz.+'], ['bz.-', 'led.K', 'bat.-']],
    hint: ['Плюс → тумблер (взвод)', 'Тумблер → датчик наклона И резистор', 'Резистор → анод индикатора', 'Датчик → плюс пищалки', 'Минус пищалки, катод индикатора → минус'],
  },
  {
    id: 'speedo', name: 'Спидометр', icon: '⏱️', diff: 4, firmware: true,
    desc: 'Ардуинка, дисплей и датчик Холла. Потом прошивка.',
    effect: 'Скорость на экране и рекорд скорости.',
    parts: { battery: 1, mcu: 1, oled: 1, hall: 1 },
    comps: [
      { id: 'bat', t: 'battery', x: 150, y: 120 },
      { id: 'mcu', t: 'mcu', x: 400, y: 330, label: 'Ардуинка' },
      { id: 'dsp', t: 'oled', x: 420, y: 110, label: 'Дисплей' },
      { id: 'hl', t: 'hall', x: 690, y: 170, label: 'Холл' },
    ],
    nets: [['bat.+', 'mcu.VIN'], ['bat.-', 'mcu.GND', 'dsp.GND', 'hl.GND'], ['mcu.5V', 'dsp.VCC', 'hl.VCC'], ['hl.OUT', 'mcu.D2'], ['dsp.SDA', 'mcu.A4'], ['dsp.SCL', 'mcu.A5']],
    hint: ['Плюс → VIN ардуинки', 'Минус → GND ардуинки, дисплея и датчика', '5V ардуинки → VCC дисплея и датчика', 'OUT датчика → D2', 'SDA → A4, SCL → A5'],
  },
  {
    id: 'speaker', name: 'Колонка', icon: '🎵', diff: 4,
    desc: 'Bluetooth-модуль, усилитель и динамик. Музыка на горке!',
    effect: 'Музыка во время заезда. +10% монет.',
    parts: { battery: 1, switch: 1, bt: 1, amp: 1, spk: 1 },
    comps: [
      { id: 'bat', t: 'battery', x: 150, y: 400 },
      { id: 'sw', t: 'switch', x: 110, y: 150 },
      { id: 'bt', t: 'bt', x: 340, y: 120, label: 'BT-модуль' },
      { id: 'amp', t: 'amp', x: 560, y: 200, label: 'Усилитель' },
      { id: 'sp', t: 'spk', x: 700, y: 340 },
    ],
    nets: [['bat.+', 'sw.1'], ['sw.2', 'bt.VCC', 'amp.VCC'], ['bat.-', 'bt.GND', 'amp.GND'], ['bt.OUT', 'amp.IN'], ['amp.O+', 'sp.+'], ['amp.O-', 'sp.-']],
    hint: ['Плюс → тумблер', 'Тумблер → VCC модуля и усилителя', 'Минус → GND модуля и усилителя', 'OUT модуля → IN усилителя', 'O+ → плюс динамика, O− → минус'],
  },
];

// ===== Этапы сборки мотора =====
const MOTOR_STAGES = [
  { id: 'buy', name: 'Притащить пилу', icon: '🪚', req: { chainsaw: 1 }, desc: 'Купи старую бензопилу на барахолке и притащи в гараж.' },
  { id: 'bolts', name: 'Разборка', icon: '🔧', req: { wd40: 1 }, desc: 'Открути болты крышки. Ржавые сначала побрызгай смазкой и подожди — иначе сорвёшь грани!' },
  { id: 'clean', name: 'Чистка карбюратора', icon: '🧽', req: { carbclean: 1 }, desc: 'Отмой 15 лет грязи и продуй жиклёр.' },
  { id: 'parts', name: 'Замена свечи и мембран', icon: '⚡', req: { plug: 1, carbkit: 1, fuelhose: 1 }, desc: 'Поставь новые детали на места и выставь зазор свечи.' },
  { id: 'lathe', name: 'Вал и звёздочка', icon: '⚙️', req: { sprocket: 1 }, desc: 'Выточи звёздочку на токарном станке. Три промаха — заготовка в брак!' },
  { id: 'weld', name: 'Рама и крепление', icon: '🔥', req: { metal: 1, electrodes: 1 }, desc: 'Свари раму для мотора. Веди электрод ровно по шву.' },
  { id: 'chain', name: 'Колесо и цепь', icon: '🛞', req: { wheel: 1, chain: 1 }, desc: 'Поставь колесо, натяни цепь и выставь соосность.' },
  { id: 'start', name: 'Первый запуск', icon: '🔥', req: {}, fuel: 60, desc: 'Залей смесь в бак. Подсос, дёргай стартер, не залей свечу!' },
  { id: 'tune', name: 'Регулировка карбюратора', icon: '🎛️', req: {}, fuel: 40, desc: 'Винты L и H. Ровный холостой и максимум оборотов без перегрева.' },
];

// ===== Достижения =====
const ACH = [
  { id: 'first_ride', name: 'Первый заезд', desc: 'Скатиться с горки', reward: 20 },
  { id: 'first_flip', name: 'Сальтуха!', desc: 'Сделать сальто и приземлиться', reward: 60 },
  { id: 'double', name: 'Двойное', desc: 'Двойное сальто', reward: 150 },
  { id: 'triple', name: 'Легенда двора', desc: 'Тройное сальто', reward: 400 },
  { id: 'big_air', name: 'Полёт нормальный', desc: 'Провести в воздухе 2 секунды', reward: 100 },
  { id: 'long_jump', name: 'Дальнобой', desc: 'Прыжок дальше 20 метров', reward: 150 },
  { id: 'combo3', name: 'Комбо-мастер', desc: '3 разных трюка за один прыжок', reward: 200 },
  { id: 'crash10', name: 'Каскадёр', desc: 'Упасть 10 раз', reward: 50 },
  { id: 'first_solder', name: 'Паяльщик', desc: 'Собрать первую схему', reward: 30 },
  { id: 'short', name: 'Бабах!', desc: 'Устроить короткое замыкание', reward: 10 },
  { id: 'all_electro', name: 'Главный по электронике', desc: 'Установить всю электронику', reward: 500 },
  { id: 'night', name: 'Ночной гонщик', desc: 'Ночной заезд с включённой фарой', reward: 60 },
  { id: 'signal', name: 'Вежливый водитель', desc: 'Показать поворотник перед прыжком', reward: 30 },
  { id: 'builder', name: 'Архитектор', desc: 'Перекидать лопатой 1000 снега', reward: 80 },
  { id: 'motor', name: 'Моторизация', desc: 'Собрать мотор из бензопилы', reward: 1000 },
  { id: 'climb', name: 'Сам заехал', desc: 'Заехать на моторе обратно на стартовую горку', reward: 200 },
  { id: 'speed', name: 'Ракета', desc: 'Разогнаться до 50 км/ч (нужен спидометр)', reward: 200 },
  { id: 'thief', name: 'Сигналка спасла', desc: 'Сигнализация спугнула воришку', reward: 50 },
  { id: 'rich', name: 'Богач', desc: 'Накопить 3000 монет', reward: 0 },
];

const PAINTS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ff6d00', '#212121', '#eceff1', '#00bfa5', '#f06292'];
const GLOWS = ['#00e5ff', '#ff00e5', '#76ff03', '#ffea00', '#ff3d00', '#651fff', '#ffffff'];

const TRICKS = {
  KeyZ: { name: 'Супермен', pose: 'superman', rate: 420 },
  KeyX: { name: 'Без рук', pose: 'nohands', rate: 260 },
  KeyC: { name: 'Канкан', pose: 'kankan', rate: 300 },
  KeyV: { name: 'Шпагат', pose: 'split', rate: 460 },
};
