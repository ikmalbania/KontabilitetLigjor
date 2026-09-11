const { getStore, connectLambda } = require('@netlify/blobs');
const { getSession, hasSlidesAccess } = require('./_admin_auth');

exports.handler = async (event) => {
  connectLambda(event);
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  // Any signed-in user (student or admin) can view slides - this is the
  // same population that can already reach /course/* pages at all -
  // but only for a course/module they're actually entitled to, and only
  // if the module or its slides haven't been hidden by an admin.
  const session = getSession(event);
  if (!session) {
    return { statusCode: 401, body: 'Sesioni mungon ose ka skaduar.' };
  }

  const { course, modnum, file } = event.queryStringParameters || {};
  if (!course || !modnum || !file) {
    return { statusCode: 400, body: 'Mungon course, modnum ose file.' };
  }

  if (!(await hasSlidesAccess(session, course, modnum))) {
    return { statusCode: 403, body: 'Nuk ke akses në këto slides.' };
  }

  const store = getStore('ikm-slides');
  const key = `${course}/modul-${modnum}/${file}`;
  const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!result) {
    return { statusCode: 404, body: 'Slide nuk u gjet.' };
  }

  const contentType = (result.metadata && result.metadata.contentType) || 'image/jpeg';
  return {
    statusCode: 200,
    headers: {
      'Content-Type': contentType,
      // Slides don't change often once uploaded, and a fresh upload gets
      // a cache-busting request naturally since the admin UI reloads the
      // viewer after a replace - short cache is enough to avoid re-
      // fetching the same slide on every prev/next within one session.
      'Cache-Control': 'private, max-age=300',
    },
    body: Buffer.from(result.data).toString('base64'),
    isBase64Encoded: true,
  };
};
