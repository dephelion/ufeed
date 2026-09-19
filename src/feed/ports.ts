/**
 * What the feed needs from outside its ring, and nothing else. Site adapters,
 * the engine client and storage implement these; the content script wires them.
 */
import type { Feedback } from '../core/feedback';
import type { Detection } from '../core/language';
import type { StatusEvent, TopicCorrections } from '../core/protocol';
import type { RatedMatch } from '../core/scoring';

export interface Post {
  /** The element that receives the blur class. */
  container: HTMLElement;
  text: string;
}

/** One site's DOM knowledge. Implemented in `adapters/`. */
export interface SiteAdapter {
  readonly id: string;
  matches(hostname: string): boolean;
  /** Every post currently in `root`, including `root` itself when it is one. */
  findPosts(root: ParentNode): Post[];
  /** Post-body media only. Must not match avatars, emoji or badges. */
  readonly mediaSelector: string;
  /** Matches a post container, for walking up from an arbitrary node. */
  readonly containerSelector: string;
  /** Container of the post a reply's conversation hangs from; itself for the post the reader opened. Only for sites that render replies inline. */
  leadPost?(container: HTMLElement): HTMLElement | undefined;
}

/** A correction with the topic line it belongs to; topic -1 means nowhere to file it. */
export interface Correction {
  vector: number[];
  topic: number;
}

/** The scoring engine. Implemented by `platform/engine-client.ts`. */
export interface Engine {
  readonly ready: boolean;
  readonly status: StatusEvent;
  connect(): void;
  setTopics(topics: string[], corrections?: TopicCorrections[]): void;
  /** Resolves empty on timeout or error, so callers fail open. */
  score(texts: string[]): Promise<RatedMatch[]>;
  /** Resolves empty when the engine cannot answer, so feedback is dropped, never guessed. */
  feedback(text: string, liked: boolean): Promise<Correction>;
}

/** Where the reader's ratings persist. Implemented by `platform/storage.ts`. */
export interface FeedbackStore {
  load(): Promise<Feedback>;
  save(feedback: Feedback): Promise<void>;
  /** Every stored change, this tab's own writes included. */
  onChange(fn: (feedback: Feedback) => void): void;
}

/** The browser's language detector. The content script passes `i18n.detectLanguage`. */
export type DetectLanguage = (text: string) => Promise<Detection>;
