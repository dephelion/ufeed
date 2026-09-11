import { estimateFeedShown, strictnessFromPosition } from '../../ml/scoring';
import {
  DEFAULT_SETTINGS, parseTopics, topicsEqual, topicsToText, usableBand, type Settings,
} from '../../core/settings';
import { loadSettings, saveSettings } from '../../core/settings-storage';

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
};

const enabled = el<HTMLInputElement>('enabled');
const topics = el<HTMLTextAreaElement>('topics');
const apply = el<HTMLButtonElement>('apply');
const applied = el<HTMLSpanElement>('applied');
const strictness = el<HTMLInputElement>('strictness');
const strictnessValue = el<HTMLOutputElement>('strictness-value');
const strictnessHint = el<HTMLParagraphElement>('strictness-hint');
const bandMin = el<HTMLInputElement>('band-min');
const bandMax = el<HTMLInputElement>('band-max');
const reset = el<HTMLButtonElement>('reset');
const statusText = el<HTMLSpanElement>('status');
const dot = el<HTMLSpanElement>('dot');

let saved: Settings = await loadSettings();

/** Speaks in what the user sees, not in cosine values. */
function describeStrictness(position: number, settings: Settings): string {
  const band = usableBand(settings);
  const threshold = strictnessFromPosition(position, band);
  const shown = Math.round(estimateFeedShown(threshold) * 100);
  return `Shows roughly ${shown}% of a feed (score ${threshold.toFixed(3)} and up). `
    + 'Blurred posts stay one click away.';
}

function render(settings: Settings): void {
  enabled.checked = settings.enabled;
  topics.value = topicsToText(settings.topics);
  strictness.value = String(settings.strictness);
  strictnessValue.textContent = `${Math.round(settings.strictness * 100)}%`;
  strictnessHint.textContent = describeStrictness(settings.strictness, settings);
  bandMin.value = settings.bandMin.toFixed(3);
  bandMax.value = settings.bandMax.toFixed(3);
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
    statusText.textContent = 'Add a topic to start filtering';
    return;
  }
  dot.dataset.state = 'ready';
  statusText.textContent = `Active on supported feeds · ${settings.topics.length} topic`
    + (settings.topics.length === 1 ? '' : 's');
}

async function update(patch: Partial<Settings>): Promise<void> {
  saved = await saveSettings(patch);
  describeStatus(saved);
  refreshApply();
}

render(saved);
describeStatus(saved);

enabled.addEventListener('change', () => void update({ enabled: enabled.checked }));

topics.addEventListener('input', refreshApply);

apply.addEventListener('click', () => {
  void update({ topics: parseTopics(topics.value) }).then(() => {
    topics.value = topicsToText(saved.topics);
    applied.hidden = false;
    refreshApply();
  });
});

strictness.addEventListener('input', () => {
  const next = Number(strictness.value);
  strictnessValue.textContent = `${Math.round(next * 100)}%`;
  strictnessHint.textContent = describeStrictness(next, saved);
});

strictness.addEventListener('change', () => {
  void update({ strictness: Number(strictness.value) });
});

const commitBand = (): void => {
  void update({ bandMin: Number(bandMin.value), bandMax: Number(bandMax.value) })
    .then(() => render(saved));
};

bandMin.addEventListener('change', commitBand);
bandMax.addEventListener('change', commitBand);

reset.addEventListener('click', () => {
  void update({ ...DEFAULT_SETTINGS, topics: saved.topics }).then(() => {
    render(saved);
    applied.hidden = true;
  });
});
