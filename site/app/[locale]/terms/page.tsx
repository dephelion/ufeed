import Link from 'next/link';
import { breadcrumbLd, pageMetadata } from '../../lib/seo';
import { SITE_URL } from '../../lib/site';
import { translate } from '../../i18n/config';
import type { Locale } from '../../i18n/resources';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = translate(locale as Locale);
  return pageMetadata({
    title: t('seo.termsTitle'),
    description: t('seo.termsDescription'),
    path: `/${locale}/terms/`,
    imageAlt: t('seo.imageAlt'),
    imagePath: `/${locale}/opengraph-image.png`,
    locale: locale as Locale,
    keywords: t('seo.termsKeywords').split('|'),
  });
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const language = locale as Locale;
  const prefix = `/${locale}`;
  const t = translate(language);
  const title = t('terms.title');
  return (
    <main className="legal wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: title,
              description: t('terms.lead'),
              url: `${SITE_URL}${prefix}/terms/`,
            },
            breadcrumbLd(`${prefix}/terms/`, title),
          ]).replace(/</g, '\\u003c'),
        }}
      />
      <Link className="back" href={`${prefix}/`}>
        ← uFeed
      </Link>
      <h1>{title}</h1>
      <p className="legal-date">{t('terms.date')}</p>
      <p className="legal-lead">{t('terms.lead')}</p>
      {[0, 1, 2, 3, 4].map((index) => (
        <section key={index}>
          <h2>{t(`terms.sections.${index}.0`)}</h2>
          <p>
            {t(`terms.sections.${index}.1`)}
            {index === 3 && (
              <>
                {' '}
                <Link href={`${prefix}/privacy/`}>{t('nav.privacy')}</Link>
              </>
            )}
          </p>
        </section>
      ))}
      <p className="legal-end">
        <Link href={`${prefix}/privacy/`}>{t('nav.privacy')}</Link> ·{' '}
        <Link href={`${prefix}/`}>{t('nav.home')}</Link>
      </p>
    </main>
  );
}
