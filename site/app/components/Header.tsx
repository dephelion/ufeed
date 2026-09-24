import Image from 'next/image';
import Link from 'next/link';
import GitHubIcon from './GitHubIcon';
import { REPOSITORY_URL } from '../lib/site';

export default function Header() {
  return (
    <header className="header wrap">
      <Link className="brand" href="/" aria-label="uFeed home">
        <Image src="/extension-icon.png" width={32} height={32} alt="" priority />
        <span>uFeed</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/how-it-works/">How it works</Link>
        <Link href="/privacy/">Privacy</Link>
        <a className="nav-github" href={REPOSITORY_URL} aria-label="uFeed on GitHub">
          <GitHubIcon /> <span>GitHub</span>
        </a>
      </nav>
    </header>
  );
}
