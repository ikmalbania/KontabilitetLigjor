# -*- coding: utf-8 -*-
from docx import Document
from docx.oxml.ns import qn
import re, json

doc = Document('/home/claude/merge/KL_v16.docx')

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

def has_border_shading(el, color_hint=None):
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

children = get_children()

modules = {}
current_module = None
for typ, el in children:
    if typ == 'p':
        txt = ptext(el).strip()
        if txt.upper().startswith('MODULI ') and '—' in txt:
            modnum = re.match(r'MODULI (\d+)', txt.upper()).group(1)
            current_module = modnum
            modules[current_module] = {'title': txt, 'blocks': []}
            continue
    if current_module not in ('1','2'):
        continue
    if typ == 'tbl':
        modules[current_module]['blocks'].append({'type':'table','html': table_to_html(el)})
        continue
    txt = ptext(el).strip()
    if not txt:
        continue
    style = pstyle(el)
    shd = has_border_shading(el)
    if style in ('Heading1','Heading2','Heading3','Heading4'):
        lvl = int(style[-1])
        modules[current_module]['blocks'].append({'type':'heading','level':lvl,'text':txt})
    elif style == 'ListParagraph':
        modules[current_module]['blocks'].append({'type':'bullet','text':txt})
    elif shd == 'D6E8F5':
        modules[current_module]['blocks'].append({'type':'box_koncept','text':txt})
    elif shd == 'FBF3E0':
        modules[current_module]['blocks'].append({'type':'box_praktike','text':txt})
    elif shd == 'E6F2EA':
        modules[current_module]['blocks'].append({'type':'box_rast','text':txt})
    elif is_bold(el) and re.match(r'^(Tabela|Figura)\s+\d+\.\d+', txt):
        modules[current_module]['blocks'].append({'type':'caption','text':txt})
    else:
        modules[current_module]['blocks'].append({'type':'para','text':txt})

with open('modules_data.json','w',encoding='utf-8') as f:
    json.dump(modules, f, ensure_ascii=False, indent=1)

for k, v in modules.items():
    print(k, v['title'], len(v['blocks']), 'blocks')
