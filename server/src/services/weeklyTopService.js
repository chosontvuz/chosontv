/**
 * Haftaning top filimi:
 * - kirish: joriy haftada kamida MIN_UNIQUE_USERS ta unique (login) user
 * - tartib: uniqueUsers DESC
 * - limit: MAX_WEEKLY_TOP (10)
 * - yangilanish: har dushanba yangi hafta boshlanadi (yakshanba oxiri)
 */

const Movie = require("../models/movies");
const {
  getCurrentWeekRange,
  getWeeklyUniqueViewRows,
} = require("../utils/movieViews");
const { resolveMovieNumericId } = require("./movieService");

const MIN_UNIQUE_USERS = 1; // Kamida 1 ta login user ko‘rsa weekly topga chiqadi
const MAX_WEEKLY_TOP = 10;

const toPublicMovie = (row) => {
  if (!row) return null;
  const { _id, movieId, createdAt, updatedAt, __v, ...movie } = row;
  const id = resolveMovieNumericId({ movieId, id: movie.id });
  return {
    ...movie,
    movieId: id,
    id,
  };
};

/**
 * @returns {{ items: Array, meta: object }}
 */
const buildWeeklyTopMovies = async ({
  limit = MAX_WEEKLY_TOP,
  minUniqueUsers = MIN_UNIQUE_USERS,
} = {}) => {
  const safeLimit = Math.min(Math.max(1, Number(limit) || MAX_WEEKLY_TOP), MAX_WEEKLY_TOP);
  const { weekStart, weekEnd } = getCurrentWeekRange();

  const ranked = await getWeeklyUniqueViewRows({
    weekStart,
    weekEnd,
    minUniqueUsers,
    limit: safeLimit,
  });

  if (!ranked.length) {
    return {
      items: [],
      meta: {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        minUniqueUsers,
        limit: safeLimit,
        totalItems: 0,
      },
    };
  }

  const ids = ranked.map((r) => r.movieId);
  const rows = await Movie.find({
    $or: [{ movieId: { $in: ids } }, { id: { $in: ids } }],
  })
    .select("-__v")
    .lean();

  const byId = new Map();
  rows.forEach((row) => {
    const id = Number(row.id ?? row.movieId);
    if (Number.isFinite(id)) byId.set(id, row);
  });

  const items = ranked
    .map((entry, index) => {
      const movie = toPublicMovie(byId.get(entry.movieId));
      if (!movie) return null;
      return {
        ...movie,
        weeklyRank: index + 1,
        weeklyUniqueUsers: entry.uniqueUsers,
        weeklyViews: entry.totalViews,
      };
    })
    .filter(Boolean);

  return {
    items,
    meta: {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      minUniqueUsers,
      limit: safeLimit,
      totalItems: items.length,
    },
  };
};

module.exports = {
  MIN_UNIQUE_USERS,
  MAX_WEEKLY_TOP,
  buildWeeklyTopMovies,
};
