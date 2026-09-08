# -*- coding: utf-8 -*-
import json, re, os

with open('modules_data.json', encoding='utf-8') as f:
    modules = json.load(f)

def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

BOX_CLASS = {
    'box_koncept': 'box-koncept',
    'box_praktike': 'box-praktike',
    'box_rast': 'box-rast',
    'box_permbledhje': 'box-permbledhje',
}

def blocks_to_html(blocks):
    out = []
    in_list = False
    for b in blocks:
        t = b['type']
        if t != 'bullet' and in_list:
            out.append('</ul>')
            in_list = False
        if t == 'heading':
            lvl = min(b['level'], 4)
            idattr = f' id="{b["id"]}"' if b.get('id') else ''
            out.append(f'<h{lvl}{idattr}>{esc(b["text"])}</h{lvl}>')
        elif t == 'bullet':
            if not in_list:
                out.append('<ul>')
                in_list = True
            out.append(f'<li>{esc(b["text"])}</li>')
        elif t in BOX_CLASS:
            out.append(f'<div class="box {BOX_CLASS[t]}">{esc(b["text"])}</div>')
        elif t == 'caption':
            out.append(f'<p class="caption">{esc(b["text"])}</p>')
        elif t == 'table':
            out.append(b['html'])
        else:
            out.append(f'<p>{esc(b["text"])}</p>')
    if in_list:
        out.append('</ul>')
    return '\n'.join(out)

def build_section_toc(blocks):
    """Nested TOC down to Heading2 only (not H3/H4), per Era's instruction."""
    items = []
    current_h1 = None
    for b in blocks:
        if b['type'] != 'heading' or b['level'] not in (1, 2) or not b.get('id'):
            continue
        if b['level'] == 1:
            current_h1 = {'id': b['id'], 'text': b['text'], 'children': []}
            items.append(current_h1)
        else:  # level 2
            if current_h1 is None:
                current_h1 = {'id': None, 'text': None, 'children': []}
                items.append(current_h1)
            current_h1['children'].append({'id': b['id'], 'text': b['text']})
    return items

def toc_to_html(items):
    li = []
    for it in items:
        sub = ''
        if it['children']:
            sub_items = ''.join(
                f'<li><a href="#{c["id"]}">{esc(c["text"])}</a></li>' for c in it['children']
            )
            sub = f'<ul class="toc-sub">{sub_items}</ul>'
        if it['id']:
            li.append(f'<li><a href="#{it["id"]}">{esc(it["text"])}</a>{sub}</li>')
        else:
            li.append(f'<li>{sub}</li>')
    return f'<ul class="toc-tree">{"".join(li)}</ul>'

PAGE_TEMPLATE = '''<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — {course_name}</title>
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div id="watermark"></div>
<header class="topbar">
  <div class="topbar-inner">
    <a href="/course/" class="brand">IKM <span>{course_name}</span></a>
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
    <div class="sidebar-title">{course_name}</div>
    <ul class="module-nav">
      {nav}
    </ul>
  </nav>
  <main class="content" id="protected-content">
    <div class="module-header">
      <span class="module-tag">Moduli {modnum}</span>
      <h1>{title_clean}</h1>
    </div>
    {slides_entry}
    <article class="doc-body">
      {body}
    </article>
  </main>
  <aside class="toc-rail" aria-label="Përmbajtja e modulit">
    <div class="toc-title">Përmbajtja</div>
    {toc}
  </aside>
</div>
<script src="/js/auth-gate.js"></script>
<script src="/js/toc-scrollspy.js"></script>
</body>
</html>
'''

# ---- Multi-course config ----
# To add a new course: add an entry here, drop its module data into
# modules_data.json under new keys, and re-run this script.
COURSES = {
    'kontabilist-ligjor': {
        'name': 'Kontabilist Ligjor',
        'nav_items': [
            ('1', 'Hyrje në Ekzaminimin e Mashtrimeve'),
            ('2', 'Psikologjia e Mashtruesit'),
            ('3', 'Teknikat e Zbulimit të Mashtrimit'),
            ('4', 'Procesi Investigativ'),
            ('5', 'Mbledhja dhe Vlerësimi i Provave'),
            ('6', 'Transaksionet Financiare dhe Skemat e Mashtrimit'),
            ('7', 'Skemat e Ryshfetit dhe Korrupsionit'),
            ('8', 'Shpërdorimi i Aktiveve'),
            ('9', 'Skemat e Mashtrimit në Epokën Digjitale'),
            ('10', 'Raporti i Mashtrimit dhe Procesi i Rikuperimit'),
        ],
        'available': tuple(str(i) for i in range(1, 11)),
        'total_modules': 10,
    },
    # 'kursi-i-ri': {
    #     'name': 'Emri i Kursit të Ri',
    #     'nav_items': [('1', 'Titulli i Modulit 1')],
    #     'available': ('1',),
    #     'total_modules': 1,
    # },
}

def build_nav(course_slug, active):
    course = COURSES[course_slug]
    items = []
    for num, label in course['nav_items']:
        cls = 'active' if num == active else ''
        locked = '' if num in course['available'] else ' <span class="lock">🔒</span>'
        href = f'/course/{course_slug}/modul-{num}/' if num in course['available'] else '#'
        items.append(f'<li class="{cls}"><a href="{href}">Moduli {num}{locked}<br><small>{label}</small></a></li>')
    remaining = course['total_modules'] - len(course['nav_items'])
    if remaining > 0:
        items.append(f'<li class="nav-more">+ {remaining} module të tjera</li>')
    return '\n      '.join(items)

for course_slug, course in COURSES.items():
    for modnum in course['available']:
        if modnum not in modules:
            print(f"SKIP {course_slug}/modul-{modnum}: no data in modules_data.json")
            continue
        data = modules[modnum]
        title_full = data['title']
        title_clean = title_full.split('—',1)[1].strip().title() if '—' in title_full else title_full
        body_html = blocks_to_html(data['blocks'])
        toc_items = build_section_toc(data['blocks'])
        toc_html = toc_to_html(toc_items)
        nav_html = build_nav(course_slug, modnum)

        slides_dir = f'content/course/{course_slug}/modul-{modnum}/slides'
        slides_entry = ''
        if os.path.exists(os.path.join(slides_dir, 'index.html')):
            n_slides = len([f for f in os.listdir(slides_dir) if f.endswith('.jpg')])
            slides_entry = (
                f'<a class="slides-entry" href="/course/{course_slug}/modul-{modnum}/slides/">'
                f'<span class="slides-entry-icon">📊</span>'
                f'<span class="slides-entry-text"><strong>Shiko Prezantimin</strong>'
                f'<span>{n_slides} Slides</span></span></a>'
            )

        page = PAGE_TEMPLATE.format(
            title=title_clean, modnum=modnum, title_clean=title_clean,
            nav=nav_html, toc=toc_html, body=body_html, course_name=course['name'],
            slides_entry=slides_entry,
        )
        outdir = f'content/course/{course_slug}/modul-{modnum}'
        os.makedirs(outdir, exist_ok=True)
        with open(f'{outdir}/index.html', 'w', encoding='utf-8') as f:
            f.write(page)
        print(f'Built {outdir}/index.html ({len(body_html)} chars, {len(toc_items)} H1 sections)')
