#!/usr/bin/env node
// Run after `npm run build`. Fails if the built site would send search engines
// mixed signals:
//   - a URL in sitemap.xml whose page carries a noindex tag;
//   - an indexable paper page with no abstract and no summary;
//   - a noindexed paper page that does have an abstract or summary.
//
//   npm run build && node scripts/check-index.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "_site");
const site = require(path.join(ROOT, "src", "_data", "site.json"));

const fileFor = (url) => path.join(OUT, url.replace(/^https?:\/\/[^/]+/, ""), url.endsWith("/") ? "index.html" : "");
const noindex = (html) => /<meta name="robots" content="[^"]*noindex/.test(html);

const problems = [];
const sitemap = fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  if (!loc.startsWith(site.url + "/")) { problems.push(`sitemap URL on the wrong host: ${loc}`); continue; }
  const f = fileFor(loc);
  if (!fs.existsSync(f)) { problems.push(`sitemap URL has no page: ${loc}`); continue; }
  if (noindex(fs.readFileSync(f, "utf8"))) problems.push(`sitemap lists a noindex page: ${loc}`);
}

const papers = require(path.join(ROOT, "src", "_data", "papers.js"))();
let thin = 0;
for (const p of papers) {
  const f = path.join(OUT, p.url_page, "index.html");
  if (!fs.existsSync(f)) { problems.push(`paper page missing: ${p.url_page}`); continue; }
  const html = fs.readFileSync(f, "utf8");
  const hasText = /class="paper__abstract"/.test(html);
  if (p.thin) thin++;
  if (!noindex(html) && !hasText) problems.push(`indexable paper page with no abstract or summary: ${p.url_page}`);
  if (noindex(html) && hasText) problems.push(`paper page has text but is noindexed: ${p.url_page}`);
}

console.log(`[check-index] ${locs.length} sitemap URLs; ${papers.length - thin} of ${papers.length} paper pages indexable, ${thin} kept out until they have an abstract or summary.`);
if (problems.length) {
  problems.forEach((x) => console.error("  " + x));
  process.exit(1);
}
