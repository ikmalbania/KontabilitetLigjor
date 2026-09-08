// Runs at Netlify's edge for every request under /course/* and /admin/*,
// before anything else is served. Two jobs:
//   1. Auth gate - verifies the ikm_session cookie (same HMAC scheme as
//      the functions); /admin/* additionally requires role === 'admin'.
//   2. Dynamic rendering - for module pages and the slide viewer, renders
//      directly from Netlify Blobs (via _render.js) instead of falling
//      through to a static file. This is what lets content edits and
//      slide uploads made from the admin panel show up immediately, with
//      no git commit or redeploy. If a module has no Blobs content yet
//      (nothing seeded/saved), this falls through to the old static file
//      as a safety net during the transition.

import { getStore } from '@netlify/blobs';
import { renderModulePage, renderSlidesViewerPage } from './_render.js';

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

const MODULE_RE = /^\/course\/([a-z0-9-]+)\/modul-(\d+)\/?$/;
const SLIDES_RE = /^\/course\/([a-z0-9-]+)\/modul-(\d+)\/slides\/?$/;

async function tryDynamicRender(pathname) {
  let m = pathname.match(MODULE_RE);
  if (m) {
    const [, courseSlug, modnum] = m;
    const registry = await getRegistry(courseSlug);
    if (!registry) return null; // unknown course - fall through to static/404
    const contentStore = getStore('ikm-content');
    const moduleContent = await contentStore.get(`${courseSlug}/modul-${modnum}`, { type: 'json' });
    if (!moduleContent) return null; // no dynamic content yet - fall through to static file

    const slidesStore = getStore('ikm-slides');
    const { blobs: slideBlobs } = await slidesStore.list({ prefix: `${courseSlug}/modul-${modnum}/` });

    const html = renderModulePage({
      courseSlug,
      modnum,
      moduleContent,
      courseRegistry: registry,
      slideCount: slideBlobs.length,
    });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  m = pathname.match(SLIDES_RE);
  if (m) {
    const [, courseSlug, modnum] = m;
    const registry = await getRegistry(courseSlug);
    if (!registry) return null;
    const mod = registry.modules.find((x) => x.num === modnum);
    const moduleLabel = mod ? mod.label : `Moduli ${modnum}`;
    const html = renderSlidesViewerPage({ courseSlug, modnum, moduleLabel, courseName: registry.name });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return null;
}

async function getRegistry(courseSlug) {
  const coursesStore = getStore('ikm-courses');
  const registry = await coursesStore.get('registry', { type: 'json' });
  const course = registry && registry[courseSlug];
  if (!course) return null;

  const contentStore = getStore('ikm-content');
  const { blobs } = await contentStore.list({ prefix: `${courseSlug}/` });
  const availableSet = new Set(
    blobs.map((b) => b.key.slice(`${courseSlug}/modul-`.length))
  );

  return { ...course, availableSet };
}

export default async (request, context) => {
  const secret = Netlify.env.get('AUTH_SECRET');
  if (!secret) {
    return new Response('AUTH_SECRET is not configured on the server.', { status: 500 });
  }

  const url = new URL(request.url);
  const token = readCookie(request, 'ikm_session');
  const session = await verifySession(token, secret);

  if (!session) {
    const dest = url.pathname.startsWith('/admin/') ? '/admin-login/' : '/?auth=required';
    return Response.redirect(new URL(dest, url.origin), 302);
  }

  if (url.pathname.startsWith('/admin/') && session.role !== 'admin') {
    return Response.redirect(new URL('/course/?forbidden=1', url.origin), 302);
  }

  if (url.pathname.startsWith('/course/')) {
    try {
      const rendered = await tryDynamicRender(url.pathname);
      if (rendered) return rendered;
    } catch (e) {
      // Blobs read failed for some reason - don't take the site down,
      // fall through to whatever static file exists for this path.
      console.error('Dynamic render failed, falling back to static:', e);
    }
  }

  // Valid session (and, for /admin/*, valid admin role) — let the static
  // file through, or continue to the next handler.
  return context.next();
};

export const config = { path: ['/course/*', '/admin/*'] };
