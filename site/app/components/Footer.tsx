import Link from 'next/link';
import GitHubIcon from './GitHubIcon';
import { REPOSITORY_URL } from '../lib/site';

export default function Footer({ locale }: { locale: 'en' | 'es' }) {
  const prefix = `/${locale}`;
  return (
    <footer className="footer wrap">
      <Link className="brand" href="/">
        <span>uFeed</span>
      </Link>
      <p>© Julio Cesar Martin - 2026</p>
      <nav aria-label={locale === 'es' ? 'Enlaces del pie de página' : 'Footer links'}>
        <Link href={`${prefix}/how-it-works/`}>{locale === 'es' ? 'Cómo funciona' : 'How it works'}</Link>
        <Link href={`${prefix}/privacy/`}>{locale === 'es' ? 'Privacidad' : 'Privacy'}</Link>
        <Link href={`${prefix}/terms/`}>{locale === 'es' ? 'Términos' : 'Terms'}</Link>
        <a className="github-link" href={REPOSITORY_URL} aria-label="uFeed on GitHub">
          <GitHubIcon size={15} /> <span>GitHub</span>
        </a>
      </nav>
    </footer>
  );
}
