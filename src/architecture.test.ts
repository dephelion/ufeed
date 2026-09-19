import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** The Dependency Rule, enforced. The rings and why they exist: wiki-llm/layers.md. */
const SRC = dirname(fileURLToPath(import.meta.url));

const RING: Record<string, number> = {
  core: 1,
  feed: 2,
  adapters: 3,
  platform: 3,
  entrypoints: 4,
};

/** Packages a ring may import. Rings 3 and 4 are where the frameworks live. */
const PACKAGES: Record<string, 'none' | 'any'> = {
  core: 'none',
  feed: 'none',
  adapters: 'none',
  platform: 'any',
  entrypoints: 'any',
};

/** A browser global or DOM type in `core/` means platform or page code leaked inward. */
const IMPURE =
  /\b(?:document|window|navigator|chrome|browser)\s*\.|\b(?:HTMLElement|ParentNode|MutationObserver|IntersectionObserver)\b/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

const IMPORT =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(file: string): string[] {
  const code = readFileSync(file, 'utf8');
  return [...code.matchAll(IMPORT)].map((m) => (m[1] ?? m[2] ?? m[3])!.split('?')[0]!);
}

const isRelative = (spec: string) => spec.startsWith('.');
const folderOf = (path: string) => relative(SRC, path).split(/[\\/]/)[0]!;

/** `./x` is `x.ts`, `x/index.ts`, or a file that already names its extension. */
function resolveFile(from: string, spec: string): string | undefined {
  const base = resolve(dirname(from), spec);
  return [base, `${base}.ts`, join(base, 'index.ts')].find(
    (path) => existsSync(path) && statSync(path).isFile(),
  );
}

const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FILES = sources(SRC);

describe('the Dependency Rule', () => {
  it('puts every source file in a ring', () => {
    const stray = FILES.filter((file) => RING[folderOf(file)] === undefined);
    expect(stray.map((file) => relative(SRC, file))).toEqual([]);
  });

  it('points every import inward or across its own ring, never outward', () => {
    const violations: string[] = [];
    for (const file of FILES) {
      const from = folderOf(file);
      for (const spec of importsOf(file).filter(isRelative)) {
        const to = folderOf(resolve(dirname(file), spec));
        const outward = RING[to]! > RING[from]!;
        const sideways = from !== to && RING[to] === RING[from];
        if (outward || sideways) violations.push(`${relative(SRC, file)} -> ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps packages out of core/, feed/ and adapters/', () => {
    const violations: string[] = [];
    for (const file of FILES) {
      if (PACKAGES[folderOf(file)] === 'any') continue;
      for (const spec of importsOf(file).filter((s) => !isRelative(s)))
        violations.push(`${relative(SRC, file)} -> ${spec}`);
    }
    expect(violations).toEqual([]);
  });

  it('keeps browser globals and DOM types out of core/', () => {
    const impure = FILES.filter(
      (file) =>
        folderOf(file) === 'core' &&
        IMPURE.test(withoutComments(readFileSync(file, 'utf8'))),
    );
    expect(impure.map((file) => relative(SRC, file))).toEqual([]);
  });

  it('never lets the worker reach webextension-polyfill, which throws outside an extension page', () => {
    const seen = new Set<string>();
    const packages = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const spec of importsOf(file)) {
        if (!isRelative(spec)) packages.add(spec);
        else {
          const next = resolveFile(file, spec);
          if (next?.endsWith('.ts')) visit(next);
        }
      }
    };
    visit(join(SRC, 'entrypoints/engine/engine.worker.ts'));
    expect(seen.size).toBeGreaterThan(3);
    expect([...packages]).not.toContain('webextension-polyfill');
  });
});
