const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin, getSession, countAdmins } = require('./_admin_auth');

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

  const store = getStore('ikm-users');
  const record = await store.get(email, { type: 'json' });
  if (!record) return json(404, { error: 'Nuk u gjet një llogari me këtë email.' });

  if (record.role === 'admin') {
    const admins = await countAdmins(store);
    if (admins <= 1) {
      return json(409, { error: 'Nuk mund të fshihet i vetmi administrator që ka mbetur.' });
    }
  }

  // A safety net so an admin can't accidentally delete their own account
  // out from under themselves mid-session.
  const session = getSession(event);
  if (session && session.email === email) {
    return json(409, { error: 'Nuk mund të fshish llogarinë me të cilën je i identifikuar.' });
  }

  await store.delete(email);
  return json(200, { ok: true });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
