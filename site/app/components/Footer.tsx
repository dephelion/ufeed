import Link from 'next/link';
import GitHubIcon from './GitHubIcon';
import { REPOSITORY_URL } from '../lib/site';

export default function Footer() {
  return (
    <footer className="footer wrap">
      <Link className="brand" href="/">
        <span>uFeed</span>
      </Link>
      <p>© Julio Cesar Martin - 2026</p>
      <nav aria-label="Footer links">
        <Link href="/how-it-works/">How it works</Link>
        <Link href="/privacy/">Privacy</Link>
        <Link href="/terms/">Terms</Link>
        <a className="github-link" href={REPOSITORY_URL} aria-label="uFeed on GitHub">
          <GitHubIcon size={15} /> <span>GitHub</span>
        </a>
      </nav>
    </footer>
  );
}
