// One continuous feed, three chapters: whitelist and blacklist, collapse, rating.
// Drawn on a canvas from the reader's locale, in the style of the home page reel.

export type DemoCopy = {
  label: string;
  play: string;
  pause: string;
  chapters: { tag: string; title: string; text: string }[];
  popup: {
    topicsLabel: string;
    topicsValue: string;
    blacklistLabel: string;
    blacklistValue: string;
    save: string;
    collapse: string;
    learn: string;
    strictness: string;
  };
  feed: {
    labelTopic: string;
    labelBlacklist: string;
    opened: string;
    scan: string;
    ago: string;
    posts: string[];
  };
};

export type Mode = 'wide' | 'tall';
type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

export const DUR = 30.5;
export const STILL = 29.2;
export const SIZE: Record<Mode, Pt> = { wide: [1600, 900], tall: [800, 1194] };

const C = {
  bg: '#171a1f',
  panel: '#20242b',
  line: '#343942',
  text: '#f4f4f0',
  muted: '#a9adb2',
  y: '#ffe02e',
  ink: '#121417',
  keep: '#22c55e',
  drop: '#ef4444',
};
const DISP =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Hiragino Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif";
const MONO =
  "'JetBrainsMono Nerd Font', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const HANDLES = [
  '@ana.type',
  '@letterform',
  '@hot_takes_daily',
  '@rustacean',
  '@moon.signals',
  '@meme.lord',
  '@pixelpush',
];
const AVATARS = [
  '#7c9cff',
  '#f472b6',
  '#ff7a59',
  '#f5a524',
  '#b18cff',
  '#34d399',
  '#60a5fa',
];
const CARD_H = 96;
const ROW_H = 40;
const GAP = 14;
const POP_W = 420;

// Every beat, in seconds. Slow on purpose: each click lands after the cursor settles.
const K = {
  captions: [
    [0.3, 13.2],
    [13.3, 20.9],
    [21.2, 29.6],
  ],
  cursor: [
    [1.6, 10.3],
    [13.6, 19.7],
    [21.4, 28.8],
  ],
  icon: [2.7, 14.5, 22.2],
  close: [9.6, 16.1, 23.6],
  topicsClick: 3.55,
  typeTopics: [3.75, 5.05],
  blacklistClick: 5.7,
  typeBlacklist: [5.85, 6.65],
  save: 7.3,
  // Strictness, dragged from its default 7 to 8; a step-1 range snaps halfway.
  slide: [8.35, 9.25],
  scan: [10.1, 11.5],
  collapseClick: 15.6,
  collapse: 16.55,
  reveal: 18.4,
  learnClick: 23.1,
  chips: 24.0,
  keep: 25.5,
  drop: 26.9,
  dropBlur: 27.15,
  dropCollapse: 27.75,
};
const CLICKS = [
  K.icon[0],
  K.topicsClick,
  K.blacklistClick,
  K.save,
  K.slide[0],
  K.icon[1],
  K.collapseClick,
  K.reveal,
  K.icon[2],
  K.learnClick,
  K.keep,
  K.drop,
];

/* ---------- math ---------- */
const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const out3 = (t: number) => 1 - (1 - t) ** 3;
const expo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const inExpo = (t: number) => (t <= 0 ? 0 : 2 ** (10 * t - 10));
const io3 = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const lin = (t: number) => t;
const back = (t: number) => 1 + 2.9 * (t - 1) ** 3 + 1.9 * (t - 1) ** 2;
// CSS cubic-bezier, so the collapse moves exactly like blur.css.
function bez(x1: number, y1: number, x2: number, y2: number) {
  const f = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (p: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const m = (lo + hi) / 2;
      if (f(x1, x2, m) < p) lo = m;
      else hi = m;
    }
    return f(y1, y2, (lo + hi) / 2);
  };
}
const cssEase = bez(0.25, 0.1, 0.25, 1);
const cssIn = bez(0.42, 0, 1, 1);
const cssOut = bez(0, 0, 0.58, 1);
const P = (t: number, a: number, b: number, e: (t: number) => number = out3) =>
  e(cl((t - a) / (b - a)));
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/* ---------- geometry ---------- */
type Geo = {
  W: number;
  H: number;
  cap: {
    x: number;
    y: number;
    w: number;
    title: number;
    text: number;
    titleLines: number;
    textLines: number;
  };
  win: { x: number; y: number; w: number; h: number };
};
function geometry(mode: Mode): Geo {
  const [W, H] = SIZE[mode];
  return mode === 'wide'
    ? {
        W,
        H,
        cap: { x: 90, y: 250, w: 520, title: 56, text: 23, titleLines: 3, textLines: 5 },
        win: { x: 690, y: 70, w: 830, h: 760 },
      }
    : {
        W,
        H,
        cap: { x: 48, y: 120, w: 704, title: 46, text: 22, titleLines: 2, textLines: 3 },
        win: { x: 24, y: 436, w: 752, h: 740 },
      };
}

/* ---------- text ---------- */
type Font = { s: number; w?: number; f?: string };
const fontOf = (o: Font) => `${o.w ?? 700} ${o.s}px ${o.f ?? DISP}`;

type TextOpts = Font & { c?: string; a?: number; al?: CanvasTextAlign };
function text(x: Ctx, s: string, px: number, py: number, o: TextOpts) {
  x.save();
  x.font = fontOf(o);
  x.fillStyle = o.c ?? C.text;
  x.globalAlpha *= o.a ?? 1;
  x.textAlign = o.al ?? 'left';
  x.textBaseline = 'alphabetic';
  x.fillText(s, px, py);
  x.restore();
}
function measure(x: Ctx, s: string, o: Font) {
  x.save();
  x.font = fontOf(o);
  const w = x.measureText(s).width;
  x.restore();
  return w;
}
/** Largest size up to `o.s` that fits, never below `min`; ellipsized if even that is too wide. */
function fit(
  x: Ctx,
  s: string,
  maxW: number,
  o: Font,
  min = o.s * 0.7,
): [string, number] {
  let size = o.s;
  while (size > min && measure(x, s, { ...o, s: size }) > maxW) size -= 1;
  if (measure(x, s, { ...o, s: size }) <= maxW) return [s, size];
  const chars = Array.from(s);
  while (chars.length > 1 && measure(x, chars.join('') + '…', { ...o, s: size }) > maxW)
    chars.pop();
  return [chars.join('').trimEnd() + '…', size];
}

// Spaced scripts break at spaces; Han, kana and Hangul may break between any two characters.
const TOKEN =
  /[　-ヿ㐀-鿿가-힯＀-￯][、。，．！？：）」』]*|[^\s　-ヿ㐀-鿿가-힯＀-￯]+\s*|\s+/g;
function wrap(x: Ctx, s: string, maxW: number, o: Font): string[] {
  const lines: string[] = [];
  let line = '';
  for (const token of s.match(TOKEN) ?? []) {
    const next = line + token;
    if (line && measure(x, next.trimEnd(), o) > maxW) {
      lines.push(line.trimEnd());
      line = token.trimStart();
    } else line = next;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}
/** Wraps at the largest size up to `size` that keeps within `maxLines`. */
function block(
  x: Ctx,
  s: string,
  maxW: number,
  o: Font,
  maxLines: number,
): [string[], number] {
  for (let size = o.s; size > o.s * 0.6; size -= 2) {
    const lines = wrap(x, s, maxW, { ...o, s: size });
    if (lines.length <= maxLines) return [lines, size];
  }
  const size = Math.round(o.s * 0.6);
  return [wrap(x, s, maxW, { ...o, s: size }), size];
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%/<>*';
function scramble(s: string, p: number, seed: number) {
  if (p >= 1) return s;
  const chars = Array.from(s);
  const k = Math.floor(p * chars.length);
  let out = chars.slice(0, k).join('');
  for (let i = k; i < Math.min(chars.length, k + 4); i++)
    out +=
      chars[i] === ' '
        ? ' '
        : GLYPHS[Math.floor(hash(seed + i + Math.floor(p * 40)) * GLYPHS.length)];
  return out;
}

/* ---------- shapes ---------- */
function rr(x: Ctx, px: number, py: number, w: number, h: number, r: number) {
  x.beginPath();
  x.roundRect(px, py, w, h, r);
}
function circle(x: Ctx, cx: number, cy: number, r: number) {
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
}
function pill(
  x: Ctx,
  cx: number,
  cy: number,
  label: string,
  o: Font & { bg: string; c: string; border?: string; k?: number; a?: number },
) {
  const w = measure(x, label, o) + o.s * 1.3;
  const h = o.s * 1.9;
  x.save();
  x.globalAlpha *= o.a ?? 1;
  x.translate(cx, cy);
  x.scale(o.k ?? 1, o.k ?? 1);
  rr(x, -w / 2, -h / 2, w, h, h / 2);
  x.fillStyle = o.bg;
  x.fill();
  if (o.border) {
    x.strokeStyle = o.border;
    x.lineWidth = 1.5;
    x.stroke();
  }
  text(x, label, 0, o.s * 0.36, { ...o, al: 'center' });
  x.restore();
  return w;
}
function logo(x: Ctx, cx: number, cy: number, r: number) {
  x.save();
  circle(x, cx, cy, r);
  x.fillStyle = '#111';
  x.fill();
  x.lineWidth = r * 0.11;
  x.strokeStyle = C.y;
  x.lineCap = 'round';
  circle(x, cx, cy, r * 0.94);
  x.stroke();
  const rows = [
    [[-0.42, 0.42]],
    [
      [-0.6, -0.2],
      [-0.04, 0.6],
    ],
    [
      [-0.64, 0.18],
      [0.34, 0.64],
    ],
    [
      [-0.6, 0.04],
      [0.2, 0.6],
    ],
    [[-0.42, 0.42]],
  ];
  x.lineWidth = r * 0.12;
  rows.forEach((segs, i) => {
    const yy = cy + (i - 2) * r * 0.23;
    segs.forEach(([a, b]) => {
      x.beginPath();
      x.moveTo(cx + a * r, yy);
      x.lineTo(cx + b * r, yy);
      x.stroke();
    });
  });
  x.restore();
}
function check(x: Ctx, cx: number, cy: number, p: number, label: string, maxW: number) {
  rr(x, cx - 13, cy - 13, 26, 26, 7);
  x.fillStyle = p > 0 ? C.y : 'transparent';
  x.fill();
  x.strokeStyle = p > 0 ? C.y : '#6b717c';
  x.lineWidth = 2;
  x.stroke();
  if (p > 0) {
    x.beginPath();
    x.moveTo(cx - 7, cy);
    x.lineTo(cx - 2, cy + 5);
    x.lineTo(lerp(cx - 2, cx + 8, p), lerp(cy + 5, cy - 6, p));
    x.strokeStyle = C.ink;
    x.lineWidth = 3.5;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.stroke();
  }
  // Long labels wrap to a second line rather than shrink past reading size.
  const [lines, size] = block(x, label, maxW, { s: 18, w: 600 }, 2);
  lines.forEach((line, i) => {
    const y = cy + size * 0.36 + (i - (lines.length - 1) / 2) * size * 1.2;
    text(x, line, cx + 26, y, { s: size, w: 600 });
  });
}

/* ---------- feed state ---------- */
type Verdict = { at: number; reason: 'topic' | 'blacklist' } | null;
const FLAGGED: Record<number, 'topic' | 'blacklist'> = {
  1: 'topic',
  2: 'topic',
  4: 'blacklist',
};
const RATABLE = [0, 1, 3, 5, 6];

function feedTop(g: Geo) {
  return g.win.y + 84;
}
function feedBox(g: Geo) {
  return { x: g.win.x + 32, w: g.win.w - 64 };
}
/** When the scanner, sweeping at constant speed, crosses the centre of an unfiltered post. */
function scanned(g: Geo, i: number) {
  const top = feedTop(g) - 20;
  const span = 6 * CARD_H + 5 * GAP + 40;
  const centre = feedTop(g) + i * (CARD_H + GAP) + CARD_H / 2;
  return lerp(K.scan[0], K.scan[1], (centre - top) / span);
}
function verdict(g: Geo, i: number): Verdict {
  if (FLAGGED[i]) return { at: scanned(g, i), reason: FLAGGED[i] };
  if (i === 5) return { at: K.dropBlur, reason: 'topic' };
  return null;
}
const collapseAt = (i: number) =>
  i === 5 ? K.dropCollapse : FLAGGED[i] ? K.collapse : Infinity;
const collapsed = (i: number, t: number) => cssEase(cl((t - collapseAt(i)) / 0.5));
const expanded = (i: number, t: number) =>
  i === 1 ? P(t, K.reveal, K.reveal + 0.25, cssOut) : 0;

function height(i: number, t: number) {
  return lerp(lerp(CARD_H, ROW_H, collapsed(i, t)), CARD_H, expanded(i, t));
}
function layout(g: Geo, t: number) {
  let y = feedTop(g);
  return HANDLES.map((_, i) => {
    const h = height(i, t);
    const at = { y, h };
    y += h + GAP;
    return at;
  });
}
function chipAt(g: Geo, i: number, t: number) {
  const { x, w } = feedBox(g);
  const { y, h } = layout(g, t)[i];
  const cx = x + w - 3 - 21;
  const cy = y + h / 2;
  return { cx, cy, keep: [cx, cy - 18] as Pt, drop: [cx, cy + 18] as Pt };
}
function popupBox(g: Geo) {
  return { x: g.win.x + g.win.w - POP_W - 14, y: g.win.y + 60 };
}
const iconAt = (g: Geo): Pt => [g.win.x + g.win.w - 40, g.win.y + 28];
function sliderAt(g: Geo) {
  const { x, y } = popupBox(g);
  return { x0: x + 30, x1: x + POP_W - 30, y: y + 384 };
}
/** The thumb sits on whole steps; it jumps from 7 to 8 when the drag passes halfway. */
function thumbAt(g: Geo, t: number) {
  const { x0, x1 } = sliderAt(g);
  const snap = K.slide[0] + (K.slide[1] - K.slide[0]) / 2;
  return lerp(x0, x1, lerp(0.7, 0.8, P(t, snap, snap + 0.12, cssOut)));
}

/* ---------- layers ---------- */
function backdrop(x: Ctx, g: Geo, t: number) {
  x.fillStyle = C.bg;
  x.fillRect(0, 0, g.W, g.H);
  x.save();
  x.globalAlpha = 0.035;
  x.strokeStyle = '#fff';
  x.lineWidth = 1;
  const off = (t * 4) % 80;
  for (let px = -80 + off; px < g.W; px += 80) {
    x.beginPath();
    x.moveTo(px, 0);
    x.lineTo(px, g.H);
    x.stroke();
  }
  for (let py = 0; py < g.H; py += 80) {
    x.beginPath();
    x.moveTo(0, py);
    x.lineTo(g.W, py);
    x.stroke();
  }
  x.restore();
}

function caption(x: Ctx, g: Geo, t: number, copy: DemoCopy) {
  const { cap } = g;
  const index = K.captions.findIndex(([, b], i) => t < b + 0.45 || i === 2);
  const [a, b] = K.captions[index];
  const chapter = copy.chapters[index];
  const gone = P(t, b, b + 0.4, inExpo);
  if (t < a || gone >= 1) return;

  const tag = `0${index + 1} / 03 · ${chapter.tag.toUpperCase()}`;
  text(x, scramble(tag, P(t, a, a + 0.5, lin), index * 7), cap.x, cap.y, {
    s: 17,
    w: 700,
    f: MONO,
    c: C.y,
    a: 1 - gone,
  });
  for (let k = 0; k < 3; k++) {
    const fill = k < index ? 1 : k === index ? P(t, a, b, lin) : 0;
    x.fillStyle = C.line;
    x.fillRect(cap.x + k * 70, cap.y + 22, 58, 4);
    x.fillStyle = C.y;
    x.fillRect(cap.x + k * 70, cap.y + 22, 58 * fill, 4);
  }

  const [titles, size] = block(
    x,
    chapter.title,
    cap.w,
    { s: cap.title, w: 800 },
    cap.titleLines,
  );
  const [texts, small] = block(
    x,
    chapter.text,
    cap.w,
    { s: cap.text, w: 500 },
    cap.textLines,
  );
  let y = cap.y + 36 + size * 1.25;
  const lines = [
    ...titles.map((s) => ({ s, size, w: 800, c: C.text, lh: size * 1.14, gap: 0 })),
    ...texts.map((s, i) => ({
      s,
      size: small,
      w: 500,
      c: C.muted,
      lh: small * 1.55,
      gap: i === 0 ? 20 : 0,
    })),
  ];
  lines.forEach((line, i) => {
    y += line.gap;
    const p = P(t, a + 0.15 + i * 0.09, a + 0.8 + i * 0.09, expo);
    const q = P(t, b + i * 0.03, b + 0.35 + i * 0.03, inExpo);
    if (p > 0 && q < 1) {
      x.save();
      x.beginPath();
      x.rect(cap.x - 10, y - line.size * 1.05, cap.w + 20, line.size * 1.4);
      x.clip();
      text(x, line.s, cap.x, y + (1 - p) * line.size * 1.2 - q * line.size * 1.2, {
        s: line.size,
        w: line.w,
        c: line.c,
      });
      x.restore();
    }
    y += line.lh;
  });
}

function windowFrame(x: Ctx, g: Geo, t: number) {
  const { win } = g;
  x.save();
  x.shadowColor = 'rgba(0,0,0,.45)';
  x.shadowBlur = 50;
  x.shadowOffsetY = 18;
  rr(x, win.x, win.y, win.w, win.h, 18);
  x.fillStyle = '#121519';
  x.fill();
  x.restore();
  rr(x, win.x, win.y, win.w, win.h, 18);
  x.strokeStyle = C.line;
  x.lineWidth = 1.5;
  x.stroke();
  x.fillStyle = C.line;
  x.fillRect(win.x, win.y + 56, win.w, 1.5);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    circle(x, win.x + 26 + i * 22, win.y + 28, 6.5);
    x.fillStyle = c;
    x.globalAlpha = 0.8;
    x.fill();
    x.globalAlpha = 1;
  });
  rr(x, win.x + 104, win.y + 15, win.w - 190, 26, 13);
  x.fillStyle = '#1b1f25';
  x.fill();
  rr(x, win.x + 124, win.y + 25, Math.min(180, win.w - 240), 6, 3);
  x.fillStyle = '#343942';
  x.fill();
  const [ix, iy] = iconAt(g);
  const glow = Math.max(
    ...K.icon.map((c) => 1 - P(t, c, c + 0.6, out3) + (t < c ? -1 : 0)),
  );
  if (glow > 0) {
    circle(x, ix, iy, 16 + 10 * (1 - glow));
    x.fillStyle = `rgba(255,224,46,${0.25 * glow})`;
    x.fill();
  }
  logo(x, ix, iy, 14);
}

function card(
  x: Ctx,
  g: Geo,
  i: number,
  y: number,
  h: number,
  t: number,
  copy: DemoCopy,
  filter: boolean,
) {
  const { x: fx, w: fw } = feedBox(g);
  const v = verdict(g, i);
  const flagged = v !== null && t >= v.at;
  const colP = collapsed(i, t);
  const expP = expanded(i, t);
  const opened = i === 1 ? P(t, K.reveal, K.reveal + 0.35, out3) : 0;
  const blur = v ? 9 * P(t, v.at, v.at + 0.45, expo) * (1 - opened) : 0;
  let ca = v ? 1 - cssIn(cl((t - collapseAt(i)) / 0.5)) : 1;
  if (i === 1) ca = Math.max(ca, expP);

  rr(x, fx, y, fw, h, Math.min(16, h / 2));
  x.fillStyle = C.panel;
  x.fill();
  x.strokeStyle = C.line;
  x.lineWidth = 1.5;
  x.stroke();

  x.save();
  rr(x, fx, y, fw, h, Math.min(16, h / 2));
  x.clip();
  x.globalAlpha *= ca * (1 - 0.45 * cl(blur / 9));
  if (blur > 0 && filter) x.filter = `blur(${blur}px)`;
  circle(x, fx + 44, y + 48, 22);
  x.fillStyle = AVATARS[i];
  x.fill();
  const handle = HANDLES[i];
  const textMax = fw - 80 - 64;
  if (blur > 0 && !filter) {
    // No canvas filter (older Safari): soft bars stand in for the blurred words.
    x.fillStyle = '#3b414c';
    rr(x, fx + 80, y + 26, 150, 14, 7);
    x.fill();
    rr(x, fx + 80, y + 56, textMax * 0.8, 14, 7);
    x.fill();
  } else {
    text(x, handle, fx + 80, y + 40, { s: 19, w: 700 });
    text(
      x,
      `· ${copy.feed.ago}`,
      fx + 80 + measure(x, handle, { s: 19, w: 700 }) + 8,
      y + 40,
      {
        s: 17,
        w: 500,
        c: C.muted,
      },
    );
    const [post, size] = fit(x, copy.feed.posts[i] ?? '', textMax, { s: 21, w: 500 }, 15);
    text(x, post, fx + 80, y + 72, { s: size, w: 500, c: '#d9dbd6' });
  }
  x.restore();

  if (!v) return;
  // The label: centred on a full-height blur, small and pinned right on a collapsed row.
  const lp = P(t, v.at + 0.1, v.at + 0.45, back);
  if (flagged && lp > 0 && opened < 1) {
    const label = v.reason === 'topic' ? copy.feed.labelTopic : copy.feed.labelBlacklist;
    const [s, size] = fit(x, label, fw * 0.8 - 20, { s: lerp(20, 14, colP), w: 700 }, 11);
    const lw = measure(x, s, { s: size, w: 700 }) + size * 1.3;
    const lx = lerp(fx + fw / 2, fx + fw - 10 - lw / 2, colP);
    pill(x, lx, y + h / 2, s, {
      s: size,
      w: 700,
      bg: v.reason === 'topic' ? 'rgba(150,26,30,.9)' : 'rgba(12,12,14,.92)',
      c: '#fafaf7',
      border: v.reason === 'blacklist' ? '#4b515b' : undefined,
      k: lp,
      a: 1 - opened,
    });
  }
  // An opened post keeps its reason as a small tag, until a rating changes the verdict.
  const tag = opened * (1 - P(t, K.keep + 0.1, K.keep + 0.45));
  if (tag > 0)
    pill(x, fx + fw / 2, y + 2, copy.feed.opened, {
      s: 13,
      w: 700,
      f: MONO,
      bg: 'rgba(150,26,30,.9)',
      c: '#fafaf7',
      a: tag,
    });
}

function ratingChip(x: Ctx, g: Geo, i: number, t: number, cursor: Pt) {
  const k = P(
    t,
    K.chips + RATABLE.indexOf(i) * 0.08,
    K.chips + 0.4 + RATABLE.indexOf(i) * 0.08,
    back,
  );
  const hide = i === 5 ? P(t, K.dropBlur, K.dropBlur + 0.2) : 0;
  if (k <= 0 || hide >= 1) return;
  const { cx, cy, keep, drop } = chipAt(g, i, t);
  x.save();
  x.globalAlpha *= 1 - hide;
  x.translate(cx, cy);
  x.scale(k, k);
  x.translate(-cx, -cy);
  rr(x, cx - 20, cy - 38, 40, 76, 11);
  x.fillStyle = 'rgba(12,14,17,.78)';
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,.1)';
  x.lineWidth = 1;
  x.stroke();
  const active = { keep: i === 1 && t >= K.keep, drop: i === 5 && t >= K.drop };
  const near = (p: Pt) => Math.hypot(cursor[0] - p[0], cursor[1] - p[1]) < 16;
  (
    [
      [keep, C.keep, active.keep],
      [drop, C.drop, active.drop],
    ] as const
  ).forEach(([[bx, by], col, on]) => {
    if (on || near([bx, by])) {
      circle(x, bx, by, 15);
      x.fillStyle = on ? `${col}44` : `${col}22`;
      x.fill();
    }
  });
  // Keep: a page with an up arrow. Drop: a bin.
  x.strokeStyle = C.keep;
  x.lineWidth = 2;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  const [kx, ky] = keep;
  rr(x, kx - 7, ky - 8, 14, 16, 2.5);
  x.stroke();
  x.beginPath();
  x.moveTo(kx, ky + 4);
  x.lineTo(kx, ky - 4);
  x.moveTo(kx - 3.5, ky - 0.5);
  x.lineTo(kx, ky - 4);
  x.lineTo(kx + 3.5, ky - 0.5);
  x.stroke();
  x.strokeStyle = C.drop;
  const [dx, dy] = drop;
  x.beginPath();
  x.moveTo(dx - 8, dy - 5);
  x.lineTo(dx + 8, dy - 5);
  x.moveTo(dx - 3, dy - 5);
  x.lineTo(dx - 2, dy - 8);
  x.lineTo(dx + 2, dy - 8);
  x.lineTo(dx + 3, dy - 5);
  x.moveTo(dx - 6, dy - 5);
  x.lineTo(dx - 5, dy + 8);
  x.lineTo(dx + 5, dy + 8);
  x.lineTo(dx + 6, dy - 5);
  x.stroke();
  x.restore();
}

function feed(x: Ctx, g: Geo, t: number, copy: DemoCopy, filter: boolean, cursor: Pt) {
  const { win } = g;
  x.save();
  x.beginPath();
  x.rect(win.x, win.y + 58, win.w, win.h - 60);
  x.clip();
  layout(g, t).forEach(({ y, h }, i) => {
    const inP = P(t, 0.2 + i * 0.1, 0.9 + i * 0.1, expo);
    if (inP <= 0) return;
    x.save();
    x.globalAlpha = inP;
    card(x, g, i, y + (1 - inP) * 70, h, t, copy, filter);
    x.restore();
  });
  RATABLE.forEach((i) => ratingChip(x, g, i, t, cursor));

  if (t > K.scan[0] && t < K.scan[1] + 0.1) {
    const { x: fx, w: fw } = feedBox(g);
    const top = feedTop(g) - 20;
    const sy = lerp(
      top,
      top + 6 * CARD_H + 5 * GAP + 40,
      P(t, K.scan[0], K.scan[1], lin),
    );
    const grad = x.createLinearGradient(0, sy - 110, 0, sy);
    grad.addColorStop(0, 'rgba(255,224,46,0)');
    grad.addColorStop(1, 'rgba(255,224,46,.14)');
    x.fillStyle = grad;
    x.fillRect(fx - 12, sy - 110, fw + 24, 110);
    x.save();
    x.shadowColor = C.y;
    x.shadowBlur = 20;
    x.fillStyle = C.y;
    x.fillRect(fx - 12, sy - 2, fw + 24, 3);
    x.restore();
    text(x, copy.feed.scan, fx + fw, sy - 12, {
      s: 14,
      w: 700,
      f: MONO,
      c: C.y,
      al: 'right',
    });
  }
  x.restore();
}

function popup(x: Ctx, g: Geo, t: number, copy: DemoCopy) {
  const n = K.icon.findIndex((open, i) => t >= open && t < K.close[i] + 0.35);
  if (n < 0) return;
  const open = K.icon[n] + 0.1;
  const p =
    P(t, open, open + 0.4, expo) * (1 - P(t, K.close[n], K.close[n] + 0.3, inExpo));
  if (p <= 0) return;
  const { x: px, y: py } = popupBox(g);
  const inner = POP_W - 40;
  const c = copy.popup;
  x.save();
  x.globalAlpha = p;
  x.translate(px + POP_W, py);
  x.scale(0.94 + 0.06 * p, 0.94 + 0.06 * p);
  x.translate(-(px + POP_W), -py);
  x.save();
  x.shadowColor = 'rgba(0,0,0,.6)';
  x.shadowBlur = 40;
  x.shadowOffsetY = 14;
  rr(x, px, py, POP_W, 540, 18);
  x.fillStyle = '#101216';
  x.fill();
  x.restore();
  x.strokeStyle = C.line;
  x.lineWidth = 1.5;
  x.stroke();

  logo(x, px + 36, py + 34, 15);
  text(x, 'uFeed', px + 60, py + 42, { s: 22, w: 800 });
  x.fillStyle = C.line;
  x.fillRect(px + 20, py + 62, POP_W - 40, 1.5);

  const field = (
    label: string,
    value: string,
    top: number,
    h: number,
    typing: number[],
    focus: Pt,
  ) => {
    const [l, size] = fit(x, label, inner, { s: 16, w: 700 }, 11);
    text(x, l, px + 20, top, { s: size, w: 700 });
    const chars = Array.from(value);
    const shown = chars
      .slice(0, Math.floor(P(t, typing[0], typing[1], lin) * chars.length))
      .join('');
    const focused = t >= focus[0] && t < focus[1];
    rr(x, px + 20, top + 12, inner, h, 10);
    x.fillStyle = '#171a1f';
    x.fill();
    x.strokeStyle = focused ? C.y : C.line;
    x.lineWidth = focused ? 2 : 1.5;
    x.stroke();
    const caret = focused && Math.floor(t * 2.5) % 2 === 0 ? '▍' : '';
    text(x, shown + caret, px + 36, top + 12 + 30, { s: 19, w: 500, f: MONO });
  };
  field(c.topicsLabel, c.topicsValue, py + 98, 48, K.typeTopics, [
    K.topicsClick,
    K.blacklistClick,
  ]);
  field(c.blacklistLabel, c.blacklistValue, py + 190, 48, K.typeBlacklist, [
    K.blacklistClick,
    K.save,
  ]);

  const pressed = t > K.save - 0.04 && t < K.save + 0.12 ? 0.96 : 1;
  const [save, saveSize] = fit(x, c.save, 220, { s: 17, w: 800 }, 12);
  const bw = measure(x, save, { s: saveSize, w: 800 }) + 40;
  x.save();
  x.translate(px + POP_W / 2, py + 300);
  x.scale(pressed, pressed);
  rr(x, -bw / 2, -21, bw, 42, 10);
  // Enabled by an unsaved edit, disabled again once saved, as in the popup.
  const dirty = t >= K.typeTopics[0] && t < K.save + 0.15;
  x.fillStyle = dirty ? C.y : '#3a3f47';
  x.fill();
  text(x, save, 0, saveSize * 0.36, {
    s: saveSize,
    w: 800,
    c: dirty ? C.ink : C.muted,
    al: 'center',
  });
  x.restore();

  const [strict, strictSize] = fit(x, c.strictness, inner - 40, { s: 16, w: 700 }, 11);
  text(x, strict, px + 20, py + 356, { s: strictSize, w: 700 });
  const value = t < K.slide[0] + (K.slide[1] - K.slide[0]) / 2 ? 7 : 8;
  text(x, String(value), px + POP_W - 20, py + 356, {
    s: 17,
    w: 700,
    f: MONO,
    c: C.y,
    al: 'right',
  });
  const { x0, x1, y: ty } = sliderAt(g);
  const tx = thumbAt(g, t);
  rr(x, x0, ty - 3, x1 - x0, 6, 3);
  x.fillStyle = C.line;
  x.fill();
  rr(x, x0, ty - 3, tx - x0, 6, 3);
  x.fillStyle = C.y;
  x.fill();
  const held = t >= K.slide[0] && t < K.slide[1];
  circle(x, tx, ty, held ? 13 : 11);
  x.fillStyle = C.text;
  x.fill();
  x.strokeStyle = C.y;
  x.lineWidth = 3;
  x.stroke();

  x.fillStyle = C.line;
  x.fillRect(px + 20, py + 414, POP_W - 40, 1.5);
  check(
    x,
    px + 34,
    py + 450,
    P(t, K.collapseClick, K.collapseClick + 0.15),
    c.collapse,
    inner - 40,
  );
  check(
    x,
    px + 34,
    py + 500,
    P(t, K.learnClick, K.learnClick + 0.15),
    c.learn,
    inner - 40,
  );
  x.restore();
}

/** The pointer: each move starts where the previous one ended. */
function cursorAt(g: Geo, t: number): Pt {
  const { x: px, y: py } = popupBox(g);
  const icon = iconAt(g);
  const rest: Pt = [g.W + 30, g.H - 40];
  const row1 = (() => {
    const { x: fx, w: fw } = feedBox(g);
    const { y, h } = layout(g, K.reveal)[1];
    return [fx + fw * 0.38, y + h / 2] as Pt;
  })();
  const { x0, x1, y: sy } = sliderAt(g);
  const moves: [number, number, Pt, boolean?][] = [
    [1.6, 2.6, icon],
    [3.0, 3.5, [px + POP_W / 2, py + 134]],
    [5.15, 5.65, [px + POP_W / 2, py + 226]],
    [6.75, 7.25, [px + POP_W / 2, py + 300]],
    [7.6, 8.2, [lerp(x0, x1, 0.7), sy]],
    [K.slide[0] + 0.05, K.slide[1] - 0.05, [lerp(x0, x1, 0.8), sy], true],
    [K.close[0] + 0.1, K.close[0] + 0.8, rest],
    [13.6, 14.45, icon],
    [14.9, 15.55, [px + 34, py + 450]],
    [17.3, 18.35, row1],
    [18.9, 19.7, rest],
    [21.4, 22.15, icon],
    [22.45, 23.05, [px + 34, py + 500]],
    [24.6, 25.45, chipAt(g, 1, K.keep).keep],
    [25.9, 26.85, chipAt(g, 5, K.drop).drop],
    [27.9, 28.8, rest],
  ];
  let at: Pt = rest;
  for (const [a, b, to, drag] of moves) {
    if (t < a) break;
    const p = P(t, a, b, io3);
    const lift = drag ? 0 : Math.sin(p * Math.PI) * -24;
    at = [lerp(at[0], to[0], p), lerp(at[1], to[1], p) + lift];
  }
  return at;
}

function pointer(x: Ctx, t: number, at: Pt) {
  CLICKS.forEach((c) => {
    const p = P(t, c, c + 0.55, out3);
    if (p <= 0 || p >= 1) return;
    circle(x, at[0], at[1], 10 + 42 * p);
    x.strokeStyle = `rgba(255,224,46,${1 - p})`;
    x.lineWidth = 3;
    x.stroke();
  });
  const held = t >= K.slide[0] && t < K.slide[1];
  const press = held || CLICKS.some((c) => t > c - 0.05 && t < c + 0.1) ? 0.86 : 1;
  x.save();
  x.translate(at[0], at[1]);
  x.scale(1.35 * press, 1.35 * press);
  x.beginPath();
  x.moveTo(0, 0);
  x.lineTo(0, 26);
  x.lineTo(7, 20);
  x.lineTo(12, 31);
  x.lineTo(17, 29);
  x.lineTo(12, 18);
  x.lineTo(21, 18);
  x.closePath();
  x.fillStyle = '#fff';
  x.fill();
  x.strokeStyle = '#000';
  x.lineWidth = 1.6;
  x.stroke();
  x.restore();
}

function vignette(x: Ctx, g: Geo) {
  const r = Math.max(g.W, g.H);
  const grad = x.createRadialGradient(
    g.W / 2,
    g.H / 2,
    r * 0.35,
    g.W / 2,
    g.H / 2,
    r * 0.8,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,.35)');
  x.fillStyle = grad;
  x.fillRect(0, 0, g.W, g.H);
}

/** Whether this browser blurs canvas drawing; older Safari ignores `filter`. */
export function canvasFilter(x: Ctx) {
  x.filter = 'blur(1px)';
  const ok = x.filter === 'blur(1px)';
  x.filter = 'none';
  return ok;
}

export function draw(x: Ctx, mode: Mode, t: number, copy: DemoCopy, filter: boolean) {
  const g = geometry(mode);
  backdrop(x, g, t);
  caption(x, g, t, copy);
  windowFrame(x, g, t);
  const at = cursorAt(g, t);
  feed(x, g, t, copy, filter, at);
  popup(x, g, t, copy);
  if (K.cursor.some(([a, b]) => t >= a && t <= b)) pointer(x, t, at);
  vignette(x, g);
  // The loop fades through the background, never cuts.
  const fade = Math.max(1 - P(t, 0, 0.5, lin), P(t, DUR - 0.7, DUR, lin));
  if (fade > 0) {
    x.fillStyle = C.bg;
    x.globalAlpha = fade;
    x.fillRect(0, 0, g.W, g.H);
    x.globalAlpha = 1;
  }
}
