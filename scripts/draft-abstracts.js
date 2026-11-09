#!/usr/bin/env node
// Drafts abstracts from the lab's own PDFs, for paper pages that have none.
//
// For each paper in publications.yaml that has a PDF in src/files/papers/ but
// no entry in abstracts.yaml, read the first two pages, find the text between
// "Abstract" (or "Summary") and the next heading, and write it to
// abstracts-draft.yaml at the top of the repository. It never touches
// src/_data/abstracts.yaml: check each draft (line breaks, hyphenation, italics
// for species names), then move the good ones across by hand.
//
//   node scripts/draft-abstracts.js
//
// Papers with no "Abstract" heading (most natural history notes and short
// comments) are listed at the end; give those a `summary:` in
// publications.yaml instead.

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.join(__dirname, "..");
const PAPERS_DIR = path.join(ROOT, "src", "files", "papers");
const OUT = path.join(ROOT, "abstracts-draft.yaml");

// Small-caps headings often extract as "A BSTRACT", so allow a space after the first letter.
const START = /\b(a\s?bstract|s\s?ummary)\b[\s.:—-]*/i;
const END = /\n\s*(?:\d\s*[|.]?\s*)?(introduction|keywords?|key\s*words|résumé|resumen|background|methods)\b|\b(keywords?|key\s*words)\s*[:.]/i;

async function pageText(pdf, n) {
  const page = await pdf.getPage(n);
  const content = await page.getTextContent();
  return content.items.map((it) => it.str + (it.hasEOL ? "\n" : "")).join("");
}

// Join lines inside a paragraph, mend words hyphenated across lines.
function tidy(s) {
  return s
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]*\n[ \t]*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:)])/g, "$1")
    .trim();
}

async function main() {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const papers = require(path.join(ROOT, "src", "_data", "papers.js"))();
  const todo = papers.filter((p) => !p.abstract && p.pdfFile);

  const drafts = {};
  const none = [];
  for (const p of todo) {
    const data = new Uint8Array(fs.readFileSync(path.join(PAPERS_DIR, p.pdfFile)));
    let text = "";
    try {
      const pdf = await getDocument({ data, verbosity: 0, useSystemFonts: false }).promise;
      for (let n = 1; n <= Math.min(2, pdf.numPages); n++) text += (await pageText(pdf, n)) + "\n";
    } catch (err) {
      none.push(`${p.slug} (could not read PDF: ${err.message})`);
      continue;
    }
    const s = START.exec(text);
    if (!s) { none.push(p.slug); continue; }
    const rest = text.slice(s.index + s[0].length);
    const e = END.exec(rest);
    const body = tidy(e ? rest.slice(0, e.index) : rest.slice(0, 2500));
    const words = body.split(/\s+/).length;
    if (words < 40) { none.push(`${p.slug} (only ${words} words found after the heading)`); continue; }
    drafts[p.doiBare || p.slug] = body;
  }

  const header = [
    "# DRAFT abstracts pulled from the lab's PDFs by scripts/draft-abstracts.js.",
    "# Not used by the website. Check each one against the PDF, then move it into",
    "# src/_data/abstracts.yaml (same key). Keys are DOIs, or page slugs where a",
    "# paper has no DOI.",
    "",
  ].join("\n");
  fs.writeFileSync(OUT, header + yaml.dump(drafts, { lineWidth: 100, quotingType: '"' }));
  console.log(`Drafted ${Object.keys(drafts).length} of ${todo.length} papers that have a PDF and no abstract -> ${path.relative(ROOT, OUT)}`);
  if (none.length) {
    console.log(`\nNo abstract found in ${none.length} PDFs (give these a summary: instead):`);
    none.forEach((x) => console.log("  " + x));
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
