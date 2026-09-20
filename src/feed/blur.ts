const BLUR_CLASS = 'lx-blur';
const COLLAPSE_CLASS = 'lx-collapse';

/**
 * Node-level, deliberately: a reveal lost to virtualized recycling is an
 * accepted tradeoff (wiki-llm/ui.md), not a bug to fix with a persistence layer.
 */
const revealed = new WeakSet<HTMLElement>();

/** Drives the label: only 'topic' means the model actually judged the post. */
export type BlurReason = 'topic' | 'media' | 'language' | 'peek';

/** Enough to judge the subject, short enough not to become the distraction. */
const PEEK_CHARS = 50;

/**
 * Collapse is a container-only trick — a fixed max-height plus overflow:hidden
 * clips whatever is inside, no matter the host's markup — so it works on any
 * adapter without per-site layout code. The badges stay legible because they
 * render on the container's own ::before/::after, never on a child that gets
 * clipped or hidden with it.
 */
export function blur(
  element: HTMLElement,
  reason: BlurReason = 'topic',
  collapse = false,
): void {
  if (revealed.has(element)) return;
  element.classList.add(BLUR_CLASS);
  element.classList.toggle(COLLAPSE_CLASS, collapse);
  element.dataset.lxReason = reason;
  element.setAttribute('aria-hidden', 'true');
}

/**
 * The opening words ride on an attribute and render in our own overlay. Splitting
 * the host's text node to un-blur them in place would mutate the feed's DOM and
 * die on the next re-render.
 */
export function peek(element: HTMLElement, text: string, collapse = false): void {
  if (revealed.has(element)) return;
  blur(element, 'peek', collapse);
  element.dataset.lxPeek = text.slice(0, PEEK_CHARS).trim();
}

export function reveal(element: HTMLElement): void {
  element.classList.remove(BLUR_CLASS, COLLAPSE_CLASS);
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

/** Current blur/collapse state, as opposed to `isRevealed`'s permanent-reveal record. */
export function isBlurred(element: HTMLElement): boolean {
  return element.classList.contains(BLUR_CLASS);
}

/** What a screen reader hears when focus enters a blurred post, per `BlurReason`. */
const SPOKEN: Record<BlurReason, string> = {
  topic: 'out of topic',
  media: 'no text to check',
  language: 'another language',
  peek: 'borderline',
};

/**
 * One polite live region of our own. Blurred posts are `aria-hidden`, yet their
 * links stay focusable (`inert` would lock the keyboard out), so focus needs a voice.
 */
function mountAnnouncer(root: Document): { say(text: string): void; remove(): void } {
  // Firefox keeps a dead content script's nodes on extension update.
  for (const stale of root.querySelectorAll('.lx-sr')) stale.remove();
  const region = root.createElement('div');
  region.className = 'lx-sr';
  region.setAttribute('role', 'status');
  root.documentElement.appendChild(region);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    say(text) {
      // Cleared first: a screen reader skips a region whose text did not change.
      region.textContent = '';
      clearTimeout(timer);
      timer = setTimeout(() => (region.textContent = text), 50);
    },
    remove() {
      clearTimeout(timer);
      region.remove();
    },
  };
}

/**
 * First click, or Enter on anything focused inside, reveals and goes no further;
 * a second behaves normally. No hover: it would expose every post the pointer
 * crossed while scrolling.
 */
export function listenForReveal(
  root: Document = document,
  onReveal: (element: HTMLElement) => void = () => {},
): () => void {
  const blurredAt = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(`.${BLUR_CLASS}`) : null;

  const take = (event: Event): void => {
    const element = blurredAt(event.target);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    revealPermanently(element);
    onReveal(element);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') take(event);
  };

  const announcer = mountAnnouncer(root);
  let announced: HTMLElement | undefined;
  const onFocus = (event: FocusEvent) => {
    const element = blurredAt(event.target);
    if (!element || element === announced) return;
    announced = element;
    const reason = SPOKEN[element.dataset.lxReason as BlurReason] ?? SPOKEN.topic;
    announcer.say(`Blurred by FeedLens: ${reason}. Press Enter to read it.`);
  };

  root.addEventListener('click', take, true);
  root.addEventListener('keydown', onKey, true);
  root.addEventListener('focusin', onFocus, true);
  return () => {
    root.removeEventListener('click', take, true);
    root.removeEventListener('keydown', onKey, true);
    root.removeEventListener('focusin', onFocus, true);
    announcer.remove();
  };
}

export function revealAll(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>(`.${BLUR_CLASS}`)) reveal(el);
}
