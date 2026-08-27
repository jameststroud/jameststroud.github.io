const yaml = require("js-yaml");

module.exports = function (eleventyConfig) {
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

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
