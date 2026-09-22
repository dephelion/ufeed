import browser from 'webextension-polyfill';
import { defineContentScript } from 'wxt/utils/define-content-script';
import '../feed/blur.css';
import '../feed/skeleton.css';
import { adapterFor } from '../adapters';
import { toStatus, worthReporting, type EngineStatus } from '../core/engine-status';
import { logger } from '../core/log';
import type { Translate } from '../core/messages';
import { needsTopics } from '../core/settings';
import { listenForReveal, relabelBlurred } from '../feed/blur';
import { mountFeedbackBar } from '../feed/feedback-bar';
import { FeedFilter } from '../feed/filter';
import { mountHiddenBadge } from '../feed/hidden-badge';
import { mountNudge } from '../feed/nudge';
import { Tuning } from '../feed/tuning';
import { EngineClient } from '../platform/engine-client';
import { translatorFor } from '../platform/i18n';
import { requestPopup } from '../platform/open-popup';
import {
  publishEngineStatus,
  publishFeedDetected,
  serveEngineStatus,
} from '../platform/status-channel';
import { feedbackStoreFor, loadSettings, onSettingsChanged } from '../platform/storage';
import { serveTabSwitch } from '../platform/tab-switch';

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
  publishFeedDetected();

  // Tracked here because the feedback store reads the model on every call: it
  // has to see the switch at the same moment the filter does.
  let settings = await loadSettings();
  const tuner = await Tuning.load(feedbackStoreFor(() => settings.model));
  // Looked up on every call, so each module holding `t` follows a later pick.
  let translator = await translatorFor(settings.language);
  const t: Translate = (key, ...substitutions) => translator(key, ...substitutions);
  const engine = new EngineClient();
  const badge = mountHiddenBadge({
    iconUrl: browser.runtime.getURL('icon/32.png'),
    t,
    onClick: requestPopup,
  });
  const filter = new FeedFilter({
    adapter,
    engine,
    tuner,
    settings,
    detectLanguage: (text) => browser.i18n.detectLanguage(text),
    t,
    onHiddenChange: (count) => badge.setCount(count),
  });

  // Held in memory and served on request. The popup cannot see into this tab,
  // and without an answer a first-run download looks like a broken install.
  let engineStatus: EngineStatus = { state: 'idle' };
  serveEngineStatus(() => engineStatus);
  engine.onStatus((next) => {
    const status = toStatus(next);
    if (worthReporting(engineStatus, status)) publishEngineStatus(status);
    engineStatus = status;
    filter.engineChanged(next.state);
  });

  const nudge = mountNudge(browser.runtime.getURL('icon-gray/48.png'), t);
  nudge.setVisible(needsTopics(settings, filter.on));
  onSettingsChanged((next) => {
    const modelChanged = next.model !== settings.model;
    settings = next;
    nudge.setVisible(needsTopics(next, filter.on));
    // The store now answers for the new model, so what this tab holds in memory
    // is the old model's ratings until it is told to read again.
    if (modelChanged) void tuner.reload();
    filter.applySettings(next);
    badge.setVisible(filter.active);
  });
  tuner.onChange(() => filter.tuningChanged());
  serveTabSwitch(
    () => filter.on,
    (on) => {
      filter.setOn(on);
      nudge.setVisible(needsTopics(settings, on));
      badge.setVisible(filter.active);
    },
  );

  const feedbackBar = mountFeedbackBar({
    t,
    postAt: (target) => filter.ratable(target),
    onFeedback: (post, liked) => filter.feedback(post, liked),
  });
  engine.onBusyChange((busy) => feedbackBar.setBusy(busy));
  listenForReveal(t, document, (element) => filter.revealed(element));

  // A pick in the popup reaches a tab that is already open (i18n.md).
  let language = settings.language;
  onSettingsChanged((next) => {
    if (next.language === language) return;
    language = next.language;
    void translatorFor(language).then((picked) => {
      translator = picked;
      badge.relabel();
      nudge.relabel();
      feedbackBar.relabel();
      relabelBlurred(t);
    });
  });

  filter.start();
  badge.setVisible(filter.active);
  log.info('content script started', {
    host: location.hostname,
    adapter: adapter.id,
    topics: settings.topics.length,
    active: filter.active,
  });
}
