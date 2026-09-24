'use client';

import { I18nextProvider } from 'react-i18next';
import { useEffect } from 'react';
import { i18n } from '../i18n/config';

export default function I18nProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
