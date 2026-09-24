import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL, SOCIAL_IMAGE } from './site';

export function pageMetadata({
  title,
  description,
  path,
  keywords,
}: {
  title: string;
  description: string;
  path: string;
  keywords: string[];
}): Metadata {
  const image = {
    url: SOCIAL_IMAGE,
    width: 1200,
    height: 630,
    alt: 'uFeed — a little more of what you came for',
  };

  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: { canonical: path },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: 'en_US',
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
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: label, item: `${SITE_URL}${path}` },
    ],
  };
}
