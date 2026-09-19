import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './settings';
import { MIN_BACKING_CHARS, blursAsThinMedia } from './media';

const on = { ...DEFAULT_SETTINGS, blurThinMedia: true };
const LONG = 'x'.repeat(MIN_BACKING_CHARS);

describe('blursAsThinMedia', () => {
  it('blurs a media post with no caption', () => {
    expect(blursAsThinMedia(on, '', true)).toBe(true);
  });

  it('blurs a media post captioned with a couple of words', () => {
    expect(blursAsThinMedia(on, 'esto es increíble', true)).toBe(true);
  });

  it('leaves a media post with real text to the model', () => {
    expect(blursAsThinMedia(on, LONG, true)).toBe(false);
  });

  it('never touches a text post, however short', () => {
    expect(blursAsThinMedia(on, 'lol', false)).toBe(false);
  });

  it('does nothing while the setting is off, which is the default', () => {
    expect(blursAsThinMedia(DEFAULT_SETTINGS, '', true)).toBe(false);
  });

  it('treats whitespace as no caption at all', () => {
    expect(blursAsThinMedia(on, '   \n  ', true)).toBe(true);
  });

  it('counts a caption no detector could place as no caption, however long', () => {
    expect(blursAsThinMedia(on, LONG, true, 'unclear')).toBe(true);
  });

  it('leaves a placeable caption to the model', () => {
    expect(blursAsThinMedia(on, LONG, true, 'other')).toBe(false);
  });
});
