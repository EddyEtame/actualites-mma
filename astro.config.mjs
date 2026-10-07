import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://actu-mma.com',
  trailingSlash: 'always',
  compressHTML: true,
  build: { format: 'directory' },
  devToolbar: { enabled: false }
});
