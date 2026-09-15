require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const bannerRoutes = require("./routes/bannerRoutes");
const actorsRoutes = require("./routes/actorsRouts");
const genresRoutes = require("./routes/genresRouts");
const socialLinkRoutes = require("./routes/socialLinkRouts");
const translationsRoutes = require("./routes/translationsRouts");
const moviesCatalogRoutes = require("./routes/moviesCatalogRouts");
const moviesRoutes = require("./routes/moviesRouts");
const adsRoutes = require("./routes/adsRouts");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/adminRouts");
const uploadRoutes = require("./routes/upload.routes");
const { success, fail } = require("./utils/apiResponse");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler");

const app = express();
connectDB();

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (!corsOrigins.length) return true;

  return corsOrigins.some((allowedOrigin) => {
    if (allowedOrigin === origin) return true;
    if (allowedOrigin.startsWith("*.")) {
      const suffix = allowedOrigin.slice(1);
      return origin.endsWith(suffix);
    }
    return false;
  });
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS: origin ruxsat etilmagan"));
    },
    credentials: true,
  })
);

const bodyLimit = process.env.BODY_LIMIT || "200mb";
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
app.use("/api/banners", bannerRoutes);
app.use("/api/actors", actorsRoutes);
app.use("/api/genres", genresRoutes);
app.use("/api/social-links", socialLinkRoutes);
app.use("/api/translations", translationsRoutes);
app.use("/api/movies-catalog", moviesCatalogRoutes);
app.use("/api/movies", moviesRoutes);
app.use("/api/ads", adsRoutes);
app.use("/api/trillers", require("./routes/trillerRoutes"));
app.use("/api/news", require("./routes/newsRoutes"));
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);

app.get("/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  return success(res, {
    db: dbConnected ? "connected" : "disconnected",
  },
  "Server ishlayapti");
});

// Dinamik sitemap — static client/build/sitemap.xml dan OLDIN (ustunlik)
app.use(require("./routes/sitemapRoutes"));

// Google/botlar uchun /movie/:id HTML (SPA ni buzmasdan)
const movieSeoPrerender = require("./middlewares/movieSeoPrerender");

const clientBuildPath = process.env.CLIENT_BUILD_PATH
  ? path.resolve(process.env.CLIENT_BUILD_PATH)
  : path.join(__dirname, "../../client/build");

if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath, { index: false }));
  app.use(movieSeoPrerender);
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return fail(res, "Endpoint topilmadi", 404);
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, "index.html"), (err) => {
      if (err) next(err);
    });
  });
} else {
  // Dev: build yo'q bo'lsa ham bot HTML ni tekshirish mumkin
  app.use(movieSeoPrerender);
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
