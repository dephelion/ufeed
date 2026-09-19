import { describe, expect, it, vi } from 'vitest';

const store: Record<string, unknown> = {};
const listeners: ((c: Record<string, { newValue: unknown }>, a: string) => void)[] = [];

vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
        set: async (patch: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(patch)) {
            store[key] = value;
            listeners.forEach((l) => l({ [key]: { newValue: value } }, 'local'));
          }
        },
        remove: async (key: string) => {
          delete store[key];
          listeners.forEach((l) => l({ [key]: { newValue: undefined } }, 'local'));
        },
      },
      onChanged: {
        addListener: (l: never) => listeners.push(l),
        removeListener: () => {},
      },
    },
  },
}));

const { DEFAULT_MODEL, modelFor } = await import('../core/models');
const MODEL = modelFor(DEFAULT_MODEL);

/** Which model the simulated tab is scoring with; a switch moves it. */
let current: 'e5-small' | 'gemma' = DEFAULT_MODEL;
const { hashText } = await import('../core/cache');
const { EMPTY_FEEDBACK, count, findRating, rate } = await import('../core/feedback');
const {
  clearFeedback,
  feedbackStoreFor,
  loadFeedback,
  loadSettings,
  saveFeedback,
  saveSettings,
} = await import('../platform/storage');
const { exportConfig, importConfig } = await import('../core/config-transfer');
const { Tuning } = await import('./tuning');

const vector = (n: number) =>
  Array.from({ length: MODEL.dim }, (_, i) => Math.sin(n + i) / 8);

/**
 * A feed tab held its corrections in memory and never re-read them, so the next
 * thumb wrote that copy back over anything the popup had just done.
 */
describe('a feed tab open while storage changes underneath it', () => {
  it('keeps an imported backup, and does not restore what it replaced', async () => {
    await saveSettings({ topics: ['software engineering'], strictness: 4 });
    let mine = EMPTY_FEEDBACK;
    for (let i = 0; i < 8; i++)
      mine = rate(mine, 'software engineering', `mine${i}`, vector(i), true);
    await saveFeedback(MODEL, mine);

    const tuner = await Tuning.load(feedbackStoreFor(() => current));
    const backup = exportConfig(await loadSettings(), mine, '0.0.0');

    await clearFeedback();
    const result = importConfig(backup);
    if (!result.ok) throw new Error(result.reason);
    await saveFeedback(modelFor(result.settings.model), result.feedback);

    await tuner.record(
      'software engineering',
      'a post rated after the import',
      vector(99),
      true,
    );

    const stored = await loadFeedback(MODEL);
    expect(count(stored)).toBe(9);
    expect(findRating(stored, hashText('a post rated after the import'))).toEqual({
      topic: 'software engineering',
      liked: true,
    });
  });

  it('keeps a cleared set cleared', async () => {
    await saveFeedback(MODEL, rate(EMPTY_FEEDBACK, 'topic', 'old', vector(1), true));
    const tuner = await Tuning.load(feedbackStoreFor(() => current));

    await clearFeedback();
    await tuner.record('topic', 'a post rated after the clear', vector(2), true);

    expect(count(await loadFeedback(MODEL))).toBe(1);
  });

  it('tells the tab when a clear elsewhere changed what its lines hold', async () => {
    await saveFeedback(MODEL, rate(EMPTY_FEEDBACK, 'topic', 'old', vector(1), false));
    const tuner = await Tuning.load(feedbackStoreFor(() => current));
    const before = tuner.signature(['topic']);
    let told = 0;
    tuner.onChange(() => (told += 1));

    await clearFeedback();

    expect(told).toBe(1);
    expect(tuner.signature(['topic'])).not.toBe(before);
  });
});

describe('a model change', () => {
  it("keeps each model's ratings and shows only the running one's", async () => {
    const gemma = modelFor('gemma');
    await saveSettings({ topics: ['software engineering'], strictness: 4 });
    await saveFeedback(
      MODEL,
      rate(EMPTY_FEEDBACK, 'software engineering', 'k', vector(1), true),
    );

    await saveSettings({ model: 'gemma' });
    expect(count(await loadFeedback(gemma))).toBe(0);

    await saveFeedback(
      gemma,
      rate(EMPTY_FEEDBACK, 'software engineering', 'g', vector(2), false),
    );
    expect(count(await loadFeedback(gemma))).toBe(1);

    // Switching back restores what the first model wrote, untouched.
    await saveSettings({ model: 'e5-small' });
    expect(count(await loadFeedback(MODEL))).toBe(1);

    const settings = await loadSettings();
    expect(settings.topics).toEqual(['software engineering']);
    expect(settings.strictness).toBe(4);
  });

  it("clears every model's ratings when no model is named", async () => {
    const gemma = modelFor('gemma');
    await saveFeedback(MODEL, rate(EMPTY_FEEDBACK, 't', 'a', vector(1), true));
    await saveFeedback(gemma, rate(EMPTY_FEEDBACK, 't', 'b', vector(2), true));

    await clearFeedback();

    expect(count(await loadFeedback(MODEL))).toBe(0);
    expect(count(await loadFeedback(gemma))).toBe(0);
  });

  it('clears only the model it is given', async () => {
    const gemma = modelFor('gemma');
    await saveFeedback(MODEL, rate(EMPTY_FEEDBACK, 't', 'a', vector(1), true));
    await saveFeedback(gemma, rate(EMPTY_FEEDBACK, 't', 'b', vector(2), true));

    await clearFeedback(gemma);

    expect(count(await loadFeedback(MODEL))).toBe(1);
    expect(count(await loadFeedback(gemma))).toBe(0);
  });
});
