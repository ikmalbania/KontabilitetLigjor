const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');

// Toggles module-level and/or slides-level visibility. Both flags
// default to absent = visible (backward compatible - every module and
// slide deck that existed before this feature stays visible exactly
// as before, no migration needed). Setting hidden:true blocks the
// module for students at the actual serving layer (edge function +
// the slide Functions), not just in the nav - a direct link doesn't
// bypass it. Admins always see everything regardless of these flags.
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

  const course = String(body.course || '').trim();
  const num = String(body.num || '').trim();
  if (!course || !num) {
    return json(400, { error: 'Mungon course ose num.' });
  }
  if (typeof body.hidden !== 'boolean' && typeof body.slidesHidden !== 'boolean') {
    return json(400, { error: 'Duhet të japësh hidden dhe/ose slidesHidden (true/false).' });
  }

  const store = getStore('ikm-courses');
  const registry = (await store.get('registry', { type: 'json' })) || {};
  if (!registry[course]) {
    return json(404, { error: 'Ky kurs nuk ekziston.' });
  }
  const moduleEntry = registry[course].modules.find((m) => m.num === num);
  if (!moduleEntry) {
    return json(404, { error: 'Ky modul nuk ekziston në këtë kurs.' });
  }

  if (typeof body.hidden === 'boolean') {
    if (body.hidden) moduleEntry.hidden = true;
    else delete moduleEntry.hidden;
  }
  if (typeof body.slidesHidden === 'boolean') {
    if (body.slidesHidden) moduleEntry.slidesHidden = true;
    else delete moduleEntry.slidesHidden;
  }

  await store.setJSON('registry', registry);
  return json(200, { ok: true, hidden: !!moduleEntry.hidden, slidesHidden: !!moduleEntry.slidesHidden });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
