import { afterEach, describe, expect, it } from 'vitest';
import type { Engine } from './ports';
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

const connected = () => document.body.appendChild(document.createElement('div'));

afterEach(() => document.body.replaceChildren());

describe('ScoreQueue', () => {
  it('embeds a long post capped, but hands back the whole post it was given', async () => {
    const results: Scored[] = [];
    const queue = new ScoreQueue(
      engine,
      (r) => results.push(...r),
      () => 16,
    );
    const post = { container: connected(), text: 'x'.repeat(5000) };

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
    for (let i = 0; i < 3; i++) queue.add({ container: connected(), text: `post ${i}` });
    await Promise.resolve();
    expect(sent.at(-1)).toHaveLength(3);

    // A model switch changes it under a live queue, so it is read per flush.
    size = 2;
    for (let i = 0; i < 2; i++) queue.add({ container: connected(), text: `later ${i}` });
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
    for (let i = 0; i < 6; i++) queue.add({ container: connected(), text: `post ${i}` });
    await Promise.resolve();

    // Six posts, a batch of two: without the guard all three went out at once and
    // the last two spent the engine's timeout waiting on the first.
    expect(inFlight).toHaveLength(1);

    release?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(inFlight).toHaveLength(2);
  });

  it('scores visible posts top to bottom before posts in the lookahead area', async () => {
    let release: (() => void) | undefined;
    const order: string[] = [];
    const slow = {
      ready: true,
      status: { type: 'STATUS', state: 'ready' },
      score: (texts: string[]) => {
        order.push(...texts);
        if (order.length > 1) return Promise.resolve(texts.map(() => undefined));
        return new Promise<undefined[]>((resolve) => {
          release = () => resolve([undefined]);
        });
      },
    } as unknown as Engine;
    const queue = new ScoreQueue(
      slow,
      () => {},
      () => 1,
    );
    const addAt = (text: string, top: number, bottom: number) => {
      const container = connected();
      container.getBoundingClientRect = () => ({ top, bottom }) as DOMRect;
      queue.add({ container, text });
    };

    addAt('running', 0, 100);
    await new Promise((resolve) => setTimeout(resolve, 0));
    addAt('below', window.innerHeight + 500, window.innerHeight + 600);
    addAt('visible lower', 300, 400);
    addAt('above', -200, -100);
    addAt('visible upper', 50, 150);
    addAt('visible upper tie', 50, 150);
    release?.();
    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(order).toEqual([
      'running',
      'visible upper',
      'visible upper tie',
      'visible lower',
      'above',
      'below',
    ]);
  });

  it('collects posts in one scan before sending the first single-post request', async () => {
    const order: string[] = [];
    const single = {
      ready: true,
      status: { type: 'STATUS', state: 'ready' },
      score: async (texts: string[]) => {
        order.push(...texts);
        return texts.map(() => undefined);
      },
    } as unknown as Engine;
    const queue = new ScoreQueue(
      single,
      () => {},
      () => 1,
    );
    const below = connected();
    below.getBoundingClientRect = () =>
      ({ top: window.innerHeight + 200, bottom: window.innerHeight + 300 }) as DOMRect;
    const visible = connected();
    visible.getBoundingClientRect = () => ({ top: 100, bottom: 200 }) as DOMRect;

    queue.add({ container: below, text: 'prefetched' });
    queue.add({ container: visible, text: 'visible' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 4; i++) await Promise.resolve();

    expect(order).toEqual(['visible', 'prefetched']);
  });

  it('skips detached backlog entries so a connected post reaches the next batch', async () => {
    let release: (() => void) | undefined;
    const sent: string[][] = [];
    const slow = {
      ready: true,
      status: { type: 'STATUS', state: 'ready' },
      score: (texts: string[]) => {
        sent.push(texts);
        if (sent.length > 1) return Promise.resolve(texts.map(() => undefined));
        return new Promise<undefined[]>((resolve) => {
          release = () => resolve(texts.map(() => undefined));
        });
      },
    } as unknown as Engine;
    const queue = new ScoreQueue(
      slow,
      () => {},
      () => 2,
    );

    queue.add({ container: connected(), text: 'running 1' });
    queue.add({ container: connected(), text: 'running 2' });
    const stale = Array.from({ length: 3 }, (_, i) => ({
      container: connected(),
      text: `stale ${i}`,
    }));
    for (const post of stale) queue.add(post);
    queue.add({ container: connected(), text: 'visible' });
    for (const post of stale) post.container.remove();

    release?.();
    for (let i = 0; i < 8; i++) await Promise.resolve();

    expect(sent).toEqual([['running 1', 'running 2'], ['visible']]);
  });

  it('keeps the posts it could not send yet, rather than dropping them', async () => {
    const seen: Scored[] = [];
    const queue = new ScoreQueue(
      engine,
      (r) => seen.push(...r),
      () => 2,
    );
    for (let i = 0; i < 4; i++) queue.add({ container: connected(), text: `post ${i}` });

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
    for (let i = 0; i < 4; i++) queue.add({ container: connected(), text: `post ${i}` });

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
    queue.add({ container: connected(), text: 'a' });
    queue.add({ container: connected(), text: 'b' });
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
    for (let i = 0; i < 6; i++) queue.add({ container: connected(), text: `post ${i}` });
    await Promise.resolve();

    release?.();
    for (let i = 0; i < 8; i++) await Promise.resolve();

    // A post waiting its turn is no more judged than the one at the engine.
    expect(held.at(-1)).toEqual(['post 2', 'post 3', 'post 4', 'post 5']);
  });
});
