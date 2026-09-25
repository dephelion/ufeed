'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_STORAGE_KEY, type Locale } from '../i18n/resources';

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
  const { t } = useTranslation(undefined, { lng: locale });
  const current = options.find((option) => option.locale === locale);
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        container.current?.querySelector('button')?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="language-select" ref={container}>
      <button
        type="button"
        className="language-trigger"
        aria-label={t('language.label')}
        aria-expanded={open}
        aria-controls={open ? 'language-options' : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{current?.flag}</span>
      </button>
      {open && (
        <ul id="language-options" className="language-options">
          {options.map((option) => (
            <li key={option.locale}>
              <a
                href={pathname.replace(/^\/[^/]+(?=\/|$)/, `/${option.locale}`)}
                lang={option.locale}
                aria-current={option.locale === locale ? 'true' : undefined}
                onClick={() => {
                  try {
                    localStorage.setItem(LANGUAGE_STORAGE_KEY, option.locale);
                  } catch {}
                }}
              >
                <span aria-hidden="true">{option.flag}</span> {option.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
