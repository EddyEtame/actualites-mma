import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const baseUrl = 'https://prise-mma.fr';
const dataDir = resolve(process.cwd(), 'src/data');

const articles = JSON.parse(readFileSync(resolve(dataDir, 'articles.json'), 'utf8'));
const events = JSON.parse(readFileSync(resolve(dataDir, 'events.json'), 'utf8'));
const fighters = JSON.parse(readFileSync(resolve(dataDir, 'fighters.json'), 'utf8'));
const organisations = JSON.parse(readFileSync(resolve(dataDir, 'organisations.json'), 'utf8'));
const clubs = JSON.parse(readFileSync(resolve(dataDir, 'clubs.json'), 'utf8'));

const routes = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/actualites/', priority: '0.9', changefreq: 'hourly' },
  { path: '/evenements/', priority: '0.9', changefreq: 'daily' },
  { path: '/combattants/', priority: '0.8', changefreq: 'weekly' },
  { path: '/organisations/', priority: '0.8', changefreq: 'weekly' },
  { path: '/clubs/', priority: '0.9', changefreq: 'weekly' },
  { path: '/a-propos/', priority: '0.6', changefreq: 'monthly' },
];

for (const a of articles) {
  routes.push({ path: `/actualites/${a.slug}/`, priority: '0.8', changefreq: 'weekly' });
}

for (const e of events) {
  routes.push({ path: `/evenements/${e.slug}/`, priority: '0.8', changefreq: 'weekly' });
}

for (const f of fighters) {
  routes.push({ path: `/combattants/${f.slug}/`, priority: '0.7', changefreq: 'monthly' });
}

for (const o of organisations) {
  routes.push({ path: `/organisations/${o.slug}/`, priority: '0.7', changefreq: 'monthly' });
}

for (const c of clubs) {
  const prio = c.slug === 'boxing-center-etats-unis' ? '0.95' : '0.7';
  routes.push({ path: `/clubs/${c.slug}/`, priority: prio, changefreq: 'weekly' });
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(r => `  <url>
    <loc>${baseUrl}${r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

writeFileSync(resolve(process.cwd(), 'public/sitemap.xml'), sitemapXml, 'utf8');

const robotsTxt = `User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /
`;

writeFileSync(resolve(process.cwd(), 'public/robots.txt'), robotsTxt, 'utf8');

console.log(`[SEO Engine] Generated sitemap.xml with ${routes.length} validated endpoints and robots.txt!`);
