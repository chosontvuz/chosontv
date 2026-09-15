/**
 * Kino ko'rishlar: User.viewedMovies da saqlanadi.
 * Haftalik top uchun unique user + joriy hafta (Dushanba–Yakshanba) asosida hisoblanadi.
 */

const User = require("../models/User");

const VIEWED_MOVIES_LIMIT = 150;

/** Joriy kalendar haftasi: dushanba 00:00 → yakshanba oxiri (Asia/Tashkent, UTC+5). */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

const getCurrentWeekRange = (now = new Date()) => {
  const shifted = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  const day = shifted.getUTCDay(); // 0 = yakshanba
  const daysFromMonday = day === 0 ? 6 : day - 1;

  const weekStartUtc =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - daysFromMonday,
      0,
      0,
      0,
      0
    ) - TASHKENT_OFFSET_MS;

  const weekStart = new Date(weekStartUtc);
  const weekEnd = new Date(weekStartUtc + 7 * 24 * 60 * 60 * 1000);

  return { weekStart, weekEnd };
};

const toMovieId = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Auth user uchun kinoni ko'rilgan deb belgilaydi.
 * Takroriy ko'rishda viewCount++ va viewedAt yangilanadi.
 */
const registerMovieView = async ({ user, movieId: rawMovieId }) => {
  const movieId = toMovieId(rawMovieId);
  if (movieId === null) {
    const error = new Error("movieId noto'g'ri.");
    error.statusCode = 400;
    throw error;
  }

  const viewedMovies = Array.isArray(user.viewedMovies) ? [...user.viewedMovies] : [];
  const existing = viewedMovies.find((item) => Number(item.movieId) === movieId);
  const now = new Date();

  if (existing) {
    existing.viewCount = Math.max(1, Number(existing.viewCount) || 1) + 1;
    existing.viewedAt = now;
  } else {
    viewedMovies.unshift({ movieId, viewedAt: now, viewCount: 1 });
  }

  user.viewedMovies = viewedMovies
    .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
    .slice(0, VIEWED_MOVIES_LIMIT);

  await user.save();

  return {
    movieId,
    viewedMovies: user.viewedMovies,
  };
};

/**
 * Joriy haftada unique userlar soni bo'yicha kinolar.
 * Har bir user × movieId — 1 ta ovoz (viewCount emas).
 */
const getWeeklyUniqueViewRows = async ({
  weekStart,
  weekEnd,
  minUniqueUsers = 2,
  limit = 10,
} = {}) => {
  const range = weekStart && weekEnd
    ? { weekStart, weekEnd }
    : getCurrentWeekRange();

  const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 10);
  const safeMin = Math.max(1, Number(minUniqueUsers) || 2);

  const rows = await User.aggregate([
    { $match: { "viewedMovies.0": { $exists: true } } },
    { $unwind: "$viewedMovies" },
    {
      $match: {
        "viewedMovies.viewedAt": {
          $gte: range.weekStart,
          $lt: range.weekEnd,
        },
        "viewedMovies.movieId": { $type: "number", $gt: 0 },
      },
    },
    {
      $group: {
        _id: "$viewedMovies.movieId",
        uniqueUsers: { $sum: 1 },
        totalViews: { $sum: { $ifNull: ["$viewedMovies.viewCount", 1] } },
      },
    },
    { $match: { uniqueUsers: { $gte: safeMin } } },
    { $sort: { uniqueUsers: -1, totalViews: -1, _id: 1 } },
    { $limit: safeLimit },
  ]);

  return rows.map((row) => ({
    movieId: Number(row._id),
    uniqueUsers: Number(row.uniqueUsers) || 0,
    totalViews: Number(row.totalViews) || 0,
  }));
};

module.exports = {
  VIEWED_MOVIES_LIMIT,
  getCurrentWeekRange,
  toMovieId,
  registerMovieView,
  getWeeklyUniqueViewRows,
};
