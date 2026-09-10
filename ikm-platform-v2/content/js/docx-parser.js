// Parses a .docx file into the same block schema used by the admin
// content editor (heading/para/bullet/caption/table/box_*), entirely
// client-side - no server, no Claude needed for this part. Ports the
// exact classification rules from extract_modules.py: paragraph style
// for headings and bullets, shading color for the four callout boxes,
// bold + "Tabela/Figura N.N" pattern for captions. A .docx is just a
// zip of XML, so this only needs JSZip (unzip) + DOMParser (parse
// word/document.xml) - both already available or loadable from a CDN,
// no office-rendering engine required (unlike .pptx).
//
// Works the same in a browser (native DOMParser) and in Node for
// testing (any DOMParser-compatible implementation, e.g. @xmldom/xmldom).

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const BOX_SHADING = {
  D6E8F5: 'box_koncept',
  FBF3E0: 'box_praktike',
  E6F2EA: 'box_rast',
  F2F5FA: 'box_permbledhje',
};

function textOf(el) {
  const tNodes = el.getElementsByTagNameNS(NS_W, 't');
  let out = '';
  for (let i = 0; i < tNodes.length; i++) out += tNodes[i].textContent || '';
  return out;
}

function firstChild(el, localName) {
  const nodes = el.getElementsByTagNameNS(NS_W, localName);
  // getElementsByTagNameNS is recursive - for pPr/pStyle etc. we want
  // the direct child, so filter to direct children of the given parent.
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].parentNode === el) return nodes[i];
  }
  return null;
}

function pStyle(p) {
  const pPr = firstChild(p, 'pPr');
  if (!pPr) return null;
  const style = firstChild(pPr, 'pStyle');
  return style ? style.getAttributeNS(NS_W, 'val') : null;
}

function shadingFill(p) {
  const pPr = firstChild(p, 'pPr');
  if (!pPr) return null;
  const shd = firstChild(pPr, 'shd');
  return shd ? shd.getAttributeNS(NS_W, 'fill') : null;
}

function isFirstRunBold(p) {
  const r = firstChild(p, 'r');
  if (!r) return false;
  const rPr = firstChild(r, 'rPr');
  if (!rPr) return false;
  return !!firstChild(rPr, 'b');
}

function tableToHtml(tbl) {
  const rows = [];
  const trs = tbl.getElementsByTagNameNS(NS_W, 'tr');
  for (let i = 0; i < trs.length; i++) {
    const tag = i === 0 ? 'th' : 'td';
    const tcs = trs[i].getElementsByTagNameNS(NS_W, 'tc');
    let cellsHtml = '';
    for (let j = 0; j < tcs.length; j++) {
      cellsHtml += `<${tag}>${esc(textOf(tcs[j]).trim())}</${tag}>`;
    }
    rows.push(`<tr>${cellsHtml}</tr>`);
  }
  return `<table class="doc-table">${rows.join('')}</table>`;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CAPTION_RE = /^(Tabela|Figura)\s+\d+\.\d+/;

// docXml: the parsed XML Document of word/document.xml.
// Returns { blocks: [...] } - same schema as admin-save-module.js expects.
function parseDocumentXml(docXml) {
  const body = docXml.getElementsByTagNameNS(NS_W, 'body')[0];
  const blocks = [];
  let node = body.firstChild;
  while (node) {
    if (node.nodeType === 1 && node.namespaceURI === NS_W) {
      if (node.localName === 'p') {
        const txt = textOf(node).trim();
        if (txt) {
          const style = pStyle(node);
          const shd = shadingFill(node);
          if (style && /^Heading[1-4]$/.test(style)) {
            blocks.push({ type: 'heading', level: parseInt(style.slice(-1), 10), text: txt });
          } else if (style === 'ListParagraph') {
            blocks.push({ type: 'bullet', text: txt });
          } else if (shd && BOX_SHADING[shd.toUpperCase()]) {
            blocks.push({ type: BOX_SHADING[shd.toUpperCase()], text: txt });
          } else if (isFirstRunBold(node) && CAPTION_RE.test(txt)) {
            blocks.push({ type: 'caption', text: txt });
          } else {
            blocks.push({ type: 'para', text: txt });
          }
        }
      } else if (node.localName === 'tbl') {
        blocks.push({ type: 'table', html: tableToHtml(node) });
      }
    }
    node = node.nextSibling;
  }
  return { blocks };
}

// High-level entry point for the browser: takes a File/Blob (the
// uploaded .docx), returns { blocks }. Requires a global JSZip and
// DOMParser (both present in any modern browser once JSZip is loaded
// from a CDN script tag).
async function parseDocxFile(file) {
  const zip = await JSZip.loadAsync(file);
  const xmlEntry = zip.file('word/document.xml');
  if (!xmlEntry) throw new Error('Skedari nuk duket të jetë një .docx i vlefshëm (mungon word/document.xml).');
  const xmlText = await xmlEntry.async('text');
  const parser = new DOMParser();
  const docXml = parser.parseFromString(xmlText, 'application/xml');
  return parseDocumentXml(docXml);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseDocumentXml, parseDocxFile };
}
