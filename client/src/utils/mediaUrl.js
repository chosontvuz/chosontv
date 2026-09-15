/**
 * `media.chosontv.uz/...` kabi protocol'siz URL larni brauzer uchun to'g'rilaydi.
 */
export function normalizeMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Protocol-relative: //media.chosontv.uz/...
  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }

  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return raw;
  }

  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/:?]|$)/i.test(raw)) {
    return `https://${raw}`;
  }

  return raw;
}

/**
 * SEO / og:image uchun absolyut URL.
 * Allaqachon https bo'lsa origin qo'shilmaydi (ikki marta yopishishni oldini oladi).
 */
export function toAbsoluteMediaUrl(value, origin = '') {
  let url = normalizeMediaUrl(value);
  if (!url) return '';

  // Noto'g'ri yopishgan holat: https://site.comhttps://media...
  const httpsIdx = url.lastIndexOf('https://');
  const httpIdx = url.lastIndexOf('http://');
  const idx = Math.max(httpsIdx, httpIdx);
  if (idx > 0) {
    url = url.slice(idx);
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const base = String(origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/+$/,
    ''
  );
  if (!base) {
    return url.startsWith('/') ? url : `/${url}`;
  }
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}
