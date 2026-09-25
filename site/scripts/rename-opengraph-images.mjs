import { access, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Script } from 'node:vm';

const outputDirectory = new URL('../out/', import.meta.url);

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? htmlFiles(path)
        : entry.name === 'index.html'
          ? [path]
          : [];
    }),
  );
  return files.flat();
}

const entries = await readdir(outputDirectory, { withFileTypes: true });

await Promise.all(
  entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const source = join(outputDirectory.pathname, entry.name, 'opengraph-image');
      const target = `${source}.png`;
      try {
        await access(source);
      } catch {
        return;
      }
      await rename(source, target);
    }),
);

for (const file of await htmlFiles(outputDirectory.pathname)) {
  const html = await readFile(file, 'utf8');
  const fixedHtml = html.replace(
    /opengraph-image\?[a-zA-Z0-9_-]+/g,
    'opengraph-image.png',
  );
  if (fixedHtml !== html) await writeFile(file, fixedHtml);

  for (const [, attributes, source] of fixedHtml.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
  )) {
    if (!/\bsrc=|\btype="application\/ld\+json"/.test(attributes)) {
      new Script(source, { filename: file });
    }
  }
}
