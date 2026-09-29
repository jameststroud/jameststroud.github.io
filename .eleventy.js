const yaml = require("js-yaml");
const { buildCards, cardFile } = require("./scripts/og-cards.js");

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
