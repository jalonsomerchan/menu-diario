import { defaultLocale, siteConfig } from '../config/site';
import { useTranslations } from '../i18n/ui';
import { getBasePath, withBasePath } from '../utils/paths';

export function GET() {
  const t = useTranslations(defaultLocale);

  const manifest = {
    name: siteConfig.name,
    short_name: 'Menu Diario',
    description: t('site.description'),
    start_url: getBasePath(),
    scope: getBasePath(),
    id: getBasePath(),
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'portrait-primary',
    background_color: '#f7f9fc',
    theme_color: '#2563f0',
    categories: ['food', 'productivity', 'lifestyle'],
    icons: [
      {
        src: withBasePath('favicon.svg'),
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
      {
        src: withBasePath('web-app-manifest-512x512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    shortcuts: [
      {
        name: t('dashboard.title'),
        short_name: t('dashboard.title'),
        url: withBasePath('dashboard'),
      },
      {
        name: t('planningAi.title'),
        short_name: t('planningAi.title'),
        url: withBasePath('planificacion'),
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
    },
  });
}
