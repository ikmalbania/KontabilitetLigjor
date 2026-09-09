const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

exports.handler = async (event) => {
  connectLambda(event);
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const denied = requireAdmin(event);
  if (denied) return denied;

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Kërkesë e pavlefshme.' });
  }

  const slug = String(body.slug || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  if (!SLUG_RE.test(slug)) {
    return json(400, { error: 'Slug i pavlefshëm — përdor vetëm shkronja të vogla, numra, dhe vizë (-), p.sh. "kursi-i-ri".' });
  }
  if (!name) {
    return json(400, { error: 'Mungon emri i kursit.' });
  }

  const store = getStore('ikm-courses');
  const registry = (await store.get('registry', { type: 'json' })) || {};
  if (registry[slug]) {
    return json(409, { error: 'Ky slug ekziston tashmë.' });
  }

  registry[slug] = { name, modules: [], totalModules: 0 };
  await store.setJSON('registry', registry);

  return json(200, { ok: true, slug });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
