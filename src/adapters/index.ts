import type { SiteAdapter } from './types';
import { xAdapter } from './x';

const ADAPTERS: SiteAdapter[] = [xAdapter];

export function adapterFor(hostname: string): SiteAdapter | undefined {
  return ADAPTERS.find((a) => a.matches(hostname));
}

export type { Post, SiteAdapter } from './types';
