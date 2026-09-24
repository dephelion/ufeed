import Link from 'next/link';
import { pageMetadata } from '../../lib/seo';
import { translate } from '../../i18n/config';
import type { Locale } from '../../i18n/resources';
import PinTip from '../../components/PinTip';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = translate(locale as Locale);
  return {
    ...pageMetadata({
      title: t('seo.welcomeTitle'),
      description: t('seo.welcomeDescription'),
      path: `/${locale}/welcome/`,
      imageAlt: t('seo.imageAlt'),
      imagePath: `/${locale}/opengraph-image.png`,
      locale: locale as Locale,
      keywords: t('seo.welcomeKeywords').split('|'),
    }),
    robots: { index: false, follow: true },
  };
}

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = translate(locale as Locale);
  const prefix = `/${locale}`;
  return (
    <main className="welcome-page wrap">
      <section className="welcome-intro">
        <p className="eyebrow">
          <i aria-hidden="true" /> {t('welcome.eyebrow')}
        </p>
        <h1>{t('welcome.title')}</h1>
        <p className="welcome-lead">{t('welcome.lead')}</p>
      </section>

      <PinTip
        titleId="welcome-pin-title"
        kicker={t('welcome.pinKicker')}
        title={t('welcome.pinTitle')}
        description={t('welcome.pinDescription')}
        imageAlt={t('welcome.pinAnimationAlt')}
      />

      <section className="welcome-start" aria-labelledby="welcome-start-title">
        <p className="welcome-kicker">{t('welcome.stepsKicker')}</p>
        <h2 id="welcome-start-title">{t('welcome.stepsTitle')}</h2>
        <div className="welcome-steps">
          {[0, 1, 2].map((step) => (
            <article className="welcome-step" key={step}>
              <span className="welcome-step-number">{step + 1}</span>
              <h3>{t(`welcome.steps.${step}.title`)}</h3>
              <p>{t(`welcome.steps.${step}.description`)}</p>
            </article>
          ))}
        </div>
        <p className="welcome-note">{t('welcome.note')}</p>
      </section>

      <p className="welcome-more">
        <span>{t('welcome.more')}</span>
        <Link className="button secondary" href={`${prefix}/how-it-works/`}>
          {t('welcome.howLink')} <span aria-hidden="true">→</span>
        </Link>
      </p>
    </main>
  );
}
