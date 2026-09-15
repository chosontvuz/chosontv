const { getWebAppUrl } = require("../bot/webAppUrl");

/**
 * Yangi/yangilangan kino dan keyin qidiruv tizimlariga sitemap haqida xabar.
 * Asosiy javobni kutmaydi (fire-and-forget) — admin saqlash sekinlashmaydi.
 *
 * Eslatma: Google sitemap ping 2023 dan o'chirilgan; Bing / IndexNow ishlaydi.
 * Google Search Console sitemap ni o'zi qayta o'qiydi — GSC ga qo'lda yuborish shart emas.
 */
function notifySitemapUpdate(movieId) {
  setImmediate(() => {
    Promise.resolve()
      .then(() => pingSearchEngines(movieId))
      .catch((error) => {
        console.warn("[sitemap-notify]", error?.message || error);
      });
  });
}

async function pingSearchEngines(movieId) {
  const site = getWebAppUrl();
  const sitemapUrl = `${site}/sitemap.xml`;
  const pageUrl =
    Number.isFinite(Number(movieId)) && Number(movieId) > 0
      ? `${site}/movie/${Number(movieId)}`
      : "";

  const tasks = [];

  // Bing — sitemap ping
  tasks.push(
    fetch(
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      { method: "GET" }
    ).catch(() => null)
  );

  // IndexNow (ixtiyoriy) — INDEXNOW_KEY .env da bo'lsa
  const indexNowKey = String(process.env.INDEXNOW_KEY || "").trim();
  if (indexNowKey && pageUrl) {
    const host = new URL(site).host;
    const body = {
      host,
      key: indexNowKey,
      keyLocation: `${site}/${indexNowKey}.txt`,
      urlList: [pageUrl, sitemapUrl],
    };
    tasks.push(
      fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      }).catch(() => null)
    );
  }

  await Promise.allSettled(tasks);
}

module.exports = {
  notifySitemapUpdate,
  pingSearchEngines,
};
