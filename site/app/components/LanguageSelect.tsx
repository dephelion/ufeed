'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export default function LanguageSelect({ locale }: { locale: 'en' | 'es' }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation(undefined, { lng: locale });
  return (
    <label className="language-select">
      <span className="sr-only">{t('language.label')}</span>
      <select
        value={locale}
        aria-label={t('language.label')}
        onChange={(event) => {
          const path = pathname.replace(/^\/(en|es)(?=\/|$)/, `/${event.target.value}`);
          router.push(path);
        }}
      >
        <option value="en">🇬🇧 {t('language.english')}</option>
        <option value="es">🇪🇸 {t('language.spanish')}</option>
      </select>
    </label>
  );
}
