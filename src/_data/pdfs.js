// ---------------------------------------------------------------------------
// Matches PDF files in src/files/papers/ to entries in publications.yaml.
//
// You do not have to rename your PDFs or edit any YAML. Drop them in the
// folder and this works out which paper each one belongs to, by looking for a
// first-author surname and a year in the filename, and then scoring title
// words. Anything it cannot place with confidence is reported at build time
// and simply gets no link, rather than being guessed at.
//
// If a file is stubborn, override it by adding a line to that publication in
// publications.yaml:
//
//     pdf: "whatever-the-file-is-called.pdf"
//
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const DIR = path.join(__dirname, "..", "files", "papers");

// words too common to carry any signal in a filename
const STOP = new Set(
  ("the a an and or of in on for to from with without by is are be as at not " +
   "how why what when where which that this these those its it their our we " +
   "us new novel using use used study studies review reference article paper " +
   "final accepted published manuscript preprint proof revised revision copy " +
   "pdf main supp supplement supplementary si et al draft version v1 v2 v3")
    .split(" ")
);

function words(s) {
  return String(s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // strip accents
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")                            // strip <em> etc
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

// Common journal shorthands people actually type into filenames.
const JOURNAL_ALIASES = {
  "proceedings of the national academy of sciences": ["pnas"],
  "trends in ecology and evolution": ["tree"],
  "the american naturalist": ["amnat", "amnaturalist", "annat"],
  "nature communications": ["natcomms", "ncomms", "natcomm"],
  "nature climate change": ["ncc", "natclim"],
  "systematic biology": ["sysbio", "systbio"],
  "biology letters": ["biolett", "bioletters", "rsbl"],
  "annual review of ecology, evolution & systematics": ["arees", "aress", "areesystematics"],
  "journal of heredity": ["jhered"],
  "journal of animal ecology": ["jae", "janimecol"],
  "journal of biogeography": ["jbi", "jbiogeo"],
  "biological journal of the linnean society": ["bjls"],
  "evolutionary journal of the linnean society": ["ejls"],
  "journal of herpetology": ["jherp"],
  "ecology and evolution": ["ecolevol", "ece"],
  "ecology & evolution": ["ecolevol", "ece"],
  "diversity and distributions": ["ddi", "divdist"],
  "biological conservation": ["biocon"],
  "biological invasions": ["bioinv"],
  "urban ecosystems": ["urbeco"],
  "philosophical transactions of the royal society b": ["ptrsb", "philtrans"],
  "ircf reptiles & amphibians": ["ircf", "randa"],
  "herpetological review": ["herprev", "hr"],
  "npj complexity": ["npj"],
  "journal of open source software": ["joss"],
  "journal for nature conservation": ["jnc"],
};

// journal words + an acronym built from initials, e.g. "tree", "pnas"
function journalTokens(journal) {
  const j = String(journal || "").toLowerCase().trim();
  const w = words(j);
  const out = new Set(w);
  if (w.length >= 2) out.add(w.map((x) => x[0]).join(""));
  const full = j.replace(/\s+/g, " ");
  Object.keys(JOURNAL_ALIASES).forEach((k) => {
    if (full.includes(k)) JOURNAL_ALIASES[k].forEach((a) => out.add(a));
  });
  return out;
}

function surnames(authorString) {
  // "Stroud, J.T., Losos, J.B." -> ["stroud", "losos"]
  return String(authorString)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !/^[A-Z]\.?([A-Z]\.?)*$/.test(s) && !/^\(/.test(s))
    .map((s) => s.replace(/\s*\(.*$/, "").split(/\s+/).pop())
    .map((s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase())
    .filter((s) => s.length > 2);
}

module.exports = function () {
  if (!fs.existsSync(DIR)) return { byIndex: {}, byTitle: {}, unmatched: [], count: 0 };

  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf") && !f.startsWith("."));

  const pubs = yaml.load(
    fs.readFileSync(path.join(__dirname, "publications.yaml"), "utf8")
  );

  // explicit overrides win outright
  const byIndex = {};
  const claimed = new Set();
  pubs.forEach((p, i) => {
    if (p.pdf && files.includes(p.pdf)) {
      byIndex[i] = p.pdf;
      claimed.add(p.pdf);
    }
  });

  // score every remaining file against every publication
  const candidates = [];
  files.forEach((file) => {
    if (claimed.has(file)) return;
    const fw = words(file.replace(/\.pdf$/i, ""));
    const fileYears = (file.match(/(19|20)\d{2}/g) || []).map(Number);

    pubs.forEach((p, i) => {
      if (byIndex[i]) return;

      const yearOk =
        fileYears.length === 0 ||
        fileYears.some((y) => Math.abs(y - Number(p.year)) <= 1);
      if (!yearOk) return;

      const sn = surnames(p.authors);
      const firstAuthorHit = sn.length && fw.includes(sn[0]);
      const anyAuthorHit = sn.some((s) => fw.includes(s));
      if (!anyAuthorHit) return;

      const tw = new Set(words(p.title));
      const titleHits = fw.filter((w) => tw.has(w)).length;

      const jt = journalTokens(p.journal);
      const journalHits = fw.filter((w) => jt.has(w)).length;

      // require either a strong title overlap, or first author plus an exact year
      const exactYear = fileYears.includes(Number(p.year));
      let score = 0;
      if (firstAuthorHit) score += 3;
      else score += 1;
      if (exactYear) score += 3;
      score += titleHits * 2;
      score += journalHits * 3;

      const confident =
        titleHits >= 2 ||
        (firstAuthorHit && exactYear && titleHits >= 1) ||
        (firstAuthorHit && journalHits >= 1) ||
        (firstAuthorHit && exactYear && fw.length <= 4);

      if (confident) candidates.push({ file, i, score });
    });
  });

  // greedy assignment, best scores first, one PDF per paper
  candidates.sort((a, b) => b.score - a.score);
  const usedFiles = new Set();
  candidates.forEach((c) => {
    if (byIndex[c.i] || usedFiles.has(c.file)) return;
    byIndex[c.i] = c.file;
    usedFiles.add(c.file);
  });

  const unmatched = files.filter(
    (f) => !claimed.has(f) && !usedFiles.has(f)
  );

  // key the result by title as well, so templates can look it up without
  // needing to know a publication's position in the list
  const byTitle = {};
  Object.entries(byIndex).forEach(([i, f]) => { byTitle[pubs[i].title] = f; });

  const matchedCount = Object.keys(byIndex).length;
  if (files.length) {
    console.log(`[pdfs] ${matchedCount} of ${files.length} PDFs linked to publications`);
    if (unmatched.length) {
      console.log("[pdfs] could not place these files (no link shown):");
      unmatched.forEach((f) => console.log("        " + f));
      console.log("[pdfs] add a `pdf: \"filename.pdf\"` line to the right entry in publications.yaml to force a match");
    }
  }

  return { byIndex, byTitle, unmatched, count: files.length, matched: matchedCount };
};
