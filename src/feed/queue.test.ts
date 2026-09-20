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
});
