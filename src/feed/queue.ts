import type { Post } from '../adapters';
import { logger } from '../core/log';
import type { EngineClient } from './engine-client';

const BATCH_SIZE = 16;
const FLUSH_MS = 100;
/** Long posts cost tokens without adding signal; e5 does not shift with length. */
const MAX_CHARS = 1200;

/** Every text the engine embeds passes through here, scored or thumbed alike. */
export const forEngine = (text: string): string => text.slice(0, MAX_CHARS);

const log = logger('queue');

export interface Scored {
  post: Post;
  score: number | undefined;
}

/**
 * Batches posts to the engine. Holds the batch rather than dropping it while the
 * engine is warming, and discards replies issued against a query that has since
 * changed — a score means nothing once the topic vectors move.
 */
export class ScoreQueue {
  readonly #pending = new Map<HTMLElement, string>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #epoch = 0;

  constructor(
    private readonly engine: EngineClient,
    private readonly onScored: (results: Scored[]) => void,
  ) {}

  add(post: Post): void {
    this.#pending.set(post.container, forEngine(post.text));
    if (this.#pending.size >= BATCH_SIZE) void this.flush();
    else this.#schedule();
  }

  /** Replies in flight were scored against the old query; ignore them. */
  invalidate(): void {
    this.#epoch += 1;
  }

  async flush(): Promise<void> {
    clearTimeout(this.#timer);
    if (this.#pending.size === 0) return;
    if (!this.engine.ready) {
      log.info('engine not ready, holding batch', {
        queued: this.#pending.size,
        state: this.engine.status.state,
      });
      return;
    }

    const issuedAt = this.#epoch;
    const batch = [...this.#pending.entries()].slice(0, BATCH_SIZE);
    for (const [element] of batch) this.#pending.delete(element);

    const scores = await this.engine.score(batch.map(([, text]) => text));
    if (issuedAt !== this.#epoch) {
      log.info('discarding scores for a previous query', { posts: batch.length });
      return;
    }

    this.onScored(
      batch.map(([container, text], i) => ({
        post: { container, text },
        score: scores[i],
      })),
    );
    if (this.#pending.size > 0) this.#schedule();
  }

  #schedule(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.flush(), FLUSH_MS);
  }
}
