const mongoose = require("mongoose");

const localizedSeoTextSchema = new mongoose.Schema(
  {
    uz: { type: String, default: "" },
    ru: { type: String, default: "" },
  },
  { _id: false }
);

const movieSchema = new mongoose.Schema(
  {
    movieId: {
      type: Number,
      required: true,
      index: true,
    },
    // Ixtiyoriy SEO — eski hujjatlarda bo'lmasa ham o'qish ishlaydi
    seoTitle: { type: localizedSeoTextSchema, default: undefined },
    seoDescription: { type: localizedSeoTextSchema, default: undefined },
  },
  {
    strict: false,
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Movie", movieSchema);
