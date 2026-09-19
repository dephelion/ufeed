import browser from 'webextension-polyfill';
import { modelFor, type ModelKey } from '../../core/models';
import { feedShownAt } from '../../core/scoring';
import {
  DEFAULT_SETTINGS,
  parseTopics,
  topicsEqual,
  topicsToText,
  type Settings,
} from '../../core/settings';
import { EMPTY_FEEDBACK, counts } from '../../core/feedback';
import { exportConfig, importConfig } from '../../core/config-transfer';
import {
  describeEngine,
  summarizeEngine,
  type EngineStatus,
} from '../../core/engine-status';
import { logger } from '../../core/log';
import { askEngineStatus, onEngineStatus } from '../../platform/status-channel';
import {
  clearFeedback,
  loadFeedback,
  loadSettings,
  saveFeedback,
  saveSettings,
} from '../../platform/storage';

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
const model = el<HTMLSelectElement>('model');
const modelHint = el<HTMLParagraphElement>('model-hint');
const blurThinMedia = el<HTMLInputElement>('blur-thin-media');
const blurOtherLanguages = el<HTMLInputElement>('blur-other-languages');
const languageHint = el<HTMLParagraphElement>('language-hint');
const collapseBlurred = el<HTMLInputElement>('collapse-blurred');
const tuneFeedback = el<HTMLInputElement>('tune-feedback');
const clearTuning = el<HTMLButtonElement>('clear-tuning');
const tuningNote = el<HTMLSpanElement>('tuning-note');
const statUp = el<HTMLElement>('stat-up');
const statDown = el<HTMLElement>('stat-down');
const statTotal = el<HTMLElement>('stat-total');
const exportButton = el<HTMLButtonElement>('export');
const importButton = el<HTMLButtonElement>('import');
const importFile = el<HTMLInputElement>('import-file');
const transfer = el<HTMLParagraphElement>('transfer');
const transferName = el<HTMLSpanElement>('transfer-name');
const transferTail = el<HTMLSpanElement>('transfer-tail');
const reset = el<HTMLButtonElement>('reset');
const statusText = el<HTMLSpanElement>('status');
const dot = el<HTMLSpanElement>('dot');
const engineText = el<HTMLSpanElement>('engine-status');
const engineDot = el<HTMLSpanElement>('engine-dot');
const engineLine = el<HTMLParagraphElement>('engine-line');
const chipText = el<HTMLSpanElement>('engine-chip-text');
const chipDot = el<HTMLSpanElement>('engine-chip-dot');

let saved: Settings = await loadSettings();

/** States the trade-off, never a measured share: one feed's numbers are not the reader's. */
function describeStrictness(step: number, key: ModelKey): string {
  if (feedShownAt(step, modelFor(key)) >= 1)
    return 'Blurs nothing — every post stays visible.';
  return "Stricter hides more, including some posts you'd want. Blurred posts stay one click away.";
}

/**
 * The language checkbox belongs to a model that reads one language. With a
 * multilingual model there is nothing to gate, so it is disabled and says why
 * rather than sitting there looking like it still does something.
 */
function renderModel(key: ModelKey): void {
  const spec = modelFor(key);
  model.value = key;
  const monolingual = spec.language !== undefined;
  modelHint.textContent = monolingual
    ? 'Reads English only. Small and fast.'
    : 'Reads every language. Downloads once, then it is cached.';
  blurOtherLanguages.disabled = !monolingual;
  languageHint.hidden = !monolingual;
  const note = el<HTMLElement>('language-off');
  note.hidden = monolingual;
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
  strictnessHint.textContent = describeStrictness(settings.strictness, settings.model);
  renderModel(settings.model);
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
  strictnessHint.textContent = describeStrictness(next, saved.model);
});

model.addEventListener('change', () => {
  const next = model.value as ModelKey;
  renderModel(next);
  void update({ model: next }).then((ok) => {
    if (ok) void renderTuning();
    else renderModel(saved.model);
  });
});

strictness.addEventListener('change', () => {
  void update({ strictness: Number(strictness.value) });
});

async function renderTuning(): Promise<void> {
  const stored = await loadFeedback(modelFor(saved.model)).catch(() => undefined);
  const { up, down, total } = counts(stored ?? EMPTY_FEEDBACK);
  statUp.textContent = String(up);
  statDown.textContent = String(down);
  statTotal.textContent = String(total);
  tuningNote.textContent = total === 0 ? 'You have not rated any posts yet.' : '';
  clearTuning.disabled = total === 0;
  exportButton.disabled = total === 0 && saved.topics.length === 0;
}

void renderTuning();

tuneFeedback.addEventListener(
  'change',
  () => void update({ tuneFromFeedback: tuneFeedback.checked }),
);

clearTuning.addEventListener('click', () => {
  void clearFeedback(modelFor(saved.model))
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

function say(name: string, tail: string, state: 'ok' | 'bad'): void {
  transferName.textContent = name;
  transferTail.textContent = tail;
  transfer.dataset.state = state;
  transfer.hidden = false;
}

/**
 * A popup is destroyed when it loses focus, and a download can take it. The URL
 * outlives the click either way; the browser has the blob by then. Nothing
 * reports back: an anchor cannot tell a saved file from a cancelled dialog.
 */
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

exportButton.addEventListener('click', () => {
  void (async () => {
    try {
      const feedback = await loadFeedback(modelFor(saved.model)).catch(
        () => EMPTY_FEEDBACK,
      );
      const day = new Date().toISOString().slice(0, 10);
      const name = `feedlens-backup-${day}.json`;
      download(
        name,
        exportConfig(saved, feedback, browser.runtime.getManifest().version),
      );
      // The browser's own download UI is the outcome. Saying "saved" here lied
      // whenever the save dialog was cancelled.
      transfer.hidden = true;
    } catch (error) {
      log.warn('export failed', {
        reason: error instanceof Error ? error.message : String(error),
      });
      say('Export failed', 'nothing was written', 'bad');
    }
  })();
});

// Firefox closes a popup when the file picker opens; import from a tab instead (see ui.md §Popup).
const IN_TAB = new URLSearchParams(location.search).has('tab');
if (IN_TAB) {
  document.documentElement.dataset['tab'] = '';
  say('Import', '— choose your backup file', 'ok');
  importButton.focus();
}

importButton.addEventListener('click', () => {
  if (import.meta.env.FIREFOX && !IN_TAB) {
    void browser.tabs
      .create({ url: browser.runtime.getURL('/popup.html?tab') })
      .then(() => window.close());
    return;
  }
  importFile.value = '';
  importFile.click();
});

importFile.addEventListener('change', () => {
  const file = importFile.files?.[0];
  if (!file) return;
  void (async () => {
    const result = importConfig(await file.text().catch(() => ''));
    if (!result.ok) {
      say(file.name, `— ${result.reason}`, 'bad');
      return;
    }
    // Corrections first: the settings write is what makes a feed tab requery,
    // and it must not find the old vectors still in place.
    await saveFeedback(modelFor(result.settings.model), result.feedback);
    if (!(await update(result.settings))) {
      say(file.name, '— could not be saved', 'bad');
      return;
    }
    render(saved);
    applied.hidden = true;
    await renderTuning();
    const { total } = counts(result.feedback);
    const topics = saved.topics.length;
    say(
      file.name,
      `\u2713 ${topics} topic${topics === 1 ? '' : 's'}, ${total} rating${total === 1 ? '' : 's'}`,
      'ok',
    );
  })();
});

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
