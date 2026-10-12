import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/lib/editorial.mjs';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  compressHTML: true,
  build: { format: 'directory' },
  devToolbar: { enabled: false }
});
