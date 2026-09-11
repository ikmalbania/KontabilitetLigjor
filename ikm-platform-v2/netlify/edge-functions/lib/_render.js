// Ports the same block-rendering logic from build_html.py to JS so module
// pages can be rendered at the edge, directly from Blobs content, instead
// of needing a pre-built static file + a deploy for every content change.
// Keep this in sync with build_html.py's blocks_to_html / toc logic if
// either one changes - they must produce the same HTML/CSS class names.

const BOX_CLASS = {
  box_koncept: 'box-koncept',
  box_praktike: 'box-praktike',
  box_rast: 'box-rast',
  box_permbledhje: 'box-permbledhje',
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function blocksToHtml(blocks) {
  const out = [];
  let inList = false;
  for (const b of blocks || []) {
    const t = b.type;
    if (t !== 'bullet' && inList) {
      out.push('</ul>');
      inList = false;
    }
    if (t === 'heading') {
      const lvl = Math.min(b.level, 4);
      const idAttr = b.id ? ` id="${esc(b.id)}"` : '';
      out.push(`<h${lvl}${idAttr}>${esc(b.text)}</h${lvl}>`);
    } else if (t === 'bullet') {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${esc(b.text)}</li>`);
    } else if (BOX_CLASS[t]) {
      out.push(`<div class="box ${BOX_CLASS[t]}">${esc(b.text)}</div>`);
    } else if (t === 'caption') {
      out.push(`<p class="caption">${esc(b.text)}</p>`);
    } else if (t === 'table') {
      // Table HTML is pre-built and trusted (authored via the admin content
      // API, not raw user input from the public internet).
      out.push(b.html);
    } else {
      out.push(`<p>${esc(b.text)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

export function buildSectionToc(blocks) {
  const items = [];
  let currentH1 = null;
  for (const b of blocks || []) {
    if (b.type !== 'heading' || (b.level !== 1 && b.level !== 2) || !b.id) continue;
    if (b.level === 1) {
      currentH1 = { id: b.id, text: b.text, children: [] };
      items.push(currentH1);
    } else {
      if (!currentH1) {
        currentH1 = { id: null, text: null, children: [] };
        items.push(currentH1);
      }
      currentH1.children.push({ id: b.id, text: b.text });
    }
  }
  return items;
}

export function tocToHtml(items) {
  const li = items.map((it) => {
    let sub = '';
    if (it.children.length) {
      const subItems = it.children
        .map((c) => `<li><a href="#${esc(c.id)}">${esc(c.text)}</a></li>`)
        .join('');
      sub = `<ul class="toc-sub">${subItems}</ul>`;
    }
    return it.id
      ? `<li><a href="#${esc(it.id)}">${esc(it.text)}</a>${sub}</li>`
      : `<li>${sub}</li>`;
  });
  return `<ul class="toc-tree">${li.join('')}</ul>`;
}

export function buildNav(courseSlug, activeModnum, courseRegistry, isAdmin) {
  const visible = isAdmin ? courseRegistry.modules : courseRegistry.modules.filter((m) => !m.hidden);
  const numbered = visible.filter((m) => !m.isReference);
  const references = visible.filter((m) => m.isReference);

  const items = [];
  items.push(
    `<li class="${!activeModnum ? 'active' : ''}"><a href="/course/${courseSlug}/">← Rreth Kursit</a></li>`
  );

  for (const { num, label, hidden } of numbered) {
    const cls = num === activeModnum ? 'active' : '';
    const available = courseRegistry.availableSet.has(num);
    const locked = available ? '' : ' <span class="lock">🔒</span>';
    const hiddenTag = hidden ? ' <span class="hidden-tag">e fshehur</span>' : '';
    const href = available ? `/course/${courseSlug}/modul-${num}/` : '#';
    items.push(`<li class="${cls}"><a href="${href}">Moduli ${num}${locked}${hiddenTag}<br><small>${esc(label)}</small></a></li>`);
  }
  const remaining = (courseRegistry.totalModules || numbered.length) - numbered.length;
  if (remaining > 0) {
    items.push(`<li class="nav-more">+ ${remaining} module të tjera</li>`);
  }

  if (references.length) {
    items.push('<li class="nav-divider">Materiale Referuese</li>');
    for (const { num, label, hidden } of references) {
      const cls = num === activeModnum ? 'active' : '';
      const available = courseRegistry.availableSet.has(num);
      const locked = available ? '' : ' <span class="lock">🔒</span>';
      const hiddenTag = hidden ? ' <span class="hidden-tag">e fshehur</span>' : '';
      const href = available ? `/course/${courseSlug}/modul-${num}/` : '#';
      items.push(`<li class="${cls}"><a href="${href}">${esc(label)}${locked}${hiddenTag}</a></li>`);
    }
  }

  return items.join('\n      ');
}

export function titleClean(titleFull) {
  if (titleFull.includes('—')) {
    const rest = titleFull.split('—').slice(1).join('—').trim();
    // JS has no direct equivalent of Python's str.title(); approximate it
    // the same way (capitalize each word, lowercase the rest) to match
    // exactly what the already-shipped pages show.
    return rest
      .toLowerCase()
      .replace(/(^|[^a-zA-ZëçËÇ])([a-zA-ZëçËÇ])/g, (m, sep, ch) => sep + ch.toUpperCase());
  }
  return titleFull;
}

const PAGE_TEMPLATE = (vars) => `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(vars.title)} — ${esc(vars.courseName)}</title>
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div id="watermark"></div>
<header class="topbar">
  <div class="topbar-inner">
    <a href="/course/" class="brand">IKM <span>${esc(vars.courseName)}</span></a>
    <div class="user-info">
      <span id="user-email"></span>
      <button id="change-password-btn" class="btn-ghost">Ndrysho fjalëkalimin</button>
      <button id="logout-btn" class="btn-ghost">Dil</button>
    </div>
  </div>
</header>
<div class="layout has-toc">
  <nav class="sidebar">
    <div class="sidebar-title"><a href="/course/">← Të gjitha kurset</a></div>
    <div class="sidebar-title">${esc(vars.courseName)}</div>
    <ul class="module-nav">
      ${vars.nav}
    </ul>
  </nav>
  <main class="content" id="protected-content">
    ${vars.adminHiddenBanner}
    <div class="module-header">
      <span class="module-tag">${esc(vars.moduleTag)}</span>
      <h1>${esc(vars.titleClean)}</h1>
    </div>
    ${vars.slidesEntry}
    <article class="doc-body">
      ${vars.body}
    </article>
  </main>
  <aside class="toc-rail" aria-label="Përmbajtja e modulit">
    <div class="toc-title">Përmbajtja</div>
    ${vars.toc}
  </aside>
</div>
<script src="/js/auth-gate.js"></script>
<script src="/js/toc-scrollspy.js"></script>
</body>
</html>
`;

// Generic slide-viewer shell - identical for every module, no per-module
// baked content. The actual slide file list is fetched client-side (from
// /api/list-slides) once the page loads, so a new deck uploaded via the
// admin panel shows up immediately with no redeploy, and no per-module
// static HTML file is needed for this page at all.
export function renderSlidesViewerPage({ courseSlug, modnum, moduleLabel, courseName }) {
  return `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Prezantimi — ${esc(moduleLabel)} — ${esc(courseName)}</title>
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div id="watermark"></div>
<header class="topbar">
  <div class="topbar-inner">
    <a href="/course/" class="brand">IKM <span>${esc(courseName)}</span></a>
    <div class="user-info">
      <span id="user-email"></span>
      <button id="change-password-btn" class="btn-ghost">Ndrysho fjalëkalimin</button>
      <button id="logout-btn" class="btn-ghost">Dil</button>
    </div>
  </div>
</header>
<div class="slides-shell" id="protected-content">
  <a class="slides-back" href="/course/${esc(courseSlug)}/modul-${esc(modnum)}/">← Kthehu te Moduli ${esc(modnum)}</a>
  <h1 class="slides-title">${esc(moduleLabel)}</h1>
  <div id="slides-loading">Duke ngarkuar slides…</div>
  <div class="slides-viewer" id="slides-viewer" style="display:none">
    <button class="slides-nav slides-prev" id="prev-btn" aria-label="Slide paraardhëse">‹</button>
    <img class="slides-image" id="slide-img" alt="">
    <button class="slides-nav slides-next" id="next-btn" aria-label="Slide pasardhëse">›</button>
  </div>
  <div class="slides-controls" id="slides-controls" style="display:none">
    <span>Slide</span>
    <select id="slide-select" aria-label="Shko te slide"></select>
    <span>nga <span id="slide-total"></span></span>
  </div>
</div>
<script src="/js/auth-gate.js"></script>
<script>
(function () {
  var course = ${JSON.stringify(courseSlug)};
  var modnum = ${JSON.stringify(String(modnum))};
  var files = [];
  var i = 0;

  function imgUrl(f) {
    return '/api/slide-image?course=' + encodeURIComponent(course) + '&modnum=' + encodeURIComponent(modnum) + '&file=' + encodeURIComponent(f);
  }

  function show(idx) {
    idx = Math.max(0, Math.min(files.length - 1, idx));
    i = idx;
    var img = document.getElementById('slide-img');
    img.src = imgUrl(files[i]);
    img.alt = 'Slide ' + (i + 1);
    document.getElementById('slide-select').value = i;
    document.getElementById('prev-btn').disabled = i === 0;
    document.getElementById('next-btn').disabled = i === files.length - 1;
    [i - 1, i + 1].forEach(function (n) {
      if (n >= 0 && n < files.length) { new Image().src = imgUrl(files[n]); }
    });
  }

  fetch('/api/list-slides?course=' + encodeURIComponent(course) + '&modnum=' + encodeURIComponent(modnum), { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      files = data.files || [];
      if (!files.length) {
        document.getElementById('slides-loading').textContent = 'Ky modul nuk ka ende një prezantim të ngarkuar.';
        return;
      }
      var select = document.getElementById('slide-select');
      files.forEach(function (f, idx) {
        var opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = (idx + 1);
        select.appendChild(opt);
      });
      document.getElementById('slide-total').textContent = files.length;
      document.getElementById('slides-loading').style.display = 'none';
      document.getElementById('slides-viewer').style.display = 'flex';
      document.getElementById('slides-controls').style.display = 'flex';

      document.getElementById('prev-btn').addEventListener('click', function () { show(i - 1); });
      document.getElementById('next-btn').addEventListener('click', function () { show(i + 1); });
      select.addEventListener('change', function () { show(parseInt(select.value, 10)); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') show(i - 1);
        if (e.key === 'ArrowRight') show(i + 1);
      });
      show(0);
    })
    .catch(function () {
      document.getElementById('slides-loading').textContent = 'Gabim gjatë ngarkimit të slides.';
    });
})();
</script>
</body>
</html>
`;
}

// moduleContent: { title, blocks } from the ikm-content blob store.
// courseRegistry: { name, modules: [{num,label}], availableSet: Set, totalModules } from ikm-courses.
// slideCount: number of slides for this module (0 if none, or if slides
// are hidden from this viewer) - drives whether the "Shiko Prezantimin"
// entry card is shown. isAdmin: shows a "this is hidden from students"
// banner when relevant, and buildNav includes hidden entries for them.
export function renderModulePage({ courseSlug, modnum, moduleContent, courseRegistry, slideCount, isAdmin }) {
  const tClean = titleClean(moduleContent.title);
  const body = blocksToHtml(moduleContent.blocks);
  const tocItems = buildSectionToc(moduleContent.blocks);
  const toc = tocToHtml(tocItems);
  const nav = buildNav(courseSlug, modnum, courseRegistry, isAdmin);
  const moduleEntry = courseRegistry.modules.find((m) => m.num === modnum);
  const moduleTag = moduleEntry && moduleEntry.isReference ? 'Material Referues' : `Moduli ${modnum}`;

  let adminHiddenBanner = '';
  if (isAdmin && moduleEntry && (moduleEntry.hidden || moduleEntry.slidesHidden)) {
    const what = moduleEntry.hidden ? 'Ky modul' : 'Prezantimi i këtij moduli';
    adminHiddenBanner = `<div class="admin-banner">👁️‍🗨️ ${what} është i fshehur për studentët — vetëm ti (si admin) e sheh tani.</div>`;
  }

  let slidesEntry = '';
  if (slideCount > 0) {
    slidesEntry =
      `<a class="slides-entry" href="/course/${courseSlug}/modul-${modnum}/slides/">` +
      `<span class="slides-entry-icon">📊</span>` +
      `<span class="slides-entry-text"><strong>Shiko Prezantimin</strong>` +
      `<span>${slideCount} Slides</span></span></a>`;
  }

  return PAGE_TEMPLATE({
    title: tClean,
    courseName: courseRegistry.name,
    modnum,
    moduleTag,
    titleClean: tClean,
    nav,
    toc,
    body,
    slidesEntry,
    adminHiddenBanner,
  });
}

// The course landing page - shown at /course/<slug>/, before diving into
// any module. Uses the same block schema/rendering as a module page
// (the course's "description" content, stored via the same admin editor
// under the reserved modnum "_description"), but no module tag, no TOC
// rail (descriptions are typically short-ish), and the nav's "active"
// state highlights "Rreth Kursit" instead of any module.
export function renderCourseLandingPage({ courseSlug, courseRegistry, descriptionBlocks, isAdmin }) {
  const nav = buildNav(courseSlug, null, courseRegistry, isAdmin);
  const body = descriptionBlocks && descriptionBlocks.length
    ? blocksToHtml(descriptionBlocks)
    : '<p>Ky kurs nuk ka ende një përshkrim. Zgjidh një modul nga menyja majtas për të filluar.</p>';

  return `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(courseRegistry.name)}</title>
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div id="watermark"></div>
<header class="topbar">
  <div class="topbar-inner">
    <a href="/course/" class="brand">IKM <span>${esc(courseRegistry.name)}</span></a>
    <div class="user-info">
      <span id="user-email"></span>
      <button id="change-password-btn" class="btn-ghost">Ndrysho fjalëkalimin</button>
      <button id="logout-btn" class="btn-ghost">Dil</button>
    </div>
  </div>
</header>
<div class="layout">
  <nav class="sidebar">
    <div class="sidebar-title"><a href="/course/">← Të gjitha kurset</a></div>
    <div class="sidebar-title">${esc(courseRegistry.name)}</div>
    <ul class="module-nav">
      ${nav}
    </ul>
  </nav>
  <main class="content" id="protected-content">
    <div class="module-header">
      <span class="module-tag">Rreth Kursit</span>
      <h1>${esc(courseRegistry.name)}</h1>
    </div>
    <article class="doc-body">
      ${body}
    </article>
  </main>
</div>
<script src="/js/auth-gate.js"></script>
</body>
</html>
`;
}
