import browser from 'webextension-polyfill';
import { defineContentScript } from 'wxt/utils/define-content-script';
import '../feed/blur.css';
import '../feed/skeleton.css';
import { adapterFor } from '../adapters';
import { toStatus, worthReporting, type EngineStatus } from '../core/engine-status';
import { logger } from '../core/log';
import { needsTopics } from '../core/settings';
import { listenForReveal } from '../feed/blur';
import { mountFeedbackBar } from '../feed/feedback-bar';
import { FeedFilter } from '../feed/filter';
import { mountHiddenBadge } from '../feed/hidden-badge';
import { mountNudge } from '../feed/nudge';
import { Tuning } from '../feed/tuning';
import { EngineClient } from '../platform/engine-client';
import { translate } from '../platform/i18n';
import { requestPopup } from '../platform/open-popup';
import {
  publishEngineStatus,
  publishFeedDetected,
  serveEngineStatus,
} from '../platform/status-channel';
import { feedbackStoreFor, loadSettings, onSettingsChanged } from '../platform/storage';

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
  const engine = new EngineClient();
  const badge = mountHiddenBadge({
    iconUrl: browser.runtime.getURL('icon/32.png'),
    t: translate,
    onClick: requestPopup,
  });
  const filter = new FeedFilter({
    adapter,
    engine,
    tuner,
    settings,
    detectLanguage: (text) => browser.i18n.detectLanguage(text),
    t: translate,
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

  const nudge = mountNudge(browser.runtime.getURL('icon-gray/48.png'), translate);
  nudge.setVisible(needsTopics(settings));
  onSettingsChanged((next) => {
    const modelChanged = next.model !== settings.model;
    settings = next;
    nudge.setVisible(needsTopics(next));
    // The store now answers for the new model, so what this tab holds in memory
    // is the old model's ratings until it is told to read again.
    if (modelChanged) void tuner.reload();
    filter.applySettings(next);
    badge.setVisible(filter.active);
  });
  tuner.onChange(() => filter.tuningChanged());

  const feedbackBar = mountFeedbackBar({
    t: translate,
    postAt: (target) => filter.ratable(target),
    onFeedback: (post, liked) => filter.feedback(post, liked),
  });
  engine.onBusyChange((busy) => feedbackBar.setBusy(busy));
  listenForReveal(translate, document, (element) => filter.revealed(element));

  filter.start();
  badge.setVisible(filter.active);
  log.info('content script started', {
    host: location.hostname,
    adapter: adapter.id,
    topics: settings.topics.length,
    active: filter.active,
  });
}
