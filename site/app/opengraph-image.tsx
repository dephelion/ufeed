import { ImageResponse } from 'next/og';

export const alt = 'uFeed — a little more of what you came for';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-static';

export default function OpenGraphImage() {
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
            border: '2px solid #e6e544',
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
            <span
              style={{ width: 41, height: 4, borderRadius: 3, background: '#e6e544' }}
            />
            <span
              style={{ width: 29, height: 4, borderRadius: 3, background: '#e6e544' }}
            />
            <span
              style={{ width: 41, height: 4, borderRadius: 3, background: '#e6e544' }}
            />
            <span
              style={{ width: 24, height: 4, borderRadius: 3, background: '#e6e544' }}
            />
            <span
              style={{ width: 36, height: 4, borderRadius: 3, background: '#e6e544' }}
            />
          </div>
        </div>
        <span style={{ fontSize: 34, fontWeight: 700 }}>uFeed</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <span
          style={{ color: '#e6e544', fontSize: 21, letterSpacing: 4, fontWeight: 700 }}
        >
          YOUR FEED, YOUR WAY
        </span>
        <span style={{ maxWidth: 950, fontSize: 68, lineHeight: 1.08, fontWeight: 700 }}>
          A little more of what you came for.
        </span>
        <span style={{ color: '#b7bac0', fontSize: 27 }}>
          A private, open-source filter for X, LinkedIn and Reddit.
        </span>
      </div>
      <div style={{ display: 'flex', color: '#e6e544', fontSize: 19 }}>
        Free · On-device · Open source
      </div>
    </div>,
    { ...size },
  );
}
