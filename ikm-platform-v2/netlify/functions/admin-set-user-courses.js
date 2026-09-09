const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');

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

  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return json(400, { error: 'Mungon email.' });
  // courses: array of slugs the student may access, or null to remove the
  // restriction entirely (they see every course that exists, same as an
  // account that predates this feature).
  const courses = body.courses === null ? null : Array.isArray(body.courses) ? body.courses.map(String) : null;
  if (body.courses !== null && !Array.isArray(body.courses)) {
    return json(400, { error: 'courses duhet të jetë një listë slug-ash, ose null.' });
  }

  const store = getStore('ikm-users');
  const record = await store.get(email, { type: 'json' });
  if (!record) return json(404, { error: 'Nuk u gjet një llogari me këtë email.' });

  if (courses === null) {
    delete record.courses;
  } else {
    record.courses = courses;
  }
  await store.setJSON(email, record);

  return json(200, { ok: true, courses: record.courses || null });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
