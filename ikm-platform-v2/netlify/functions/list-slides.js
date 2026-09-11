const { getStore, connectLambda } = require('@netlify/blobs');
const { requireSession, getSession, hasSlidesAccess } = require('./_admin_auth');

// Used by both the admin slide-manager UI and the student-facing slide
// viewer - listing filenames isn't sensitive to a student who can already
// view the images themselves, so this only requires a valid session, not
// specifically an admin one - but still scoped to courses/modules they're
// actually entitled to, and blocked if the module or its slides are hidden.
exports.handler = async (event) => {
  connectLambda(event);
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const denied = requireSession(event);
  if (denied) return denied;

  const { course, modnum } = event.queryStringParameters || {};
  if (!course || !modnum) {
    return json(400, { error: 'Mungon course ose modnum.' });
  }

  if (!(await hasSlidesAccess(getSession(event), course, modnum))) {
    return json(403, { error: 'Nuk ke akses në këto slides.' });
  }

  const store = getStore('ikm-slides');
  const prefix = `${course}/modul-${modnum}/`;
  const { blobs } = await store.list({ prefix });
  const files = blobs
    .map((b) => b.key.slice(prefix.length))
    .sort();

  return json(200, { files });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
