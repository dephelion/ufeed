import { describe, expect, it } from 'vitest';
import { xAdapter } from './x';

const cell = (text: string, testid = 'cellInnerDiv') =>
  `<div data-testid="${testid}"><article>
     <div data-testid="tweetText"><span>${text}</span></div>
   </article></div>`;

const mount = (html: string) => {
  document.body.innerHTML = html;
  return document.body;
};

const LONG = 'A post about distributed systems and how they fail in practice.';

describe('xAdapter.matches', () => {
  it.each(['x.com', 'twitter.com'])('matches %s', (host) => {
    expect(xAdapter.matches(host)).toBe(true);
  });

  it('does not match an unrelated host', () => {
    expect(xAdapter.matches('reddit.com')).toBe(false);
  });

  it('does not match a lookalike domain', () => {
    expect(xAdapter.matches('notx.com')).toBe(false);
  });
});

describe('xAdapter.findPosts', () => {
  it('finds a post and extracts its text', () => {
    const posts = xAdapter.findPosts(mount(cell(LONG)));
    expect(posts).toHaveLength(1);
    expect(posts[0]!.text).toBe(LONG);
  });

  it('targets the cell, not the article', () => {
    const posts = xAdapter.findPosts(mount(cell(LONG)));
    expect(posts[0]!.container.dataset.testid).toBe('cellInnerDiv');
  });

  it('finds a node that is itself a post, not only its descendants', () => {
    mount(cell(LONG));
    const root = document.querySelector('[data-testid="cellInnerDiv"]')!;
    expect(xAdapter.findPosts(root)).toHaveLength(1);
  });

  it('does not double-count a post reachable both ways', () => {
    mount(cell(LONG));
    const root = document.querySelector('[data-testid="cellInnerDiv"]')!;
    expect(xAdapter.findPosts(root)).toHaveLength(1);
  });

  it('skips cells with no tweet text, such as ads and follow prompts', () => {
    expect(xAdapter.findPosts(mount('<div data-testid="cellInnerDiv"><span>Promoted</span></div>')))
      .toHaveLength(0);
  });

  it('skips posts too short to classify', () => {
    expect(xAdapter.findPosts(mount(cell('lol')))).toHaveLength(0);
  });

  it('joins a multi-part tweet body into one string', () => {
    const html = `<div data-testid="cellInnerDiv">
      <div data-testid="tweetText"><span>Shipping the new</span></div>
      <div data-testid="tweetText"><span>inference pipeline today for real</span></div>
    </div>`;
    expect(xAdapter.findPosts(mount(html))[0]!.text)
      .toBe('Shipping the new inference pipeline today for real');
  });

  it('collapses whitespace so a re-render hashes the same', () => {
    const html = cell('Distributed   systems\n\n  fail in  practice always');
    expect(xAdapter.findPosts(mount(html))[0]!.text)
      .toBe('Distributed systems fail in practice always');
  });
});
