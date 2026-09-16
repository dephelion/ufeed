import { describe, expect, it } from 'vitest';
import type { Post } from '../adapters';
import { redditAdapter } from '../adapters/reddit';
import { Conversation } from './conversation';

const element = () => document.createElement('div');
const post = (container = element()): Post => ({ container, text: 'post' });

/** Lead posts come from a fixed reply → post map, standing in for a site's DOM rule. */
const setup = () => {
  const leadPosts = new Map<HTMLElement, HTMLElement>();
  const conversation = Conversation.for({
    ...redditAdapter,
    leadPost: (container) => leadPosts.get(container),
  })!;
  const lead = element();
  const reply = post();
  leadPosts.set(reply.container, lead);
  return { conversation, lead, reply };
};

describe('Conversation', () => {
  it('is not built for a site without lead posts', () => {
    expect(Conversation.for(redditAdapter)).toBeUndefined();
  });

  it('judges a post that answers nothing', () => {
    const { conversation } = setup();
    expect(conversation.route(post())).toBe('judge');
  });

  it('keeps a reply to a kept post', () => {
    const { conversation, lead, reply } = setup();
    conversation.settle(lead, true);
    expect(conversation.route(reply)).toBe('keep');
  });

  it('judges a reply to a blurred post on its own', () => {
    const { conversation, lead, reply } = setup();
    conversation.settle(lead, false);
    expect(conversation.route(reply)).toBe('judge');
  });

  it('holds a reply until its post is decided, then hands it back', () => {
    const { conversation, lead, reply } = setup();
    expect(conversation.route(reply)).toBe('wait');
    expect(conversation.settle(lead, true)).toEqual([reply]);
    expect(conversation.route(reply)).toBe('keep');
  });

  it('hands replies back when a blurred post is revealed', () => {
    const { conversation, lead, reply } = setup();
    conversation.settle(lead, false);
    conversation.route(reply);
    expect(conversation.settle(lead, true)).toEqual([reply]);
  });

  it('hands nothing back when the verdict did not change', () => {
    const { conversation, lead, reply } = setup();
    conversation.settle(lead, true);
    conversation.route(reply);
    expect(conversation.settle(lead, true)).toEqual([]);
  });

  it('forgets verdicts on reset', () => {
    const { conversation, lead, reply } = setup();
    conversation.settle(lead, true);
    conversation.reset();
    expect(conversation.route(reply)).toBe('wait');
  });
});
