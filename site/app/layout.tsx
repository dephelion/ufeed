import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'uFeed — Your feed, on your terms',
  description:
    'A free, open-source browser extension that gently blurs social posts outside your interests. Private by design, with everything running on your device.',
  metadataBase: new URL('https://ufeed.github.io'),
  openGraph: {
    title: 'uFeed — Your feed, on your terms',
    description: 'A quieter social feed, shaped around what you care about.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
