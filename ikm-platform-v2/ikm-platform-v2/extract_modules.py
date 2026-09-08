# -*- coding: utf-8 -*-
"""
Extracts all 10 Kontabilist Ligjor modules from the final consolidated docx
into modules_data.json, matching the block-type conventions of the original
extract_modules.py (which only handled modules 1-2), plus:
  - a 4th box type: box_permbledhje (shading F2F5FA -> "PËRMBLEDHJE" callout)
  - anchor ids on Heading1 and Heading2 paragraphs (for in-page section nav)
Front matter before "MODULI 1" (list of tables/figures, consolidated glossary,
consolidated legal framework) and the master bibliography after "MODULI 10"
(section "Bibliografia dhe Referencat") are program-level content, not part
of any single module, so both are excluded here - matches how modul-1/modul-2
already work (no such content on those pages).
"""
from docx import Document
from docx.oxml.ns import qn
import re, json, unicodedata

# Source docx lives in source/ and is NOT committed to git (13MB binary; see .gitignore).
# Drop the file there before running this script.
SRC = 'source/Kontabilitet_Ligjor_-_Materiali_Permbledhur_Final.docx'
doc = Document(SRC)

def get_children():
    out = []
    for c in doc.element.body.iterchildren():
        if c.tag == qn('w:p'):
            out.append(('p', c))
        elif c.tag == qn('w:tbl'):
            out.append(('tbl', c))
    return out

def ptext(el):
    return ''.join(t.text or '' for t in el.findall('.//'+qn('w:t')))

def pstyle(el):
    pPr = el.find(qn('w:pPr'))
    if pPr is None: return None
    ps = pPr.find(qn('w:pStyle'))
    return ps.get(qn('w:val')) if ps is not None else None

def is_bold(el):
    r = el.find(qn('w:r'))
    if r is None: return False
    rPr = r.find(qn('w:rPr'))
    return rPr is not None and rPr.find(qn('w:b')) is not None

def has_border_shading(el):
    pPr = el.find(qn('w:pPr'))
    if pPr is None: return None
    shd = pPr.find(qn('w:shd'))
    if shd is not None:
        return shd.get(qn('w:fill'))
    return None

def table_to_html(tbl):
    rows_html = []
    trs = tbl.findall(qn('w:tr'))
    for ri, tr in enumerate(trs):
        cells = tr.findall(qn('w:tc'))
        tag = 'th' if ri == 0 else 'td'
        cells_html = ''.join(f'<{tag}>{esc(ptext(tc).strip())}</{tag}>' for tc in cells)
        rows_html.append(f'<tr>{cells_html}</tr>')
    return '<table class="doc-table">' + ''.join(rows_html) + '</table>'

def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

ALB_MAP = str.maketrans({'ë':'e','Ë':'E','ç':'c','Ç':'C'})
def slugify(text, seen):
    t = text.translate(ALB_MAP)
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode('ascii')
    t = t.lower()
    t = re.sub(r'[^a-z0-9]+', '-', t).strip('-')
    t = t[:60].strip('-') or 'sec'
    base = t
    i = 2
    while t in seen:
        t = f'{base}-{i}'
        i += 1
    seen.add(t)
    return t

children = get_children()

modules = {}
current_module = None
seen_ids = None
for typ, el in children:
    if typ == 'p':
        txt = ptext(el).strip()
        style = pstyle(el)
        if style == 'ModuleTitle' and txt.upper().startswith('MODULI ') and re.match(r'MODULI \d+', txt.upper()):
            m = re.match(r'MODULI (\d+)', txt.upper())
            current_module = m.group(1)
            modules[current_module] = {'title': txt, 'blocks': []}
            seen_ids = set()
            continue
        # boundary: master bibliography after module 10 is program-level, not module content
        if style == 'Heading1' and txt == 'Bibliografia dhe Referencat':
            current_module = None
            continue
    if current_module not in [str(i) for i in range(1, 11)]:
        continue
    if typ == 'tbl':
        modules[current_module]['blocks'].append({'type': 'table', 'html': table_to_html(el)})
        continue
    txt = ptext(el).strip()
    if not txt:
        continue
    style = pstyle(el)
    shd = has_border_shading(el)
    if style in ('Heading1', 'Heading2', 'Heading3', 'Heading4'):
        lvl = int(style[-1])
        block = {'type': 'heading', 'level': lvl, 'text': txt}
        if lvl in (1, 2):
            block['id'] = slugify(txt, seen_ids)
        modules[current_module]['blocks'].append(block)
    elif style == 'ListParagraph':
        modules[current_module]['blocks'].append({'type': 'bullet', 'text': txt})
    elif shd == 'D6E8F5':
        modules[current_module]['blocks'].append({'type': 'box_koncept', 'text': txt})
    elif shd == 'FBF3E0':
        modules[current_module]['blocks'].append({'type': 'box_praktike', 'text': txt})
    elif shd == 'E6F2EA':
        modules[current_module]['blocks'].append({'type': 'box_rast', 'text': txt})
    elif shd == 'F2F5FA':
        modules[current_module]['blocks'].append({'type': 'box_permbledhje', 'text': txt})
    elif is_bold(el) and re.match(r'^(Tabela|Figura)\s+\d+\.\d+', txt):
        modules[current_module]['blocks'].append({'type': 'caption', 'text': txt})
    else:
        modules[current_module]['blocks'].append({'type': 'para', 'text': txt})

with open('modules_data.json', 'w', encoding='utf-8') as f:
    json.dump(modules, f, ensure_ascii=False, indent=1)

for k in sorted(modules, key=int):
    v = modules[k]
    print(k, v['title'], len(v['blocks']), 'blocks')
