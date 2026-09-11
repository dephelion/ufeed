import {
  SHORT_PENALTY_MAX, sliderFromStrictness, strictnessFromSlider, thresholdFor,
} from '../../ml/scoring';
import { parseTopics, topicsToText, topicsEqual, type Settings } from '../../core/settings';
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
const shortPenalty = el<HTMLInputElement>('short-penalty');
const shortPenaltyValue = el<HTMLOutputElement>('short-penalty-value');
const shortPenaltyHint = el<HTMLParagraphElement>('short-penalty-hint');
const statusText = el<HTMLSpanElement>('status');
const dot = el<HTMLSpanElement>('dot');

let saved: Settings = await loadSettings();

function render(settings: Settings): void {
  enabled.checked = settings.enabled;
  topics.value = topicsToText(settings.topics);
  strictness.value = String(sliderFromStrictness(settings.strictness));
  strictnessValue.textContent = settings.strictness.toFixed(2);
  shortPenalty.value = String(settings.shortPenalty);
  describeShortPenalty(settings.strictness, settings.shortPenalty);
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

/** Says what the setting does in posts, not in multipliers. */
function describeShortPenalty(strictnessValueNow: number, penalty: number): void {
  shortPenaltyValue.textContent = penalty === 0 ? 'off' : `${penalty.toFixed(2)}x`;
  if (penalty === 0) {
    shortPenaltyHint.textContent = 'Short posts judged the same as long ones.';
    return;
  }
  const needed = thresholdFor(strictnessValueNow, 30, penalty);
  shortPenaltyHint.textContent =
    `A very short post must score ${needed.toFixed(2)} to stay, against `
    + `${strictnessValueNow.toFixed(2)} for a full one. Short posts score low whatever `
    + 'the subject, so a higher bar hides most of them.';
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
  const next = strictnessFromSlider(Number(strictness.value));
  strictnessValue.textContent = next.toFixed(2);
  describeShortPenalty(next, Number(shortPenalty.value));
});

strictness.addEventListener('change', () => {
  void update({ strictness: strictnessFromSlider(Number(strictness.value)) });
});

shortPenalty.addEventListener('input', () => {
  describeShortPenalty(saved.strictness, Number(shortPenalty.value));
});

shortPenalty.addEventListener('change', () => {
  void update({ shortPenalty: Math.min(SHORT_PENALTY_MAX, Number(shortPenalty.value)) });
});
