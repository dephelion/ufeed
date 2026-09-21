import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createTranslator, type Catalog, type MessageKey } from './src/core/messages';

// The real polyfill throws outside an extension. A test file's own vi.mock still wins.
vi.mock('webextension-polyfill', () => ({ default: fakeBrowser }));

const english = createTranslator(
  JSON.parse(readFileSync('public/_locales/en/messages.json', 'utf8')) as Catalog,
);

/** The English catalog, filled the way a browser fills it. */
function getMessage(key: string, substitutions: string | string[] = []): string {
  return english(key as MessageKey, ...[substitutions].flat());
}

Object.assign(fakeBrowser.i18n, { getMessage, getUILanguage: () => 'en' });
