/**
 * Runs the real model. Excluded from `npm test`; run with `npm run test:model`.
 * Guards the premise the whole product rests on: that a topic string separates
 * on-topic from off-topic feed text. A regression here is not a bug in our code,
 * it is the approach failing, and it should be loud.
 */
import { describe, expect, it } from 'vitest';
import { Embedder } from './embedder';
import { DEFAULT_STRICTNESS, MODEL, formatPost, formatTopic } from './models';
import { bestMatch, cosine, thresholdForStrictness } from './scoring';

const q = formatTopic;
const d = formatPost;
const THRESHOLD = thresholdForStrictness(DEFAULT_STRICTNESS);

const embedder = new Embedder();
const vectorsFor = async (texts: string[]) => {
  await embedder.load(undefined, ['cpu']);
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

  it('self-check passes on a backend that computes correctly', async () => {
    await embedder.load(undefined, ['cpu']);
    const probe = await embedder.selfCheck();
    expect(probe.ok).toBe(true);
    expect(probe.near).toBeGreaterThan(probe.far);
  });

  it("self-check clears this model's gap by a real margin", async () => {
    await embedder.load(undefined, ['cpu']);
    const probe = await embedder.selfCheck();
    // Absolute scores differ per model; the gap is what a broken backend collapses.
    expect(probe.near - probe.far).toBeGreaterThan(MODEL.probeMinGap);
    expect(probe.near).toBeGreaterThan(MODEL.probeMinNear);
  });
});
