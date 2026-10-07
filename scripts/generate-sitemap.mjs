import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SITE_URL, publishedArticles } from '../src/lib/editorial.mjs';
const root = resolve(import.meta.dirname, '..');
const read = name => JSON.parse(readFileSync(resolve(root, 'src/data', `${name}.json`), 'utf8'));
const xml = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const articles = publishedArticles(read('articles'));
const groups = { evenements:read('events'), combattants:read('fighters'), organisations:read('organisations'), clubs:read('clubs') };
const newest = articles.reduce((value, a) => (a.updatedAt || a.publishedAt || a.date) > value ? (a.updatedAt || a.publishedAt || a.date) : value, '');
const routes = [
  { path:'/', lastmod:newest }, { path:'/actualites/', lastmod:newest },
  ...Object.keys(groups).map(key => ({ path:`/${key}/` })), { path:'/a-propos/' },
  ...articles.map(a => ({ path:`/actualites/${a.slug}/`, lastmod:a.updatedAt || a.publishedAt || a.date })),
  ...Object.entries(groups).flatMap(([key, rows]) => rows.map(row => ({ path:`/${key}/${row.slug}/`, lastmod:row.updatedAt })))
];
writeFileSync(resolve(root, 'public/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(r => `  <url><loc>${xml(SITE_URL + r.path)}</loc>${r.lastmod ? `<lastmod>${xml(r.lastmod)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`);
writeFileSync(resolve(root, 'public/robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
writeFileSync(resolve(root, 'public/llms.txt'), `# PRISE MMA — actu-mma.com\n\n> Actualités MMA en français. Informations vérifiées, sources citées et dates visibles.\n\n## Informations récentes\n${articles.slice(0,24).map(a => `- [${a.title}](${SITE_URL}/actualites/${a.slug}/): information originale du ${a.sourcePublishedAt}; publication ${a.publishedAt}. Sources: ${a.sources.map(s => s.url).join(', ')}`).join('\n')}\n\n## Rubriques\n${Object.keys(groups).map(key => `- [${key}](${SITE_URL}/${key}/)`).join('\n')}\n- [Informations vérifiées](${SITE_URL}/a-propos/#sources)\n- [Flux RSS](${SITE_URL}/rss.xml)\n\n## Informations vérifiées\nChaque article cite ses sources et conserve sa date.\n`);
writeFileSync(resolve(root, 'public/rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>PRISE MMA — Actualités MMA</title><link>${SITE_URL}/</link><description>Nouvelles MMA sourcées et datées</description><language>fr</language>${articles.slice(0,40).map(a => `<item><title>${xml(a.title)}</title><link>${SITE_URL}/actualites/${xml(a.slug)}/</link><guid isPermaLink="true">${SITE_URL}/actualites/${xml(a.slug)}/</guid><pubDate>${new Date(a.publishedAt || a.date).toUTCString()}</pubDate><description>${xml(a.excerpt)}</description></item>`).join('')}</channel></rss>\n`);
console.log(`Discovery: ${routes.length} canonical routes; sourced RSS and llms.txt generated.`);
