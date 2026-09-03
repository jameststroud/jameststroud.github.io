// ---------------------------------------------------------------------------
// Lists the images in src/assets/img/labpics/ for the sliding photo album on
// the Join the Lab page. Drop image files into that folder and rebuild the
// site - nothing else needs to change, they'll show up in the rotation.
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "assets", "img", "labpics");
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

module.exports = function () {
  if (!fs.existsSync(DIR)) return [];

  return fs
    .readdirSync(DIR)
    .filter((f) => !f.startsWith(".") && EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => `/assets/img/labpics/${f}`);
};
