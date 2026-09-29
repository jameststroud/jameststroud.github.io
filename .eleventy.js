const yaml = require("js-yaml");
const { buildCards, cardFile } = require("./scripts/og-cards.js");
const { eleventyImageTransformPlugin } = require("@11ty/eleventy-img");

module.exports = function (eleventyConfig) {
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

  // Link-preview cards. Templates call `ogCard`, which returns the image URL
  // and queues the card; all queued cards are drawn once the build finishes.
  let ogJobs = [];
  eleventyConfig.on("eleventy.before", () => { ogJobs = []; });
  eleventyConfig.addFilter("ogCard", function (title, image, url) {
    const file = cardFile(url || "/", title, image);
    ogJobs.push({ title, image, eyebrow: "The Stroud Lab \u00b7 Georgia Tech", file });
    return "/" + file;
  });
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    await buildCards(ogJobs, dir.output);
  });

  // Papers whose plain title starts with any of the given phrases, in the
  // order the phrases are listed. Used by species and story pages.
  eleventyConfig.addFilter("papersMatching", function (papers, starts) {
    const norm = (s) => String(s || "").replace(/<[^>]*>/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    return (starts || []).map((st) => (papers || []).find((p) => norm(p.title).startsWith(norm(st)))).filter(Boolean);
  });

  eleventyConfig.addFilter("setKey", function (obj, key, value) {
    return Object.assign({}, obj, { [key]: value });
  });

  // Plain-text version of a string for meta tags and structured data.
  eleventyConfig.addFilter("plain", function (s) {
    return String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  });

  // "Stroud, J.T., Losos, J.B." -> ["J.T. Stroud", "J.B. Losos"] for schema.org.
  eleventyConfig.addFilter("authorList", function (authors) {
    const out = [];
    const re = /([^,]+?),\s*((?:[A-Z\u00C0-\u017F][a-z]?\.\s*-?\s*|d\.\s*|de\s+)+)(?:,|$)/g;
    let m;
    const s = String(authors || "").replace(/<[^>]*>/g, "").replace(/\s*\(Eds?\.\)\s*$/, "");
    while ((m = re.exec(s))) {
      const family = m[1].replace(/^\s*(and|&)\s+/, "").trim();
      if (/\d+\s+others/.test(family)) continue;
      out.push((m[2].trim() + " " + family).replace(/\s+/g, " "));
    }
    return out.length ? out : [s];
  });

  // Authors as "Family, I.I." for Google Scholar's citation_author tags.
  eleventyConfig.addFilter("scholarAuthors", function (authors) {
    return eleventyConfig.getFilter("authorList")(authors).map((n) => {
      const m = /^(.*?\.)\s+(.+)$/.exec(n);
      return m ? `${m[2]}, ${m[1]}` : n;
    });
  });

  // Meta description for a paper page: its abstract, or title, venue and authors.
  eleventyConfig.addFilter("paperDescription", function (p) {
    const plain = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    const cut = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");
    if (p.abstract) return cut(plain(p.abstract), 158);
    const names = eleventyConfig.getFilter("authorList")(p.authors);
    const who = names.length > 2 ? `${names[0]} et al.` : names.join(" and ");
    const venue = p.journal ? `${plain(p.journal)}, ${p.year}` : String(p.year);
    const full = `${plain(p.title)}. ${who} (${venue}). A Stroud Lab publication.`;
    return full.length <= 158 ? full : cut(`${plain(p.title)}. ${who} (${venue}).`, 158);
  });

  // A reference in the site's house style, e.g. for "Cite this paper".
  eleventyConfig.addFilter("citation", function (p) {
    const doi = p.doi ? ` <a href="${p.doi}">${p.doi}</a>` : "";
    const venue = [p.journal ? `<em>${p.journal}</em>` : "", p.detail || ""].filter(Boolean).join(", ");
    return `${p.authors} (${p.year}) ${p.title}. ${venue}.${doi}`;
  });

  // BibTeX entry for a paper.
  eleventyConfig.addFilter("bibtex", function (p) {
    const plain = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    const tex = (s) => plain(s).replace(/([&%$#_])/g, "\\$1");
    const people = eleventyConfig.getFilter("scholarAuthors")(p.authors);
    const others = /\d+\s+others/.test(p.authors) ? " and others" : "";
    const first = (people[0] || "anon").split(",")[0].normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase();
    const word = (plain(p.title).toLowerCase().match(/[a-z]{4,}/) || ["paper"])[0];
    const kind = p.type === "volume" ? "book" : p.type === "inreview" ? "misc" : "article";
    const f = [["author", people.join(" and ") + others], ["title", "{" + tex(p.title) + "}"]];
    if (p.journal) f.push([kind === "book" ? "publisher" : kind === "misc" ? "howpublished" : "journal", tex(p.journal)]);
    f.push(["year", String(p.year)]);
    if (p.volume) f.push(["volume", p.volume]);
    if (p.issue) f.push(["number", p.issue]);
    if (p.firstpage) f.push(["pages", p.lastpage ? `${p.firstpage}--${p.lastpage}` : p.firstpage]);
    if (p.doiBare) f.push(["doi", p.doiBare]);
    return `@${kind}{${first}${p.year}${word},\n` + f.map(([k, v]) => `  ${k} = {${v}}`).join(",\n") + "\n}";
  });

  // Abstract text to HTML: escape everything, keep <em> for species names,
  // blank lines become paragraphs.
  eleventyConfig.addFilter("abstractHtml", function (s) {
    const esc = String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/&lt;(\/?)em&gt;/g, "<$1em>");
    return esc.split(/\n\s*\n/).map((para) => `<p>${para.trim()}</p>`).join("\n");
  });

  // Serialise structured data for a <script type="application/ld+json"> block.
  eleventyConfig.addFilter("jsonld", function (obj) {
    return JSON.stringify(obj, null, 1).replace(/</g, "\\u003c");
  });

  // Published papers as schema.org ScholarlyArticles (in-review work is left out).
  eleventyConfig.addFilter("articlesLd", function (pubs, site, schema) {
    const authorList = eleventyConfig.getFilter("authorList");
    const plain = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    const items = (pubs || []).filter((p) => p.type !== "inreview" && p.title).map((p, i) => {
      const doi = p.doi ? String(p.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "") : null;
      const authors = authorList(p.authors).map((name) =>
        /(^|\s)Stroud$/.test(name) && /^J\.\s*T\./.test(name) ? { "@id": schema.piId } : { "@type": "Person", name });
      return {
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": p.type === "volume" ? "Book" : "ScholarlyArticle",
          headline: plain(p.title).slice(0, 110),
          name: plain(p.title),
          author: authors,
          datePublished: String(p.year),
          isPartOf: p.journal ? { "@type": "Periodical", name: plain(p.journal) } : undefined,
          url: p.doi || undefined,
          identifier: doi ? { "@type": "PropertyValue", propertyID: "DOI", value: doi } : undefined,
        },
      };
    });
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Publications from " + site.title,
      numberOfItems: items.length,
      itemListElement: items,
    };
  });

  // Every <img> on the site is resized and re-encoded at build time: WebP at
  // up to four widths (never enlarged), with width/height set so the page does
  // not jump, and lazy loading unless a template says otherwise. The original
  // files in src/assets/img are untouched. Add `eleventy:ignore` to an <img>
  // to leave it alone.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp"],
    fixOrientation: true,   // honour the rotation phones store in photo metadata
    widths: [480, 960, 1600, 2400],
    urlPath: "/img/",
    outputDir: "./_site/img/",
    failOnError: false,
    htmlOptions: {
      imgAttributes: {
        loading: "lazy",
        decoding: "async",
        sizes: "(min-width: 76rem) 76rem, 100vw",
      },
    },
    sharpWebpOptions: { quality: 78 },
  });

  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ "src/files": "files" });

  eleventyConfig.addFilter("highlightAuthors", function (authors, names) {
    let out = authors;
    (names || []).forEach((n) => {
      out = out.split(n).join(`<strong>${n}</strong>`);
    });
    return out;
  });

  eleventyConfig.addFilter("groupByYear", function (items) {
    const groups = {};
    (items || []).forEach((i) => {
      const y = String(i.year);
      (groups[y] = groups[y] || []).push(i);
    });
    return Object.keys(groups)
      .sort((a, b) => Number(b) - Number(a))
      .map((y) => ({ year: y, items: groups[y] }));
  });

  eleventyConfig.addFilter("where", function (arr, key, value) {
    return (arr || []).filter((i) => i[key] === value);
  });

  eleventyConfig.addFilter("limit", function (arr, n) {
    return (arr || []).slice(0, n);
  });

  eleventyConfig.addFilter("prettyDate", function (d) {
    if (!d) return "";
    const date = new Date(d + "T12:00:00Z");
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  });

  eleventyConfig.addFilter("year", function (d) {
    return d ? String(d).slice(0, 4) : "";
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
