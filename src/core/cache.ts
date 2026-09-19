import type { RatedMatch } from './scoring';

/** FNV-1a. Content-keyed, because virtualized feeds recycle DOM nodes. */
export function hashText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export class ScoreCache {
  readonly #entries = new Map<string, RatedMatch>();

  constructor(private readonly limit = 2000) {}

  get(text: string): RatedMatch | undefined {
    const key = hashText(text);
    const hit = this.#entries.get(key);
    if (hit === undefined) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, hit);
    return hit;
  }

  set(text: string, match: RatedMatch): void {
    const key = hashText(text);
    this.#entries.delete(key);
    this.#entries.set(key, match);
    if (this.#entries.size > this.limit) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
  }

  /** Scores are relative to the topic vectors; new topics invalidate all of them. */
  clear(): void {
    this.#entries.clear();
  }

  get size(): number {
    return this.#entries.size;
  }
}
