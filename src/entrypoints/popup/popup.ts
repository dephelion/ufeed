import { sliderFromStrictness, strictnessFromSlider } from '../../ml/scoring';
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
const statusText = el<HTMLSpanElement>('status');
const dot = el<HTMLSpanElement>('dot');

let saved: Settings = await loadSettings();

function render(settings: Settings): void {
  enabled.checked = settings.enabled;
  topics.value = topicsToText(settings.topics);
  strictness.value = String(sliderFromStrictness(settings.strictness));
  strictnessValue.textContent = settings.strictness.toFixed(2);
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
  strictnessValue.textContent = strictnessFromSlider(Number(strictness.value)).toFixed(2);
});

strictness.addEventListener('change', () => {
  void update({ strictness: strictnessFromSlider(Number(strictness.value)) });
});
