'use client';

import { useEffect, useRef, useState } from 'react';
import { canvasFilter, draw, DUR, SIZE, STILL, type DemoCopy, type Mode } from './scene';

// Below this width the caption moves above the feed, so its text stays readable.
const TALL_BELOW = 640;
// Lets the page settle before anything moves.
const AUTOPLAY_MS = 1000;

const clockOf = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const TOTAL = clockOf(DUR);

export default function WelcomeDemo({ copy }: { copy: DemoCopy }) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('wide');
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);
  const time = useRef(0);
  const clock = useRef<HTMLSpanElement>(null);
  const autoplay = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const resize = new ResizeObserver(([entry]) =>
      setMode(entry.contentRect.width < TALL_BELOW ? 'tall' : 'wide'),
    );
    const seen = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    resize.observe(el);
    seen.observe(el);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settle = () => {
      setStill(motion.matches);
      if (motion.matches) {
        window.clearTimeout(autoplay.current);
        time.current = STILL;
        setPlaying(false);
      }
    };
    settle();
    if (!motion.matches)
      autoplay.current = window.setTimeout(() => setPlaying(true), AUTOPLAY_MS);
    motion.addEventListener('change', settle);
    return () => {
      window.clearTimeout(autoplay.current);
      resize.disconnect();
      seen.disconnect();
      motion.removeEventListener('change', settle);
    };
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const filter = canvasFilter(ctx);
    const paint = () => {
      draw(ctx, mode, time.current, copy, filter);
      const now = `${clockOf(time.current)} / ${TOTAL}`;
      if (clock.current && clock.current.textContent !== now)
        clock.current.textContent = now;
    };
    paint();
    if (!playing || !visible) return;
    let last = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      // Capped, so a backgrounded tab resumes where it left off.
      time.current = (time.current + Math.min(now - last, 100) / 1000) % DUR;
      last = now;
      paint();
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [mode, playing, visible, still, copy]);

  const [width, height] = SIZE[mode];
  const toggle = () => {
    window.clearTimeout(autoplay.current);
    if (!playing && still && time.current === STILL) time.current = 0;
    setPlaying((on) => !on);
  };

  return (
    <div className="welcome-demo" ref={frame}>
      <canvas
        ref={canvas}
        width={width}
        height={height}
        style={{ aspectRatio: `${width} / ${height}` }}
        role="img"
        aria-label={copy.label}
        onClick={toggle}
      />
      <span className="welcome-demo-clock" ref={clock} aria-hidden="true">
        {`0:00 / ${TOTAL}`}
      </span>
      <button
        type="button"
        className="welcome-demo-toggle"
        aria-label={playing ? copy.pause : copy.play}
        title={playing ? copy.pause : copy.play}
        onClick={toggle}
      >
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>
    </div>
  );
}
