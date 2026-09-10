const { getStore, connectLambda } = require('@netlify/blobs');
const { getSession, requireSession } = require('./_admin_auth');

exports.handler = async (event) => {
  connectLambda(event);
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const denied = requireSession(event);
  if (denied) return denied;
  const session = getSession(event);

  const coursesStore = getStore('ikm-courses');
  const registry = (await coursesStore.get('registry', { type: 'json' })) || {};

  let allowedSlugs = null; // null = unrestricted (admins, and legacy accounts)
  if (session.role !== 'admin') {
    const usersStore = getStore('ikm-users');
    const record = await usersStore.get(session.email, { type: 'json' });
    if (record && Array.isArray(record.courses)) {
      allowedSlugs = new Set(record.courses);
    }
  }

  const courses = Object.entries(registry)
    .filter(([slug]) => !allowedSlugs || allowedSlugs.has(slug))
    .map(([slug, course]) => ({
      slug,
      name: course.name,
      moduleCount: course.modules.filter((m) => !m.isReference).length,
    }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courses }),
  };
};
