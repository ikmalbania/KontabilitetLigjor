const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');

// One image per request, kept deliberately simple - the admin UI loops
// over selected files and calls this once each. That comfortably stays
// under the ~6MB request body limit that a single big "upload the whole
// deck in one request" call would risk hitting for large decks.
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

  const { course, modnum, filename, dataBase64 } = body;
  if (!course || !modnum || !filename || !dataBase64) {
    return json(400, { error: 'Mungon course, modnum, filename ose dataBase64.' });
  }
  if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png)$/.test(filename)) {
    return json(400, { error: 'Emër skedari i pavlefshëm (lejohet vetëm jpg/png, pa hapësira).' });
  }

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch (e) {
    return json(400, { error: 'dataBase64 nuk mund të deshifrohet.' });
  }
  // Sanity cap - a single slide image shouldn't need to be huge; catches
  // accidental full-resolution uploads before they eat blob storage.
  if (buffer.length > 4 * 1024 * 1024) {
    return json(413, { error: 'Skedari është shumë i madh (limit 4MB për rrëshqitje).' });
  }

  const store = getStore('ikm-slides');
  const key = `${course}/modul-${modnum}/${filename}`;
  await store.set(key, buffer, {
    metadata: { contentType: filename.endsWith('.png') ? 'image/png' : 'image/jpeg' },
  });

  return json(200, { ok: true, key, bytes: buffer.length });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
