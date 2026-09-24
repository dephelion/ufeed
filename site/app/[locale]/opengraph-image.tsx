import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { translate } from '../i18n/config';
import { isLocale, locales } from '../i18n/resources';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translate(locale);
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: '72px 82px',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#171a1f',
        color: '#f4f4f0',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            width: 62,
            height: 62,
            border: '2px solid #ffe02e',
            borderRadius: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {[41, 29, 41, 24, 36].map((width, index) => (
              <span
                key={index}
                style={{ width, height: 4, borderRadius: 3, background: '#ffe02e' }}
              />
            ))}
          </div>
        </div>
        <span style={{ fontSize: 34, fontWeight: 700 }}>uFeed</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <span
          style={{ color: '#ffe02e', fontSize: 21, letterSpacing: 4, fontWeight: 700 }}
        >
          {t('seo.ogEyebrow')}
        </span>
        <span style={{ maxWidth: 950, fontSize: 68, lineHeight: 1.08, fontWeight: 700 }}>
          {t('seo.ogTitle')}
        </span>
        <span style={{ color: '#b7bac0', fontSize: 27 }}>{t('seo.ogDescription')}</span>
      </div>
      <div style={{ display: 'flex', color: '#ffe02e', fontSize: 19 }}>
        {t('seo.ogFooter')}
      </div>
    </div>,
    { ...size },
  );
}
