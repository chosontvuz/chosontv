/**
 * SEO matn maydonlarini { uz, ru } shakliga keltiradi.
 * Eski kinolar / bo'sh qiymatlar uchun xavfsiz default.
 */
function normalizeSeoLocalizedText(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { uz: "", ru: "" };
  }
  return {
    uz: String(value.uz || "").trim(),
    ru: String(value.ru || "").trim(),
  };
}

/** API javobida seo maydonlari doim bo'lishi uchun */
function withSeoFields(movie) {
  if (!movie || typeof movie !== "object") return movie;
  return {
    ...movie,
    seoTitle: normalizeSeoLocalizedText(movie.seoTitle),
    seoDescription: normalizeSeoLocalizedText(movie.seoDescription),
  };
}

module.exports = {
  normalizeSeoLocalizedText,
  withSeoFields,
};
