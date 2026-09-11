const BLUR_CLASS = 'lx-blur';

/**
 * Node-level, deliberately: a reveal lost to virtualized recycling is an
 * accepted tradeoff (wiki-llm/ui.md), not a bug to fix with a persistence layer.
 */
const revealed = new WeakSet<HTMLElement>();

export function blur(element: HTMLElement): void {
  if (revealed.has(element)) return;
  element.classList.add(BLUR_CLASS);
  element.setAttribute('aria-hidden', 'true');
}

export function reveal(element: HTMLElement): void {
  element.classList.remove(BLUR_CLASS);
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
  for (const el of root.querySelectorAll<HTMLElement>(`.${BLUR_CLASS}`)) reveal(el);
}
