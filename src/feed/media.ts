import type { SiteAdapter } from '../adapters';
import type { Settings } from '../core/settings';

/** Below this a score carries no signal worth trusting; see wiki-llm/adapters.md. */
export const MIN_BACKING_CHARS = 30;

export function hasMedia(container: HTMLElement, adapter: SiteAdapter): boolean {
  return container.querySelector(adapter.mediaSelector) !== null;
}

/**
 * Engine-independent by design: the post is blurred because the user asked for
 * unbacked media to be hidden, never because scoring failed.
 */
export function blursAsThinMedia(
  settings: Settings,
  text: string,
  postHasMedia: boolean,
): boolean {
  return settings.blurThinMedia && postHasMedia && text.trim().length < MIN_BACKING_CHARS;
}
