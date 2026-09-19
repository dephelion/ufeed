import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { xAdapter } from '../adapters/x';
import { DEFAULT_SETTINGS, type Settings } from '../core/settings';
import type { RatedMatch } from '../ml/scoring';
import { isBlurred } from './blur';
import { FeedFilter, type Engine } from './filter';
import { Tuning } from './tuning';

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

let filter: FeedFilter | undefined;

async function run(
  settings: Settings,
  texts: string[],
  score: (texts: string[]) => Promise<RatedMatch[]> = async (t) => scored(t),
) {
  document.body.innerHTML = texts.map(cell).join('');
  const engine = {
    ready: true,
    status: { type: 'STATUS', state: 'ready' },
    connect: vi.fn(),
    setTopics: vi.fn(),
    score: vi.fn(score),
    feedback: vi.fn(),
  };
  const tuner = await Tuning.load();
  filter = new FeedFilter({
    adapter: xAdapter,
    engine: engine as Engine,
    tuner,
    settings,
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
