import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL, SOCIAL_IMAGE } from './site';
import type { Locale } from '../i18n/resources';
import { isLocale, locales } from '../i18n/resources';

export function pageMetadata({
  title,
  description,
  path,
  keywords,
  imageAlt = 'uFeed — Take back your feeds',
  imagePath = SOCIAL_IMAGE,
  locale = 'en',
}: {
  title: string;
  description: string;
  path: string;
  keywords: string[];
  imageAlt?: string;
  imagePath?: string;
  locale?: Locale;
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
      languages: Object.fromEntries(
        locales.map((language) => [
          language,
          `/${language}${path.replace(/^\/[^/]+(?=\/)/, '')}`,
        ]),
      ),
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: (
        {
          en: 'en_US',
          es: 'es_ES',
          'zh-CN': 'zh_CN',
          'zh-TW': 'zh_TW',
          fr: 'fr_FR',
          de: 'de_DE',
          ja: 'ja_JP',
          'pt-BR': 'pt_BR',
        } satisfies Record<Locale, string>
      )[locale],
      type: 'website',
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    metadataBase: new URL(SITE_URL),
  };
}

export function breadcrumbLd(path: string, label: string) {
  const routeLocale = path.split('/')[1] ?? '';
  const locale = isLocale(routeLocale) ? routeLocale : 'en';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: SITE_NAME,
        item: `${SITE_URL}/${locale}/`,
      },
      { '@type': 'ListItem', position: 2, name: label, item: `${SITE_URL}${path}` },
    ],
  };
}
