const express = require("express");
const Movie = require("../models/movies");
const { success, fail } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { applyPagination } = require("../utils/queryOptimizer");
const { validateIdParam } = require("../middlewares/validateRequest");
const { buildTopRatedMovies } = require("../services/topRatedService");
const { buildWeeklyTopMovies, MAX_WEEKLY_TOP } = require("../services/weeklyTopService");
const { toPublicMovie, buildSimilarMovies } = require("../services/similarMoviesService");
const authMiddleware = require("../middlewares/auth.middleware");
const MovieComment = require("../models/movieComment");
const User = require("../models/User");
const { verifyToken } = require("../utils/token");
const {
  normalizeMovieMediaFields,
  normalizeLocalizedUrls,
  normalizeMovieMedia,
} = require("../utils/mediaUrl");
const {
  normalizeSeoLocalizedText,
  withSeoFields,
} = require("../utils/seoFields");
const { notifySitemapUpdate } = require("../utils/sitemapNotify");
const { getNextMovieId, resolveMovieNumericId } = require("../services/movieService");

const router = express.Router();

const toApiMovie = ({ _id, movieId, createdAt, updatedAt, ...movie }) => {
  const id = resolveMovieNumericId({ movieId, id: movie.id });
  return withSeoFields(
    normalizeMovieMediaFields({
      ...movie,
      movieId: id,
      id,
    })
  );
};

const getOptionalUserId = async (req) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [type, token] = authHeader.split(" ");
    if (type !== "Bearer" || !token) return null;
    const payload = verifyToken(token);
    const user = await User.findById(payload.userId).select("_id").lean();
    return user?._id ? String(user._id) : null;
  } catch (_error) {
    return null;
  }
};

const toCommentTree = (rows = [], authorMap = new Map(), currentUserId = null) => {
  const byParent = new Map();
  rows.forEach((row) => {
    const parentKey = row.parentId ? String(row.parentId) : "root";
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey).push(row);
  });

  const build = (parentKey) =>
    (byParent.get(parentKey) || []).map((row) => ({
      // Always prefer current profile data so old comments show fresh avatar/name.
      ...(authorMap.get(String(row.authorId)) || {}),
      id: String(row._id),
      movieId: row.movieId,
      parentId: row.parentId ? String(row.parentId) : null,
      text: row.text,
      authorName: (authorMap.get(String(row.authorId))?.authorName || row.authorName),
      authorAvatar: (authorMap.get(String(row.authorId))?.authorAvatar ?? row.authorAvatar ?? null),
      createdAt: row.createdAt,
      likes: row.likes || 0,
      likedByMe: currentUserId ? (row.likedBy || []).some((id) => String(id) === String(currentUserId)) : false,
      replies: build(String(row._id)),
    }));

  return build("root");
};

router.get("/", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const total = await Movie.countDocuments();
    const rows = await applyPagination(
      Movie.find().sort({ movieId: 1 }).select("-__v"),
      pagination
    ).lean();
    const data = rows.map(toApiMovie);
    return success(res, data, "Kinolar ro'yxati", 200, buildPaginationMeta(total, pagination));
  } catch (error) {
    return next(error);
  }
});

router.get("/top-rated", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const rows = await Movie.find().select("-__v").lean();
    const movies = rows.map(toApiMovie);

    const topRatedMovies = buildTopRatedMovies(movies);
    const paginatedItems = topRatedMovies.slice(
      pagination.skip,
      pagination.skip + pagination.limit
    );

    return success(
      res,
      paginatedItems,
      "Yuqori reytingli kinolar",
      200,
      buildPaginationMeta(topRatedMovies.length, pagination)
    );
  } catch (error) {
    return next(error);
  }
});

router.get("/weekly-top", async (req, res, next) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), MAX_WEEKLY_TOP)
        : MAX_WEEKLY_TOP;

    const { items, meta } = await buildWeeklyTopMovies({ limit });

    return success(res, items, "Haftaning top 10 filimi", 200, {
      ...meta,
      page: 1,
      limit,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    // Client yuborgan id/movieId e'tiborsiz — server o'zi beradi
    const payload = { ...(req.body || {}) };
    delete payload._id;
    delete payload.id;
    delete payload.movieId;

    const hasTitle = payload?.title && (payload.title.uz || payload.title.ru);
    const hasHomeImg = payload?.homeImg && (payload.homeImg.uz || payload.homeImg.ru);
    if (!hasTitle) {
      return fail(res, "title.uz yoki title.ru majburiy.", 400);
    }
    if (!hasHomeImg) {
      return fail(res, "homeImg.uz yoki homeImg.ru majburiy.", 400);
    }

    // watchVideo ixtiyoriy (ayniqsa anons / tez kunda kinolar uchun)
    const watchVideo = normalizeLocalizedUrls({
      uz: payload?.watchVideo?.uz || "",
      ru: payload?.watchVideo?.ru || "",
    });

    const nextMovieId = await getNextMovieId();
    const rawCode = Number(payload.movieCode);
    const movieCode =
      Number.isFinite(rawCode) && rawCode > 0 ? rawCode : nextMovieId;
    const ageRaw = Number(payload.ageRestriction);
    const ageRestriction = Number.isFinite(ageRaw) && ageRaw > 0 ? ageRaw : 0;

    const created = await Movie.create({
      ...payload,
      titleImg: normalizeLocalizedUrls(payload.titleImg),
      homeImg: normalizeLocalizedUrls(payload.homeImg),
      movieMedia: normalizeMovieMedia(payload.movieMedia),
      watchVideo,
      seoTitle: normalizeSeoLocalizedText(payload.seoTitle),
      seoDescription: normalizeSeoLocalizedText(payload.seoDescription),
      movieCode,
      ageRestriction,
      movieId: nextMovieId,
      id: nextMovieId,
      filterGenre: Array.isArray(payload.filterGenre) ? payload.filterGenre : [],
      typeCategory: Array.isArray(payload.typeCategory) ? payload.typeCategory : [],
      actors: Array.isArray(payload.actors)
        ? payload.actors.map((v) => Number(v)).filter((v) => Number.isFinite(v))
        : [],
    });

    notifySitemapUpdate(nextMovieId);
    return success(res, toApiMovie(created.toObject ? created.toObject() : created), "Kino yaratildi", 201);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const movieId = Number(req.params.id);
    if (!Number.isFinite(movieId)) {
      return fail(res, "Noto'g'ri movieId.", 400);
    }
    const body = { ...(req.body || {}) };
    // ID doim URL dagi qiymat — client o'zgartira olmaydi
    delete body.movieId;
    delete body.id;
    // watchVideo bo'sh bo'lsa ham xato bermaslik — anonsdan boshqa bo'limga o'tkazish mumkin
    if (body.watchVideo != null) {
      body.watchVideo = normalizeLocalizedUrls({
        uz: body.watchVideo?.uz || "",
        ru: body.watchVideo?.ru || "",
      });
    }
    if (body.titleImg != null) {
      body.titleImg = normalizeLocalizedUrls(body.titleImg);
    }
    if (body.homeImg != null) {
      body.homeImg = normalizeLocalizedUrls(body.homeImg);
    }
    if (body.movieMedia != null) {
      body.movieMedia = normalizeMovieMedia(body.movieMedia);
    }
    if (body.seoTitle != null) {
      body.seoTitle = normalizeSeoLocalizedText(body.seoTitle);
    }
    if (body.seoDescription != null) {
      body.seoDescription = normalizeSeoLocalizedText(body.seoDescription);
    }
    if (body.ageRestriction != null) {
      const age = Number(body.ageRestriction);
      body.ageRestriction = Number.isFinite(age) && age > 0 ? age : 0;
    }
    const updated = await Movie.findOneAndUpdate(
      { movieId },
      { $set: body },
      { new: true, runValidators: false }
    ).lean();
    if (!updated) {
      return fail(res, "Kino topilmadi.", 404);
    }
    notifySitemapUpdate(movieId);
    return success(res, toApiMovie(updated), "Kino yangilandi.");
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const movieId = Number(req.params.id);
    if (!Number.isFinite(movieId)) {
      return fail(res, "Noto'g'ri movieId.", 400);
    }
    const deleted = await Movie.findOneAndDelete({ movieId });
    if (!deleted) {
      return fail(res, "Kino topilmadi.", 404);
    }
    notifySitemapUpdate(movieId);
    return success(res, null, "Kino o'chirildi.");
  } catch (error) {
    return next(error);
  }
});

router.get("/:movieId/comments", validateIdParam("movieId"), async (req, res, next) => {
  try {
    const currentUserId = await getOptionalUserId(req);
    const comments = await MovieComment.find({ movieId: req.params.movieId })
      .sort({ createdAt: -1 })
      .lean();

    const authorIds = [...new Set(comments.map((item) => String(item.authorId)).filter(Boolean))];
    let authorMap = new Map();
    if (authorIds.length > 0) {
      const authors = await User.find({ _id: { $in: authorIds } })
        .select("firstName lastName avatar")
        .lean();

      authorMap = new Map(
        authors.map((user) => {
          const authorName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "User";
          return [String(user._id), { authorName, authorAvatar: user.avatar || null }];
        })
      );
    }

    return success(res, toCommentTree(comments, authorMap, currentUserId), "Kommentlar olindi.");
  } catch (error) {
    return next(error);
  }
});

router.post("/:movieId/comments", validateIdParam("movieId"), authMiddleware, async (req, res, next) => {
  try {
    const text = String(req.body?.text || "").trim();
    const parentId = req.body?.parentId || null;

    if (!text) {
      return fail(res, "Komment matni bo'sh bo'lmasligi kerak.", 400);
    }

    const newComment = await MovieComment.create({
      movieId: req.params.movieId,
      parentId: parentId || null,
      text,
      authorId: req.user._id,
      authorName: [req.user.firstName, req.user.lastName].filter(Boolean).join(" ").trim() || "User",
      authorAvatar: req.user.avatar || null,
      likes: 0,
    });

    return success(
      res,
      {
        id: String(newComment._id),
        movieId: newComment.movieId,
        parentId: newComment.parentId ? String(newComment.parentId) : null,
        text: newComment.text,
        authorName: newComment.authorName,
        authorAvatar: newComment.authorAvatar || null,
        createdAt: newComment.createdAt,
        likes: newComment.likes || 0,
        likedByMe: false,
      },
      "Komment qo'shildi.",
      201
    );
  } catch (error) {
    return next(error);
  }
});

router.post("/:movieId/comments/:commentId/like", validateIdParam("movieId"), authMiddleware, async (req, res, next) => {
  try {
    const comment = await MovieComment.findOneAndUpdate(
      {
        _id: req.params.commentId,
        movieId: req.params.movieId,
      },
      {
        $addToSet: { likedBy: req.user._id },
      },
      { new: true }
    );

    if (!comment) {
      return fail(res, "Komment topilmadi.", 404);
    }

    const actualLikes = Array.isArray(comment.likedBy) ? comment.likedBy.length : 0;
    if ((comment.likes || 0) !== actualLikes) {
      comment.likes = actualLikes;
      await comment.save();
    }

    return success(res, { likes: actualLikes, likedByMe: true }, "Kommentga like bosildi.");
  } catch (error) {
    return next(error);
  }
});

router.delete("/:movieId/comments/:commentId/like", validateIdParam("movieId"), authMiddleware, async (req, res, next) => {
  try {
    const comment = await MovieComment.findOneAndUpdate(
      {
        _id: req.params.commentId,
        movieId: req.params.movieId,
      },
      {
        $pull: { likedBy: req.user._id },
      },
      { new: true }
    );

    if (!comment) {
      return fail(res, "Komment topilmadi.", 404);
    }

    const actualLikes = Array.isArray(comment.likedBy) ? comment.likedBy.length : 0;
    if ((comment.likes || 0) !== actualLikes) {
      comment.likes = actualLikes;
      await comment.save();
    }

    return success(res, { likes: actualLikes, likedByMe: false }, "Komment like'i olib tashlandi.");
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", validateIdParam("id"), async (req, res, next) => {
  try {
    const row = await Movie.findOne({ movieId: req.params.id }).select("-__v").lean();
    if (!row) {
      return fail(res, "Kino topilmadi.", 404);
    }

    return success(res, toApiMovie(row), "Kino ma'lumoti");
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/similar", validateIdParam("id"), async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const currentRow = await Movie.findOne({ movieId: req.params.id }).select("-__v").lean();
    if (!currentRow) {
      return fail(res, "Kino topilmadi.", 404);
    }

    const currentMovie = toPublicMovie(currentRow);
    const rows = await Movie.find().select("-__v").lean();
    const candidates = rows.map(toPublicMovie);
    const similarMovies = buildSimilarMovies({ currentMovie, candidates });
    const paginatedItems = similarMovies.slice(
      pagination.skip,
      pagination.skip + pagination.limit
    );

    return success(
      res,
      paginatedItems,
      "O'xshash kinolar",
      200,
      buildPaginationMeta(similarMovies.length, pagination)
    );
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
