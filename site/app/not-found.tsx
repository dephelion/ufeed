import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page not found | uFeed',
  description: 'That uFeed page could not be found. Return to the home page.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="legal wrap">
      <h1>We couldn’t find that page.</h1>
      <p className="legal-lead">
        The address may have changed, but your feed is still right where you left it.
      </p>
      <Link className="back" href="/">
        ← Back to uFeed
      </Link>
    </main>
  );
}
