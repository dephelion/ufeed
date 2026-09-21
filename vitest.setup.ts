import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// The real polyfill throws outside an extension. A test file's own vi.mock still wins.
vi.mock('webextension-polyfill', () => ({ default: fakeBrowser }));

interface Entry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

const english: Record<string, Entry> = JSON.parse(
  readFileSync('public/_locales/en/messages.json', 'utf8'),
);

/** The English catalog, filled the way a browser fills it: `$NAME$` becomes its `$1`, `$2`. */
function getMessage(key: string, substitutions: string | string[] = []): string {
  const entry = english[key];
  if (!entry) return '';
  const values = [substitutions].flat();
  let text = entry.message;
  for (const [name, { content }] of Object.entries(entry.placeholders ?? {})) {
    const value = values[Number(content.slice(1)) - 1] ?? '';
    text = text.replaceAll(`$${name.toUpperCase()}$`, value);
  }
  return text;
}

Object.assign(fakeBrowser.i18n, { getMessage, getUILanguage: () => 'en' });
