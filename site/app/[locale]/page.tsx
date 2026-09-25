import ChromeIcon from '../components/ChromeIcon';
import FirefoxIcon from '../components/FirefoxIcon';
import {
  CHROME_STORE_URL,
  FIREFOX_STORE_URL,
  REPOSITORY_URL,
  SITE_URL,
} from '../lib/site';
import { translate } from '../i18n/config';
import type { Locale } from '../i18n/resources';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'uFeed',
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  sameAs: [REPOSITORY_URL],
};

function ReelPreview({ label }: { label: string }) {
  return (
    <div className="preview">
      <div className="preview-top">
        <i />
        <i />
        <i />
        <span>{label}</span>
      </div>
      <video
        className="preview-video"
        src="/main-video.mp4"
        aria-label={label}
        autoPlay
        controls
        loop
        muted
        playsInline
        preload="metadata"
      />
    </div>
  );
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = translate(locale as Locale);
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'uFeed',
    applicationCategory: 'BrowserApplication',
    operatingSystem: 'Chrome, Firefox',
    description: t('seo.homeDescription'),
    url: SITE_URL,
    downloadUrl: [CHROME_STORE_URL, FIREFOX_STORE_URL],
    license: 'https://www.gnu.org/licenses/gpl-3.0.html',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Person', name: 'Julio Cesar Martin' },
  };
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([softwareJsonLd, organizationJsonLd]).replace(
            /</g,
            '\\u003c',
          ),
        }}
      />

      <section className="hero wrap">
        <div className="hero-copy">
          <span className="eyebrow">
            <i /> {t('home.eyebrow')}
          </span>
          <h1>{t('home.title')}</h1>
          <p>{t('home.description')}</p>
          <div className="actions">
            <a
              className="button secondary"
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ChromeIcon /> {t('home.chrome')} <span>↗</span>
            </a>
            <a
              className="button secondary"
              href={FIREFOX_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FirefoxIcon /> {t('home.explore')} <span>↗</span>
            </a>
          </div>
        </div>
        <ReelPreview label={t('home.reel')} />
        <div className="quiet-note">
          <span>✳</span> {t('home.note')}
        </div>
      </section>

      <section className="features wrap" id="how-it-works">
        <article>
          <span className="feature-icon" aria-hidden="true">
            🧭
          </span>
          <div>
            <h2>{t('home.features.0.0')}</h2>
            <p>{t('home.features.0.1')}</p>
          </div>
        </article>
        <article>
          <span className="feature-icon" aria-hidden="true">
            🌿
          </span>
          <div>
            <h2>{t('home.features.1.0')}</h2>
            <p>{t('home.features.1.1')}</p>
          </div>
        </article>
        <article>
          <span className="feature-icon" aria-hidden="true">
            🔒
          </span>
          <div>
            <h2>{t('home.features.2.0')}</h2>
            <p>{t('home.features.2.1')}</p>
          </div>
        </article>
      </section>

      <section className="why wrap">
        <div className="section-heading">
          <span className="eyebrow">{t('home.whyEyebrow')}</span>
          <h2>{t('home.whyTitle')}</h2>
          <p>{t('home.whyLead')}</p>
        </div>
        <div className="why-grid">
          <article>
            <h3>{t('home.reasons.0.0')}</h3>
            <p>{t('home.reasons.0.1')}</p>
          </article>
          <article>
            <h3>{t('home.reasons.1.0')}</h3>
            <p>{t('home.reasons.1.1')}</p>
          </article>
          <article>
            <h3>{t('home.reasons.2.0')}</h3>
            <p>{t('home.reasons.2.1')}</p>
          </article>
          <article>
            <h3>{t('home.reasons.3.0')}</h3>
            <p>{t('home.reasons.3.1')}</p>
          </article>
          <article>
            <h3>{t('home.reasons.4.0')}</h3>
            <p>{t('home.reasons.4.1')}</p>
          </article>
          <article>
            <h3>{t('home.reasons.5.0')}</h3>
            <p>{t('home.reasons.5.1')}</p>
          </article>
        </div>
        <p className="why-note">{t('home.qualityNote')}</p>
      </section>

      <section className="closing wrap">
        <p>{t('home.closing')}</p>
        <a href={FIREFOX_STORE_URL} target="_blank" rel="noopener noreferrer">
          {t('home.store')} <span>↗</span>
        </a>
      </section>
    </main>
  );
}
