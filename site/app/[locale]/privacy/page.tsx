import Link from 'next/link';
import { breadcrumbLd, pageMetadata } from '../../lib/seo';
import { SITE_URL } from '../../lib/site';
import { translate } from '../../i18n/config';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = translate(locale as 'en' | 'es');
  return pageMetadata({
    title: t('seo.privacyTitle'),
    description: t('seo.privacyDescription'),
    path: `/${locale}/privacy/`, imageAlt: t('seo.imageAlt'), imagePath: `/${locale}/opengraph-image`, locale: locale as 'en' | 'es', keywords: t('seo.privacyKeywords').split('|'),
  });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const language = locale as 'en' | 'es';
  const prefix = `/${locale}`;
  const t = translate(language);
  const title = t('privacy.title');
  const sections = [0, 1, 2, 3, 4, 5, 6];
  return (
    <main className="legal wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: t('privacy.lead'), url: `${SITE_URL}${prefix}/privacy/` },
        breadcrumbLd(`${prefix}/privacy/`, title),
      ]).replace(/</g, '\\u003c') }} />
      <Link className="back" href={`${prefix}/`}>← uFeed</Link>
      <h1>{title}</h1>
      <p className="legal-date">{t('privacy.date')}</p>
      <p className="legal-lead">{t('privacy.lead')}</p>
      {sections.map((index) => (
        <section key={index}>
          {t(`privacy.sections.${index}.0`) && <h2>{t(`privacy.sections.${index}.0`)}</h2>}
          {t(`privacy.sections.${index}.1`).split('\n').map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      ))}
      <p className="legal-end"><Link href={`${prefix}/terms/`}>{t('nav.terms')}</Link> · <Link href={`${prefix}/`}>{t('nav.home')}</Link></p>
    </main>
  );
}
