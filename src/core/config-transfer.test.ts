import { describe, expect, it } from 'vitest';
import { MODEL } from '../ml/models';
import { SCHEMA, exportConfig, importConfig } from './config-transfer';
import { EMPTY_FEEDBACK, MAX_PER_CLASS, type Feedback, type Rating } from './feedback';
import { DEFAULT_SETTINGS, type Settings } from './settings';

const APP = '1.2.3';

const vector = (seed: number): number[] =>
  Array.from({ length: MODEL.dim }, (_, i) => Math.sin(seed + i) / 8);

const rating = (n: number, liked = true): Rating => ({
  key: `k${n}`,
  liked,
  vector: vector(n),
});

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  topics: ['software engineering', 'climbing'],
  strictness: 4,
  alwaysKeep: ['rust'],
  tuneFromFeedback: true,
};

const feedback: Feedback = {
  ...EMPTY_FEEDBACK,
  byTopic: { 'software engineering': [rating(1), rating(2, false)] },
};

const roundTrip = (s = settings, f = feedback) => importConfig(exportConfig(s, f, APP));

describe('round trip', () => {
  it('restores the settings it was given', () => {
    const result = roundTrip();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.settings).toEqual(settings);
  });

  it('restores every rating, with the vectors intact', () => {
    const result = roundTrip();
    if (!result.ok) throw new Error(result.reason);
    const restored = result.feedback.byTopic['software engineering'];
    expect(restored?.map((r) => ({ key: r.key, liked: r.liked }))).toEqual([
      { key: 'k1', liked: true },
      { key: 'k2', liked: false },
    ]);
    // float32 is what the engine produced; the file must not add error of its own.
    restored?.forEach((r, i) => {
      const original = [rating(1), rating(2, false)][i]!.vector;
      r.vector.forEach((v, j) => expect(v).toBeCloseTo(original[j]!, 6));
    });
  });

  it('stamps the running model', () => {
    const file = JSON.parse(exportConfig(settings, feedback, APP));
    expect(file.model).toEqual({ id: MODEL.id, dim: MODEL.dim });
    expect(file.schema).toBe(SCHEMA);
  });
});

describe('a file that cannot be trusted', () => {
  const refused = (text: string) => {
    const result = importConfig(text);
    expect(result.ok).toBe(false);
    return result.ok ? '' : result.reason;
  };

  it('refuses junk', () => {
    expect(refused('not json at all')).toBe('not a FeedLens backup');
    expect(refused('{}')).toBe('not a FeedLens backup');
    expect(refused('[]')).toBe('not a FeedLens backup');
  });

  it('refuses a truncated file', () => {
    const whole = exportConfig(settings, feedback, APP);
    expect(refused(whole.slice(0, whole.length / 2))).toBe('not a FeedLens backup');
  });

  it('refuses a schema it does not know', () => {
    const file = JSON.parse(exportConfig(settings, feedback, APP));
    expect(refused(JSON.stringify({ ...file, schema: SCHEMA + 1 }))).toBe(
      'made by a newer version',
    );
  });

  it('refuses another model whole, settings included', () => {
    const file = JSON.parse(exportConfig(settings, feedback, APP));
    expect(refused(JSON.stringify({ ...file, model: { id: 'other', dim: 384 } }))).toBe(
      'made with a different model',
    );
    expect(refused(JSON.stringify({ ...file, model: { id: MODEL.id, dim: 768 } }))).toBe(
      'made with a different model',
    );
  });
});

describe('a file that is trusted but wrong in places', () => {
  it('drops a rating whose vector is the wrong width', () => {
    const file = JSON.parse(exportConfig(settings, feedback, APP));
    file.feedback['software engineering'][0].vector = btoa('short');
    const result = importConfig(JSON.stringify(file));
    if (!result.ok) throw new Error(result.reason);
    expect(result.feedback.byTopic['software engineering']).toHaveLength(1);
  });

  it('trims a topic that arrives over the cap', () => {
    const many = Array.from({ length: MAX_PER_CLASS + 10 }, (_, i) => rating(i));
    const result = roundTrip(settings, {
      ...EMPTY_FEEDBACK,
      byTopic: { 'software engineering': many },
    });
    if (!result.ok) throw new Error(result.reason);
    const kept = result.feedback.byTopic['software engineering'];
    expect(kept).toHaveLength(MAX_PER_CLASS);
    expect(kept?.[0]?.key).toBe('k10');
  });

  it('drops corrections for topic lines the file does not carry', () => {
    const result = roundTrip(
      { ...settings, topics: ['climbing'] },
      { ...EMPTY_FEEDBACK, byTopic: { 'software engineering': [rating(1)] } },
    );
    if (!result.ok) throw new Error(result.reason);
    expect(result.feedback.byTopic).toEqual({});
  });

  it('repairs settings from an older shape rather than refusing them', () => {
    const file = JSON.parse(exportConfig(settings, feedback, APP));
    file.settings = { topics: ['software engineering'], strictness: 0.35 };
    const result = importConfig(JSON.stringify(file));
    if (!result.ok) throw new Error(result.reason);
    expect(result.settings.strictness).toBe(DEFAULT_SETTINGS.strictness);
    expect(result.settings.blurOtherLanguages).toBe(true);
  });
});
