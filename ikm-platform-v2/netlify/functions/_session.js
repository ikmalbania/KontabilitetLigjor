// Shared helper for creating and verifying signed session tokens.
// Not a full JWT — just enough of the same idea (signed payload,
// tamper-evident, expiring) using Node's built-in crypto, so we don't
// need to add an external dependency for something this small.
//
// Token shape: base64url(JSON payload) + "." + hex HMAC-SHA256 of that
// base64url string, signed with AUTH_SECRET (set as a Netlify
// environment variable — Site configuration → Environment variables).

const crypto = require('crypto');

const SESSION_DAYS = 30;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_SECRET is not set. Add it in Netlify: Site configuration → ' +
      'Environment variables → add AUTH_SECRET with a long random value.'
    );
  }
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadObj) {
  const secret = getSecret();
  const body = base64url(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) {
    return null;
  }
  const secret = getSecret();
  const [body, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');

  // Timing-safe comparison so this can't be brute-forced via response-time
  // differences.
  const a = Buffer.from(sig || '', 'hex');
  const b = Buffer.from(expectedSig, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) {
    return null;
  }
  return payload;
}

function createSessionToken(email, role) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return sign({ email: email.toLowerCase(), role: role || 'student', exp });
}

// Cookie helpers ------------------------------------------------------

function sessionCookieHeader(token) {
  // httpOnly: JavaScript can never read this — the whole point of using
  // a real session cookie instead of localStorage for the auth check.
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `ikm_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function displayCookieHeader(email) {
  // A second, non-httpOnly cookie carrying only the email, purely so the
  // page's own JavaScript can show "logged in as ..." and paint the
  // watermark. This cookie proves nothing on its own and is never
  // trusted for access control — only ikm_session is.
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `ikm_email=${encodeURIComponent(email.toLowerCase())}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
}

function roleCookieHeader(role) {
  // Same idea as displayCookieHeader, but for role - lets the page's own
  // JavaScript show an "Admin panel" link when relevant (e.g. while an
  // admin is viewing student-facing /course/* pages). Not trusted for
  // access control - the edge function's own session check is what
  // actually gates /admin/*, independent of this cookie.
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `ikm_role=${encodeURIComponent(role || 'student')}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
}

function clearCookieHeaders() {
  return [
    'ikm_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    'ikm_email=; Path=/; Max-Age=0; Secure; SameSite=Lax',
    'ikm_role=; Path=/; Max-Age=0; Secure; SameSite=Lax',
  ];
}

module.exports = {
  createSessionToken,
  verify,
  sessionCookieHeader,
  displayCookieHeader,
  roleCookieHeader,
  clearCookieHeaders,
};
