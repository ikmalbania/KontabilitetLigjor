// Shared helper for admin-only Netlify Functions (the content/slide CRUD
// API). Reads the same ikm_session cookie the edge function checks for
// page access, verifies it with the same signing scheme, and requires
// role === 'admin'. This is a second, independent check - the edge
// function protects /admin/* at the page level, but each Function is
// its own request and must verify for itself too (defense in depth,
// and Functions can be called directly regardless of which page loaded).

const { verify } = require('./_session');

function readCookie(event, name) {
  const header = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const parts = header.split(';').map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + '=')) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

// Returns the verified { email, role, exp } payload, or null.
function getSession(event) {
  const token = readCookie(event, 'ikm_session');
  return verify(token);
}

// Returns null if the caller is a verified admin, or a ready-to-return
// 401/403 response object otherwise - so a handler can do:
//   const denied = requireAdmin(event); if (denied) return denied;
function requireAdmin(event) {
  const session = getSession(event);
  if (!session) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Sesioni mungon ose ka skaduar.' }),
    };
  }
  if (session.role !== 'admin') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Kjo veprim kërkon llogari administratori.' }),
    };
  }
  return null;
}

// Returns null if the caller has ANY valid session (student or admin), or
// a ready-to-return 401 otherwise.
function requireSession(event) {
  const session = getSession(event);
  if (!session) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Sesioni mungon ose ka skaduar.' }),
    };
  }
  return null;
}

module.exports = { getSession, requireAdmin, requireSession };

// Shared safety check: how many admin accounts currently exist. Used by
// delete/role-change endpoints to avoid ever locking everyone out by
// removing or demoting the last admin.
module.exports.countAdmins = async function countAdmins(store) {
  const { blobs } = await store.list();
  let count = 0;
  for (const b of blobs) {
    const record = await store.get(b.key, { type: 'json' });
    if (record && record.role === 'admin') count++;
  }
  return count;
};
