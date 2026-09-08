// This file is unused. It used to be Netlify treating every .js file
// directly inside netlify/edge-functions/ as its own edge function -
// the real logic has moved to netlify/edge-functions/lib/_render.js
// (a shared helper imported by auth-gate.js) and netlify/edge-functions/
// auth-gate.js (the actual edge function). This file is kept only
// because it couldn't be deleted via the GitHub web UI; it's scoped to
// a path that will never be requested, so it never actually runs.
export default async (request, context) => {
  return context.next();
};
export const config = { path: '/__unused_placeholder_never_matches__' };
