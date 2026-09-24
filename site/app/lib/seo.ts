import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL, SOCIAL_IMAGE } from './site';

export function pageMetadata({
  title,
  description,
  path,
  keywords,
  imageAlt = 'uFeed — a little more of what you came for',
  imagePath = SOCIAL_IMAGE,
  locale = 'en',
}: {
  title: string;
  description: string;
  path: string;
  keywords: string[];
  imageAlt?: string;
  imagePath?: string;
  locale?: 'en' | 'es';
}): Metadata {
  const image = {
    url: imagePath,
    width: 1200,
    height: 630,
    alt: imageAlt,
  };

  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: {
      canonical: path,
      languages: {
        en: path.replace(/^\/(en|es)(?=\/)/, '/en'),
        es: path.replace(/^\/(en|es)(?=\/)/, '/es'),
      },
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      type: 'website',
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    metadataBase: new URL(SITE_URL),
  };
}

export function breadcrumbLd(path: string, label: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/${path.match(/^\/(en|es)(?=\/)/)?.[1] ?? 'en'}/` },
      { '@type': 'ListItem', position: 2, name: label, item: `${SITE_URL}${path}` },
    ],
  };
}
