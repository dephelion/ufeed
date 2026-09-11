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
}
