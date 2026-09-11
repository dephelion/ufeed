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
  readonly #entries = new Map<string, number>();

  constructor(private readonly limit = 2000) {}

  get(text: string): number | undefined {
    const key = hashText(text);
    const hit = this.#entries.get(key);
    if (hit === undefined) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, hit);
    return hit;
  }

  set(text: string, score: number): void {
    const key = hashText(text);
    this.#entries.delete(key);
    this.#entries.set(key, score);
    if (this.#entries.size > this.limit) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
  }

  get size(): number {
    return this.#entries.size;
  }
}
