const express = require("express");
const Movie = require("../models/movies");
const { getWebAppUrl } = require("../bot/webAppUrl");
const { resolveMovieNumericId } = require("../services/movieService");

const router = express.Router();

const escapeXml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toLastmod = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const buildUrlXml = ({ loc, changefreq, priority, lastmod }) => {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${escapeXml(changefreq)}</changefreq>`);
  if (priority) parts.push(`    <priority>${escapeXml(priority)}</priority>`);
  return `  <url>\n${parts.join("\n")}\n  </url>`;
};

/**
 * Dinamik sitemap: asosiy sahifalar + DB dagi barcha faol kinolar.
 * WEB_APP_URL (masalan https://www.chosontv.uz) dan domen olinadi.
 */
router.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const base = getWebAppUrl();
    const rows = await Movie.find({})
      .select("movieId id updatedAt isActive")
      .lean();

    const staticEntries = [
      { loc: `${base}/`, changefreq: "daily", priority: "1.0" },
      { loc: `${base}/recommended`, changefreq: "daily", priority: "0.9" },
      { loc: `${base}/news`, changefreq: "daily", priority: "0.8" },
    ];

    const seen = new Set(staticEntries.map((e) => e.loc));
    const movieEntries = [];

    for (const row of rows) {
      if (row?.isActive === false) continue;
      const id = resolveMovieNumericId(row);
      if (!id) continue;
      const loc = `${base}/movie/${id}`;
      if (seen.has(loc)) continue;
      seen.add(loc);
      movieEntries.push({
        loc,
        changefreq: "weekly",
        priority: "0.9",
        lastmod: toLastmod(row.updatedAt),
      });
    }

    movieEntries.sort((a, b) => {
      const left = Number(String(a.loc).split("/").pop()) || 0;
      const right = Number(String(b.loc).split("/").pop()) || 0;
      return left - right;
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...staticEntries.map(buildUrlXml),
      ...movieEntries.map(buildUrlXml),
      "</urlset>",
      "",
    ].join("\n");

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300");
    return res.status(200).send(xml);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
