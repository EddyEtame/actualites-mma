import fs from 'fs';
import path from 'path';

const sitemap = fs.readFileSync('public/sitemap.xml', 'utf8');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);

async function checkImages() {
  const missing = [];
  const checked = new Set();
  const allImages = [];

  for (const url of urls) {
    const localUrl = url.replace('https://actu-mma.com', 'http://localhost:3000');
    try {
      const res = await fetch(localUrl);
      const html = await res.text();
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const src = match[1];
        const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
        const alt = altMatch ? altMatch[1] : '';

        allImages.push({ page: url, src, alt, tag: fullTag });

        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) continue;
        if (checked.has(src)) continue;
        checked.add(src);

        const cleanSrc = src.split('?')[0].split('#')[0];
        const filePath = path.join('public', cleanSrc.startsWith('/') ? cleanSrc.slice(1) : cleanSrc);
        if (!fs.existsSync(filePath)) {
          missing.push({ page: url, img: src, expectedPath: filePath });
        }
      }
    } catch (e) {
      console.error('Fetch error on', localUrl, e.message);
    }
  }

  console.log(`Audited ${urls.length} pages.`);
  console.log(`Total image tags inspected: ${allImages.length}`);
  console.log(`Unique local images checked: ${checked.size}`);
  
  const withoutAlt = allImages.filter(img => !img.alt || img.alt.trim() === '');
  console.log(`Images missing ALT attribute: ${withoutAlt.length}`);
  if (withoutAlt.length > 0) {
    withoutAlt.forEach((w, i) => {
      console.log(`[${i+1}] ${w.page} => ${w.src} => tag: ${w.tag}`);
    });
  }

  if (missing.length === 0) {
    console.log('SUCCESS: All local images exist on disk (0 missing)!');
  } else {
    console.error(`ERROR: ${missing.length} missing images found!`);
    console.error(JSON.stringify(missing, null, 2));
  }
}

checkImages();
