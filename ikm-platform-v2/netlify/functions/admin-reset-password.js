const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');
const { hashPassword } = require('./_password');

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

  const email = String(body.email || '').trim().toLowerCase();
  const newPassword = String(body.newPassword || '');
  if (!email || newPassword.length < 8) {
    return json(400, { error: 'Mungon email, ose fjalëkalimi i ri ka më pak se 8 karaktere.' });
  }

  const store = getStore('ikm-users');
  const record = await store.get(email, { type: 'json' });
  if (!record) return json(404, { error: 'Nuk u gjet një llogari me këtë email.' });

  record.passwordHash = hashPassword(newPassword);
  await store.setJSON(email, record);

  return json(200, { ok: true });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
