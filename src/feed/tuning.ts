import { hashText } from '../core/cache';
import {
  EMPTY_FEEDBACK,
  correctionsFor,
  count,
  counts,
  findRating,
  forTopics,
  rate,
  ratingsFor,
  type Feedback,
  type TopicCorrections,
} from '../core/feedback';
import type { FeedbackStore } from './ports';

/**
 * Owns the user's corrections and their persistence. Vectors only: the
 * correction survives, the post does not.
 */
export class Tuning {
  #feedback: Feedback = EMPTY_FEEDBACK;
  #onChange: () => void = () => {};

  private constructor(private readonly store: FeedbackStore) {}

  static async load(store: FeedbackStore): Promise<Tuning> {
    const tuning = new Tuning(store);
    tuning.#feedback = await store.load().catch(() => EMPTY_FEEDBACK);
    store.onChange((next) => {
      tuning.#feedback = next;
      tuning.#onChange();
    });
    return tuning;
  }

  /** Fires on every stored change, this tab's own writes included. */
  onChange(fn: () => void): void {
    this.#onChange = fn;
  }

  /**
   * Re-reads the store. Needed when the answer changed without the stored value
   * changing — a model switch moves which ratings this tab is reading.
   */
  async reload(): Promise<void> {
    this.#feedback = await this.store.load().catch(() => EMPTY_FEEDBACK);
    this.#onChange();
  }

  /** Which posts are rated which way on these lines; equal means nothing to re-send. */
  signature(topics: readonly string[]): string {
    return topics
      .map((topic) =>
        ratingsFor(this.#feedback, topic)
          .map((r) => `${r.key}${r.liked ? '+' : '-'}`)
          .join(','),
      )
      .join('|');
  }

  get count(): number {
    return count(this.#feedback);
  }

  get counts(): ReturnType<typeof counts> {
    return counts(this.#feedback);
  }

  /** Aligned with `topics`; filed per line so editing one line drops only its ratings. */
  corrections(topics: readonly string[]): TopicCorrections[] {
    return topics.map((topic) => correctionsFor(this.#feedback, topic));
  }

  /** The rating already given to this post, wherever it was filed. */
  ratingOf(text: string): { topic: string; liked: boolean } | undefined {
    return findRating(this.#feedback, hashText(text));
  }

  /**
   * Re-rating the same way un-rates; the other way flips it. An empty vector is
   * only ever passed for a post already held, which supplies its own.
   */
  async record(
    topic: string,
    text: string,
    vector: number[],
    liked: boolean,
  ): Promise<void> {
    this.#feedback = rate(this.#feedback, topic, hashText(text), vector, liked);
    await this.store.save(this.#feedback);
  }

  /** Drops corrections for lines the user has removed or rewritten. */
  async keepOnly(topics: readonly string[]): Promise<void> {
    this.#feedback = forTopics(this.#feedback, topics);
    await this.store.save(this.#feedback);
  }
}
