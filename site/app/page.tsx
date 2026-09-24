'use client';

import { useEffect } from 'react';

export default function HomeRedirect() {
  useEffect(() => {
    const language = navigator.languages?.find((item) => item.toLowerCase().startsWith('es')) ?? navigator.language;
    window.location.replace(language.toLowerCase().startsWith('es') ? '/es/' : '/en/');
  }, []);
  return <main aria-label="uFeed">uFeed</main>;
}
