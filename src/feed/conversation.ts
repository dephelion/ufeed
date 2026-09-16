import type { Post } from '../adapters';

export type Route = 'keep' | 'judge' | 'wait';

/**
 * Remembers which anchors were kept, so a reply is kept with the post it
 * answers and judged on its own otherwise. See architecture.md §Conversations.
 */
export class Conversations {
  #kept = new WeakMap<HTMLElement, boolean>();
  #anchors = new WeakMap<HTMLElement, HTMLElement>();
  #waiting = new WeakMap<HTMLElement, Post[]>();

  constructor(private readonly revealedByReader: (element: HTMLElement) => boolean) {}

  route(post: Post): Route {
    if (!post.anchor) {
      this.#anchors.delete(post.container);
      return 'judge';
    }
    this.#anchors.set(post.container, post.anchor);
    const kept = this.#keptAnchor(post.anchor);
    if (kept !== undefined) return kept ? 'keep' : 'judge';
    this.#waiting.set(post.anchor, [...(this.#waiting.get(post.anchor) ?? []), post]);
    return 'wait';
  }

  followsKept(container: HTMLElement): boolean {
    const anchor = this.#anchors.get(container);
    return anchor !== undefined && this.#keptAnchor(anchor) === true;
  }

  /** Returns the posts that were waiting on this verdict, for the caller to route again. */
  settle(container: HTMLElement, kept: boolean): Post[] {
    this.#kept.set(container, kept);
    const waiting = this.#waiting.get(container) ?? [];
    this.#waiting.delete(container);
    return waiting;
  }

  reset(): void {
    this.#kept = new WeakMap();
    this.#anchors = new WeakMap();
    this.#waiting = new WeakMap();
  }

  #keptAnchor(anchor: HTMLElement): boolean | undefined {
    return this.revealedByReader(anchor) || this.#kept.get(anchor);
  }
}
