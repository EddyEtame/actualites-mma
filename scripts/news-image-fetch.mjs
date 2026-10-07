import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const input = path.resolve(option('--input', 'src/data/articles.json'));
const outDir = path.resolve(option('--out-dir', 'public/assets/editorial'));
const publicPrefix = option('--public-prefix', '/assets/editorial');
const articles = JSON.parse(await readFile(input, 'utf8'));
const selectedSlug = option('--slug', null);
const selectedArticles = selectedSlug ? articles.filter(article => article.slug === selectedSlug) : articles;
if (!selectedArticles.length) throw new Error('No articles selected for image retrieval.');
const fetchedAt = new Date().toISOString();
const known = {
  'natalia-silva-reponse-shevchenko-defense-titre-2026-10-07': {
    newsKey: 'natalia-silva-reponse-shevchenko-apres-ufc-332',
    alt: "Natalia Silva à l'UFC 332, sur la photographie publiée par MMA Fighting.",
    caption: "Natalia Silva à l'UFC 332 du 3 octobre 2026. Photographie de contexte publiée avec l'entretien.",
    credit: 'Cooper Neill / Zuffa LLC',
    creditOriginal: 'Cooper Neill/Zuffa LLC',
  },
  'one-samurai-4-isojima-abe-takeuchi-nishiyama-annonces-2026-10-07': {
    newsKey: 'one-samurai-4-isojima-abe-takeuchi-nishiyama',
    alt: "Shozo Isojima, sur la photographie de ONE Championship accompagnant l'annonce de ONE SAMURAI 4.",
    caption: "Shozo Isojima, sur une photographie de contexte publiée avec l'annonce des nouveaux combats de ONE SAMURAI 4.",
    credit: 'ONE Championship',
    creditOriginal: 'ONE Championship',
    position: 'north',
  },
  'dwcs-semaine-9-nell-ariano-lagrange-quatre-contrats-2026-10-07': {
    newsKey: 'dwcs-saison-10-semaine-9-resultats',
    alt: "Salhahuddin Everett réagit après son combat du 6 octobre 2026 au Dana White's Contender Series.",
    caption: "Salhahuddin Everett après son combat de la neuvième semaine du DWCS, le 6 octobre 2026. Photographie publiée avec les résultats officiels.",
    credit: 'UFC',
    creditOriginal: null,
  },
  'rakhmonov-morales-piste-duel-invaincus-2026-10-06': {
    newsKey: 'rakhmonov-message-duel-invaincus-morales',
    alt: "Shavkat Rakhmonov sur la photographie d'archive publiée par MMA Fighting avec son nouveau message.",
    caption: "Shavkat Rakhmonov à l'UFC 310. Photographie d'archive utilisée par MMA Fighting pour accompagner cette actualité.",
    credit: 'Steve Marcus / Getty Images',
    creditOriginal: 'Steve Marcus, Getty Images',
  },
  'ufc-allen-duncan-10-octobre-carte-enjeux-2026-10-07': {
    newsKey: 'ufc-allen-duncan-fight-night-octobre-2026-avant-combat',
    alt: "Montage photographique officiel des combattants de l'UFC Fight Night Allen–Duncan.",
    caption: "Montage officiel publié par l'UFC pour présenter la carte Allen–Duncan du 10 octobre 2026.",
    credit: 'UFC',
    creditOriginal: null,
  },
  'omalley-reponse-talbott-yan-condition-2026-10-05': {
    newsKey: 'omalley-reponse-talbott-condition-yan-dvalishvili-ufc-333',
    alt: "Sean O'Malley lors de la conférence de presse de l'UFC Freedom 250, sur la photographie publiée par MMA Fighting.",
    caption: "Sean O'Malley à la conférence de presse de l'UFC Freedom 250. Photographie d'archive accompagnant sa nouvelle réaction.",
    credit: 'Nathan Posner / Anadolu via Getty Images',
    creditOriginal: 'Nathan Posner, Anadolu via Getty Images',
  },
};

const decode = text => String(text).replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#(?:039|39);/g, "'").replace(/&#x27;/gi, "'")
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
const parseAttributes = tag => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
    .map(match => [match[1].toLowerCase(), decode(match[2])])
);
const request = async url => {
  const address = new URL(url);
  if (address.protocol !== 'https:' || address.username || address.password ||
      (address.port && address.port !== '443') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(address.hostname)) {
    throw new Error('Source image retrieval requires a public HTTPS URL.');
  }
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Actu-MMA editorial asset retrieval)', Accept: '*/*' },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
  return response;
};
const results = await Promise.all(selectedArticles.map(async article => {
  const source = article.sources?.[0];
  if (!source?.url) throw new Error('Missing original source for ' + article.slug);
  const html = await (await request(source.url)).text();
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => parseAttributes(match[0]));
  const metaValue = property => meta.find(item => item.property === property || item.name === property)?.content;
  const rawImage = metaValue('og:image') || metaValue('twitter:image');
  if (!rawImage) throw new Error('Missing source editorial image for ' + article.slug);
  const ogImageUrl = new URL(rawImage, source.url).href;
  let imageUrl = ogImageUrl;
  // Prefer a larger rendition explicitly embedded by the original publisher.
  if (new URL(source.url).hostname.endsWith('ufc.com')) {
    const fileName = new URL(ogImageUrl).pathname.split('/').pop();
    const embeddedUrls = [...html.matchAll(/https?:\/\/[^"'<>\s]+/g)]
      .map(match => decode(match[0]));
    const larger = embeddedUrls.find(url => url.includes('/background_image_xl_2x/') && url.includes(fileName));
    if (larger) imageUrl = larger;
  }
  const original = Buffer.from(await (await request(imageUrl)).arrayBuffer());
  const metadata = await sharp(original).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 250 || metadata.height < 140) {
    throw new Error('Invalid or unusable source image for ' + article.slug);
  }
  const settings = known[article.slug];
  if (settings?.creditOriginal && !decode(html).includes(settings.creditOriginal)) {
    throw new Error('Declared photo credit no longer present in source for ' + article.slug);
  }
  const imageAlt = settings?.alt || metaValue('og:image:alt') || 'Photographie publiée par ' + source.name + ' avec son article source.';
  const credit = settings?.credit || source.name;
  const caption = settings?.caption || 'Photographie de contexte publiée avec l’article source.';
  const imageSource = {
    url: imageUrl,
    ogImageUrl,
    pageUrl: source.url,
    publisher: source.name,
    credit,
    creditBasis: settings?.creditOriginal ? 'explicit-source-credit' : 'source-publisher-only',
    sourceImageAlt: metaValue('og:image:alt') || null,
    rightsStatus: 'unverified',
    fetchedAt,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
  };
  const webp = await sharp(original).rotate()
    .resize(1200, 675, { fit: 'cover', position: settings?.position || sharp.strategy.attention })
    .webp({ quality: 88 }).toBuffer();
  let optimized = webp;
  for (const quality of [80, 72, 64, 56]) {
    if (optimized.length <= 350000) break;
    optimized = await sharp(original).rotate()
      .resize(1200, 675, { fit: 'cover', position: settings?.position || sharp.strategy.attention })
      .webp({ quality }).toBuffer();
  }
  if (optimized.length > 350000) throw new Error('Source photograph cannot meet the 350 kB budget for ' + article.slug);
  return {
    slug: article.slug,
    fileName: article.slug + '.webp',
    webp: optimized,
    fields: {
      newsKey: article.newsKey || settings?.newsKey || article.slug,
      image: publicPrefix + '/' + article.slug + '.webp',
      imageAlt,
      imageCaption: caption + ' Crédit : ' + credit + ' · source : ' + source.name + '.',
      imageCredit: credit,
      imageSource,
      imageWidth: 1200,
      imageHeight: 675,
      illustration: false,
    },
  };
}));

await mkdir(outDir, { recursive: true });
for (const result of results) {
  await writeFile(path.join(outDir, result.fileName), result.webp);
}
const current = JSON.parse(await readFile(input, 'utf8'));
const updated = current.map(article => {
  const result = results.find(item => item.slug === article.slug);
  return result ? { ...article, ...result.fields } : article;
});
await writeFile(input, JSON.stringify(updated, null, 2) + '\n', 'utf8');
for (const result of results) console.log(JSON.stringify({
  slug: result.slug, image: result.fields.image,
  originalSize: [result.fields.imageSource.originalWidth, result.fields.imageSource.originalHeight],
  outputBytes: result.webp.length, source: result.fields.imageSource.url,
}));
