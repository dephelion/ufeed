import { sliderFromStrictness, strictnessFromSlider } from '../../ml/scoring';
import type { Settings } from '../../core/settings';
import { loadSettings, saveSettings } from '../../core/settings-storage';

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
};

const enabled = el<HTMLInputElement>('enabled');
const topics = el<HTMLTextAreaElement>('topics');
const strictness = el<HTMLInputElement>('strictness');
const strictnessValue = el<HTMLOutputElement>('strictness-value');
const statusText = el<HTMLSpanElement>('status');
const dot = el<HTMLSpanElement>('dot');

const parseTopics = (raw: string): string[] =>
  raw.split('\n').map((line) => line.trim()).filter((line) => line !== '');

function render(settings: Settings): void {
  enabled.checked = settings.enabled;
  topics.value = settings.topics.join('\n');
  strictness.value = String(sliderFromStrictness(settings.strictness));
  strictnessValue.textContent = settings.strictness.toFixed(2);
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
  statusText.textContent = 'Active on supported feeds';
}

async function update(patch: Partial<Settings>): Promise<void> {
  describeStatus(await saveSettings(patch));
}

const settings = await loadSettings();
render(settings);
describeStatus(settings);

enabled.addEventListener('change', () => void update({ enabled: enabled.checked }));

topics.addEventListener('change', () => void update({ topics: parseTopics(topics.value) }));

strictness.addEventListener('input', () => {
  strictnessValue.textContent = strictnessFromSlider(Number(strictness.value)).toFixed(2);
});

strictness.addEventListener('change', () => {
  void update({ strictness: strictnessFromSlider(Number(strictness.value)) });
});
