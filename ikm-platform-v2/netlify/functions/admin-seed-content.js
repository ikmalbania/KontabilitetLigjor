const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');
// Bundled at deploy time - Netlify's function bundler traces this require
// and includes the JSON file in the function's deployment package.
const modulesData = require('../../modules_data.json');

// The same registry that used to live as the hardcoded COURSES dict in
// build_html.py, now the seed value for ikm-courses/registry. Editable
// afterwards via the admin API - this is just the starting point.
const DEFAULT_REGISTRY = {
  'kontabilist-ligjor': {
    name: 'Kontabilist Ligjor',
    modules: [
      { num: '1', label: 'Hyrje në Ekzaminimin e Mashtrimeve' },
      { num: '2', label: 'Psikologjia e Mashtruesit' },
      { num: '3', label: 'Teknikat e Zbulimit të Mashtrimit' },
      { num: '4', label: 'Procesi Investigativ' },
      { num: '5', label: 'Mbledhja dhe Vlerësimi i Provave' },
      { num: '6', label: 'Transaksionet Financiare dhe Skemat e Mashtrimit' },
      { num: '7', label: 'Skemat e Ryshfetit dhe Korrupsionit' },
      { num: '8', label: 'Shpërdorimi i Aktiveve' },
      { num: '9', label: 'Skemat e Mashtrimit në Epokën Digjitale' },
      { num: '10', label: 'Raporti i Mashtrimit dhe Procesi i Rikuperimit' },
    ],
    totalModules: 10,
  },
};

exports.handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const denied = requireAdmin(event);
  if (denied) return denied;

  const force = (JSON.parse(event.body || '{}').force) === true;

  const contentStore = getStore('ikm-content');
  const coursesStore = getStore('ikm-courses');

  const results = { modules: [], registry: null };

  // Registry: only write if absent, unless force=true (force would wipe
  // any course/module edits made since - the admin UI warns about this).
  const existingRegistry = await coursesStore.get('registry', { type: 'json' });
  if (!existingRegistry || force) {
    await coursesStore.setJSON('registry', DEFAULT_REGISTRY);
    results.registry = 'seeded';
  } else {
    results.registry = 'already present, left as-is';
  }

  for (const [modnum, data] of Object.entries(modulesData)) {
    const key = `kontabilist-ligjor/modul-${modnum}`;
    const existing = await contentStore.get(key, { type: 'json' });
    if (existing && !force) {
      results.modules.push({ modnum, status: 'already present, skipped' });
      continue;
    }
    await contentStore.setJSON(key, {
      title: data.title,
      blocks: data.blocks,
      updatedAt: new Date().toISOString(),
    });
    results.modules.push({ modnum, status: 'seeded', blocks: data.blocks.length });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results),
  };
};
