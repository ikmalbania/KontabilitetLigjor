const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');
const { hashPassword } = require('./_password');
const crypto = require('crypto');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Avoids visually ambiguous characters (0/O, 1/l/I) since these are
// meant to be read off a list and typed in by someone.
const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generatePassword(length = 10) {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  }
  return out;
}

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

  const role = body.role === 'admin' ? 'admin' : 'student';
  const entries = Array.isArray(body.users) ? body.users : [];
  if (!entries.length) return json(400, { error: 'Nuk ka email të dhëna.' });
  if (entries.length > 200) return json(400, { error: 'Maksimumi 200 përdorues në një herë.' });

  const store = getStore('ikm-users');
  const results = [];

  for (const entry of entries) {
    const email = String((entry && entry.email) || '').trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      results.push({ email, status: 'invalid', password: null });
      continue;
    }
    const existing = await store.get(email, { type: 'json' });
    if (existing) {
      results.push({ email, status: 'exists', password: null });
      continue;
    }
    const password = (entry && entry.password) || generatePassword();
    const record = {
      email,
      passwordHash: hashPassword(password),
      role,
      createdAt: new Date().toISOString(),
    };
    await store.setJSON(email, record);
    results.push({ email, status: 'created', password });
  }

  return json(200, { results });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
