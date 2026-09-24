import type { Metadata } from 'next';
import LocaleRedirect from '../../components/LocaleRedirect';

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function WelcomeRedirect() {
  return <LocaleRedirect path="/welcome/" />;
}
