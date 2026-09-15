const Movie = require("../models/movies");
const { isSeoBot } = require("../utils/isSeoBot");
const {
  buildMovieSeoData,
  buildMovieSeoHtml,
} = require("../utils/movieSeoHtml");
const { resolveMovieNumericId } = require("../services/movieService");

/**
 * Faqat SEO botlar uchun /movie/:id — JS'siz HTML.
 * Oddiy foydalanuvchi → next() → SPA index.html (buzilmaydi).
 */
async function movieSeoPrerender(req, res, next) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    const match = String(req.path || "").match(/^\/movie\/(\d+)\/?$/i);
    if (!match) {
      return next();
    }

    if (!isSeoBot(req)) {
      return next();
    }

    const movieId = Number(match[1]);
    if (!Number.isFinite(movieId) || movieId <= 0) {
      return next();
    }

    const row = await Movie.findOne({ movieId }).select("-__v").lean();
    if (!row || row.isActive === false) {
      // Topilmasa SPA/404 ga qoldiramiz — bot uchun ham soft fallback
      return next();
    }

    const id = resolveMovieNumericId(row);
    if (!id) {
      return next();
    }

    const acceptLang = String(req.headers["accept-language"] || "").toLowerCase();
    const lang = acceptLang.startsWith("ru") ? "ru" : "uz";
    const seo = buildMovieSeoData(row, { lang });
    const html = buildMovieSeoHtml(seo);

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=600");
    res.set("Vary", "User-Agent, Accept-Language");
    res.set("X-Robots-Tag", "index, follow");
    return res.status(200).send(html);
  } catch (error) {
    // Xato bo'lsa SPA ga o'tkazamiz — sayt ishlashini buzmaslik
    return next();
  }
}

module.exports = movieSeoPrerender;
