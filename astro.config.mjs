import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://prise-mma.fr',
  trailingSlash: 'always',
  compressHTML: true,
  build: { format: 'directory' },
  devToolbar: { enabled: false }
});
