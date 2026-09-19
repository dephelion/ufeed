/* Tags the version in package.json on an up-to-date main and pushes the tag,
   which starts the Release workflow. It never touches the stores. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
const quiet = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

git('switch', 'main');
git('pull', '--ff-only');

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;

if (quiet('tag', '--list', tag) || quiet('ls-remote', '--tags', 'origin', tag)) {
  console.error(`${tag} already exists. Bump the version in package.json first.`);
  process.exit(1);
}

git('tag', tag);
git('push', 'origin', tag);
console.log(`Pushed ${tag}. The Release workflow now builds the zips.`);
