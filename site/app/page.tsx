import Link from 'next/link';

const repository = 'https://github.com/dephelion/ufeed';
const chromeStore =
  'https://chromewebstore.google.com/detail/ahlojbckjlffcfdhmkjepaglnhhpmdck';

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function FeedPreview() {
  return (
    <div className="preview" aria-label="Illustration of uFeed blurring unrelated posts">
      <div className="preview-top">
        <i />
        <i />
        <i />
        <span>your feed</span>
      </div>
      <div className="preview-content">
        <div className="side-icons">
          <b>◉</b>
          <b>⌕</b>
          <b>▤</b>
          <b>◎</b>
        </div>
        <div className="posts">
          <article className="post">
            <div className="avatar yellow">J</div>
            <div className="post-copy">
              <b>Jamie Rivera</b>
              <small>· 2h</small>
              <p>A little progress every day adds up to something wonderful.</p>
              <div className="post-actions">♡　◯　↗</div>
            </div>
          </article>
          <article className="post blurred">
            <div className="avatar blue">A</div>
            <div className="post-copy">
              <b>Alex Morgan</b>
              <small>· 3h</small>
              <p>Everything you need to know about this weekend’s big game…</p>
              <span className="blur-tag">Blurred · outside your topics</span>
            </div>
          </article>
          <article className="post">
            <div className="avatar coral">R</div>
            <div className="post-copy">
              <b>Riley Chen</b>
              <small>· 4h</small>
              <p>Finally made time to try that recipe. It was worth it!</p>
              <div className="post-actions">♡　◯　↗</div>
            </div>
          </article>
        </div>
        <aside className="topics">
          <b>Your topics</b>
          <span>Design</span>
          <span>Cooking</span>
          <span>Climate</span>
          <div className="topic-slider">
            <i />
          </div>
          <small>Just right</small>
        </aside>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <header className="header wrap">
        <Link className="brand" href="/" aria-label="uFeed home">
          <Mark /> <span>uFeed</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <Link href="/privacy/">Privacy</Link>
          <a className="nav-github" href={repository}>
            GitHub ↗
          </a>
        </nav>
      </header>

      <section className="hero wrap">
        <div className="hero-copy">
          <span className="eyebrow">
            <i /> YOUR FEED, YOUR WAY
          </span>
          <h1>A little more of what you came for.</h1>
          <p>
            uFeed gently blurs the posts that aren’t about your interests, so it’s easier
            to find the ones that are.
          </p>
          <div className="actions">
            <a className="button primary" href={chromeStore}>
              Add to Chrome <span>↗</span>
            </a>
            <a className="button secondary" href={repository}>
              Explore the project <span>↗</span>
            </a>
          </div>
          <div className="quiet-note">
            <span>✳</span> Free · Open source · Your data stays yours
          </div>
        </div>
        <FeedPreview />
      </section>

      <section className="features wrap" id="how-it-works">
        <article>
          <span className="feature-icon">⌕</span>
          <div>
            <h2>Choose what matters</h2>
            <p>Add a few topics you enjoy. uFeed learns what you want to see more of.</p>
          </div>
        </article>
        <article>
          <span className="feature-icon">◌</span>
          <div>
            <h2>A softer scroll</h2>
            <p>
              Off-topic posts are gently blurred, never removed. Tap any post to reveal
              it.
            </p>
          </div>
        </article>
        <article>
          <span className="feature-icon">⌂</span>
          <div>
            <h2>Private by design</h2>
            <p>
              Your feed stays on your device. No account, tracking, or data collection.
            </p>
          </div>
        </article>
      </section>

      <section className="closing wrap">
        <p>Less noise. More of your thing.</p>
        <a href={chromeStore}>
          Give uFeed a try <span>↗</span>
        </a>
      </section>
      <footer className="footer wrap">
        <Link className="brand" href="/">
          <Mark />
          <span>uFeed</span>
        </Link>
        <p>Made for a more intentional scroll.</p>
        <nav aria-label="Policies">
          <Link href="/privacy/">Privacy</Link>
          <Link href="/terms/">Terms</Link>
          <a href={repository}>GitHub</a>
        </nav>
      </footer>
    </main>
  );
}
