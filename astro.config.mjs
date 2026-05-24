// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import { assertRequiredFirebasePublicEnv } from './src/config/firebase-public-env.mjs';

const env = {
  ...loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), ''),
  ...process.env,
};
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'menu-diario';
const site = env.ASTRO_SITE || `https://${process.env.GITHUB_REPOSITORY_OWNER ?? 'jalonsomerchan'}.github.io`;
const base = env.ASTRO_BASE || (process.env.GITHUB_ACTIONS ? `/${repositoryName}` : '/');
const isBuildCommand = process.argv.some((argument) => argument.includes('build'));

if (isBuildCommand) {
  assertRequiredFirebasePublicEnv(env);
}

// https://astro.build/config
export default defineConfig({
  site,
  base,

  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [mdx(), sitemap(), icon()],
});
