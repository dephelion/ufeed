import type en from '../../public/_locales/en/messages.json';

/** Every key of the English catalog, the source the other locales must match. See wiki-llm/i18n.md. */
export type MessageKey = keyof typeof en;

/** `$1`, `$2`… in a message are filled from the substitutions, in order. */
export type Translate = (key: MessageKey, ...substitutions: string[]) => string;
