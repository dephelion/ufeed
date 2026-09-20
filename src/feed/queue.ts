import { logger } from '../core/log';
import type { RatedMatch } from '../core/scoring';
import type { Engine, Post } from './ports';

const FLUSH_MS = 100;
/** Quiet time after the last scroll before a batch is chosen. */
const SETTLE_MS = 150;
/** The longest one scroll can hold a batch back. */
const MAX_WAIT_MS = 1000;
/**
 * Long posts cost tokens without adding signal; e5 does not shift with length.
 * Lowering it was measured and rejected as a speed lever: see wiki-llm/model.md.
 */
const MAX_CHARS = 1200;

/** Every text the engine embeds passes through here, scored or thumbed alike. */
export const forEngine = (text: string): string => text.slice(0, MAX_CHARS);

const log = logger('queue');

export interface Scored {
  post: Post;
  match: RatedMatch | undefined;
}

/**
 * Batches posts to the engine, nearest the viewport first. Holds the batch rather
 * than dropping it while the engine is warming, and discards replies issued
 * against a query that has since changed — a score means nothing once the topics
 * or ratings move.
 */
export class ScoreQueue {
  readonly #pending = new Map<HTMLElement, Post>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #epoch = 0;
  #inFlight = false;
  #movedAt = 0;
  /** When the current scroll began: a pause longer than SETTLE_MS ends one. */
  #movingSince = 0;

  constructor(
    private readonly engine: Pick<Engine, 'ready' | 'status' | 'score'>,
    private readonly onScored: (results: Scored[]) => void,
    /** Read per flush, not captured: a model switch changes it under a live queue. */
    private readonly batchSize: () => number,
    /**
     * Everything the queue is holding: the batch going out now, and every post
     * still waiting behind it. None of them has been judged, so all of them stay
     * held. Re-announced on each flush so the hold keeps its footing for as long
     * as the queue is actually draining, however deep a post started.
     */
    private readonly onPending: (posts: Post[]) => void = () => {},
  ) {}

  add(post: Post): void {
    this.#pending.set(post.container, post);
    if (this.#pending.size >= this.batchSize()) void this.flush();
    else this.#schedule();
  }

  /** Replies in flight were scored against the old query; ignore them. */
  invalidate(): void {
    this.#epoch += 1;
  }

  /** The viewport moved, so the posts nearest it are about to change. */
  moved(): void {
    const now = Date.now();
    if (now - this.#movedAt > SETTLE_MS) this.#movingSince = now;
    this.#movedAt = now;
  }

  /**
   * One request at a time. The worker embeds one post after another on a single
   * thread, so a second request in flight does not run sooner — it only waits,
   * while the engine's timeout counts that wait against it and eventually
   * reveals a batch the engine never got to. Posts stay pending instead, where
   * waiting costs nothing, and the timeout measures the engine rather than the
   * queue behind it. Scrolling fast is exactly what used to flood it.
   */
  async flush(): Promise<void> {
    clearTimeout(this.#timer);
    if (this.#inFlight || this.#pending.size === 0) return;
    if (!this.engine.ready) {
      log.info('engine not ready, holding batch', {
        queued: this.#pending.size,
        state: this.engine.status.state,
      });
      return;
    }

    if (this.#scrolling()) return;

    const issuedAt = this.#epoch;
    const batch = this.#nearest(this.batchSize());
    if (batch.length === 0) return;
    for (const [element] of batch) this.#pending.delete(element);

    this.#inFlight = true;
    this.onPending([...batch.map(([, post]) => post), ...this.#pending.values()]);
    try {
      const matches = await this.engine.score(
        batch.map(([, post]) => forEngine(post.text)),
      );
      if (issuedAt === this.#epoch) {
        // The whole post, not the capped text: the cache and the decision key on it.
        this.onScored(batch.map(([, post], i) => ({ post, match: matches[i] })));
      } else {
        log.info('discarding scores for a previous query', { posts: batch.length });
      }
    } finally {
      this.#inFlight = false;
    }

    // Straight on rather than waiting out FLUSH_MS: the work is already queued
    // and nothing else will send it.
    if (this.#pending.size > 0) void this.flush();
  }

  /**
   * A batch stays committed for seconds, so it waits for the page to stop moving,
   * except that one scroll can hold it back for MAX_WAIT_MS at most.
   */
  #scrolling(): boolean {
    const now = Date.now();
    const quiet = this.#movedAt + SETTLE_MS - now;
    if (quiet <= 0 || now - this.#movingSince >= MAX_WAIT_MS) return false;
    this.#timer = setTimeout(() => void this.flush(), quiet);
    return true;
  }

  /**
   * Closest to the viewport first, ties in arrival order. A post the page has
   * removed is dropped: nobody will see its verdict, so it is not worth a turn.
   */
  #nearest(count: number): [HTMLElement, Post][] {
    const waiting = [...this.#pending.entries()];
    for (const [element] of waiting) {
      if (!element.isConnected) this.#pending.delete(element);
    }
    const height = window.innerHeight;
    return waiting
      .filter(([element]) => element.isConnected)
      .map((entry) => ({ entry, gap: gapToViewport(entry[0], height) }))
      .sort((a, b) => a.gap - b.gap)
      .slice(0, count)
      .map(({ entry }) => entry);
  }

  #schedule(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.flush(), FLUSH_MS);
  }
}

/** Zero for a post any part of which is on screen. */
function gapToViewport(element: HTMLElement, height: number): number {
  const { top, bottom } = element.getBoundingClientRect();
  if (top > height) return top - height;
  return bottom < 0 ? -bottom : 0;
}
