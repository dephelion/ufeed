import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { applicationName: 'uFeed', category: 'technology' };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
