import { defineContentScript } from 'wxt/utils/define-content-script';
import '../feed/blur.css';
import { logger } from '../core/log';

import { adapterFor, type Post } from '../adapters';
import { ScoreCache } from '../core/cache';
import { isActiveOn, overrideFor, topicsEqual, type Settings } from '../core/settings';
import { loadSettings, onSettingsChanged } from '../core/settings-storage';
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
import { ScoreQueue } from '../feed/queue';
import { Tuning } from '../feed/tuning';
import { mountFeedbackBar, type PostRef } from '../feed/feedback-bar';
import { EngineClient } from '../feed/engine-client';

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
      log.error('content script failed to start', {
        reason: error instanceof Error ? error.message : String(error),
      });
    });
  },
});

const log = logger('content');

async function start(): Promise<void> {
  const adapter = adapterFor(location.hostname);
  if (!adapter) {
    log.info('no adapter for host, standing down', { host: location.hostname });
    return;
  }

  let settings = await loadSettings();
  const tuner = await Tuning.load();
  const cache = new ScoreCache();
  const languages = new LanguageCache();
  const scoreWindow = new ScoreWindow();

  const engine = new EngineClient((next) => {
    if (next.state === 'ready') {
      scanner.sweep(document);
      void queue.flush();
    }
    if (next.state === 'error') revealAll(document);
  });

  const active = () => isActiveOn(settings, location.hostname);
  const tuning = () => settings.tuneFromFeedback && tuner.count > 0;
  const corrections = () =>
    settings.tuneFromFeedback ? tuner.corrections(settings.topics) : [];

  const threshold = () => scoreWindow.cut(settings, tuning());

  /** Returns what it did, so callers need not re-derive the verdict to count it. */
  const decide = (post: Post, score: number | undefined): Action | undefined => {
    const cut = threshold();
    if (settings.showScores) stampScore(post.container, score, cut, post.text.length);
    else clearScore(post.container);
    if (isRevealed(post.container)) return undefined;
    return apply(post, decideAction({ ...grounds(post), score, threshold: cut }));
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
    return action;
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
    for (const post of adapter.findPosts(document)) decide(post, cache.get(post.text));
  };

  /** Topics and corrections both change the query, so both force a re-embed. */
  const requery = (): void => {
    engine.setTopics(settings.topics, corrections());
    queue.invalidate();
    cache.clear();
    scanner.reset();
  };

  const applySettings = (next: Settings): void => {
    const topicsChanged = !topicsEqual(next.topics, settings.topics);
    const tuningChanged = next.tuneFromFeedback !== settings.tuneFromFeedback;
    settings = next;
    if (!active()) {
      revealAll(document);
      clearAllScores(document);
      return;
    }
    engine.connect();
    if (topicsChanged) void tuner.keepOnly(next.topics);
    if (topicsChanged || tuningChanged) requery();
    else rescore();
  };

  const takeFeedback = (post: PostRef, liked: boolean): void => {
    const store = async (topic: string, vector: number[]): Promise<void> => {
      await tuner.record(topic, post.text, vector, liked);
      log.info('feedback stored', { corrections: tuner.count });
      if (settings.tuneFromFeedback) requery();
    };

    /** Already rated: re-clicking toggles or flips it, and we hold the vector. */
    const existing = tuner.ratingOf(post.text);
    if (existing) {
      void store(existing.topic, []);
      return;
    }

    void engine.feedback(post.text, liked).then(({ vector, topic }) => {
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

  listenForReveal(document);
  onSettingsChanged(applySettings);
  scanner.start();

  log.info('content script started', {
    host: location.hostname,
    adapter: adapter.id,
    topics: settings.topics.length,
    active: active(),
  });

  if (active()) {
    engine.connect();
    void tuner.keepOnly(settings.topics);
    engine.setTopics(settings.topics, corrections());
  }
}
