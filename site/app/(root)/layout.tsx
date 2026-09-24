import type { Metadata } from 'next';
import { SITE_URL } from '../lib/site';
import '../globals.css';

export const metadata: Metadata = {
  applicationName: 'uFeed',
  category: 'technology',
  metadataBase: new URL(SITE_URL),
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
