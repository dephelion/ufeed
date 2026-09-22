import { describe, expect, it } from 'vitest';
import { blursAsBlacklisted, keywordsToText, parseKeywords } from './blacklist';
import { DEFAULT_SETTINGS } from './settings';

const blocks = (blacklist: string[], text: string) =>
  blursAsBlacklisted({ ...DEFAULT_SETTINGS, blacklist }, text);

describe('blursAsBlacklisted', () => {
  it('matches nothing with an empty blacklist', () => {
    expect(blocks([], 'Introducing our new agent')).toBe(false);
  });

  it('ignores case and accents', () => {
    expect(blocks(['introducing'], 'INTRODUCING: Jev, our new agent')).toBe(true);
    expect(blocks(['cafe'], 'Best café in town')).toBe(true);
    for (const text of ['Meet Jev', 'meet jev', 'MEET jeV'])
      expect(blocks(['JeV'], text)).toBe(true);
  });

  it('matches whole words only', () => {
    expect(blocks(['ai'], 'she said it was fine')).toBe(false);
    expect(blocks(['introducing'], 'reintroducing the old API')).toBe(false);
  });

  it('matches a singular and its plural', () => {
    expect(blocks(['giveaway'], 'three giveaways this week')).toBe(true);
    expect(blocks(['company'], 'companies are hiring')).toBe(true);
    expect(blocks(['box'], 'a pile of boxes')).toBe(true);
  });

  it('matches a phrase across any whitespace', () => {
    expect(blocks(['product launch'], 'our product\n launch is today')).toBe(true);
    expect(blocks(['product launch'], 'our product is ready to launch')).toBe(false);
  });

  it('treats keyword punctuation literally', () => {
    expect(blocks(['c++'], 'why c++ still wins')).toBe(true);
    expect(blocks(['c++'], 'why c still wins')).toBe(false);
  });

  it('matches anywhere in scripts written without spaces', () => {
    expect(blocks(['暗号資産'], '今日の暗号資産ニュース')).toBe(true);
  });
});

describe('parseKeywords', () => {
  it('splits on the comma of every language, and on line breaks', () => {
    expect(parseKeywords('crypto, giveaway ,,  nft')).toEqual([
      'crypto',
      'giveaway',
      'nft',
    ]);
    expect(parseKeywords('抽奖，广告、广告\nintroducing,')).toEqual([
      '抽奖',
      '广告',
      'introducing',
    ]);
  });

  it('lowercases, so one word in any capitalisation is one keyword', () => {
    expect(parseKeywords('Jev, jev, jeV')).toEqual(['jev']);
  });

  it('keeps a phrase whole and reads back what it wrote', () => {
    const keywords = parseKeywords('product   launch, crypto');
    expect(keywords).toEqual(['product launch', 'crypto']);
    expect(parseKeywords(keywordsToText(keywords))).toEqual(keywords);
  });
});
