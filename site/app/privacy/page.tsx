import Link from 'next/link';

export const metadata = { title: 'Privacy policy | uFeed' };

export default function PrivacyPage() {
  return (
    <main className="legal wrap">
      <Link className="back" href="/">
        ← uFeed
      </Link>
      <h1>Privacy policy</h1>
      <p className="legal-date">Last updated 23 September 2026</p>
      <p className="legal-lead">
        uFeed works on your device. It does not collect your data, and we cannot see what
        you read or which topics you choose.
      </p>
      <h2>What uFeed reads</h2>
      <p>
        On X (x.com and twitter.com), LinkedIn and Reddit, uFeed reads the text of posts
        in the page to compare them with your topics. The comparison happens in your
        browser. Post text is held in memory while it is scored, then discarded. It is not
        written to disk, sent over the network or logged. uFeed does nothing on other
        websites.
      </p>
      <h2>What stays on your device</h2>
      <p>
        Your topics and settings are saved in your browser’s local extension storage. If
        you turn on “Learn from my thumbs,” uFeed also saves number-based representations
        of posts you rate. These can retain some information about the original post, so
        they are treated as personal data. They stay on your device, with up to 50
        positive and 50 negative ratings per topic.
      </p>
      <p>
        If you choose to export a backup, the file contains your settings and any saved
        ratings. Keep that file somewhere private. Importing a backup replaces the
        settings and ratings already in the extension.
      </p>
      <h2>What uFeed sends</h2>
      <p>
        The first time a language model is needed, your browser downloads it from Hugging
        Face. This request reveals your IP address to that service, as any download does.
        It does not include your topics or feed content. Your browser caches the model for
        later use. This is the only network request uFeed makes; there is no uFeed server.
      </p>
      <h2>Permissions</h2>
      <ul>
        <li>
          <strong>Supported websites:</strong> to read post text and apply the blur on X,
          LinkedIn and Reddit.
        </li>
        <li>
          <strong>Storage:</strong> to keep your settings and optional ratings on your
          device.
        </li>
        <li>
          <strong>Offscreen page (Chrome):</strong> to run the multilingual model in a
          shared extension worker. It receives text for scoring but cannot read the
          website.
        </li>
      </ul>
      <h2>Deleting your data</h2>
      <p>
        Use “Clear tuning” to delete ratings, or “Reset” to clear ratings and restore
        default settings. Uninstalling uFeed removes its locally stored data. Nothing is
        held by us, and there is no account to delete.
      </p>
      <h2>Children and changes</h2>
      <p>
        uFeed is not directed at children and collects no data from anyone. If this policy
        changes, this page’s date will be updated.
      </p>
      <p className="legal-end">
        <Link href="/terms/">Terms of use</Link> · <Link href="/">Back to uFeed</Link>
      </p>
    </main>
  );
}
