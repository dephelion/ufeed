import type { Post, SiteAdapter } from '../adapters';

export type Route = 'keep' | 'judge' | 'wait';

/**
 * Replies follow their lead post: kept when it is kept, judged on their own
 * otherwise. The adapter finds the lead post; see architecture.md §Conversations.
 */
export class Conversation {
  #kept = new WeakMap<HTMLElement, boolean>();
  #leadPosts = new WeakMap<HTMLElement, HTMLElement>();
  #replies = new WeakMap<HTMLElement, Map<HTMLElement, Post>>();

  private constructor(private readonly leadPost: NonNullable<SiteAdapter['leadPost']>) {}

  /** Undefined for a site that renders no replies inline. */
  static for(adapter: SiteAdapter): Conversation | undefined {
    return adapter.leadPost && new Conversation(adapter.leadPost);
  }

  route(post: Post): Route {
    const lead = this.leadPost(post.container);
    if (lead === post.container) {
      this.#link(post, undefined);
      return 'keep';
    }
    this.#link(post, lead);
    if (!lead) return 'judge';
    const kept = this.#kept.get(lead);
    if (kept === undefined) return 'wait';
    return kept ? 'keep' : 'judge';
  }

  /** Kept by its conversation, not judged by the model: nothing to rate. Read-only, unlike `route`. */
  keeps(container: HTMLElement): boolean {
    const lead = this.leadPost(container);
    if (!lead) return false;
    return lead === container || this.#kept.get(lead) === true;
  }

  /** A changed verdict hands back the replies that follow it, to be routed again. */
  settle(container: HTMLElement, kept: boolean): Post[] {
    if (this.#kept.get(container) === kept) return [];
    this.#kept.set(container, kept);
    return [...(this.#replies.get(container)?.values() ?? [])];
  }

  reset(): void {
    this.#kept = new WeakMap();
    this.#leadPosts = new WeakMap();
    this.#replies = new WeakMap();
  }

  #link(post: Post, lead: HTMLElement | undefined): void {
    const previous = this.#leadPosts.get(post.container);
    if (previous && previous !== lead)
      this.#replies.get(previous)?.delete(post.container);
    if (!lead) {
      this.#leadPosts.delete(post.container);
      return;
    }
    this.#leadPosts.set(post.container, lead);
    const replies = this.#replies.get(lead) ?? new Map<HTMLElement, Post>();
    replies.set(post.container, post);
    this.#replies.set(lead, replies);
  }
}
