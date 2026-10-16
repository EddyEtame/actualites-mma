import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { publishedArticles, SITE_URL } from '../src/lib/editorial.mjs';
const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const files = fs.readdirSync(dist, { recursive: true }).filter(file => file.endsWith('.html'));
const articles = publishedArticles(JSON.parse(fs.readFileSync(path.join(root, 'src/data/articles.json'), 'utf8')));
const titles = new Set();
const assets = new Set();
const shareImages = new Map();
for (const file of files) {
  const html = fs.readFileSync(path.join(dist, file), 'utf8');
  const route = '/' + file.replaceAll('\\', '/').replace(/index\.html$/, '');
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${route}: exactly one H1 required`);
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  assert(title && !titles.has(title), `${route}: unique title required`);
  titles.add(title);
  assert(!html.includes('prise-mma.fr') && !html.includes('localhost:') && !html.includes('127.0.0.1:'), `${route}: obsolete origin`);
  // The bare domain answers with a permanent redirect to www: no canonical, link or card may point at it.
  assert(!html.includes('https://actu-mma.com'), `${route}: redirecting bare-domain URL`);
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  assert.equal(canonical, SITE_URL + route, `${route}: canonical mismatch`);
  assert.equal(html.match(/<meta property="og:url" content="([^"]+)"/)?.[1], canonical, `${route}: og:url differs from canonical`);
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  assert(description.length >= 50 && description.length <= 160, `${route}: description must hold 50–160 characters (${description.length})`);
  // Never announce an absence to the visitor: an edition is dated, not "pending" or "archived".
  assert(!/nouvelles en attente|Archive ·/.test(html), `${route}: negative edition label`);
  // A shared link shows what this page alone says: its own photograph or its own card (npm run og).
  const shareImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? '';
  assert(shareImage.startsWith(SITE_URL + '/') && fs.existsSync(path.join(dist, decodeURIComponent(shareImage.slice(SITE_URL.length)))), `${route}: share image missing (${shareImage})`);
  assert(!shareImages.has(shareImage), `${route}: share image already used by ${shareImages.get(shareImage)}`);
  shareImages.set(shareImage, route);
  for (const script of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(script[1]);
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    let address = match[1].replaceAll('&amp;', '&');
    if (!address.startsWith('/') || address.startsWith('//')) continue;
    const [urlPath] = address.split(/[?#]/);
    let target = path.join(dist, decodeURIComponent(urlPath));
    if (urlPath.endsWith('/')) target = path.join(target, 'index.html');
    assert(fs.existsSync(target), `${route}: missing local target ${address}`);
    if (/\.(png|jpe?g|webp|svg)$/i.test(urlPath)) assets.add(urlPath);
  }
  if (route.startsWith('/actualites/') && route !== '/actualites/') {
    assert(html.includes('id="sources"') && html.includes('"citation":['), `${route}: source provenance missing`);
  }
  if (route.startsWith('/clubs/')) {
    assert(!/Guillaume|gallery-zoom|clubPhotoGallery|lightbox-overlay/.test(html), `${route}: removed boxing content returned`);
    // Other clubs are referenced, never linked: only the Boxing Center clubs (clubmma.fr, mmatoulouse.com) and the map licence credit lead out.
    for (const [, href] of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
      const host = new URL(href.replaceAll('&amp;', '&')).hostname.replace(/^www\./, '');
      assert([new URL(SITE_URL).hostname.replace(/^www\./, ''), 'clubmma.fr', 'mmatoulouse.com', 'openstreetmap.org'].includes(host), `${route}: outbound link to ${host}`);
    }
  }
}
for (const article of articles) {
  const image = fs.readFileSync(path.join(dist, article.image));
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, 'webp', `${article.slug}: optimized WebP required`);
  assert.equal(metadata.width, 1200, `${article.slug}: image width`);
  assert.equal(metadata.height, 675, `${article.slug}: image height`);
  assert(image.length <= 350_000, `${article.slug}: image exceeds 350 kB`);
  assert(article.illustration === false && article.imageSource?.pageUrl && article.imageSource?.url, `${article.slug}: source photograph provenance required`);
  const page = fs.readFileSync(path.join(dist, 'actualites', article.slug, 'index.html'), 'utf8');
  assert(page.includes(article.imageSource.pageUrl.replaceAll('&', '&amp;')) && page.includes('Source de la photo'), `${article.slug}: visible photograph source missing`);
}
const homepage = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
assert(homepage.includes(`/actualites/${articles[0].slug}/`) && homepage.includes(`<time datetime="${articles[0].sourcePublishedAt}"`), 'Newest story or its visible date missing');
assert(fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8').includes(`${SITE_URL}/sitemap.xml`), 'Robots origin mismatch');
console.log(`Build audit passed: ${files.length} pages, ${assets.size} referenced images, ${articles.length} sourced article images at 1200 × 675.`);
