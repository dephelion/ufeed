import Link from 'next/link';
import GitHubIcon from './GitHubIcon';
import { REPOSITORY_URL } from '../lib/site';
import { translate } from '../i18n/config';
import type { Locale } from '../i18n/resources';

export default function Footer({ locale }: { locale: Locale }) {
  const prefix = `/${locale}`;
  const t = translate(locale);
  return (
    <footer className="footer wrap">
      <Link className="brand" href={`${prefix}/`}>
        <span>uFeed</span>
      </Link>
      <p>
        ©{' '}
        <a href="https://x.com/depre_cuba" target="_blank" rel="noopener noreferrer">
          Julio Cesar Martin
        </a>{' '}
        - 2026
      </p>
      <nav aria-label={t('nav.footer')}>
        <Link href={`${prefix}/how-it-works/`}>{t('nav.how')}</Link>
        <Link href={`${prefix}/privacy/`}>{t('nav.privacy')}</Link>
        <Link href={`${prefix}/terms/`}>{t('nav.terms')}</Link>
        <a className="github-link" href={REPOSITORY_URL} aria-label={t('nav.github')}>
          <GitHubIcon size={15} /> <span>GitHub</span>
        </a>
      </nav>
    </footer>
  );
}
