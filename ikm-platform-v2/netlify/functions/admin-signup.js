const { getStore, connectLambda } = require('@netlify/blobs');
const { hashPassword, verifyPassword } = require('./_password');
const { createSessionToken, sessionCookieHeader, displayCookieHeader } = require('./_session');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Creates an admin account, gated by ADMIN_CODE (a separate environment
// variable from the student INVITE_CODE - set it in Netlify: Site
// configuration -> Environment variables -> ADMIN_CODE). Meant to be used
// once per admin, from a dedicated admin-signup page that is not linked
// from the student-facing signup flow. Ordinary login afterwards goes
// through the same /api/login as students - role lives on the account,
// not on a separate login path.
//
// If the email already has a student account (e.g. from testing before
// the admin panel existed), this promotes it to admin in place instead
// of failing - but only if the submitted password matches that account's
// existing password. This solves the chicken-and-egg problem (there's no
// admin yet to use the "Bëje admin" button in /admin/users/) without
// weakening security: promoting someone else's account still requires
// knowing their password, not just the ADMIN_CODE alone.
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
    if (existing.role === 'admin') {
      return json(409, { error: 'Ky email është regjistruar tashmë si administrator. Provo të kyçesh.' });
    }
    // Existing student account - promote it, but only if the submitted
    // password proves ownership of that account.
    if (!verifyPassword(password, existing.passwordHash)) {
      return json(401, { error: 'Ky email ka tashmë një llogari studenti, por fjalëkalimi i dhënë nuk përputhet me atë llogari.' });
    }
    existing.role = 'admin';
    await store.setJSON(email, existing);

    const token = createSessionToken(email, 'admin');
    return {
      statusCode: 200,
      multiValueHeaders: {
        'Set-Cookie': [sessionCookieHeader(token), displayCookieHeader(email)],
      },
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, promoted: true }),
    };
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
