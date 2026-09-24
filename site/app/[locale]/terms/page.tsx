import Link from 'next/link';
import { breadcrumbLd, pageMetadata } from '../../lib/seo';
import { SITE_URL } from '../../lib/site';

const title = 'uFeed Browser Extension Terms | open-source license and use';
const description =
  'Terms for the free, open-source uFeed browser extension: GPL-3.0-or-later license, limitations, liability, supported social sites, and privacy.';
const path = '/terms/';

export const metadata = pageMetadata({
  title,
  description,
  path,
  keywords: [
    'uFeed terms of use',
    'uFeed open-source license',
    'GPL-3.0-or-later browser extension',
    'uFeed liability and warranty',
  ],
});

export default function TermsPage() {
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
              description,
              url: `${SITE_URL}${path}`,
            },
            breadcrumbLd(path, 'Terms of use'),
          ]).replace(/</g, '\\u003c'),
        }}
      />
      <Link className="back" href="/">
        ← uFeed
      </Link>
      <h1>Terms of use</h1>
      <p className="legal-date">Last updated 24 September 2026</p>
      <p className="legal-lead">
        uFeed is free, open-source software published under the GNU General Public
        License, version 3 or any later version (GPL-3.0-or-later). The license that comes
        with the software explains your rights to use, study, share and modify it.
      </p>
      <h2>Use and limitations</h2>
      <p>
        uFeed is provided “as is,” without warranties of any kind, to the fullest extent
        permitted by law. It uses a statistical model and can blur posts you wanted to see
        or leave visible posts you did not. Do not rely on it where missing a post could
        matter. We do not promise that it will always be available or keep working when
        social websites change.
      </p>
      <h2>Liability</h2>
      <p>
        To the fullest extent allowed by law, the uFeed contributors are not liable for
        indirect or consequential loss arising from use of the software, including content
        you missed because it was blurred. Nothing in these terms limits liability that
        cannot lawfully be limited.
      </p>
      <h2>Social websites</h2>
      <p>
        uFeed changes how X, LinkedIn and Reddit pages appear in your own browser. It is
        independent of those services and is not endorsed by them. Their names belong to
        their respective owners. Your use of each service remains subject to its own
        terms, and changes to a service may affect how uFeed works.
      </p>
      <h2>Your data</h2>
      <p>
        uFeed processes feed text on your device and sends no feed content or settings to
        us. See the <Link href="/privacy/">privacy policy</Link> for details.
      </p>
      <h2>Changes</h2>
      <p>
        These terms may be updated; the date above will change when they are. Continued
        use after an update means you accept the updated terms.
      </p>
      <p className="legal-end">
        <Link href="/privacy/">Privacy policy</Link> · <Link href="/">Back to uFeed</Link>
      </p>
    </main>
  );
}
