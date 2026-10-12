/**
 * Neighbourhood plans (1280 × 720) for clubs without a photograph we may publish, drawn from OpenStreetMap
 * data in the site's colours: streets, rails and water around the club, its own street in teal, the club
 * marked by an octagon. Run with `npm run plans` after changing a club address, then commit the images.
 * Coordinates are geocoded once (Nominatim) and stored in src/data/clubs.json as `geo`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SITE_URL } from '../src/lib/editorial.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLUBS = path.join(ROOT, 'src/data/clubs.json');
const OUT = path.join(ROOT, 'public/assets/clubs');
const FONT = path.join(ROOT, 'scripts/og-fonts/Oswald-Variable.ttf');
const W = 1280, H = 720, METRES_WIDE = 1300;
const INK = '#0B0D14', PAPER = '#F4F0E8', RED = '#D4220A', TEAL = '#11B394', MUTED = '#8A92A3';
const AGENT = `PriseMMA-ClubPlans/1.0 (+${SITE_URL}/a-propos/)`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const plain = text => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function geocode(club) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&q=${encodeURIComponent(club.address)}`;
  const [hit] = await (await fetch(url, { headers: { 'User-Agent': AGENT, 'Accept-Language': 'fr' } })).json();
  if (!hit) throw new Error(`No coordinates for ${club.address}`);
  return { lat: Number(Number(hit.lat).toFixed(6)), lon: Number(Number(hit.lon).toFixed(6)), source: 'OpenStreetMap Nominatim', matched: hit.display_name };
}

async function surroundings({ lat, lon }) {
  const radius = Math.ceil(Math.hypot(METRES_WIDE / 2, METRES_WIDE * H / W / 2)) + 20;
  const around = `(around:${radius},${lat},${lon})`;
  const query = `[out:json][timeout:60];(
    way${around}["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|service)(_link)?$"];
    way${around}["railway"~"^(rail|tram|subway|light_rail)$"];
    way${around}["waterway"~"^(river|canal)$"];
    way${around}["natural"="water"];
    way${around}["leisure"="park"];
  );out geom;`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': AGENT, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
    if (response.ok) return (await response.json()).elements.filter(element => element.geometry?.length > 1);
    await pause(4000 * (attempt + 1));
  }
  throw new Error('OpenStreetMap data unavailable');
}

function style(tags, isOwnStreet) {
  if (isOwnStreet) return { stroke: TEAL, opacity: .95, width: 4.2 };
  const highway = (tags.highway ?? '').replace(/_link$/, '');
  if (tags.railway) return { stroke: RED, opacity: .6, width: 1.8, dash: '8 6' };
  if (tags.waterway) return { stroke: '#2C7487', opacity: .6, width: 6 };
  if (['motorway', 'trunk', 'primary'].includes(highway)) return { stroke: PAPER, opacity: .62, width: 3.4 };
  if (['secondary', 'tertiary'].includes(highway)) return { stroke: PAPER, opacity: .42, width: 2.4 };
  if (highway === 'service') return { stroke: PAPER, opacity: .12, width: .9 };
  return { stroke: PAPER, opacity: .25, width: 1.4 };
}

const octagon = (cx, cy, r) => Array.from({ length: 8 }, (_, i) => {
  const angle = Math.PI / 8 + i * Math.PI / 4;
  return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
}).join(' ');

async function plan(club) {
  const { lat, lon } = club.geo;
  const scale = W / METRES_WIDE;
  const project = ([pLat, pLon]) => [W / 2 + (pLon - lon) * 111320 * Math.cos(lat * Math.PI / 180) * scale, H / 2 - (pLat - lat) * 110540 * scale];
  const street = plain(club.streetAddress.replace(/^\d+\s*(bis|ter)?\s*/i, ''));
  const elements = await surroundings(club.geo);
  const areas = [], lines = [];
  for (const element of elements) {
    const points = element.geometry.map(point => project([point.lat, point.lon]).map(value => value.toFixed(1)).join(',')).join(' ');
    if (element.tags?.leisure === 'park') areas.push(`<polygon points="${points}" fill="${TEAL}" fill-opacity=".09"/>`);
    else if (element.tags?.natural === 'water') areas.push(`<polygon points="${points}" fill="#163F4A" fill-opacity=".85"/>`);
    else {
      const own = Boolean(element.tags?.name) && plain(element.tags.name) === street;
      const s = style(element.tags ?? {}, own);
      lines.push({ own, svg: `<polyline points="${points}" fill="none" stroke="${s.stroke}" stroke-opacity="${s.opacity}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>` });
    }
  }
  const ownStreetFound = lines.some(line => line.own);
  const bar = 200 * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#1A2131"/><stop offset="1" stop-color="${INK}"/></radialGradient>
    <radialGradient id="edge" cx="50%" cy="50%" r="72%"><stop offset=".55" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity=".9"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${areas.join('')}
  ${lines.filter(line => !line.own).map(line => line.svg).join('')}
  ${lines.filter(line => line.own).map(line => line.svg).join('')}
  <rect width="${W}" height="${H}" fill="url(#edge)"/>
  <polygon points="${octagon(W / 2, H / 2, 92)}" fill="none" stroke="${RED}" stroke-opacity=".18" stroke-width="2"/>
  <polygon points="${octagon(W / 2, H / 2, 58)}" fill="${RED}" fill-opacity=".12" stroke="${RED}" stroke-opacity=".45" stroke-width="2"/>
  <polygon points="${octagon(W / 2, H / 2, 24)}" fill="${RED}" stroke="${PAPER}" stroke-width="3.5"/>
  <circle cx="${W / 2}" cy="${H / 2}" r="5" fill="${PAPER}"/>
  <g stroke="${PAPER}" stroke-opacity=".75" stroke-width="2"><line x1="40" y1="${H - 40}" x2="${40 + bar}" y2="${H - 40}"/><line x1="40" y1="${H - 47}" x2="40" y2="${H - 33}"/><line x1="${40 + bar}" y1="${H - 47}" x2="${40 + bar}" y2="${H - 33}"/></g>
</svg>`;
  const label = text => sharp({ text: { text: `<span foreground="${MUTED}" letter_spacing="1536">${text}</span>`, font: 'Oswald Medium 15', fontfile: FONT, rgba: true } }).png().toBuffer({ resolveWithObject: true });
  const [credit, metres] = await Promise.all([label('© OPENSTREETMAP'), label('200 M')]);
  const webp = await sharp(Buffer.from(svg)).composite([
    { input: credit.data, left: W - 36 - credit.info.width, top: H - 30 - credit.info.height },
    { input: metres.data, left: Math.round(40 + bar + 12), top: H - 40 - Math.round(metres.info.height / 2) },
  ]).webp({ quality: 84 }).toBuffer();
  await fs.writeFile(path.join(OUT, `${club.slug}-plan.webp`), webp);
  return { slug: club.slug, kB: Math.round(webp.length / 1024), ways: lines.length, ownStreetFound };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const clubs = JSON.parse(await fs.readFile(CLUBS, 'utf8'));
  for (const club of clubs) {
    if (club.geo) continue;
    club.geo = await geocode(club);
    console.log(`geocoded ${club.slug}: ${club.geo.lat}, ${club.geo.lon} — ${club.geo.matched}`);
    await pause(1100); // Nominatim usage policy: at most one request per second.
  }
  await fs.mkdir(OUT, { recursive: true });
  for (const club of clubs.filter(item => !item.image)) {
    const result = await plan(club);
    club.plan = `/assets/clubs/${club.slug}-plan.webp`;
    club.planAlt = `Plan du quartier de ${club.name}, ${club.address}, d'après les données OpenStreetMap.`;
    console.log(`${club.plan}  ${result.kB} kB  ${result.ways} voies${result.ownStreetFound ? '' : '  — rue du club non trouvée, vérifier l’adresse'}`);
    await pause(2000);
  }
  await fs.writeFile(CLUBS, JSON.stringify(clubs, null, 2) + '\n');
}
