/**
 * Watch / Episode 1 playback helpers.
 * Tomosha: watchVideo → watchUrl → videoUrl → seasons[first].episodes[0]
 * Never falls back to episode 2+.
 */

export const isUsableVideoUrl = (url) => {
  const s = String(url || '').trim();
  return Boolean(s) && s !== 'none';
};

/** Watch maydonidagi video (episode emas). */
export const getMovieWatchSourceUrl = (movie, { lang = 'uz', watchVideoTrack } = {}) => {
  if (movie?.watchVideo && typeof movie.watchVideo === 'object') {
    const wv = movie.watchVideo;
    const uzOk = isUsableVideoUrl(wv.uz);
    const ruOk = isUsableVideoUrl(wv.ru);
    if (uzOk && ruOk) {
      const track = watchVideoTrack === 'ru' ? 'ru' : 'uz';
      if (isUsableVideoUrl(wv[track])) return String(wv[track]).trim();
    }
    const preferred = lang === 'ru' ? 'ru' : 'uz';
    if (isUsableVideoUrl(wv[preferred])) return String(wv[preferred]).trim();
    if (uzOk) return String(wv.uz).trim();
    if (ruOk) return String(wv.ru).trim();
  } else if (isUsableVideoUrl(movie?.watchVideo)) {
    return String(movie.watchVideo).trim();
  }

  if (isUsableVideoUrl(movie?.watchUrl)) return String(movie.watchUrl).trim();
  if (isUsableVideoUrl(movie?.videoUrl)) return String(movie.videoUrl).trim();
  return '';
};

export const hasMovieWatchSource = (movie) =>
  Boolean(getMovieWatchSourceUrl(movie, { lang: 'uz' }));

/**
 * Birinchi mavjud mavsumning faqat episodes[0] URL i.
 * Episode 2/3/4... ishlatilmaydi.
 */
export const getFirstEpisodeUrl = (movie, lang = 'uz') => {
  const preferred = lang === 'ru' ? 'ru' : 'uz';
  const other = preferred === 'ru' ? 'uz' : 'ru';
  const seasons = [...(Array.isArray(movie?.seasons) ? movie.seasons : [])].sort(
    (a, b) => (Number(a?.seasonNumber) || 0) - (Number(b?.seasonNumber) || 0)
  );

  for (const season of seasons) {
    const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
    if (!episodes.length) continue;
    const ep0 = episodes[0];
    if (isUsableVideoUrl(ep0?.[preferred])) return String(ep0[preferred]).trim();
    if (isUsableVideoUrl(ep0?.[other])) return String(ep0[other]).trim();
  }
  return '';
};

/** Tomosha / player: avval Watch, bo‘sh bo‘lsa Episode 1. */
export const resolveTomoshaPlaybackUrl = (movie, options = {}) => {
  const lang = options.lang === 'ru' ? 'ru' : 'uz';
  return (
    getMovieWatchSourceUrl(movie, {
      lang,
      watchVideoTrack: options.watchVideoTrack,
    }) || getFirstEpisodeUrl(movie, lang)
  );
};
