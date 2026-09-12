import { describe, expect, it } from 'vitest';
import { linkedinAdapter } from './linkedin';

const CARD_ATTRS = 'componentkey="update-card-focusABC123FeedType_MAIN_FEED_RELEVANCE"';

const card = (text: string, extra = '') =>
  `<div ${CARD_ATTRS}>
     <h2><span>Feed post</span></h2>
     <div data-testid="expandable-text-box">${text}</div>
     ${extra}
   </div>`;

const mount = (html: string) => {
  document.body.innerHTML = html;
  return document.body;
};

const LONG = 'A post about distributed systems and how they fail in practice.';

describe('linkedinAdapter.matches', () => {
  it.each(['linkedin.com', 'www.linkedin.com'])('matches %s', (host) => {
    expect(linkedinAdapter.matches(host)).toBe(true);
  });

  it('does not match an unrelated host', () => {
    expect(linkedinAdapter.matches('reddit.com')).toBe(false);
  });

  it('does not match a lookalike domain', () => {
    expect(linkedinAdapter.matches('notlinkedin.com')).toBe(false);
  });
});

describe('linkedinAdapter.findPosts', () => {
  it('finds a post and extracts its text', () => {
    const posts = linkedinAdapter.findPosts(mount(card(LONG)));
    expect(posts).toHaveLength(1);
    expect(posts[0]!.text).toBe(LONG);
  });

  it('finds a node that is itself a post, not only its descendants', () => {
    mount(card(LONG));
    const root = document.querySelector(`[${CARD_ATTRS}]`)!;
    expect(linkedinAdapter.findPosts(root)).toHaveLength(1);
  });

  it('does not double-count a post reachable both ways', () => {
    mount(card(LONG));
    const root = document.body;
    expect(linkedinAdapter.findPosts(root)).toHaveLength(1);
  });

  it('skips a card with no "Feed post" heading, such as a job ad or poll', () => {
    const html = `<div ${CARD_ATTRS}>
      <h2><span>Job post</span></h2>
      <div data-testid="expandable-text-box">Hiring: Staff Engineer</div>
    </div>`;
    expect(linkedinAdapter.findPosts(mount(html))).toHaveLength(0);
  });

  it('strips the "…more" toggle button nested inside the text', () => {
    const html = card(
      `${LONG}<button data-testid="expandable-text-button">… more</button>`,
    );
    expect(linkedinAdapter.findPosts(mount(html))[0]!.text).toBe(LONG);
  });

  it('scores only the post, never an inline comment rendered under it', () => {
    const extra = `<div class="comments">
      <div data-testid="expandable-text-box">Great point, I fully agree with this take.</div>
    </div>`;
    expect(linkedinAdapter.findPosts(mount(card(LONG, extra)))[0]!.text).toBe(LONG);
  });

  it('keeps a caption-less media post, which has no text node at all', () => {
    const html = `<div ${CARD_ATTRS}>
      <h2><span>Feed post</span></h2>
      <img src="https://media.licdn.com/dms/image/v2/x/feedshare-image-high-res/y" />
    </div>`;
    const posts = linkedinAdapter.findPosts(mount(html));
    expect(posts).toHaveLength(1);
    expect(posts[0]!.text).toBe('');
  });

  it('collapses whitespace so a re-render hashes the same', () => {
    const html = card('Distributed   systems\n\n  fail in  practice always');
    expect(linkedinAdapter.findPosts(mount(html))[0]!.text).toBe(
      'Distributed systems fail in practice always',
    );
  });
});

describe('linkedinAdapter.mediaSelector', () => {
  it('matches post-body images, not profile avatars', () => {
    document.body.innerHTML = `
      <img id="avatar" src="https://media.licdn.com/dms/image/v2/x/profile-displayphoto-shrink_100_100/y" />
      <img id="media" src="https://media.licdn.com/dms/image/v2/x/feedshare-image-high-res/y" />
    `;
    const matched = [...document.querySelectorAll(linkedinAdapter.mediaSelector)];
    expect(matched).toHaveLength(1);
    expect((matched[0] as HTMLImageElement).id).toBe('media');
  });
});
