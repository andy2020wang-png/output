// 科技树 02 · 造船 — scene manifest in timeline order. Paths are relative to engine/index.html.
// Each id loads ep/ships/scenes/<id>.js, then its incoming transition ep/ships/trans/<id>.js (if present).
// Transitions run in the LAST beat of the outgoing shot and land on the incoming shot's first downbeat.
const SCENE_ORDER = ['hook', 'canoe', 'nile', 'trireme', 'longship', 'fuchuan', 'caravel', 'lineship',
  'steam', 'ironclad', 'dreadnought', 'carrier', 'nuclear', 'outro'];
window.TRANS_LEAD = true;
(() => {
  const q = new URLSearchParams(location.search).get('ids');
  const want = q ? q.split(',') : SCENE_ORDER;
  window.SCENE_WANT = SCENE_ORDER.filter(id => want.includes(id));
  const miss = id => `onerror="window.__missing=(window.__missing||[]).concat('${id}')"`;
  document.write(`<script src="ep/ships/data/script.js"><\/script>`);
  document.write(`<script src="stage.js"><\/script>`);
  for (const id of window.SCENE_WANT) document.write(`<script src="ep/ships/scenes/${id}.js" ${miss(id)}><\/script>`);
  for (const id of window.SCENE_WANT) document.write(`<script src="ep/ships/trans/${id}.js" onerror="0"><\/script>`);
})();
