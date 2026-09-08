const { getStore, connectLambda } = require('@netlify/blobs');
const { hashPassword } = require('./_password');
const { createSessionToken, sessionCookieHeader, displayCookieHeader } = require('./_session');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Creates an admin account, gated by ADMIN_CODE (a separate environment
// variable from the student INVITE_CODE - set it in Netlify: Site
// configuration -> Environment variables -> ADMIN_CODE). Meant to be used
// once per admin, from a dedicated admin-signup page that is not linked
// from the student-facing signup flow. Ordinary login afterwards goes
// through the same /api/login as students - role lives on the account,
// not on a separate login path.
exports.handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Kërkesë e pavlefshme.' });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const code = String(body.code || '').trim();

  if (!EMAIL_RE.test(email)) {
    return json(400, { error: 'Email i pavlefshëm.' });
  }
  if (password.length < 8) {
    return json(400, { error: 'Fjalëkalimi duhet të ketë të paktën 8 karaktere.' });
  }

  const expectedCode = process.env.ADMIN_CODE;
  if (!expectedCode) {
    return json(500, { error: 'ADMIN_CODE nuk është konfiguruar në server.' });
  }
  if (code.toLowerCase() !== expectedCode.toLowerCase()) {
    return json(403, { error: 'Kodi i administratorit është i pasaktë.' });
  }

  let store;
  try {
    store = getStore('ikm-users');
  } catch (e) {
    return json(500, { error: 'Gabim ruajtjeje (Blobs). ' + e.message });
  }

  const existing = await store.get(email, { type: 'json' });
  if (existing) {
    return json(409, { error: 'Ky email është regjistruar tashmë. Provo të kyçesh.' });
  }

  const record = {
    email,
    passwordHash: hashPassword(password),
    role: 'admin',
    createdAt: new Date().toISOString(),
  };
  await store.setJSON(email, record);

  const token = createSessionToken(email, 'admin');
  return {
    statusCode: 200,
    multiValueHeaders: {
      'Set-Cookie': [sessionCookieHeader(token), displayCookieHeader(email)],
    },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
