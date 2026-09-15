/**
 * Qidiruv / ijtimoiy botlar — dynamic rendering (SSR o'rniga xavfsiz variant).
 * Oddiy brauzerlar bu ro'yxatga tushmaydi → SPA o'zgarishsiz ishlaydi.
 */
const SEO_BOT_UA =
  /googlebot|google-inspectiontool|bingbot|bingpreview|slurp|duckduckbot|baiduspider|yandex(bot|images)|facebot|facebookexternalhit|twitterbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest\/0\.|pinterestbot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|anthropic|discordbot|telegrambot|whatsapp|skypeuripreview|vkshare/i;

function isSeoBot(req) {
  const ua = String(req?.headers?.["user-agent"] || "");
  if (!ua) return false;
  return SEO_BOT_UA.test(ua);
}

module.exports = { isSeoBot, SEO_BOT_UA };
