import type { SiteAdapter } from '../feed/ports';
import { xAdapter } from './x';
import { linkedinAdapter } from './linkedin';
import { redditAdapter } from './reddit';

const ADAPTERS: SiteAdapter[] = [xAdapter, linkedinAdapter, redditAdapter];

export function adapterFor(hostname: string): SiteAdapter | undefined {
  return ADAPTERS.find((a) => a.matches(hostname));
}
