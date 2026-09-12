import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../core/settings';
import { PEEK_BAND } from '../ml/scoring';
import { decide, type Judgement } from './policy';

const THR = 0.784;
const base = (over: Partial<Judgement> = {}): Judgement => ({
  settings: { ...DEFAULT_SETTINGS, topics: ['software'] },
  text: 'a post about distributed systems and how they fail',
  score: 0.9,
  threshold: THR,
  hasMedia: false,
  ...over,
});

const withSettings = (patch: Partial<Settings>, over: Partial<Judgement> = {}) =>
  base({ ...over, settings: { ...base().settings, ...patch } });

describe('decide', () => {
  it('reveals a post above the threshold', () => {
    expect(decide(base({ score: THR }))).toBe('reveal');
  });

  it('peeks inside the uncertain strip', () => {
    expect(decide(base({ score: THR - PEEK_BAND }))).toBe('peek');
  });

  it('blurs below the strip', () => {
    expect(decide(base({ score: THR - PEEK_BAND - 0.001 }))).toBe('blur');
  });
});

describe('fail-open', () => {
  it('reveals an unscored post rather than holding a blur', () => {
    expect(decide(base({ score: undefined }))).toBe('reveal');
  });

  it('reveals when the engine returned nothing for a media post too', () => {
    expect(decide(base({ score: undefined, hasMedia: true }))).toBe('reveal');
  });
});

describe('overrides win over the model', () => {
  it('keeps on alwaysKeep even when the score says blur', () => {
    expect(decide(withSettings({ alwaysKeep: ['systems'] }, { score: 0.1 }))).toBe(
      'reveal',
    );
  });

  it('blurs on alwaysBlur even when the score says show', () => {
    expect(decide(withSettings({ alwaysBlur: ['systems'] }, { score: 0.99 }))).toBe(
      'blur',
    );
  });

  it('keeps beating blur when both match, and beating the media rule', () => {
    const j = withSettings(
      { alwaysKeep: ['systems'], alwaysBlur: ['systems'], blurThinMedia: true },
      { text: 'systems', hasMedia: true },
    );
    expect(decide(j)).toBe('reveal');
  });
});

describe('the media rule', () => {
  it('blurs thin media with its own reason, not as an off-topic verdict', () => {
    const j = withSettings({ blurThinMedia: true }, { text: 'lol', hasMedia: true });
    expect(decide(j)).toBe('blur-media');
  });

  it('leaves a media post with real text to the model', () => {
    const j = withSettings({ blurThinMedia: true }, { hasMedia: true, score: 0.9 });
    expect(decide(j)).toBe('reveal');
  });

  it('does nothing while the setting is off', () => {
    const j = base({ text: 'lol', hasMedia: true, score: 0.9 });
    expect(decide(j)).toBe('reveal');
  });

  it('never touches a text post, however short', () => {
    const j = withSettings({ blurThinMedia: true }, { text: 'lol', score: 0.9 });
    expect(decide(j)).toBe('reveal');
  });

  it('claims a thin media post before the score can, even a passing one', () => {
    const j = withSettings({ blurThinMedia: true }, { text: 'lol', hasMedia: true });
    expect(decide(j)).toBe('blur-media');
  });
});
