'use strict';
/* Лунный сад — запуск и игровой цикл. */

(function start() {
  loadGame();
  processRivals();
  initUI();
  render();
  flushEvents();
  if (!S.seenHelp) { S.seenHelp = true; saveGame(); openHelp(); }

  let pending = false;
  let saveTick = 0;
  setInterval(() => {
    const changed = tick();
    if (changed && UI.tab === 'moon') pending = true;
    renderHeader();
    renderTabs();
    if (updateTimers()) pending = true;
    const a = document.activeElement;
    const typing = a && a.closest && a.closest('#main') && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
    if (pending && !typing) { pending = false; render(); }
    flushEvents();
    if (++saveTick % 5 === 0) saveGame();
  }, 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveGame();
    else { tick(); render(); flushEvents(); }
  });
  window.addEventListener('pagehide', saveGame);
})();
