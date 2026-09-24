import { blockedKeyword, blursAsBlacklisted } from '../core/blacklist';
import { ScoreCache, hashText } from '../core/cache';
import { logger } from '../core/log';
import type { Translate } from '../core/messages';
import { gatesLanguage } from '../core/language';
import { modelFor } from '../core/models';
import type { EngineState } from '../core/protocol';
import {
  isActive,
  onlyLanguageChanged,
  topicsEqual,
  type Settings,
} from '../core/settings';
import { decide as decideAction, decideWithoutScore, type Action } from '../core/policy';
import { thresholdForStrictness, type RatedMatch } from '../core/scoring';
import {
  blur,
  isBlurred,
  isRevealed,
  peek,
  retag,
  reveal,
  revealAll,
  type BlurReason,
} from './blur';
import { hideAllSkeletons, hideSkeleton, isSkeleton, showSkeleton } from './skeleton';
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
  'blur-blacklist': 'blacklist',
  blur: 'topic',
} as const;

const reasonOf = (action: Action): BlurReason | undefined =>
  action === 'reveal' ? undefined : action === 'peek' ? 'peek' : REASONS[action];

export interface FeedFilterOptions {
  adapter: SiteAdapter;
  engine: Engine;
  tuner: Tuning;
  settings: Settings;
  detectLanguage: DetectLanguage;
  t: Translate;
  /** Told whenever the number of posts being hidden changes. */
  onHiddenChange?: (count: number) => void;
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
  /** This tab's switch. Never stored: turning one tab off leaves every other tab filtering. */
  #on = true;
  readonly #cache = new ScoreCache();
  readonly #languages: LanguageCache;
  readonly #conversation: Conversation | undefined;
  readonly #queue: ScoreQueue;
  readonly #scanner: FeedScanner;
  /** What the worker last received, so a stored change it already has is not re-sent. */
  #sentRatings = '';
  /** Content hashes of the posts being hidden: a virtualized feed remounts one post as a new node. */
  readonly #hidden = new Set<string>();
  readonly #onHiddenChange: (count: number) => void;
  readonly #t: Translate;

  constructor({
    adapter,
    engine,
    tuner,
    settings,
    detectLanguage,
    t,
    onHiddenChange = () => {},
  }: FeedFilterOptions) {
    this.#onHiddenChange = onHiddenChange;
    this.#t = t;
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
      // Held on enqueue and re-held on every flush: a post waiting its turn is
      // no more judged than the one in front of the engine, so it looks the same.
      (posts) => posts.forEach((post) => this.#hold(post)),
    );
    this.#scanner = new FeedScanner({
      adapter,
      isActive: () => this.active,
      // Held when found, before the next paint: one frame of the real post is the flash.
      onFound: (post) => {
        if (
          this.#settings.topics.length > 0 &&
          this.#conversation?.route(post) !== 'keep'
        )
          this.#hold(post);
      },
      onEnterView: (post) => this.#enqueue(post),
    });
  }

  get active(): boolean {
    return isActive(this.#settings, this.#on);
  }

  start(): void {
    this.#scanner.start();
    if (!this.active) return;
    if (this.#settings.topics.length > 0) this.#engine.connect(this.#settings.model);
    void this.#persist(this.#tuner.keepOnly(this.#settings.topics));
    this.#requery();
  }

  restore(): void {
    if (!this.active || this.#settings.topics.length === 0) return;
    this.#deactivate();
    this.#engine.restart(this.#settings.model);
    this.#requery();
  }

  stop(): void {
    this.#scanner.stop();
    this.#queue.invalidate();
  }

  engineChanged(state: EngineState): void {
    if (this.#settings.topics.length === 0) return;
    if (state === 'ready') {
      this.#scanner.sweep(document);
      void this.#queue.flush();
    }
    if (state === 'downloading' || state === 'error') hideAllSkeletons(document);
    if (state === 'error') {
      revealAll(document);
      this.#untrackAll();
    }
  }

  applySettings(next: Settings): void {
    if (onlyLanguageChanged(this.#settings, next)) {
      this.#settings = next;
      return;
    }
    const topicsChanged = !topicsEqual(next.topics, this.#settings.topics);
    const tuningChanged = next.tuneFromFeedback !== this.#settings.tuneFromFeedback;
    const modelChanged = next.model !== this.#settings.model;
    const blacklistChanged = !topicsEqual(next.blacklist, this.#settings.blacklist);
    const wasActive = this.active;
    this.#settings = next;
    if (!this.active) {
      this.#deactivate();
      return;
    }
    // Every cached score is in the old model's space, and so is every language
    // verdict the old model's gate produced. Both go before the new one answers.
    if (modelChanged && next.topics.length > 0) {
      this.#languages.clear();
      this.#engine.restart(next.model);
    } else if (next.topics.length > 0) {
      this.#engine.connect(next.model);
    }
    if (topicsChanged) void this.#persist(this.#tuner.keepOnly(next.topics));
    if (topicsChanged || tuningChanged || modelChanged || !wasActive) this.#requery();
    else if (blacklistChanged) this.#rescan();
    else this.#rescore();
  }

  get on(): boolean {
    return this.#on;
  }

  /** The popup's switch, for this tab alone. */
  setOn(on: boolean): void {
    if (on === this.#on) return;
    this.#on = on;
    if (!on) this.#deactivate();
    else if (this.active) this.#activate();
  }

  /** Starts filtering the page from scratch. */
  #activate(): void {
    if (this.#settings.topics.length > 0) this.#engine.connect(this.#settings.model);
    this.#requery();
  }

  /** Stops filtering and puts every post back the way the host drew it. */
  #deactivate(): void {
    this.#queue.invalidate();
    revealAll(document);
    this.#untrackAll();
    hideAllSkeletons(document);
    clearAllScores(document);
  }

  /** A clear, an import or a thumb in another tab. */
  tuningChanged(): void {
    if (!this.active || !this.#settings.tuneFromFeedback) return;
    if (this.#tuner.signature(this.#settings.topics) !== this.#sentRatings)
      this.#requery();
  }

  /** The post under the pointer, when it is one a thumb can rate. */
  ratable(target: Element): PostRef | undefined {
    if (!this.active || !this.#settings.tuneFromFeedback) return undefined;
    const container = target.closest<HTMLElement>(this.#adapter.containerSelector);
    const found = container ? this.#adapter.findPosts(container)[0] : undefined;
    if (!found || !this.#scanner.knows(found.container)) return undefined;
    if (isBlurred(found.container)) return undefined;
    if (this.#conversation?.keeps(found.container)) return undefined;
    // A thumb cannot move a keyword verdict, so offering one would mislead.
    if (blursAsBlacklisted(this.#settings, found.text)) return undefined;
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
    const text = this.#adapter.findPosts(container)[0]?.text;
    if (text !== undefined) this.#track(text, false);
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
      if (!post.container.isConnected) continue;
      const currentPost = this.#adapter.findPosts(post.container)[0];
      if (currentPost?.text !== post.text) continue;
      if (match !== undefined) this.#cache.set(post.text, match);
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
    const followsKept =
      !revealed &&
      this.#conversation?.route(post) === 'keep' &&
      !blursAsBlacklisted(this.#settings, post.text);
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
    const action = followsKept ? 'reveal' : decideAction(judged);
    if (revealed) {
      retag(post.container, this.#t, reasonOf(action), this.#keywordFor(post, action));
      this.#settle(post.container, true);
      return undefined;
    }
    return this.#apply(post, action);
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
    // The verdict landed, so the loading state is over whichever way it went. Only
    // a post that was actually held has a hold to be lifted out of; one re-judged
    // from the cache is wearing a blur, and the blur is not what the lift undoes.
    hideSkeleton(post.container, action === 'reveal' && isSkeleton(post.container));
    this.#track(post.text, action !== 'reveal');
    const collapse = this.#settings.collapseBlurred;
    if (action === 'reveal') reveal(post.container);
    else if (action === 'peek') peek(post.container, this.#t, post.text, collapse);
    else blur(post.container, this.#t, REASONS[action], collapse);
    const keyword = this.#keywordFor(post, action);
    if (keyword === undefined) delete post.container.dataset.lxKeyword;
    else post.container.dataset.lxKeyword = keyword;
    this.#settle(post.container, action === 'reveal');
    return action;
  }

  #keywordFor(post: Post, action: Action): string | undefined {
    return action === 'blur-blacklist'
      ? blockedKeyword(this.#settings, post.text)
      : undefined;
  }

  #track(text: string, hidden: boolean): void {
    const key = hashText(text);
    const before = this.#hidden.size;
    if (hidden) this.#hidden.add(key);
    else this.#hidden.delete(key);
    if (this.#hidden.size !== before) this.#onHiddenChange(this.#hidden.size);
  }

  #untrackAll(): void {
    if (this.#hidden.size === 0) return;
    this.#hidden.clear();
    this.#onHiddenChange(0);
  }

  #settle(container: HTMLElement, kept: boolean): void {
    for (const reply of this.#conversation?.settle(container, kept) ?? [])
      this.#enqueue(reply);
  }

  /** Cached posts are decided here and never reach the engine. */
  #enqueue(post: Post): void {
    if (this.#settings.topics.length === 0) {
      this.#decide(post, undefined);
      return;
    }
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
    if (!isRevealed(post.container) && blursAsBlacklisted(this.#settings, post.text)) {
      clearScore(post.container);
      this.#apply(post, 'blur-blacklist');
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
    hideSkeleton(post.container);
    this.#apply(post, settled);
  }

  /**
   * The one place the two states meet. A blurred or revealed post has a verdict, so
   * it is not loading. Held through warm-up, not a download: that wait is minutes.
   */
  #hold(post: Post): void {
    const { state } = this.#engine.status;
    if (state === 'downloading' || state === 'error') return;
    if (isBlurred(post.container) || isRevealed(post.container)) return;
    showSkeleton(post.container, this.#t);
  }

  /**
   * Threshold changes re-apply from cache: raw scores mean no re-inference. A held
   * post is still waiting on the engine; no score yet would fail open and reveal it.
   */
  #rescore(): void {
    for (const post of this.#adapter.findPosts(document)) {
      if (isSkeleton(post.container)) continue;
      this.#decide(post, this.#cache.get(post.text));
    }
  }

  /**
   * Scores stay valid: only the keyword tier moved, so every judged post is decided
   * again on the spot. One the tier had blurred was never scored; it goes to the engine.
   */
  #rescan(): void {
    for (const post of this.#adapter.findPosts(document)) {
      if (!this.#scanner.offered(post.container) || isSkeleton(post.container)) continue;
      this.#enqueue(post);
    }
  }

  /** Topics and corrections both change the query, so both force a re-embed. */
  #requery(): void {
    const { topics, tuneFromFeedback } = this.#settings;
    this.#sentRatings = tuneFromFeedback ? this.#tuner.signature(topics) : '';
    if (topics.length > 0)
      this.#engine.setTopics(
        topics,
        tuneFromFeedback ? this.#tuner.corrections(topics) : [],
      );
    this.#queue.invalidate();
    this.#cache.clear();
    this.#untrackAll();
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
