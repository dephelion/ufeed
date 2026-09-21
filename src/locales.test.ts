import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from './core/languages';

/** A missing key renders as an empty string in both browsers, so nothing else would notice. wiki-llm/i18n.md. */
const ROOT = 'public/_locales';
const STORE_DESCRIPTION_LIMIT = 132;
const CHIP_LIMIT = 18;

interface Entry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}
type Catalog = Record<string, Entry>;

const load = (locale: string): Catalog =>
  JSON.parse(readFileSync(`${ROOT}/${locale}/messages.json`, 'utf8'));

const english = load('en');
const locales = readdirSync(ROOT);
const others = locales.filter((locale) => locale !== 'en');

const declared = (entry: Entry) => Object.keys(entry.placeholders ?? {}).sort();
const used = (text: string) =>
  [...text.matchAll(/\$(\w+)\$/g)].map((match) => match[1]!.toLowerCase()).sort();

describe('the locales', () => {
  it('ship English, the default every other locale falls back to', () => {
    expect(locales).toContain('en');
  });

  describe.each(others)('%s', (locale) => {
    const catalog = load(locale);

    it('has exactly the keys of English', () => {
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(english).sort());
    });

    it('fills the same placeholders as English', () => {
      for (const [key, entry] of Object.entries(english)) {
        expect(declared(catalog[key]!), key).toEqual(declared(entry));
      }
    });
  });

  describe.each(locales)('%s', (locale) => {
    const catalog = load(locale);

    it('uses each placeholder it declares, and never a bare $', () => {
      for (const [key, entry] of Object.entries(catalog)) {
        expect(used(entry.message), key).toEqual(declared(entry));
        expect(entry.message.replace(/\$\w+\$/g, ''), key).not.toContain('$');
      }
    });

    it('keeps the store description within the store limit', () => {
      expect(catalog['extDescription']!.message.length).toBeLessThanOrEqual(
        STORE_DESCRIPTION_LIMIT,
      );
    });

    it('keeps the header chip short enough to share a row with the title and switch', () => {
      for (const [key, entry] of Object.entries(catalog)) {
        if (!key.startsWith('chip')) continue;
        const text = entry.message.replace(/\$PERCENT\$/i, '100');
        expect(text.length, key).toBeLessThanOrEqual(CHIP_LIMIT);
      }
    });
  });

  it('are all offered in the popup, and only those', () => {
    const offered = LANGUAGES.map((language) => language.code).sort();
    expect(offered).toEqual([...locales].sort());
  });

  it('cover every key the popup page names', () => {
    const html = readFileSync('src/entrypoints/popup/index.html', 'utf8');
    const keys = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(english, key).toHaveProperty(key!);
  });
});
