#!/usr/bin/env node
/* ============================================================
   MONOLITH BUILD SCRIPT
   Regenerates civic_trust_index.html from the modular sources
   (index.html + css/styles.css + js/data.js + js/app.js) so the
   two never drift apart again.

   Usage:  node build-monolith.js

   Transformations applied to index.html:
   - <link rel="stylesheet" href="css/styles.css">  → inline <style>
   - <script src="js/data.js"> and js/app.js        → inline <script>
   - <script src="beta-gate.js"> line (+ its marker
     comment) is dropped — the monolith is for direct
     sharing and should not be gated.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

// A literal "</script>" inside inlined JS would terminate the tag early;
// escape it the standard way (harmless inside JS strings/regexes).
const escInline = (js) => js.replace(/<\/script/gi, "<\\/script");

let html = read("index.html");
const replacements = [
  {
    find: '<link rel="stylesheet" href="css/styles.css">',
    make: () => "<style>\n" + read("css/styles.css").trim() + "\n</style>",
  },
  {
    find: '<script src="js/data.js"></script>',
    make: () => "<script>\n" + escInline(read("js/data.js").trim()) + "\n</script>",
  },
  {
    find: '<script src="js/app.js"></script>',
    make: () => "<script>\n" + escInline(read("js/app.js").trim()) + "\n</script>",
  },
  {
    // Beta gate: strip the marker comment and the script line.
    find: /\n<!-- PRIVATE BETA GATE[^\n]*-->\n<script src="beta-gate\.js"><\/script>/,
    make: () => "",
  },
];

for (const { find, make } of replacements) {
  const before = html;
  html = html.replace(find, make());
  if (html === before) {
    console.error("build-monolith: pattern not found in index.html: " + find);
    process.exit(1);
  }
}

const banner =
  "<!-- GENERATED FILE — do not edit by hand.\n" +
  "     Built from index.html + css/styles.css + js/data.js + js/app.js\n" +
  "     by build-monolith.js. Run `node build-monolith.js` after any\n" +
  "     change to those files. -->\n";
html = html.replace("<!DOCTYPE html>\n", "<!DOCTYPE html>\n" + banner);

fs.writeFileSync(path.join(root, "civic_trust_index.html"), html);
console.log(
  "civic_trust_index.html regenerated (" + html.split("\n").length + " lines)"
);
