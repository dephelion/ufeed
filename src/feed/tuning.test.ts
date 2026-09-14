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

const { MODEL } = await import('../ml/models');
const { hashText } = await import('../core/cache');
const { EMPTY_FEEDBACK, count, findRating, rate } = await import('../core/feedback');
const { clearFeedback, loadFeedback, saveFeedback } =
  await import('../core/feedback-storage');
const { loadSettings, saveSettings } = await import('../core/settings-storage');
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
    await saveFeedback(mine);

    const tuner = await Tuning.load();
    const backup = exportConfig(await loadSettings(), mine, '0.0.0');

    await clearFeedback();
    const result = importConfig(backup);
    if (!result.ok) throw new Error(result.reason);
    await saveFeedback(result.feedback);

    await tuner.record(
      'software engineering',
      'a post rated after the import',
      vector(99),
      true,
    );

    const stored = await loadFeedback();
    expect(count(stored)).toBe(9);
    expect(findRating(stored, hashText('a post rated after the import'))).toEqual({
      topic: 'software engineering',
      liked: true,
    });
  });

  it('keeps a cleared set cleared', async () => {
    await saveFeedback(rate(EMPTY_FEEDBACK, 'topic', 'old', vector(1), true));
    const tuner = await Tuning.load();

    await clearFeedback();
    await tuner.record('topic', 'a post rated after the clear', vector(2), true);

    expect(count(await loadFeedback())).toBe(1);
  });
});

describe('a model change', () => {
  it('drops the vectors it cannot read and leaves the settings alone', async () => {
    await saveSettings({ topics: ['software engineering'], strictness: 4 });
    await saveFeedback({
      ...rate(EMPTY_FEEDBACK, 'software engineering', 'k', vector(1), true),
      model: 'Xenova/some-later-model',
    });

    expect(count(await loadFeedback())).toBe(0);
    const settings = await loadSettings();
    expect(settings.topics).toEqual(['software engineering']);
    expect(settings.strictness).toBe(4);
  });
});
