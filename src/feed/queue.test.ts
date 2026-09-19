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
});
