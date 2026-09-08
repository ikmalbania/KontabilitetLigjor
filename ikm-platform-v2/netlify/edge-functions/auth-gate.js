// Runs at Netlify's edge for every request under /course/*, before the
// static file is served. Verifies the ikm_session cookie using the same
// HMAC scheme as the functions. No external dependency — Deno (the edge
// runtime) has Web Crypto built in.

async function verifySession(token, secret) {
  if (!token || token.indexOf('.') === -1) return null;
  const [body, sig] = token.split('.');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedSigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expectedSig = Array.from(new Uint8Array(expectedSigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedSig !== sig) return null;

  let payload;
  try {
    let b64 = body.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    payload = JSON.parse(atob(b64));
  } catch (e) {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const parts = header.split(';').map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + '=')) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

export default async (request, context) => {
  const secret = Netlify.env.get('AUTH_SECRET');
  if (!secret) {
    return new Response('AUTH_SECRET is not configured on the server.', { status: 500 });
  }

  const token = readCookie(request, 'ikm_session');
  const session = await verifySession(token, secret);

  if (!session) {
    const url = new URL(request.url);
    return Response.redirect(new URL('/?auth=required', url.origin), 302);
  }

  // Valid session — let the static course page through.
  return context.next();
};

export const config = { path: '/course/*' };
