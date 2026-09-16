import { defineContentScript } from 'wxt/utils/define-content-script';
import '../feed/blur.css';
import { logger } from '../core/log';

import { adapterFor, type Post } from '../adapters';
import { ScoreCache } from '../core/cache';
import {
  isActiveOn,
  needsTopics,
  overrideFor,
  topicsEqual,
  type Settings,
} from '../core/settings';
import { loadSettings, onSettingsChanged } from '../core/settings-storage';
import { toStatus, worthReporting, type EngineStatus } from '../core/engine-status';
import {
  publishEngineStatus,
  publishFeedDetected,
  serveEngineStatus,
} from '../core/status-channel';
import {
  blur,
  clearPending,
  isBlurred,
  isRevealed,
  listenForReveal,
  markPending,
  peek,
  reveal,
  revealAll,
} from '../feed/blur';
import { clearAllScores, clearScore, stampScore } from '../feed/score-badge';
import { hasMedia } from '../feed/media';
import { LanguageCache } from '../feed/language-detector';
import { decide as decideAction, decideWithoutScore, type Action } from '../feed/policy';
import { ScoreWindow } from '../feed/threshold';
import { FeedScanner } from '../feed/scanner';
import { Conversations } from '../feed/conversation';
import { ScoreQueue, forEngine } from '../feed/queue';
import { Tuning } from '../feed/tuning';
import { mountFeedbackBar, type PostRef } from '../feed/feedback-bar';
import { EngineClient } from '../feed/engine-client';
import { mountNudge } from '../feed/nudge';

export default defineContentScript({
  matches: [
    '*://x.com/*',
    '*://twitter.com/*',
    '*://linkedin.com/*',
    '*://*.linkedin.com/*',
    '*://reddit.com/*',
    '*://*.reddit.com/*',
  ],
  runAt: 'document_start',
  cssInjectionMode: 'manifest',
  main: () => {
    start().catch((error: unknown) => {
      log.error('content script failed to start', { reason: describe(error) });
    });
  },
});

const log = logger('content');

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function start(): Promise<void> {
  const adapter = adapterFor(location.hostname);
  if (!adapter) {
    log.info('no adapter for host, standing down', { host: location.hostname });
    return;
  }
  publishFeedDetected();

  let settings = await loadSettings();
  const tuner = await Tuning.load();
  const cache = new ScoreCache();
  const languages = new LanguageCache();
  const scoreWindow = new ScoreWindow();

  // Held in memory and served on request. The popup cannot see into this tab,
  // and without an answer a first-run download looks like a broken install.
  let engineStatus: EngineStatus = { state: 'idle' };
  serveEngineStatus(() => engineStatus);

  const engine = new EngineClient((next) => {
    const status = toStatus(next);
    if (worthReporting(engineStatus, status)) publishEngineStatus(status);
    engineStatus = status;
    if (next.state === 'ready') {
      scanner.sweep(document);
      void queue.flush();
    }
    if (next.state === 'error') revealAll(document);
  });

  const nudge = mountNudge();
  const showNudge = () => nudge.setVisible(needsTopics(settings, location.hostname));

  const active = () => isActiveOn(settings, location.hostname);
  const tuning = () => settings.tuneFromFeedback && tuner.count > 0;
  const corrections = () =>
    settings.tuneFromFeedback ? tuner.corrections(settings.topics) : [];

  const threshold = () => scoreWindow.cut(settings, tuning());
  const conversations = new Conversations(isRevealed);

  /** Returns what it did, so callers need not re-derive the verdict to count it. */
  const decide = (post: Post, score: number | undefined): Action | undefined => {
    const cut = threshold();
    if (settings.showScores) stampScore(post.container, score, cut, post.text.length);
    else clearScore(post.container);
    if (isRevealed(post.container)) {
      release(post.container, true);
      return undefined;
    }
    const followsKept =
      conversations.followsKept(post.container) &&
      overrideFor(settings, post.text) !== 'blur';
    return apply(
      post,
      followsKept ? 'reveal' : decideAction({ ...grounds(post), score, threshold: cut }),
    );
  };

  const grounds = (post: Post) => ({
    settings,
    text: post.text,
    hasMedia: hasMedia(post.container, adapter),
    language: languages.get(post.text),
  });

  const REASONS = {
    'blur-media': 'media',
    'blur-language': 'language',
    blur: 'topic',
  } as const;

  const apply = (post: Post, action: Action): Action => {
    if (action === 'reveal') reveal(post.container);
    else if (action === 'peek') peek(post.container, post.text);
    else blur(post.container, REASONS[action], settings.collapseBlurred);
    release(post.container, action === 'reveal');
    return action;
  };

  const release = (container: HTMLElement, kept: boolean): void => {
    for (const reply of conversations.settle(container, kept)) enqueue(reply);
  };

  const queue = new ScoreQueue(engine, (results) => {
    scoreWindow.add(results.map((r) => r.score));
    const cut = threshold();
    let blurred = 0;
    for (const { post, score } of results) {
      if (score !== undefined) cache.set(post.text, score);
      if (!post.container.isConnected) continue;
      const action = decide(post, score);
      if (action !== undefined && action !== 'reveal') blurred += 1;
    }
    log.info('batch applied', {
      posts: results.length,
      blurred,
      threshold: cut.toFixed(3),
      adapted: tuning(),
    });
  });

  /** Cached or overridden posts are decided here and never reach the engine. */
  const enqueue = (post: Post): void => {
    const cached = cache.get(post.text);
    const route = conversations.route(post);
    if (route === 'wait') {
      hold(post);
      return;
    }
    if (route === 'keep') {
      decide(post, cached);
      return;
    }
    if (
      post.text.trim() === '' ||
      cached !== undefined ||
      overrideFor(settings, post.text)
    ) {
      decide(post, cached);
      return;
    }
    if (!settings.blurOtherLanguages) {
      hold(post);
      queue.add(post);
      return;
    }
    void detectThenQueue(post);
  };

  /**
   * Detection runs first because it can settle the post outright, and a post it
   * claims costs no inference. Held rather than revealed in the meantime: a
   * reveal now would flash the text a moment before the blur lands on it.
   */
  const detectThenQueue = async (post: Post): Promise<void> => {
    hold(post);
    await languages.detect(post.text);
    if (!post.container.isConnected || isRevealed(post.container)) return;
    const settled = decideWithoutScore(grounds(post));
    if (settled === undefined) {
      queue.add(post);
      return;
    }
    clearPending(post.container);
    apply(post, settled);
  };

  /** Nothing is softened while the engine is still warming — that is a download. */
  const hold = (post: Post): void => {
    if (engine.ready) markPending(post.container);
  };

  const scanner = new FeedScanner({
    adapter,
    isActive: active,
    onEnterView: enqueue,
  });

  /** Threshold changes re-apply from cache: raw scores mean no re-inference. */
  const rescore = (): void => {
    const posts = adapter.findPosts(document);
    const anchorsFirst = [
      ...posts.filter((p) => !p.anchor),
      ...posts.filter((p) => p.anchor),
    ];
    for (const post of anchorsFirst) decide(post, cache.get(post.text));
  };

  /** Topics and corrections both change the query, so both force a re-embed. */
  const requery = (): void => {
    engine.setTopics(settings.topics, corrections());
    queue.invalidate();
    cache.clear();
    conversations.reset();
    scanner.reset();
  };

  const applySettings = (next: Settings): void => {
    const topicsChanged = !topicsEqual(next.topics, settings.topics);
    const tuningChanged = next.tuneFromFeedback !== settings.tuneFromFeedback;
    const wasActive = active();
    settings = next;
    showNudge();
    if (!active()) {
      revealAll(document);
      clearAllScores(document);
      return;
    }
    engine.connect();
    if (topicsChanged) void persist(tuner.keepOnly(next.topics));
    if (topicsChanged || tuningChanged || !wasActive) requery();
    else rescore();
  };

  /** Storage can refuse a write (quota); the correction is lost, the feed is not. */
  const persist = (write: Promise<void>): Promise<boolean> =>
    write.then(
      () => true,
      (error: unknown) => {
        log.warn('corrections not saved', { reason: describe(error) });
        return false;
      },
    );

  const takeFeedback = (post: PostRef, liked: boolean): void => {
    const store = async (topic: string, vector: number[]): Promise<void> => {
      if (!(await persist(tuner.record(topic, post.text, vector, liked)))) return;
      log.info('feedback stored', { corrections: tuner.count });
      if (settings.tuneFromFeedback) requery();
    };

    /** Already rated: re-clicking toggles or flips it, and we hold the vector. */
    const existing = tuner.ratingOf(post.text);
    if (existing) {
      void store(existing.topic, []);
      return;
    }

    // Correct from the same text that was scored; the rating stays keyed by the
    // whole post, so an existing rating still matches.
    void engine.feedback(forEngine(post.text), liked).then(({ vector, topic }) => {
      const line = settings.topics[topic];
      if (vector.length > 0 && line !== undefined) void store(line, vector);
    });
  };

  mountFeedbackBar({
    postAt: (target) => {
      if (!settings.tuneFromFeedback) return undefined;
      const container = target.closest<HTMLElement>(adapter.containerSelector);
      const found = container ? adapter.findPosts(container)[0] : undefined;
      if (!found || !scanner.knows(found.container)) return undefined;
      if (isBlurred(found.container)) return undefined;
      return { ...found, rating: tuner.ratingOf(found.text)?.liked };
    },
    onFeedback: takeFeedback,
  });

  listenForReveal(document, (element) => {
    release(element, true);
    for (const post of adapter.findPosts(document)) {
      if (conversations.followsKept(post.container) && isBlurred(post.container)) {
        reveal(post.container);
      }
    }
  });
  onSettingsChanged(applySettings);
  scanner.start();
  showNudge();

  log.info('content script started', {
    host: location.hostname,
    adapter: adapter.id,
    topics: settings.topics.length,
    active: active(),
  });

  if (active()) {
    engine.connect();
    void persist(tuner.keepOnly(settings.topics));
    engine.setTopics(settings.topics, corrections());
  }
}
