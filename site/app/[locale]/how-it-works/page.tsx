import Link from 'next/link';
import Image from 'next/image';
import { breadcrumbLd, pageMetadata } from '../../lib/seo';
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
    title: t('seo.howTitle'),
    description: t('seo.howDescription'),
    path: `/${locale}/how-it-works/`,
    imageAlt: t('seo.imageAlt'),
    imagePath: `/${locale}/opengraph-image.png`,
    locale: locale as Locale,
    keywords: t('seo.howKeywords').split('|'),
  });
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = translate(locale as Locale);
  const prefix = `/${locale}`;
  const pageTitle = t('how.title');
  return (
    <main className="legal how-page wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'HowTo',
              name: pageTitle,
              description: t('how.lead'),
              totalTime: 'PT2M',
              step: [0, 1, 2, 3].map((index) => ({
                '@type': 'HowToStep',
                name: t(`how.steps.${index}.0`),
                text: t(`how.steps.${index}.1`),
              })),
            },
            breadcrumbLd(`${prefix}/how-it-works/`, pageTitle),
          ]).replace(/</g, '\\u003c'),
        }}
      />
      <Link className="back" href={`${prefix}/`}>
        ← uFeed
      </Link>
      <h1>{t('how.title')}</h1>
      <p className="legal-lead">{t('how.lead')}</p>

      <ol className="how-steps">
        <li>
          <span>1</span>
          <div>
            <h2>{t('how.steps.0.0')}</h2>
            <p>{t('how.steps.0.1')}</p>
            <Image
              className="how-setup-image"
              src="/extension-setup.png"
              alt={t('seo.howImageAlt')}
              width={828}
              height={1132}
              sizes="(max-width: 600px) 75vw, 340px"
            />
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <h2>{t('how.steps.1.0')}</h2>
            <p>{t('how.steps.1.1')}</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <h2>{t('how.steps.2.0')}</h2>
            <p>{t('how.steps.2.1')}</p>
          </div>
        </li>
        <li>
          <span>4</span>
          <div>
            <h2>{t('how.steps.3.0')}</h2>
            <p>{t('how.steps.3.1')}</p>
            <p className="how-note">{t('welcome.note')}</p>
          </div>
        </li>
      </ol>

      <section className="how-details">
        {[0, 1, 2].map((index) => (
          <section key={index}>
            <h2>{t(`how.details.${index}.0`)}</h2>
            <p>{t(`how.details.${index}.1`)}</p>
          </section>
        ))}
      </section>
      <p className="legal-end">
        <Link href={`${prefix}/privacy/`}>{t('nav.privacy')}</Link> ·{' '}
        <Link href={`${prefix}/`}>{t('nav.home')}</Link>
      </p>
    </main>
  );
}
