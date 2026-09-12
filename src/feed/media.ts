import type { SiteAdapter } from '../adapters';
import type { Settings } from '../core/settings';
import type { Language } from './language';

/** Below this a score carries no signal worth trusting; see wiki-llm/adapters.md. */
export const MIN_BACKING_CHARS = 30;

export function hasMedia(container: HTMLElement, adapter: SiteAdapter): boolean {
  return container.querySelector(adapter.mediaSelector) !== null;
}

/**
 * Engine-independent by design: the post is blurred because the user asked for
 * unbacked media to be hidden, never because scoring failed. A caption the
 * detector could not place counts as unbacked however long it runs — emoji,
 * handles and links read as text and embed as noise.
 */
export function blursAsThinMedia(
  settings: Settings,
  text: string,
  postHasMedia: boolean,
  language?: Language,
): boolean {
  if (!settings.blurThinMedia || !postHasMedia) return false;
  return language === 'unclear' || text.trim().length < MIN_BACKING_CHARS;
}
