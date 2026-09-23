import type { MessageKey, Translate } from '../core/messages';

const BLUR_CLASS = 'lx-blur';
const COLLAPSE_CLASS = 'lx-collapse';

/** The height the collapse animates down from, and the expand back up to. */
const HEIGHT_VAR = '--lx-h';

/** Like `lx-unveil`: animation only, so a copy left behind changes nothing. */
const EXPAND_CLASS = 'lx-expand';

/**
 * Node-level, deliberately: a reveal lost to virtualized recycling is an
 * accepted tradeoff (wiki-llm/ui.md), not a bug to fix with a persistence layer.
 */
const revealed = new WeakSet<HTMLElement>();

/** Drives the label: only 'topic' and 'blacklist' mean the model actually judged the post. */
export type BlurReason = 'topic' | 'blacklist' | 'media' | 'language' | 'peek';

/**
 * The text rides on `data-lx-label` and is drawn by `attr()`: a stylesheet has one
 * language, and a `<style>` we inject may be refused by the host's CSP.
 */
const LABELS: Record<BlurReason, MessageKey> = {
  topic: 'labelTopic',
  blacklist: 'labelBlacklist',
  media: 'labelMedia',
  language: 'labelLanguage',
  peek: 'labelPeek',
};

/** The same reasons once opened: a plain tag, nothing left to click. */
const OPENED: Record<BlurReason, MessageKey> = {
  topic: 'openedTopic',
  blacklist: 'openedBlacklist',
  media: 'openedMedia',
  language: 'openedLanguage',
  peek: 'openedPeek',
};

/** Enough to judge the subject, short enough not to become the distraction. */
const PEEK_CHARS = 50;

/**
 * Collapse is a container-only trick — a fixed max-height plus overflow:hidden
 * clips whatever is inside, no matter the host's markup — so it works on any
 * adapter without per-site layout code. The badges stay legible because they
 * render on the container's own ::before/::after, never on a child that gets
 * clipped or hidden with it. Its one measurement feeds the slide shut, see
 * `measure` and wiki-llm/ui.md.
 */
export function blur(
  element: HTMLElement,
  t: Translate,
  reason: BlurReason = 'topic',
  collapse = false,
): void {
  if (revealed.has(element)) return;
  if (collapse && !element.classList.contains(COLLAPSE_CLASS)) measure(element);
  element.classList.add(BLUR_CLASS);
  element.classList.remove(EXPAND_CLASS);
  element.classList.toggle(COLLAPSE_CLASS, collapse);
  element.dataset.lxReason = reason;
  element.dataset.lxLabel = t(LABELS[reason]);
  element.setAttribute('aria-hidden', 'true');
}

/**
 * Read before the class lands, while the post still stands at its own height, and
 * never on one already collapsed — that would measure the shut row. A height of 0
 * (offscreen, or a DOM with no layout) leaves the variable unset, and the keyframe
 * falls back to collapsing instantly.
 */
function measure(element: HTMLElement): void {
  const height = element.offsetHeight;
  if (height > 0) element.style.setProperty(HEIGHT_VAR, `${height}px`);
}

/**
 * The opening words ride on an attribute and render in our own overlay. Splitting
 * the host's text node to un-blur them in place would mutate the feed's DOM and
 * die on the next re-render.
 */
export function peek(
  element: HTMLElement,
  t: Translate,
  text: string,
  collapse = false,
): void {
  if (revealed.has(element)) return;
  blur(element, t, 'peek', collapse);
  element.dataset.lxPeek = text.slice(0, PEEK_CHARS).trim();
}

/** Each label is text written once, so a `t` in another language means writing it again. */
export function relabelBlurred(t: Translate, root: ParentNode = document): void {
  for (const [reason, key] of Object.entries(LABELS)) {
    for (const element of root.querySelectorAll<HTMLElement>(
      `[data-lx-reason="${reason}"]`,
    )) {
      element.dataset.lxLabel = t(key);
    }
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-lx-opened]')) {
    element.dataset.lxLabel = openedLabel(element, t);
  }
}

/**
 * `expand` runs the collapse backwards, for the one reveal a reader asked for by
 * clicking. Every other caller — a settings change, the off switch — is putting a
 * whole feed back at once and has nothing to draw attention to.
 */
export function reveal(element: HTMLElement, expand = false): void {
  const collapsed = element.classList.contains(COLLAPSE_CLASS);
  element.classList.remove(BLUR_CLASS, COLLAPSE_CLASS);
  element.classList.toggle(EXPAND_CLASS, expand && collapsed);
  // The expand animates back up to it, so it outlives the collapse by one animation.
  if (!(expand && collapsed)) element.style.removeProperty(HEIGHT_VAR);
  delete element.dataset.lxReason;
  delete element.dataset.lxLabel;
  delete element.dataset.lxPeek;
  delete element.dataset.lxOpened;
  delete element.dataset.lxKeyword;
  element.removeAttribute('aria-hidden');
}

/** Opened by the reader: the post shows, and a tag keeps saying why it had been hidden. */
export function revealPermanently(element: HTMLElement, t: Translate): void {
  const reason = element.dataset.lxReason as BlurReason | undefined;
  const keyword = element.dataset.lxKeyword;
  revealed.add(element);
  reveal(element, true);
  retag(element, t, reason, keyword);
}

/**
 * An opened post's tag follows the current verdict, not the one it was opened
 * under: removing the keyword that blocked it drops the tag or names the new reason.
 */
export function retag(
  element: HTMLElement,
  t: Translate,
  reason: BlurReason | undefined,
  keyword?: string,
): void {
  if (!revealed.has(element)) return;
  if (reason === undefined || !(reason in OPENED)) {
    delete element.dataset.lxOpened;
    delete element.dataset.lxKeyword;
    delete element.dataset.lxLabel;
    return;
  }
  element.dataset.lxOpened = reason;
  if (keyword === undefined) delete element.dataset.lxKeyword;
  else element.dataset.lxKeyword = keyword;
  element.dataset.lxLabel = openedLabel(element, t);
}

/** The blacklist tag names the keyword that blocked the post. */
function openedLabel(element: HTMLElement, t: Translate): string {
  const reason = element.dataset.lxOpened as BlurReason;
  return t(OPENED[reason], element.dataset.lxKeyword ?? '');
}

export function isRevealed(element: HTMLElement): boolean {
  return revealed.has(element);
}

/** Current blur/collapse state, as opposed to `isRevealed`'s permanent-reveal record. */
export function isBlurred(element: HTMLElement): boolean {
  return element.classList.contains(BLUR_CLASS);
}

/** What a screen reader hears when focus enters a blurred post, per `BlurReason`. */
const SPOKEN: Record<BlurReason, MessageKey> = {
  topic: 'spokenTopic',
  blacklist: 'spokenBlacklist',
  media: 'spokenMedia',
  language: 'spokenLanguage',
  peek: 'spokenPeek',
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
  t: Translate,
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
    revealPermanently(element, t);
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
    const spoken = SPOKEN[element.dataset.lxReason as BlurReason] ?? SPOKEN.topic;
    announcer.say(t(spoken));
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

/** Blurred posts and the tags on opened ones: turned off, the feed is the host's again. */
export function revealAll(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>(`.${BLUR_CLASS}, [data-lx-opened]`))
    reveal(el);
}
