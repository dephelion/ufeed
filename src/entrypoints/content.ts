import { defineContentScript } from 'wxt/utils/define-content-script';
import '../feed/blur.css';
import { adapterFor } from '../adapters';
import { toStatus, worthReporting, type EngineStatus } from '../core/engine-status';
import { logger } from '../core/log';
import { loadSettings, needsTopics, onSettingsChanged } from '../core/settings';
import {
  publishEngineStatus,
  publishFeedDetected,
  serveEngineStatus,
} from '../core/status-channel';
import { listenForReveal } from '../feed/blur';
import { EngineClient } from '../feed/engine-client';
import { mountFeedbackBar } from '../feed/feedback-bar';
import { FeedFilter } from '../feed/filter';
import { mountNudge } from '../feed/nudge';
import { Tuning } from '../feed/tuning';

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

  const settings = await loadSettings();
  const tuner = await Tuning.load();
  const engine = new EngineClient();
  const filter = new FeedFilter({ adapter, engine, tuner, settings });

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

  const nudge = mountNudge();
  nudge.setVisible(needsTopics(settings));
  onSettingsChanged((next) => {
    nudge.setVisible(needsTopics(next));
    filter.applySettings(next);
  });
  tuner.onChange(() => filter.tuningChanged());

  const feedbackBar = mountFeedbackBar({
    postAt: (target) => filter.ratable(target),
    onFeedback: (post, liked) => filter.feedback(post, liked),
  });
  engine.onBusyChange((busy) => feedbackBar.setBusy(busy));
  listenForReveal(document, (element) => filter.revealed(element));

  filter.start();
  log.info('content script started', {
    host: location.hostname,
    adapter: adapter.id,
    topics: settings.topics.length,
    active: filter.active,
  });
}
