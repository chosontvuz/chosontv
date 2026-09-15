const { normalizeMediaUrl } = require("./mediaUrl");
const { normalizeSeoLocalizedText } = require("./seoFields");
const { getWebAppUrl } = require("../bot/webAppUrl");
const { resolveMovieNumericId } = require("../services/movieService");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const pickLocalized = (map, lang = "uz") => {
  if (!map || typeof map !== "object") return "";
  return String(map[lang] || map.uz || map.ru || "").trim();
};

const toAbsoluteUrl = (base, raw) => {
  const normalized = normalizeMediaUrl(raw);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `${base}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
};

/**
 * Kino obyektidan bot HTML uchun SEO maydonlarini yig'adi.
 */
function buildMovieSeoData(movie, { lang = "uz" } = {}) {
  const base = getWebAppUrl();
  const id = resolveMovieNumericId(movie);
  const seoTitle = normalizeSeoLocalizedText(movie?.seoTitle);
  const seoDescription = normalizeSeoLocalizedText(movie?.seoDescription);

  const fallbackTitle = pickLocalized(movie?.title, lang);
  const title = pickLocalized(seoTitle, lang) || fallbackTitle || "ChosonTV";

  const descSource =
    movie?.description?.[lang] ||
    movie?.description?.uz ||
    movie?.description?.ru ||
    {};
  const fallbackDesc =
    typeof descSource === "object"
      ? String(descSource.text || "").trim()
      : String(descSource || "").trim();
  const description =
    pickLocalized(seoDescription, lang) || fallbackDesc || "ChosonTV — filmlar onlayn.";

  const posterRaw =
    movie?.homeImg?.[lang] ||
    movie?.homeImg?.uz ||
    movie?.homeImg?.ru ||
    movie?.titleImg?.[lang] ||
    movie?.titleImg?.uz ||
    movie?.titleImg?.ru ||
    "";
  const image = toAbsoluteUrl(base, posterRaw);
  const canonicalUrl = id ? `${base}/movie/${id}` : base;
  const year =
    (typeof descSource === "object" && descSource?.year) ||
    movie?.specs?.year ||
    "";
  const genres =
    movie?.genre?.[lang] || movie?.genre?.uz || movie?.genre?.ru || [];

  return {
    id,
    base,
    lang,
    title,
    description: String(description).slice(0, 300),
    shortDescription: String(description).slice(0, 160),
    image,
    canonicalUrl,
    year,
    genres: Array.isArray(genres) ? genres : [],
    ratingImdb: movie?.ratingImdb,
  };
}

/**
 * Google bot uchun to'liq HTML (JS'siz title / description / og:image / JSON-LD).
 */
function buildMovieSeoHtml(seo) {
  const pageTitle = `${seo.title} | ChosonTV - Filmlar onlayn`;
  const locale = seo.lang === "ru" ? "ru_RU" : "uz_UZ";
  const localeAlt = seo.lang === "ru" ? "uz_UZ" : "ru_RU";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: seo.title,
    description: seo.shortDescription,
    url: seo.canonicalUrl,
    ...(seo.image ? { image: seo.image } : {}),
    ...(seo.year ? { datePublished: `${seo.year}-01-01` } : {}),
    ...(seo.ratingImdb
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: seo.ratingImdb,
            bestRating: 10,
            worstRating: 0,
          },
        }
      : {}),
    ...(seo.genres.length ? { genre: seo.genres } : {}),
  };

  const imgTag = seo.image
    ? `<img src="${escapeHtml(seo.image)}" alt="${escapeHtml(seo.title)}" width="300" height="450" />`
    : "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(seo.lang === "ru" ? "ru" : "uz")}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(seo.shortDescription)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />
  <meta property="og:type" content="video.movie" />
  <meta property="og:site_name" content="ChosonTV" />
  <meta property="og:title" content="${escapeHtml(`${seo.title} | ChosonTV`)}" />
  <meta property="og:description" content="${escapeHtml(seo.shortDescription)}" />
  <meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}" />
  ${seo.image ? `<meta property="og:image" content="${escapeHtml(seo.image)}" />` : ""}
  <meta property="og:locale" content="${locale}" />
  <meta property="og:locale:alternate" content="${localeAlt}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(`${seo.title} | ChosonTV`)}" />
  <meta name="twitter:description" content="${escapeHtml(seo.shortDescription)}" />
  ${seo.image ? `<meta name="twitter:image" content="${escapeHtml(seo.image)}" />` : ""}
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
</head>
<body>
  <main>
    <article>
      <h1>${escapeHtml(seo.title)}</h1>
      ${imgTag}
      <p>${escapeHtml(seo.description)}</p>
      <p><a href="${escapeHtml(seo.canonicalUrl)}">ChosonTV da tomosha qilish</a></p>
    </article>
  </main>
</body>
</html>`;
}

module.exports = {
  buildMovieSeoData,
  buildMovieSeoHtml,
  escapeHtml,
};
