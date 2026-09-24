import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Footer from '../components/Footer';
import Header from '../components/Header';
import { pageMetadata } from '../lib/seo';
import { SITE_DESCRIPTION } from '../lib/site';

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'en' && locale !== 'es') notFound();
  return pageMetadata({
    title: locale === 'es' ? 'uFeed | Una forma más tranquila de usar tus redes' : 'uFeed Browser Extension | Feed Cleaner for Social Networks',
    description: locale === 'es' ? 'Una extensión gratuita y de código abierto que difumina las publicaciones fuera de tus intereses. Privada por diseño: todo funciona en tu dispositivo.' : SITE_DESCRIPTION,
    path: `/${locale}/`,
    keywords: ['uFeed', 'social media feed filter', 'private browser extension'],
  });
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (locale !== 'en' && locale !== 'es') notFound();
  return <><Header locale={locale} /><div lang={locale}>{children}</div><Footer locale={locale} /></>;
}
