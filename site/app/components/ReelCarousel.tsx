'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

const ADVANCE_MS = 60_000;

type Slide = { src: string; label: string };

export default function ReelCarousel({
  label,
  slides,
}: {
  label: string;
  slides: Slide[];
}) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    videos.current.forEach((video, i) => {
      if (!video) return;
      if (i === active) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [active]);

  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(() => setActive((i) => (i + 1) % slides.length), ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [active, auto, slides.length]);

  // Media events also fire on loop, offscreen autoplay pausing and our own seek.
  // Only input on the player means the reader took over.
  const takeOver = () => setAuto(false);

  function choose(i: number) {
    takeOver();
    setActive(i);
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (active + step + slides.length) % slides.length;
    choose(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="preview">
      <div className="preview-top">
        <i />
        <i />
        <i />
        <div className="reel-tabs" role="tablist" aria-label={label}>
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`reel-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-controls={`reel-panel-${i}`}
              tabIndex={i === active ? 0 : -1}
              className="reel-tab"
              onClick={() => choose(i)}
              onKeyDown={onTabKey}
            >
              <span>0{i + 1}</span> {slide.label}
            </button>
          ))}
        </div>
        {auto && (
          <span
            key={active}
            className="reel-progress"
            style={{ animationDuration: `${ADVANCE_MS}ms` }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="reel-stage">
        {slides.map((slide, i) => (
          <video
            key={slide.src}
            ref={(el) => {
              videos.current[i] = el;
            }}
            id={`reel-panel-${i}`}
            role="tabpanel"
            aria-labelledby={`reel-tab-${i}`}
            aria-hidden={i !== active}
            inert={i !== active}
            className={`preview-video${i === active ? ' is-active' : ''}`}
            src={slide.src}
            autoPlay={i === 0}
            controls
            loop
            muted
            playsInline
            preload={i === active ? 'metadata' : 'none'}
            onPointerDown={takeOver}
            onKeyDown={takeOver}
          />
        ))}
      </div>
    </div>
  );
}
