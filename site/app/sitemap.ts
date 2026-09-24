import type { MetadataRoute } from 'next';
import { SITE_URL } from './lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-09-24');

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${SITE_URL}/how-it-works/`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy/`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    { url: `${SITE_URL}/terms/`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
