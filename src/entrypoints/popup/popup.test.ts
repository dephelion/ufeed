import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { LANGUAGES } from '../../core/languages';
import { DEFAULT_SETTINGS, type Settings } from '../../core/settings';

const store: Record<string, unknown> = {};
const listeners: unknown[] = [];
vi.mock('webextension-polyfill', async () => ({
  default: {
    // The English catalog from vitest.setup.ts.
    i18n: (await import('wxt/testing/fake-browser')).fakeBrowser.i18n,
    runtime: {
      getURL: (path: string) => path,
      getManifest: () => ({ version: '9.9.9' }),
      sendMessage: async () => undefined,
      onMessage: { addListener: () => {}, removeListener: () => {} },
    },
    tabs: { query: async () => [{ id: 1, url: 'https://x.com/home' }] },
    storage: {
      local: {
        get: async (k: string) => (k in store ? { [k]: store[k] } : {}),
        set: async (o: Record<string, unknown>) => Object.assign(store, o),
        remove: async (k: string) => void delete store[k],
      },
      onChanged: {
        addListener: (l: unknown) => listeners.push(l),
        removeListener: () => {},
      },
    },
  },
}));

// The popup reads its language's catalog from the extension package; here, from disk.
vi.stubGlobal('fetch', async (url: string) => ({
  json: async () => JSON.parse(readFileSync(`public${url}`, 'utf8')),
}));

const html = readFileSync('src/entrypoints/popup/index.html', 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

let downloaded: { name: string; text: string } | undefined;
globalThis.URL.createObjectURL = ((blob: Blob) => {
  void blob.text().then((text) => {
    downloaded = { name: downloaded?.name ?? '', text };
  });
  return 'blob:fake';
}) as never;
globalThis.URL.revokeObjectURL = (() => {}) as never;
HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
  downloaded = { name: this.download, text: downloaded?.text ?? '' };
};

store['settings'] = {
  topics: ['software engineering'],
  strictness: 3,
};
store['feedback'] = {
  model: 'Xenova/e5-small-v2',
  dim: 384,
  byTopic: {
    'software engineering': [
      { key: 'a', liked: true, vector: Array.from({ length: 384 }, (_, i) => i / 1000) },
    ],
  },
};

await import('./popup');
const tick = () => new Promise((r) => setTimeout(r, 20));
await tick();

const el = (id: string) => document.getElementById(id)!;

/** The only cover the popup's file handling gets: no suite loads the real page. */
describe('the backup row in a rendered popup', () => {
  it('exports a named file holding the current config', async () => {
    (el('export') as HTMLButtonElement).click();
    await tick();
    expect(downloaded?.name).toMatch(/^ufeed-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(downloaded!.text);
    expect(file.app).toBe('9.9.9');
    expect(file.settings.topics).toEqual(['software engineering']);
    expect(file.settings.language).toBe('auto');
    expect(Object.keys(file.feedback['software engineering'])).toHaveLength(1);
    // An anchor download reports nothing back, so the popup claims nothing:
    // the save dialog may still be open, and may be cancelled.
    expect(el('transfer').hidden).toBe(true);
  });

  it('imports a file back, replacing what was there', async () => {
    const backup = downloaded!.text;
    store['settings'] = { topics: ['knitting'], strictness: 9 };
    store['feedback'] = undefined;

    const input = el('import-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [
        { name: 'ufeed-backup-2026-09-14.json', text: async () => backup },
      ] as unknown as FileList,
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await tick();

    expect((store['settings'] as { topics: string[] }).topics).toEqual([
      'software engineering',
    ]);
    expect((store['settings'] as { strictness: number }).strictness).toBe(3);
    expect((el('topics') as HTMLTextAreaElement).value).toBe('software engineering');
    expect(el('stat-total').textContent).toBe('1');
    expect(el('transfer-name').textContent).toBe('ufeed-backup-2026-09-14.json');
    expect(el('transfer').dataset['state']).toBe('ok');
  });

  it('refuses a file that is not a backup, and changes nothing', async () => {
    const before = JSON.stringify(store['settings']);
    const input = el('import-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [
        { name: 'holiday.json', text: async () => '{"hello":1}' },
      ] as unknown as FileList,
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await tick();

    expect(el('transfer').dataset['state']).toBe('bad');
    expect(JSON.stringify(store['settings'])).toBe(before);
  });
});

describe('the language checkbox in a rendered popup', () => {
  const box = () => document.getElementById('blur-other-languages') as HTMLInputElement;
  const pick = async (key: string) => {
    const select = document.getElementById('model') as HTMLSelectElement;
    select.value = key;
    select.dispatchEvent(new Event('change'));
    await tick();
  };

  it('is shown off and disabled on the multilingual model, and comes back after', async () => {
    box().checked = true;
    box().dispatchEvent(new Event('change'));
    await tick();
    expect(box().disabled).toBe(false);

    await pick('gemma');
    expect(box().disabled).toBe(true);
    expect(box().checked).toBe(false);
    expect(
      (store['settings'] as { blurOtherLanguages: boolean }).blurOtherLanguages,
    ).toBe(true);

    await pick('e5-small');
    expect(box().disabled).toBe(false);
    expect(box().checked).toBe(true);
  });
});

describe('the language menu in a rendered popup', () => {
  const picker = () => el('language') as HTMLSelectElement;
  const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
  const choose = async (code: string) => {
    picker().value = code;
    picker().dispatchEvent(new Event('change'));
    await tick();
  };

  it('offers every language with its flag first', () => {
    const labels = [...picker().options].map((option) => option.textContent ?? '');
    expect(labels).toHaveLength(LANGUAGES.length);
    for (const label of labels) expect(label).toMatch(/^\p{Regional_Indicator}{2} \S/u);
    expect(labels[0]).toBe('🇬🇧 English');
  });

  it('shows the flag of the language in use', () => {
    expect(el('language-flag').textContent).toBe('🇬🇧');
  });

  it('saves the choice with the settings, changes nothing else, and reopens in it', async () => {
    const before = { ...(store['settings'] as Settings) };
    await choose('es');
    expect(store['settings']).toEqual({ ...before, language: 'es' });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('survives a reset of everything else', async () => {
    (el('reset') as HTMLButtonElement).click();
    await tick();
    const stored = store['settings'] as Settings;
    expect(stored.language).toBe('es');
    expect(stored.strictness).toBe(DEFAULT_SETTINGS.strictness);
  });

  it('comes back from an imported backup, and reopens in it', async () => {
    reload.mockClear();
    const file = JSON.parse(downloaded!.text);
    file.settings.language = 'ja';
    const input = el('import-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [
        { name: 'backup.json', text: async () => JSON.stringify(file) },
      ] as unknown as FileList,
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await tick();

    expect((store['settings'] as Settings).language).toBe('ja');
    expect(reload).toHaveBeenCalled();
  });
});
