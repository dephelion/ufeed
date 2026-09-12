export interface Post {
  /** The element that receives the blur class. */
  container: HTMLElement;
  text: string;
}

export interface SiteAdapter {
  readonly id: string;
  matches(hostname: string): boolean;
  /** Every post currently in `root`, including `root` itself when it is one. */
  findPosts(root: ParentNode): Post[];
  /** Post-body media only. Must not match avatars, emoji or badges. */
  readonly mediaSelector: string;
  /** Matches a post container, for walking up from an arbitrary node. */
  readonly containerSelector: string;
}
