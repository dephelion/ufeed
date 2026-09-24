'use client';

import { useEffect } from 'react';
import { browserLocale } from '../i18n/resources';

export default function HomeRedirect() {
  useEffect(() => {
    const locale = browserLocale(
      navigator.languages?.length ? navigator.languages : [navigator.language],
    );
    window.location.replace(`/${locale}/`);
  }, []);
  return <main aria-label="uFeed">uFeed</main>;
}
