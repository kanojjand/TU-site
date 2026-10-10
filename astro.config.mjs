import { defineConfig } from 'astro/config';

// SITE_URL and BASE_PATH let the same build run on a custom domain or under a
// sub-path (for example GitHub Pages: BASE_PATH=/tashenev-site). On Vercel the
// production domain comes from VERCEL_PROJECT_PRODUCTION_URL when SITE_URL is unset.
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export default defineConfig({
  site: process.env.SITE_URL || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:4321'),
  base: process.env.BASE_PATH || '/',
  build: {
    format: 'directory',
  },
});
