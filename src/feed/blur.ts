const BLUR_CLASS = 'lx-blur';
const PENDING_CLASS = 'lx-pending';

/**
 * Node-level, deliberately: a reveal lost to virtualized recycling is an
 * accepted tradeoff (wiki-llm/ui.md), not a bug to fix with a persistence layer.
 */
const revealed = new WeakSet<HTMLElement>();

/** Drives the label: only 'topic' means the model actually judged the post. */
export type BlurReason = 'topic' | 'media' | 'language' | 'peek';

/**
 * Judging a post costs a language detection and an inference. Softened until
 * the answer lands, so the few milliseconds cannot catch the eye and then blur
 * under it. Self-clearing: a held batch or a dead engine must never leave the
 * feed dimmed, so the timeout reveals without waiting for a verdict.
 */
const PENDING_MS = 1500;

export function markPending(element: HTMLElement): void {
  if (revealed.has(element) || element.classList.contains(BLUR_CLASS)) return;
  element.classList.add(PENDING_CLASS);
  setTimeout(() => clearPending(element), PENDING_MS);
}

export function clearPending(element: HTMLElement): void {
  element.classList.remove(PENDING_CLASS);
}

/** Enough to judge the subject, short enough not to become the distraction. */
const PEEK_CHARS = 50;

export function blur(element: HTMLElement, reason: BlurReason = 'topic'): void {
  if (revealed.has(element)) return;
  clearPending(element);
  element.classList.add(BLUR_CLASS);
  element.dataset.lxReason = reason;
  element.setAttribute('aria-hidden', 'true');
}

/**
 * The opening words ride on an attribute and render in our own overlay. Splitting
 * the host's text node to un-blur them in place would mutate the feed's DOM and
 * die on the next re-render.
 */
export function peek(element: HTMLElement, text: string): void {
  if (revealed.has(element)) return;
  blur(element, 'peek');
  element.dataset.lxPeek = text.slice(0, PEEK_CHARS).trim();
}

export function reveal(element: HTMLElement): void {
  clearPending(element);
  element.classList.remove(BLUR_CLASS);
  delete element.dataset.lxReason;
  delete element.dataset.lxPeek;
  element.removeAttribute('aria-hidden');
}

export function revealPermanently(element: HTMLElement): void {
  revealed.add(element);
  reveal(element);
}

export function isRevealed(element: HTMLElement): boolean {
  return revealed.has(element);
}

/**
 * First click reveals and goes no further; a second behaves normally. Click is
 * the only way in — hover would expose every post the pointer crossed while
 * scrolling.
 */
export function listenForReveal(root: Document = document): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const element = target?.closest<HTMLElement>(`.${BLUR_CLASS}`);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    revealPermanently(element);
  };
  root.addEventListener('click', onClick, true);
  return () => root.removeEventListener('click', onClick, true);
}

export function revealAll(root: ParentNode = document): void {
  const stuck = `.${BLUR_CLASS}, .${PENDING_CLASS}`;
  for (const el of root.querySelectorAll<HTMLElement>(stuck)) reveal(el);
}
