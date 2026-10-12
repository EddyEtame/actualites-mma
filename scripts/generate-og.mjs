/**
 * Share cards (1200 × 630) for every page that has no photograph of its own: home, sections, organisations,
 * events and clubs without a picture. Articles and fighters keep their own photographs, already unique.
 * Run with `npm run og` after changing those pages, then commit public/og: CI and Vercel never render text,
 * so a font problem on a build server can never block an edition.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { formatDate } from '../src/lib/editorial.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT = path.join(ROOT, 'scripts/og-fonts/Oswald-Variable.ttf');
const OUT = path.join(ROOT, 'public/og');
const W = 1200, H = 630, PAD = 72;
const INK = '#0B0D14', PAPER = '#F4F0E8', RED = '#D4220A', TEAL = '#0B8A72', MUTED = '#A7ADBA';
const read = name => fs.readFile(path.join(ROOT, 'src/data', `${name}.json`), 'utf8').then(JSON.parse);
const escape = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const upper = text => String(text).toLocaleUpperCase('fr-FR');
const firstSentence = text => {
  const sentence = String(text).match(/^[^.!?]+[.!?]/)?.[0] ?? String(text);
  return sentence.length <= 160 ? sentence : sentence.slice(0, sentence.lastIndexOf(' ', 158)) + '…';
};

export function ogPath(key) { return `/og/${key}.jpg`; }

async function layer(markup, font, width = W - PAD * 2) {
  const { data, info } = await sharp({ text: { text: markup, font, fontfile: FONT, width, rgba: true, wrap: 'word' } })
    .png().toBuffer({ resolveWithObject: true });
  return { input: data, width: info.width, height: info.height };
}

const octagon = (cx, cy, r) => Array.from({ length: 8 }, (_, i) => {
  const angle = Math.PI / 8 + i * Math.PI / 4;
  return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
}).join(' ');

// The cage wire of the site, drawn large and quiet behind the words.
const cage = accent => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="g" cx="16%" cy="10%" r="95%"><stop offset="0" stop-color="#1B2131"/><stop offset="1" stop-color="${INK}"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <polygon points="${octagon(1020, 320, 410)}" fill="none" stroke="${accent}" stroke-opacity=".26" stroke-width="3"/>
  <polygon points="${octagon(1020, 320, 305)}" fill="none" stroke="${accent}" stroke-opacity=".14" stroke-width="2"/>
  <polygon points="${octagon(1020, 320, 200)}" fill="none" stroke="${PAPER}" stroke-opacity=".06" stroke-width="2"/>
</svg>`);

// Over a photograph, the left and the foot darken so the title reads at thumbnail size.
const shade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="${INK}" stop-opacity=".95"/><stop offset=".6" stop-color="${INK}" stop-opacity=".72"/><stop offset="1" stop-color="${INK}" stop-opacity=".3"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset=".4" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity=".85"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#l)"/><rect width="${W}" height="${H}" fill="url(#b)"/>
</svg>`);

async function card({ key, kicker, title, detail, accent = RED, photo }) {
  const size = title.length <= 28 ? 92 : title.length <= 48 ? 78 : title.length <= 72 ? 66 : 56;
  const [prise, mma, domain, kick, head, foot] = await Promise.all([
    layer(`<span foreground="${PAPER}">PRISE</span>`, 'Oswald Bold 46', 400),
    layer(`<span foreground="${RED}" letter_spacing="2048">MMA</span>`, 'Oswald SemiBold 20', 200),
    layer(`<span foreground="${MUTED}" letter_spacing="3072">ACTU-MMA.COM</span>`, 'Oswald Medium 20', 400),
    layer(`<span foreground="${accent}" letter_spacing="3072">${escape(upper(kicker))}</span>`, 'Oswald SemiBold 26'),
    // Capitals have no descenders: press leading, tight but clear of the accents above.
    layer(`<span foreground="${PAPER}" line_height="0.84">${escape(upper(title))}</span>`, `Oswald Bold ${size}`, 980),
    detail ? layer(`<span foreground="${MUTED}">${escape(detail)}</span>`, 'Oswald Regular 30', 980) : null,
  ]);
  // The block grows upward from the foot: rule, kicker, title, detail.
  const gaps = { rule: 26, kicker: 14, detail: 18 };
  const blockHeight = 8 + gaps.rule + kick.height + gaps.kicker + head.height + (foot ? gaps.detail + foot.height : 0);
  let y = H - 64 - blockHeight;
  const ruleY = y; y += 8 + gaps.rule;
  const kickY = y; y += kick.height + gaps.kicker;
  const headY = y; y += head.height + (foot ? gaps.detail : 0);
  const rule = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${PAD}" y="${ruleY}" width="112" height="8" fill="${accent}"/></svg>`);
  const base = photo
    ? sharp(await fs.readFile(path.join(ROOT, 'public', photo))).resize(W, H, { fit: 'cover', position: sharp.strategy.attention }).modulate({ brightness: .9, saturation: .85 })
    : sharp(cage(accent));
  const layers = [
    ...(photo ? [{ input: shade, left: 0, top: 0 }] : []),
    { input: rule, left: 0, top: 0 },
    { ...prise, left: PAD, top: 52 },
    { ...mma, left: PAD + prise.width + 10, top: 52 + prise.height - mma.height - 8 },
    { ...domain, left: W - PAD - domain.width, top: 66 },
    { ...kick, left: PAD, top: kickY },
    { ...head, left: PAD, top: headY },
    ...(foot ? [{ ...foot, left: PAD, top: y }] : []),
  ].map(({ input, left, top }) => ({ input, left: Math.round(left), top: Math.round(top) }));
  const jpeg = await base.composite(layers).flatten({ background: INK }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  await fs.writeFile(path.join(OUT, `${key}.jpg`), jpeg);
  return { key, bytes: jpeg.length };
}

export async function cards() {
  const [events, organisations, clubs] = await Promise.all([read('events'), read('organisations'), read('clubs')]);
  const cities = [...new Set(clubs.map(club => club.city))].join(' · ');
  return [
    { key: 'home', kicker: 'Média MMA indépendant', title: "L'actualité du MMA, vérifiée et datée", detail: 'UFC · ONE · PFL · ARES · Hexagone — en français, sources à l’appui' },
    { key: 'actualites', kicker: 'Actualités', title: 'Nouvelles MMA sourcées et datées', detail: 'Chaque article cite sa source et garde sa date' },
    { key: 'evenements', kicker: 'Calendrier', title: 'Les combats à venir', detail: 'Dates, lieux, horaires et diffusion', accent: TEAL },
    { key: 'combattants', kicker: 'Combattants', title: 'Fiches, bilans et parcours', detail: 'De l’UFC au ONE Championship' },
    { key: 'organisations', kicker: 'Organisations', title: 'UFC, ARES, Hexagone, PFL, ONE et FMMAF', detail: 'Qui organise quoi, depuis quand', accent: TEAL },
    { key: 'clubs', kicker: 'Clubs', title: 'Où pratiquer le MMA en France', detail: cities, accent: TEAL },
    { key: 'a-propos', kicker: 'À propos', title: 'Ligne éditoriale et sources', detail: 'Comment PRISE MMA vérifie et date chaque information' },
    ...organisations.map(org => ({ key: `organisations-${org.slug}`, kicker: `Organisation · depuis ${org.founded}`, title: org.name, detail: firstSentence(org.description), accent: org.accent })),
    ...clubs.filter(club => !club.image).map(club => ({ key: `clubs-${club.slug}`, kicker: `Club · ${club.city}`, title: club.name, detail: club.disciplines.slice(0, 3).join(' · '), accent: TEAL })),
    ...events.map(event => ({ key: `evenements-${event.slug}`, kicker: `${event.org} · ${formatDate(event.date, { weekday: 'long' })}`, title: event.title, detail: event.venue, accent: event.accent, photo: event.image })),
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await fs.mkdir(OUT, { recursive: true });
  const list = await cards();
  const made = [];
  for (const item of list) made.push(await card(item));
  // A page that disappeared takes its card with it.
  const keep = new Set(list.map(item => `${item.key}.jpg`));
  for (const file of await fs.readdir(OUT)) if (file.endsWith('.jpg') && !keep.has(file)) await fs.rm(path.join(OUT, file));
  for (const { key, bytes } of made) console.log(`${ogPath(key)}  ${(bytes / 1024).toFixed(0)} kB`);
}
