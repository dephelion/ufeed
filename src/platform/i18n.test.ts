import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({
  default: {
    i18n: { getMessage: (key: string) => `browser:${key}` },
    runtime: { getURL: (path: string) => path },
  },
}));

const { loadTranslator, translatorFor } = await import('./i18n');

const spanish = JSON.parse(readFileSync('public/_locales/es/messages.json', 'utf8'));

describe('loadTranslator', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the catalog of the language it was asked for', async () => {
    const fetched = vi.fn(async () => ({ json: async () => spanish }));
    vi.stubGlobal('fetch', fetched);

    const t = await loadTranslator('es');

    expect(fetched).toHaveBeenCalledWith('/_locales/es/messages.json');
    expect(t('badgeCount', '3')).toBe('Publicaciones ocultas: 3');
  });

  it('falls back to the browser’s language when the catalog cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    const t = await loadTranslator('es');

    expect(t('badgeOpen')).toBe('browser:badgeOpen');
  });

  it('falls back when the file is not a catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      })),
    );

    const t = await loadTranslator('de');

    expect(t('badgeOpen')).toBe('browser:badgeOpen');
  });
});

describe('translatorFor', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leaves the browser to answer when the reader never picked', async () => {
    const fetched = vi.fn();
    vi.stubGlobal('fetch', fetched);

    const t = await translatorFor('auto');

    expect(t('badgeOpen')).toBe('browser:badgeOpen');
    expect(fetched).not.toHaveBeenCalled();
  });

  it('reads the catalog of a picked language', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => spanish })),
    );

    const t = await translatorFor('es');

    expect(t('badgeCount', '3')).toBe('Publicaciones ocultas: 3');
  });
});
