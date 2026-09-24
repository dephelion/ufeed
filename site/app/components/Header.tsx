import Image from 'next/image';
import Link from 'next/link';
import GitHubIcon from './GitHubIcon';
import LanguageSelect from './LanguageSelect';
import { REPOSITORY_URL } from '../lib/site';
import { translate } from '../i18n/config';
import type { Locale } from '../i18n/resources';

export default function Header({ locale }: { locale: Locale }) {
  const prefix = `/${locale}`;
  const t = translate(locale);
  return (
    <header className="header wrap">
      <Link className="brand" href={`${prefix}/`} aria-label={t('nav.home')}>
        <Image src="/extension-icon.png" width={32} height={32} alt="" priority />
        <span>uFeed</span>
      </Link>
      <nav aria-label={t('nav.main')}>
        <Link href={`${prefix}/how-it-works/`}>{t('nav.how')}</Link>
        <Link href={`${prefix}/privacy/`}>{t('nav.privacy')}</Link>
        <LanguageSelect locale={locale} />
        <a
          className="nav-github github-link"
          href={REPOSITORY_URL}
          aria-label={t('nav.github')}
        >
          <GitHubIcon /> <span>GitHub</span>
        </a>
      </nav>
    </header>
  );
}
