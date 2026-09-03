#!/usr/bin/env node
/* ============================================================
   build-flags.js — regenerate DEFACTO_FLAGS in js/data.js
   from the editable sources in flags/*.svg.

   The five de facto states below have no ISO 3166-1 code and so
   no regional-indicator flag emoji; they get hand-drawn SVGs,
   inlined as data URIs so the generated monolith stays
   self-contained. Run this after editing any flags/*.svg, then
   run build-monolith.js.

   Encoding matters. The URIs are emitted into an HTML string
   (`<img src="...">`) via innerHTML, so a raw `"` would close
   the attribute and a raw `&` would start an entity; and per the
   URL spec a raw `#` starts the fragment, truncating the SVG at
   that point. All three, plus non-ASCII glyphs, are escaped.
   ============================================================ */
const fs = require('fs');
const path = require('path');

// file basename → display name (must match DEFACTO_POLYGONS names in js/defacto.js)
const FLAGS = [
  ['somaliland', 'Somaliland'],
  ['south-ossetia', 'South Ossetia'],
  ['abkhazia', 'Abkhazia'],
  ['northern-cyprus', 'Northern Cyprus'],
  ['transnistria', 'Transnistria'],
];

const fail = m => { console.error('build-flags: ' + m); process.exit(1); };

// Collapse an SVG to one line and escape what a data URI in an HTML
// attribute cannot carry raw. `%` goes first so later escapes survive.
const encode = svg => svg
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+/g, ' ')
  .replace(/>\s+</g, '><')
  .trim()
  .replace(/%/g, '%25')
  .replace(/#/g, '%23')
  .replace(/&/g, '%26')
  .replace(/"/g, '%22')
  .replace(/'/g, '%27')
  .replace(/</g, '%3C')
  .replace(/>/g, '%3E')
  .replace(/[^\x20-\x7E]/g, c => encodeURIComponent(c));

const lines = FLAGS.map(([file, name]) => {
  const p = path.join(__dirname, 'flags', file + '.svg');
  if (!fs.existsSync(p)) fail('missing source ' + p);
  return "  '" + name + "':'data:image/svg+xml," + encode(fs.readFileSync(p, 'utf8')) + "',";
});

const dataPath = path.join(__dirname, 'js', 'data.js');
const src = fs.readFileSync(dataPath, 'utf8');
const block = /const DEFACTO_FLAGS=\{\n[\s\S]*?\n\};/;
if (!block.test(src)) fail('DEFACTO_FLAGS block not found in js/data.js');

const rebuilt = 'const DEFACTO_FLAGS={\n' + lines.join('\n').replace(/,$/, '') + '\n};';
const out = src.replace(block, rebuilt);
fs.writeFileSync(dataPath, out);
console.log('js/data.js: DEFACTO_FLAGS regenerated from ' + FLAGS.length + ' SVGs' +
            (out === src ? ' (unchanged)' : ''));
