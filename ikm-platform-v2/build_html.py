# -*- coding: utf-8 -*-
import json, re

with open('modules_data.json', encoding='utf-8') as f:
    modules = json.load(f)

def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

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
            out.append(f'<h{lvl}>{esc(b["text"])}</h{lvl}>')
        elif t == 'bullet':
            if not in_list:
                out.append('<ul>')
                in_list = True
            out.append(f'<li>{esc(b["text"])}</li>')
        elif t == 'box_koncept':
            out.append(f'<div class="box box-koncept">{esc(b["text"])}</div>')
        elif t == 'box_praktike':
            out.append(f'<div class="box box-praktike">{esc(b["text"])}</div>')
        elif t == 'box_rast':
            out.append(f'<div class="box box-rast">{esc(b["text"])}</div>')
        elif t == 'caption':
            out.append(f'<p class="caption">{esc(b["text"])}</p>')
        elif t == 'table':
            out.append(b['html'])
        else:
            out.append(f'<p>{esc(b["text"])}</p>')
    if in_list:
        out.append('</ul>')
    return '\n'.join(out)

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
<div class="layout">
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
    <article class="doc-body">
      {body}
    </article>
  </main>
</div>
<script src="/js/auth-gate.js"></script>
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
        ],
        'available': ('1', '2'),
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

import os
for course_slug, course in COURSES.items():
    for modnum in course['available']:
        if modnum not in modules:
            print(f"SKIP {course_slug}/modul-{modnum}: no data in modules_data.json")
            continue
        data = modules[modnum]
        title_full = data['title']
        title_clean = title_full.split('—',1)[1].strip().title() if '—' in title_full else title_full
        body_html = blocks_to_html(data['blocks'])
        nav_html = build_nav(course_slug, modnum)
        page = PAGE_TEMPLATE.format(
            title=title_clean, modnum=modnum, title_clean=title_clean,
            nav=nav_html, body=body_html, course_name=course['name']
        )
        outdir = f'content/course/{course_slug}/modul-{modnum}'
        os.makedirs(outdir, exist_ok=True)
        with open(f'{outdir}/index.html', 'w', encoding='utf-8') as f:
            f.write(page)
        print(f'Built {outdir}/index.html ({len(body_html)} chars)')
