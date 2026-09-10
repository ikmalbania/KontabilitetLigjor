const { getStore, connectLambda } = require('@netlify/blobs');
const { getSession, requireSession, hasCourseAccess } = require('./_admin_auth');

// The description is stored via the exact same admin-get-module.js /
// admin-save-module.js path as any module's content, using the
// reserved modnum "_description" - no separate storage or admin CRUD
// needed. This function is the student-facing read path: session +
// course-access checked (not admin-only), since it's real content a
// student should see on the course landing page.
exports.handler = async (event) => {
  connectLambda(event);
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const denied = requireSession(event);
  if (denied) return denied;

  const { course } = event.queryStringParameters || {};
  if (!course) return json(400, { error: 'Mungon course.' });

  if (!(await hasCourseAccess(getSession(event), course))) {
    return json(403, { error: 'Nuk ke akses në këtë kurs.' });
  }

  const store = getStore('ikm-content');
  const content = await store.get(`${course}/modul-_description`, { type: 'json' });
  if (!content) {
    return json(200, { blocks: [] }); // no description written yet - not an error
  }
  return json(200, content);
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
