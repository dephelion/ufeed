'use client';

import Image from 'next/image';
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

  return (
    <main className="redirect-loader" aria-label="uFeed" role="status">
      <Image
        className="redirect-loader__icon"
        src="/extension-icon.png"
        width={72}
        height={72}
        alt=""
      />
      <span className="redirect-loader__wordmark">uFeed</span>
    </main>
  );
}
