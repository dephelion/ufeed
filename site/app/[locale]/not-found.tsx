'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { i18n } from '../i18n/config';
import { isLocale } from '../i18n/resources';

export default function NotFound() {
  const pathname = usePathname();
  const routeCode = pathname.split('/')[1] ?? '';
  const locale = isLocale(routeCode) ? routeCode : 'en';
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
