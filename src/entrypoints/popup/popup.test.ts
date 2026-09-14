import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const store: Record<string, unknown> = {};
const listeners: unknown[] = [];
vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
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
  alwaysKeep: ['rust'],
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
    expect(downloaded?.name).toMatch(/^lensing-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(downloaded!.text);
    expect(file.app).toBe('9.9.9');
    expect(file.settings.topics).toEqual(['software engineering']);
    expect(Object.keys(file.feedback['software engineering'])).toHaveLength(1);
    expect(el('transfer').hidden).toBe(false);
    expect(el('transfer').dataset['state']).toBe('ok');
  });

  it('imports a file back, replacing what was there', async () => {
    const backup = downloaded!.text;
    store['settings'] = { topics: ['knitting'], strictness: 9 };
    store['feedback'] = undefined;

    const input = el('import-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [
        { name: 'lensing-backup-2026-09-14.json', text: async () => backup },
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
    expect(el('transfer-name').textContent).toBe('lensing-backup-2026-09-14.json');
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
