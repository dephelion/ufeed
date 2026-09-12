import { describe, expect, it } from 'vitest';
import { isFeedPath, redditAdapter } from './reddit';

const TITLE = 'Rust 1.90 ships a faster borrow checker';
const BODY = 'The new solver lands behind a flag and cuts check time on large crates.';

/** Mirrors the captured shape: article[data-post-id] wrapping a shreddit-post. */
const card = (attrs = `post-title="${TITLE}"`, inner = '') =>
  `<article class="w-full m-0" data-post-id="t3_abc123">
     <shreddit-post ${attrs} subreddit-name="rust" post-type="link">
       ${inner}
     </shreddit-post>
   </article>`;

const body = (text: string) =>
  `<shreddit-post-text-body slot="text-body"><a href="#">${text}</a></shreddit-post-text-body>`;

const mount = (html: string) => {
  document.body.innerHTML = html;
  return document.body;
};

describe('redditAdapter.matches', () => {
  it.each(['reddit.com', 'www.reddit.com', 'sh.reddit.com'])('matches %s', (host) => {
    expect(redditAdapter.matches(host)).toBe(true);
  });

  it('does not match old.reddit.com, which is a different DOM entirely', () => {
    expect(redditAdapter.matches('old.reddit.com')).toBe(false);
  });

  it('does not match an unrelated host', () => {
    expect(redditAdapter.matches('x.com')).toBe(false);
  });

  it('does not match a lookalike domain', () => {
    expect(redditAdapter.matches('notreddit.com')).toBe(false);
  });
});

describe('isFeedPath', () => {
  it.each(['/', '/r/rust/', '/r/all/', '/search/?q=rust', '/user/someone/'])(
    'filters %s',
    (path) => {
      expect(isFeedPath(path)).toBe(true);
    },
  );

  it('stands down on a comment thread, which the reader opened deliberately', () => {
    expect(isFeedPath('/r/rust/comments/abc123/rust_190_ships/')).toBe(false);
  });

  it('stands down on a comment thread under a user profile too', () => {
    expect(isFeedPath('/user/someone/comments/abc123/title/')).toBe(false);
  });
});

describe('redditAdapter.findPosts', () => {
  it('finds a post and takes its title from the attribute', () => {
    const posts = redditAdapter.findPosts(mount(card()));
    expect(posts).toHaveLength(1);
    expect(posts[0]!.text).toBe(TITLE);
  });

  it('appends the body on a text post', () => {
    const posts = redditAdapter.findPosts(mount(card(undefined, body(BODY))));
    expect(posts[0]!.text).toBe(`${TITLE} ${BODY}`);
  });

  it('accepts the container itself as the root', () => {
    mount(card());
    const article = document.querySelector('article') as HTMLElement;
    expect(redditAdapter.findPosts(article)).toHaveLength(1);
  });

  it('blurs the article, so the separators around it stay sharp', () => {
    const posts = redditAdapter.findPosts(mount(card()));
    expect(posts[0]!.container.tagName).toBe('ARTICLE');
  });

  it('ignores a promoted post, which renders outside any article', () => {
    const html = `<shreddit-ad-post class="promotedlink" post-title="Buy this"></shreddit-ad-post>`;
    expect(redditAdapter.findPosts(mount(html))).toHaveLength(0);
  });

  it('ignores a recommendation card, which carries no post id', () => {
    const html = `<article slot="content"><shreddit-post post-title="${TITLE}"></shreddit-post></article>`;
    expect(redditAdapter.findPosts(mount(html))).toHaveLength(0);
  });

  it('ignores an article with a post id but no post inside it', () => {
    expect(
      redditAdapter.findPosts(mount('<article data-post-id="t3_x"></article>')),
    ).toEqual([]);
  });

  it('returns empty text rather than guessing when the title attribute is gone', () => {
    const posts = redditAdapter.findPosts(mount(card('subreddit-name="rust"')));
    expect(posts[0]!.text).toBe('');
  });

  it('collapses the whitespace the markup indents bodies with', () => {
    const posts = redditAdapter.findPosts(mount(card(undefined, body('a\n\n   b'))));
    expect(posts[0]!.text).toBe(`${TITLE} a b`);
  });

  it('finds every post in a feed and does not double-count', () => {
    expect(redditAdapter.findPosts(mount(card() + card() + card()))).toHaveLength(3);
  });
});

describe('redditAdapter.mediaSelector', () => {
  const matches = (html: string) => {
    mount(`<article data-post-id="t3_x">${html}</article>`);
    const article = document.querySelector('article') as HTMLElement;
    return article.querySelector(redditAdapter.mediaSelector) !== null;
  };

  it.each([
    ['a post image', '<img src="https://i.redd.it/abc.jpeg" />'],
    ['a preview image', '<img src="https://preview.redd.it/abc.jpeg?width=640" />'],
    ['an external preview', '<img src="https://external-preview.redd.it/abc.jpg" />'],
    ['a video', '<video></video>'],
  ])('sees %s', (_label, html) => {
    expect(matches(html)).toBe(true);
  });

  it.each([
    [
      'a community icon',
      '<img src="https://styles.redditmedia.com/t5_x/styles/i.jpg" />',
    ],
    ['an emoji', '<img src="https://emoji.redditmedia.com/abc/x.png" />'],
    ['a thumbnail', '<img src="https://b.thumbs.redditmedia.com/abc.jpg" />'],
  ])('ignores %s, or every post would count as media', (_label, html) => {
    expect(matches(html)).toBe(false);
  });
});
