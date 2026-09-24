import type { MetadataRoute } from 'next';
import { SITE_URL } from './lib/site';
import { locales } from './i18n/resources';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-09-24');
  return ['', 'how-it-works/', 'welcome/', 'privacy/', 'terms/'].flatMap((path, index) =>
    locales.map((locale) => ({
      url: `${SITE_URL}/${locale}/${path}`,
      lastModified,
      changeFrequency:
        index === 0
          ? ('weekly' as const)
          : index <= 2
            ? ('monthly' as const)
            : ('yearly' as const),
      priority: [1, 0.8, 0.7, 0.4, 0.3][index],
      alternates: {
        languages: Object.fromEntries(
          locales.map((language) => [language, `${SITE_URL}/${language}/${path}`]),
        ),
      },
    })),
  );
}
