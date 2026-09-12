import { logger } from '../core/log';

const log = logger('feedback');

export interface PostRef {
  container: HTMLElement;
  text: string;
  /** The rating already given, so a repeat click reads as a toggle, not a no-op. */
  rating?: boolean;
}

export interface FeedbackBarOptions {
  /** Resolves the post under the pointer, or undefined if it is not a post. */
  postAt(target: Element): PostRef | undefined;
  onFeedback(post: PostRef, liked: boolean): void;
}

/**
 * One floating element over the hovered post, never a child of it: injecting a
 * control into each post would mutate the feed's DOM and die on recycling.
 */
export function mountFeedbackBar(options: FeedbackBarOptions): () => void {
  const bar = document.createElement('div');
  bar.className = 'lx-fb';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML =
    '<button type="button" class="lx-fb-up" title="On topic">&#128077;</button>' +
    '<button type="button" class="lx-fb-down" title="Off topic">&#128078;</button>';

  let current: PostRef | undefined;

  const hide = () => {
    bar.classList.remove('lx-fb-on');
    current = undefined;
  };

  const up = bar.querySelector('.lx-fb-up')!;
  const down = bar.querySelector('.lx-fb-down')!;

  const show = (post: PostRef) => {
    const box = post.container.getBoundingClientRect();
    if (box.height < 40) return hide();
    current = post;
    up.classList.toggle('lx-fb-active', post.rating === true);
    down.classList.toggle('lx-fb-active', post.rating === false);
    // Centred: the top-right corner belongs to the vendor's own post menu, and
    // the blur label sits there too.
    bar.style.top = `${box.top + window.scrollY + box.height / 2}px`;
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

  return () => {
    document.removeEventListener('mouseover', onOver, true);
    window.removeEventListener('scroll', hide);
    bar.remove();
  };
}
