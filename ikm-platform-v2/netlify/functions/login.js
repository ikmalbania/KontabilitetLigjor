const { getStore, connectLambda } = require('@netlify/blobs');
const { verifyPassword } = require('./_password');
const { createSessionToken, sessionCookieHeader, displayCookieHeader } = require('./_session');

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

  if (!email || !password) {
    return json(400, { error: 'Email dhe fjalëkalimi kërkohen.' });
  }

  let store;
  try {
    store = getStore('ikm-users');
  } catch (e) {
    return json(500, { error: 'Gabim ruajtjeje (Blobs). ' + e.message });
  }

  const record = await store.get(email, { type: 'json' });

  // Deliberately generic error for both "no such user" and "wrong
  // password" — being specific would let someone probe which emails
  // are registered.
  const genericError = 'Email ose fjalëkalim i pasaktë.';
  if (!record || !verifyPassword(password, record.passwordHash)) {
    return json(401, { error: genericError });
  }

  const token = createSessionToken(email);
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
