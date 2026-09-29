// Builds the 1200x630 preview images that link previews (Bluesky, Slack,
// email, iMessage...) show when someone shares a page. One card per page:
// the page's hero photo, darkened at the bottom, with the page title and the
// lab name set in the site's own fonts. Called from .eleventy.js after build.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

// Pango cannot read .woff, so unpack the site's web fonts (WOFF 1.0 is just
// zlib-compressed TrueType tables) into plain .ttf files once per build.
function woffToTtf(woffPath) {
  const zlib = require("zlib");
  const out = path.join(require("os").tmpdir(), "og-" + path.basename(woffPath, ".woff") + ".ttf");
  if (fs.existsSync(out)) return out;
  const w = fs.readFileSync(woffPath);
  const n = w.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    const [tag, off, clen, olen, sum] = [w.readUInt32BE(o), w.readUInt32BE(o + 4), w.readUInt32BE(o + 8), w.readUInt32BE(o + 12), w.readUInt32BE(o + 16)];
    const raw = w.subarray(off, off + clen);
    tables.push({ tag, sum, data: clen < olen ? zlib.inflateSync(raw) : raw });
  }
  const pow = 2 ** Math.floor(Math.log2(n));
  const head = Buffer.alloc(12 + n * 16);
  head.writeUInt32BE(w.readUInt32BE(4), 0);
  head.writeUInt16BE(n, 4);
  head.writeUInt16BE(pow * 16, 6);
  head.writeUInt16BE(Math.log2(pow), 8);
  head.writeUInt16BE(n * 16 - pow * 16, 10);
  let offset = head.length;
  const parts = [head];
  tables.forEach((t, i) => {
    const o = 12 + i * 16;
    head.writeUInt32BE(t.tag, o);
    head.writeUInt32BE(t.sum, o + 4);
    head.writeUInt32BE(offset, o + 8);
    head.writeUInt32BE(t.data.length, o + 12);
    const padded = Buffer.alloc((t.data.length + 3) & ~3);
    t.data.copy(padded);
    parts.push(padded);
    offset += padded.length;
  });
  fs.writeFileSync(out, Buffer.concat(parts));
  return out;
}

const W = 1200;
const H = 630;
const ROOT = path.join(__dirname, "..");
const FONTS = path.join(ROOT, "node_modules", "@fontsource");
const ARCHIVO = () => woffToTtf(path.join(FONTS, "archivo", "files", "archivo-latin-700-normal.woff"));
const KARLA = () => woffToTtf(path.join(FONTS, "karla", "files", "karla-latin-700-normal.woff"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function text(markup, font, fontfile, width) {
  return sharp({ text: { text: markup, font, fontfile, width, rgba: true, wrap: "word" } }).png().toBuffer();
}

async function card({ title, image, eyebrow }, outFile) {
  const src = path.join(ROOT, "src", image.replace(/^\//, ""));
  const photo = await sharp(src).rotate().resize(W, H, { fit: "cover", position: "attention" }).toBuffer();

  // Bottom-weighted shade so white type reads on any photograph.
  const shade = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.25" stop-color="#0b1a24" stop-opacity="0"/>
        <stop offset="1" stop-color="#0b1a24" stop-opacity="0.88"/>
      </linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect x="0" y="${H - 10}" width="${W}" height="10" fill="#cf6a1a"/>
    </svg>`
  );

  // Long titles (paper pages) step down in size and are cut at about 140 characters.
  const t = title.length > 140 ? title.slice(0, 139).replace(/\s+\S*$/, "") + "…" : title;
  const size = t.length > 90 ? 42 : t.length > 55 ? 50 : 60;
  const titleImg = await text(`<span foreground="#ffffff">${esc(t)}</span>`, `Archivo Bold ${size}`, ARCHIVO(), W - 160);
  const tMeta = await sharp(titleImg).metadata();
  const labImg = await text(
    `<span foreground="#ffffff" letter_spacing="2048">${esc(eyebrow.toUpperCase())}</span>`,
    "Karla Bold 24", KARLA(), W - 160
  );
  const lMeta = await sharp(labImg).metadata();

  const bottom = H - 70;
  const titleTop = bottom - tMeta.height;
  const labTop = titleTop - lMeta.height - 18;

  await sharp(photo)
    .composite([
      { input: shade, top: 0, left: 0 },
      { input: labImg, top: labTop, left: 80 },
      { input: titleImg, top: titleTop, left: 80 },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(outFile);
}

// jobs: [{ title, image, eyebrow, file }] where file is the output path relative to _site.
async function buildCards(jobs, outDir) {
  const seen = new Set();
  for (const job of jobs) {
    if (seen.has(job.file)) continue;
    seen.add(job.file);
    const out = path.join(outDir, job.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await card(job, out);
  }
  return seen.size;
}

// A stable file name per page, so a card is only rebuilt when its inputs change.
function cardFile(url, title, image) {
  const slug = url.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";
  const hash = crypto.createHash("sha1").update(`${title}|${image}`).digest("hex").slice(0, 8);
  return `assets/og/${slug}-${hash}.jpg`;
}

module.exports = { buildCards, cardFile, W, H };
