'use strict';
/* ==========================================================
   Лунный сад — интерфейс.
   ========================================================== */

const UI = {
  tab: 'garden',
  labSel: [],                 // [{a, b}] выбор в лаборатории
  trade: {
    give: emptyBundle(), want: emptyBundle(),
    gSel: { kind: 'p', k: '', n: 1 },
    wSel: { kind: 'p', sp: '', mut: 'normal', n: 1 },
    code: '', input: '', preview: null, reply: '', error: '',
  },
  albumFilter: 'all',
};

const TABS = [
  { id: 'garden', icon: '🌱', name: 'Сад' },
  { id: 'lab',    icon: '🧪', name: 'Лаборатория' },
  { id: 'store',  icon: '📦', name: 'Склад' },
  { id: 'shop',   icon: '🛒', name: 'Магазин' },
  { id: 'moon',   icon: '🌙', name: 'Луна' },
  { id: 'trade',  icon: '🤝', name: 'Обмен' },
  { id: 'album',  icon: '📖', name: 'Альбом' },
];

/* ---------- помощники ---------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function icon(sp, cls) {
  const s = SPECIES[sp];
  const style = s.hue ? ' style="filter:hue-rotate(' + s.hue + 'deg) saturate(1.3)"' : '';
  return '<span class="sp ' + (s.lunar ? 'glow ' : '') + (cls || '') + '"' + style + '>' + s.emoji + '</span>';
}
function mutBadge(mut) {
  if (!mut || mut === 'normal') return '';
  return '<span class="mut mut-' + mut + '" title="' + MUT[mut].name + ' ×' + MUT[mut].mult + '">' + MUT[mut].icon + ' ' + MUT[mut].name + '</span>';
}
function itemLabel(k) {
  const { sp, mut } = unkey(k);
  return icon(sp) + ' <span>' + esc(SPECIES[sp].name) + '</span> ' + mutBadge(mut);
}
function itemText(k) {
  const { sp, mut } = unkey(k);
  return SPECIES[sp].name + (mut !== 'normal' ? ' (' + MUT[mut].name.toLowerCase() + ')' : '');
}
function sortKeys(keys) {
  return keys.sort((a, b) => {
    const A = unkey(a), B = unkey(b);
    return SPECIES[A.sp].tier - SPECIES[B.sp].tier || SPECIES[A.sp].name.localeCompare(SPECIES[B.sp].name) || MUT[A.mut].rank - MUT[B.mut].rank;
  });
}
function btn(act, label, data, opts) {
  opts = opts || {};
  let attrs = '';
  Object.entries(data || {}).forEach(([k, v]) => { attrs += ' data-' + k + '="' + esc(v) + '"'; });
  return '<button class="btn ' + (opts.cls || '') + '" data-act="' + act + '"' + attrs + (opts.disabled ? ' disabled' : '') + '>' + label + '</button>';
}
function bar(pct, cls) {
  return '<div class="bar ' + (cls || '') + '"><i style="width:' + Math.max(0, Math.min(100, pct)).toFixed(1) + '%"></i></div>';
}

/* ---------- шапка ---------- */

function renderHeader() {
  const t = now();
  document.getElementById('coins').textContent = fmt(S.coins);
  const p = phaseAt(t);
  const ph = PHASES[p];
  document.getElementById('phase').innerHTML = ph.e + ' <span>' + (p === 4
    ? 'Полнолуние! ещё ' + fmtTime(fullMoonEnd(t) - t)
    : 'До полнолуния ' + fmtTime(nextFullMoon(t) - t)) + '</span>';
  document.getElementById('clock').textContent = '⏱ ' + fmtTime(t - S.startedAt);

  const goal = document.getElementById('goal');
  if (!S.hasTicket) {
    const pct = (S.coins / CONFIG.ticketPrice) * 100;
    goal.innerHTML = '<span>🚀 Билет на Луну: ' + fmt(S.coins) + ' / ' + fmt(CONFIG.ticketPrice) + '</span>' + bar(pct, 'gold');
  } else if (!S.wonAt) {
    const mine = ownedCount('me');
    goal.innerHTML = '<span>🚩 Захват Луны: ' + mine + ' / ' + CONFIG.sectorsToWin + ' секторов</span>' + bar((mine / CONFIG.sectorsToWin) * 100, 'moon');
  } else {
    goal.innerHTML = '<span>🏆 Луна захвачена за ' + fmtTime(S.wonAt - S.startedAt) + (S.wonFirst ? ' — вы первые!' : '') + '</span>';
  }
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = TABS.map((t) => {
    let badge = '';
    if (t.id === 'garden') {
      const r = S.beds.filter((b) => b && now() >= b.ready).length;
      if (r) badge = '<b class="badge">' + r + '</b>';
    }
    if (t.id === 'moon') {
      const r = S.moonBeds.filter((b) => b && now() >= b.ready).length;
      if (S.hasTicket && r) badge = '<b class="badge">' + r + '</b>';
    }
    if (t.id === 'lab') {
      const r = S.lab.filter((j) => j && now() >= j.ready).length;
      if (r) badge = '<b class="badge">' + r + '</b>';
    }
    return '<button class="tab' + (UI.tab === t.id ? ' active' : '') + '" data-act="tab" data-id="' + t.id + '"><span class="ti">' + t.icon + '</span><span class="tn">' + t.name + '</span>' + badge + '</button>';
  }).join('');
}

/* ---------- грядки ---------- */

function bedHTML(loc, i, b) {
  if (!b) {
    return '<button class="bed empty" data-act="pickSeed" data-loc="' + loc + '" data-i="' + i + '"><span class="plus">＋</span><span class="nm">Посадить</span></button>';
  }
  const t = now();
  const s = SPECIES[b.sp];
  if (t >= b.ready) {
    return '<button class="bed ready" data-act="harvest" data-loc="' + loc + '" data-i="' + i + '">' + icon(b.sp, 'big bounce') +
      '<span class="nm">' + esc(s.name) + '</span>' + mutBadge(b.mut) + '<span class="cta">Собрать</span></button>';
  }
  const pct = ((t - b.at) / (b.ready - b.at)) * 100;
  const full = phaseAt(b.ready) === 4 ? '<span class="fm" title="Созреет в полнолуние — выше шанс лунной мутации">🌕</span>' : '';
  return '<div class="bed growing" data-at="' + b.at + '" data-ready="' + b.ready + '">' + full + icon(b.sp, 'sprout') +
    '<span class="nm">' + esc(s.name) + '</span>' + mutBadge(b.mut) + bar(pct) + '<span class="left">' + fmtTime(b.ready - t) + '</span></div>';
}

function bedsBlock(loc) {
  const beds = bedsOf(loc);
  const ready = beds.filter((b) => b && now() >= b.ready).length;
  const empty = beds.filter((b) => !b).length;
  return '<div class="toolbar">' +
    btn('harvestAll', '🧺 Собрать всё' + (ready ? ' (' + ready + ')' : ''), { loc }, { disabled: !ready, cls: 'primary' }) +
    btn('pickSeed', '🌱 Засадить пустые' + (empty ? ' (' + empty + ')' : ''), { loc, i: -1 }, { disabled: !empty }) +
    '</div><div class="beds">' + beds.map((b, i) => bedHTML(loc, i, b)).join('') + '</div>';
}

function renderGarden() {
  const t = now();
  const ch = mutationChances('earth', t);
  return '<section class="panel"><h2>🌱 Сад на Земле</h2>' +
    '<p class="muted">Растения растут в реальном времени, даже когда игра закрыта. Мутацию определяет момент созревания: ' +
    'в полнолуние 🌕 лунная мутация выпадает в 5 раз чаще.</p>' + bedsBlock('earth') + '</section>' +
    '<section class="panel"><h3>Шансы мутаций сейчас</h3><div class="chips">' +
    ['big', 'golden', 'rainbow', 'lunar'].map((m) => '<span class="chip mut-' + m + '">' + MUT[m].icon + ' ' + MUT[m].name + ' ×' + MUT[m].mult + ': <b>' + (ch[m] * 100).toFixed(2) + '%</b></span>').join('') +
    '</div></section>';
}

/* ---------- лаборатория ---------- */

function plantOptions(selected) {
  const keys = sortKeys(Object.keys(S.plants).filter((k) => S.plants[k] > 0));
  return '<option value="">— выберите растение —</option>' + keys.map((k) =>
    '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + esc(SPECIES[unkey(k).sp].emoji + ' ' + itemText(k)) + ' ×' + S.plants[k] + '</option>').join('');
}

function renderLab() {
  const t = now();
  let html = '<section class="panel"><h2>🧪 Лаборатория</h2><p class="muted">Скрестите два собранных растения и получите семена нового вида. ' +
    'Два одинаковых растения — это клонирование: 2 семени того же вида. Мутации родителей могут передаться семенам, ' +
    'а лунный родитель повышает шанс успеха сложных рецептов на 20%.</p><div class="lab">';
  S.lab.forEach((job, i) => {
    if (job) {
      const A = unkey(job.a), B = unkey(job.b);
      const ready = t >= job.ready;
      html += '<div class="labslot ' + (ready ? 'ready' : '') + '"' + (ready ? '' : ' data-at="' + job.at + '" data-ready="' + job.ready + '"') + '>' +
        '<div class="pair">' + icon(A.sp, 'big') + '<span class="x">×</span>' + icon(B.sp, 'big') + '</div>' +
        '<div class="muted">' + esc(itemText(job.a)) + ' × ' + esc(itemText(job.b)) + '</div>' +
        (ready ? btn('collectCross', '🧬 Забрать семена', { slot: i }, { cls: 'primary' })
          : bar(((t - job.at) / (job.ready - job.at)) * 100) + '<span class="left">' + fmtTime(job.ready - t) + '</span>') + '</div>';
    } else {
      const sel = UI.labSel[i] || (UI.labSel[i] = { a: '', b: '' });
      if (sel.a && !S.plants[sel.a]) sel.a = '';
      if (sel.b && !S.plants[sel.b]) sel.b = '';
      const pv = crossPreview(sel.a, sel.b);
      let pvText = '';
      if (pv) {
        if (pv.kind === 'clone') pvText = '🧬 Клонирование: 2 семени «' + esc(SPECIES[pv.sp].name) + '»' + (S.plants[sel.a] < 2 ? ' — нужно 2 штуки' : '');
        else if (pv.kind === 'known') pvText = '📖 Рецепт: ' + icon(pv.sp) + ' ' + esc(SPECIES[pv.sp].name) + (pv.chance < 1 ? ' (шанс ' + Math.round(pv.chance * 100) + '%)' : '');
        else if (pv.kind === 'weed') pvText = '🌾 Уже пробовали — получится сорняк';
        else pvText = '❓ Неизвестная комбинация — эксперимент!';
        pvText += '<br><span class="muted">Время: ' + fmtTime(labTime(unkey(sel.a).sp, unkey(sel.b).sp)) + '</span>';
      }
      html += '<div class="labslot"><label>Родитель 1<select data-change="labSel" data-slot="' + i + '" data-which="a">' + plantOptions(sel.a) + '</select></label>' +
        '<label>Родитель 2<select data-change="labSel" data-slot="' + i + '" data-which="b">' + plantOptions(sel.b) + '</select></label>' +
        '<div class="preview">' + pvText + '</div>' +
        btn('startCross', '⚗️ Скрестить', { slot: i }, { cls: 'primary', disabled: !(sel.a && sel.b) }) + '</div>';
    }
  });
  html += '</div>';
  if (S.lab.length < 3) html += '<p class="muted">Дополнительные слоты лаборатории продаются в Магазине.</p>';
  return html + '</section>';
}

/* ---------- склад ---------- */

function renderStore() {
  const t = now();
  const pk = sortKeys(Object.keys(S.plants));
  const sk = sortKeys(Object.keys(S.seeds));
  let html = '<section class="panel"><h2>📦 Растения</h2><p class="muted">Цены на рынке меняются каждые ' + CONFIG.marketSlotMin +
    ' мин. (следующее изменение через ' + fmtTime(nextMarketChange(t) - t) + '). Лунные растения и лунные мутации берёт Лунная почта — втрое дороже.</p>';
  if (!pk.length) html += '<p class="empty">Пока пусто. Соберите урожай в саду.</p>';
  else {
    html += '<div class="toolbar">' + btn('sellNormal', '💰 Продать всё без мутаций') + '</div><div class="list">';
    pk.forEach((k) => {
      const { sp, mut } = unkey(k);
      const price = marketPrice(sp, mut, t);
      const tr = marketTrend(sp, t);
      const arrow = tr > 0.05 ? '<span class="up">▲</span>' : tr < -0.05 ? '<span class="down">▼</span>' : '';
      html += '<div class="row"><div class="what">' + itemLabel(k) + ' <b class="cnt">×' + S.plants[k] + '</b></div>' +
        '<div class="price">' + fmt(price) + ' 🪙 ' + arrow + '</div><div class="acts">' +
        btn('sell', 'Продать 1', { k, n: 1 }) + (S.plants[k] > 1 ? btn('sell', 'Все', { k, n: S.plants[k] }) : '') +
        (isLunarItem(sp, mut) ? btn('sellMoon', '🌙 ' + fmt(moonPostPrice(sp, mut) * S.plants[k]), { k }, { cls: 'lunarbtn' }) : '') +
        '</div></div>';
    });
    html += '</div>';
  }
  html += '</section><section class="panel"><h2>🌰 Семена</h2>';
  if (!sk.length) html += '<p class="empty">Семян нет. Купите их в Магазине или получите при сборе урожая.</p>';
  else {
    html += '<div class="list">';
    sk.forEach((k) => {
      const { sp } = unkey(k);
      html += '<div class="row"><div class="what">' + itemLabel(k) + ' <b class="cnt">×' + S.seeds[k] + '</b></div>' +
        '<div class="price muted">' + fmtTime(growTime(sp, SPECIES[sp].where === 'moon' ? 'moon' : 'earth')) + (SPECIES[sp].where === 'moon' ? ' · только Луна' : '') + '</div></div>';
    });
    html += '</div>';
  }
  return html + '</section>';
}

/* ---------- магазин ---------- */

function upgradeCard(id) {
  const u = UPGRADES[id];
  const c = upgradeCost(id);
  return '<div class="card"><div class="ci">' + u.icon + '</div><div class="cb"><b>' + u.name + '</b><span class="muted">' + u.desc + '</span>' +
    '<span class="lvl">Уровень ' + u.level() + ' / ' + u.max + '</span></div>' +
    (c == null ? '<span class="maxed">Максимум</span>' : btn('upgrade', fmt(c) + ' 🪙', { id }, { disabled: S.coins < c })) + '</div>';
}

function renderShop() {
  let html = '<section class="panel"><h2>🛒 Семена</h2><div class="cards">';
  SPECIES_LIST.filter((s) => s.seed).forEach((s) => {
    html += '<div class="card"><div class="ci">' + icon(s.id) + '</div><div class="cb"><b>' + esc(s.name) + '</b><span class="muted">Растёт ' + fmtTime(growTime(s.id, 'earth')) +
      ' · продажа ~' + fmt(s.price) + '</span></div><div class="acts">' +
      btn('buySeed', '×1 · ' + fmt(s.seed), { sp: s.id, n: 1 }, { disabled: S.coins < s.seed }) +
      btn('buySeed', '×10 · ' + fmt(s.seed * 10), { sp: s.id, n: 10 }, { disabled: S.coins < s.seed * 10 }) + '</div></div>';
  });
  html += '</div></section><section class="panel"><h2>🔧 Улучшения сада</h2><div class="cards">' +
    ['beds', 'fert', 'green', 'lab'].map(upgradeCard).join('') + '</div></section>';
  html += '<section class="panel ticket"><h2>🚀 Билет на Луну</h2>';
  if (S.hasTicket) html += '<p>Билет куплен за <b>' + fmtTime(S.ticketAt - S.startedAt) + '</b> от начала игры.</p>';
  else {
    html += '<p>Главная цель — улететь на Луну как можно быстрее и захватить её раньше соперников.</p>' +
      bar((S.coins / CONFIG.ticketPrice) * 100, 'gold') +
      '<div class="toolbar">' + btn('buyTicket', 'Купить за ' + fmt(CONFIG.ticketPrice) + ' 🪙', {}, { cls: 'primary', disabled: S.coins < CONFIG.ticketPrice }) + '</div>';
  }
  return html + '</section>';
}

/* ---------- Луна ---------- */

function renderRace() {
  let html = '<section class="panel"><h2>🏁 Гонка за Луну</h2><p class="muted">Захватите ' + CONFIG.sectorsToWin + ' из ' + CONFIG.sectors +
    ' секторов раньше соперников. Соперники живут по реальному времени, даже когда игра закрыта.</p><div class="rivals">';
  html += '<div class="rival me"><span class="ri">🧑‍🌾</span><div><b>' + esc(S.name) + ' (вы)</b><span class="muted">' +
    (S.hasTicket ? 'На Луне · секторов: ' + ownedCount('me') : 'Копит на билет: ' + Math.min(100, Math.floor((S.coins / CONFIG.ticketPrice) * 100)) + '%') + '</span></div></div>';
  CONFIG.rivals.forEach((r) => {
    const st = rivalStatus(r);
    html += '<div class="rival" style="--rc:' + r.color + '"><span class="ri">' + r.icon + '</span><div><b>' + esc(r.name) + '</b><span class="muted">' +
      (st.landed ? 'На Луне · секторов: ' + st.sectors + (S.sectors.some((x) => !x) ? ' · следующий через ' + fmtTime(st.next) : '')
        : 'Летит через ' + fmtTime(st.eta)) + '</span>' + (st.landed ? '' : bar(st.pct * 100, 'thin')) + '</div></div>';
  });
  html += '</div><div class="sectors">';
  S.sectors.forEach((o, i) => {
    const r = o && o !== 'me' ? CONFIG.rivals.find((x) => x.id === o) : null;
    const style = r ? ' style="--rc:' + r.color + '"' : '';
    const label = o === 'me' ? '🚩 Ваш' : r ? r.icon + ' ' + esc(r.name) : 'Свободен';
    let act = '';
    if (S.hasTicket && o !== 'me') {
      const c = sectorCost(i);
      act = btn('capture', (r ? 'Отбить · ' : 'Захватить · ') + fmt(c), { i }, { disabled: S.coins < c, cls: 'small' });
    }
    html += '<div class="sector ' + (o === 'me' ? 'mine' : r ? 'rival' : 'free') + '"' + style + '><span class="sn">Сектор ' + (i + 1) + '</span><span>' + label + '</span>' + act + '</div>';
  });
  html += '</div>';
  if (S.news.length) {
    html += '<details class="news"><summary>📰 Лунные новости</summary><ul>' +
      S.news.slice(0, 15).map((n) => '<li><span class="muted">' + new Date(n.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + '</span> ' + esc(n.text) + '</li>').join('') + '</ul></details>';
  }
  return html + '</section>';
}

function renderMoonPost() {
  let html = '<section class="panel post"><h2>📮 Лунная почта</h2><p class="muted">Покупает лунные растения и всё с лунной мутацией втрое дороже рынка. ' +
    'Продаёт семена, которые растут только на лунной базе.</p><h3>Семена с Луны</h3><div class="cards">';
  SPECIES_LIST.filter((s) => s.moonSeed).forEach((s) => {
    html += '<div class="card"><div class="ci">' + icon(s.id) + '</div><div class="cb"><b>' + esc(s.name) + '</b><span class="muted">Только Луна · продажа ~' + fmt(s.price) + '</span></div>' +
      btn('buyMoonSeed', fmt(s.moonSeed) + ' 🪙', { sp: s.id }, { disabled: S.coins < s.moonSeed }) + '</div>';
  });
  html += '</div><h3>Отправить на Луну</h3>';
  const lunarKeys = sortKeys(Object.keys(S.plants).filter((k) => { const u = unkey(k); return isLunarItem(u.sp, u.mut); }));
  if (!lunarKeys.length) html += '<p class="empty">Нет лунных растений. Выведите Лунный бутон или поймайте лунную мутацию в полнолуние.</p>';
  else {
    html += '<div class="list">' + lunarKeys.map((k) => {
      const u = unkey(k);
      return '<div class="row"><div class="what">' + itemLabel(k) + ' <b class="cnt">×' + S.plants[k] + '</b></div><div class="price">' + fmt(moonPostPrice(u.sp, u.mut)) + ' 🪙</div><div class="acts">' +
        btn('sellMoon', 'Отправить всё', { k }, { cls: 'lunarbtn' }) + '</div></div>';
    }).join('') + '</div>';
  }
  return html + '</section>';
}

function renderMoon() {
  let html = '';
  if (S.wonAt) {
    html += '<section class="panel victory"><h2>🏆 Луна ваша!</h2><p>Вы захватили Луну за <b>' + fmtTime(S.wonAt - S.startedAt) + '</b>' +
      (S.wonFirst ? ' и стали первыми!' : '. Соперник успел раньше, но вы отбили Луну!') + ' Билет был куплен за ' + fmtTime(S.ticketAt - S.startedAt) + '.</p>' +
      '<p class="muted">Можно продолжать: собирайте альбом и выращивайте Сердце Луны.</p></section>';
  }
  if (!S.hasTicket) {
    html += '<section class="panel ticket"><div class="moonart">🌕</div><h2>Луна ждёт</h2><p>Купите билет за <b>' + fmt(CONFIG.ticketPrice) +
      ' 🪙</b>, чтобы открыть лунную базу: лунные грядки, особые семена и захват секторов.</p>' + bar((S.coins / CONFIG.ticketPrice) * 100, 'gold') +
      '<div class="toolbar">' + btn('buyTicket', '🚀 Купить билет', {}, { cls: 'primary', disabled: S.coins < CONFIG.ticketPrice }) + '</div></section>';
  } else {
    const ch = mutationChances('moon', now());
    html += '<section class="panel moonbase"><h2>🌙 Лунная база</h2><p class="muted">На Луне лунная мутация выпадает в ' + CONFIG.moonLunarMult +
      ' раз чаще (сейчас ' + (ch.lunar * 100).toFixed(2) + '%). Здесь же растут лунные виды.</p>' + bedsBlock('moon') +
      '<h3>Улучшения базы</h3><div class="cards">' + ['moonBeds', 'dome', 'incub'].map(upgradeCard).join('') + '</div></section>';
  }
  return html + renderRace() + renderMoonPost();
}

/* ---------- обмен ---------- */

function bundleListHTML(b, side) {
  const lines = bundleLines(b);
  if (!lines.length) return '<p class="empty">Пусто</p>';
  return '<ul class="blist">' + lines.map((l) => {
    const label = l.kind === 'c' ? '🪙 ' + fmt(l.n) + ' монет' : (l.kind === 's' ? '🌰 Семена: ' : '') + itemLabel(l.k) + ' ×' + l.n;
    return '<li>' + label + (side ? btn('tradeRemove', '✕', { side, kind: l.kind, k: l.k || '' }, { cls: 'small ghost' }) : '') + '</li>';
  }).join('') + '</ul>';
}

function renderTrade() {
  const T = UI.trade;
  const g = T.gSel, w = T.wSel;
  // «Отдаю» — только из своего инвентаря
  const gBag = g.kind === 'p' ? S.plants : S.seeds;
  const gKeys = sortKeys(Object.keys(gBag));
  if (g.kind !== 'c' && !gKeys.includes(g.k)) g.k = gKeys[0] || '';
  const gItem = g.kind === 'c'
    ? '<input type="number" min="1" step="1" value="' + g.n + '" data-change="gN">'
    : '<select data-change="gK">' + (gKeys.length ? gKeys.map((k) => '<option value="' + k + '"' + (k === g.k ? ' selected' : '') + '>' + esc(SPECIES[unkey(k).sp].emoji + ' ' + itemText(k)) + ' (есть ' + gBag[k] + ')</option>').join('') : '<option value="">нет предметов</option>') + '</select>' +
      '<input type="number" min="1" step="1" value="' + g.n + '" data-change="gN">';
  // «Хочу» — из известных видов
  const known = SPECIES_LIST.filter((s) => S.discovered[s.id] && s.id !== 'weed');
  if (!w.sp || !S.discovered[w.sp]) w.sp = known[0] ? known[0].id : '';
  const wItem = w.kind === 'c'
    ? '<input type="number" min="1" step="1" value="' + w.n + '" data-change="wN">'
    : '<select data-change="wSp">' + known.map((s) => '<option value="' + s.id + '"' + (s.id === w.sp ? ' selected' : '') + '>' + s.emoji + ' ' + esc(s.name) + '</option>').join('') + '</select>' +
      '<select data-change="wMut">' + MUTATIONS.map((m) => '<option value="' + m.id + '"' + (m.id === w.mut ? ' selected' : '') + '>' + (m.icon || '•') + ' ' + m.name + '</option>').join('') + '</select>' +
      '<input type="number" min="1" step="1" value="' + w.n + '" data-change="wN">';
  const kindSel = (which, v) => '<select data-change="' + which + 'Kind"><option value="p"' + (v === 'p' ? ' selected' : '') + '>Растение</option><option value="s"' + (v === 's' ? ' selected' : '') +
    '>Семена</option><option value="c"' + (v === 'c' ? ' selected' : '') + '>Монеты</option></select>';

  let html = '<section class="panel"><h2>🤝 Обмен с друзьями</h2><p class="muted">Соберите предложение и получите код. Отправьте его другу в любом мессенджере. ' +
    'Друг вставит код у себя, примет обмен и пришлёт код ответа. Пока ответа нет, ваши предметы заморожены. ' +
    'Если поле «Хочу» пустое, получится подарок.</p>' +
    '<label class="field">Ваше имя для друзей <input type="text" maxlength="24" value="' + esc(S.name) + '" data-change="name"></label>' +
    '<div class="tradegrid"><div class="tradebox"><h3>Отдаю</h3>' + bundleListHTML(T.give, 'give') +
    '<div class="adder">' + kindSel('g', g.kind) + gItem + btn('tradeAdd', '＋', { side: 'give' }) + '</div></div>' +
    '<div class="tradebox"><h3>Хочу взамен</h3>' + bundleListHTML(T.want, 'want') +
    '<div class="adder">' + kindSel('w', w.kind) + wItem + btn('tradeAdd', '＋', { side: 'want' }) + '</div></div></div>' +
    '<div class="toolbar">' + btn('tradeCreate', '📨 Создать код', {}, { cls: 'primary', disabled: bundleIsEmpty(T.give) }) + '</div>';
  if (T.code) {
    html += '<div class="codebox"><b>Код для друга:</b><textarea readonly rows="3" id="outcode">' + esc(T.code) + '</textarea>' + btn('copy', '📋 Скопировать', { target: 'outcode' }) + '</div>';
  }
  html += '</section><section class="panel"><h2>📥 Получить по коду</h2>' +
    '<textarea rows="3" placeholder="Вставьте код LUNA-…" data-change="tradeInput">' + esc(T.input) + '</textarea>' +
    '<div class="toolbar">' + btn('tradeOpen', '🔍 Открыть код') + '</div>';
  if (T.error) html += '<p class="error">' + esc(T.error) + '</p>';
  if (T.preview) {
    const o = T.preview;
    if (o.type === 'reply') {
      html += '<div class="offer"><b>Ответ от ' + esc(o.name) + '</b>' + bundleListHTML(o.give) + btn('tradeAccept', 'Забрать', {}, { cls: 'primary' }) + '</div>';
    } else {
      html += '<div class="offer"><b>' + (o.type === 'gift' ? '🎁 Подарок' : 'Предложение') + ' от ' + esc(o.name) + '</b><div class="tradegrid"><div><h4>Вы получите</h4>' + bundleListHTML(o.give) + '</div>' +
        (o.type === 'offer' ? '<div><h4>Вы отдадите</h4>' + bundleListHTML(o.want) + '</div>' : '') + '</div>' +
        btn('tradeAccept', o.type === 'gift' ? 'Принять подарок' : 'Принять обмен', {}, { cls: 'primary', disabled: o.type === 'offer' && !bundleHas(o.want) }) +
        btn('tradeDecline', 'Отклонить', {}, { cls: 'ghost' }) +
        (o.type === 'offer' && !bundleHas(o.want) ? '<p class="error">У вас нет всего, что просит друг</p>' : '') + '</div>';
    }
  }
  if (T.reply) {
    html += '<div class="codebox"><b>Отправьте этот код ответа другу, чтобы он получил ваши предметы:</b><textarea readonly rows="3" id="replycode">' + esc(T.reply) + '</textarea>' + btn('copy', '📋 Скопировать', { target: 'replycode' }) + '</div>';
  }
  html += '</section>';
  const pend = Object.entries(S.trade.pending);
  if (pend.length) {
    html += '<section class="panel"><h2>⏳ Ждут ответа</h2>' + pend.map(([id, p]) =>
      '<div class="offer"><div class="tradegrid"><div><h4>Отдаёте</h4>' + bundleListHTML(p.give) + '</div><div><h4>Просите</h4>' + bundleListHTML(p.want) + '</div></div>' +
      btn('tradeCancel', 'Отменить и вернуть предметы', { id }, { cls: 'ghost' }) + '</div>').join('') +
      '<p class="muted">Отменяйте, только если друг точно не принял обмен. Иначе он потеряет свои предметы.</p></section>';
  }
  return html;
}

/* ---------- альбом ---------- */

function renderAlbum() {
  const all = SPECIES_LIST;
  const got = all.filter((s) => S.discovered[s.id]).length;
  let html = '<section class="panel"><h2>📖 Альбом</h2><p class="muted">Открыто видов: <b>' + got + ' / ' + all.length + '</b>. Рецептов: <b>' + Object.keys(S.recipes).length + ' / ' + RECIPE_LIST.length +
    '</b>. Подсказку с рецептом можно купить.</p><div class="album">';
  all.forEach((s) => {
    const d = S.discovered[s.id];
    const r = RECIPE_OF[s.id];
    let how = '';
    if (s.seed) how = 'Магазин';
    else if (s.moonSeed) how = 'Лунная почта';
    else if (s.id === 'weed') how = 'Неудачный опыт';
    else if (r && (S.recipes[s.id] || S.hints[s.id])) how = SPECIES[r.a].emoji + ' ' + esc(SPECIES[r.a].name) + ' + ' + SPECIES[r.b].emoji + ' ' + esc(SPECIES[r.b].name) + (r.chance < 1 ? ' · ' + Math.round(r.chance * 100) + '%' : '');
    else if (r) how = '❓ + ❓ ' + btn('hint', 'Подсказка · ' + fmt(hintCost(s.id)), { sp: s.id }, { cls: 'small', disabled: S.coins < hintCost(s.id) });
    const muts = MUTATIONS.slice(1).map((m) => '<span class="' + (S.muts[s.id] && S.muts[s.id][m.id] ? 'on' : 'off') + '" title="' + m.name + '">' + m.icon + '</span>').join('');
    html += '<div class="acard ' + (d ? '' : 'locked') + (s.lunar ? ' lunarcard' : '') + '"><div class="aicon">' + (d ? icon(s.id, 'big') : '<span class="sp big">❔</span>') + '</div>' +
      '<b>' + (d ? esc(s.name) : '???') + '</b><span class="tier">Уровень ' + s.tier + (s.where === 'moon' ? ' · Луна' : '') + '</span>' +
      (d ? '<span class="muted">~' + fmt(s.price) + ' 🪙 · ' + fmtTime(s.grow * 1000) + '</span><span class="muts">' + muts + '</span>' : '') +
      '<span class="how">' + how + '</span></div>';
  });
  return html + '</div></section>';
}

/* ---------- модальные окна ---------- */

function openModal(html) {
  const m = document.getElementById('modal');
  m.innerHTML = '<div class="mbox">' + html + '</div>';
  m.classList.add('open');
}
function closeModal() {
  const m = document.getElementById('modal');
  m.classList.remove('open');
  m.innerHTML = '';
}

function openSeedPicker(loc, i) {
  const keys = sortKeys(Object.keys(S.seeds).filter((k) => S.seeds[k] > 0 && canPlant(unkey(k).sp, loc)));
  let html = '<h3>' + (i < 0 ? 'Чем засадить пустые грядки?' : 'Что посадить?') + '</h3>';
  if (!keys.length) html += '<p class="empty">Подходящих семян нет. Загляните в Магазин' + (loc === 'moon' ? ' или на Лунную почту' : '') + '.</p>';
  else {
    html += '<div class="seedlist">' + keys.map((k) => {
      const { sp } = unkey(k);
      const t = now() + growTime(sp, loc);
      return '<button class="seedbtn" data-act="plant" data-loc="' + loc + '" data-i="' + i + '" data-k="' + k + '">' + itemLabel(k) +
        '<span class="muted">×' + S.seeds[k] + ' · ' + fmtTime(growTime(sp, loc)) + (phaseAt(t) === 4 ? ' · 🌕 созреет в полнолуние' : '') + '</span></button>';
    }).join('') + '</div>';
  }
  html += '<div class="toolbar">' + btn('closeModal', 'Закрыть', {}, { cls: 'ghost' }) + '</div>';
  openModal(html);
}

function openHelp() {
  openModal('<h3>🌙 Как играть</h3><ol class="help">' +
    '<li><b>Сажайте и собирайте.</b> Семена покупаются в Магазине. Растения растут в реальном времени.</li>' +
    '<li><b>Скрещивайте</b> в Лаборатории: из двух видов получится новый, ценнее. Рецептов ' + RECIPE_LIST.length + ', открывайте их опытом или покупайте подсказки.</li>' +
    '<li><b>Мутации</b> выпадают при сборе: 🔸 крупная ×2, ✨ золотая ×5, 🌈 радужная ×12 и 🌙 лунная ×40 — самая редкая. Лунная чаще выпадает в полнолуние.</li>' +
    '<li><b>Продавайте</b> на рынке (цены меняются) или на Лунной почте: она платит втрое за лунные растения.</li>' +
    '<li><b>Цель:</b> как можно быстрее купить билет на Луну за ' + fmt(CONFIG.ticketPrice) + ' 🪙, построить базу, выращивать лунные виды и первым захватить ' +
    CONFIG.sectorsToWin + ' из ' + CONFIG.sectors + ' секторов. Соперники уже копят!</li>' +
    '<li><b>Обменивайтесь</b> растениями с друзьями через коды на вкладке «Обмен».</li></ol>' +
    '<div class="toolbar">' + btn('closeModal', 'Поехали!', {}, { cls: 'primary' }) + '</div>');
}

function openSettings() {
  openModal('<h3>⚙️ Настройки</h3>' +
    '<label class="field">Имя садовода <input type="text" maxlength="24" value="' + esc(S.name) + '" data-change="name"></label>' +
    '<p class="muted">Игра сохраняется в этом браузере автоматически.<br>Собрано: ' + S.stats.harvested + ' · скрещиваний: ' + S.stats.crosses +
    ' · продано: ' + S.stats.sold + ' · заработано: ' + fmt(S.stats.earned) + ' 🪙</p>' +
    '<div class="toolbar">' + btn('help', '❓ Как играть') + btn('reset', '🗑 Начать заново', {}, { cls: 'danger' }) + btn('closeModal', 'Закрыть', {}, { cls: 'ghost' }) + '</div>');
}

/* ---------- отрисовка ---------- */

const RENDER = { garden: renderGarden, lab: renderLab, store: renderStore, shop: renderShop, moon: renderMoon, trade: renderTrade, album: renderAlbum };

function render() {
  renderHeader();
  renderTabs();
  const main = document.getElementById('main');
  main.innerHTML = RENDER[UI.tab]();
  document.documentElement.classList.toggle('moonmode', UI.tab === 'moon');
}

function flushEvents() {
  const box = document.getElementById('toasts');
  while (EVENTS.length) {
    const e = EVENTS.shift();
    const el = document.createElement('div');
    el.className = 'toast ' + e.kind;
    el.textContent = e.text;
    box.appendChild(el);
    setTimeout(() => el.classList.add('hide'), 3200);
    setTimeout(() => el.remove(), 3700);
  }
  while (box.children.length > 5) box.firstChild.remove();
}

/* Раз в секунду обновляем таймеры, не перерисовывая всё (чтобы не сбивать ввод). */
function updateTimers() {
  const t = now();
  let needRender = false;
  document.querySelectorAll('#main [data-ready]').forEach((el) => {
    const at = +el.dataset.at, ready = +el.dataset.ready;
    if (t >= ready) { needRender = true; return; }
    const i = el.querySelector('.bar > i');
    if (i) i.style.width = (((t - at) / (ready - at)) * 100).toFixed(1) + '%';
    const l = el.querySelector('.left');
    if (l) l.textContent = fmtTime(ready - t);
  });
  return needRender;
}

/* ---------- действия ---------- */

function addToBundle(side) {
  const T = UI.trade;
  const b = side === 'give' ? T.give : T.want;
  const sel = side === 'give' ? T.gSel : T.wSel;
  const n = Math.max(1, Math.floor(+sel.n || 1));
  if (sel.kind === 'c') { b.c += n; return; }
  const k = side === 'give' ? sel.k : key(sel.sp, sel.mut);
  if (!k) return;
  const bag = sel.kind === 'p' ? b.p : b.s;
  bag[k] = (bag[k] || 0) + n;
}

const ACTIONS = {
  tab: (d) => { UI.tab = d.id; window.scrollTo(0, 0); },
  pickSeed: (d) => { openSeedPicker(d.loc, +d.i); return 'keep'; },
  plant: (d) => {
    if (+d.i < 0) plantAll(d.loc, d.k); else plant(d.loc, +d.i, d.k);
    closeModal();
  },
  harvest: (d) => { harvest(d.loc, +d.i); },
  harvestAll: (d) => { harvestAll(d.loc); },
  sell: (d) => { sell(d.k, +d.n, 'market'); },
  sellMoon: (d) => { sell(d.k, S.plants[d.k] || 0, 'moon'); },
  sellNormal: () => { sellAllNormal(); },
  buySeed: (d) => { buySeed(d.sp, +d.n); },
  buyMoonSeed: (d) => { buyMoonSeed(d.sp, 1); },
  upgrade: (d) => { buyUpgrade(d.id); },
  buyTicket: () => { if (buyTicket()) UI.tab = 'moon'; },
  startCross: (d) => {
    const sel = UI.labSel[+d.slot];
    if (sel && startCross(+d.slot, sel.a, sel.b)) UI.labSel[+d.slot] = { a: '', b: '' };
  },
  collectCross: (d) => { collectCross(+d.slot); },
  hint: (d) => { buyHint(d.sp); },
  capture: (d) => {
    const wasWon = S.wonAt;
    captureSector(+d.i);
    if (!wasWon && S.wonAt) openModal('<div class="moonart">🏆</div><h3>Луна захвачена!</h3><p>Вы взяли ' + CONFIG.sectorsToWin + ' секторов за <b>' + fmtTime(S.wonAt - S.startedAt) + '</b>' +
      (S.wonFirst ? '. Вы первые!' : '.') + '</p><div class="toolbar">' + btn('closeModal', 'Ура!', {}, { cls: 'primary' }) + '</div>');
  },
  tradeAdd: (d) => { addToBundle(d.side); },
  tradeRemove: (d) => {
    const b = d.side === 'give' ? UI.trade.give : UI.trade.want;
    if (d.kind === 'c') b.c = 0; else delete (d.kind === 'p' ? b.p : b.s)[d.k];
  },
  tradeCreate: () => {
    const T = UI.trade;
    try {
      T.code = createOffer(T.give, T.want);
      T.give = emptyBundle(); T.want = emptyBundle(); T.error = '';
    } catch (e) { T.error = e.message; emit(e.message, 'bad'); }
  },
  tradeOpen: () => {
    const T = UI.trade;
    T.reply = ''; T.preview = null; T.error = '';
    try { T.preview = decodeCode(T.input); } catch (e) { T.error = e.message; }
  },
  tradeAccept: () => {
    const T = UI.trade;
    try {
      const reply = acceptCode(T.preview);
      T.reply = reply || ''; T.preview = null; T.input = ''; T.error = '';
    } catch (e) { T.error = e.message; }
  },
  tradeDecline: () => { UI.trade.preview = null; UI.trade.input = ''; },
  tradeCancel: (d) => { cancelOffer(d.id); },
  copy: (d) => {
    const el = document.getElementById(d.target);
    if (!el) return 'keep';
    el.select();
    const done = () => emit('Скопировано', 'info');
    if (navigator.clipboard) navigator.clipboard.writeText(el.value).then(done, () => { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
    flushEvents();
    return 'keep';
  },
  closeModal: () => { closeModal(); },
  settings: () => { openSettings(); return 'keep'; },
  help: () => { openHelp(); return 'keep'; },
  reset: () => {
    if (confirm('Точно начать заново? Весь прогресс будет удалён.')) { resetGame(); UI.labSel = []; closeModal(); }
  },
};

const CHANGES = {
  labSel: (el) => { const s = UI.labSel[+el.dataset.slot] || (UI.labSel[+el.dataset.slot] = { a: '', b: '' }); s[el.dataset.which] = el.value; return true; },
  gKind: (el) => { UI.trade.gSel.kind = el.value; UI.trade.gSel.k = ''; return true; },
  gK: (el) => { UI.trade.gSel.k = el.value; },
  gN: (el) => { UI.trade.gSel.n = el.value; },
  wKind: (el) => { UI.trade.wSel.kind = el.value; return true; },
  wSp: (el) => { UI.trade.wSel.sp = el.value; },
  wMut: (el) => { UI.trade.wSel.mut = el.value; },
  wN: (el) => { UI.trade.wSel.n = el.value; },
  tradeInput: (el) => { UI.trade.input = el.value; },
  name: (el) => { S.name = el.value.trim().slice(0, 24) || 'Садовод'; saveGame(); renderHeader(); },
};

function initUI() {
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) {
      if (ev.target.id === 'modal') closeModal();
      return;
    }
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    const r = fn(el.dataset);
    saveGame();
    flushEvents();
    if (r !== 'keep') render();
  });
  const onChange = (ev) => {
    const el = ev.target.closest('[data-change]');
    if (!el) return;
    const fn = CHANGES[el.dataset.change];
    if (fn && fn(el) === true && ev.type === 'change') render();
  };
  document.addEventListener('change', onChange);
  document.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-change]');
    if (el && (el.tagName === 'TEXTAREA' || el.type === 'number')) onChange(ev);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeModal(); });
}
