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
for (const file of files) {
  const html = fs.readFileSync(path.join(dist, file), 'utf8');
  const route = '/' + file.replaceAll('\\', '/').replace(/index\.html$/, '');
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${route}: exactly one H1 required`);
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  assert(title && !titles.has(title), `${route}: unique title required`);
  titles.add(title);
  assert(!html.includes('prise-mma.fr') && !html.includes('localhost:') && !html.includes('127.0.0.1:'), `${route}: obsolete origin`);
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  assert.equal(canonical, SITE_URL + route, `${route}: canonical mismatch`);
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
assert(homepage.includes(`/actualites/${articles[0].slug}/`) && homepage.includes('data-news-freshness='), 'Newest story/freshness indicator missing');
assert(fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8').includes(`${SITE_URL}/sitemap.xml`), 'Robots origin mismatch');
console.log(`Build audit passed: ${files.length} pages, ${assets.size} referenced images, ${articles.length} sourced article images at 1200 × 675.`);
