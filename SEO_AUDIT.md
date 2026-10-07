# SEO audit: thestroudlab.com

Branch `seo-audit`, cut from `main` at `1fbbc99`. Thirteen commits (twelve fixes plus this report), none pushed or merged.

## Summary

The site is in better technical shape than the Search Console numbers suggest. Every page already had a single H1, an absolute canonical, Open Graph and Twitter tags, and a place in a correct sitemap. Nothing in the build output links to jameststroud.com or jameststroud.github.io, and five species guides already exist with real natural history and links to the lab's papers. The zero clicks come mostly from what searchers see in the results, not from anything blocking indexing:

- **Snippets did not match intent.** Of the 19 indexable pages outside `/publications/`, 15 had titles or descriptions long enough for Google to truncate (titles of 61 to 78 characters, descriptions of 165 to 205). The species titles led with lab framing ("Miami's Most Common Lizard · Stroud Lab") instead of the question people asked ("are brown anoles native to Florida").
- **The home page left "Stroud Lab" out of its title** and opened with "James Stroud", so it competed with `/james-stroud/` for the same name.
- **There is no general anole page**, so most of cluster 5 and the long tail of cluster 3 have nothing to rank.
- **Some of the questions people search with are not answered anywhere on the site** (green anole lifespan, anole eggs and tails, Louisiana range). Those need writing, not tweaking, and are listed in section 6 with TODOs.

**Data caveat.** `Queries.csv` and `Pages.csv` are not in the repository on any branch. The table below uses the queries and positions in your brief. Where the brief gave only a range ("48 to 93"), the table says so. The "current target page" column is my inference from page content, not from Pages.csv; please check it against the Pages report.

**Assumption: canonical host.** The brief says the site URL should be `https://thestroudlab.com`. The repo uses `https://www.thestroudlab.com` consistently: `src/_data/site.json:4`, `src/CNAME`, every canonical, the sitemap, robots.txt, and the README setup steps. The site is consistent, and switching hosts would mean re-signalling every URL, so I kept `www` as canonical. On GitHub Pages, the apex `thestroudlab.com` 301-redirects to `www` automatically when the A records are set. If you want the apex instead, it is a two-line change (`site.json` url and `src/CNAME`) plus a Search Console property change. Say so and I'll make it.

I could not reach the live site, the old domains, ORCID or Georgia Tech from this container (the network proxy blocks them), so none of the redirect checks in section 3 were tested live.

---

## 1. Repository (Step 1)

| Item | Finding |
| --- | --- |
| Generator | Eleventy 3.1 (`.eleventy.js`), Nunjucks templates, data in YAML/JSON under `src/_data/` |
| Layouts | `src/_includes/base.njk` (shell, all head tags), `species.njk` (anole guides), `story.njk` (research stories), `topic.njk` (draft topic pages), `scholar-meta.njk` (paper citation tags) |
| Content | Top-level pages are `src/*.njk`. Species guides: `src/miami-lizards/*.njk`. Research stories: `src/research/*.njk`. One page per paper is generated from `publications.yaml` by `src/paper.njk`. |
| Structured data | `src/_data/schema.js` (WebSite, ResearchOrganization, Person on every page); per-template ProfilePage, Article, ScholarlyArticle |
| Images | `@11ty/eleventy-img` rewrites every `<img>` to responsive WebP at build time |
| Deploy | `.github/workflows/deploy.yml`: on push to `main`, `npm ci && npm run build`, then upload `_site` to GitHub Pages. Custom domain from `src/CNAME` (`www.thestroudlab.com`). |
| Build | `npm run build` passes: 115 HTML pages (19 site pages, 1 noindexed stats page, 1 new 404, 94 paper pages) |

---

## 2. Query to page map (Step 2)

Buckets: **SNIPPET** = position 1 to 10, **STRENGTHEN** = 11 to 30, **GAP** = over 30 or no target. "Target" is the one page I recommend should rank for that query.

| Query | Cluster | Pos. | Target page | Bucket | Note |
| --- | --- | --- | --- | --- | --- |
| miami lizards | 1 Miami | 4 | `/miami-lizards/` | SNIPPET | Title rewritten |
| miami lizards species | 1 Miami | 7.5 | `/miami-lizards/` | SNIPPET | Title now leads "Miami Lizards: A Species Guide" |
| lizards of miami | 1 Miami | 7 | `/miami-lizards/` | SNIPPET | Matches H1 |
| lizard miami | 1 Miami | 8 | `/miami-lizards/` | SNIPPET | |
| lizards in miami | 1 Miami | 8 | `/miami-lizards/` | SNIPPET | Description opens "Which lizards live in Miami?" |
| green lizards in south florida | 1 Miami | 10 | `/miami-lizards/` | SNIPPET | Needs an H2 (see 5.1) |
| brown anole | 2 Brown | 3.3 | `/miami-lizards/brown-anole/` | SNIPPET | Title rewritten |
| are brown anoles native to florida | 2 Brown | 40 | `/miami-lizards/brown-anole/` | GAP | Page answers it only in the fact box; add question H2 |
| cuban brown anole florida | 2 Brown | 43 | `/miami-lizards/brown-anole/` | GAP | "Cuban" now in title |
| cuban anole | 2 Brown | 51 | `/miami-lizards/brown-anole/` | GAP | Ambiguous: also knight anole, which is Cuban. Brown is the better target. |
| brown anole native range | 2 Brown | 68 | `/miami-lizards/brown-anole/` | GAP | Add H2 + TODO |
| what does green lizards eat | 3 Green | 3.3 | `/miami-lizards/green-anole/` (assumed) | SNIPPET | Description now says what they eat |
| how long do anoles live | 3 Green | 7 | `/miami-lizards/green-anole/` (assumed) | SNIPPET | **No lifespan anywhere on site.** Content TODO. |
| how long do green anole lizards live | 3 Green | 10 | `/miami-lizards/green-anole/` | SNIPPET | Same content TODO |
| anolis carolinensis | 3 Green | 50 | `/miami-lizards/green-anole/` | GAP | |
| american green anole | 3 Green | 48 to 93 | `/miami-lizards/green-anole/` | GAP | "American green anole" now in description |
| green anole | 3 Green | 48 to 93 | `/miami-lizards/green-anole/` | GAP | |
| american chameleon | 3 Green | 48 to 93 | `/miami-lizards/green-anole/` | GAP | Already in lead; add H2 |
| adult green anole | 3 Green | 48 to 93 | `/miami-lizards/green-anole/` | GAP | Needs a size/adult section |
| green lizard in florida | 3 Green | 48 to 93 | `/anoles/` (new hub) | GAP | Intent is ID across species |
| types of green lizards in florida | 3 Green | 48 to 93 | `/anoles/` (new hub) | GAP | |
| green lizard louisiana | 3 Green | 48 to 93 | `/miami-lizards/green-anole/` | GAP | Louisiana not mentioned on site. Content TODO. |
| anolis equestris | 4 Knight | 17 | `/miami-lizards/knight-anole/` | STRENGTHEN | Competes with 5 paper pages (see cannibalization) |
| big anole | 4 Knight | 40 | `/miami-lizards/knight-anole/` | GAP | Title now "Florida's Largest Anole" |
| large green anole | 4 Knight | 59 | `/miami-lizards/knight-anole/` | GAP | Description now "a big green lizard" |
| cuban knight anole diet | 4 Knight | 64 | `/miami-lizards/knight-anole/` | GAP | Content exists under "An anole that eats fruit, lizards and snakes"; rename H2 to a question |
| anole lizards | 5 General | 6 | `/anoles/` (new); today probably `/miami-lizards/` | SNIPPET | Strongest general query; worth the new page |
| anoles | 5 General | 28 | `/anoles/` (new) | STRENGTHEN | |
| anole lizard | 5 General | 58 | `/anoles/` (new) | GAP | |
| anole lizard evolution | 5 General | 56 | `/topics/lizard-evolution/` (draft) | GAP | Publish the draft topic page |
| common anole | 5 General | not given | `/anoles/` (new) | GAP | |
| anole tail | 5 General | not given | `/anoles/` (new) | GAP | Content TODO |
| florida anole eggs | 5 General | not given | `/anoles/` (new) | GAP | Content TODO |
| red throated lizard | 5 General | not given | `/anoles/` (new) | GAP | Dewlap section; links to brown and green |
| are anoles reptiles or amphibians | 5 General | not given | `/anoles/` (new) | GAP | |
| florida lizard with ridge on back | 5 General | not given | `/anoles/` (new) ID section | GAP | Possibly crested anole (tail crest) or green anole (display crest). Your call. |
| anoles florida | 5 General | 54 | `/anoles/` (new) | GAP | |
| stroud lab | 6 Identity | 2 | `/` | SNIPPET | Title now starts "Stroud Lab" |
| james stroud georgia tech | 6 Identity | 4 | `/james-stroud/` | SNIPPET | Title already fits; description tightened |
| lizard ecology | 6 Identity | 28 | `/research/` | STRENGTHEN | Title now matches H1 |
| site:www.jameststroud.com | 7 Old | 1 | n/a | none | Self-check. Confirms old domain still indexed. |
| site:jameststroud.github.io | 7 Old | 1 | n/a | none | Same |

That is 42 queries; the brief mentions 46, so the other 4 are presumably the misspellings and unclear queries you said to ignore.

### Cannibalization

| Cluster | Competing pages | Recommendation | Status |
| --- | --- | --- | --- |
| Identity | `/` and `/james-stroud/` both titled "James Stroud · Evolutionary Ecologist, Georgia Tech" | `/` for "stroud lab", `/james-stroud/` for the name | **Fixed** (home title now leads with Stroud Lab) |
| Miami | `/miami-lizards/`, `/lizards-on-the-loose/` (placeholder), `/research/lizard-island/` ("Miami's Anoles") | `/miami-lizards/` | **Fixed** for the placeholder (noindexed). Lizard Island is a research story and is fine as a supporting page that links to the hub. |
| Knight anole | `/miami-lizards/knight-anole/` plus 5 paper pages titled "Anolis equestris (Cuban knight anole): ..." | The species guide | **Mitigated**: every such paper page now links to the guide |
| General anole | `/miami-lizards/` (de facto), `/research/`, draft `/topics/anolis-lizards/` ("Anolis Lizards") | A new `/anoles/` hub. Retitle the draft topic page to its research angle ("Anolis lizards as a study system") before publishing it, so it does not chase "anole lizards" too. | Content needed |

---

## 3. Domain consolidation and indexing (Step 3)

| # | Severity | File:line | Finding | Fix |
| --- | --- | --- | --- | --- |
| 3.1 | OK | `src/CNAME`, `src/_data/site.json:4` | Both are `www.thestroudlab.com` / `https://www.thestroudlab.com`. Consistent. | None (see host assumption above) |
| 3.2 | OK | `src/_includes/base.njk:11` | Absolute https canonical on every page from `site.url + page.url`. All URLs end in `/`; GitHub Pages 301s the slashless form. | None |
| 3.3 | OK | built output | No `href`/`src` to jameststroud.com or jameststroud.github.io. Only `github.com/jameststroud` (your GitHub profile, correct). | None |
| 3.4 | OK | `src/sitemap.njk`, `src/robots.njk` | Sitemap lists only canonical `www` URLs (110 after this branch); robots.txt allows everything and points to it. | Optional: add `<lastmod>`. Low value. |
| 3.5 | OK | `src/stats.njk:10` | Only intended noindex is the private stats page. | None |
| 3.6 | Medium | `src/lizards-on-the-loose.njk` | 137-word "under construction" page was indexed and in the sitemap, competing with `/outreach/`. | **Fixed**: `noindex: true`, `sitemapExclude: true`. Delete both lines when the page is written. |
| 3.7 | Medium | (missing) | No `404.html`. Old-domain visitors on dead paths got GitHub's generic 404. | **Fixed**: `src/404.njk`, noindex, links back into the site. `base.njk` now omits the canonical on noindex pages. |
| 3.8 | Low | `README.md:212` | Typo "jamestsroud.com" in the setup instructions. | **Fixed** |

### Outside the repository (cannot be done from code)

1. **Confirm apex to www.** `curl -sI https://thestroudlab.com/` should return `301` to `https://www.thestroudlab.com/`. If not, check the four GitHub A records (README step 4) and that "Enforce HTTPS" is ticked under Settings → Pages.
2. **jameststroud.com 301s, path-preserving.** At the registrar (or Cloudflare), redirect `jameststroud.com/*` and `www.jameststroud.com/*` to `https://www.thestroudlab.com/$1` with a **301** (not 302, not a frame or "masked" forward). Path-preserving matters: `/publications/` and `/people/` probably existed on the old site and should land on their equivalents. Before you switch, export the old domain's top pages from Search Console (Pages report on the jameststroud.com property) so any old URL with a different path gets its own rule.
3. **jameststroud.github.io.** For a user site with a custom domain, GitHub already 301s `jameststroud.github.io/*` to the custom domain. Confirm with `curl -sI https://jameststroud.github.io/miami-lizards/`.
4. **Search Console Change of Address**, from the `jameststroud.com` Domain property to `thestroudlab.com`. It requires the 301 on the old home page and both properties verified. It cannot be done for `github.io`; the GitHub redirect handles that one.
5. **Submit `https://www.thestroudlab.com/sitemap.xml`** in the thestroudlab.com property and use URL Inspection → Request indexing on `/`, `/miami-lizards/`, and the four species pages after this branch deploys.
6. **Validate structured data after deploy** with the Rich Results Test on `/james-stroud/` (ProfilePage) and `/miami-lizards/brown-anole/` (Breadcrumb), and use "Validate fix" on the Profile page report in Search Console.
7. **Update outside links you control** (Georgia Tech profile, Google Scholar homepage field, ORCID website link, X bio) to `https://www.thestroudlab.com/`. These are the strongest signals for the identity queries.

---

## 4. Identity pages (Step 4)

| # | Severity | File:line | Finding | Fix |
| --- | --- | --- | --- | --- |
| 4.1 | High | `src/index.njk:13` | Home title "James Stroud \| Evolutionary Ecologist, Georgia Tech" left out "Stroud Lab" and duplicated the profile page's title. | **Fixed**: "Stroud Lab \| James Stroud, Lizard Evolution at Georgia Tech" (59 chars) |
| 4.2 | Medium | `src/index.njk:18` | H1 "Welcome to the Stroud Lab!" had no Georgia Tech. | **Fixed**: "Welcome to the Stroud Lab at Georgia Tech!" The next sentence already names and links James Stroud, so I did not force the name into the H1. |
| 4.3 | Medium | `src/research.njk:7` | Title "Research on Natural Selection in Anole Lizards" did not contain "lizard ecology", though the H1 does. | **Fixed**: "Lizard Ecology and Evolution Research · Stroud Lab". H1 and lead paragraph already fit; unchanged. |
| 4.4 | Medium | `src/james-stroud.njk:22` | ProfilePage `mainEntity` was only `{"@id": ...}`, pointing into a separate script block. Google can merge `@id`s across blocks, but the ProfilePage docs and validator expect `mainEntity` to carry the Person's properties. | **Fixed**: the full Person (name, alternateName, jobTitle, affiliation, worksFor, image, sameAs to ORCID, Scholar, GT profile, Wikidata and others) is now inline. |
| 4.5 | Low | `src/_data/schema.js:31` | Person `jobTitle` was "Principal Investigator" (a lab role). | **Fixed**: `jobTitle: Assistant Professor` added to the PI entry in `people.yaml`, taken from your bio there. Not verified externally (see table at the end). |
| 4.6 | Low | `src/james-stroud.njk` | `dateModified` was set to build time, so it claimed a fresh edit on every deploy. | **Fixed**: removed (optional property) |
| 4.7 | OK | `src/_includes/base.njk:18-32` | og:title, og:description, og:image (1200×630 card per page), og:url and twitter:card on every page, including home and people. | Optional: add `<meta name="twitter:site" content="@jamesTstroud">`. Low. |

---

## 5. Species and place content (Step 5)

### Hub and spoke

```
/anoles/  (NEW hub: general anole biology, FAQ, ID key)
 ├─ /miami-lizards/  (Miami place page: "lizards of Miami")
 │    ├─ /miami-lizards/green-anole/
 │    ├─ /miami-lizards/brown-anole/
 │    ├─ /miami-lizards/knight-anole/
 │    ├─ /miami-lizards/crested-anole/
 │    └─ /miami-lizards/bark-anole/
 ├─ /topics/lizard-evolution/  (publish draft → "anole lizard evolution")
 └─ /research/lizard-island/, /research/cold-snaps/  (supporting stories)
```

Already in place: every species page links to every other one and back to `/miami-lizards/`, lists its papers, and the research stories link into the species pages. **Added on this branch:** an eyebrow link from each species H1 to `/miami-lizards/`, BreadcrumbList markup on each species page, and a "Species guide" link on the 17 paper pages whose titles name a species. **Still needed:** the `/anoles/` hub, a link from each species page to it, and a link from `/miami-lizards/` to it. I would keep the species URLs where they are. They already rank, and moving them under `/anoles/` would cost more than the cleaner path is worth.

### 5.1 SNIPPET rewrites (done on this branch)

| Page | Old title | New title | New description |
| --- | --- | --- | --- |
| `/miami-lizards/` | Lizards of Miami: A Guide to South Florida's Anoles · Stroud Lab (64) | Miami Lizards: A Species Guide to South Florida's Anoles (56) | Which lizards live in Miami? How to identify the green, brown, crested, bark and knight anoles of south Florida, and where each species came from. (146) |
| `/miami-lizards/brown-anole/` | Brown Anole (Anolis sagrei): Miami's Most Common Lizard · Stroud Lab (68) | Brown Anole (Anolis sagrei): The Cuban Anole in Florida (55) | Brown anoles (Anolis sagrei) are not native to Florida: they come from Cuba and the Bahamas. How to identify them, and what our Miami research shows. (149) |
| `/miami-lizards/green-anole/` | Green Anole (Anolis carolinensis): Florida's Native Anole · Stroud Lab (70) | Green Anole (Anolis carolinensis): Diet, ID and Range (53) | The American green anole (Anolis carolinensis) is the only anole native to the US. It eats mostly small insects. How to identify it, and where it lives. (152) |
| `/miami-lizards/knight-anole/` | Cuban Knight Anole (Anolis equestris) in Florida · Stroud Lab (61) | Knight Anole (Anolis equestris): Florida's Largest Anole (56) | The Cuban knight anole (Anolis equestris) is the largest anole in Florida, a big green lizard that eats insects, fruit, other lizards and even snakes. (150) |
| `/` | James Stroud \| Evolutionary Ecologist, Georgia Tech | Stroud Lab \| James Stroud, Lizard Evolution at Georgia Tech (59) | The Stroud Lab at Georgia Tech, led by evolutionary ecologist James Stroud, studies how lizards evolve in the wild, from Miami's anoles to the Caribbean. (153) |

Every fact in these descriptions is already on the page it describes. Bark and crested anole titles and descriptions were shortened the same way.

**Lifespan queries ("how long do anoles live", positions 7 and 10).** Rewriting the snippet will not convert these, because the page never answers the question. The fix is a short section on the green anole page (5.2).

### 5.2 STRENGTHEN and expand existing species pages (proposals; not done)

**Green anole** (`src/miami-lizards/green-anole.njk`)
- Add H2 **"What do green anoles eat?"**. Move the existing diet sentences from the first section under it.
- Add H2 **"How long do green anoles live?"** `TODO(James): lifespan in the wild and in captivity, with source.`
- Add H2 **"How big do adult green anoles get?"**. The size fact already exists in front matter (males up to 7.5 cm SVL); add a sentence and `TODO(James): total length including tail, if you want it.`
- Add H2 **"Why is it called the American chameleon?"**. One or two sentences built from the existing lead.
- Range: the page says "as far north as Tennessee and North Carolina". `TODO(James): western range edge (Texas? Louisiana?) if you want the "green lizard louisiana" query.`

**Brown anole** (`src/miami-lizards/brown-anole.njk`)
- Add H2 **"Are brown anoles native to Florida?"** opening with the fact already in the box (native to Cuba and the Bahamas). `TODO(James): when they were first recorded in Florida, with source.`
- Add H2 **"Where is the brown anole's native range?"** `TODO(James): one or two sentences on the native range.`
- The page has no `arrived:` value, so the fact box omits "In Miami since". `TODO(James): fill arrived: if known.`

**Knight anole** (`src/miami-lizards/knight-anole.njk`)
- Rename the H2 "An anole that eats fruit, lizards and snakes" to **"What do knight anoles eat?"** and keep the current text as the answer. That is a visible-copy change, so I left it for you.
- Add H2 **"How big do knight anoles get?"** using the existing 19 cm SVL figure. `TODO(James): total length including tail.` (The Miami page says "up to a foot and a half long"; the guide gives only SVL.)
- The main photo is a LizardLens screenshot. A real photograph would do better in image search for "big anole" and "large green anole". `TODO(James): photo + alt text.`

**Bark and crested anoles**: no photo. `TODO(James): one photo each.` These pages also carry Article markup without an image.

**Miami lizards** (`src/miami-lizards.njk`)
- Add an H2 **"Green lizards in south Florida"** that tells the green anole, knight anole and Jamaican giant anole apart (the last is mentioned only inside the green anole ID list). `TODO(James): 2 to 4 sentences; is the Jamaican giant anole established enough to list?`
- The H1 "The lizards of Miami" is good. Title and description done.
- Link to the new `/anoles/` hub once it exists.

### 5.3 GAP: new pages (proposals; not done)

**`/anoles/`, the general anole hub.** Targets: anole lizards, anoles, anole lizard, common anole, anoles florida, are anoles reptiles or amphibians, anole tail, florida anole eggs, red throated lizard, florida lizard with ridge on back, types of green lizards in florida, green lizard in florida.

- File: `src/anoles.njk`, `layout: base.njk`, `permalink: /anoles/`
- Title: **"Anole Lizards: A Guide to Anoles in Florida and Beyond"** (54)
- Description: `TODO(James): approve wording once the content exists.`
- H1: **Anole lizards**
- H2 outline:
  - What is an anole? `TODO: genus Anolis, number of species (the site already says "more than 400"), where they live`
  - Are anoles reptiles or amphibians? `TODO: one-sentence answer`
  - Anoles in Florida: links to the five species cards (reuse the `collections.species` loop from `species.njk`)
  - How to tell Florida's green lizards apart: `TODO`, linking to green, knight and crested pages
  - Why do anoles have a red throat? (the dewlap) `TODO`; links to brown and green
  - Lizards with a ridge on the back `TODO`; links to crested (tail crest) and green (display crest)
  - Anole tails: why they drop them `TODO`
  - Anole eggs and babies `TODO`
  - How long do anoles live? `TODO` (or link to the green anole section)
  - How anoles evolve: links to `/research/lizard-island/` and `/topics/lizard-evolution/`
- Structured data: `FAQPage` is no longer shown as a rich result for most sites, so use plain question H2s. Add a BreadcrumbList.
- Nav: add "Anole lizards" under Outreach in `src/_data/nav.json`.

**`/topics/lizard-evolution/`**: already drafted (`draft: true`). Fill the `[JAMES: ...]` placeholders and publish to target "anole lizard evolution". Consider retitling to "Anole Lizard Evolution | Stroud Lab" if most of its examples are anoles.

### 5.4 Images on these pages

| Check | Finding |
| --- | --- |
| Served size | Fine. Every `<img>` is resized to WebP at 480 to 2400 px with width/height set. Above-the-fold images are eager, the rest lazy. |
| Filenames | **Fixed.** Output names were hashes (`/img/No3x0o3LOO-480.webp`); now `/img/sagrei-dewlap-No3x0o-480.webp`. Source names are already descriptive (`carolinensis-grass.jpg`, `sagrei-dewlap.jpg`). |
| Alt text | **Fixed.** Scientific names added to the anole photos on `/miami-lizards/` and the brown, green and knight guides. |
| Originals | `src/assets` is copied wholesale, so 94 MB of originals ship in `_site/assets/img` (largest: `lizard-island-drone.jpg` 15.7 MB) alongside the 28 MB of WebP. Pages do not load them, so no speed cost, but it bloats the deploy. Low. |
| Missing | Bark and crested anole guides have no photo (see 5.2). |

---

## 6. Technical basics (Step 6)

| # | Severity | Where | Finding | Fix |
| --- | --- | --- | --- | --- |
| 6.1 | High | 15 site pages | Titles of 61 to 78 chars and descriptions of 165 to 205 chars, truncated in results | **Fixed**. A re-run of the checker shows every indexable non-paper page with a title of 60 characters or fewer and a description of 155 or fewer. |
| 6.2 | OK | all | No duplicate titles or descriptions; no page missing either | None |
| 6.3 | OK | all | Exactly one H1 per page (`/stats/` has two, but it is noindexed and private) | None |
| 6.4 | OK | `base.njk:2,5` | `<html lang="en">` and viewport set | None |
| 6.5 | OK | all | Page slugs are lowercase and hyphenated | None |
| 6.6 | OK | build | No broken internal links or missing images. The only checker hit is the PDF `Stroud_2019_Anolis Newsletter_Fairchild's anole.pdf`, whose escaped apostrophe resolves correctly in browsers. | Optional: rename PDFs and photos with spaces or apostrophes. Low. |
| 6.7 | Low | `src/paper.njk:12` | 82 of 94 paper titles exceed 60 chars (`truncate(62)` + " · Stroud Lab"). Google truncates by pixel width anyway, and the paper title comes first, so the cost is just a lost suffix. | Optional: `truncate(58)` and drop the suffix |
| 6.8 | Low | `base.njk:38` | Google Fonts stylesheet (3 families, 7 weights) is render-blocking. `@fontsource/archivo` and `/karla` are already dev dependencies (used for the OG cards). | Self-host the woff2 files and preload the body font; drop Cormorant if it is barely used |
| 6.9 | Low | `base.njk:104-116` | Footer uses `<h4>` with no `h2`/`h3` parent on some pages | Use `<p class="footer__h">` or `<h2>` styled small |
| 6.10 | Low | `species.njk:83` | Species Article markup has no `datePublished`/`dateModified`, and bark and crested have no `image` | Add dates from front matter once photos exist |

---

## 7. Prioritized checklist

### (a) In-repo changes, done on `seo-audit`

Ordered by expected impact.

- [x] Miami hub and brown anole titles and descriptions (SNIPPET, page one) · `420f2fa`
- [x] Green and knight anole titles and descriptions; bark and crested shortened · `420f2fa`
- [x] Home title leads with "Stroud Lab"; Research title targets "lizard ecology" · `9eaf23a`
- [x] Remaining over-length titles and descriptions · `6e8d680`
- [x] Home H1 names Georgia Tech · `562f03b`
- [x] ProfilePage carries the full Person; jobTitle from the bio; no build-time dateModified · `7126dc4`
- [x] Species pages: eyebrow link to the hub, plus BreadcrumbList · `4e89ec2`
- [x] Paper pages link to their species guide (17 pages; targets the "anolis equestris" split) · `729fdc2`
- [x] Scientific names in anole alt text · `8816307`
- [x] Descriptive image filenames · `da0486d`
- [x] 404 page (noindex) · `e489d11`
- [x] Placeholder Lizards on the Loose page noindexed · `2390394`
- [x] README domain typo · `84248b3`
- [ ] Not done, low: self-host fonts (6.8), footer heading level (6.9), paper title length (6.7), `twitter:site` (4.7)

### (b) Outside the repo

1. Merge `seo-audit` to `main` (deploys automatically).
2. Set up path-preserving 301s from `jameststroud.com` and `www.jameststroud.com` to `https://www.thestroudlab.com/` (3, item 2).
3. Search Console: Change of Address from jameststroud.com; submit the sitemap; request indexing for `/`, `/miami-lizards/` and the species pages.
4. Confirm the apex and github.io redirects with `curl -sI`.
5. Rich Results Test on `/james-stroud/`, then Validate fix on the Profile page report.
6. Point the Georgia Tech profile, Google Scholar, ORCID and X links at `https://www.thestroudlab.com/`.
7. Add `Queries.csv` and `Pages.csv` to the repo (or send them) so the inferred target pages in section 2 can be checked.

### (c) Content you need to write

1. **Green anole lifespan section**: answers two queries already at positions 7 and 10 (5.2).
2. **Brown anole "native to Florida?" and "native range" H2s**: one fact plus a TODO each (5.2).
3. **"Green lizards in south Florida" H2 on `/miami-lizards/`** (5.2).
4. **Knight anole "What do knight anoles eat?" rename and a size section**, plus a real photo (5.2).
5. **`/anoles/` hub page** with the outline in 5.3: covers all of cluster 5 and the generic green lizard queries.
6. **Publish `/topics/lizard-evolution/`** for "anole lizard evolution".
7. **Photos for the bark and crested anole guides.**
8. **Finish `/lizards-on-the-loose/`**, then remove its `noindex` and `sitemapExclude` lines.

---

## Fact check for text I added

Every visible or metadata fact I wrote was taken from text already in the repository. I could not open primary sources from this container (the network proxy blocks orcid.org, gatech.edu and the live site), so the external check is still outstanding.

| Fact | Where I used it | Source in repo | Externally verified? |
| --- | --- | --- | --- |
| Brown anole native to Cuba and the Bahamas | brown anole description | `brown-anole.njk` `nativeTo` | No |
| Green anole only anole native to the US; eats mostly small insects | green anole description | existing description; page body | No |
| "American green anole" as a name | green anole description | paper title "First specimen of an American green anole" in `publications.yaml` | No |
| Knight anole largest anole in Florida; eats insects, fruit, lizards, snakes | knight anole description | `knight-anole.njk` body and size | No |
| Bark anole from Hispaniola, smallest in Miami | bark anole description | `bark-anole.njk` | No |
| Crested anole in Miami since the mid-1970s | crested anole description | `crested-anole.njk` `arrived` | No |
| Miami fell to 4.4°C in January 2020 | cold snaps description | `cold-snaps.njk` lead (22 January 2020) | No |
| Lizard Island since 2015, twice a year | Lizard Island description | `lizard-island.njk` lead | No |
| Limb loss in 58 species | three-legged description | `three-legged-lizards.njk` | No |
| James Stroud: **Assistant Professor**, Georgia Tech | Person `jobTitle` (structured data only) | `people.yaml` bio: "Assistant Professor in the School of Biological Sciences" | **No. Please confirm the title is current.** |
