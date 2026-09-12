import type { Post, SiteAdapter } from '../adapters';

/** Scored well before it is read, so a post is rarely blurred in view. */
const VIEWPORT_MARGIN = '150% 0px';

export interface ScannerOptions {
  adapter: SiteAdapter;
  /** Nothing is observed while inactive; the feed is left untouched. */
  isActive(): boolean;
  onEnterView(post: Post): void;
}

/**
 * Finds posts and says when one nears the viewport. Owns what it has already
 * offered, keyed by node — a virtualized feed recycles nodes, so `reset()` is
 * how the caller asks for the visible feed again after the query changes.
 */
export class FeedScanner {
  #seen = new WeakSet<HTMLElement>();
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
          if (post) options.onEnterView(post);
        }
      },
      { rootMargin: VIEWPORT_MARGIN },
    );

    this.#mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement) this.sweep(node);
        }
      }
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

  /** Whether this post has been picked up at all, for UI that attaches to one. */
  knows(container: HTMLElement): boolean {
    return this.#seen.has(container);
  }

  /** Forget what has been offered, so the visible feed is scored again. */
  reset(): void {
    this.#seen = new WeakSet();
    this.sweep(document);
  }

  stop(): void {
    this.#mutations.disconnect();
    this.#viewport.disconnect();
  }
}
