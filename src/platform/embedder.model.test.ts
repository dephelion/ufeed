/**
 * Runs the real model. Excluded from `npm test`; run with `npm run test:model`.
 * Guards the premise the whole product rests on: that a topic string separates
 * on-topic from off-topic feed text. A regression here is not a bug in our code,
 * it is the approach failing, and it should be loud.
 */
import { describe, expect, it } from 'vitest';
import { Embedder } from './embedder';
import {
  DEFAULT_MODEL,
  DEFAULT_STRICTNESS,
  formatPost,
  formatTopic,
  modelFor,
} from '../core/models';

import { bestMatch, cosine, thresholdForStrictness } from '../core/scoring';

const MODEL = modelFor(DEFAULT_MODEL);

const q = (t: string) => formatTopic(t, MODEL);
const d = (t: string) => formatPost(t, MODEL);
const THRESHOLD = thresholdForStrictness(DEFAULT_STRICTNESS, MODEL);

const embedder = new Embedder();
const vectorsFor = async (texts: string[]) => {
  await embedder.load(MODEL, undefined, 'cpu');
  return embedder.embed(texts);
};

const POLITICS =
  '"Fascist!" "Racist!" "Bullshit!" Left-wing Bundestag member Cansin Köktürk ' +
  'receives several calls to order during the speech by René Springer (AfD) ' +
  'and is ejected from the Bundestag.';

const HOUSING =
  'Esta es la legislatura de la vivienda. 3.000 nuevas viviendas de alquiler ' +
  'asequible, 600 para los más vulnerables; hasta 30.000 viviendas a rehabilitar.';

const TECH = 'JavaScript natively supports shared-memory multithreading';

describe('scoring real feed text', { timeout: 120_000 }, () => {
  it('keeps a political post below the threshold', async () => {
    const [topic, post] = await vectorsFor([q('tech, software, ai'), d(POLITICS)]);
    expect(cosine(topic!, post!)).toBeLessThan(THRESHOLD);
  });

  it('keeps a Spanish housing post below the threshold', async () => {
    const [topic, post] = await vectorsFor([q('tech, software, ai'), d(HOUSING)]);
    expect(cosine(topic!, post!)).toBeLessThan(THRESHOLD);
  });

  it('ranks a tech post above a political one for the same topic', async () => {
    const [topic, tech, politics] = await vectorsFor([
      q('tech, software, ai'),
      d(TECH),
      d(POLITICS),
    ]);
    expect(cosine(topic!, tech!)).toBeGreaterThan(cosine(topic!, politics!));
  });

  it('separates better with a richer topic string than a single word', async () => {
    const [single, rich, tech, politics] = await vectorsFor([
      q('tech'),
      q('tech, software, ai'),
      d(TECH),
      d(POLITICS),
    ]);
    const singleGap = cosine(single!, tech!) - cosine(single!, politics!);
    const richGap = cosine(rich!, tech!) - cosine(rich!, politics!);
    expect(richGap).toBeGreaterThan(singleGap);
  });

  it('takes the closest topic when several are set', async () => {
    const [cooking, tech, post] = await vectorsFor([
      q('cooking recipes'),
      q('tech'),
      d(TECH),
    ]);
    const { score } = bestMatch(post!, [cooking!, tech!]);
    expect(score).toBeCloseTo(Math.max(cosine(cooking!, post!), cosine(tech!, post!)), 5);
  });

  it('separates tech from politics under either phrasing, which is what matters', async () => {
    const [single, rich, tech, politics] = await vectorsFor([
      q('tech'),
      q('tech, software, ai'),
      d(TECH),
      d(POLITICS),
    ]);
    expect(cosine(single!, tech!) - cosine(single!, politics!)).toBeGreaterThan(0);
    expect(cosine(rich!, tech!) - cosine(rich!, politics!)).toBeGreaterThan(0);
  });

  it('scores a post the same alone and among other posts', async () => {
    const [topic] = await vectorsFor([q('tech, software, ai')]);
    const [alone] = await vectorsFor([d(POLITICS)]);
    const among = await vectorsFor([d(TECH), d(HOUSING), d(POLITICS)]);
    // Batched q8 moved this by 0.002-0.006; six digits catches any return of that.
    expect(cosine(topic!, among[2]!)).toBeCloseTo(cosine(topic!, alone!), 6);
  });

  it('self-check passes on a backend that computes correctly', async () => {
    await embedder.load(MODEL, undefined, 'cpu');
    const probe = await embedder.selfCheck();
    expect(probe.ok).toBe(true);
    expect(probe.near).toBeGreaterThan(probe.far);
  });

  it("self-check clears this model's gap by a real margin", async () => {
    await embedder.load(MODEL, undefined, 'cpu');
    const probe = await embedder.selfCheck();
    // Absolute scores differ per model; the gap is what a broken backend collapses.
    expect(probe.near - probe.far).toBeGreaterThan(MODEL.probeMinGap);
    expect(probe.near).toBeGreaterThan(MODEL.probeMinNear);
  });
});

/**
 * The second model, through the shipped Embedder rather than a spike harness:
 * a different graph, different prefixes, and its own pooled output. Downloads
 * ~197MB the first time, which is why this suite is never part of `npm test`.
 */
describe('EmbeddingGemma, the multilingual model', { timeout: 600_000 }, () => {
  const GEMMA = modelFor('gemma');
  const gq = (t: string) => formatTopic(t, GEMMA);
  const gd = (t: string) => formatPost(t, GEMMA);
  const GEMMA_THRESHOLD = thresholdForStrictness(DEFAULT_STRICTNESS, GEMMA);

  const gemma = new Embedder();
  const vectors = async (texts: string[]) => {
    await gemma.load(GEMMA, undefined, 'cpu');
    return gemma.embed(texts);
  };

  it('loads and passes its own probe, which is what lets a backend be trusted', async () => {
    await gemma.load(GEMMA, undefined, 'cpu');
    const probe = await gemma.selfCheck();
    expect(probe.ok).toBe(true);
    expect(probe.near - probe.far).toBeGreaterThan(GEMMA.probeMinGap);
  });

  it("returns vectors of its own width, not the default model's", async () => {
    const [v] = await vectors([gd(TECH)]);
    expect(v).toHaveLength(GEMMA.dim);
    expect(GEMMA.dim).not.toBe(MODEL.dim);
  });

  it('reads a Spanish post against a Spanish topic, which is the whole point', async () => {
    const [housing, wanted, unwanted] = await vectors([
      gd(HOUSING),
      gq('vivienda, alquiler'),
      gq('videojuegos, consolas'),
    ]);
    expect(cosine(wanted!, housing!)).toBeGreaterThan(cosine(unwanted!, housing!));
    expect(cosine(wanted!, housing!)).toBeGreaterThan(GEMMA_THRESHOLD);
  });

  it('matches across languages: a Spanish topic claims an English post', async () => {
    const [tech, politics, topic] = await vectors([
      gd(TECH),
      gd(POLITICS),
      gq('tecnologia, software'),
    ]);
    expect(cosine(topic!, tech!)).toBeGreaterThan(cosine(topic!, politics!));
  });

  it('still separates within English, so multilingual costs no English accuracy', async () => {
    const [tech, politics, topic] = await vectors([
      gd(TECH),
      gd(POLITICS),
      gq('tech, software, ai'),
    ]);
    expect(cosine(topic!, tech!)).toBeGreaterThan(cosine(topic!, politics!));
  });

  it("scores in its own calibrated band, nowhere near the default model's", async () => {
    const [tech, topic] = await vectors([gd(TECH), gq('tech, software, ai')]);
    const score = cosine(topic!, tech!);
    expect(score).toBeGreaterThan(thresholdForStrictness(0, GEMMA));
    // e5's loosest step; a Gemma score reaching it would mean the tables were swapped.
    expect(score).toBeLessThan(thresholdForStrictness(0, MODEL));
  });

  it('scores a post the same alone and among other posts', async () => {
    const [topic] = await vectors([gq('tech, software, ai')]);
    const [alone] = await vectors([gd(POLITICS)]);
    const among = await vectors([gd(TECH), gd(HOUSING), gd(POLITICS)]);
    expect(cosine(topic!, among[2]!)).toBeCloseTo(cosine(topic!, alone!), 6);
  });
});
