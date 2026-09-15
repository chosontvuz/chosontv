/**
 * Media URL ni brauzer ochadigan holatga keltiradi.
 * `media.chosontv.uz/...` → `https://media.chosontv.uz/...`
 */
function normalizeMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }

  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw;
  }

  // Nisbiy path (/img/..., /movies/...) o'z holicha qoladi
  if (raw.startsWith("/")) {
    return raw;
  }

  // Domain bilan boshlangan, lekin protocol yo'q
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/:?]|$)/i.test(raw)) {
    return `https://${raw}`;
  }

  return raw;
}

/** SEO uchun absolyut URL — https bo'lsa origin qo'shilmaydi */
function toAbsoluteMediaUrl(value, base = "") {
  let url = normalizeMediaUrl(value);
  if (!url) return "";

  const httpsIdx = url.lastIndexOf("https://");
  const httpIdx = url.lastIndexOf("http://");
  const idx = Math.max(httpsIdx, httpIdx);
  if (idx > 0) {
    url = url.slice(idx);
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const origin = String(base || "").replace(/\/+$/, "");
  if (!origin) {
    return url.startsWith("/") ? url : `/${url}`;
  }
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

function normalizeLocalizedUrls(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return map;
  }

  const next = { ...map };
  Object.keys(next).forEach((key) => {
    if (typeof next[key] === "string") {
      next[key] = normalizeMediaUrl(next[key]);
    }
  });
  return next;
}

function normalizeMovieMedia(media) {
  if (!media || typeof media !== "object" || Array.isArray(media)) {
    return media;
  }

  const next = { ...media };
  Object.keys(next).forEach((lang) => {
    const block = next[lang];
    if (!block || typeof block !== "object") return;
    const img = block.img;
    if (img && typeof img === "object" && typeof img.src === "string") {
      next[lang] = {
        ...block,
        img: {
          ...img,
          src: normalizeMediaUrl(img.src),
        },
      };
    }
  });
  return next;
}

/** API javobidagi kino obyektidagi rasm/video maydonlarini tozalaydi */
function normalizeMovieMediaFields(movie) {
  if (!movie || typeof movie !== "object") return movie;

  return {
    ...movie,
    titleImg: normalizeLocalizedUrls(movie.titleImg),
    homeImg: normalizeLocalizedUrls(movie.homeImg),
    movieMedia: normalizeMovieMedia(movie.movieMedia),
    watchVideo: normalizeLocalizedUrls(movie.watchVideo),
  };
}

module.exports = {
  normalizeMediaUrl,
  toAbsoluteMediaUrl,
  normalizeLocalizedUrls,
  normalizeMovieMedia,
  normalizeMovieMediaFields,
};
