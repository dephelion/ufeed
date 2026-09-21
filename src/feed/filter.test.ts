import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { xAdapter } from '../adapters/x';
import { DEFAULT_SETTINGS, type Settings } from '../core/settings';
import { EMPTY_FEEDBACK } from '../core/feedback';
import type { EngineState } from '../core/protocol';
import type { RatedMatch } from '../core/scoring';
import { isBlurred } from './blur';
import { FeedFilter } from './filter';
import type { Engine, FeedbackStore } from './ports';
import { Tuning } from './tuning';
import { translate as t } from '../platform/i18n';

/** happy-dom never intersects; this one reports every observed node as in view. */
class InView {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element): void {
    const entry = { target, isIntersecting: true } as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  topics: ['programming'],
  blurOtherLanguages: false,
};

/** Scores by keyword. Which score blurs is policy.test.ts's business, not this file's. */
const SCORES = { rust: 0.9, cake: 0.5, borderline: 0.75 } as const;
const match = (score: number): RatedMatch => ({
  score,
  topic: 0,
  lines: [score],
  rating: undefined,
});
const scored = (texts: string[]) =>
  texts.map((text) => {
    const word = (Object.keys(SCORES) as (keyof typeof SCORES)[]).find((w) =>
      text.includes(w),
    );
    return match(word ? SCORES[word] : 0);
  });

const cell = (text: string) =>
  `<div data-testid="cellInnerDiv"><article><div data-testid="tweetText"><span>${text}</span></div></article></div>`;

const post = (word: string): HTMLElement =>
  [...document.querySelectorAll<HTMLElement>('[data-testid="cellInnerDiv"]')].find((el) =>
    el.textContent?.includes(word),
  )!;

const store: FeedbackStore = {
  load: async () => EMPTY_FEEDBACK,
  save: async () => {},
  onChange: () => {},
};

let filter: FeedFilter | undefined;

async function run(
  settings: Settings,
  texts: string[],
  score: (texts: string[]) => Promise<RatedMatch[]> = async (t) => scored(t),
  state: EngineState = 'ready',
  onHiddenChange?: (count: number) => void,
) {
  document.body.innerHTML = texts.map(cell).join('');
  const engine = {
    ready: state === 'ready',
    status: { type: 'STATUS', state },
    connect: vi.fn(),
    restart: vi.fn(),
    setTopics: vi.fn(),
    score: vi.fn(score),
    feedback: vi.fn(),
  };
  const tuner = await Tuning.load(store);
  filter = new FeedFilter({
    adapter: xAdapter,
    engine: engine as Engine,
    tuner,
    settings,
    detectLanguage: async () => ({ isReliable: false, languages: [] }),
    t,
    onHiddenChange,
  });
  filter.start();
  await vi.advanceTimersByTimeAsync(200);
  return { engine, filter };
}

describe('FeedFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', InView);
  });

  afterEach(() => {
    filter?.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('blurs what the engine scores off topic and leaves the rest', async () => {
    await run(SETTINGS, ['rust ships a new borrow checker', 'a chocolate cake recipe']);
    expect(isBlurred(post('cake'))).toBe(true);
    expect(isBlurred(post('rust'))).toBe(false);
  });

  it('fails open when the engine answers nothing, and leaves nothing dimmed', async () => {
    await run(SETTINGS, ['a chocolate cake recipe'], async () => []);
    expect(isBlurred(post('cake'))).toBe(false);
    expect(post('cake').classList.contains('lx-pending')).toBe(false);
  });

  it('holds a post from the moment it is found, before the engine has warmed', async () => {
    await run(SETTINGS, ['a chocolate cake recipe'], undefined, 'warming');
    expect(post('cake').classList.contains('lx-pending')).toBe(true);
  });

  it('lifts what it held when a first-run download starts', async () => {
    const { filter } = await run(
      SETTINGS,
      ['a chocolate cake recipe'],
      undefined,
      'warming',
    );
    filter.engineChanged('downloading');
    expect(post('cake').classList.contains('lx-pending')).toBe(false);
  });

  it('does not hold a post found during a first-run download', async () => {
    await run(SETTINGS, ['a chocolate cake recipe'], undefined, 'downloading');
    expect(post('cake').classList.contains('lx-pending')).toBe(false);
  });

  it('counts the posts it hides, and stops counting one the reader reveals', async () => {
    const counts: number[] = [];
    const { filter } = await run(
      SETTINGS,
      ['rust ships a new borrow checker', 'a chocolate cake recipe'],
      undefined,
      'ready',
      (n) => counts.push(n),
    );
    expect(counts.at(-1)).toBe(1);
    filter.revealed(post('cake'));
    expect(counts.at(-1)).toBe(0);
  });

  it('counts a post once however many nodes carry it', async () => {
    const counts: number[] = [];
    await run(
      SETTINGS,
      ['a chocolate cake recipe', 'a chocolate cake recipe'],
      undefined,
      'ready',
      (n) => counts.push(n),
    );
    expect(counts.at(-1)).toBe(1);
  });

  it('counts nothing once the engine fails', async () => {
    const counts: number[] = [];
    const { filter } = await run(
      SETTINGS,
      ['a chocolate cake recipe'],
      undefined,
      'ready',
      (n) => counts.push(n),
    );
    filter.engineChanged('error');
    expect(counts.at(-1)).toBe(0);
  });

  it('reveals every blurred post when the engine fails', async () => {
    const { filter } = await run(SETTINGS, ['a chocolate cake recipe']);
    expect(isBlurred(post('cake'))).toBe(true);
    filter.engineChanged('error');
    expect(isBlurred(post('cake'))).toBe(false);
  });

  it('moves the threshold over cached scores without asking the engine again', async () => {
    const { engine, filter } = await run(SETTINGS, ['a borderline post']);
    expect(isBlurred(post('borderline'))).toBe(true);

    filter.applySettings({ ...SETTINGS, strictness: 0 });

    expect(isBlurred(post('borderline'))).toBe(false);
    expect(engine.score).toHaveBeenCalledTimes(1);
  });

  it('does nothing when only the popup language changes', async () => {
    const { engine, filter } = await run(SETTINGS, ['a chocolate cake recipe']);
    const connects = engine.connect.mock.calls.length;

    filter.applySettings({ ...SETTINGS, language: 'es' });

    expect(engine.connect).toHaveBeenCalledTimes(connects);
    expect(engine.restart).not.toHaveBeenCalled();
    expect(engine.score).toHaveBeenCalledTimes(1);
    expect(isBlurred(post('cake'))).toBe(true);
  });

  it('discards scores measured against topics that have since changed', async () => {
    let answerOld: (matches: RatedMatch[]) => void = () => {};
    const calls: Promise<RatedMatch[]>[] = [
      new Promise((resolve) => (answerOld = resolve)),
      new Promise(() => {}),
    ];
    const { engine, filter } = await run(
      SETTINGS,
      ['a chocolate cake recipe'],
      async () => calls.shift()!,
    );

    filter.applySettings({ ...SETTINGS, topics: ['baking'] });
    await vi.advanceTimersByTimeAsync(200);
    answerOld([match(0.1)]);
    await vi.advanceTimersByTimeAsync(0);

    expect(engine.setTopics).toHaveBeenLastCalledWith(['baking'], []);
    expect(isBlurred(post('cake'))).toBe(false);
  });

  it('leaves posts still waiting on the engine alone when a setting changes', async () => {
    // Twelve posts, a batch of five: one batch scored and blurred, the other seven
    // held behind an engine that never answers again.
    const stalled = new Promise<RatedMatch[]>(() => {});
    let calls = 0;
    const texts = Array.from({ length: 12 }, (_, i) => `a chocolate cake recipe ${i}`);
    const { engine, filter } = await run(
      { ...SETTINGS, showScores: true },
      texts,
      async (t) => (calls++ === 0 ? scored(t) : stalled),
    );
    const cells = [
      ...document.querySelectorAll<HTMLElement>('[data-testid="cellInnerDiv"]'),
    ];
    const before = cells.map((cell) => cell.className);
    const asked = engine.score.mock.calls.length;
    expect(before.filter((c) => c.includes('lx-blur'))).toHaveLength(5);
    expect(before.filter((c) => c.includes('lx-pending'))).toHaveLength(7);

    filter.applySettings({ ...SETTINGS, showScores: false });
    await vi.advanceTimersByTimeAsync(200);

    expect(cells.map((cell) => cell.className)).toEqual(before);
    expect(engine.score).toHaveBeenCalledTimes(asked);
    expect(engine.setTopics).toHaveBeenCalledTimes(1);
    expect(cells.some((cell) => cell.dataset.lxScore !== undefined)).toBe(false);
  });

  it('reveals everything and drops the score badges when turned off', async () => {
    const { filter } = await run({ ...SETTINGS, showScores: true }, [
      'a chocolate cake recipe',
    ]);
    expect(isBlurred(post('cake'))).toBe(true);
    expect(post('cake').dataset.lxScore).toBeDefined();

    filter.applySettings({ ...SETTINGS, showScores: true, enabled: false });

    expect(isBlurred(post('cake'))).toBe(false);
    expect(post('cake').dataset.lxScore).toBeUndefined();
  });
});
