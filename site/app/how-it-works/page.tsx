import Link from 'next/link';
import { breadcrumbLd, pageMetadata } from '../lib/seo';
import { SITE_NAME } from '../lib/site';

const title = 'How the uFeed Browser Extension Works | a calmer social feed';
const description =
  'See how the free uFeed browser extension filters X, LinkedIn and Reddit: choose topics, reveal blurred posts, adjust filtering, and keep your activity private.';
const path = '/how-it-works/';

export const metadata = pageMetadata({
  title,
  description,
  path,
  keywords: [
    'how uFeed works',
    'social feed filter guide',
    'custom topic feed filter',
    'private AI browser extension',
    'on-device feed filtering',
  ],
});

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to make your social feed feel more like yours with uFeed',
  description,
  totalTime: 'PT2M',
  step: [
    {
      '@type': 'HowToStep',
      name: 'Choose your topics',
      text: 'Write one subject per line as a short phrase of two to five words people use in posts. Avoid full sentences; commas between related words are optional.',
    },
    {
      '@type': 'HowToStep',
      name: 'Scroll as usual',
      text: 'uFeed quietly blurs posts that are outside your chosen topics.',
    },
    {
      '@type': 'HowToStep',
      name: 'Reveal or adjust',
      text: 'Tap any blurred post to reveal it, or change topics and strictness in the popup.',
    },
  ],
};

export default function HowItWorksPage() {
  return (
    <main className="legal how-page wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            howToJsonLd,
            breadcrumbLd(path, 'How it works'),
          ]).replace(/</g, '\\u003c'),
        }}
      />
      <Link className="back" href="/">
        ← {SITE_NAME}
      </Link>
      <h1>How uFeed works</h1>
      <p className="legal-lead">
        Add a few topics, and this free browser extension gently blurs posts outside them.
        Everything happens in your browser, and every post stays right where it is.
      </p>

      <ol className="how-steps">
        <li>
          <span>1</span>
          <div>
            <h2>Start with what you like</h2>
            <p>
              Open the uFeed popup and write one subject per line as a short phrase of two
              to five words. Use words people use in posts—for example, “software
              engineering” instead of “tech.” Skip full sentences. Commas between related
              words are optional.
            </p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <h2>Keep scrolling</h2>
            <p>
              When you visit X, LinkedIn, or Reddit, uFeed looks at the words in each post
              and checks how closely the subject fits your topics. That happens in your
              browser, on your device.
            </p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <h2>See more of what you came for</h2>
            <p>
              Posts that fit stay clear. Other posts are gently blurred, not hidden or
              deleted. Tap one—or focus it and press Enter—to see it whenever you want.
            </p>
          </div>
        </li>
        <li>
          <span>4</span>
          <div>
            <h2>Make it your own</h2>
            <p>
              Adjust strictness, peek at close calls, and add an optional keyword
              blacklist to further narrow posts that match your topics. It works alongside
              your chosen topics, not on its own.
            </p>
          </div>
        </li>
      </ol>

      <section className="how-details">
        <h2>🔒 Made to feel simple—and stay private</h2>
        <p>
          There is no sign-up, account, or uFeed server. The model is downloaded once and
          cached by your browser. Your topics and the posts you read are not sent to us.
          uFeed is free and open source, so you can look through the project yourself.
        </p>
        <h2>🌍 Choose the language that suits you</h2>
        <p>
          The default model works in English. If your feeds are in other languages, you
          can choose the optional multilingual model in the popup. It needs a larger
          one-time download; your topics and settings stay the same.
        </p>
        <h2>A helpful nudge, not a perfect judge</h2>
        <p>
          uFeed recognises subjects, not quality. It can blur something you would have
          liked, or leave something you would rather skip. You are always one click away
          from the full feed, and if uFeed stops working, posts remain visible.
        </p>
      </section>
      <p className="legal-end">
        <Link href="/privacy/">Read the privacy policy</Link> ·{' '}
        <Link href="/">Back to uFeed</Link>
      </p>
    </main>
  );
}
