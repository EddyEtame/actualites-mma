export const SITE_URL = 'https://actu-mma.com';
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
