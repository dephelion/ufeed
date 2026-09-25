import { describe, expect, it } from 'vitest';
import english from '../../public/_locales/en/messages.json';
import { createTranslator, type MessageKey } from './messages';

const t = createTranslator(english);

describe('createTranslator', () => {
  it('returns a message that has no placeholders as it is written', () => {
    expect(t('badgeOpen')).toBe('Open uFeed');
  });

  it('fills a placeholder from its substitution', () => {
    expect(t('badgeCount', '12')).toBe('Posts hidden: 12');
  });

  it('takes each placeholder from the position it points at', () => {
    expect(t('importDone', '3', '12')).toBe('✓ Topics: 3 · Ratings: 12');
  });

  it('reads a value as text, whatever characters it holds', () => {
    expect(t('engineFailedWhy', 'out $& of memory')).toBe(
      'The engine stopped working — out $& of memory. Use the refresh button to restart uFeed, then reload this tab.',
    );
  });

  it('leaves a placeholder empty when no substitution was given', () => {
    expect(t('badgeCount')).toBe('Posts hidden: ');
  });

  it('answers an unknown key with an empty string, as a browser does', () => {
    expect(t('nope' as MessageKey)).toBe('');
  });
});
