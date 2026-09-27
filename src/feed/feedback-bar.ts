import { logger } from '../core/log';
import type { Translate } from '../core/messages';

const log = logger('feedback');

/** Ratability is read again this often; scrolling only moves the buttons. */
const RECHECK_MS = 300;

const KEEP_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h6"/>' +
  '<path d="M13 3l5 5h-5z"/><path d="M8 11h5M8 15h3"/><path d="M18 21v-9M15 15l3-3 3 3"/></svg>';
const DROP_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3"/>' +
  '<path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6M14 11v6"/></svg>';

export interface PostRef {
  container: HTMLElement;
  text: string;
  /** The rating already given, so a repeat click reads as a toggle, not a no-op. */
  rating?: boolean;
}

export interface FeedbackBarOptions {
  t: Translate;
  /** Every post container on the page, ratable or not. */
  containers(): Iterable<HTMLElement>;
  /** Resolves the post an element belongs to, or undefined if it cannot be rated. */
  postAt(target: Element): PostRef | undefined;
  onFeedback(post: PostRef, liked: boolean): void;
}

export interface FeedbackBar {
  /** While the engine is busy a rating would queue behind scoring and could time out. */
  setBusy(busy: boolean): void;
  /** Writes the text again, for a `t` that now answers in another language. */
  relabel(): void;
  unmount(): void;
}

interface Rating {
  element: HTMLDivElement;
  up: HTMLButtonElement;
  down: HTMLButtonElement;
  post: PostRef;
}

/**
 * One floating element per visible ratable post, never a child of it: injecting
 * a control into each post would mutate the feed's DOM and die on recycling.
 */
export function mountFeedbackBar(options: FeedbackBarOptions): FeedbackBar {
  const ratings = new Map<HTMLElement, Rating>();
  let verdicts = new Map<HTMLElement, PostRef | undefined>();
  let busy = false;
  let frame = 0;

  const label = (rating: Rating) => {
    rating.up.title = options.t(busy ? 'thumbBusy' : 'thumbUp');
    rating.down.title = options.t(busy ? 'thumbBusy' : 'thumbDown');
  };

  const mark = (rating: Rating) => {
    rating.up.classList.toggle('lx-fb-active', rating.post.rating === true);
    rating.down.classList.toggle('lx-fb-active', rating.post.rating === false);
  };

  const applyBusy = (rating: Rating) => {
    rating.element.classList.toggle('lx-fb-busy', busy);
    rating.up.disabled = busy;
    rating.down.disabled = busy;
    label(rating);
  };

  const rate = (rating: Rating, liked: boolean) => {
    if (busy) return;
    // X recycles cells: the post under these buttons may have changed, or turned unratable.
    const container = rating.post.container;
    const post = options.postAt(container);
    if (!post) {
      rating.element.remove();
      ratings.delete(container);
      verdicts.set(container, undefined);
      return;
    }
    const cleared = post.rating === liked;
    log.info('feedback given', { liked, cleared, chars: post.text.length });
    options.onFeedback(post, liked);
    rating.post = { ...post, rating: cleared ? undefined : liked };
    verdicts.set(post.container, rating.post);
    mark(rating);
    rating.element.classList.add('lx-fb-done');
    setTimeout(() => rating.element.classList.remove('lx-fb-done'), 600);
  };

  const create = (post: PostRef): Rating => {
    const element = document.createElement('div');
    element.className = 'lx-fb';
    element.setAttribute('aria-hidden', 'true');
    // Pointer-only: a focusable control inside aria-hidden is announced as nothing yet takes focus.
    element.innerHTML =
      `<button type="button" tabindex="-1" class="lx-fb-up">${KEEP_ICON}</button>` +
      `<button type="button" tabindex="-1" class="lx-fb-down">${DROP_ICON}</button>`;
    const rating: Rating = {
      element,
      up: element.querySelector<HTMLButtonElement>('.lx-fb-up')!,
      down: element.querySelector<HTMLButtonElement>('.lx-fb-down')!,
      post,
    };
    element.addEventListener(
      'click',
      (event) => {
        const button = (event.target as Element | null)?.closest('button');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        rate(rating, button === rating.up);
      },
      true,
    );
    applyBusy(rating);
    document.documentElement.appendChild(element);
    return rating;
  };

  const sync = (recheck: boolean) => {
    frame = 0;
    if (recheck) verdicts = new Map();
    const visible: [Rating, DOMRect, boolean | undefined][] = [];
    for (const container of options.containers()) {
      const box = container.getBoundingClientRect();
      if (box.height < 40 || box.bottom < 0 || box.top > window.innerHeight) continue;
      if (!verdicts.has(container)) verdicts.set(container, options.postAt(container));
      const post = verdicts.get(container);
      if (!post) continue;
      let rating = ratings.get(container);
      const fresh = !rating;
      if (rating) rating.post = post;
      else ratings.set(container, (rating = create(post)));
      // Theme is re-read on recheck only: X switches it live, but not per frame.
      visible.push([rating, box, fresh || recheck ? onLight(container) : undefined]);
    }
    const shown = new Set(visible.map(([rating]) => rating));
    for (const [container, rating] of ratings) {
      if (shown.has(rating)) continue;
      rating.element.remove();
      ratings.delete(container);
    }
    // Reads above, writes here: interleaving them forces a layout per post.
    for (const [rating, box, light] of visible) {
      mark(rating);
      if (light !== undefined) rating.element.classList.toggle('lx-fb-light', light);
      rating.element.style.top = `${(box.top + box.bottom) / 2 + window.scrollY}px`;
      rating.element.style.left = `${box.right - 3 + window.scrollX}px`;
    }
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => sync(false));
  };

  // Capture: LinkedIn and Reddit can scroll an inner element, which never bubbles to window.
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  const timer = setInterval(() => sync(true), RECHECK_MS);
  sync(true);

  return {
    setBusy(next: boolean) {
      busy = next;
      for (const rating of ratings.values()) applyBusy(rating);
    },
    relabel() {
      for (const rating of ratings.values()) label(rating);
    },
    unmount() {
      clearInterval(timer);
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      for (const rating of ratings.values()) rating.element.remove();
      ratings.clear();
    },
  };
}

/** Whether the first opaque background behind `element` is light; a bare page is white. */
function onLight(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (!color.startsWith('rgb')) continue;
    const [r = 0, g = 0, b = 0, alpha = 1] = (color.match(/[\d.]+/g) ?? []).map(Number);
    if (alpha < 0.5) continue;
    return 0.299 * r + 0.587 * g + 0.114 * b > 128;
  }
  return true;
}
