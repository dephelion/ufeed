import Image from 'next/image';
import Link from 'next/link';
import GitHubIcon from './GitHubIcon';
import { REPOSITORY_URL } from '../lib/site';

export default function Header({ locale }: { locale: 'en' | 'es' }) {
  const prefix = `/${locale}`;
  return (
    <header className="header wrap">
      <Link className="brand" href={`${prefix}/`} aria-label={locale === 'es' ? 'Inicio de uFeed' : 'uFeed home'}>
        <Image src="/extension-icon.png" width={32} height={32} alt="" priority />
        <span>uFeed</span>
      </Link>
      <nav aria-label={locale === 'es' ? 'Navegación principal' : 'Main navigation'}>
        <Link href={`${prefix}/how-it-works/`}>{locale === 'es' ? 'Cómo funciona' : 'How it works'}</Link>
        <Link href={`${prefix}/privacy/`}>{locale === 'es' ? 'Privacidad' : 'Privacy'}</Link>
        <a
          className="nav-github github-link"
          href={REPOSITORY_URL}
          aria-label="uFeed on GitHub"
        >
          <GitHubIcon /> <span>GitHub</span>
        </a>
        <div className="language-switch" aria-label={locale === 'es' ? 'Idioma' : 'Language'}>
          <Link href={`/en/`} aria-current={locale === 'en' ? 'page' : undefined} aria-label="English">🇬🇧</Link>
          <Link href={`/es/`} aria-current={locale === 'es' ? 'page' : undefined} aria-label="Español">🇪🇸</Link>
        </div>
      </nav>
    </header>
  );
}
