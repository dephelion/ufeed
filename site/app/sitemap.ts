import type { MetadataRoute } from 'next';
import { SITE_URL } from './lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-09-24');
  return ['', 'how-it-works/', 'privacy/', 'terms/'].flatMap((path, index) =>
    ['en', 'es'].map((locale) => ({
      url: `${SITE_URL}/${locale}/${path}`,
      lastModified,
      changeFrequency: index === 0 ? 'weekly' as const : index === 1 ? 'monthly' as const : 'yearly' as const,
      priority: [1, 0.8, 0.4, 0.3][index],
      alternates: { languages: { en: `${SITE_URL}/en/${path}`, es: `${SITE_URL}/es/${path}` } },
    })),
  );
}
