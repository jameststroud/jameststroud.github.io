#!/usr/bin/env node
// Looks for papers that are on your ORCID record or in Crossref but not yet in
// src/_data/publications.yaml, and adds them in the site's house style.
//
// Run weekly by .github/workflows/update-publications.yml, which then opens a
// pull request for you to check. You can also run it yourself:
//
//   node scripts/update-publications.js --dry-run     # show what it would add
//   node scripts/update-publications.js               # edit publications.yaml
//
// Options:
//   --dry-run          print new entries, change nothing
//   --report FILE      write a Markdown summary (used as the pull request text)
//   --fixtures DIR     read API responses from DIR instead of the network (tests)

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.join(__dirname, "..");
const PUBS = path.join(ROOT, "src", "_data", "publications.yaml");
const ABSTRACTS = path.join(ROOT, "src", "_data", "abstracts.yaml");
const site = require(path.join(ROOT, "src", "_data", "site.json"));

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const DRY = flag("--dry-run");
const REPORT = opt("--report");
const FIXTURES = opt("--fixtures");

// Crossref asks callers to identify themselves; this puts us in its "polite" pool.
const UA = `thestroudlab.com publication checker (mailto:${site.email})`;

/* -------------------------------------------------------------- fetching */

async function getJSON(url, fixtureName) {
  if (FIXTURES) {
    const f = path.join(FIXTURES, fixtureName);
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, "utf8"));
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
    if (res.status === 404) return null;
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`${res.status} from ${url}`);
  }
  throw new Error(`gave up on ${url}`);
}

const normDoi = (d) => String(d || "").trim().toLowerCase()
  .replace(/^https?:\/\/(dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "");
const normTitle = (t) => String(t || "").toLowerCase()
  .replace(/<[^>]*>/g, "").normalize("NFKD").replace(/[^a-z0-9]+/g, "");
const safeName = (doi) => doi.replace(/[^a-z0-9]+/gi, "_") + ".json";

async function orcidDois(orcid) {
  const data = await getJSON(`https://pub.orcid.org/v3.0/${orcid}/works`, "orcid-works.json");
  const dois = new Set();
  for (const g of (data && data.group) || []) {
    for (const id of ((g["external-ids"] || {})["external-id"]) || []) {
      if (String(id["external-id-type"]).toLowerCase() === "doi") dois.add(normDoi(id["external-id-value"]));
    }
  }
  return dois;
}

async function crossrefByOrcid(orcid) {
  const url = `https://api.crossref.org/works?filter=orcid:${orcid}&rows=1000&mailto=${encodeURIComponent(site.email)}`;
  const data = await getJSON(url, "crossref-orcid.json");
  return ((data && data.message && data.message.items) || []);
}

async function crossrefWork(doi) {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(site.email)}`;
  const data = await getJSON(url, "work-" + safeName(doi));
  return data && data.message;
}

/* ------------------------------------------------------------ formatting */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function cleanTitle(t) {
  return String(t || "")
    .replace(/<\/?(i|em)>/gi, (m) => (m[1] === "/" ? "</em>" : "<em>"))
    .replace(/<(?!\/?em>)[^>]*>/gi, "")
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/\s+/g, " ")
    .trim();
}

// "James T." -> "J.T.", "Jean-Paul" -> "J.-P.", "M. del Rosario" -> "M.d.R."
function initials(given) {
  return String(given || "")
    .split(/\s+/).filter(Boolean)
    .map((w) => w.split("-").map((p) => (p ? p[0].toUpperCase() + "." : "")).join("-"))
    .join("");
}

function authorString(authors) {
  return (authors || []).map((a) => {
    if (a.family) return a.given ? `${a.family}, ${initials(a.given)}` : a.family;
    return a.name || "";
  }).filter(Boolean).join(", ");
}

function yearOf(w) {
  for (const k of ["published-print", "published-online", "published", "issued", "posted", "created"]) {
    const y = w[k] && w[k]["date-parts"] && w[k]["date-parts"][0] && w[k]["date-parts"][0][0];
    if (y) return y;
  }
  return new Date().getFullYear();
}

function detailOf(w) {
  if (w.type === "posted-content") {
    const where = (w.institution && w.institution[0] && w.institution[0].name) || w["group-title"] || w.publisher;
    return where ? `preprint on ${where}` : "preprint";
  }
  let d = w.volume || "";
  if (w.issue) d += `(${w.issue})`;
  const pages = w.page || w["article-number"];
  if (pages) d += (d ? ": " : "") + String(pages).replace(/--?/g, "-");
  return d;
}

const q = (s) => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';

function toEntry(w) {
  const type = w.type === "posted-content" ? "inreview" : "article";
  const e = {
    year: yearOf(w),
    type,
    authors: authorString(w.author),
    title: cleanTitle(w.title && w.title[0]),
    journal: type === "article" ? cleanTitle(w["container-title"] && w["container-title"][0]) : null,
    detail: detailOf(w),
    doi: "https://doi.org/" + w.DOI,
  };
  const lines = [
    "  # Added automatically from Crossref; check the details, then delete this line.",
    `- year: ${e.year}`,
    `  type: ${e.type}`,
    `  authors: ${q(e.authors)}`,
    `  title: ${q(e.title)}`,
  ];
  if (e.journal) lines.push(`  journal: ${q(e.journal)}`);
  if (e.detail) lines.push(`  detail: ${q(e.detail)}`);
  lines.push(`  doi: ${q(e.doi)}`);
  // The comment belongs to the entry below it, so indent it as a list item.
  lines[0] = lines[0].replace(/^  /, "");
  return { e, text: lines.join("\n") + "\n" };
}

/* ------------------------------------------------------------- abstracts */

// Crossref abstracts are JATS XML. Keep paragraphs and italics, drop the rest.
function jatsToText(x) {
  return String(x || "")
    .replace(/<jats:title>[\s\S]*?<\/jats:title>/gi, "")
    .replace(/<\/?jats:(italic|i)>/gi, (m) => (m[1] === "/" ? "</em>" : "<em>"))
    .replace(/<\/jats:p>\s*<jats:p[^>]*>/gi, "\n\n")
    .replace(/<(?!\/?em>)[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

// Fill abstracts.yaml for every listed DOI we have not looked up before.
// An empty string records "Crossref has no abstract", so it is not re-asked.
async function fillAbstracts(dois, knownWorks) {
  const current = fs.existsSync(ABSTRACTS) ? yaml.load(fs.readFileSync(ABSTRACTS, "utf8")) || {} : {};
  const have = new Set(Object.keys(current).map(normDoi));
  let found = 0;
  for (const doi of dois) {
    if (!doi || have.has(doi)) continue;
    const w = knownWorks.get(doi) || (await crossrefWork(doi));
    const text = w && w.abstract ? jatsToText(w.abstract) : "";
    current[doi] = text;
    if (text) found++;
  }
  const header = [
    "# ---------------------------------------------------------------------------",
    "# ABSTRACTS, keyed by DOI. Shown on each paper's page on the website.",
    "#",
    "# Filled automatically from Crossref by the weekly publication check. An",
    "# empty value means Crossref had none; paste one in by hand if you like.",
    "# <em>...</em> is allowed for species names; blank lines start paragraphs.",
    "# ---------------------------------------------------------------------------",
    "",
  ].join("\n");
  const sorted = Object.fromEntries(Object.keys(current).sort().map((k) => [k, current[k]]));
  return { found, text: header + yaml.dump(sorted, { lineWidth: 100, quotingType: '"' }) };
}

/* ------------------------------------------------------------- filtering */

const KEEP_TYPES = new Set(["journal-article", "posted-content"]);
const SKIP_TITLE = /^(author\s+)?(correction|corrigendum|erratum|retraction|reply|response)\b/i;
const LAB_NAME = /^stroud$/i;

function reason(w) {
  if (!KEEP_TYPES.has(w.type)) return `type is ${w.type}`;
  const title = cleanTitle(w.title && w.title[0]);
  if (!title) return "no title";
  if (SKIP_TITLE.test(title)) return "correction or reply";
  if (!(w.author || []).some((a) => LAB_NAME.test(a.family || ""))) return "no author named Stroud";
  return null;
}

/* ------------------------------------------------------------ inserting */

function insertAfterHeader(text, headerRe, block) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => headerRe.test(l));
  if (i < 0) return null;
  // Skip the blank line(s) after the header, then insert before the first entry.
  let j = i + 1;
  while (j < lines.length && lines[j].trim() === "") j++;
  lines.splice(j, 0, block.trimEnd(), "");
  return lines.join("\n");
}

function insert(text, entries, headerRe) {
  if (!entries.length) return text;
  const block = entries.map((x) => x.text).join("\n");
  const out = insertAfterHeader(text, headerRe, block);
  if (out) return out;
  // Section header missing: insert before the first entry in the file.
  const lines = text.split("\n");
  const first = lines.findIndex((l) => /^- /.test(l));
  lines.splice(first < 0 ? lines.length : first, 0, block.trimEnd(), "");
  return lines.join("\n");
}

/* ------------------------------------------------------------------ main */

async function main() {
  if (!site.orcid) throw new Error('Set "orcid" in src/_data/site.json first.');
  const text = fs.readFileSync(PUBS, "utf8");
  const existing = yaml.load(text) || [];
  const haveDoi = new Set(existing.map((p) => normDoi(p.doi)).filter(Boolean));
  const haveTitle = new Set(existing.map((p) => normTitle(p.title)).filter(Boolean));

  const [fromOrcid, fromCrossref] = await Promise.all([orcidDois(site.orcid), crossrefByOrcid(site.orcid)]);
  const works = new Map();
  for (const w of fromCrossref) works.set(normDoi(w.DOI), w);
  for (const doi of fromOrcid) {
    if (works.has(doi) || haveDoi.has(doi)) continue;
    const w = await crossrefWork(doi);
    if (w) works.set(doi, w);
    else works.set(doi, { DOI: doi, type: "not in Crossref (often a dataset or a DataCite DOI)", title: [] });
  }

  const added = [];
  const skipped = [];
  for (const [doi, w] of works) {
    if (haveDoi.has(doi)) continue;
    const why = reason(w);
    const title = cleanTitle(w.title && w.title[0]);
    if (why) { skipped.push({ doi, title, why }); continue; }
    if (haveTitle.has(normTitle(title))) { skipped.push({ doi, title, why: "same title already listed (DOI missing or different)" }); continue; }
    const entry = toEntry(w);
    const preprints = ((w.relation && w.relation["has-preprint"]) || []).map((r) => normDoi(r.id));
    entry.replaces = existing.find((p) => p.type === "inreview" && preprints.includes(normDoi(p.doi)));
    added.push(entry);
    haveTitle.add(normTitle(title));
  }

  added.sort((a, b) => b.e.year - a.e.year);
  const articles = added.filter((x) => x.e.type === "article");
  const preprints = added.filter((x) => x.e.type === "inreview");

  let out = text;
  out = insert(out, preprints, /^# =+ In review/);
  out = insert(out, articles, /^# =+ Journal articles/);

  // Make sure the result still parses before touching the file.
  const parsed = yaml.load(out);
  if (!Array.isArray(parsed) || parsed.length !== existing.length + added.length) {
    throw new Error("Refusing to write: the edited file did not parse as expected.");
  }

  const report = [];
  report.push(`Checked ORCID record [${site.orcid}](https://orcid.org/${site.orcid}) and Crossref: ${fromOrcid.size} DOIs on ORCID, ${fromCrossref.length} works in Crossref linked to that ORCID iD.`, "");
  if (added.length) {
    report.push(`### Added ${added.length} new ${added.length === 1 ? "entry" : "entries"}`, "");
    for (const x of added) {
      report.push(`- **${x.e.title.replace(/<\/?em>/g, "*")}** (${x.e.year}), ${x.e.journal || x.e.detail}. ${x.e.doi}`);
      if (x.replaces) report.push(`  - This looks like the published version of the preprint "${x.replaces.title}". You may want to delete that preprint entry.`);
    }
    report.push("", "Each new entry starts with a comment line. Check the author list, italics in species names, and the volume and pages, then delete the comment. Add `featured: true` or `press: true` where you want them.");
  } else {
    report.push("No new publications found.");
  }
  if (skipped.length) {
    report.push("", "<details><summary>Skipped " + skipped.length + " works</summary>", "");
    for (const s of skipped) report.push(`- ${s.title || "(untitled)"}: ${s.why}. https://doi.org/${s.doi}`);
    report.push("", "</details>");
  }
  const allDois = parsed.map((p) => normDoi(p.doi)).filter(Boolean);
  const abs = await fillAbstracts(allDois, works);
  if (abs.found) report.push("", `Also added ${abs.found} paper abstract${abs.found === 1 ? "" : "s"} from Crossref to \`abstracts.yaml\`; they appear on each paper's own page.`);
  report.push("", "---", "_Opened automatically by the weekly publication check (`.github/workflows/update-publications.yml`)._");
  const md = report.join("\n") + "\n";

  if (REPORT) fs.writeFileSync(REPORT, md);
  if (DRY) {
    console.log(added.map((x) => x.text).join("\n") || "(nothing new)");
    console.log("\n" + md);
    return;
  }
  if (added.length) fs.writeFileSync(PUBS, out);
  fs.writeFileSync(ABSTRACTS, abs.text);
  console.log(md);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
