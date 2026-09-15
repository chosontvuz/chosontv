import { apiClient } from '../services/apiClient';

const MIN_RATING = 5;

const toNum = (value) => {
  if (value == null || value === '' || value === 'none') return 0;
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const getMovieMaxRating = (movie = {}) =>
  Math.max(
    toNum(movie.ratingImdb),
    toNum(movie.ratingKinopoisk),
    toNum(movie.ratingNetflix)
  );

const isTopRated = (movie = {}) => getMovieMaxRating(movie) > MIN_RATING;

const toGenreList = (movie = {}) => {
  const values = [];
  if (Array.isArray(movie.filterGenre)) values.push(...movie.filterGenre);
  else if (movie.filterGenre) values.push(movie.filterGenre);

  if (Array.isArray(movie.genre)) values.push(...movie.genre);
  else if (movie.genre && typeof movie.genre === 'object') {
    Object.values(movie.genre).forEach((item) => {
      if (Array.isArray(item)) values.push(...item);
      else if (item) values.push(item);
    });
  } else if (movie.genre) {
    values.push(movie.genre);
  }

  return [...new Set(values.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean))];
};

const getPrimaryGenre = (movie = {}) => {
  const genres = toGenreList(movie);
  return genres[0] || 'unknown';
};

const diversifyByGenre = (movies = []) => {
  const grouped = new Map();
  movies.forEach((movie) => {
    const key = getPrimaryGenre(movie);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(movie);
  });

  const queue = [...grouped.entries()]
    .map(([genre, items]) => ({ genre, items, topScore: getMovieMaxRating(items[0]) }))
    .sort((a, b) => b.topScore - a.topScore);

  const result = [];
  while (queue.length) {
    for (let i = 0; i < queue.length; ) {
      const entry = queue[i];
      const item = entry.items.shift();
      if (item) result.push(item);
      if (!entry.items.length) queue.splice(i, 1);
      else i += 1;
    }
  }
  return result;
};

const buildTopRatedMoviesLocal = (movies = []) =>
  diversifyByGenre(
    [...movies]
      .filter(isTopRated)
      .sort((a, b) => getMovieMaxRating(b) - getMovieMaxRating(a))
  ).map((movie) => ({
    ...movie,
    rating: getMovieMaxRating(movie),
  }));

export const fetchMoviesList = async () => {
  const data = await apiClient.get('/api/movies', {
    cacheKey: 'movies:list',
    ttlMs: 30 * 1000,
    dedupeKey: 'movies:list',
  });
  return Array.isArray(data) ? data : [];
};

export const fetchMovieById = async (id) => {
  const movieId = Number(id);
  if (!Number.isFinite(movieId)) {
    throw new Error("Noto'g'ri kino id.");
  }

  return apiClient.get(`/api/movies/${movieId}`, {
    cacheKey: `movies:${movieId}`,
    ttlMs: 30 * 1000,
    dedupeKey: `movies:${movieId}`,
  });
};

export const fetchSimilarMovies = async (movieId, { page = 1, limit = 20 } = {}) => {
  const id = Number(movieId);
  if (!Number.isFinite(id)) {
    throw new Error("Noto'g'ri kino id.");
  }

  const query = `?page=${page}&limit=${limit}`;
  const data = await apiClient.get(`/api/movies/${id}/similar${query}`, {
    cacheKey: `movies:similar:${id}:${page}:${limit}`,
    ttlMs: 30 * 1000,
    dedupeKey: `movies:similar:${id}:${page}:${limit}`,
    includeMeta: true,
  });

  return {
    items: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta || null,
  };
};

export const fetchTopRatedMovies = async ({ page = 1, limit = 20 } = {}) => {
  const query = `?page=${page}&limit=${limit}`;
  try {
    const data = await apiClient.get(`/api/movies/top-rated${query}`, {
      cacheKey: `movies:top-rated:${page}:${limit}`,
      ttlMs: 30 * 1000,
      dedupeKey: `movies:top-rated:${page}:${limit}`,
      includeMeta: true,
    });

    return {
      items: Array.isArray(data?.data) ? data.data : [],
      meta: data?.meta || null,
    };
  } catch (error) {
    // Temporary compatibility for old backend deployments where /top-rated falls into /:id.
    const isLegacyRouteConflict =
      error?.status === 400 && String(error?.message || '').toLowerCase().includes("noto'g'ri id");
    if (!isLegacyRouteConflict) throw error;

    const catalog = await apiClient.get('/api/movies-catalog?page=1&limit=100', {
      cacheKey: 'movies-catalog:fallback-top-rated:1:100',
      ttlMs: 30 * 1000,
      dedupeKey: 'movies-catalog:fallback-top-rated:1:100',
      includeMeta: true,
    });
    const allMovies = catalog?.data?.allMovies || [];
    const sorted = buildTopRatedMoviesLocal(allMovies);
    const skip = Math.max(0, (page - 1) * limit);
    const items = sorted.slice(skip, skip + limit);
    const totalItems = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
      items,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
};

/** Haftaning top 10 — max 10, Ko'proq sahifasi yo'q */
export const WEEKLY_TOP_LIMIT = 10;

export const fetchWeeklyTopMovies = async ({ limit = WEEKLY_TOP_LIMIT } = {}) => {
  const safeLimit = Math.min(Math.max(1, Number(limit) || WEEKLY_TOP_LIMIT), WEEKLY_TOP_LIMIT);
  const query = `?limit=${safeLimit}`;
  const data = await apiClient.get(`/api/movies/weekly-top${query}`, {
    cacheKey: `movies:weekly-top:${safeLimit}`,
    ttlMs: 60 * 1000,
    dedupeKey: `movies:weekly-top:${safeLimit}`,
    includeMeta: true,
  });

  return {
    items: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta || null,
  };
};
