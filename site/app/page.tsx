import GitHubIcon from './components/GitHubIcon';
import ChromeIcon from './components/ChromeIcon';
import { CHROME_STORE_URL, REPOSITORY_URL, SITE_DESCRIPTION, SITE_URL } from './lib/site';

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'uFeed',
  applicationCategory: 'BrowserApplication',
  operatingSystem: 'Chrome, Firefox',
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  downloadUrl: [CHROME_STORE_URL, REPOSITORY_URL],
  license: 'https://www.gnu.org/licenses/gpl-3.0.html',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: {
    '@type': 'Person',
    name: 'Julio Cesar Martin',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'uFeed',
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  sameAs: [REPOSITORY_URL],
};

function ReelPreview() {
  return (
    <div className="preview">
      <div className="preview-top">
        <i />
        <i />
        <i />
        <span>uFeed in action</span>
      </div>
      <video
        className="preview-video"
        src="/main-video.mp4"
        aria-label="uFeed reel video"
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

export default function Home() {
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
            <i /> YOUR FEED, YOUR WAY
          </span>
          <h1>A little more of what you came for.</h1>
          <p>
            uFeed is a free browser extension that gently blurs posts outside your
            interests, so it’s easier to find the ones that are.
          </p>
          <div className="actions">
            <a
              className="button primary"
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ChromeIcon /> Add to Chrome <span>↗</span>
            </a>
            <a
              className="button secondary"
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon /> Explore the project
            </a>
          </div>
          <div className="quiet-note">
            <span>✳</span> Free, now and always · Open source · Your data stays yours
          </div>
        </div>
        <ReelPreview />
      </section>

      <section className="features wrap" id="how-it-works">
        <article>
          <span className="feature-icon" aria-hidden="true">
            🧭
          </span>
          <div>
            <h2>Choose what matters</h2>
            <p>
              Add topics you enjoy. uFeed can learn what you want to see more or less of.
            </p>
          </div>
        </article>
        <article>
          <span className="feature-icon" aria-hidden="true">
            🌿
          </span>
          <div>
            <h2>A softer scroll</h2>
            <p>
              Posts filtered by topics or keywords are gently blurred, never removed. Tap
              any post to reveal it.
            </p>
          </div>
        </article>
        <article>
          <span className="feature-icon" aria-hidden="true">
            🔒
          </span>
          <div>
            <h2>Private by design</h2>
            <p>
              Your feed stays on your device. No account, tracking, or data collection.
            </p>
          </div>
        </article>
      </section>

      <section className="why wrap">
        <div className="section-heading">
          <span className="eyebrow">A BETTER KIND OF FILTER</span>
          <h2>Why uFeed</h2>
          <p>Start with what you want more of. Let the rest fade into the background.</p>
        </div>
        <div className="why-grid">
          <article>
            <h3>🌱 Choose how to filter</h3>
            <p>
              Use topics to keep posts about subjects you care about, a keyword blacklist
              to blur matching words or phrases on its own, or both.
            </p>
          </article>
          <article>
            <h3>🛡️ Your feed stays yours</h3>
            <p>
              Posts are checked on your device. No account, analytics, or uFeed server.
              The model downloads once; your feed and topics are never sent to us.
            </p>
          </article>
          <article>
            <h3>🌍 Choose your language</h3>
            <p>
              English is ready by default. An optional multilingual model can handle posts
              in other languages, with a larger one-time download.
            </p>
          </article>
          <article>
            <h3>🎚️ Make it feel right</h3>
            <p>
              Adjust how much uFeed filters, peek at close calls, and optionally use
              thumbs to tune its suggestions on your device.
            </p>
          </article>
          <article>
            <h3>↩️ You stay in control</h3>
            <p>
              Nothing is deleted. Reveal a blurred post any time, and change your topics
              or turn uFeed off whenever you like.
            </p>
          </article>
          <article>
            <h3>💛 Open source, by choice</h3>
            <p>
              uFeed is free and open source. You can inspect how it works, suggest
              improvements, or make a version of your own.
            </p>
          </article>
        </div>
        <p className="why-note">
          uFeed sorts by subject, not quality, and it sometimes gets things wrong. A great
          post and a dull one about the same topic can both stay.
        </p>
      </section>

      <section className="closing wrap">
        <p>Less noise. More of your thing.</p>
        <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">
          Give uFeed a try <span>↗</span>
        </a>
      </section>
    </main>
  );
}
