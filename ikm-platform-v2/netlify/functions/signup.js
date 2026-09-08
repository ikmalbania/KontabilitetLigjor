const { getStore, connectLambda } = require('@netlify/blobs');
const { hashPassword } = require('./_password');
const { createSessionToken, sessionCookieHeader, displayCookieHeader, roleCookieHeader } = require('./_session');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  // Required for Netlify Blobs to pick up the site context when a
  // function is written in this classic (Lambda-compatible) handler
  // style, rather than the newer web-standard Request/Response style.
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

  // The invite code is a single shared value set as a Netlify environment
  // variable (INVITE_CODE) — simple to rotate, no separate admin UI or
  // database of codes needed for a small cohort. Compared case-
  // insensitively so a code shared verbally/typed doesn't trip on case.
  const expectedCode = process.env.INVITE_CODE;
  if (!expectedCode) {
    return json(500, { error: 'INVITE_CODE nuk është konfiguruar në server.' });
  }
  if (code.toLowerCase() !== expectedCode.toLowerCase()) {
    return json(403, { error: 'Kodi i ftesës është i pasaktë.' });
  }

  let store;
  try {
    store = getStore('ikm-users');
  } catch (e) {
    return json(500, { error: 'Gabim ruajtjeje (Blobs). ' + e.message });
  }

  const existing = await store.get(email);
  if (existing) {
    return json(409, { error: 'Ky email është regjistruar tashmë. Provo të kyçesh.' });
  }

  const record = {
    email,
    passwordHash: hashPassword(password),
    role: 'student',
    createdAt: new Date().toISOString(),
  };
  await store.setJSON(email, record);

  const token = createSessionToken(email, 'student');
  return {
    statusCode: 200,
    multiValueHeaders: {
      'Set-Cookie': [sessionCookieHeader(token), displayCookieHeader(email), roleCookieHeader('student')],
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
