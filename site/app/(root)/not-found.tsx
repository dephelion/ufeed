'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { i18n } from '../i18n/config';
import { browserLocale as getLocale, isLocale, type Locale } from '../i18n/resources';

const subscribe = () => () => {};
const getBrowserLocale = (): Locale =>
  getLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
const getServerLocale = (): Locale => 'en';

export default function NotFound() {
  const pathname = usePathname();
  const routeCode = pathname.split('/')[1] ?? '';
  const routeLocale = isLocale(routeCode) ? routeCode : undefined;
  const browserLocale = useSyncExternalStore(
    subscribe,
    getBrowserLocale,
    getServerLocale,
  );
  const locale = routeLocale ?? browserLocale;
  const { t } = useTranslation(undefined, { i18n, lng: locale });
  return (
    <main className="legal wrap" lang={locale}>
      <h1>{t('notFound.title')}</h1>
      <p className="legal-lead">{t('notFound.description')}</p>
      <Link className="back" href={`/${locale}/`}>
        ← {t('notFound.back')}
      </Link>
    </main>
  );
}
