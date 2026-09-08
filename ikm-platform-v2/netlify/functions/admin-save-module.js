const { getStore, connectLambda } = require('@netlify/blobs');
const { requireAdmin } = require('./_admin_auth');

const VALID_TYPES = new Set([
  'heading', 'para', 'bullet', 'caption', 'table',
  'box_koncept', 'box_praktike', 'box_rast', 'box_permbledhje',
]);

const ALB_MAP = { 'ë': 'e', 'Ë': 'E', 'ç': 'c', 'Ç': 'C' };

function slugify(text, seen) {
  let t = String(text || '').replace(/[ëËçÇ]/g, (c) => ALB_MAP[c]);
  t = t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  t = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  t = t.slice(0, 60).replace(/^-+|-+$/g, '') || 'sec';
  let base = t;
  let i = 2;
  while (seen.has(t)) {
    t = `${base}-${i}`;
    i++;
  }
  seen.add(t);
  return t;
}

function validateAndPrepare(blocks) {
  if (!Array.isArray(blocks)) throw new Error('blocks duhet të jetë një listë.');
  const seen = new Set();
  return blocks.map((b, i) => {
    if (!b || typeof b !== 'object' || !VALID_TYPES.has(b.type)) {
      throw new Error(`Blloku ${i} ka tip të pavlefshëm: ${b && b.type}`);
    }
    if (b.type === 'heading') {
      const level = Number(b.level);
      if (![1, 2, 3, 4].includes(level)) {
        throw new Error(`Blloku ${i}: niveli i titullit duhet të jetë 1-4.`);
      }
      const out = { type: 'heading', level, text: String(b.text || '') };
      if (level === 1 || level === 2) out.id = slugify(out.text, seen);
      return out;
    }
    if (b.type === 'table') {
      if (typeof b.html !== 'string') throw new Error(`Blloku ${i}: tabela ka nevojë për 'html'.`);
      return { type: 'table', html: b.html };
    }
    return { type: b.type, text: String(b.text || '') };
  });
}

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

  const { course, modnum, title, blocks } = body;
  if (!course || !modnum || !title) {
    return json(400, { error: 'Mungon course, modnum ose title.' });
  }

  let preparedBlocks;
  try {
    preparedBlocks = validateAndPrepare(blocks);
  } catch (e) {
    return json(400, { error: e.message });
  }

  const store = getStore('ikm-content');
  const record = {
    title: String(title),
    blocks: preparedBlocks,
    updatedAt: new Date().toISOString(),
  };
  // Metadata is stored alongside but fetched separately via getMetadata()
  // - much cheaper than downloading the full blocks array just to show a
  // count on the admin dashboard list.
  await store.setJSON(`${course}/modul-${modnum}`, record, {
    metadata: { blockCount: preparedBlocks.length, updatedAt: record.updatedAt },
  });

  return json(200, { ok: true, blockCount: preparedBlocks.length });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
