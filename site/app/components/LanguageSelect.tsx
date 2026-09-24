'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import type { Locale } from '../i18n/resources';

const options: { locale: Locale; flag: string; name: string }[] = [
  { locale: 'en', flag: '🇬🇧', name: 'English — en (default)' },
  { locale: 'zh-CN', flag: '🇨🇳', name: '简体中文 — zh-CN' },
  { locale: 'zh-TW', flag: '🇹🇼', name: '繁體中文 — zh-TW' },
  { locale: 'fr', flag: '🇫🇷', name: 'Français — fr' },
  { locale: 'de', flag: '🇩🇪', name: 'Deutsch — de' },
  { locale: 'ja', flag: '🇯🇵', name: '日本語 — ja' },
  { locale: 'pt-BR', flag: '🇧🇷', name: 'Português (Brasil) — pt-BR' },
  { locale: 'es', flag: '🇪🇸', name: 'Español — es' },
];

export default function LanguageSelect({ locale }: { locale: Locale }) {
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
          const path = pathname.replace(/^\/[^/]+(?=\/|$)/, `/${event.target.value}`);
          router.push(path);
        }}
      >
        {options.map((option) => (
          <option key={option.locale} value={option.locale}>
            {option.flag} {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
