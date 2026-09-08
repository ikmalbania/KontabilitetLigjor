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

  const courses = [];
  for (const [slug, course] of Object.entries(registry)) {
    const modules = [];
    for (const m of course.modules) {
      const contentKey = `${slug}/modul-${m.num}`;
      const content = await contentStore.get(contentKey, { type: 'json' });
      const slidePrefix = `${slug}/modul-${m.num}/`;
      const { blobs: slideBlobs } = await slidesStore.list({ prefix: slidePrefix });
      modules.push({
        num: m.num,
        label: m.label,
        hasContent: !!content,
        blockCount: content ? content.blocks.length : 0,
        updatedAt: content ? content.updatedAt : null,
        slideCount: slideBlobs.length,
      });
    }
    courses.push({ slug, name: course.name, totalModules: course.totalModules, modules });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courses }),
  };
};
