'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { i18n } from '../i18n/config';

const subscribe = () => () => {};
const getBrowserLocale = () => {
  const preferred = navigator.languages?.find((language) => language.toLowerCase().startsWith('es')) ?? navigator.language;
  return preferred.toLowerCase().startsWith('es') ? 'es' : 'en';
};
const getServerLocale = () => 'en';

export default function NotFound() {
  const pathname = usePathname();
  const routeLocale = pathname.match(/^\/(en|es)(?:\/|$)/)?.[1];
  const browserLocale = useSyncExternalStore(subscribe, getBrowserLocale, getServerLocale);
  const locale = routeLocale ?? browserLocale;
  const { t } = useTranslation(undefined, { i18n, lng: locale });
  return (
    <main className="legal wrap" lang={locale}>
      <h1>{t('notFound.title')}</h1>
      <p className="legal-lead">{t('notFound.description')}</p>
      <Link className="back" href={`/${locale}/`}>← {t('notFound.back')}</Link>
    </main>
  );
}
