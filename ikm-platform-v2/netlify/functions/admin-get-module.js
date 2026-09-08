const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');

exports.handler = async (event) => {
  connectLambda(event);
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const denied = requireAdmin(event);
  if (denied) return denied;

  const { course, modnum } = event.queryStringParameters || {};
  if (!course || !modnum) {
    return json(400, { error: 'Mungon course ose modnum.' });
  }

  const store = getStore('ikm-content');
  const content = await store.get(`${course}/modul-${modnum}`, { type: 'json' });
  if (!content) {
    return json(404, { error: 'Nuk u gjet përmbajtje për këtë modul.' });
  }

  return json(200, content);
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
