const { getStore, connectLambda } = require('@netlify/blobs');
const { hashPassword, verifyPassword } = require('./_password');
const { verify } = require('./_session');

exports.handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const cookieHeader = event.headers && (event.headers.cookie || event.headers.Cookie);
  const token = readCookie(cookieHeader, 'ikm_session');
  const session = verify(token);
  if (!session) {
    return json(401, { error: 'Sesioni ka skaduar. Kyçu përsëri.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Kërkesë e pavlefshme.' });
  }

  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');
  if (newPassword.length < 8) {
    return json(400, { error: 'Fjalëkalimi i ri duhet të ketë të paktën 8 karaktere.' });
  }

  const store = getStore('ikm-users');
  const record = await store.get(session.email, { type: 'json' });
  if (!record || !verifyPassword(currentPassword, record.passwordHash)) {
    return json(401, { error: 'Fjalëkalimi aktual është i pasaktë.' });
  }

  record.passwordHash = hashPassword(newPassword);
  await store.setJSON(session.email, record);

  return json(200, { ok: true });
};

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + '=')) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
