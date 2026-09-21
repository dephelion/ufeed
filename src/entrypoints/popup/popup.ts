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
import {
  exportConfig,
  importConfig,
  type ImportRefusal,
} from '../../core/config-transfer';
import {
  describeEngine,
  summarizeEngine,
  type EngineStatus,
} from '../../core/engine-status';
import { logger } from '../../core/log';
import type { MessageKey } from '../../core/messages';
import { translate as t } from '../../platform/i18n';
import { askEngineStatus, onEngineStatus } from '../../platform/status-channel';
import {
  clearFeedback,
  loadFeedback,
  loadSettings,
  saveFeedback,
  saveSettings,
} from '../../platform/storage';
import { localizePage } from './localize';

const log = logger('popup');

const REFUSALS: Record<ImportRefusal, MessageKey> = {
  'not-a-backup': 'importNotBackup',
  newer: 'importNewer',
  'other-model': 'importOtherModel',
};

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

// Before the settings load, so the popup never opens empty.
document.documentElement.lang = browser.i18n.getUILanguage();
localizePage(document, t);

let saved: Settings = await loadSettings();

/** States the trade-off, never a measured share: one feed's numbers are not the reader's. */
function describeStrictness(step: number, key: ModelKey): string {
  if (feedShownAt(step, modelFor(key)) >= 1) return t('strictnessOff');
  return t('strictnessTradeoff');
}

/**
 * The language checkbox belongs to a model that reads one language. With a
 * multilingual model there is nothing to gate, so it is shown off and disabled and
 * says why. Only what is shown changes: the stored choice returns on a switch back.
 */
function renderModel(key: ModelKey, blurOther: boolean): void {
  const spec = modelFor(key);
  model.value = key;
  const monolingual = spec.language !== undefined;
  modelHint.textContent = t(monolingual ? 'modelHintEnglish' : 'modelHintMultilingual');
  blurOtherLanguages.checked = monolingual && blurOther;
  blurOtherLanguages.disabled = !monolingual;
  blurOtherLanguages.parentElement?.classList.toggle('disabled', !monolingual);
  languageHint.hidden = !monolingual;
  const note = el<HTMLElement>('language-off');
  note.hidden = monolingual;
}

function renderEnabled(on: boolean): void {
  enabled.checked = on;
  enabledLabel.textContent = t(on ? 'switchOn' : 'switchOff');
}

function render(settings: Settings): void {
  renderEnabled(settings.enabled);
  topics.value = topicsToText(settings.topics);
  strictness.value = String(settings.strictness);
  strictnessValue.textContent = String(settings.strictness);
  strictnessHint.textContent = describeStrictness(settings.strictness, settings.model);
  renderModel(settings.model, settings.blurOtherLanguages);
  showScores.checked = settings.showScores;
  blurThinMedia.checked = settings.blurThinMedia;
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
    statusText.textContent = t('switchOff');
    return;
  }
  if (settings.topics.length === 0) {
    dot.dataset.state = 'idle';
    statusText.textContent = t('statusNoTopics');
    return;
  }
  dot.dataset.state = 'ready';
  const count = settings.topics.length;
  statusText.textContent =
    count === 1 ? t('statusTopicsOne') : t('statusTopicsMany', String(count));
}

/**
 * Twice, for two different readers. The header chip is what someone sees on
 * open, since the footer sits below Chrome's 600px popup cap. The footer line
 * carries what will not fit up there — the one-time-download reassurance, and
 * the failure reason a bug report needs — so it stands down once ready, when
 * the chip alone says everything left to say.
 */
function describeEngineStatus(status: EngineStatus | undefined): void {
  const short = summarizeEngine(status, t);
  chipDot.dataset.state = short.tone;
  chipText.textContent = short.text;

  const full = describeEngine(status, t);
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
  renderModel(next, saved.blurOtherLanguages);
  void update({ model: next }).then((ok) => {
    if (ok) void renderTuning();
    else renderModel(saved.model, saved.blurOtherLanguages);
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
  tuningNote.textContent = total === 0 ? t('tuningNone') : '';
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
      say(t('exportFailed'), t('exportFailedTail'), 'bad');
    }
  })();
});

// Firefox closes a popup when the file picker opens; import from a tab instead (see ui.md §Popup).
const IN_TAB = new URLSearchParams(location.search).has('tab');
if (IN_TAB) {
  document.documentElement.dataset['tab'] = '';
  say(t('importPrompt'), t('importPromptTail'), 'ok');
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
      say(file.name, t(REFUSALS[result.reason]), 'bad');
      return;
    }
    // Corrections first: the settings write is what makes a feed tab requery,
    // and it must not find the old vectors still in place.
    await saveFeedback(modelFor(result.settings.model), result.feedback);
    if (!(await update(result.settings))) {
      say(file.name, t('importSaveFailed'), 'bad');
      return;
    }
    render(saved);
    applied.hidden = true;
    await renderTuning();
    const { total } = counts(result.feedback);
    say(file.name, t('importDone', String(saved.topics.length), String(total)), 'ok');
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
