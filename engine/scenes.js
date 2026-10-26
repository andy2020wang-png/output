// Scene manifest in timeline order. Each id loads scenes/<id>.js.
// Rendering a subset: index.html?ids=a,b loads only stage.js plus those scene files,
// so a broken scene file never blocks work on the others.
const SCENE_ORDER = ['hook', 'knot', 'clay', 'papyrus', 'oracle', 'bamboo', 'paper', 'print',
  'punch', 'tape', 'floppy', 'disk', 'cloud', 'outro'];
(() => {
  const q = new URLSearchParams(location.search).get('ids');
  const want = q ? q.split(',') : SCENE_ORDER;
  window.SCENE_WANT = SCENE_ORDER.filter(id => want.includes(id));
  document.write(`<script src="data/script.js"><\/script>`);
  document.write(`<script src="data/spectro.js"><\/script>`);
  document.write(`<script src="stage.js"><\/script>`);
  for (const id of window.SCENE_WANT) document.write(`<script src="scenes/${id}.js" onerror="window.__missing=(window.__missing||[]).concat('${id}')"><\/script>`);
})();
