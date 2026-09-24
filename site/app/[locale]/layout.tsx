import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Footer from '../components/Footer';
import Header from '../components/Header';
import { pageMetadata } from '../lib/seo';
import I18nProvider from '../components/I18nProvider';
import { translate } from '../i18n/config';
import { isLocale, locales } from '../i18n/resources';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translate(locale);
  return pageMetadata({
    title: t('seo.homeTitle'),
    description: t('seo.homeDescription'),
    path: `/${locale}/`,
    imageAlt: t('seo.imageAlt'),
    imagePath: `/${locale}/opengraph-image.png`,
    locale,
    keywords: t('seo.homeKeywords').split('|'),
  });
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>
          <Header locale={locale} />
          <div lang={locale}>{children}</div>
          <Footer locale={locale} />
        </I18nProvider>
      </body>
    </html>
  );
}
