'use strict';
/* ==========================================================
   Лунный сад — обмен с друзьями через коды.
   Сервер не нужен: игрок А создаёт код предложения, отдаёт другу,
   друг принимает и возвращает код ответа.
   Предметы А «замораживаются», пока не придёт ответ или он не отменит обмен.
   ========================================================== */

const CODE_PREFIX = 'LUNA';

/* Набор предметов: { p: {key: n}, s: {key: n}, c: монеты } */
function emptyBundle() { return { p: {}, s: {}, c: 0 }; }
function bundleIsEmpty(b) { return !b.c && !Object.keys(b.p).length && !Object.keys(b.s).length; }

function bundleValid(b) {
  if (!b || typeof b !== 'object') return false;
  const okBag = (bag) => bag && typeof bag === 'object' && Object.entries(bag).every(([k, n]) => {
    const { sp, mut } = unkey(k);
    return SPECIES[sp] && MUT[mut] && Number.isInteger(n) && n > 0 && n <= 1e6;
  });
  return okBag(b.p) && okBag(b.s) && Number.isInteger(b.c) && b.c >= 0 && b.c <= 1e13;
}

function bundleHas(b) {
  if (S.coins < b.c) return false;
  for (const [k, n] of Object.entries(b.p)) if ((S.plants[k] || 0) < n) return false;
  for (const [k, n] of Object.entries(b.s)) if ((S.seeds[k] || 0) < n) return false;
  return true;
}
function bundleTake(b) {
  S.coins -= b.c;
  for (const [k, n] of Object.entries(b.p)) takeItem(S.plants, k, n);
  for (const [k, n] of Object.entries(b.s)) takeItem(S.seeds, k, n);
}
function bundleGive(b) {
  S.coins += b.c;
  for (const [k, n] of Object.entries(b.p)) { addItem(S.plants, k, n); const u = unkey(k); discover(u.sp, u.mut); }
  for (const [k, n] of Object.entries(b.s)) { addItem(S.seeds, k, n); discover(unkey(k).sp); }
}
function bundleLines(b) {
  const out = [];
  for (const [k, n] of Object.entries(b.p)) out.push({ kind: 'p', k, n });
  for (const [k, n] of Object.entries(b.s)) out.push({ kind: 's', k, n });
  if (b.c) out.push({ kind: 'c', n: b.c });
  return out;
}

function encodeCode(obj) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  return CODE_PREFIX + '-' + b64 + '-' + hash(b64).toString(36);
}
function decodeCode(code) {
  const clean = String(code || '').replace(/\s+/g, '');
  const m = clean.match(/^LUNA-([A-Za-z0-9+/=]+)-([a-z0-9]+)$/);
  if (!m) throw new Error('Это не похоже на код обмена');
  if (hash(m[1]).toString(36) !== m[2]) throw new Error('Код повреждён — скопируйте его целиком');
  let obj;
  try { obj = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch (e) { throw new Error('Код не читается'); }
  if (!obj || !['offer', 'gift', 'reply'].includes(obj.type) || typeof obj.id !== 'string') throw new Error('Неизвестный тип кода');
  if (!bundleValid(obj.give) || (obj.type === 'offer' && !bundleValid(obj.want))) throw new Error('В коде неизвестные предметы');
  return obj;
}

function newId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

/* Создать предложение (или подарок, если want пуст). Возвращает код. */
function createOffer(give, want) {
  if (bundleIsEmpty(give) && bundleIsEmpty(want)) throw new Error('Добавьте хотя бы один предмет');
  if (bundleIsEmpty(give)) throw new Error('Нужно что-то предложить взамен');
  if (!bundleHas(give)) throw new Error('У вас нет всего, что вы предлагаете');
  bundleTake(give);
  const id = newId();
  const gift = bundleIsEmpty(want);
  const obj = { type: gift ? 'gift' : 'offer', id, from: S.pid, name: S.name, give, want: gift ? undefined : want };
  if (!gift) S.trade.pending[id] = { give, want, at: now() };
  return encodeCode(obj);
}

/* Принять код друга. Для предложения возвращает код ответа. */
function acceptCode(obj) {
  if (obj.from === S.pid && obj.type !== 'reply') throw new Error('Это ваш собственный код — отправьте его другу');
  if (obj.type === 'gift') {
    if (S.trade.used[obj.id]) throw new Error('Этот подарок уже получен');
    S.trade.used[obj.id] = true;
    bundleGive(obj.give);
    emit('🎁 Подарок от ' + obj.name + ' получен', 'good');
    return null;
  }
  if (obj.type === 'offer') {
    if (S.trade.used[obj.id]) throw new Error('Это предложение уже принято');
    if (!bundleHas(obj.want)) throw new Error('У вас нет всего, что просит ' + obj.name);
    bundleTake(obj.want);
    bundleGive(obj.give);
    S.trade.used[obj.id] = true;
    emit('🤝 Обмен с ' + obj.name + ' состоялся. Отправьте ему код ответа', 'good');
    return encodeCode({ type: 'reply', id: 'r' + obj.id, ref: obj.id, from: S.pid, name: S.name, give: obj.want });
  }
  // reply
  const p = S.trade.pending[obj.ref];
  if (!p) throw new Error(S.trade.used[obj.id] ? 'Ответ уже получен' : 'Этого предложения нет (возможно, вы его отменили)');
  delete S.trade.pending[obj.ref];
  S.trade.used[obj.id] = true;
  bundleGive(obj.give);
  emit('🤝 ' + obj.name + ' принял обмен — предметы получены', 'good');
  return null;
}

function cancelOffer(id) {
  const p = S.trade.pending[id];
  if (!p) return false;
  delete S.trade.pending[id];
  bundleGive(p.give);
  emit('Обмен отменён, предметы вернулись', 'info');
  return true;
}
