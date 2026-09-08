# -*- coding: utf-8 -*-
"""
Converts a module's .pptx into a set of static slide images plus a
view-only prev/next viewer page, matching the IKM visual identity.

Usage:
    python3 build_slides.py <modnum> <path-to-pptx> "<Module title for the viewer page>"

Example:
    python3 build_slides.py 7 source/Moduli_7_Skemat_e_Ryshfetit_dhe_Korrupsionit_Final_1.pptx \\
        "Skemat e Ryshfetit dhe Korrupsionit"

What it does:
  1. Converts the .pptx to a .pdf via headless LibreOffice (soffice).
  2. Rasterizes each PDF page to a JPEG via pdftoppm (110 DPI, quality 82 -
     legible text, ~80KB/slide, no external dependency at runtime).
  3. Writes the images to
     content/course/kontabilist-ligjor/modul-<N>/slides/slide-NN.jpg
  4. Writes a lightweight prev/next viewer page (single <img>, vanilla JS,
     no framework) to
     content/course/kontabilist-ligjor/modul-<N>/slides/index.html
  5. Protection: slide images live under /course/*, which is already
     covered end-to-end by the existing session edge function (see
     netlify/edge-functions/auth-gate.js, config.path = '/course/*') and
     the page-wide watermark/copy-deterrents in auth-gate.js - no new
     protection code needed, it's inherited automatically.

Nothing here is rendered live in the browser - conversion happens once,
at build time, on this end; the deployed site only ever serves the
resulting static JPEGs and one small HTML/JS viewer page.
"""
import subprocess, sys, os, shutil, glob, tempfile

def convert(modnum, pptx_path, title, course_slug='kontabilist-ligjor', course_name='Kontabilist Ligjor'):
    modnum = str(modnum)
    out_dir = f'content/course/{course_slug}/modul-{modnum}/slides'
    os.makedirs(out_dir, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            ['soffice', '--headless', '--convert-to', 'pdf', '--outdir', tmp, pptx_path],
            check=True, timeout=300, capture_output=True,
        )
        pdf_candidates = glob.glob(os.path.join(tmp, '*.pdf'))
        if not pdf_candidates:
            raise RuntimeError('LibreOffice did not produce a PDF - check the .pptx opens cleanly.')
        pdf_path = pdf_candidates[0]

        prefix = os.path.join(tmp, 'slide')
        subprocess.run(
            ['pdftoppm', '-jpeg', '-jpegopt', 'quality=82', '-r', '110', pdf_path, prefix],
            check=True, timeout=300, capture_output=True,
        )
        produced = sorted(glob.glob(prefix + '*.jpg'))
        if not produced:
            raise RuntimeError('pdftoppm produced no slide images.')

        n = len(produced)
        width = max(2, len(str(n)))
        for i, src in enumerate(produced, start=1):
            dst = os.path.join(out_dir, f'slide-{i:0{width}d}.jpg')
            shutil.copyfile(src, dst)

    slide_files = sorted(os.listdir(out_dir))
    write_viewer(out_dir, slide_files, modnum, title, course_slug, course_name)
    print(f'Module {modnum}: {n} slides -> {out_dir}/')
    return n

VIEWER_TEMPLATE = '''<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Prezantimi — {title} — {course_name}</title>
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
<div class="slides-shell" id="protected-content">
  <a class="slides-back" href="/course/{course_slug}/modul-{modnum}/">← Kthehu te Moduli {modnum}</a>
  <h1 class="slides-title">{title}</h1>
  <div class="slides-viewer">
    <button class="slides-nav slides-prev" id="prev-btn" aria-label="Rrëshqitja paraardhëse">‹</button>
    <img class="slides-image" id="slide-img" src="slide-{first}.jpg" alt="Rrëshqitja 1">
    <button class="slides-nav slides-next" id="next-btn" aria-label="Rrëshqitja pasardhëse">›</button>
  </div>
  <div class="slides-controls">
    <span>Rrëshqitja</span>
    <select id="slide-select" aria-label="Shko te rrëshqitja"></select>
    <span>nga {count}</span>
  </div>
</div>
<script src="/js/auth-gate.js"></script>
<script>
(function () {{
  var files = {files_json};
  var img = document.getElementById('slide-img');
  var select = document.getElementById('slide-select');
  var prevBtn = document.getElementById('prev-btn');
  var nextBtn = document.getElementById('next-btn');
  var i = 0;

  files.forEach(function (f, idx) {{
    var opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = (idx + 1);
    select.appendChild(opt);
  }});

  function show(idx) {{
    idx = Math.max(0, Math.min(files.length - 1, idx));
    i = idx;
    img.src = files[i];
    img.alt = 'Rrëshqitja ' + (i + 1);
    select.value = i;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === files.length - 1;
    // warm the immediate neighbours so prev/next feels instant
    [i - 1, i + 1].forEach(function (n) {{
      if (n >= 0 && n < files.length) {{ new Image().src = files[n]; }}
    }});
  }}

  prevBtn.addEventListener('click', function () {{ show(i - 1); }});
  nextBtn.addEventListener('click', function () {{ show(i + 1); }});
  select.addEventListener('change', function () {{ show(parseInt(select.value, 10)); }});
  document.addEventListener('keydown', function (e) {{
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  }});

  show(0);
}})();
</script>
</body>
</html>
'''

def write_viewer(out_dir, slide_files, modnum, title, course_slug, course_name):
    first = slide_files[0].replace('slide-', '').replace('.jpg', '')
    import json
    html = VIEWER_TEMPLATE.format(
        title=title, modnum=modnum, course_slug=course_slug, course_name=course_name,
        first=first, count=len(slide_files),
        files_json=json.dumps(slide_files, ensure_ascii=False),
    )
    with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    modnum, pptx_path, title = sys.argv[1], sys.argv[2], sys.argv[3]
    convert(modnum, pptx_path, title)
