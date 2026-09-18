import { describe, expect, it } from 'vitest';
import { ScoreCache, hashText } from './cache';

const m = (score: number) => ({ score, topic: 0, rating: undefined });

describe('hashText', () => {
  it('ignores whitespace and case, so a re-rendered post is the same post', () => {
    expect(hashText('Hello   World')).toBe(hashText('hello world'));
  });

  it('separates different text', () => {
    expect(hashText('a post')).not.toBe(hashText('another post'));
  });
});

describe('ScoreCache', () => {
  it('returns what was stored', () => {
    const c = new ScoreCache();
    c.set('some post text', m(0.42));
    expect(c.get('some post text')?.score).toBeCloseTo(0.42);
  });

  it('misses on unseen text', () => {
    expect(new ScoreCache().get('never seen')).toBeUndefined();
  });

  it('hits across a re-render with different whitespace', () => {
    const c = new ScoreCache();
    c.set('Breaking:  the news', m(0.9));
    expect(c.get('breaking: the news')?.score).toBeCloseTo(0.9);
  });

  it('evicts the least recently used entry past the limit', () => {
    const c = new ScoreCache(2);
    c.set('one', m(1));
    c.set('two', m(2));
    c.get('one');
    c.set('three', m(3));
    expect(c.get('two')).toBeUndefined();
    expect(c.get('one')?.score).toBe(1);
    expect(c.size).toBe(2);
  });
});

describe('ScoreCache.clear', () => {
  it('drops every entry, because new topics invalidate old scores', () => {
    const c = new ScoreCache();
    c.set('a post about rust', m(0.8));
    c.set('another post entirely', m(0.2));
    c.clear();
    expect(c.get('a post about rust')).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it('still works after clearing', () => {
    const c = new ScoreCache();
    c.set('a post', m(0.5));
    c.clear();
    c.set('a post', m(0.9));
    expect(c.get('a post')?.score).toBeCloseTo(0.9);
  });
});
