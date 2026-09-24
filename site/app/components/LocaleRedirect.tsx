'use client';

import { useEffect } from 'react';
import { LANGUAGE_STORAGE_KEY, preferredLocale } from '../i18n/resources';

export default function LocaleRedirect({ path }: { path: string }) {
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {}
    const locale = preferredLocale(
      saved,
      navigator.languages?.length ? navigator.languages : [navigator.language],
    );
    window.location.replace(`/${locale}${path}`);
  }, [path]);

  return <main aria-label="uFeed">uFeed</main>;
}
