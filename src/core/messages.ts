import type en from '../../public/_locales/en/messages.json';

/** Every key of the English catalog, the source the other locales must match. See wiki-llm/i18n.md. */
export type MessageKey = keyof typeof en;

/** `$1`, `$2`… in a message are filled from the substitutions, in order. */
export type Translate = (key: MessageKey, ...substitutions: string[]) => string;

interface Entry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

export type Catalog = Record<string, Entry>;

/**
 * What a browser does with a catalog, for a reader who picked a language other
 * than the browser's, which `getMessage` cannot serve. Each `$NAME$`
 * takes the substitution its placeholder points at (`$1` is the first).
 */
export function createTranslator(catalog: Catalog): Translate {
  return (key, ...substitutions) => {
    const entry = catalog[key];
    if (!entry) return '';
    let text = entry.message;
    for (const [name, { content }] of Object.entries(entry.placeholders ?? {})) {
      const value = substitutions[Number(content.slice(1)) - 1] ?? '';
      // A function, so a `$&` inside the value is text and not a replacement pattern.
      text = text.replace(new RegExp(`\\$${name}\\$`, 'gi'), () => value);
    }
    return text;
  };
}
