import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOUR = 3_600_000;
const TRACKING_KEYS = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i;
const MMA = /\b(mma|ufc|pfl|ares|hexagone|octagon|octogone|mixed martial|contender series|rakhmonov|fiorot|gane|saint.denis|o.malley|oliveira|chimaev|topuria)\b/i;
const NON_MMA = /\b(boxing|boxe anglaise|zuffa boxing|jake paul|tyson fury|anthony joshua|muay thai|kickboxing|kick.boxing|grappling|wrestling|raf)\b/i;
const STOPWORDS = new Set('avec apres avant dans pour contre entre cette cet les des une un le la de du en et au aux sur son sa ses est face the and to for of at a an is as vs fight ufc mma news report reaction reactions annonce announces dit says combat combats'.split(' '));

export class NewsError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details; }
}
export async function loadConfig() {
  return JSON.parse(await fs.readFile(path.join(ROOT, 'scripts/news-sources.json'), 'utf8'));
}
export function decodeEntities(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => {
      const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/&(amp|quot|apos|lt|gt|nbsp|rsquo|lsquo|rdquo|ldquo|ndash|mdash|hellip);/g, (_, name) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' }[name]));
}
export function plainText(html = '') {
  return decodeEntities(html.replace(/<(script|style|nav|aside|footer|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|h[1-6]|div|li)>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
}
export function canonicalUrl(value) {
  const url = new URL(decodeEntities(value));
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new NewsError('UNSAFE_URL', 'Sources must use plain HTTPS URLs.');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (TRACKING_KEYS.test(key)) url.searchParams.delete(key);
  url.hostname = url.hostname.replace(/^www\./, '');
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
}
function trustedUrl(value, config) {
  canonicalUrl(value); // Validate protocol and credentials; preserve transport URL and redirects.
  const url = new URL(decodeEntities(value));
  const hostname = url.hostname.replace(/^www\./, '');
  const hosts = [...config.feeds.map(feed => feed.host), ...config.officialHosts];
  if (!hosts.some(host => hostname === host || hostname.endsWith(`.${host}`))) throw new NewsError('UNTRUSTED_SOURCE', `Source host ${url.hostname} is outside the configured MMA publishers.`);
  url.hash = '';
  return url.toString();
}
export function publicationDate(value) {
  if (typeof value !== 'string' || !value.trim() || /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  if (!/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(value.trim())) return null;
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) ? new Date(stamp).toISOString() : null;
}
export function isFresh(value, now, maxHours = 72) {
  const parsed = publicationDate(value);
  if (!parsed) return false;
  const age = new Date(now).getTime() - Date.parse(parsed);
  return age >= 0 && age <= maxHours * HOUR;
}
function xmlTag(xml, name) {
  return decodeEntities(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '').trim();
}
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([, key,, value]) => [key.toLowerCase(), decodeEntities(value)]));
}
export function parseFeed(xml, source) {
  if (!/<(?:rss|feed)\b/i.test(xml)) throw new NewsError('INVALID_FEED', `${source.name} returned no RSS/Atom feed.`);
  const blocks = xml.match(/<(?:item|entry)\b[^>]*>[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  return blocks.map(block => {
    const atomLink = [...block.matchAll(/<link\b[^>]*\/?\s*>/gi)].map(match => attributes(match[0])).find(link => !link.rel || link.rel === 'alternate');
    const url = xmlTag(block, 'link') || atomLink?.href;
    const date = xmlTag(block, 'pubDate') || xmlTag(block, 'published');
    const categories = [...block.matchAll(/<category\b[^>]*(?:\/>|>[\s\S]*?<\/category>)/gi)].map(match => attributes(match[0]).term || plainText(match[0])).join(' ');
    return { title: plainText(xmlTag(block, 'title')), url, publishedAt: publicationDate(date), source: source.name, categories };
  }).filter(item => item.url && item.title);
}
export function topicTokens(title) {
  return [...new Set(plainText(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter(word => word.length > 2 && !STOPWORDS.has(word));
}
export function sameTopic(a, b) {
  if (a.newsKey && b.newsKey && a.newsKey === b.newsKey) return true;
  const left = new Set(topicTokens(a.title)); const right = new Set(topicTokens(b.title));
  const overlap = [...left].filter(word => right.has(word)).length;
  return overlap >= 3 && overlap / Math.min(left.size || 1, right.size || 1) >= 0.7;
}
function sourceUrls(article) {
  return (article.sources ?? []).map(source => { try { return canonicalUrl(source.url); } catch { return ''; } });
}
export function duplicateOf(candidate, articles) {
  const urls = candidate.sources ? sourceUrls(candidate) : [canonicalUrl(candidate.url)];
  return articles.find(article => (candidate.slug && candidate.slug === article.slug) || sourceUrls(article).some(url => urls.includes(url)) || (article.url && urls.includes(canonicalUrl(article.url))) || sameTopic(candidate, article) || (article.sources ?? []).some(source => sameTopic(candidate, { title: source.title })));
}
async function requestText(url, config, fetchImpl = fetch) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await requestOnce(url, config, fetchImpl); }
    catch (error) {
      const retryable = !error.code || ['ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT',23].includes(error.code) || ['AbortError','TimeoutError'].includes(error.name) || (error.code === 'SOURCE_HTTP' && (error.details?.status === 429 || error.details?.status >= 500));
      if (!retryable || attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }
}
async function requestOnce(url, config, fetchImpl = fetch) {
  let current = trustedUrl(url, config);
  for (let redirect = 0; redirect <= 4; redirect++) {
    const response = await fetchImpl(current, { redirect: 'manual', signal: AbortSignal.timeout(config.requestTimeoutMs), headers: { 'User-Agent': 'ActuMMA-EditorialMonitor/1.0 (+https://actu-mma.com/methode/)', Accept: 'application/rss+xml, application/atom+xml, text/html, application/xml' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new NewsError('INVALID_REDIRECT', 'Source redirect has no location.');
      current = trustedUrl(new URL(location, current).toString(), config); continue;
    }
    if (!response.ok) throw new NewsError('SOURCE_HTTP', `Source ${new URL(current).hostname} responded HTTP ${response.status}.`, { status: response.status });
    if (Number(response.headers.get('content-length')) > 3_000_000) throw new NewsError('SOURCE_TOO_LARGE', 'Source document exceeds 3 MB.');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > 3_000_000) throw new NewsError('SOURCE_TOO_LARGE', 'Source document exceeds 3 MB.');
      chunks.push(Buffer.from(chunk));
    }
    return { body: Buffer.concat(chunks).toString('utf8'), url: current };
  }
  throw new NewsError('TOO_MANY_REDIRECTS', 'Source redirected more than four times.');
}
function graphObjects(value) {
  if (Array.isArray(value)) return value.flatMap(graphObjects);
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).filter(item => item && typeof item === 'object').flatMap(graphObjects)];
}
function elementContent(html, start) {
  const opening = html.slice(start).match(/^<([a-z][\w:-]*)\b[^>]*>/i);
  if (!opening) return '';
  const tokens = new RegExp(`<\\/?${opening[1]}\\b[^>]*>`, 'gi');
  tokens.lastIndex = start; let depth = 0; let match;
  while ((match = tokens.exec(html))) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) return html.slice(start + opening[0].length, match.index);
  }
  return '';
}
export function extractSource(html, url) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
  const meta = key => metas.find(item => item.property === key || item.name === key)?.content;
  const jsonLd = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match => {
    try { return graphObjects(JSON.parse(match[1])); } catch { return []; }
  });
  const article = jsonLd.find(item => [].concat(item['@type'] ?? []).some(type => /(?:NewsArticle|Article|BlogPosting|ReportageNewsArticle)/.test(type)));
  // Original publication only. A modified-time refresh never makes an old story new.
  const dates = [meta('article:published_time'), article?.datePublished].map(publicationDate).filter(Boolean);
  const publishedAt = dates.length ? new Date(Math.min(...dates.map(Date.parse))).toISOString() : null;
  const title = plainText(article?.headline || meta('og:title') || html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0])).find(item => item.rel === 'canonical');
  let bodyHtml = '';
  const contentTags = [...html.matchAll(/<(?:div|section|article)\b[^>]*(?:class|id)=["'][^"']*(?:primary-post-content|entry-content|wp-block-post-content|article-body|article__content|c-entry-content|c-article-body|field--name-body)[^"']*["'][^>]*>/gi)];
  for (const tag of contentTags) {
    const extracted = elementContent(html, tag.index);
    if (plainText(extracted).length > plainText(bodyHtml).length) bodyHtml = extracted;
  }
  if (!bodyHtml) { const start = html.search(/<article\b/i); if (start >= 0) bodyHtml = elementContent(html, start); }
  const paragraphHtml = bodyHtml.match(/<(?:p|h2|h3)\b[^>]*>[\s\S]*?<\/(?:p|h2|h3)>/gi) ?? [];
  const paragraphs = paragraphHtml.map(plainText).filter(text => text.length > 35 && !/^(read more|lire aussi|à lire|related|share this|sign up)/i.test(text));
  const body = article?.articleBody ? plainText(article.articleBody) : paragraphs.join('\n');
  return { url: canonicalUrl(canonicalTag?.href ? new URL(canonicalTag.href, url).toString() : url), title, publishedAt, body, bodyHash: createHash('sha256').update(body).digest('hex') };
}
export async function fetchSource(url, config, fetchImpl = fetch) {
  const response = await requestText(url, config, fetchImpl);
  const extracted = extractSource(response.body, response.url);
  trustedUrl(extracted.url, config);
  if (!extracted.publishedAt) throw new NewsError('MISSING_SOURCE_DATE', `No original publication timestamp: ${url}`);
  if (extracted.body.length < 400) throw new NewsError('MISSING_SOURCE_BODY', `No substantial article body extracted: ${url}`);
  return extracted;
}
export function scheduledSlot(now, config) {
  const elapsed = Date.parse(now) - Date.parse(config.scheduleAnchor);
  if (!Number.isFinite(elapsed)) throw new NewsError('INVALID_SCHEDULE', 'Invalid schedule anchor or current time.');
  if (elapsed < 0) return null;
  return new Date(Date.parse(config.scheduleAnchor) + Math.floor(elapsed / (config.cadenceHours * HOUR)) * config.cadenceHours * HOUR).toISOString();
}
export function batchDue(articles, now, config) {
  const slot = scheduledSlot(now, config);
  if (!slot) return { due: false, reason: 'before-first-slot', slot };
  if (articles.some(article => article.publicationBatchId === slot)) return { due: false, reason: 'slot-already-published', slot };
  const latest = articles.filter(article => publicationDate(article.publicationBatchId)).sort((a, b) => Date.parse(b.publicationBatchId) - Date.parse(a.publicationBatchId))[0];
  if (latest && Date.parse(slot) <= Date.parse(latest.publicationBatchId)) return { due: false, reason: 'latest-slot-already-published', slot };
  return { due: true, reason: 'publication-due', slot };
}
export async function discoverNews({ articles = [], config, now = new Date().toISOString(), fetchImpl = fetch } = {}) {
  config ??= await loadConfig();
  const report = { status: 'discovering', checkedAt: now, windowHours: config.maxSourceAgeHours, required: config.batchSize, ...batchDue(articles, now, config), feeds: [], candidates: [], rejected: [] };
  const feedResults = await Promise.allSettled(config.feeds.map(async feed => {
    const fetched = await requestText(feed.url, config, fetchImpl);
    return { feed, items: parseFeed(fetched.body, feed).slice(0, config.maxFeedItems) };
  }));
  const items = [];
  for (let i = 0; i < feedResults.length; i++) {
    const result = feedResults[i];
    if (result.status === 'rejected') { report.feeds.push({ name: config.feeds[i].name, ok: false, error: result.reason.message }); continue; }
    report.feeds.push({ name: result.value.feed.name, ok: true, discovered: result.value.items.length });
    items.push(...result.value.items);
  }
  if (!report.feeds.some(feed => feed.ok)) throw new NewsError('ALL_FEEDS_FAILED', 'Every source feed failed; no publication is possible.', report);
  for (const item of items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))) {
    let reason;
    if (!isFresh(item.publishedAt, now, config.maxSourceAgeHours)) reason = 'missing-stale-or-future-feed-date';
    else if (!MMA.test(`${item.title} ${item.categories}`) || NON_MMA.test(item.title)) reason = 'outside-mma-editorial-scope';
    else if (duplicateOf(item, articles) || duplicateOf(item, report.candidates)) reason = 'already-covered-source-or-topic';
    if (reason) { report.rejected.push({ url: item.url, title: item.title, reason }); continue; }
    try {
      const source = await fetchSource(item.url, config, fetchImpl);
      if (!isFresh(source.publishedAt, now, config.maxSourceAgeHours)) throw new NewsError('STALE_OR_FUTURE_SOURCE', 'Original source publication is outside the last 72 hours.');
      const candidate = { ...item, ...source, feedPublishedAt: item.publishedAt, sourcePublishedAt: source.publishedAt, retrievedAt: now };
      if (duplicateOf(candidate, articles) || duplicateOf(candidate, report.candidates)) throw new NewsError('DUPLICATE', 'Canonical source or topic already covered.');
      report.candidates.push(candidate);
      if (report.candidates.length >= config.maxCandidates) break;
    } catch (error) { report.rejected.push({ url: item.url, title: item.title, reason: error.code ?? 'source-fetch-failed', detail: error.message }); }
  }
  report.status = report.candidates.length >= config.batchSize ? 'ready-for-editorial-writing' : 'insufficient-fresh-sources';
  return report;
}
export function validateArticles(articles, { now = new Date().toISOString(), batch = false, config } = {}) {
  const errors = []; const warnings = []; const slugs = new Set();
  for (const article of articles) {
    const label = article.slug || '(missing slug)';
    if (!article.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) || slugs.has(article.slug)) errors.push(`${label}: invalid or duplicate slug`);
    slugs.add(article.slug);
    if (!article.title || !article.excerpt || !Array.isArray(article.content) || !article.content.length) errors.push(`${label}: title, excerpt and body are required`);
    if (!batch && article.category !== 'actualites' && !article.sources) continue;
    if (!article.sources?.length) { errors.push(`${label}: news has no attributed source`); continue; }
    if (!publicationDate(article.publishedAt) || Date.parse(article.publishedAt) > Date.parse(now)) errors.push(`${label}: missing or future site publication timestamp`);
    if (article.publishedAt && article.date !== article.publishedAt.slice(0, 10)) errors.push(`${label}: display date differs from real publication date`);
    if (article.updatedAt && (!publicationDate(article.updatedAt) || Date.parse(article.updatedAt) < Date.parse(article.publishedAt) || Date.parse(article.updatedAt) > Date.parse(now))) errors.push(`${label}: invalid modification date`);
    for (const source of article.sources) {
      try { canonicalUrl(source.url); } catch { errors.push(`${label}: invalid source URL`); }
      if (!source.name || !source.title || !publicationDate(source.publishedAt) || !publicationDate(source.retrievedAt)) errors.push(`${label}: source name, title, publication and retrieval timestamps required`);
      if (Date.parse(source.publishedAt) > Date.parse(now) || Date.parse(source.retrievedAt) > Date.parse(now)) errors.push(`${label}: future source metadata`);
      if (batch && !isFresh(source.publishedAt, now, config.maxSourceAgeHours)) errors.push(`${label}: source is outside the last ${config.maxSourceAgeHours} hours`);
    }
    const dates = article.sources.map(source => Date.parse(source.publishedAt));
    if (!publicationDate(article.sourcePublishedAt) || Date.parse(article.sourcePublishedAt) !== Math.min(...dates)) errors.push(`${label}: sourcePublishedAt must preserve the earliest original source publication`);
    if (batch) {
      if (!['actualites','resultats','evenements','analyses','interviews'].includes(article.category)) errors.push(`${label}: batch category must describe current MMA reporting`);
      if (!article.newsKey || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.newsKey)) errors.push(`${label}: stable newsKey required for event deduplication`);
      if (plainText(article.content.join(' ')).split(/\s+/).length < 110) errors.push(`${label}: body requires at least 110 useful words`);
      if (!article.sourceEvidence?.length || article.sourceEvidence.length < 2) errors.push(`${label}: two supporting source passages required`);
      else if (new Set(article.sourceEvidence.map(item => plainText(item.excerpt))).size !== article.sourceEvidence.length) errors.push(`${label}: supporting passages must be distinct`);
      if (new Set(sourceUrls(article)).size !== article.sources.length) errors.push(`${label}: duplicate canonical source URLs`);
      for (const source of article.sources) if (!article.sourceEvidence?.some(item => canonicalUrl(item.sourceUrl) === canonicalUrl(source.url))) errors.push(`${label}: every source must have supporting evidence`);
      if (!article.image?.startsWith('/assets/') || !article.imageAlt || article.imageWidth !== 1200 || article.imageHeight !== 675) errors.push(`${label}: image requires a local asset, descriptive alt and 1200×675 dimensions`);
      if (article.status && article.status !== 'published') errors.push(`${label}: batch status must be published`);
      if (/<(?:script|iframe|object)\b|\bon\w+\s*=|javascript:/i.test(article.content.join(' '))) errors.push(`${label}: unsafe HTML`);
    }
    if (article.sources.length === 1) warnings.push(`${label}: single source; distinguish attributed statements from confirmed outcomes`);
  }
  return { ok: errors.length === 0, checked: articles.length, errors, warnings };
}
async function atomicWrite(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, content, { flag: 'wx' }); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}
export async function publishBatch(options = {}) {
  const articlesPath = options.articlesPath ?? path.join(ROOT, 'src/data/articles.json');
  const lockPath = `${articlesPath}.news-lock`;
  let lock;
  try { lock = await fs.open(lockPath, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw new NewsError('PUBLICATION_LOCKED', 'Another publication owns the article lock. Nothing was published.');
    throw error;
  }
  try { return await publishLocked({ ...options, articlesPath }); }
  finally { await lock.close(); await fs.rm(lockPath, { force: true }); }
}
async function publishLocked({ batch, articlesPath, config, now = new Date().toISOString(), fetchImpl = fetch, dryRun = false }) {
  config ??= await loadConfig();
  if (!Array.isArray(batch) || batch.length !== config.batchSize) throw new NewsError('WRONG_BATCH_SIZE', `Exactly ${config.batchSize} articles required. Nothing was published.`);
  const original = await fs.readFile(articlesPath, 'utf8'); const existing = JSON.parse(original);
  const due = batchDue(existing, now, config);
  if (!due.due) throw new NewsError('NOT_DUE', `Publication skipped: ${due.reason}. Nothing was published.`);
  const validation = validateArticles(batch, { now, batch: true, config });
  if (!validation.ok) throw new NewsError('INVALID_BATCH', validation.errors.join('\n'));
  const seen = [...existing]; const prepared = []; const sourceCache = new Map();
  for (const article of batch) {
    if (duplicateOf(article, seen)) throw new NewsError('DUPLICATE_BATCH', `Source, topic, newsKey or slug already published: ${article.slug}. Nothing was published.`);
    for (const source of article.sources) {
      const key = trustedUrl(source.url, config);
      if (!sourceCache.has(key)) sourceCache.set(key, await fetchSource(key, config, fetchImpl));
      const fetched = sourceCache.get(key);
      if (!isFresh(fetched.publishedAt, now, config.maxSourceAgeHours)) throw new NewsError('STALE_OR_FUTURE_SOURCE', `Original source outside the last 72 hours: ${source.url}`);
      if (Date.parse(fetched.publishedAt) !== Date.parse(source.publishedAt)) throw new NewsError('SOURCE_DATE_MISMATCH', `Original timestamp differs from supplied metadata: ${source.url}`);
      for (const evidence of article.sourceEvidence.filter(item => canonicalUrl(item.sourceUrl) === canonicalUrl(source.url))) {
        if (plainText(evidence.excerpt).length < 25 || !plainText(fetched.body).includes(plainText(evidence.excerpt))) throw new NewsError('UNSUPPORTED_EVIDENCE', `Supporting passage absent from fetched source: ${article.slug}`);
      }
    }
    if (article.sourceEvidence.some(item => !sourceUrls(article).includes(canonicalUrl(item.sourceUrl)))) throw new NewsError('UNATTRIBUTED_EVIDENCE', `Evidence references an unlisted source: ${article.slug}`);
    const sourceFacts = article.sources.map(source => ({ ...source, url: canonicalUrl(source.url), retrievedAt: now, bodyHash: sourceCache.get(trustedUrl(source.url, config)).bodyHash }));
    // Evidence fingerprints retain auditability without publishing copied source passages.
    const { sourceEvidence, updatedAt, ...publicArticle } = article;
    const published = { ...publicArticle, status: 'published', verifiedAt: now, sources: sourceFacts, publishedAt: now, date: now.slice(0, 10), sourcePublishedAt: new Date(Math.min(...sourceFacts.map(source => Date.parse(source.publishedAt)))).toISOString(), publicationBatchId: due.slot, evidenceHashes: sourceEvidence.map(item => ({ sourceUrl: canonicalUrl(item.sourceUrl), sha256: createHash('sha256').update(plainText(item.excerpt)).digest('hex') })) };
    prepared.push(published); seen.push(published);
  }
  // Existing dates are preserved, and concurrent editorial changes prevent replacement.
  if (await fs.readFile(articlesPath, 'utf8') !== original) throw new NewsError('CONCURRENT_EDIT', 'Article data changed during verification. Nothing was published; retry with latest data.');
  if (!dryRun) await atomicWrite(articlesPath, `${JSON.stringify([...prepared, ...existing], null, 2)}\n`);
  return { status: dryRun ? 'validated-for-publication' : 'published-locally', published: dryRun ? 0 : prepared.length, validated: prepared.length, slot: due.slot, slugs: prepared.map(article => article.slug) };
}
export async function runNewsCli(args = []) {
  const config = await loadConfig();
  const articlesPath = path.join(ROOT, 'src/data/articles.json');
  const articles = JSON.parse(await fs.readFile(articlesPath, 'utf8')); const now = new Date().toISOString();
  const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  if (args.includes('--help')) {
    console.log('Usage: node scripts/ai-wired-crawler.mjs [--discover] [--scheduled] [--report FILE]\n       --validate [--verify-live]\n       --publish-batch FILE [--dry-run]\nCloud writer: node scripts/cloud-news-edition.mjs\nDiscovery never publishes. Publication requires exactly six sourced, evidence-checked French articles.'); return;
  }
  if (args.includes('--validate')) {
    const result = validateArticles(articles, { now, config }); console.log(JSON.stringify(result, null, 2));
    if (!result.ok) throw new NewsError('INVALID_PUBLISHED_DATA', `${result.errors.length} news provenance errors.`);
    if (args.includes('--verify-live')) {
      const latestBatch = articles.find(article => article.publicationBatchId)?.publicationBatchId;
      const current = latestBatch ? articles.filter(article => article.publicationBatchId === latestBatch) : articles.slice(0, config.batchSize);
      if (current.length !== config.batchSize) throw new NewsError('INCOMPLETE_LATEST_BATCH', 'Latest edition must contain exactly six articles.');
      for (const article of current) {
        for (const source of article.sources) {
          const fetched = await fetchSource(source.url, config);
          if (!isFresh(fetched.publishedAt, now, config.maxSourceAgeHours)) throw new NewsError('STALE_OR_FUTURE_SOURCE', `Latest article source is outside the freshness window: ${article.slug}`);
          if (Date.parse(fetched.publishedAt) !== Date.parse(source.publishedAt)) throw new NewsError('SOURCE_DATE_MISMATCH', `Source publication timestamp differs: ${article.slug}`);
          for (const evidence of (article.sourceEvidence ?? []).filter(item => canonicalUrl(item.sourceUrl) === canonicalUrl(source.url))) {
            if (!plainText(fetched.body).includes(plainText(evidence.excerpt))) throw new NewsError('UNSUPPORTED_EVIDENCE', `Supporting passage absent from fetched body: ${article.slug}`);
          }
        }
      }
      console.log(JSON.stringify({ status: 'latest-six-live-verified', checked: current.length, checkedAt: now }));
    }
    return result;
  }
  if (args.includes('--publish-batch')) {
    const batchFile = option('--publish-batch');
    if (!batchFile || batchFile.startsWith('--')) throw new NewsError('MISSING_BATCH', '--publish-batch requires a JSON file with exactly six articles.');
    const result = await publishBatch({ batch: JSON.parse(await fs.readFile(path.resolve(batchFile), 'utf8')), articlesPath, config, now, dryRun: args.includes('--dry-run') });
    console.log(JSON.stringify(result, null, 2)); return result;
  }
  const due = batchDue(articles, now, config);
  if (args.includes('--scheduled') && !due.due) { console.log(JSON.stringify({ status: 'not-due', ...due })); return due; }
  const report = await discoverNews({ articles, config, now });
  const reportPath = path.resolve(option('--report') || path.join(ROOT, '.news/discovery.json'));
  await atomicWrite(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, checkedAt: report.checkedAt, freshCandidates: report.candidates.length, required: config.batchSize, reportPath, feeds: report.feeds, publication: 'none; editorial writing and evidence validation required' }, null, 2));
  if (report.candidates.length < config.batchSize) throw new NewsError('INSUFFICIENT_FRESH_NEWS', `Only ${report.candidates.length}/${config.batchSize} new verified MMA sources. Nothing was published.`);
  return report;
}
