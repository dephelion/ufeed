import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { DEFAULT_MODEL, modelFor } from './models';
import { decide, decideWithoutScore, type Judgement } from './policy';

const PEEK_BAND = modelFor(DEFAULT_MODEL).peekBand;
const THR = 0.784;
const base = (over: Partial<Judgement> = {}): Judgement => ({
  settings: { ...DEFAULT_SETTINGS, topics: ['software'] },
  text: 'a post about distributed systems and how they fail',
  score: 0.9,
  threshold: THR,
  hasMedia: false,
  language: undefined,
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

describe('blacklist', () => {
  it('blurs an on-topic post that is closer to a blacklist line', () => {
    expect(decide(base({ score: 0.9, block: 0.91 }))).toBe('blur-blacklist');
  });

  it('leaves a post closer to its topic than to the blacklist', () => {
    expect(decide(base({ score: 0.9, block: 0.89 }))).toBe('reveal');
  });

  it('overrides a liked near-identical post', () => {
    expect(decide(base({ score: 0.9, block: 0.95, rating: true }))).toBe(
      'blur-blacklist',
    );
  });

  it('fails open when the post was never scored', () => {
    expect(decide(base({ score: undefined, block: 0.95 }))).toBe('reveal');
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

describe('a near-identical rating', () => {
  it('shows a post like one the reader liked, whatever the score', () => {
    expect(decide(base({ score: 0.1, rating: true }))).toBe('reveal');
  });

  it('blurs a post like one the reader disliked, whatever the score', () => {
    expect(decide(base({ score: 0.99, rating: false }))).toBe('blur');
  });

  it('leaves the score in charge when nothing rated is near', () => {
    expect(decide(base({ score: 0.99, rating: undefined }))).toBe('reveal');
  });
});

describe('the language rule', () => {
  const on = { blurOtherLanguages: true };

  it('blurs a post the model cannot read, however well it scored', () => {
    const j = withSettings(on, { language: 'other', score: 0.99 });
    expect(decide(j)).toBe('blur-language');
  });

  it('leaves a post the model can read to the score', () => {
    expect(decide(withSettings(on, { language: 'match' }))).toBe('reveal');
  });

  it('does nothing while the setting is off', () => {
    const off = withSettings({ blurOtherLanguages: false }, { language: 'other' });
    expect(decide(off)).toBe('reveal');
  });

  it('is on by default', () => {
    expect(decide(base({ language: 'other' }))).toBe('blur-language');
  });

  it('never blurs on an undetected post — nothing ran, nothing is known', () => {
    expect(decide(withSettings(on, { language: undefined, score: 0.99 }))).toBe('reveal');
  });

  it('blurs an unreadable post the engine never scored', () => {
    const j = withSettings(on, { language: 'other', score: undefined });
    expect(decide(j)).toBe('blur-language');
  });
});

describe('an unplaceable post counts as too little text', () => {
  it('blurs as media, not as another language', () => {
    const j = withSettings(
      { blurThinMedia: true, blurOtherLanguages: true },
      {
        text: '🔥🔥🔥 @someone @someone',
        hasMedia: true,
        language: 'unclear',
        score: 0.9,
      },
    );
    expect(decide(j)).toBe('blur-media');
  });

  it('leaves it alone without media, whatever its length', () => {
    const j = withSettings(
      { blurThinMedia: true, blurOtherLanguages: true },
      { language: 'unclear', score: 0.9 },
    );
    expect(decide(j)).toBe('reveal');
  });
});

describe('decideWithoutScore', () => {
  it('returns nothing when only the engine can settle it', () => {
    expect(decideWithoutScore(base())).toBeUndefined();
  });

  it('claims a post it can settle, so it never reaches the engine', () => {
    const j = withSettings({ blurOtherLanguages: true }, { language: 'other' });
    expect(decideWithoutScore(j)).toBe('blur-language');
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
