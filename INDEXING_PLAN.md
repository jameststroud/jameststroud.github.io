# Search Console indexing plan

Source: Search Console Pages export for `www.thestroudlab.com`, 9 November 2026 (filter: all known pages). Data runs 3 October to 5 November 2026.

## What the export shows

Google knows 210 URLs. 116 are indexed and 94 are not. The indexed count rose from 37 to 116 between 3 and 23 October and has not moved since; the not-indexed count has sat at 94 since 23 October.

| Reason | Pages | Source | Problem? |
|---|---|---|---|
| Discovered: currently not indexed | 74 | Google | **Yes. The main issue.** |
| Duplicate without user-selected canonical | 9 | Website | Probably not (see below) |
| Page with redirect | 5 | Website | No. Expected. |
| Alternate page with proper canonical tag | 4 | Website | No. Working as intended. |
| Excluded by `noindex` tag | 1 | Website | No. Intentional. |
| Crawled: currently not indexed | 1 | Google | Same cause as the 74 |

The export has counts only, no URLs. The diagnosis below comes from building the site and comparing its output with these numbers. Step 0 of the plan confirms it against Google's own URL lists.

### Where the 210 URLs come from

The current build produces 113 sitemap URLs (95 paper pages under `/publications/`, plus 18 other pages) and 85 PDFs (84 papers in `/files/papers/` and the CV). That is 198. The remaining dozen are the redirect and alternate URLs below, plus the noindexed page.

## Why each one happens

### 1. Discovered: currently not indexed (74), and Crawled: currently not indexed (1)

Google found these URLs but chose not to fetch them yet. On a new domain this usually means Google sampled a group of pages that share a URL pattern, judged the group low value, and put the rest at the back of the queue.

The pattern here is `/publications/<slug>/`. **71 of the 95 paper pages have no abstract.** Those pages carry 60 to 90 words of their own (title, authors, journal, citation) inside about 200 words of shared navigation and footer. To a crawler they are near-identical templates. Breakdown of the 71:

| Type | Pages | DOI | Local PDF |
|---|---|---|---|
| Journal articles | 42 | | |
| Natural history notes | 15 | | |
| Popular writing | 7 | | |
| In review | 6 | | |
| Edited volume | 1 | | |
| **Total** | **71** | **32** | **60** |

Only 11 have neither a DOI nor a PDF. Crossref had no abstract for any of the 32 with DOIs (the weekly workflow records these as empty and never asks again), so the content exists; we just have not pulled it in.

71 thin paper pages is close to the 74 in this bucket. Some of the 84 PDFs are probably in it as well. Step 0 settles the split.

**Fixable: yes, mostly.** Give each paper page enough of its own text to be worth indexing, and stop offering Google the ones that cannot get it.

### 2. Duplicate without user-selected canonical (9)

"Without user-selected canonical" means the URL has no canonical tag. Every HTML page on the site sets one (`src/_includes/base.njk:11`), so these are almost certainly PDFs. A PDF cannot carry a canonical tag, and GitHub Pages cannot send the `Link: rel=canonical` header that would replace it. Google has matched these PDFs to copies elsewhere (the publisher, PubMed Central, bioRxiv, ResearchGate) and indexed the other copy.

**Fixable: not on GitHub Pages, and not worth fixing.** Google Scholar still reads the PDFs through the `citation_pdf_url` tag on each paper page (`src/_includes/scholar-meta.njk:19`). Do **not** block `/files/` in `robots.txt`: that would cut Scholar off too. Step 0 confirms these are PDFs; if any turn out to be HTML pages, they need a closer look.

### 3. Page with redirect (5)

Google tried a URL that redirects: `http://` versions, the bare `thestroudlab.com`, slashless paths such as `/people`, or `jameststroud.github.io`. GitHub Pages sends a 301 to the canonical `https://www.` address with a trailing slash. This is the setup working. The build output contains no internal link to a redirecting URL.

**Nothing to fix.** Do not click "Validate fix" on this row.

### 4. Alternate page with proper canonical tag (4)

Google saw a URL variant (typically a link shared with `?utm_source=` or `?fbclid=` on the end) that serves the same page, read its canonical tag, and indexed the clean URL instead. This is what the canonical tag is for.

**Nothing to fix.**

### 5. Excluded by `noindex` tag (1)

Almost certainly `/lizards-on-the-loose/`. It is the "under construction" page noindexed on purpose in the SEO audit, and Google found it through the link on `/software/`. (`/stats/` is the only other noindexed page, and nothing links to it.)

**Fixes itself** when the page is written and its `noindex` and `sitemapExclude` lines come out.

## The plan

Phases 1 to 3 are code changes on one branch. Phase 4 is Search Console work after deploy.

### Phase 0. Confirm the diagnosis (Search Console, 10 minutes)

In **Indexing → Pages**, click each of the six rows under "Why pages aren't indexed" and use **Export** on each. Check:

- Discovered (74): roughly 70 `/publications/...` URLs, the rest PDFs?
- Duplicate (9): all PDFs?
- noindex (1): `/lizards-on-the-loose/`?

If the Discovered list is mostly PDFs rather than paper pages, Phase 1 matters less and the problem is simply crawl pace on a young domain. The rest of the plan still applies.

### Phase 1. Fill the abstracts (main fix)

**1a. Better abstract sources in the weekly workflow.** `scripts/update-publications.js` only asks Crossref (`fillAbstracts`, line 179). Add two fallbacks for DOIs where Crossref has nothing:

- OpenAlex (`https://api.openalex.org/works/doi:<doi>`), which returns `abstract_inverted_index`; rebuild the text by sorting words on position.
- PubMed: `esearch.fcgi?db=pubmed&term=<doi>[doi]`, then `efetch.fcgi?db=pubmed&id=<pmid>&rettype=abstract&retmode=xml`, read `AbstractText`.

Change the "empty string means never ask again" rule so an empty entry is retried by the new sources once. Record which source supplied each abstract in a YAML comment, so a person reviewing the weekly pull request can check it. Abstracts still arrive through that pull request; nothing publishes without review. Expected yield: some fraction of the 32 DOI papers. Some publishers withhold abstracts from both services.

**1b. Draft abstracts from the PDFs we already host.** New one-off script `scripts/draft-abstracts.js`. For each paper with a `pdfFile` and no abstract (60 pages), read page 1 with `pdfjs-dist` (pure JS, no system install), take the text between "Abstract"/"Summary" and the next heading ("Introduction", "Keywords", "1."), and write it to `abstracts-draft.yaml` keyed by DOI or slug. It never writes `abstracts.yaml`. A person checks each draft, fixes line breaks and italics, and moves the good ones across. Notes and short communications often have no abstract; the script lists those so they go to Phase 2.

**1c. Key abstracts by slug as well as DOI.** `src/_data/papers.js` looks abstracts up by DOI only, so the 11 items with no DOI can never get one. Let `abstracts.yaml` also accept a page slug as the key.

### Phase 2. Give every paper page some text of its own

**2a. A `summary:` field.** Optional, in `publications.yaml`: one to three plain-language sentences in the lab's voice. It fits natural history notes (15), popular pieces (7) and the edited volume, where there is no formal abstract. `papers.js` passes it through; `paper.njk` shows it under "About this paper" when there is no abstract; the `paperDescription` filter in `.eleventy.js` uses it for the meta description.

**2b. "More from the lab" on each paper page.** A new `relatedPapers` filter in `.eleventy.js` scores other papers by shared species or genus names in the title (e.g. *Anolis sagrei*, *A. equestris*) and shared topic words, then lists the top four on the page, after the existing species-guide line and research-story link. This adds 40 to 80 words of distinct text to each page. It also links paper pages to each other; today they are reached only from `/publications/`, which carries about 100 links, so Google reads them as low priority.

### Phase 3. Stop offering Google the pages that are still thin

After Phases 1 and 2, mark any paper page with no abstract and no summary as thin, and keep it out of the index until it has content:

- `src/_data/papers.js`: add `thin: !abstract && !summary` to each paper.
- `src/_includes/base.njk:8`: `{%- if noindex or (paper and paper.thin) %}`.
- `src/sitemap.njk:8`: also skip `item.data.paper and item.data.paper.thin`.

This is automatic in both directions: add an abstract or summary and the page becomes indexable on the next build. The page stays live and linked from `/publications/`. Trade-off: those papers will not show in Google web search for their exact titles until filled in. They remain in Google Scholar through the publisher and DOI.

Two small fixes on the same branch:

- `src/files/README.txt` is published at `/files/README.txt`, and its text is out of date (it says the CV link 404s). Change the passthrough in `.eleventy.js` to copy only `src/files/**/*.pdf`.
- Build check: add `scripts/check-index.js` (run after `npm run build`, also in the deploy workflow) that fails if any sitemap URL contains a `noindex` tag, or if any paper page is neither thin nor carrying an abstract or summary. This catches regressions before they reach Google.

### Phase 4. Search Console after deploy

1. **Sitemaps:** resubmit `https://www.thestroudlab.com/sitemap.xml`.
2. **Pages report:** "Validate fix" on *Discovered: currently not indexed* and *Crawled: currently not indexed* only. Leave the four website rows alone; they are expected states.
3. **URL Inspection → Request indexing** for the ten or so paper pages that matter most (recent, high-profile papers that now have abstracts). The daily quota is about ten.
4. Recheck at 2 and 6 weeks. Validation on a site this size usually takes two to four weeks to report.

## What to expect

The 9 duplicate, 5 redirect and 4 alternate rows will stay. They are normal for any site with PDFs and a `www` canonical, and they do not hurt ranking. The noindex row clears when `/lizards-on-the-loose/` is written.

Discovered should fall as paper pages gain content, though Google sets its own pace for a domain only a few months old. A realistic target is 150 or more indexed pages within six to eight weeks of deploy, with the remaining not-indexed set made up mostly of PDFs that Google has matched to publisher copies.

## Order of work and size

| Step | Files | Size |
|---|---|---|
| 0. Export URL lists | Search Console | 10 min |
| 1a. OpenAlex and PubMed fallbacks | `scripts/update-publications.js` | Medium |
| 1b. PDF abstract drafts | `scripts/draft-abstracts.js` (new), `package.json` (add `pdfjs-dist`) | Medium |
| 1c. Slug-keyed abstracts | `src/_data/papers.js` | Small |
| Review and paste abstracts | `src/_data/abstracts.yaml` | 1 to 2 hours, by hand |
| 2a. `summary:` field | `publications.yaml`, `papers.js`, `paper.njk`, `.eleventy.js` | Small, plus writing ~25 summaries |
| 2b. Related papers | `.eleventy.js`, `paper.njk`, `style.css` | Small |
| 3. Thin-page gate, README fix, check script | `papers.js`, `base.njk`, `sitemap.njk`, `.eleventy.js`, `scripts/check-index.js` (new), `deploy.yml` | Small |
| 4. Search Console | | 15 min, then wait |

Ship Phase 3 last, or together with Phases 1 and 2. Shipped alone it would noindex 71 pages at once.

## Could not check from here

The container's network blocks the live site and the Crossref, OpenAlex and PubMed APIs, so these were not tested live:

- which exact URLs sit in each Search Console bucket (Phase 0 answers this);
- how many of the 32 DOI papers have abstracts in OpenAlex or PubMed;
- live redirect behaviour for `http://`, the apex domain and `github.io` (inferred from GitHub Pages defaults and the earlier SEO audit).
