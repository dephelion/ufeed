import { ScoreCache } from '../core/cache';
import { logger } from '../core/log';
import { gatesLanguage } from '../core/language';
import { modelFor } from '../core/models';
import type { EngineState } from '../core/protocol';
import { isActive, topicsEqual, type Settings } from '../core/settings';
import { decide as decideAction, decideWithoutScore, type Action } from '../core/policy';
import { thresholdForStrictness, type RatedMatch } from '../core/scoring';
import {
  blur,
  clearPending,
  isBlurred,
  isRevealed,
  markPending,
  peek,
  reveal,
  revealAll,
} from './blur';
import { Conversation } from './conversation';
import type { PostRef } from './feedback-bar';
import { LanguageCache } from './language-cache';
import type { DetectLanguage, Engine, Post, SiteAdapter } from './ports';
import { ScoreQueue, forEngine, type Scored } from './queue';
import { FeedScanner, hasMedia } from './scanner';
import { clearAllScores, clearScore, stampScore } from './score-badge';
import type { Tuning } from './tuning';

const log = logger('filter');

const REASONS = {
  'blur-media': 'media',
  'blur-language': 'language',
  blur: 'topic',
} as const;

export interface FeedFilterOptions {
  adapter: SiteAdapter;
  engine: Engine;
  tuner: Tuning;
  settings: Settings;
  detectLanguage: DetectLanguage;
}

/**
 * Every feed decision on the page: what to score, what to blur, when to ask the
 * engine again. The content script only wires it to storage and the page.
 */
export class FeedFilter {
  readonly #adapter: SiteAdapter;
  readonly #engine: Engine;
  readonly #tuner: Tuning;
  #settings: Settings;
  readonly #cache = new ScoreCache();
  readonly #languages: LanguageCache;
  readonly #conversation: Conversation | undefined;
  readonly #queue: ScoreQueue;
  readonly #scanner: FeedScanner;
  /** What the worker last received, so a stored change it already has is not re-sent. */
  #sentRatings = '';

  constructor({ adapter, engine, tuner, settings, detectLanguage }: FeedFilterOptions) {
    this.#adapter = adapter;
    this.#engine = engine;
    this.#tuner = tuner;
    this.#settings = settings;
    this.#languages = new LanguageCache(detectLanguage);
    this.#conversation = Conversation.for(adapter);
    this.#queue = new ScoreQueue(
      engine,
      (results) => this.#applyBatch(results),
      () => this.#model().batchSize,
      // Re-held as the batch goes out, so the posts actually being judged carry
      // the pending state for as long as that takes, however long they queued.
      (posts) => posts.forEach((post) => this.#hold(post)),
    );
    this.#scanner = new FeedScanner({
      adapter,
      isActive: () => this.active,
      onEnterView: (post) => this.#enqueue(post),
    });
  }

  get active(): boolean {
    return isActive(this.#settings);
  }

  start(): void {
    this.#scanner.start();
    if (!this.active) return;
    this.#engine.connect(this.#settings.model);
    void this.#persist(this.#tuner.keepOnly(this.#settings.topics));
    this.#requery();
  }

  stop(): void {
    this.#scanner.stop();
    this.#queue.invalidate();
  }

  engineChanged(state: EngineState): void {
    if (state === 'ready') {
      this.#scanner.sweep(document);
      void this.#queue.flush();
    }
    if (state === 'error') revealAll(document);
  }

  applySettings(next: Settings): void {
    const topicsChanged = !topicsEqual(next.topics, this.#settings.topics);
    const tuningChanged = next.tuneFromFeedback !== this.#settings.tuneFromFeedback;
    const modelChanged = next.model !== this.#settings.model;
    const wasActive = this.active;
    this.#settings = next;
    if (!this.active) {
      this.#queue.invalidate();
      revealAll(document);
      clearAllScores(document);
      return;
    }
    // Every cached score is in the old model's space, and so is every language
    // verdict the old model's gate produced. Both go before the new one answers.
    if (modelChanged) {
      this.#languages.clear();
      this.#engine.restart(next.model);
    } else {
      this.#engine.connect(next.model);
    }
    if (topicsChanged) void this.#persist(this.#tuner.keepOnly(next.topics));
    if (topicsChanged || tuningChanged || modelChanged || !wasActive) this.#requery();
    else this.#rescore();
  }

  /** A clear, an import or a thumb in another tab. */
  tuningChanged(): void {
    if (!this.active || !this.#settings.tuneFromFeedback) return;
    if (this.#tuner.signature(this.#settings.topics) !== this.#sentRatings)
      this.#requery();
  }

  /** The post under the pointer, when it is one a thumb can rate. */
  ratable(target: Element): PostRef | undefined {
    if (!this.#settings.tuneFromFeedback) return undefined;
    const container = target.closest<HTMLElement>(this.#adapter.containerSelector);
    const found = container ? this.#adapter.findPosts(container)[0] : undefined;
    if (!found || !this.#scanner.knows(found.container)) return undefined;
    if (isBlurred(found.container)) return undefined;
    if (this.#conversation?.keeps(found.container)) return undefined;
    return { ...found, rating: this.#tuner.ratingOf(found.text)?.liked };
  }

  feedback(post: PostRef, liked: boolean): void {
    // Read again at click time: expanding "…more" since hover changes the text.
    const text = this.#adapter.findPosts(post.container)[0]?.text ?? post.text;
    const store = async (topic: string, vector: number[]): Promise<void> => {
      if (!(await this.#persist(this.#tuner.record(topic, text, vector, liked)))) return;
      log.info('feedback stored', { corrections: this.#tuner.count });
      this.tuningChanged();
    };

    const existing = this.#tuner.ratingOf(text);
    if (existing) {
      void store(existing.topic, []);
      return;
    }

    // Correct from the same text that was scored; the rating stays keyed by the
    // whole post, so an existing rating still matches.
    void this.#engine.feedback(forEngine(text), liked).then(({ vector, topic }) => {
      const line = this.#settings.topics[topic];
      if (vector.length > 0 && line !== undefined) void store(line, vector);
    });
  }

  /** A reader's reveal click hands the post's replies back to be routed again. */
  revealed(container: HTMLElement): void {
    this.#settle(container, true);
  }

  #threshold(): number {
    return thresholdForStrictness(this.#settings.strictness, this.#model());
  }

  #model() {
    return modelFor(this.#settings.model);
  }

  #applyBatch(results: Scored[]): void {
    let blurred = 0;
    for (const { post, match } of results) {
      if (match !== undefined) this.#cache.set(post.text, match);
      if (!post.container.isConnected) continue;
      const action = this.#decide(post, match);
      if (action !== undefined && action !== 'reveal') blurred += 1;
    }
    log.info('batch applied', {
      posts: results.length,
      blurred,
      rated: results.filter((r) => r.match?.rating !== undefined).length,
      threshold: this.#threshold().toFixed(3),
    });
  }

  /** Returns what it did, so callers need not re-derive the verdict to count it. */
  #decide(post: Post, match: RatedMatch | undefined): Action | undefined {
    const score = match?.score;
    const rating = match?.rating;
    const cut = this.#threshold();
    const revealed = isRevealed(post.container);
    const followsKept = !revealed && this.#conversation?.route(post) === 'keep';
    const judged = { ...this.#grounds(post), score, threshold: cut, rating };
    // A revealed post stays shown whatever the rating, so the badge is the thumb's only confirmation.
    const ratingShown =
      rating !== undefined &&
      (revealed || (!followsKept && decideWithoutScore(judged) === undefined));
    if (this.#settings.showScores)
      stampScore(post.container, {
        score,
        needs: cut,
        chars: post.text.length,
        lines: match?.lines,
        rating: ratingShown ? rating : undefined,
      });
    else clearScore(post.container);
    if (revealed) {
      this.#settle(post.container, true);
      return undefined;
    }
    return this.#apply(post, followsKept ? 'reveal' : decideAction(judged));
  }

  #grounds(post: Post) {
    return {
      settings: this.#settings,
      text: post.text,
      hasMedia: hasMedia(post.container, this.#adapter),
      language: this.#languages.get(post.text),
    };
  }

  #apply(post: Post, action: Action): Action {
    const collapse = this.#settings.collapseBlurred;
    if (action === 'reveal') reveal(post.container);
    else if (action === 'peek') peek(post.container, post.text, collapse);
    else blur(post.container, REASONS[action], collapse);
    this.#settle(post.container, action === 'reveal');
    return action;
  }

  #settle(container: HTMLElement, kept: boolean): void {
    for (const reply of this.#conversation?.settle(container, kept) ?? [])
      this.#enqueue(reply);
  }

  /** Cached posts are decided here and never reach the engine. */
  #enqueue(post: Post): void {
    const cached = this.#cache.get(post.text);
    const route = this.#conversation?.route(post);
    if (route === 'wait') {
      this.#hold(post);
      return;
    }
    if (route === 'keep' || post.text.trim() === '' || cached !== undefined) {
      this.#decide(post, cached);
      return;
    }
    // A model that reads every language has nothing to gate, so detection is
    // skipped outright rather than run and ignored.
    if (!gatesLanguage(this.#settings, this.#model())) {
      this.#hold(post);
      this.#queue.add(post);
      return;
    }
    void this.#detectThenQueue(post);
  }

  /**
   * Detection runs first because it can settle the post outright, and a post it
   * claims costs no inference. Held rather than revealed in the meantime: a
   * reveal now would flash the text a moment before the blur lands on it.
   */
  async #detectThenQueue(post: Post): Promise<void> {
    // Scored anyway: it is never re-blurred, but its badge must follow a new rating.
    if (isRevealed(post.container)) return this.#queue.add(post);
    this.#hold(post);
    await this.#languages.detect(post.text, this.#model());
    if (!post.container.isConnected) return;
    if (isRevealed(post.container)) return this.#queue.add(post);
    const settled = decideWithoutScore(this.#grounds(post));
    if (settled === undefined) {
      this.#queue.add(post);
      return;
    }
    clearPending(post.container);
    this.#apply(post, settled);
  }

  /** Nothing is softened while the engine is still warming — that is a download. */
  #hold(post: Post): void {
    if (this.#engine.ready) markPending(post.container);
  }

  /** Threshold changes re-apply from cache: raw scores mean no re-inference. */
  #rescore(): void {
    for (const post of this.#adapter.findPosts(document))
      this.#decide(post, this.#cache.get(post.text));
  }

  /** Topics and corrections both change the query, so both force a re-embed. */
  #requery(): void {
    const { topics, tuneFromFeedback } = this.#settings;
    this.#sentRatings = tuneFromFeedback ? this.#tuner.signature(topics) : '';
    this.#engine.setTopics(
      topics,
      tuneFromFeedback ? this.#tuner.corrections(topics) : [],
    );
    this.#queue.invalidate();
    this.#cache.clear();
    this.#conversation?.reset();
    this.#scanner.reset();
  }

  /** Storage can refuse a write (quota); the correction is lost, the feed is not. */
  #persist(write: Promise<void>): Promise<boolean> {
    return write.then(
      () => true,
      (error: unknown) => {
        log.warn('corrections not saved', {
          reason: error instanceof Error ? error.message : String(error),
        });
        return false;
      },
    );
  }
}
