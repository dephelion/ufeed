import { describe, expect, it } from 'vitest';
import type { Post } from '../adapters';
import { Conversations } from './conversation';

const element = () => document.createElement('div');
const reply = (anchor: HTMLElement): Post => ({
  container: element(),
  text: 'reply',
  anchor,
});

describe('Conversations', () => {
  it('judges a post that answers nothing', () => {
    const conversations = new Conversations(() => false);
    expect(conversations.route({ container: element(), text: 'post' })).toBe('judge');
  });

  it('keeps a reply to a kept post', () => {
    const conversations = new Conversations(() => false);
    const anchor = element();
    conversations.settle(anchor, true);
    const post = reply(anchor);
    expect(conversations.route(post)).toBe('keep');
    expect(conversations.followsKept(post.container)).toBe(true);
  });

  it('judges a reply to a blurred post on its own', () => {
    const conversations = new Conversations(() => false);
    const anchor = element();
    conversations.settle(anchor, false);
    expect(conversations.route(reply(anchor))).toBe('judge');
  });

  it('holds a reply until its post is decided, then hands it back', () => {
    const conversations = new Conversations(() => false);
    const anchor = element();
    const post = reply(anchor);
    expect(conversations.route(post)).toBe('wait');
    expect(conversations.settle(anchor, true)).toEqual([post]);
    expect(conversations.route(post)).toBe('keep');
  });

  it('counts a post the reader revealed as kept', () => {
    const anchor = element();
    const conversations = new Conversations((el) => el === anchor);
    conversations.settle(anchor, false);
    expect(conversations.route(reply(anchor))).toBe('keep');
  });

  it('stops keeping replies when a later verdict blurs the post', () => {
    const conversations = new Conversations(() => false);
    const anchor = element();
    const post = reply(anchor);
    conversations.settle(anchor, true);
    conversations.route(post);
    conversations.settle(anchor, false);
    expect(conversations.followsKept(post.container)).toBe(false);
  });

  it('forgets verdicts on reset', () => {
    const conversations = new Conversations(() => false);
    const anchor = element();
    conversations.settle(anchor, true);
    conversations.reset();
    expect(conversations.route(reply(anchor))).toBe('wait');
  });
});
