/**
 * Vercel Serverless: GET /api/sitemap → barcha kinolar bilan XML.
 * vercel.json orqali /sitemap.xml shu yerga yo'naltiriladi.
 *
 * Env (Vercel):
 *   REACT_APP_BASE_URL = Render API (masalan https://xxx.onrender.com)
 *   SITE_URL (ixtiyoriy) = https://www.chosontv.uz
 */

const SITE_DEFAULT = "https://www.chosontv.uz";

const escapeXml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildUrlXml = ({ loc, changefreq, priority, lastmod }) => {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${escapeXml(changefreq)}</changefreq>`);
  if (priority) parts.push(`    <priority>${escapeXml(priority)}</priority>`);
  return `  <url>\n${parts.join("\n")}\n  </url>`;
};

const toLastmod = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const resolveMovieId = (movie = {}) => {
  const n = Number(movie.movieId ?? movie.id);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function fetchAllMovieEntries(apiBase) {
  const entries = [];
  const seen = new Set();
  let page = 1;
  let hasNext = true;
  const maxPages = 100;

  while (hasNext && page <= maxPages) {
    const url = `${apiBase}/api/movies?page=${page}&limit=100`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Movies API ${response.status} (${url})`);
    }
    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];

    for (const row of rows) {
      if (row?.isActive === false) continue;
      const id = resolveMovieId(row);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      entries.push({
        id,
        lastmod: toLastmod(row.updatedAt),
      });
    }

    hasNext = Boolean(payload?.meta?.hasNextPage);
    page += 1;
  }

  entries.sort((a, b) => a.id - b.id);
  return entries;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Method Not Allowed");
  }

  const apiBase = String(
    process.env.REACT_APP_BASE_URL || process.env.API_BASE_URL || ""
  ).replace(/\/+$/, "");
  const site = String(
    process.env.SITE_URL || process.env.REACT_APP_SITE_URL || SITE_DEFAULT
  ).replace(/\/+$/, "");

  const staticEntries = [
    { loc: `${site}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${site}/recommended`, changefreq: "daily", priority: "0.9" },
    { loc: `${site}/news`, changefreq: "daily", priority: "0.8" },
  ];

  let movieEntries = [];
  let fetchError = null;

  if (apiBase) {
    try {
      const movies = await fetchAllMovieEntries(apiBase);
      movieEntries = movies.map((m) => ({
        loc: `${site}/movie/${m.id}`,
        changefreq: "weekly",
        priority: "0.9",
        lastmod: m.lastmod,
      }));
    } catch (error) {
      fetchError = error;
      console.error("[sitemap]", error?.message || error);
    }
  } else {
    console.warn("[sitemap] REACT_APP_BASE_URL / API_BASE_URL o‘rnatilmagan");
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticEntries.map(buildUrlXml),
    ...movieEntries.map(buildUrlXml),
    "</urlset>",
    "",
  ].join("\n");

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=1800, stale-while-revalidate=3600"
  );
  if (fetchError && movieEntries.length === 0) {
    res.setHeader("X-Sitemap-Warning", "movies-fetch-failed");
  }

  return res.status(200).send(xml);
};
