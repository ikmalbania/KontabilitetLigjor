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
  const isReference = body.isReference === true;
  if (!course || !num || !label) {
    return json(400, { error: 'Mungon course, num, ose label.' });
  }
  // Numbered modules keep the original strict digits-only rule.
  // Reference pages (glossary, legal framework, bibliography, etc.) use
  // a short slug instead, since "Moduli glossary" makes no sense as a
  // number - they're grouped and labeled separately in the nav.
  const validNum = isReference ? /^[a-z0-9-]+$/.test(num) : /^\d+$/.test(num);
  if (!validNum) {
    return json(400, { error: isReference
      ? 'Identifikuesi i materialit referues duhet të jetë shkronja të vogla/numra/vizë (p.sh. "fjalori").'
      : 'num duhet të jetë vetëm numra (p.sh. "11").' });
  }

  const store = getStore('ikm-courses');
  const registry = (await store.get('registry', { type: 'json' })) || {};
  if (!registry[course]) {
    return json(404, { error: 'Ky kurs nuk ekziston.' });
  }
  if (registry[course].modules.some((m) => m.num === num)) {
    return json(409, { error: 'Ky modul ekziston tashmë në këtë kurs.' });
  }

  const entry = { num, label };
  if (isReference) entry.isReference = true;
  registry[course].modules.push(entry);
  if (!isReference) {
    registry[course].totalModules = Math.max(registry[course].totalModules || 0, registry[course].modules.filter((m) => !m.isReference).length);
  }
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
