import { hashText } from '../core/cache';
import {
  EMPTY_FEEDBACK,
  correctionsFor,
  count,
  counts,
  findRating,
  forTopics,
  rate,
  type Feedback,
  type TopicCorrections,
} from '../core/feedback';
import { loadFeedback, saveFeedback } from '../core/feedback-storage';

/**
 * Owns the user's corrections and their persistence. Vectors only: the
 * correction survives, the post does not.
 */
export class Tuning {
  #feedback: Feedback = EMPTY_FEEDBACK;

  static async load(): Promise<Tuning> {
    const tuning = new Tuning();
    tuning.#feedback = await loadFeedback().catch(() => EMPTY_FEEDBACK);
    return tuning;
  }

  get count(): number {
    return count(this.#feedback);
  }

  get counts(): ReturnType<typeof counts> {
    return counts(this.#feedback);
  }

  /** Aligned with `topics`, so the worker corrects each line with its own. */
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
    await saveFeedback(this.#feedback);
  }

  /** Drops corrections for lines the user has removed or rewritten. */
  async keepOnly(topics: readonly string[]): Promise<void> {
    this.#feedback = forTopics(this.#feedback, topics);
    await saveFeedback(this.#feedback);
  }
}
