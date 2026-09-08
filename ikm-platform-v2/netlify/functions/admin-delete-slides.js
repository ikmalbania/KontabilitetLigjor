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

  const { course, modnum, filename, deleteAll } = body;
  if (!course || !modnum) {
    return json(400, { error: 'Mungon course ose modnum.' });
  }

  const store = getStore('ikm-slides');

  if (deleteAll) {
    const prefix = `${course}/modul-${modnum}/`;
    const { blobs } = await store.list({ prefix });
    await Promise.all(blobs.map((b) => store.delete(b.key)));
    return json(200, { ok: true, deleted: blobs.length });
  }

  if (!filename) {
    return json(400, { error: 'Mungon filename (ose përdor deleteAll: true).' });
  }
  await store.delete(`${course}/modul-${modnum}/${filename}`);
  return json(200, { ok: true, deleted: 1 });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
