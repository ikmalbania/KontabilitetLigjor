const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');

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

  const course = String(body.course || '').trim();
  const num = String(body.num || '').trim();
  const label = String(body.label || '').trim();
  if (!course || !num || !label) {
    return json(400, { error: 'Mungon course, num, ose label.' });
  }
  if (!/^\d+$/.test(num)) {
    return json(400, { error: 'num duhet të jetë vetëm numra (p.sh. "11").' });
  }

  const store = getStore('ikm-courses');
  const registry = (await store.get('registry', { type: 'json' })) || {};
  if (!registry[course]) {
    return json(404, { error: 'Ky kurs nuk ekziston.' });
  }
  if (registry[course].modules.some((m) => m.num === num)) {
    return json(409, { error: 'Ky modul ekziston tashmë në këtë kurs.' });
  }

  registry[course].modules.push({ num, label });
  registry[course].totalModules = Math.max(registry[course].totalModules || 0, registry[course].modules.length);
  await store.setJSON('registry', registry);

  return json(200, { ok: true });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
