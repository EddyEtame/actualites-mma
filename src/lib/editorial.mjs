// One origin and one name for every surface: pages, JSON-LD, sitemap, RSS, llms.txt and the newsroom byline.
// Vercel serves www and permanently redirects the bare domain to it.
export const SITE_URL = 'https://www.actu-mma.com';
export const SITE_NAME = 'PRISE MMA';

// Results pages show about 60 characters: a short title gains the brand, a long headline keeps its own words.
export function pageTitle(title) {
  const branded = `${title} — ${SITE_NAME}`;
  return branded.length <= 60 ? branded : title;
}

// Results pages show about 155 characters: keep whole sentences, never cut a word.
export function metaDescription(text = '', max = 158) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  let kept = '';
  for (const sentence of clean.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? []) {
    if ((kept + sentence).trim().length > max) break;
    kept += sentence;
  }
  if (kept.trim().length >= 50) return kept.trim();
  return clean.slice(0, clean.lastIndexOf(' ', max - 1)).replace(/[\s,;:–—-]+$/, '') + '…';
}
export const FRESH_WINDOW_MS = 72 * 60 * 60 * 1000;

export function sourceTime(article) {
  return Date.parse(article.sourcePublishedAt || article.publishedAt || article.date);
}

export function publishedArticles(articles, now = Date.now()) {
  return articles.filter(article => article.status === 'published' &&
    Array.isArray(article.sources) && article.sources.length > 0 &&
    Number.isFinite(sourceTime(article)) && sourceTime(article) <= now)
    .slice().sort((a, b) => sourceTime(b) - sourceTime(a) || a.slug.localeCompare(b.slug));
}

export function isFresh(article, now = Date.now()) {
  return article && sourceTime(article) <= now && now - sourceTime(article) <= FRESH_WINDOW_MS;
}

export function formatDate(date, options = {}) {
  return new Date(date).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric', ...options
  });
}

export function upcomingEvents(events, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  return events.filter(event => event.date >= day && event.sources?.length)
    .slice().sort((a, b) => a.date.localeCompare(b.date));
}
