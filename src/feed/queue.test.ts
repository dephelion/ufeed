import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Engine, Post } from './ports';
import { ScoreQueue, type Scored } from './queue';

const sent: string[][] = [];
const engine = {
  ready: true,
  status: { type: 'STATUS', state: 'ready' },
  score: async (texts: string[]) => {
    sent.push(texts);
    return texts.map(() => ({ score: 0.8, topic: 0, lines: [0.8], rating: undefined }));
  },
} as unknown as Engine;

/** A post in the page, optionally at a place on screen: the queue asks where it is. */
function mount(text: string, at?: { top: number; bottom: number }): Post {
  const container = document.createElement('div');
  document.body.append(container);
  if (at) container.getBoundingClientRect = () => ({ ...at }) as DOMRect;
  return { container, text };
}

/** An engine that only records what it was asked, answering nothing. */
function recording(asked: string[][]): Engine {
  return {
    ready: true,
    status: { type: 'STATUS', state: 'ready' },
    score: async (texts: string[]) => {
      asked.push(texts);
      return texts.map(() => undefined);
    },
  } as unknown as Engine;
}

afterEach(() => document.body.replaceChildren());

describe('ScoreQueue', () => {
  it('embeds a long post capped, but hands back the whole post it was given', async () => {
    const results: Scored[] = [];
    const queue = new ScoreQueue(
      engine,
      (r) => results.push(...r),
      () => 16,
    );
    const post = mount('x'.repeat(5000));

    queue.add(post);
    await queue.flush();

    expect(sent.at(-1)?.[0]?.length).toBe(1200);
    expect(results[0]?.post).toBe(post);
  });

  it("flushes as soon as the running model's batch is full, not a fixed number", async () => {
    let size = 3;
    const queue = new ScoreQueue(
      engine,
      () => {},
      () => size,
    );
    for (let i = 0; i < 3; i++) queue.add(mount(`post ${i}`));
    await Promise.resolve();
    expect(sent.at(-1)).toHaveLength(3);

    // A model switch changes it under a live queue, so it is read per flush.
    size = 2;
    for (let i = 0; i < 2; i++) queue.add(mount(`later ${i}`));
    await Promise.resolve();
    expect(sent.at(-1)).toHaveLength(2);
  });

  it('sends one request at a time, so a queued post never waits out its own timeout', async () => {
    let release: (() => void) | undefined;
    const inFlight: string[][] = [];
    const slow = {
      ready: true,
      status: { type: 'STATUS', state: 'ready' },
      score: (texts: string[]) =>
        new Promise((resolve) => {
          inFlight.push(texts);
          release = () => resolve(texts.map(() => undefined));
        }),
    } as unknown as Engine;

    const queue = new ScoreQueue(
      slow,
      () => {},
      () => 2,
    );
    for (let i = 0; i < 6; i++) queue.add(mount(`post ${i}`));
    await Promise.resolve();

    // Six posts, a batch of two: without the guard all three went out at once and
    // the last two spent the engine's timeout waiting on the first.
    expect(inFlight).toHaveLength(1);

    release?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(inFlight).toHaveLength(2);
  });

  it('keeps the posts it could not send yet, rather than dropping them', async () => {
    const seen: Scored[] = [];
    const queue = new ScoreQueue(
      engine,
      (r) => seen.push(...r),
      () => 2,
    );
    for (let i = 0; i < 4; i++) queue.add(mount(`post ${i}`));

    await queue.flush();
    for (let i = 0; i < 8; i++) await Promise.resolve();

    expect(seen).toHaveLength(4);
  });

  it('holds the posts still waiting, not only the batch going out', async () => {
    const held: string[][] = [];
    const queue = new ScoreQueue(
      engine,
      () => {},
      () => 2,
      (posts) => held.push(posts.map((p) => p.text)),
    );
    for (let i = 0; i < 4; i++) queue.add(mount(`post ${i}`));

    await queue.flush();
    for (let i = 0; i < 8; i++) await Promise.resolve();

    // A post waiting its turn is no more judged than the one in front of the
    // engine, so the first flush names all four, not just the two it sends.
    // The first flush fires before posts 2 and 3 are queued, so it names only
    // what it holds then; the second names the batch plus what is still waiting.
    expect(held).toEqual([
      ['post 0', 'post 1'],
      ['post 2', 'post 3'],
    ]);
  });

  it('holds before awaiting the engine, never after the verdict', async () => {
    const order: string[] = [];
    const queue = new ScoreQueue(
      engine,
      () => order.push('scored'),
      () => 2,
      () => order.push('holding'),
    );
    queue.add(mount('a'));
    queue.add(mount('b'));
    await queue.flush();
    for (let i = 0; i < 4; i++) await Promise.resolve();

    expect(order).toEqual(['holding', 'scored']);
  });

  it('holds the posts still waiting behind the batch, not just the batch', async () => {
    let release: (() => void) | undefined;
    const held: string[][] = [];
    const blocked = {
      ready: true,
      status: { type: 'STATUS', state: 'ready' },
      score: (texts: string[]) =>
        new Promise((resolve) => {
          release = () => resolve(texts.map(() => undefined));
        }),
    } as unknown as Engine;

    const queue = new ScoreQueue(
      blocked,
      () => {},
      () => 2,
      (posts) => held.push(posts.map((p) => p.text)),
    );
    // Two go out and block; four more pile up behind them.
    for (let i = 0; i < 6; i++) queue.add(mount(`post ${i}`));
    await Promise.resolve();

    release?.();
    for (let i = 0; i < 8; i++) await Promise.resolve();

    // A post waiting its turn is no more judged than the one at the engine.
    expect(held.at(-1)).toEqual(['post 2', 'post 3', 'post 4', 'post 5']);
  });

  it('sends the posts nearest the viewport first, whatever order they arrived in', async () => {
    const asked: string[][] = [];
    let ready = false;
    const late = {
      get ready() {
        return ready;
      },
      status: { type: 'STATUS', state: 'ready' },
      score: recording(asked).score,
    } as unknown as Engine;
    const h = window.innerHeight;

    const queue = new ScoreQueue(
      late,
      () => {},
      () => 2,
    );
    // Arrival order is the worst case: the two nearest are the last two to come.
    queue.add(mount('far below', { top: h * 5, bottom: h * 5 + 300 }));
    queue.add(mount('just above', { top: -350, bottom: -50 }));
    queue.add(mount('on screen', { top: 100, bottom: 400 }));
    queue.add(mount('just below', { top: h + 130, bottom: h + 430 }));

    ready = true;
    await queue.flush();
    for (let i = 0; i < 8; i++) await Promise.resolve();

    expect(asked).toEqual([
      ['on screen', 'just above'],
      ['just below', 'far below'],
    ]);
  });

  it('drops a post the page has removed instead of scoring it', async () => {
    const asked: string[][] = [];
    const queue = new ScoreQueue(
      recording(asked),
      () => {},
      () => 4,
    );
    const gone = mount('scrolled away');
    queue.add(gone);
    queue.add(mount('still here'));
    gone.container.remove();

    await queue.flush();
    for (let i = 0; i < 8; i++) await Promise.resolve();

    expect(asked).toEqual([['still here']]);
  });

  it('sends nothing, and stays usable, when every waiting post has been removed', async () => {
    const asked: string[][] = [];
    const queue = new ScoreQueue(
      recording(asked),
      () => {},
      () => 4,
    );
    const gone = mount('scrolled away');
    queue.add(gone);
    gone.container.remove();

    await queue.flush();
    expect(asked).toEqual([]);

    // The guard against overlapping requests must not have been left set.
    queue.add(mount('next post'));
    await queue.flush();
    expect(asked).toEqual([['next post']]);
  });
});

describe('ScoreQueue while the page is moving', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits for the page to stop, then aims where the reader ended up', async () => {
    const asked: string[][] = [];
    const queue = new ScoreQueue(
      recording(asked),
      () => {},
      () => 1,
    );
    const h = window.innerHeight;
    const first = mount('was on screen', { top: 100, bottom: 400 });
    const second = mount('far below', { top: h * 5, bottom: h * 5 + 300 });

    queue.moved();
    queue.add(first);
    queue.add(second);
    await vi.advanceTimersByTimeAsync(100);
    expect(asked).toEqual([]);

    // The reader flew down: what was on screen is now far above it.
    first.container.getBoundingClientRect = () =>
      ({ top: -h * 5, bottom: -h * 5 + 300 }) as DOMRect;
    second.container.getBoundingClientRect = () => ({ top: 100, bottom: 400 }) as DOMRect;
    await vi.advanceTimersByTimeAsync(100);

    expect(asked[0]).toEqual(['far below']);
  });

  it('does not hold a batch back for ever when the page never stops moving', async () => {
    const asked: string[][] = [];
    const queue = new ScoreQueue(
      recording(asked),
      () => {},
      () => 4,
    );
    queue.add(mount('a post'));

    for (let t = 0; t < 800; t += 50) {
      queue.moved();
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(asked).toEqual([]);

    for (let t = 0; t < 700; t += 50) {
      queue.moved();
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(asked).toEqual([['a post']]);
  });
});
