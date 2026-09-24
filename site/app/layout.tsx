import type { Metadata } from 'next';
import Footer from './components/Footer';
import Header from './components/Header';
import { pageMetadata } from './lib/seo';
import { SITE_DESCRIPTION } from './lib/site';
import './globals.css';

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'uFeed Browser Extension | Feed Cleaner for Social Networks',
    description: SITE_DESCRIPTION,
    path: '/',
    keywords: [
      'uFeed',
      'social media feed filter',
      'private browser extension',
      'open-source browser extension',
      'on-device AI',
      'X feed filter',
      'LinkedIn feed filter',
      'Reddit feed filter',
    ],
  }),
  applicationName: 'uFeed',
  category: 'technology',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
