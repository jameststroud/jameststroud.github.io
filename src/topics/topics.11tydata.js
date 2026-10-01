// Research topic pages. A page with `draft: true` is not built, not listed in
// the sitemap and not linked from anywhere, so nothing goes live until you
// delete that line. To preview drafts locally: SHOW_DRAFTS=1 npm start
const showDrafts = !!process.env.SHOW_DRAFTS;

module.exports = {
  layout: "topic.njk",
  tags: "topics",
  eleventyComputed: {
    permalink: (d) => (d.draft && !showDrafts ? false : `/topics/${d.page.fileSlug}/`),
  },
};
