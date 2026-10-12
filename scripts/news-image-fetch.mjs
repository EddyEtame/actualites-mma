import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { decodeEntities as decode } from './news-pipeline.mjs';

const known = {
  'natalia-silva-reponse-shevchenko-defense-titre': {
    newsKey: 'natalia-silva-reponse-shevchenko-apres-ufc-332',
    alt: "Natalia Silva à l'UFC 332, sur la photographie publiée par MMA Fighting.",
    caption: "Natalia Silva à l'UFC 332 du 3 octobre 2026. Photographie de contexte publiée avec l'entretien.",
    credit: 'Cooper Neill / Zuffa LLC',
    creditOriginal: 'Cooper Neill/Zuffa LLC',
  },
  'one-samurai-4-isojima-abe-takeuchi-nishiyama-annonces': {
    newsKey: 'one-samurai-4-isojima-abe-takeuchi-nishiyama',
    alt: "Shozo Isojima, sur la photographie de ONE Championship accompagnant l'annonce de ONE SAMURAI 4.",
    caption: "Shozo Isojima, sur une photographie de contexte publiée avec l'annonce des nouveaux combats de ONE SAMURAI 4.",
    credit: 'ONE Championship',
    creditOriginal: 'ONE Championship',
    position: 'north',
  },
  'dwcs-semaine-9-nell-ariano-lagrange-quatre-contrats': {
    newsKey: 'dwcs-saison-10-semaine-9-resultats',
    alt: "Salhahuddin Everett réagit après son combat du 6 octobre 2026 au Dana White's Contender Series.",
    caption: "Salhahuddin Everett après son combat de la neuvième semaine du DWCS, le 6 octobre 2026. Photographie publiée avec les résultats officiels.",
    credit: 'UFC',
    creditOriginal: null,
  },
  'rakhmonov-morales-piste-duel-invaincus': {
    newsKey: 'rakhmonov-message-duel-invaincus-morales',
    alt: "Shavkat Rakhmonov sur la photographie d'archive publiée par MMA Fighting avec son nouveau message.",
    caption: "Shavkat Rakhmonov à l'UFC 310. Photographie d'archive utilisée par MMA Fighting pour accompagner cette actualité.",
    credit: 'Steve Marcus / Getty Images',
    creditOriginal: 'Steve Marcus, Getty Images',
  },
  'ufc-allen-duncan-10-octobre-carte-enjeux': {
    newsKey: 'ufc-allen-duncan-fight-night-octobre-2026-avant-combat',
    alt: "Montage photographique officiel des combattants de l'UFC Fight Night Allen–Duncan.",
    caption: "Montage officiel publié par l'UFC pour présenter la carte Allen–Duncan du 10 octobre 2026.",
    credit: 'UFC',
    creditOriginal: null,
  },
  'omalley-reponse-talbott-yan-condition': {
    newsKey: 'omalley-reponse-talbott-condition-yan-dvalishvili-ufc-333',
    alt: "Sean O'Malley lors de la conférence de presse de l'UFC Freedom 250, sur la photographie publiée par MMA Fighting.",
    caption: "Sean O'Malley à la conférence de presse de l'UFC Freedom 250. Photographie d'archive accompagnant sa nouvelle réaction.",
    credit: 'Nathan Posner / Anadolu via Getty Images',
    creditOriginal: 'Nathan Posner, Anadolu via Getty Images',
  },
};

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

/**
 * Photograph published with an article's first source, as a 1200 × 675 WebP of at most 350 kB.
 * Reads the network only; the caller decides where (and whether) the file is written.
 * Without a slug, `fields.image` is left for the caller to set once the article is named.
 */
export async function sourcePhotograph(article, { publicPrefix = '/assets/editorial', fetchedAt = new Date().toISOString() } = {}) {
  const label = article.slug || article.sources?.[0]?.url;
  const source = article.sources?.[0];
  if (!source?.url) throw new Error('Missing original source for ' + label);
  const html = await (await request(source.url)).text();
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => parseAttributes(match[0]));
  const metaValue = property => meta.find(item => item.property === property || item.name === property)?.content;
  const rawImage = metaValue('og:image') || metaValue('twitter:image');
  if (!rawImage) throw new Error('Missing source editorial image for ' + label);
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
    throw new Error('Invalid or unusable source image for ' + label);
  }
  const settings = article.slug ? known[article.slug] : undefined;
  if (settings?.creditOriginal && !decode(html).includes(settings.creditOriginal)) {
    throw new Error('Declared photo credit no longer present in source for ' + label);
  }
  const sourceImageAlt = metaValue('og:image:alt') || metaValue('twitter:image:alt') || null;
  const imageAlt = settings?.alt || sourceImageAlt || 'Photographie publiée par ' + source.name + ' avec son article source.';
  const credit = settings?.credit || source.name;
  const caption = settings?.caption || 'Photographie publiée par ' + source.name + ' avec son article.';
  const imageSource = {
    url: imageUrl,
    ogImageUrl,
    pageUrl: source.url,
    publisher: source.name,
    credit,
    creditBasis: settings?.creditOriginal ? 'explicit-source-credit' : 'source-publisher-only',
    sourceImageAlt,
    rightsStatus: 'unverified',
    fetchedAt,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
  };
  const render = quality => sharp(original).rotate()
    .resize(1200, 675, { fit: 'cover', position: settings?.position || sharp.strategy.attention })
    .webp({ quality }).toBuffer();
  let optimized = await render(88);
  for (const quality of [80, 72, 64, 56]) {
    if (optimized.length <= 350000) break;
    optimized = await render(quality);
  }
  if (optimized.length > 350000) throw new Error('Source photograph cannot meet the 350 kB budget for ' + label);
  return {
    slug: article.slug,
    fileName: article.slug ? article.slug + '.webp' : undefined,
    webp: optimized,
    fields: {
      newsKey: article.newsKey || settings?.newsKey || article.slug,
      ...(article.slug ? { image: publicPrefix + '/' + article.slug + '.webp' } : {}),
      imageAlt,
      imageCaption: credit === source.name ? caption + ' Crédit : ' + credit + '.' : caption + ' Crédit : ' + credit + ' · source : ' + source.name + '.',
      imageCredit: credit,
      imageSource,
      imageWidth: 1200,
      imageHeight: 675,
      illustration: false,
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
  const results = await Promise.all(selectedArticles.map(article => sourcePhotograph(article, { publicPrefix, fetchedAt })));
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
}
