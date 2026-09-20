import { logger } from '../core/log';
import type { RatedMatch } from '../core/scoring';
import type { Engine, Post } from './ports';

const FLUSH_MS = 100;
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
 * Batches posts to the engine. Holds the batch rather than dropping it while the
 * engine is warming, and discards replies issued against a query that has since
 * changed — a score means nothing once the topics or ratings move.
 */
export class ScoreQueue {
  readonly #pending = new Map<HTMLElement, Post>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #epoch = 0;
  #inFlight = false;

  constructor(
    private readonly engine: Pick<Engine, 'ready' | 'status' | 'score'>,
    private readonly onScored: (results: Scored[]) => void,
    /** Read per flush, not captured: a model switch changes it under a live queue. */
    private readonly batchSize: () => number,
    /**
     * This batch is going to the engine now. Fires per batch rather than per
     * enqueue, because a serialized queue means "queued" and "being judged" are
     * no longer the same moment — a post can wait behind several batches first.
     */
    private readonly onSending: (posts: Post[]) => void = () => {},
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

    const issuedAt = this.#epoch;
    const batch = [...this.#pending.entries()].slice(0, this.batchSize());
    for (const [element] of batch) this.#pending.delete(element);

    this.#inFlight = true;
    this.onSending(batch.map(([, post]) => post));
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

  #schedule(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.flush(), FLUSH_MS);
  }
}
