import Link from 'next/link';
import Image from 'next/image';
import { breadcrumbLd, pageMetadata } from '../lib/seo';
import { SITE_NAME } from '../lib/site';

const title = 'How the uFeed Browser Extension Works | a calmer social feed';
const description =
  'See how the free uFeed browser extension filters X, LinkedIn and Reddit with topics, a standalone keyword blacklist, or both. Reveal blurred posts and keep your activity private.';
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
      name: 'Choose what to keep or block',
      text: 'Write topics to keep as one subject per line, or use a keyword blacklist by itself to blur posts containing listed words or phrases.',
    },
    {
      '@type': 'HowToStep',
      name: 'Scroll as usual',
      text: 'When you use topics, posts outside them are blurred. A keyword blacklist also blurs posts containing listed words or phrases, even when they match a topic. With only a blacklist, unmatched posts stay visible.',
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
        Choose topics to keep, blacklist words or phrases, or use both. This free browser
        extension gently blurs matching posts; every post stays right where it is.
      </p>

      <ol className="how-steps">
        <li>
          <span>1</span>
          <div>
            <h2>Choose what to keep or block</h2>
            <p>
              Open the uFeed popup and choose what to filter. For topic filtering, write
              one subject per line as a short phrase of two to five words. Use words
              people use in posts—for example, “software engineering” instead of “tech.”
              Skip full sentences; commas are optional. Or use the keyword blacklist on
              its own to blur posts containing the words or phrases you list.
            </p>
            <Image
              className="how-setup-image"
              src="/extension-setup.png"
              alt="uFeed browser extension popup showing topic and blacklist settings"
              width={828}
              height={1132}
              sizes="(max-width: 600px) 75vw, 340px"
            />
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <h2>Keep scrolling</h2>
            <p>
              On X, LinkedIn, or Reddit, uFeed checks each post against your topics or
              blacklist. Topic checks happen in your browser; blacklist matches are
              checked directly against the words and phrases you listed.
            </p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <h2>See more or less of what you want</h2>
            <p>
              When you use topics, posts outside them are gently blurred. A blacklist also
              blurs posts with matching words or phrases, even when they fit your topics.
              With only a blacklist, unmatched posts stay visible. Tap a blurred post—or
              focus it and press Enter—to see it whenever you want.
            </p>
          </div>
        </li>
        <li>
          <span>4</span>
          <div>
            <h2>Make it your own</h2>
            <p>
              Adjust strictness and peek at close calls. Rate posts to help uFeed learn
              what you want to see more or less of; ratings stay on your device.
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
