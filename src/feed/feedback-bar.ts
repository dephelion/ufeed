import { logger } from '../core/log';
import type { Translate } from '../core/messages';

const log = logger('feedback');

export interface PostRef {
  container: HTMLElement;
  text: string;
  /** The rating already given, so a repeat click reads as a toggle, not a no-op. */
  rating?: boolean;
}

export interface FeedbackBarOptions {
  t: Translate;
  /** Resolves the post under the pointer, or undefined if it is not a post. */
  postAt(target: Element): PostRef | undefined;
  onFeedback(post: PostRef, liked: boolean): void;
}

export interface FeedbackBar {
  /** While the engine is busy a thumb would queue behind scoring and could time out. */
  setBusy(busy: boolean): void;
  unmount(): void;
}

/**
 * One floating element over the hovered post, never a child of it: injecting a
 * control into each post would mutate the feed's DOM and die on recycling.
 */
export function mountFeedbackBar(options: FeedbackBarOptions): FeedbackBar {
  const bar = document.createElement('div');
  bar.className = 'lx-fb';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML =
    '<button type="button" class="lx-fb-up">&#128077;</button>' +
    '<button type="button" class="lx-fb-down">&#128078;</button>';

  let current: PostRef | undefined;
  let busy = false;

  const hide = () => {
    bar.classList.remove('lx-fb-on');
    current = undefined;
  };

  const up = bar.querySelector<HTMLButtonElement>('.lx-fb-up')!;
  const down = bar.querySelector<HTMLButtonElement>('.lx-fb-down')!;
  up.title = options.t('thumbUp');
  down.title = options.t('thumbDown');

  const show = (post: PostRef) => {
    const box = post.container.getBoundingClientRect();
    if (box.height < 40) return hide();
    current = post;
    up.classList.toggle('lx-fb-active', post.rating === true);
    down.classList.toggle('lx-fb-active', post.rating === false);
    // Top-centred: the top-right corner belongs to the vendor's own post menu,
    // and the blur label sits there too. Horizontally centred, but anchored to
    // the post's top edge rather than its vertical middle.
    bar.style.top = `${box.top + window.scrollY + 8}px`;
    bar.style.left = `${box.left + window.scrollX + box.width / 2}px`;
    bar.classList.add('lx-fb-on');
  };

  const onOver = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.lx-fb')) return;
    const post = options.postAt(target);
    if (!post) return hide();
    if (post.container !== current?.container || post.rating !== current.rating) {
      show(post);
    }
  };

  const onClick = (event: MouseEvent) => {
    const button = (event.target as Element | null)?.closest('button');
    if (!button || !current) return;
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    const liked = button.classList.contains('lx-fb-up');
    const cleared = current.rating === liked;
    log.info('feedback given', { liked, cleared, chars: current.text.length });
    options.onFeedback(current, liked);
    current = { ...current, rating: cleared ? undefined : liked };
    up.classList.toggle('lx-fb-active', current.rating === true);
    down.classList.toggle('lx-fb-active', current.rating === false);
    bar.classList.add('lx-fb-done');
    setTimeout(() => bar.classList.remove('lx-fb-done'), 600);
  };

  document.addEventListener('mouseover', onOver, true);
  bar.addEventListener('click', onClick, true);
  window.addEventListener('scroll', hide, { passive: true });
  document.documentElement.appendChild(bar);

  return {
    setBusy(next: boolean) {
      busy = next;
      bar.classList.toggle('lx-fb-busy', busy);
      up.disabled = busy;
      down.disabled = busy;
      up.title = options.t(busy ? 'thumbBusy' : 'thumbUp');
      down.title = options.t(busy ? 'thumbBusy' : 'thumbDown');
    },
    unmount() {
      document.removeEventListener('mouseover', onOver, true);
      window.removeEventListener('scroll', hide);
      bar.remove();
    },
  };
}
