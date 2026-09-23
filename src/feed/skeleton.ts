import type { Translate } from '../core/messages';

const SKELETON_CLASS = 'lx-pending';

/**
 * Carries the lift animation and nothing else, so a copy left on a shown post is
 * inert — which is why no path has to take it off again.
 */
const UNVEIL_CLASS = 'lx-unveil';

/**
 * The loading state, and nothing to do with a blur.
 *
 * A blur is a verdict: the post was judged, the content stays there behind
 * frosted glass, it carries a label and a colour, and one click takes it back.
 * A skeleton is the absence of a verdict: there is nothing to show yet, so the
 * content is replaced rather than obscured, and it says only "working".
 *
 * They shared a technique once — the skeleton was the blur's own ghosting with
 * smaller numbers — which made a held post read as a blur that had not finished
 * landing. The two states are kept apart here so that cannot come back.
 */

/**
 * **A last resort, not the normal path.** A verdict ends the skeleton, and an
 * engine error reveals the whole feed, so this only fires when a post is
 * forgotten outright. It is refreshed while the queue is draining, so it
 * measures *no progress at all* rather than time a post spent legitimately
 * waiting behind other batches. It must also outlast one request's own timeout
 * (8s in `engine-client.ts`, which this ring may not import): at 1500ms it
 * expired mid-batch on the slower model, un-dimming a post and then blurring it
 * a moment later — the exact flash this state exists to prevent.
 */
const SKELETON_MS = 10_000;

/**
 * One timer per element. Re-holding must extend the wait, never stack a second
 * timer that later fires against a post the queue is still working on.
 */
const holding = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** Caller's job to know whether the post is blurred or revealed; this only holds. */
export function showSkeleton(element: HTMLElement, t: Translate): void {
  // Dropped here, not on the lift: re-adding a class is what restarts its animation.
  element.classList.remove(UNVEIL_CLASS);
  element.classList.add(SKELETON_CLASS);
  element.dataset.lxPending = t('labelPending');
  clearTimeout(holding.get(element));
  holding.set(
    element,
    setTimeout(() => hideSkeleton(element, true), SKELETON_MS),
  );
}

/**
 * `unveil` is for a post the verdict let through: it has to travel from held to
 * plain, and dropping the class alone makes that a flash. A post on its way to a
 * blur passes it up — the blur is the next thing it wears.
 */
export function hideSkeleton(element: HTMLElement, unveil = false): void {
  clearTimeout(holding.get(element));
  holding.delete(element);
  element.classList.remove(SKELETON_CLASS);
  element.classList.toggle(UNVEIL_CLASS, unveil);
  delete element.dataset.lxPending;
}

export function isSkeleton(element: HTMLElement): boolean {
  return element.classList.contains(SKELETON_CLASS);
}

/** Invariant 2: nothing may leave a feed stuck in a state it cannot get out of. */
export function hideAllSkeletons(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>(`.${SKELETON_CLASS}`))
    hideSkeleton(el, true);
}
