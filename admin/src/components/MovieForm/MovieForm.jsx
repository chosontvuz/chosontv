import { useEffect, useMemo, useRef, useState } from "react";
import { createMovie } from "../../services/movieApi";
import { fetchActors } from "../../services/actorApi";
import { fetchGenres } from "../../services/genreApi";
import { uploadToR2, UPLOAD_FOLDERS } from "../../services/uploadApi";
import {
  CATEGORY_NAME_OPTIONS,
  CATEGORY_NAME_TO_SECTION,
  isAnonsCategory,
  TYPE_CATEGORY_OPTIONS,
} from "../../constants/movieFormOptions";
import { getVideoEmbed, normalizeVideoSource } from "../../utils/videoEmbed";
import { normalizeMediaUrl } from "../../utils/mediaUrl";
import UploadProgress from "../UploadProgress/UploadProgress";
import "./MovieForm.css";

function UploadIcon() {
  return (
    <svg className="movie-form__upload-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M19 20H5v-2h14v2zM11 16h2v-6h3l-4-4-4 4h3v6zm-6-5h2v2H5v-2zm12 0h2v2h-2v-2z"
      />
    </svg>
  );
}

function Field({ label, help, required, children }) {
  return (
    <div className="movie-form__field">
      <label className="movie-form__label">
        {label}
        {required ? <span className="movie-form__req"> *</span> : null}
      </label>
      {help ? <span className="movie-form__help">{help}</span> : null}
      {children}
    </div>
  );
}

function Block({ step, title, help, children }) {
  return (
    <section className="movie-form__block">
      <header className="movie-form__block-head">
        <h4 className="movie-form__section">
          {step ? `${step}. ${title}` : title}
        </h4>
        {help ? <p className="movie-form__block-help">{help}</p> : null}
      </header>
      <div className="movie-form__section-card">{children}</div>
    </section>
  );
}

function isDirectVideoUrl(url) {
  const videoRaw = String(url || "").trim();
  if (!videoRaw) return false;
  return (
    /\.(mp4|webm|ogg|mov)(\?|$)/i.test(videoRaw) ||
    videoRaw.includes("/movies/") ||
    videoRaw.startsWith("http://") ||
    videoRaw.startsWith("https://") ||
    videoRaw.startsWith("data:video") ||
    videoRaw.startsWith("blob:")
  );
}

function VideoPreview({ url, title = "Video preview" }) {
  const videoRaw = String(url || "").trim();
  const embedUrl = getVideoEmbed(videoRaw)?.embedUrl || "";
  const showDirect = !embedUrl && isDirectVideoUrl(videoRaw);

  return (
    <div className="movie-form__preview-box">
      {embedUrl ? (
        <iframe
          key={embedUrl}
          className="movie-form__video-preview movie-form__video-preview--embed"
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; screen-wake-lock"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : showDirect ? (
        <video
          key={videoRaw}
          className="movie-form__video-preview"
          src={videoRaw}
          controls
          playsInline
          preload="metadata"
        />
      ) : (
        <span className="movie-form__preview-empty">
          Video havola yoki fayl tanlang — preview shu yerda chiqadi
        </span>
      )}
    </div>
  );
}

const emptySeason = (seasonNumber = 1) => ({
  seasonNumber,
  title: { uz: `Mavsum ${seasonNumber}`, ru: `Сезон ${seasonNumber}` },
  episodes: [{ uz: "", ru: "" }],
});

const normalizeCommaText = (text) =>
  String(text || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const parseNewlineGenres = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);

const genresToNewlineText = (list) =>
  (Array.isArray(list) ? list : [])
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join("\n");

const genresToCommaText = (list) =>
  (Array.isArray(list) ? list : [])
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");

/** Probel: oldida vergul yo‘q bo‘lsa avtomatik ", " */
const insertAutoCommaOnSpace = (value, selectionStart, selectionEnd) => {
  if (selectionStart !== selectionEnd) return null;
  const before = String(value || "").slice(0, selectionStart);
  const after = String(value || "").slice(selectionEnd);
  if (!before.trim()) return null;
  if (/,\s*$/.test(before)) return null;
  const trimmedBefore = before.replace(/\s+$/, "");
  return {
    nextValue: `${trimmedBefore}, ${after}`,
    nextCursor: trimmedBefore.length + 2,
  };
};

function normalizeInitialMovie(data = {}) {
  const safeSeasons = Array.isArray(data.seasons) && data.seasons.length
    ? data.seasons.map((season, idx) => ({
        seasonNumber: Number(season?.seasonNumber) || idx + 1,
        title: {
          uz: season?.title?.uz || `Mavsum ${idx + 1}`,
          ru: season?.title?.ru || `Сезон ${idx + 1}`,
        },
        episodes: Array.isArray(season?.episodes) && season.episodes.length
          ? season.episodes.map((ep) => ({ uz: ep?.uz || "", ru: ep?.ru || "" }))
          : [{ uz: "", ru: "" }],
      }))
    : [emptySeason(1)];

  const safeDescription = typeof data.description === "object" && data.description
    ? data.description
    : {};

  return {
    ...data,
    movieId: String(data.movieId ?? data.id ?? ""),
    movieCode: String(data.movieCode ?? ""),
    title: {
      uz: data?.title?.uz || "",
      ru: data?.title?.ru || "",
    },
    titleImg: {
      uz: data?.titleImg?.uz || "",
      ru: data?.titleImg?.ru || "",
    },
    homeImg: {
      uz: data?.homeImg?.uz || "",
      ru: data?.homeImg?.ru || "",
    },
    genre: {
      uz: Array.isArray(data?.genre?.uz)
        ? data.genre.uz
        : Array.isArray(safeDescription?.uz?.genre)
        ? safeDescription.uz.genre
        : [],
      ru: Array.isArray(data?.genre?.ru)
        ? data.genre.ru
        : Array.isArray(safeDescription?.ru?.genre)
        ? safeDescription.ru.genre
        : [],
    },
    movieMedia: {
      uz: {
        img: {
          type: "img",
          src: data?.movieMedia?.uz?.img?.src || data?.movieMedia?.uz?.video?.src || "",
        },
      },
      ru: {
        img: {
          type: "img",
          src: data?.movieMedia?.ru?.img?.src || data?.movieMedia?.ru?.video?.src || "",
        },
      },
    },
    description: {
      uz: {
        text: safeDescription?.uz?.text || "",
        year: safeDescription?.uz?.year ?? "",
        country: safeDescription?.uz?.country || "",
        duration: safeDescription?.uz?.duration ?? "",
        genre: Array.isArray(safeDescription?.uz?.genre) ? safeDescription.uz.genre : [],
        director: safeDescription?.uz?.director || "",
      },
      ru: {
        text: safeDescription?.ru?.text || "",
        year: safeDescription?.ru?.year ?? "",
        country: safeDescription?.ru?.country || "",
        duration: safeDescription?.ru?.duration ?? "",
        genre: Array.isArray(safeDescription?.ru?.genre) ? safeDescription.ru.genre : [],
        director: safeDescription?.ru?.director || "",
      },
    },
    watchVideo: {
      uz: data?.watchVideo?.uz || "",
      ru: data?.watchVideo?.ru || "",
    },
    seasons: safeSeasons,
    actors: Array.isArray(data.actors) ? data.actors.map((v) => Number(v)).filter(Number.isFinite) : [],
    typeCategory: Array.isArray(data.typeCategory) ? data.typeCategory : [],
    filterGenre: Array.isArray(data.filterGenre) ? data.filterGenre : [],
    filterCountry: data?.filterCountry || "",
    like: String(data?.like ?? ""),
    dislike: String(data?.dislike ?? ""),
    ageRestriction: (() => {
      const n = Number(data?.ageRestriction);
      return Number.isFinite(n) && n > 0 ? String(n) : "";
    })(),
    ratingImdb:
      data?.ratingImdb != null && data?.ratingImdb !== ""
        ? String(data.ratingImdb)
        : "",
    ratingKinopoisk:
      data?.ratingKinopoisk != null && data?.ratingKinopoisk !== ""
        ? String(data.ratingKinopoisk)
        : "",
    ratingNetflix:
      data?.ratingNetflix != null && data?.ratingNetflix !== ""
        ? String(data.ratingNetflix)
        : "",
    specs: {
      duration: data?.specs?.duration ?? "",
      ageRating: data?.specs?.ageRating || "",
      year: data?.specs?.year ?? "",
      countries: Array.isArray(data?.specs?.countries) ? data.specs.countries : [],
      languages: Array.isArray(data?.specs?.languages) ? data.specs.languages : [],
    },
    categoryName: data?.categoryName || "",
    category: data?.category || "",
  };
}

export default function MovieForm({ onCancel, onSaved, mode = "create", initialData = null, onSubmitData }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actors, setActors] = useState([]);
  const [filterGenreOptions, setFilterGenreOptions] = useState([]);
  const [actorsOpen, setActorsOpen] = useState(false);
  const [actorsSearch, setActorsSearch] = useState("");
  const [filterGenreOpen, setFilterGenreOpen] = useState(false);
  const [typeCategoryOpen, setTypeCategoryOpen] = useState(false);
  const [categoryNameOpen, setCategoryNameOpen] = useState(false);
  const [uploadState, setUploadState] = useState({});
  // Draft matn: har keystroke'da array→join qilinsa probel/vergul/Enter yo'qoladi
  const [genreBadgeText, setGenreBadgeText] = useState({ uz: "", ru: "" });
  const [genreDescText, setGenreDescText] = useState({ uz: "", ru: "" });
  const [form, setForm] = useState({
    movieId: "",
    movieCode: "",
    title: { uz: "", ru: "" },
    titleImg: { uz: "", ru: "" },
    homeImg: { uz: "", ru: "" },
    movieMedia: {
      uz: { img: { type: "img", src: "" } },
      ru: { img: { type: "img", src: "" } },
    },
    ratingImdb: "",
    ratingKinopoisk: "",
    ratingNetflix: "",
    ageRestriction: "",
    categoryName: "",
    category: "",
    genre: { uz: [], ru: [] },
    description: {
      uz: { text: "", year: "", country: "", duration: "", genre: [], director: "" },
      ru: { text: "", year: "", country: "", duration: "", genre: [], director: "" },
    },
    watchVideo: { uz: "", ru: "" },
    seasons: [emptySeason(1)],
    actors: [],
    typeCategory: [],
    filterCountry: "",
    filterGenre: [],
    like: "",
    dislike: "",
    specs: { duration: "", ageRating: "", year: "", countries: [], languages: [] },
    isActive: true,
  });

  const wrappersRef = useRef(null);

  useEffect(() => {
    const run = async () => {
      try {
        const [actorRows, genreRows] = await Promise.all([
          fetchActors(),
          fetchGenres(),
        ]);
        if (mode === "edit" && initialData) {
          const normalized = normalizeInitialMovie(initialData);
          setForm((prev) => ({ ...prev, ...normalized }));
          const badgeUz =
            normalized.genre?.uz?.length
              ? normalized.genre.uz
              : normalized.description?.uz?.genre || [];
          const badgeRu =
            normalized.genre?.ru?.length
              ? normalized.genre.ru
              : normalized.description?.ru?.genre || [];
          const descUz =
            normalized.description?.uz?.genre?.length
              ? normalized.description.uz.genre
              : badgeUz;
          const descRu =
            normalized.description?.ru?.genre?.length
              ? normalized.description.ru.genre
              : badgeRu;
          setGenreBadgeText({
            uz: genresToNewlineText(badgeUz),
            ru: genresToNewlineText(badgeRu),
          });
          setGenreDescText({
            uz: genresToCommaText(descUz),
            ru: genresToCommaText(descRu),
          });
        }
        setActors(actorRows);

        const fromDb = new Set();
        (Array.isArray(genreRows) ? genreRows : []).forEach((genre) => {
          const values = Array.isArray(genre?.filterGenre)
            ? genre.filterGenre
            : genre?.filterGenre
            ? [genre.filterGenre]
            : [];
          values.forEach((value) => {
            const trimmed = String(value || "").trim();
            if (trimmed) fromDb.add(trimmed);
          });
        });
        setFilterGenreOptions(Array.from(fromDb).sort((a, b) => a.localeCompare(b, "uz")));
      } catch (e) {
        setError(e.message || "Boshlang'ich ma'lumotlarni olishda xatolik.");
      }
    };
    run();
  }, [mode, initialData]);

  useEffect(() => {
    const onOutside = (event) => {
      if (!wrappersRef.current?.contains(event.target)) {
        setActorsOpen(false);
        setFilterGenreOpen(false);
        setTypeCategoryOpen(false);
        setCategoryNameOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const isAnons = isAnonsCategory(form.categoryName, form.category);

  const qidiruvJanrOptions = useMemo(() => {
    const merged = new Set(filterGenreOptions);
    (form.filterGenre || []).forEach((value) => {
      const trimmed = String(value || "").trim();
      if (trimmed) merged.add(trimmed);
    });
    return Array.from(merged).sort((a, b) => a.localeCompare(b, "uz"));
  }, [filterGenreOptions, form.filterGenre]);

  const isUploading = useMemo(
    () => Object.values(uploadState).some((item) => item?.uploading),
    [uploadState]
  );

  const canSave = useMemo(() => {
    return Boolean(
      form.title.uz.trim() &&
        form.title.ru.trim() &&
        form.homeImg.uz &&
        form.homeImg.ru &&
        form.category &&
        form.categoryName
    );
  }, [form]);

  const selectCategoryName = (value) => {
    patch({ categoryName: value, category: value });
    setCategoryNameOpen(false);
  };

  const buildTypeCategoryForSection = (section, previous = []) => {
    const next = (Array.isArray(previous) ? previous : [])
      .filter((item) => item && item !== "anonslar" && item !== "anons" && item !== section);
    if (section) next.push(section);
    if (section === "koreaDrama" && !next.includes("korea")) next.push("korea");
    return next;
  };

  const setUpload = (key, patch) => {
    setUploadState((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  };

  const patch = (patchData) => setForm((prev) => ({ ...prev, ...patchData }));

  const onPickFile = async (key, pathUpdater, file) => {
    if (!file) return;
    setError("");
    setUpload(key, { uploading: true, progress: 1, fileName: file.name || "" });
    try {
      const { url } = await uploadToR2(file, UPLOAD_FOLDERS.movies, {
        onProgress: (progress) => setUpload(key, { progress }),
      });
      setForm((prev) => pathUpdater(prev, normalizeMediaUrl(url)));
      setUpload(key, { uploading: false, progress: 100 });
    } catch (e) {
      setUpload(key, { uploading: false, progress: 0 });
      setError(e.message || "Faylni R2 ga yuklashda xatolik.");
    }
  };

  const toggleArrayValue = (key, value) => {
    patch({
      [key]: form[key].includes(value) ? form[key].filter((x) => x !== value) : [...form[key], value],
    });
  };

  const toggleActor = (id) => {
    const numeric = Number(id);
    patch({
      actors: form.actors.includes(numeric)
        ? form.actors.filter((item) => item !== numeric)
        : [...form.actors, numeric],
    });
  };

  const filteredActors = useMemo(() => {
    const q = actorsSearch.trim().toLowerCase();
    if (!q) return actors;
    return actors.filter((actor) => {
      const uz = String(actor?.name?.uz || "").toLowerCase();
      const ru = String(actor?.name?.ru || "").toLowerCase();
      const id = String(actor?.actorId ?? actor?.id ?? "");
      return uz.includes(q) || ru.includes(q) || id.includes(q);
    });
  }, [actors, actorsSearch]);

  const toggleActorsOpen = () => {
    setActorsOpen((prev) => {
      const next = !prev;
      if (!next) setActorsSearch("");
      return next;
    });
  };

  const updateSeason = (index, updater) => {
    const next = [...form.seasons];
    next[index] = updater(next[index]);
    patch({ seasons: next });
  };

  const toNumberOrDefault = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  /** Yosh cheklovi: 0 yoki bo'sh → 0; "16+" matndan ham olish mumkin */
  const resolveAgeRestriction = () => {
    const direct = Number(form.ageRestriction);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const match = String(form.specs?.ageRating || "").match(/(\d{1,2})/);
    if (match) {
      const fromText = Number(match[1]);
      if (Number.isFinite(fromText) && fromText > 0) return fromText;
    }
    return 0;
  };

  const patchBadgeGenres = (lang, text) => {
    setGenreBadgeText((prev) => ({ ...prev, [lang]: text }));
    setForm((prev) => ({
      ...prev,
      genre: {
        ...prev.genre,
        [lang]: parseNewlineGenres(text),
      },
    }));
  };

  const patchDescGenres = (lang, text) => {
    setGenreDescText((prev) => ({ ...prev, [lang]: text }));
    setForm((prev) => ({
      ...prev,
      description: {
        ...prev.description,
        [lang]: {
          ...prev.description[lang],
          genre: normalizeCommaText(text),
        },
      },
    }));
  };
  const renderUploadField = ({ keyName, label, help, accept, onFile, previewUrl }) => {
    const upload = uploadState[keyName] || {};
    const selectedText = upload.fileName
      ? upload.fileName
      : upload.progress >= 100
      ? "Fayl tanlandi"
      : "Fayl tanlanmagan";
    const isVideo = accept.includes("video");
    const previewSrc = normalizeMediaUrl(previewUrl);

    return (
      <div className="movie-form__upload-row" key={keyName}>
        <Field label={label} help={help}>
          <label className="movie-form__upload-field">
            <input
              className="movie-form__file-input"
              type="file"
              accept={accept}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <div className="movie-form__upload-head">
              <UploadIcon />
              <div className="movie-form__upload-meta">
                <strong>{isVideo ? "Faylni tanlang" : "Rasmni tanlang"}</strong>
                <span>{selectedText}</span>
              </div>
            </div>
            {previewSrc && !isVideo ? (
              <img className="movie-form__upload-preview" src={previewSrc} alt="" />
            ) : null}
            <UploadProgress show={upload.uploading || upload.progress > 0} progress={upload.progress} />
          </label>
        </Field>
      </div>
    );
  };

  const onSubmit = async () => {
    if (!canSave) {
      setError("Majburiy maydonlar: kino nomi (UZ/RU), asosiy poster (UZ/RU) va bo‘lim.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const categoryName = form.categoryName || form.category || "";
      const section = CATEGORY_NAME_TO_SECTION[categoryName] || "";
      const ageRestriction = resolveAgeRestriction();
      // Anons uchun watchVideo bo'sh bo'lishi mumkin; boshqa bo'limga o'tkazganda
      // video qo'shilgan bo'lsa saqlanadi, eski ma'lumotlar o'chirilmaydi.
      const watchVideo = {
        uz: normalizeVideoSource(form.watchVideo?.uz),
        ru: normalizeVideoSource(form.watchVideo?.ru),
      };

      const genreUz = parseNewlineGenres(genreBadgeText.uz);
      const genreRu = parseNewlineGenres(genreBadgeText.ru);
      const descGenreUz = normalizeCommaText(genreDescText.uz);
      const descGenreRu = normalizeCommaText(genreDescText.ru);

      const payload = {
        movieCode: form.movieCode === "" ? undefined : toNumberOrDefault(form.movieCode, 0),
        title: form.title,
        titleImg: {
          uz: normalizeMediaUrl(form.titleImg.uz),
          ru: normalizeMediaUrl(form.titleImg.ru),
        },
        homeImg: {
          uz: normalizeMediaUrl(form.homeImg.uz),
          ru: normalizeMediaUrl(form.homeImg.ru),
        },
        movieMedia: {
          uz: {
            img: {
              type: "img",
              src: normalizeMediaUrl(form.movieMedia?.uz?.img?.src),
            },
          },
          ru: {
            img: {
              type: "img",
              src: normalizeMediaUrl(form.movieMedia?.ru?.img?.src),
            },
          },
        },
        ratingImdb: form.ratingImdb === "" ? 0 : Number(form.ratingImdb),
        ratingKinopoisk: form.ratingKinopoisk === "" ? 0 : Number(form.ratingKinopoisk),
        ratingNetflix: form.ratingNetflix === "" ? 0 : Number(form.ratingNetflix),
        ageRestriction,
        categoryName,
        category: categoryName,
        genre: { uz: genreUz, ru: genreRu },
        description: {
          uz: {
            ...form.description.uz,
            genre: descGenreUz.length ? descGenreUz : genreUz,
          },
          ru: {
            ...form.description.ru,
            genre: descGenreRu.length ? descGenreRu : genreRu,
          },
        },
        watchVideo,
        seasons: (form.seasons || []).map((season) => ({
          ...season,
          episodes: (season?.episodes || []).map((ep) => ({
            uz: normalizeVideoSource(ep?.uz),
            ru: normalizeVideoSource(ep?.ru),
          })),
        })),
        actors: form.actors,
        typeCategory: buildTypeCategoryForSection(section, form.typeCategory),
        filterCountry: form.filterCountry,
        filterGenre: form.filterGenre,
        like: String(form.like || ""),
        dislike: String(form.dislike || ""),
        specs: {
          duration: toNumberOrDefault(form.specs.duration, 0),
          ageRating: String(
            form.specs.ageRating || (ageRestriction > 0 ? `${ageRestriction}+` : "")
          ),
          year: toNumberOrDefault(form.specs.year, 0),
          countries: form.specs.countries,
          languages: form.specs.languages,
        },
        isActive: Boolean(form.isActive),
      };
      if (mode === "edit" && onSubmitData) {
        await onSubmitData({
          ...payload,
          // Editda ID o'zgarmaydi — faqat URL bo'yicha yangilanadi
          id: toNumberOrDefault(form.movieId, 0),
          movieId: toNumberOrDefault(form.movieId, 0),
        });
      } else {
        await createMovie(payload);
      }
      onSaved?.();
    } catch (e) {
      setError(e.message || "Saqlashda xatolik.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="movie-form" ref={wrappersRef}>
      <p className="movie-form__intro">
        Quyidagi bo‘limlarni ketma-ket to‘ldiring. <span className="movie-form__req">*</span> belgisi
        majburiy maydon. O‘zbekcha (UZ) va ruscha (RU) qiymatlar sayt tiliga qarab chiqadi.
      </p>

      <Block
        step="1"
        title="Asosiy ma’lumotlar"
        help="Kino qanday nomlanishi va bot orqali qidirish kodi."
      >
        <div className="movie-form__grid">
          {mode === "edit" && form.movieId ? (
            <Field
              label="Tizim ID"
              help="Avtomatik beriladi. O‘zgartirilmaydi."
            >
              <input className="movie-form__input" value={form.movieId} readOnly disabled />
            </Field>
          ) : null}

          <Field
            label="Kino kodi (bot uchun)"
            help="Ixtiyoriy. Foydalanuvchi Telegram botga shu raqamni yuborsa shu kino chiqadi. Masalan: 100."
          >
            <input
              className="movie-form__input"
              type="number"
              placeholder="Masalan: 100"
              value={form.movieCode}
              onChange={(e) => patch({ movieCode: e.target.value })}
            />
          </Field>

          <Field
            label="Kino nomi — o‘zbekcha"
            help="Saytda o‘zbek tilida ko‘rinadigan asosiy nom."
            required
          >
            <input
              className="movie-form__input"
              placeholder="Masalan: Inception"
              value={form.title.uz}
              onChange={(e) => patch({ title: { ...form.title, uz: e.target.value } })}
            />
          </Field>

          <Field
            label="Kino nomi — ruscha"
            help="Saytda rus tilida ko‘rinadigan asosiy nom."
            required
          >
            <input
              className="movie-form__input"
              placeholder="Masalan: Начало"
              value={form.title.ru}
              onChange={(e) => patch({ title: { ...form.title, ru: e.target.value } })}
            />
          </Field>
        </div>
      </Block>

      <Block
        step="2"
        title="Rasmlar"
        help="3 xil rasm: sarlavha logosi, ro‘yxat posteri va batafsil sahifa foni. Har biri uchun UZ va RU alohida."
      >
        <div className="movie-form__upload-grid">
          {renderUploadField({
            keyName: "titleImg.uz",
            label: "Sarlavha rasmi — o‘zbekcha",
            help: "Kino nomi ustiga/yoniga chiqadigan yozuvli logo (title image).",
            accept: "image/*",
            previewUrl: form.titleImg.uz,
            onFile: (file) =>
              onPickFile(
                "titleImg.uz",
                (prev, data) => ({ ...prev, titleImg: { ...prev.titleImg, uz: data } }),
                file
              ),
          })}
          {renderUploadField({
            keyName: "titleImg.ru",
            label: "Sarlavha rasmi — ruscha",
            help: "Rus tilidagi sarlavha/logo rasmi.",
            accept: "image/*",
            previewUrl: form.titleImg.ru,
            onFile: (file) =>
              onPickFile(
                "titleImg.ru",
                (prev, data) => ({ ...prev, titleImg: { ...prev.titleImg, ru: data } }),
                file
              ),
          })}
          {renderUploadField({
            keyName: "homeImg.uz",
            label: "Asosiy poster — o‘zbekcha",
            help: "Bosh sahifa va ro‘yxatlarda chiqadigan asosiy rasm. Majburiy.",
            accept: "image/*",
            previewUrl: form.homeImg.uz,
            onFile: (file) =>
              onPickFile(
                "homeImg.uz",
                (prev, data) => ({ ...prev, homeImg: { ...prev.homeImg, uz: data } }),
                file
              ),
          })}
          {renderUploadField({
            keyName: "homeImg.ru",
            label: "Asosiy poster — ruscha",
            help: "Rus tilidagi asosiy poster. Majburiy.",
            accept: "image/*",
            previewUrl: form.homeImg.ru,
            onFile: (file) =>
              onPickFile(
                "homeImg.ru",
                (prev, data) => ({ ...prev, homeImg: { ...prev.homeImg, ru: data } }),
                file
              ),
          })}
          {renderUploadField({
            keyName: "movieMedia.uz",
            label: "Batafsil fon rasmi — o‘zbekcha",
            help: "Kino ichki sahifasidagi katta fon/detal rasmi.",
            accept: "image/*",
            previewUrl: form?.movieMedia?.uz?.img?.src,
            onFile: (file) =>
              onPickFile(
                "movieMedia.uz",
                (prev, data) => ({
                  ...prev,
                  movieMedia: {
                    ...prev.movieMedia,
                    uz: { img: { type: "img", src: data } },
                  },
                }),
                file
              ),
          })}
          {renderUploadField({
            keyName: "movieMedia.ru",
            label: "Batafsil fon rasmi — ruscha",
            help: "Rus tilidagi ichki sahifa fon rasmi.",
            accept: "image/*",
            previewUrl: form?.movieMedia?.ru?.img?.src,
            onFile: (file) =>
              onPickFile(
                "movieMedia.ru",
                (prev, data) => ({
                  ...prev,
                  movieMedia: {
                    ...prev.movieMedia,
                    ru: { img: { type: "img", src: data } },
                  },
                }),
                file
              ),
          })}
        </div>
      </Block>

      <Block
        step="3"
        title="Tomosha videosi"
        help={
          isAnons
            ? "Anons bo‘limida video ixtiyoriy. Keyin video qo‘shib boshqa bo‘limga o‘tkazishingiz mumkin."
            : "Har til uchun bitta manba: Mover/YouTube havolasi YOKI qurilmadan video fayl. Ikkalasini birga emas."
        }
      >
        <div className="movie-form__upload-grid">
          {["uz", "ru"].map((lang) => {
            const keyName = `watchVideo.${lang}`;
            const langLabel = lang === "uz" ? "o‘zbekcha" : "ruscha";

            return (
              <div className="movie-form__video-dual" key={keyName}>
                <Field
                  label={`Tomosha videosi — ${langLabel}${isAnons ? " (ixtiyoriy)" : ""}`}
                  help="Mover.uz / YouTube / VK Video URL yoki iframe kodini qo‘ying. Preview pastda chiqadi."
                >
                  <input
                    id={`watch-video-url-${lang}`}
                    className="movie-form__input"
                    type="text"
                    placeholder="mover / youtube / vkvideo.ru iframe | https://youtu.be/..."
                    value={form.watchVideo?.[lang] || ""}
                    onChange={(e) => {
                      setUpload(keyName, { uploading: false, progress: 0, fileName: "" });
                      patch({
                        watchVideo: {
                          ...form.watchVideo,
                          [lang]: e.target.value,
                        },
                      });
                    }}
                    onBlur={(e) => {
                      const normalized = normalizeVideoSource(e.target.value);
                      if (normalized === (form.watchVideo?.[lang] || "")) return;
                      patch({
                        watchVideo: {
                          ...form.watchVideo,
                          [lang]: normalized,
                        },
                      });
                    }}
                  />
                </Field>

                <VideoPreview url={form.watchVideo?.[lang]} title={`Video preview ${lang}`} />

                <p className="movie-form__video-or">yoki kompyuterdan video yuklang</p>

                {renderUploadField({
                  keyName,
                  label: `Video fayl — ${langLabel}`,
                  help: "Qurilmadan MP4 yuklansa, yuqoridagi URL o‘rniga shu fayl saqlanadi.",
                  accept: "video/*",
                  onFile: (file) =>
                    onPickFile(
                      keyName,
                      (prev, data) => ({
                        ...prev,
                        watchVideo: { ...prev.watchVideo, [lang]: data },
                      }),
                      file
                    ),
                })}
              </div>
            );
          })}
        </div>
      </Block>

      <Block
        step="4"
        title="Tavsif va ma’lumotlar"
        help="Rejissyor, matn, yil, davlat, davomiylik va janrlar. UZ va RU alohida to‘ldiring."
      >
        <div className="movie-form__lang-grid">
          {["uz", "ru"].map((lang) => {
            const langTitle = lang === "uz" ? "O‘zbekcha" : "Ruscha";
            return (
              <div className="movie-form__lang-col" key={lang}>
                <h5 className="movie-form__lang-title">{langTitle}</h5>
                <Field label="Rejissyor" help="Kinoning rejissyori.">
                  <input
                    className="movie-form__input"
                    value={form.description[lang].director}
                    onChange={(e) =>
                      patch({
                        description: {
                          ...form.description,
                          [lang]: { ...form.description[lang], director: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Qisqa tavsif" help="Kino haqida foydalanuvchiga chiqadigan matn.">
                  <textarea
                    className="movie-form__textarea"
                    rows={5}
                    value={form.description[lang].text}
                    onChange={(e) =>
                      patch({
                        description: {
                          ...form.description,
                          [lang]: { ...form.description[lang], text: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Yil" help="Chiqiqan yili, masalan 2024.">
                  <input
                    className="movie-form__input"
                    type="number"
                    value={form.description[lang].year}
                    onChange={(e) =>
                      patch({
                        description: {
                          ...form.description,
                          [lang]: {
                            ...form.description[lang],
                            year: toNumberOrDefault(e.target.value, ""),
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Davlat" help="Masalan: AQSH, Koreya, O‘zbekiston.">
                  <input
                    className="movie-form__input"
                    value={form.description[lang].country}
                    onChange={(e) =>
                      patch({
                        description: {
                          ...form.description,
                          [lang]: { ...form.description[lang], country: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Davomiylik (daqiqada)" help="Masalan: 120.">
                  <input
                    className="movie-form__input"
                    type="number"
                    value={form.description[lang].duration}
                    onChange={(e) =>
                      patch({
                        description: {
                          ...form.description,
                          [lang]: {
                            ...form.description[lang],
                            duration: toNumberOrDefault(e.target.value, ""),
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field
                  label="Saytda chiqadigan janrlar (badge)"
                  help="Detail sahifadagi “Janr:” badge’lari. Har bir janr — yangi qator (Enter). Vergul shart emas."
                >
                  <textarea
                    className="movie-form__textarea"
                    rows={3}
                    value={genreBadgeText[lang] || ""}
                    placeholder={"Komediya\nDrama\nTriller"}
                    onChange={(e) => patchBadgeGenres(lang, e.target.value)}
                  />
                </Field>
                <Field
                  label="Tavsifdagi janrlar"
                  help="Batafsil oynadagi Janr qatori. Format: Komediya, Drama. Vergul esdan chiqsa — probel avtomatik vergul qo‘yadi."
                >
                  <input
                    className="movie-form__input"
                    value={genreDescText[lang] || ""}
                    placeholder="Komediya, Drama, Triller"
                    onChange={(e) => patchDescGenres(lang, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== " ") return;
                      const el = e.currentTarget;
                      const result = insertAutoCommaOnSpace(
                        el.value,
                        el.selectionStart,
                        el.selectionEnd
                      );
                      if (!result) return;
                      e.preventDefault();
                      patchDescGenres(lang, result.nextValue);
                      requestAnimationFrame(() => {
                        el.setSelectionRange(result.nextCursor, result.nextCursor);
                      });
                    }}
                  />
                </Field>
              </div>
            );
          })}
        </div>
      </Block>

      <Block
        step="5"
        title="Serial mavsumlari (ixtiyoriy)"
        help="Oddiy film uchun bo‘sh qoldirish mumkin. Serial bo‘lsa qismlarga Mover/YouTube havolasi yoki R2 video fayl qo‘ying — asosiy tomosha videosi kabi."
      >
        {form.seasons.map((season, seasonIndex) => (
          <div className="movie-form__box" key={`season-${seasonIndex}`}>
            <div className="movie-form__box-head">
              <strong>Mavsum {season.seasonNumber}</strong>
              <button
                type="button"
                className="movie-form__mini-btn"
                onClick={() =>
                  patch({ seasons: form.seasons.filter((_, i) => i !== seasonIndex) })
                }
                disabled={form.seasons.length === 1}
              >
                O‘chirish
              </button>
            </div>
            <div className="movie-form__grid">
              <Field label="Mavsum raqami" help="1, 2, 3...">
                <input
                  className="movie-form__input"
                  type="number"
                  value={season.seasonNumber}
                  onChange={(e) =>
                    updateSeason(seasonIndex, (prev) => ({
                      ...prev,
                      seasonNumber: toNumberOrDefault(e.target.value, 1),
                    }))
                  }
                />
              </Field>
              <Field label="Mavsum nomi — o‘zbekcha">
                <input
                  className="movie-form__input"
                  value={season.title.uz}
                  onChange={(e) =>
                    updateSeason(seasonIndex, (prev) => ({
                      ...prev,
                      title: { ...prev.title, uz: e.target.value },
                    }))
                  }
                />
              </Field>
              <Field label="Mavsum nomi — ruscha">
                <input
                  className="movie-form__input"
                  value={season.title.ru}
                  onChange={(e) =>
                    updateSeason(seasonIndex, (prev) => ({
                      ...prev,
                      title: { ...prev.title, ru: e.target.value },
                    }))
                  }
                />
              </Field>
            </div>
            {season.episodes.map((ep, epIndex) => (
              <div className="movie-form__box movie-form__box--inner" key={`ep-${seasonIndex}-${epIndex}`}>
                <div className="movie-form__box-head">
                  <strong>Qism {epIndex + 1}</strong>
                  <button
                    type="button"
                    className="movie-form__mini-btn"
                    onClick={() =>
                      updateSeason(seasonIndex, (prev) => ({
                        ...prev,
                        episodes: prev.episodes.filter((_, i) => i !== epIndex),
                      }))
                    }
                    disabled={season.episodes.length === 1}
                  >
                    O‘chirish
                  </button>
                </div>
                <div className="movie-form__upload-grid">
                  {["uz", "ru"].map((lang) => {
                    const keyName = `season-${seasonIndex}-ep-${epIndex}-${lang}`;
                    const langLabel = lang === "uz" ? "o‘zbekcha" : "ruscha";
                    return (
                      <div className="movie-form__video-dual" key={keyName}>
                        <Field
                          label={`Qism videosi — ${langLabel}`}
                          help="Mover.uz / YouTube / VK Video URL yoki iframe kodini qo‘ying. Preview pastda chiqadi."
                        >
                          <input
                            className="movie-form__input"
                            type="text"
                            placeholder="mover / youtube / vkvideo.ru iframe | https://youtu.be/..."
                            value={ep[lang] || ""}
                            onChange={(e) => {
                              const nextUrl = e.target.value;
                              setUpload(keyName, {
                                uploading: false,
                                progress: 0,
                                fileName: "",
                              });
                              updateSeason(seasonIndex, (prev) => {
                                const episodes = [...prev.episodes];
                                episodes[epIndex] = {
                                  ...episodes[epIndex],
                                  [lang]: nextUrl,
                                };
                                return { ...prev, episodes };
                              });
                            }}
                            onBlur={(e) => {
                              const normalized = normalizeVideoSource(e.target.value);
                              if (normalized === (ep[lang] || "")) return;
                              updateSeason(seasonIndex, (prev) => {
                                const episodes = [...prev.episodes];
                                episodes[epIndex] = {
                                  ...episodes[epIndex],
                                  [lang]: normalized,
                                };
                                return { ...prev, episodes };
                              });
                            }}
                          />
                        </Field>

                        <VideoPreview
                          url={ep[lang]}
                          title={`Qism ${epIndex + 1} preview ${lang}`}
                        />

                        <p className="movie-form__video-or">yoki kompyuterdan video yuklang</p>

                        {renderUploadField({
                          keyName,
                          label: `Video fayl — ${langLabel}`,
                          help: "Qurilmadan MP4 yuklansa, yuqoridagi URL o‘rniga R2 havolasi saqlanadi.",
                          accept: "video/*",
                          onFile: (file) =>
                            onPickFile(
                              keyName,
                              (prev, data) => {
                                const seasons = [...prev.seasons];
                                const episodes = [...seasons[seasonIndex].episodes];
                                episodes[epIndex] = {
                                  ...episodes[epIndex],
                                  [lang]: data,
                                };
                                seasons[seasonIndex] = {
                                  ...seasons[seasonIndex],
                                  episodes,
                                };
                                return { ...prev, seasons };
                              },
                              file
                            ),
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="movie-form__mini-btn"
              onClick={() =>
                updateSeason(seasonIndex, (prev) => ({
                  ...prev,
                  episodes: [...prev.episodes, { uz: "", ru: "" }],
                }))
              }
            >
              + Qism qo‘shish
            </button>
          </div>
        ))}
        <button
          type="button"
          className="movie-form__add-btn"
          onClick={() =>
            patch({ seasons: [...form.seasons, emptySeason(form.seasons.length + 1)] })
          }
        >
          + Mavsum qo‘shish
        </button>
      </Block>

      <Block
        step="6"
        title="Bo‘lim va filtrlash"
        help="Kino qaysi bo‘limda chiqishi, qidiruv filtrlari, aktyorlar."
      >
        <div className="movie-form__grid">
          <Field
            label="Asosiy bo‘lim"
            help="Saytdagi asosiy toifa: Dorama, Anons, Jangari va hokazo."
            required
          >
            <div className="movie-form__dropdown">
              <button
                type="button"
                className="movie-form__dropdown-trigger"
                onClick={() => setCategoryNameOpen((v) => !v)}
              >
                {form.categoryName || "Bo‘limni tanlang"}
              </button>
              {categoryNameOpen && (
                <div className="movie-form__dropdown-menu">
                  {CATEGORY_NAME_OPTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`movie-form__option-btn${form.categoryName === item ? " is-active" : ""}`}
                      onClick={() => selectCategoryName(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field
            label="Davlat filtri"
            help="Filtrlash uchun kalit so‘z. Masalan: korea, usa, uzb."
          >
            <input
              className="movie-form__input"
              placeholder="Masalan: korea"
              value={form.filterCountry}
              onChange={(e) => patch({ filterCountry: e.target.value })}
            />
          </Field>

          <Field
            label="Aktyorlar"
            help="Ro‘yxatdan tegishli aktyorlarni belgilang. Qidiruv orqali tez toping."
          >
            <div className="movie-form__dropdown">
              <button
                type="button"
                className="movie-form__dropdown-trigger"
                onClick={toggleActorsOpen}
              >
                Tanlangan: {form.actors.length}
              </button>
              {actorsOpen && (
                <div className="movie-form__dropdown-menu movie-form__dropdown-menu--actors">
                  <div className="movie-form__dropdown-search">
                    <input
                      className="movie-form__input movie-form__dropdown-search-input"
                      type="search"
                      placeholder="Aktyor ismini yozing..."
                      value={actorsSearch}
                      onChange={(e) => setActorsSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="movie-form__dropdown-list">
                    {filteredActors.length ? (
                      filteredActors.map((actor) => {
                        const actorId = Number(actor.actorId || actor.id);
                        const nameUz = actor?.name?.uz || "";
                        const nameRu = actor?.name?.ru || "";
                        const name = nameUz || nameRu || `Actor ${actorId}`;
                        const secondary =
                          nameUz && nameRu && nameUz !== nameRu ? nameRu : "";
                        return (
                          <label key={actorId} className="movie-form__check">
                            <input
                              type="checkbox"
                              checked={form.actors.includes(actorId)}
                              onChange={() => toggleActor(actorId)}
                            />
                            <span className="movie-form__check-text">
                              <span>{name}</span>
                              {secondary ? (
                                <span className="movie-form__check-sub">{secondary}</span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <p className="movie-form__dropdown-empty">
                        {actorsSearch.trim()
                          ? "Mos aktyor topilmadi."
                          : "Aktyorlar ro‘yxati bo‘sh."}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Field>

          <Field
            label="Qidiruv janrlari"
            help="Searchdagi janr kartochkalarida tanlangan filter qiymatlari. Qiymat mos bo‘lsa sayt filtrida chiqadi."
          >
            <div className="movie-form__dropdown">
              <button
                type="button"
                className="movie-form__dropdown-trigger"
                onClick={() => setFilterGenreOpen((v) => !v)}
              >
                Tanlangan: {form.filterGenre.length}
              </button>
              {filterGenreOpen && (
                <div className="movie-form__dropdown-menu">
                  {qidiruvJanrOptions.length === 0 ? (
                    <p className="movie-form__hint">
                      Hali janr yo‘q. Avval Search → Janr qo‘shib, filter janrni tanlang.
                    </p>
                  ) : (
                    qidiruvJanrOptions.map((item) => (
                      <label key={item} className="movie-form__check">
                        <input
                          type="checkbox"
                          checked={form.filterGenre.includes(item)}
                          onChange={() => toggleArrayValue("filterGenre", item)}
                        />
                        <span>{item}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </Field>

          <Field
            label="Qo‘shimcha teglar"
            help="Kino bir nechta bo‘limda ko‘rinsin desangiz belgilang (masalan korea, drama)."
          >
            <div className="movie-form__dropdown">
              <button
                type="button"
                className="movie-form__dropdown-trigger"
                onClick={() => setTypeCategoryOpen((v) => !v)}
              >
                Tanlangan: {form.typeCategory.length}
              </button>
              {typeCategoryOpen && (
                <div className="movie-form__dropdown-menu">
                  {TYPE_CATEGORY_OPTIONS.map((item) => (
                    <label key={item} className="movie-form__check">
                      <input
                        type="checkbox"
                        checked={form.typeCategory.includes(item)}
                        onChange={() => toggleArrayValue("typeCategory", item)}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </Field>
        </div>
      </Block>

      <Block
        step="7"
        title="Reyting va texnik ma’lumot"
        help="IMDb / Kinopoisk / Netflix ballari, yosh chegarasi va qo‘shimcha texnik maydonlar."
      >
        <div className="movie-form__grid movie-form__grid--two">
          <Field label="IMDb reyting" help="Masalan: 8.4">
            <input
              className="movie-form__input"
              type="number"
              step="0.1"
              value={form.ratingImdb}
              onChange={(e) => patch({ ratingImdb: e.target.value })}
            />
          </Field>
          <Field label="Kinopoisk reyting" help="Masalan: 8.2">
            <input
              className="movie-form__input"
              type="number"
              step="0.1"
              value={form.ratingKinopoisk}
              onChange={(e) => patch({ ratingKinopoisk: e.target.value })}
            />
          </Field>
          <Field label="Netflix reyting" help="Masalan: 8.7">
            <input
              className="movie-form__input"
              type="number"
              step="0.1"
              value={form.ratingNetflix}
              onChange={(e) => patch({ ratingNetflix: e.target.value })}
            />
          </Field>
          <Field label="Yosh cheklovi" help="Badge uchun raqam. Masalan: 16 yoki 18 (0 ko‘rsatilmaydi).">
            <input
              className="movie-form__input"
              type="number"
              min="0"
              max="21"
              placeholder="Masalan: 16"
              value={form.ageRestriction}
              onChange={(e) => patch({ ageRestriction: e.target.value })}
            />
          </Field>
          <Field label="Like soni" help="Boshlang‘ich like qiymati (ixtiyoriy).">
            <input
              className="movie-form__input"
              value={form.like}
              onChange={(e) => patch({ like: e.target.value })}
            />
          </Field>
          <Field label="Dislike soni" help="Boshlang‘ich dislike qiymati (ixtiyoriy).">
            <input
              className="movie-form__input"
              value={form.dislike}
              onChange={(e) => patch({ dislike: e.target.value })}
            />
          </Field>
          <Field label="Texnik davomiylik (daq)" help="Specs uchun davomiylik.">
            <input
              className="movie-form__input"
              type="number"
              value={form.specs.duration}
              onChange={(e) =>
                patch({ specs: { ...form.specs, duration: e.target.value } })
              }
            />
          </Field>
          <Field label="Yosh reytingi (matn)" help="Masalan: 16+ yoki PG-13.">
            <input
              className="movie-form__input"
              value={form.specs.ageRating}
              onChange={(e) =>
                patch({ specs: { ...form.specs, ageRating: e.target.value } })
              }
            />
          </Field>
          <Field label="Specs yili" help="Texnik yil maydoni.">
            <input
              className="movie-form__input"
              type="number"
              value={form.specs.year}
              onChange={(e) => patch({ specs: { ...form.specs, year: e.target.value } })}
            />
          </Field>
          <Field label="Davlatlar (vergul bilan)" help="Masalan: AQSH, Koreya">
            <input
              className="movie-form__input"
              value={(form.specs.countries || []).join(", ")}
              onChange={(e) =>
                patch({
                  specs: { ...form.specs, countries: normalizeCommaText(e.target.value) },
                })
              }
            />
          </Field>
          <Field label="Tillar (vergul bilan)" help="Masalan: uz, ru">
            <input
              className="movie-form__input"
              value={(form.specs.languages || []).join(", ")}
              onChange={(e) =>
                patch({
                  specs: { ...form.specs, languages: normalizeCommaText(e.target.value) },
                })
              }
            />
          </Field>
        </div>
      </Block>

      {error ? <p className="movie-form__error">{error}</p> : null}
      <div className="movie-form__actions">
        <button type="button" className="movie-form__cancel-btn" onClick={onCancel}>
          Bekor qilish
        </button>
        <button
          type="button"
          className="movie-form__save-btn"
          onClick={onSubmit}
          disabled={saving || isUploading}
        >
          {saving ? "Saqlanmoqda..." : isUploading ? "Yuklanmoqda..." : "Saqlash"}
        </button>
      </div>
    </div>
  );
}
