const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');

exports.handler = async (event) => {
  connectLambda(event);
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const denied = requireAdmin(event);
  if (denied) return denied;

  const store = getStore('ikm-users');
  const { blobs } = await store.list();

  const users = [];
  for (const b of blobs) {
    const record = await store.get(b.key, { type: 'json' });
    if (!record) continue;
    users.push({
      email: record.email,
      role: record.role || 'student',
      createdAt: record.createdAt || null,
      // passwordHash intentionally omitted - never sent to the client.
    });
  }
  users.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ users }),
  };
};
