import type { SiteAdapter } from './types';
import { xAdapter } from './x';
import { linkedinAdapter } from './linkedin';

const ADAPTERS: SiteAdapter[] = [xAdapter, linkedinAdapter];

export function adapterFor(hostname: string): SiteAdapter | undefined {
  return ADAPTERS.find((a) => a.matches(hostname));
}

export type { Post, SiteAdapter } from './types';
