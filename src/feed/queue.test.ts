import { describe, expect, it } from 'vitest';
import type { Engine } from './ports';
import { MODELS } from '../core/models';
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

describe('ScoreQueue', () => {
  it('embeds a long post capped, but hands back the whole post it was given', async () => {
    const results: Scored[] = [];
    const queue = new ScoreQueue(
      engine,
      (r) => results.push(...r),
      () => 16,
    );
    const post = { container: document.createElement('div'), text: 'x'.repeat(5000) };

    queue.add(post);
    await queue.flush();

    expect(sent.at(-1)?.[0]?.length).toBe(1200);
    expect(results[0]?.post).toBe(post);
  });

  it("flushes as soon as the running model's batch is full, not a fixed 16", async () => {
    let size = 3;
    const queue = new ScoreQueue(
      engine,
      () => {},
      () => size,
    );
    for (let i = 0; i < 3; i++)
      queue.add({ container: document.createElement('div'), text: `post ${i}` });
    await Promise.resolve();
    expect(sent.at(-1)).toHaveLength(3);

    // A model switch changes it under a live queue, so it is read per flush.
    size = 2;
    for (let i = 0; i < 2; i++)
      queue.add({ container: document.createElement('div'), text: `later ${i}` });
    await Promise.resolve();
    expect(sent.at(-1)).toHaveLength(2);
  });

  it('gives the slower model a smaller batch, so a verdict is not a whole second away', () => {
    expect(MODELS.gemma.batchSize).toBeLessThan(MODELS['e5-small'].batchSize);
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
    for (let i = 0; i < 6; i++)
      queue.add({ container: document.createElement('div'), text: `post ${i}` });
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
    for (let i = 0; i < 4; i++)
      queue.add({ container: document.createElement('div'), text: `post ${i}` });

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
    for (let i = 0; i < 4; i++)
      queue.add({ container: document.createElement('div'), text: `post ${i}` });

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
    queue.add({ container: document.createElement('div'), text: 'a' });
    queue.add({ container: document.createElement('div'), text: 'b' });
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
    for (let i = 0; i < 6; i++)
      queue.add({ container: document.createElement('div'), text: `post ${i}` });
    await Promise.resolve();

    release?.();
    for (let i = 0; i < 8; i++) await Promise.resolve();

    // A post waiting its turn is no more judged than the one at the engine.
    expect(held.at(-1)).toEqual(['post 2', 'post 3', 'post 4', 'post 5']);
  });
});
