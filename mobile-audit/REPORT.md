# Mobile audit: theStroudLab.com

Branch `mobile-polish`, based on `main` at `6135dbb`. Nothing merged or deployed.

## Summary

The site was already in good shape on phones: correct viewport tag, a working Menu button, build-time responsive WebP images with `width`/`height` and lazy loading, and zero layout shift (CLS 0 on every page tested). The audit found four real breakages and a set of polish items:

- **Horizontal scroll on 3 pages at 320px** (news, James Stroud profile, stats). News was also badly squeezed up to 430px, with headlines wrapping one word per line beside the photo.
- **Tap targets well under 44px** on the Menu button (27px tall), menu carets (26×31), footer links (18px), profile links (16px), and PDF/DOI links on every publication (26×16).
- **iOS zoom on focus**: publication search was 15.2px and the stats inputs 14px.
- **Low colour contrast** in the core palette, including white nav text on light blue at 1.64:1. This affects desktop equally, so I did not change it. It needs your call (see "Needs your input").

All four breakages and the polish items are fixed. The desktop layout at 1280 and 1440 is pixel-identical before and after on all 15 page types.

## Phase 1: stack

| | |
|---|---|
| Generator | Eleventy 3 (Nunjucks templates, YAML data in `src/_data/`) |
| Build / preview | `npm run build` (output `_site/`), `npm start` (dev server) |
| Deploy | GitHub Actions builds `main` and publishes `_site/` to GitHub Pages |
| Layout | `src/_includes/base.njk` (head, masthead, nav, footer, all page JS) plus `story.njk`, `species.njk`, `topic.njk` |
| CSS | `src/assets/css/style.css` (one file, design tokens in `:root`), `src/assets/stats/dashboard.css` (private /stats/ page) |
| Images | `@11ty/eleventy-img` rewrites every `<img>` to WebP at 480/960/1600/2400w with `srcset`, dimensions and `loading="lazy"` |

## Method

- Built the site and served `_site/` locally. Headless Chromium (Playwright) captured full-page screenshots of 15 page types at 320, 360, 390, 430, 768 and 1024 (touch emulation below 1024), plus 1280 and 1440 for the desktop check.
- The capture script also measured page `scrollWidth`, interactive elements under 44px, text under 12px, and input font sizes. The raw numbers are in `before/metrics.json` and `after/metrics.json`.
- Lighthouse 12, mobile profile, on six representative pages.
- A scripted keyboard and touch test of the mobile menu.
- Page types: home, research, research story (`/research/cold-snaps/`), publications, paper page, software, people, news, outreach, join, Florida anoles, species page (`/miami-lizards/green-anole/`), James Stroud, Lizards on the Loose, stats.

## Findings

Line numbers refer to the files at `6135dbb` (before the fixes). "Fixed" items name the commit.

### High

| # | Finding | Where | Status |
|---|---|---|---|
| H1 | **News overflows at 320/360px** (page 387px wide) and is squeezed up to 430px. `.news-item:has(.news-item__img)` sets a 14rem image column and outranks the mobile rule `.news-item { grid-template-columns: 1fr }`, so phones keep two columns. | `style.css:680-682` vs `:846` | Fixed (`49b3002`) |
| H2 | **James Stroud page overflows at 320px.** `.person__links a` are `nowrap` with `margin-right: .9rem`; the trailing margin of a line-end link pushes past the column. | `style.css:598-599` | Fixed (`49b3002`) |
| H3 | **Stats lock card overflows at 320px**, and the site-code row ran past the card's edge. The grid column sized to content. | `dashboard.css:89-98` | Fixed (`49b3002`, `95df3c1`) |
| H4 | **Menu controls too small to tap.** Menu button 76×27, caret toggles 26×31, sub-menu links about 33px tall. | `style.css:171-183, 864-911` | Fixed (`49b3002`): all 44px |
| H5 | **Inputs under 16px trigger iOS zoom on focus.** Publication search 15.2px; stats inputs 14px. | `style.css:614`, `dashboard.css:85, 119` | Fixed (`49b3002`) |
| H6 | **Colour contrast fails WCAG AA** on core tokens (measured): white nav text on `--navy-lt` **1.64:1**; `--ink-faint` text (dates, eyebrows, roles, captions) 3.49:1 on the page background and 3.06:1 on bands; `--navy` links and body links 3.56:1; white body text in the navy home intro 3.32:1; gold year headings and card kickers 2.55 to 2.6:1. AA needs 4.5:1 for body text (3:1 for large text). | `style.css:8, 12-13, 16, 105-107, 177` | **Not changed**: these tokens drive desktop too. Needs your input. |

### Medium

| # | Finding | Where | Status |
|---|---|---|---|
| M1 | Footer links 18px tall, profile links 16px, PDF/DOI/Link 26×16 on every publication, "Cite this paper" 28px. | `base.njk:96-125`, `style.css:598, 647-648, 973` | Fixed (`49b3002`) |
| M2 | Mobile menu stayed open after "Back" (restored from the back/forward cache), and did not close when keyboard focus tabbed out of it or a link was tapped. | `base.njk:305-319` | Fixed (`3194abf`) |
| M3 | No `prefers-reduced-motion` support: smooth scrolling, image zoom/fade transitions, and a carousel that auto-advances every 4s. | `style.css:32`, `base.njk:243-245` | Fixed (`3194abf`) |
| M4 | Photo heroes (Florida anoles, Lizards on the Loose) shown as a 4.8:1 strip, 75px tall at 360px. | `style.css:283, 851` | Fixed (`c96c1bf`): 16:5 on phones |
| M5 | **Home banner text unreadable on phones.** "Integrative ecology, evolution, physiology and behavior" and the GT logo are baked into the image; at 390px the lettering is about 9px tall. Cropping would cut the words. | `index.njk:4` (`stroudlab_banner_final2.jpg`) | **Needs a mobile image export** (see below) |
| M6 | Bare `<figure>` elements keep the browser's 40px side indents, so story photos were 224px wide in a 304px column. | `story.njk:18`, `join.njk:21`, `outreach.njk:48, 54` | Fixed (`c96c1bf`) |
| M7 | Headshots inconsistent: the PI photo is 13rem, every other photo fills the screen (334px circles at 390px). | `style.css:581-588, 845` | Fixed (`c96c1bf`) |
| M8 | Render-blocking Google Fonts stylesheet: Lighthouse estimates about 0.9s of blocking on mobile, the largest single cost in LCP. | `base.njk:32-34` | Not changed (affects desktop too). Recommendation below. |
| M9 | LCP image lazy-loaded on /people/ (PI photo) and /news/ (first photo). | `people.njk:39`, `news.njk:23` | Fixed (`c96c1bf`, `eb5c19a`) |
| M10 | Touch tablets (768 to 1024) got the desktop menu with about 30px-tall links. | `style.css:170-182` | Fixed (`c96c1bf`): 46px tap height, bar looks the same |

### Low

| # | Finding | Where | Status |
|---|---|---|---|
| L1 | Strapline leaves a dangling bullet at the end of each line on phones. | `style.css:300-314, 854` | Fixed (`c96c1bf`) |
| L2 | h1 fixed at 33.6px on all phones; long titles run 3 to 4 lines at 320px. Headings can end on a single word. | `style.css:59` | Fixed (`c96c1bf`): fluid h1 below 46rem, balanced heading wraps below 64rem |
| L3 | Card padding (1.9rem/1.75rem) leaves about a 245px text column inside cards at 360px. | `style.css:716, 755` | Fixed (`c96c1bf`) |
| L4 | Carousel arrows 38px, lightbox close 42px. | `style.css:391-392, 947-948` | Fixed (`c96c1bf`) |
| L5 | Masthead padding totals 48px around the logo on phones. | `style.css:135` | Fixed (`c96c1bf`): trimmed to about 34px |
| L6 | Heading order skips levels (footer uses `h4` after `h2`; Lighthouse flags it on 4 of 6 pages). | `base.njk:100, 107, 112` | Not changed: switching tags risks desktop styling. Suggest `h2` with the same class. |
| L7 | Publication tags ("In review", "Press") render at 10.6px; eyebrows at 11.5px. | `style.css:83, 657` | Not changed: the type scale is a design choice. Flagging only. |
| L8 | Search box focus ring is gold (`--gold`, 2.6:1 against white); WCAG 2.2 wants 3:1 for focus indicators. | `style.css:622` | Not changed (desktop too). |
| L9 | `.lightbox { display: flex }` overrides the `hidden` attribute, so the closed lightbox stays in the layout (invisible). No visible effect. | `style.css:923-935` | Not changed |
| L10 | Original photos are very large in the repo (`lizard-island-drone.jpg` 15.7MB, `caro-ctt-tag.jpg` 9.1MB). Visitors only get the resized WebP, so this costs build time and repo size, not page speed. | `src/assets/img/photos/` | Not changed |

### Checked and fine

Viewport meta tag (`base.njk:5`); responsive images with `srcset`/`sizes`, dimensions, and lazy loading below the fold; no layout shift (CLS 0); no hover-only content (the dropdowns have caret buttons, photo captions show permanently on touch, carousel arrows show on touch); the long BibTeX block scrolls inside its own box; no iframes, videos or tables in page content; the sticky header question is moot because the header is not sticky.

## Fixes made

Five commits, all on `mobile-polish`:

1. `49b3002` Fix phone overflow and enlarge tap targets (H1 to H5, M1)
2. `3194abf` Close the phone menu after use and respect reduced motion (M2, M3)
3. `c96c1bf` Polish phone layout: headings, heroes, figures, headshots, cards (M4, M6, M7, M9, M10, L1 to L5)
4. `eb5c19a` Load the first news photo eagerly (M9)
5. `95df3c1` Keep the stats lock form inside its card on phones (H3)

Total change: 113 lines added, 11 removed, across 6 files. No new dependencies.

How desktop stays the same: every layout rule is inside `@media (max-width: 46rem)` (the site's existing phone breakpoint). Two narrow exceptions: heading line balancing applies up to 64rem (tablets), and the taller nav tap areas apply only to touch tablets via `(pointer: coarse)`. The JavaScript changes only affect the phone menu (which desktop never shows) and visitors who request reduced motion. The two template attribute changes (`loading="eager"` on two images) do not alter rendering.

## Design decisions (subjective; easy to change)

- **Menu style.** Kept the existing push-down disclosure menu rather than switching to an overlay drawer. It matches the site's look and needs no focus trap: a focus trap is for modal overlays, and trapping focus in an in-page disclosure would be an accessibility bug. Instead the menu closes on Escape (focus returns to Menu), when focus tabs out, and when a link is tapped.
- **Tap areas without visual bulk.** Footer, profile and PDF/DOI links got 44px-tall hit boxes. Because the site draws link underlines with `border-bottom`, padding would have pushed the line away from the text, so on phones those links draw the same underline with `text-decoration` instead. The PDF/DOI row uses negative margins so the visible spacing between publications is unchanged.
- **Headshots** capped at 13rem (208px), the size the PI photo already used, rather than a two-column grid. Two columns would have left about 150px per bio.
- **Hero shape.** Photo heroes use 16:5 on phones, the native shape of both current hero photos, so nothing important is cropped. The home banner is excluded through a new `heroClass: hero__img--banner` in `index.njk` front matter (no visible change).
- **Card padding** 1.4rem/1.25rem on phones.

## Verification

**No horizontal scroll at 320px on any page**, and none at any tested width:

| | 320 | 360 | 390 | 430 | 768 | 1024 |
|---|---|---|---|---|---|---|
| Before | news (387px), james-stroud (325px), stats (324px) | news (387px) | none | none | none | none |
| After | none | none | none | none | none | none |

**Desktop unchanged.** 15 pages × 1280 and 1440 = 30 captures, compared pixel by pixel against the baseline. All 30 are identical. Two baseline runs of the untouched site differed from each other by about 1,700 to 3,800 pixels of text anti-aliasing on 2 pages; each final capture matches at least one baseline run exactly. I reran the 1440 profile page three times to confirm. At 768 and 1024 the only differences are heading line breaks (balancing) and the active-section underline in the tablet nav sitting a few pixels lower.

**Lighthouse, mobile profile** (before → after; one value means unchanged):

| Page | Perf | A11y | Best pr. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| home | 88 → 87 | 94 | 96 | 100 | 3.0 s | 0 | 0 ms |
| research | 87 → 88 | 94 | 96 | 100 | 3.1 s | 0 | 0 ms |
| publications | 79 → 78 | 94 | 96 | 100 | 3.8 s → 3.9 s | 0 | 0 ms |
| people | 91 | 92 → 96 | 96 | 100 | 2.9 s | 0 | 0 ms |
| news | 88 → 87 | 94 | 96 | 100 | 3.3 s → 3.4 s | 0 | 0 ms |
| species | 89 → 88 | 96 | 96 | 100 | 3.1 s | 0 | 0 ms |

How to read these: performance moves of ±1 point and ±0.1s are run-to-run noise. The tested server was Python's `http.server`, which sends no compression or cache headers, so the "text compression" and "cache" audits (and some of the LCP) overstate what GitHub Pages visitors see. Best Practices is 96 everywhere because the sandbox blocked the GoatCounter script, which logs a console error. The remaining accessibility deductions are colour contrast (H6) and heading order (L6), both left for your decision. People rose to 96 because `target-size` now passes. The news `lcp-lazy-loaded` audit now passes as well (it failed before the change too).

**Menu test** (390px, touch and keyboard): opens on tap; Escape closes it and returns focus to Menu; Enter reopens; tabbing past the last item closes it; tapping a sub-menu link navigates with the menu closed; after Back the menu is closed. All pass.

## Needs your input

1. **Contrast (H6).** The fix is a token change that also alters desktop colour. A minimal set that keeps the palette's character: nav text in `--navy-soft` (#17547f) on the light blue (4.9:1), or keep white text on a darker bar such as #2f6f8a (5.6:1); `--ink-faint` to about #6f6c63 (5.2:1 on the page, 4.5:1 on the beige bands); body links in `--navy-soft`, keeping `--navy` for large headings. I can implement any of these on request.
2. **Home banner (M5).** A phone-specific export would make the banner's words readable, for example 1200×500 with the lettering at least twice its current relative size, or a photo-only crop with the words set as HTML text. Send the file and I will wire it in with `<picture>` so desktop keeps the current banner.
3. **Fonts (M8).** Self-hosting the three font families would remove about 0.9s of render-blocking. `@fontsource/archivo` and `@fontsource/karla` are already in `package.json`; Cormorant Garamond would need adding. Self-hosted files can render very slightly differently from Google's, so I held off pending your OK.
4. **Skip link.** There is no "Skip to content" link. It is invisible until a keyboard user presses Tab, but it adds a link label, so I did not add it without asking.
5. **Footer headings (L6)** and the **search focus colour (L8)**: small desktop-visible changes, also waiting on your OK.

Nothing in the page copy was changed, added or removed.

## Files in this folder

- `before/`, `after/`: full-page screenshots, `<page>-<width>.jpg`, 15 pages × 6 widths, plus `metrics.json` from the capture script. The before set was captured from a clean build of `6135dbb`. Saved as JPEG (quality 70) to keep the repo light; desktop captures were compared but not committed.
- `compare/`: before (left) and after (right) side by side, every page at 360px, plus news, james-stroud and stats at 320px.

This folder is outside `src/`, so it is never published. Delete it before merging if you don't want the roughly 62MB of screenshots in the repo history.
