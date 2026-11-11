// ---------------------------------------------------------------------------
// One entry per publication, used to build a page for each paper at
// /publications/<slug>/. Everything comes from publications.yaml; you never
// need to edit this file.
//
// Abstracts live in abstracts.yaml, keyed by DOI (or by page slug for a paper
// with no DOI). The weekly publication check fills that file from Crossref,
// OpenAlex and PubMed; you can also paste one in by hand.
//
// A paper with neither an abstract nor a `summary:` in publications.yaml is
// marked `thin`: its page stays live but is kept out of search engines and the
// sitemap until it has some text of its own.
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const plain = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const ascii = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normDoi = (d) => String(d || "").trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");

const STOP = new Set("a an and the of in on for to from with by is are at as its how why what when do does".split(" "));

function firstSurname(authors) {
  const first = String(authors || "").split(",")[0] || "";
  return ascii(first).replace(/[^A-Za-z-]/g, "").toLowerCase() || "paper";
}

function slugFor(p) {
  const words = ascii(plain(p.title)).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ")
    .filter((w) => w && !STOP.has(w)).slice(0, 6);
  return [p.year, firstSurname(p.authors)].concat(words).join("-");
}

// "206(5): 403-417" -> { volume: "206", issue: "5", firstpage: "403", lastpage: "417" }
function parseDetail(detail) {
  const m = /^\s*([\w.-]+?)(?:\(([^)]+)\))?\s*:\s*([\w.]+)(?:\s*[-–]\s*([\w.]+))?\s*$/.exec(String(detail || ""));
  if (m) return { volume: m[1], issue: m[2], firstpage: m[3], lastpage: m[4] };
  const pp = /pp\.?\s*(\w+)\s*[-–]\s*(\w+)/.exec(String(detail || ""));
  return pp ? { firstpage: pp[1], lastpage: pp[2] } : {};
}

module.exports = function () {
  const dir = __dirname;
  const pubs = yaml.load(fs.readFileSync(path.join(dir, "publications.yaml"), "utf8")) || [];
  const absFile = path.join(dir, "abstracts.yaml");
  const abstracts = fs.existsSync(absFile) ? yaml.load(fs.readFileSync(absFile, "utf8")) || {} : {};
  const absByDoi = {};
  Object.keys(abstracts).forEach((k) => { absByDoi[normDoi(k)] = abstracts[k]; });
  const pdfs = require("./pdfs.js")();

  const used = new Set();
  return pubs.filter((p) => p.title).map((p) => {
    // `slug:` in publications.yaml pins a page's URL, so correcting a title
    // or year later does not break links to the old page.
    const base = p.slug || slugFor(p);
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = base + "-" + n;
    used.add(slug);
    const doi = normDoi(p.doi);
    return Object.assign({}, p, parseDetail(p.detail), {
      slug,
      url_page: "/publications/" + slug + "/",
      plainTitle: plain(p.title),
      doiBare: doi || null,
      pdfFile: pdfs.byTitle[p.title] || null,
      abstract: null,
      summary: p.summary ? String(p.summary).trim() : null,
    });
  }).map((p) => {
    const a = (p.doiBare && absByDoi[p.doiBare]) || absByDoi[p.slug];
    p.abstract = a ? String(a).trim() : null;
    p.thin = !p.abstract && !p.summary;
    return p;
  });
};
