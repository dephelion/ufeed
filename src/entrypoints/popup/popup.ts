import { feedShownAt, junkShownAt } from '../../ml/scoring';
import {
  DEFAULT_SETTINGS,
  parseTopics,
  topicsEqual,
  topicsToText,
  type Settings,
} from '../../core/settings';
import { loadSettings, saveSettings } from '../../core/settings-storage';
import { counts } from '../../core/feedback';
import { clearFeedback, loadFeedback } from '../../core/feedback-storage';
import {
  describeEngine,
  summarizeEngine,
  type EngineStatus,
} from '../../core/engine-status';
import { askEngineStatus, onEngineStatus } from '../../core/status-channel';
import { logger } from '../../core/log';

const log = logger('popup');

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
};

const enabled = el<HTMLInputElement>('enabled');
const enabledLabel = el<HTMLSpanElement>('enabled-label');
const topics = el<HTMLTextAreaElement>('topics');
const apply = el<HTMLButtonElement>('apply');
const applied = el<HTMLSpanElement>('applied');
const strictness = el<HTMLInputElement>('strictness');
const strictnessValue = el<HTMLOutputElement>('strictness-value');
const strictnessHint = el<HTMLParagraphElement>('strictness-hint');
const showScores = el<HTMLInputElement>('show-scores');
const blurThinMedia = el<HTMLInputElement>('blur-thin-media');
const blurOtherLanguages = el<HTMLInputElement>('blur-other-languages');
const collapseBlurred = el<HTMLInputElement>('collapse-blurred');
const tuneFeedback = el<HTMLInputElement>('tune-feedback');
const clearTuning = el<HTMLButtonElement>('clear-tuning');
const tuningNote = el<HTMLSpanElement>('tuning-note');
const statUp = el<HTMLElement>('stat-up');
const statDown = el<HTMLElement>('stat-down');
const statTotal = el<HTMLElement>('stat-total');
const reset = el<HTMLButtonElement>('reset');
const statusText = el<HTMLSpanElement>('status');
const dot = el<HTMLSpanElement>('dot');
const engineText = el<HTMLSpanElement>('engine-status');
const engineDot = el<HTMLSpanElement>('engine-dot');
const engineLine = el<HTMLParagraphElement>('engine-line');
const chipText = el<HTMLSpanElement>('engine-chip-text');
const chipDot = el<HTMLSpanElement>('engine-chip-dot');

let saved: Settings = await loadSettings();

/**
 * Speaks only in what the reader sees, and admits what still gets through — a
 * hint that promised only the good half would be lying at every step. The cut
 * score belongs on the badge, not here.
 */
function describeStrictness(step: number): string {
  const shown = Math.round(feedShownAt(step) * 100);
  if (shown >= 100) return 'Blurs nothing — every post stays visible.';
  const hits = Math.round((1 - junkShownAt(step)) * 10);
  return (
    `Shows about ${shown}% of a typical feed. Even then, only about ${hits} in 10 ` +
    'of the posts you see will really match your topics. ' +
    'Blurred posts stay one click away.'
  );
}

function renderEnabled(on: boolean): void {
  enabled.checked = on;
  enabledLabel.textContent = on ? 'On' : 'Off';
}

function render(settings: Settings): void {
  renderEnabled(settings.enabled);
  topics.value = topicsToText(settings.topics);
  strictness.value = String(settings.strictness);
  strictnessValue.textContent = String(settings.strictness);
  strictnessHint.textContent = describeStrictness(settings.strictness);
  showScores.checked = settings.showScores;
  blurThinMedia.checked = settings.blurThinMedia;
  blurOtherLanguages.checked = settings.blurOtherLanguages;
  collapseBlurred.checked = settings.collapseBlurred;
  tuneFeedback.checked = settings.tuneFromFeedback;
  refreshApply();
}

/** Topics only take effect on Apply, so an unfinished edit never filters the feed. */
function refreshApply(): void {
  apply.disabled = topicsEqual(parseTopics(topics.value), saved.topics);
  if (!apply.disabled) applied.hidden = true;
}

function describeStatus(settings: Settings): void {
  if (!settings.enabled) {
    dot.dataset.state = 'idle';
    statusText.textContent = 'Off';
    return;
  }
  if (settings.topics.length === 0) {
    dot.dataset.state = 'idle';
    statusText.textContent = 'Add a topic above to start';
    return;
  }
  dot.dataset.state = 'ready';
  statusText.textContent =
    `Filtering with ${settings.topics.length} topic` +
    (settings.topics.length === 1 ? '' : 's');
}

/**
 * Twice, for two different readers. The header chip is what someone sees on
 * open, since the footer sits below Chrome's 600px popup cap. The footer line
 * carries what will not fit up there — the one-time-download reassurance, and
 * the failure reason a bug report needs — so it stands down once ready, when
 * the chip alone says everything left to say.
 */
function describeEngineStatus(status: EngineStatus | undefined): void {
  const short = summarizeEngine(status);
  chipDot.dataset.state = short.tone;
  chipText.textContent = short.text;

  const full = describeEngine(status);
  engineDot.dataset.state = full.tone;
  engineText.textContent = full.text;
  engineLine.hidden = full.tone === 'ready';
}

/** A refused write puts the controls back to what is actually stored. */
async function update(patch: Partial<Settings>): Promise<boolean> {
  try {
    saved = await saveSettings(patch);
  } catch (error) {
    log.warn('settings not saved', {
      reason: error instanceof Error ? error.message : String(error),
    });
    render(saved);
    return false;
  }
  describeStatus(saved);
  refreshApply();
  return true;
}

render(saved);
describeStatus(saved);

// Asked fresh every time the popup opens, so switching tabs cannot leave a
// stale reading on screen, and followed for one tab only.
void askEngineStatus().then(({ tabId, status }) => {
  describeEngineStatus(status);
  onEngineStatus(tabId, describeEngineStatus);
});

enabled.addEventListener('change', () => {
  renderEnabled(enabled.checked);
  void update({ enabled: enabled.checked });
});

topics.addEventListener('input', refreshApply);

apply.addEventListener('click', () => {
  void update({ topics: parseTopics(topics.value) }).then((ok) => {
    if (!ok) return;
    topics.value = topicsToText(saved.topics);
    applied.hidden = false;
    refreshApply();
  });
});

strictness.addEventListener('input', () => {
  const next = Number(strictness.value);
  strictnessValue.textContent = String(next);
  strictnessHint.textContent = describeStrictness(next);
});

strictness.addEventListener('change', () => {
  void update({ strictness: Number(strictness.value) });
});

async function renderTuning(): Promise<void> {
  const stored = await loadFeedback().catch(() => undefined);
  const { up, down, total } = counts(stored ?? { byTopic: {} });
  statUp.textContent = String(up);
  statDown.textContent = String(down);
  statTotal.textContent = String(total);
  tuningNote.textContent = total === 0 ? 'You have not rated any posts yet.' : '';
  clearTuning.disabled = total === 0;
}

void renderTuning();

tuneFeedback.addEventListener(
  'change',
  () => void update({ tuneFromFeedback: tuneFeedback.checked }),
);

clearTuning.addEventListener('click', () => {
  void clearFeedback()
    .catch(() => undefined)
    .then(renderTuning);
});

blurThinMedia.addEventListener(
  'change',
  () => void update({ blurThinMedia: blurThinMedia.checked }),
);

blurOtherLanguages.addEventListener(
  'change',
  () => void update({ blurOtherLanguages: blurOtherLanguages.checked }),
);

collapseBlurred.addEventListener(
  'change',
  () => void update({ collapseBlurred: collapseBlurred.checked }),
);

showScores.addEventListener(
  'change',
  () => void update({ showScores: showScores.checked }),
);

reset.addEventListener('click', () => {
  void Promise.all([
    update({ ...DEFAULT_SETTINGS, topics: saved.topics }),
    clearFeedback().catch(() => undefined),
  ]).then(() => {
    render(saved);
    void renderTuning();
    applied.hidden = true;
  });
});
