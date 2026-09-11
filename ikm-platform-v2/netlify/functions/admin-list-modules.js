const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');

exports.handler = async (event) => {
  connectLambda(event);
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const denied = requireAdmin(event);
  if (denied) return denied;

  const coursesStore = getStore('ikm-courses');
  const contentStore = getStore('ikm-content');
  const slidesStore = getStore('ikm-slides');

  const registry = (await coursesStore.get('registry', { type: 'json' })) || {};

  // All modules across all courses are independent reads - fire them
  // together instead of awaiting one at a time (10 modules x 2 calls
  // sequentially was ~20 round-trips end to end; this cuts it to one
  // round-trip's worth of latency total). Metadata-only reads for
  // content also avoid downloading the full blocks array (which can be
  // several hundred KB for a large module) just to show a count.
  //
  // Self-healing fallback: content saved before this metadata approach
  // existed (e.g. the original seed import) has no blockCount in its
  // metadata. Rather than showing a false "0 blloqe" for it forever,
  // fall back to a full read + compute the count directly, and
  // opportunistically backfill the metadata so subsequent loads are
  // fast again. This only ever runs for the handful of older entries
  // that predate metadata - anything saved or seeded from here on
  // already carries it.
  const courses = await Promise.all(
    Object.entries(registry).map(async ([slug, course]) => {
      const modules = await Promise.all(
        course.modules.map(async (m) => {
          const contentKey = `${slug}/modul-${m.num}`;
          const slidePrefix = `${slug}/modul-${m.num}/`;
          const [contentMeta, slideList] = await Promise.all([
            contentStore.getMetadata(contentKey),
            slidesStore.list({ prefix: slidePrefix }),
          ]);
          const meta = (contentMeta && contentMeta.metadata) || null;
          const hasTrustworthyMeta = meta && typeof meta.blockCount === 'number';

          if (contentMeta && !hasTrustworthyMeta) {
            const full = await contentStore.get(contentKey, { type: 'json' });
            if (full) {
              const blockCount = full.blocks.length;
              const updatedAt = full.updatedAt || null;
              // Backfill so the next dashboard load hits the fast path.
              contentStore.setJSON(contentKey, full, { metadata: { blockCount, updatedAt } }).catch(() => {});
              return {
                num: m.num, label: m.label, hasContent: true, blockCount, updatedAt,
                slideCount: slideList.blobs.length,
                isReference: !!m.isReference, hidden: !!m.hidden, slidesHidden: !!m.slidesHidden,
              };
            }
          }

          return {
            num: m.num,
            label: m.label,
            hasContent: !!contentMeta,
            blockCount: meta ? meta.blockCount || 0 : 0,
            updatedAt: meta ? meta.updatedAt || null : null,
            slideCount: slideList.blobs.length,
            isReference: !!m.isReference,
            hidden: !!m.hidden,
            slidesHidden: !!m.slidesHidden,
          };
        })
      );
      return { slug, name: course.name, totalModules: course.totalModules, modules };
    })
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courses }),
  };
};
