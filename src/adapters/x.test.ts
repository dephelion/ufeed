import { beforeEach, describe, expect, it } from 'vitest';
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
  beforeEach(() => history.replaceState(null, '', '/home'));

  it.each(['/notifications', '/notifications/mentions'])(
    'leaves notification cells alone on %s',
    (path) => {
      history.replaceState(null, '', path);
      const html = `<div data-testid="cellInnerDiv"><article data-testid="notification">
        <article data-testid="tweet"><div data-testid="tweetText">${LONG}</div></article>
      </article></div>`;
      expect(xAdapter.findPosts(mount(html))).toHaveLength(0);
    },
  );

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

  it('skips cells with no article, such as trend and follow modules', () => {
    expect(
      xAdapter.findPosts(
        mount('<div data-testid="cellInnerDiv"><span>Promoted</span></div>'),
      ),
    ).toHaveLength(0);
  });

  it('keeps a post too short to score, so the media rule can still see it', () => {
    expect(xAdapter.findPosts(mount(cell('lol')))).toHaveLength(1);
  });

  it('keeps a caption-less media post, which has no tweetText node at all', () => {
    const html = `<div data-testid="cellInnerDiv"><article>
      <div data-testid="tweetPhoto"><img src="x.jpg" /></div>
    </article></div>`;
    const posts = xAdapter.findPosts(mount(html));
    expect(posts).toHaveLength(1);
    expect(posts[0]!.text).toBe('');
  });

  it('skips feed chrome, which carries no article', () => {
    const html = `<div data-testid="cellInnerDiv">
      <span>Who to follow</span><button>Follow</button>
    </div>`;
    expect(xAdapter.findPosts(mount(html))).toHaveLength(0);
  });

  it('folds a quoted tweet into the text, since the two read as one post', () => {
    const html = `<div data-testid="cellInnerDiv"><article>
      <div data-testid="tweetText"><span>Worth reading this</span></div>
      <div role="link">
        <div data-testid="tweetText"><span>Our new inference pipeline ships today</span></div>
      </div>
    </article></div>`;
    expect(xAdapter.findPosts(mount(html))[0]!.text).toBe(
      'Worth reading this Our new inference pipeline ships today',
    );
  });

  it('still catches the topic when the comment on top of the quote carries none of it', () => {
    const html = `<div data-testid="cellInnerDiv"><article>
      <div data-testid="tweetText"><span>12 years ago</span></div>
      <div role="link">
        <div data-testid="tweetText"><span>${LONG}</span></div>
      </div>
    </article></div>`;
    expect(xAdapter.findPosts(mount(html))[0]!.text).toBe(`12 years ago ${LONG}`);
  });

  it('ignores surrounding chrome: handle, timestamp and engagement counts', () => {
    const html = `<div data-testid="cellInnerDiv"><article>
      <span>Some Account</span><span>@someaccount</span><time>Sep 10</time>
      <div data-testid="tweetText"><span>${LONG}</span></div>
      <div><span>312</span><span>378</span><span>66K</span></div>
    </article></div>`;
    expect(xAdapter.findPosts(mount(html))[0]!.text).toBe(LONG);
  });

  it('collapses whitespace so a re-render hashes the same', () => {
    const html = cell('Distributed   systems\n\n  fail in  practice always');
    expect(xAdapter.findPosts(mount(html))[0]!.text).toBe(
      'Distributed systems fail in practice always',
    );
  });
});

/** Mirrors captured X markup: the thread connector is an extra empty child. */
const threaded = (
  text: string,
  { up = false, down = false, focal = false } = {},
) => `<div data-testid="cellInnerDiv"><article tabindex="${focal ? -1 : 0}">
     <div><div>${up ? '<div><div></div></div>' : ''}<div></div></div></div>
     <div><div><div data-testid="Tweet-User-Avatar"></div>${down ? '<div></div>' : ''}</div></div>
     <div data-testid="tweetText"><span>${text}</span></div>
   </article></div>`;

const heading = `<div data-testid="cellInnerDiv"><h2 role="heading">Discover more</h2></div>`;

const leadPostText = (text: string) => {
  const post = xAdapter.findPosts(document).find((p) => p.text === text)!;
  const lead = xAdapter.leadPost!(post.container);
  return lead && xAdapter.findPosts(lead)[0]!.text;
};

describe('xAdapter lead post on the home feed', () => {
  beforeEach(() => history.replaceState(null, '', '/home'));

  it('gives every reply in a drawn thread its first post', () => {
    mount(
      threaded('root', { down: true }) +
        threaded('middle', { up: true, down: true }) +
        threaded('last', { up: true }),
    );
    expect(leadPostText('root')).toBeUndefined();
    expect(leadPostText('middle')).toBe('root');
    expect(leadPostText('last')).toBe('root');
  });

  it('leaves unconnected neighbours to be judged alone', () => {
    mount(threaded('one') + threaded('two'));
    expect(leadPostText('two')).toBeUndefined();
  });

  it('ignores a focused article off a status page', () => {
    mount(threaded('first', { focal: true }) + threaded('second'));
    expect(leadPostText('second')).toBeUndefined();
  });
});

describe('xAdapter lead post on an opened post', () => {
  beforeEach(() => history.replaceState(null, '', '/someone/status/123'));

  it('gives the posts above and the replies below the opened post', () => {
    mount(
      threaded('parent') +
        threaded('opened', { focal: true }) +
        threaded('reply') +
        threaded('nested', { up: true }),
    );
    expect(leadPostText('opened')).toBe('opened');
    expect(leadPostText('parent')).toBe('opened');
    expect(leadPostText('reply')).toBe('opened');
    expect(leadPostText('nested')).toBe('opened');
  });

  it('judges recommendations under a heading on their own', () => {
    mount(
      threaded('opened', { focal: true }) +
        threaded('reply') +
        heading +
        threaded('suggested'),
    );
    expect(leadPostText('reply')).toBe('opened');
    expect(leadPostText('suggested')).toBeUndefined();
  });
});
