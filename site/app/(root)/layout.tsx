import type { Metadata } from 'next';
import { SITE_DESCRIPTION, SITE_URL, SOCIAL_IMAGE } from '../lib/site';
import '../globals.css';

const SITE_TITLE = 'uFeed Browser Extension | Feed Cleaner for Social Networks';

export const metadata: Metadata = {
  applicationName: 'uFeed',
  category: 'technology',
  metadataBase: new URL(SITE_URL),
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: 'uFeed',
    type: 'website',
    images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630, alt: 'uFeed' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SOCIAL_IMAGE],
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
