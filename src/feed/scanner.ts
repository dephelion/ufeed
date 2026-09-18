import type { Post, SiteAdapter } from '../adapters';
import { hasMedia } from './media';

/** Scored well before it is read, so a post is rarely blurred in view. */
const VIEWPORT_MARGIN = '150% 0px';

export interface ScannerOptions {
  adapter: SiteAdapter;
  /** Nothing is observed while inactive; the feed is left untouched. */
  isActive(): boolean;
  onEnterView(post: Post): void;
}

/** What a post carried when it was offered. */
interface Shape {
  text: string;
  media: boolean;
}

/** X can mount a cell before its photo or text; a post that filled in is judged again. */
function filledIn(before: Shape, after: Shape): boolean {
  return (!before.media && after.media) || (before.text === '' && after.text !== '');
}

/**
 * Finds posts and says when one nears the viewport. Owns what it has already
 * offered, keyed by node — a virtualized feed recycles nodes, so `reset()` is
 * how the caller asks for the visible feed again after the query changes.
 */
export class FeedScanner {
  #seen = new WeakSet<HTMLElement>();
  #offered = new WeakMap<HTMLElement, Shape>();
  readonly #viewport: IntersectionObserver;
  readonly #mutations: MutationObserver;

  constructor(private readonly options: ScannerOptions) {
    this.#viewport = new IntersectionObserver(
      (entries) => {
        if (!options.isActive()) return;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const container = entry.target as HTMLElement;
          this.#viewport.unobserve(container);
          const post = options.adapter.findPosts(container)[0];
          if (post) this.#offer(post);
        }
      },
      { rootMargin: VIEWPORT_MARGIN },
    );

    this.#mutations = new MutationObserver((records) => {
      const touched = new Set<HTMLElement>();
      for (const record of records) {
        if (record.addedNodes.length === 0) continue;
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement) this.sweep(node);
        }
        const target = record.target instanceof Element ? record.target : null;
        const container = target?.closest<HTMLElement>(options.adapter.containerSelector);
        if (container) touched.add(container);
      }
      for (const container of touched) this.#recheck(container);
    });
  }

  start(): void {
    this.#mutations.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  sweep(root: ParentNode): void {
    if (!this.options.isActive()) return;
    for (const post of this.options.adapter.findPosts(root)) {
      if (this.#seen.has(post.container)) continue;
      this.#seen.add(post.container);
      this.#viewport.observe(post.container);
    }
  }

  #shape(post: Post): Shape {
    return { text: post.text, media: hasMedia(post.container, this.options.adapter) };
  }

  #offer(post: Post): void {
    this.#offered.set(post.container, this.#shape(post));
    this.options.onEnterView(post);
  }

  /** Only a post already offered: one still waiting on the viewport is read when it arrives. */
  #recheck(container: HTMLElement): void {
    const before = this.#offered.get(container);
    if (!before || !this.options.isActive()) return;
    const post = this.options.adapter.findPosts(container)[0];
    if (post && filledIn(before, this.#shape(post))) this.#offer(post);
  }

  /** Whether this post has been picked up at all, for UI that attaches to one. */
  knows(container: HTMLElement): boolean {
    return this.#seen.has(container);
  }

  /** Forget what has been offered, so the visible feed is scored again. */
  reset(): void {
    this.#seen = new WeakSet();
    this.#offered = new WeakMap();
    this.sweep(document);
  }

  stop(): void {
    this.#mutations.disconnect();
    this.#viewport.disconnect();
  }
}
