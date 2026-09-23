#!/usr/bin/env node
// Two jobs around a `deno publish`, both about the same thing: a JSR version can never be replaced
// or removed, so anything wrong has to be caught *before* the publish rather than reported after it.
//
//   --check         Which packages this tag would publish, and whether each has a CHANGELOG entry
//                   to match. Exits non-zero when one does not. Run this BEFORE publishing.
//   --notes <log>   The GitHub release body, built from what `deno publish` actually did.
//
// The order matters and is the whole point of splitting it in two. core's equivalent script runs
// after npm and JSR have already published, so a missing heading fails a release that has already
// shipped — a wart worth not inheriting.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PACKAGES = join(ROOT, 'packages');
const REPO = 'Expressive-Tea/green-tea-plugins';

/** Every workspace package, with the version its deno.json declares. */
function readPackages() {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const deno = JSON.parse(readFileSync(join(PACKAGES, entry.dir ?? entry.name, 'deno.json'), 'utf8'));
      return { dir: entry.name, name: deno.name, version: deno.version };
    });
}

/** Whether JSR already serves this exact version. A 404 for a package with no versions at all is
 *  not an error — it is what every one of these looks like until its first publish. */
async function isPublished({ name, version }) {
  const [scope, pkg] = name.replace(/^@/, '').split('/');
  const url = `https://api.jsr.io/scopes/${scope}/packages/${pkg}/versions/${version}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });

  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`${name}@${version}: ${url} answered ${response.status}`);

  return true;
}

/** One version's section of a package CHANGELOG, heading excluded. */
function changelogSection(dir, version) {
  const lines = readFileSync(join(PACKAGES, dir, 'CHANGELOG.md'), 'utf8').split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) return null;

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));

  return (end === -1 ? rest : rest.slice(0, end))
    // Link reference definitions belong to the file, not to the entry. Nothing separates them from
    // the last section, so without this they ride along into the release body as a stray line.
    .filter((line) => !/^\[[^\]]+\]:\s/.test(line))
    .join('\n')
    .trim();
}

async function check() {
  const packages = readPackages();
  const published = await Promise.all(packages.map(isPublished));
  const pending = packages.filter((_, i) => !published[i]);

  if (pending.length === 0) {
    console.log('Nothing to publish: every package version is already on JSR.');
    return 0;
  }

  let missing = 0;
  for (const pkg of pending) {
    const section = changelogSection(pkg.dir, pkg.version);
    if (section) {
      console.log(`  ok      ${pkg.name}@${pkg.version}`);
    } else {
      // Deliberately an error rather than a warning. A version heading is a claim that the release
      // exists, and publishing without one leaves a package on JSR that its own changelog says was
      // never released — permanently, because the version cannot be replaced.
      console.error(`  MISSING ${pkg.name}@${pkg.version} has no "## [${pkg.version}]" in packages/${pkg.dir}/CHANGELOG.md`);
      missing += 1;
    }
  }

  packages
    .filter((_, i) => published[i])
    .forEach((pkg) => console.log(`  skip    ${pkg.name}@${pkg.version} (already on JSR)`));

  return missing === 0 ? 0 : 1;
}

/** Parse what `deno publish` reported. Its own output is the only honest source for this: predicting
 *  it means duplicating the filtering Deno already did, and being wrong about it silently. */
function notes(logPath, tag) {
  const log = readFileSync(logPath, 'utf8');
  // Colour codes survive when a terminal is attached and vanish in CI. Strip either way.
  const plain = log.replace(/\u001b\[[0-9;]*m/g, '');
  const shipped = [...plain.matchAll(/Successfully published (@[^@\s]+\/[^@\s]+)@(\S+)/g)]
    .map(([, name, version]) => ({ name, version }));

  if (shipped.length === 0) {
    return `No package versions were published by \`${tag}\` — every version in the workspace was already on JSR.`;
  }

  const byName = Object.fromEntries(readPackages().map((pkg) => [pkg.name, pkg.dir]));
  const body = shipped.map(({ name, version }) => {
    const dir = byName[name];
    const section = (dir && changelogSection(dir, version)) || '_No changelog entry._';
    const link = `https://github.com/${REPO}/blob/${tag}/packages/${dir}/CHANGELOG.md`;

    return `## [${name}@${version}](https://jsr.io/${name}@${version})\n\n${section}\n\n[Full changelog](${link})`;
  });

  const untouched = readPackages().filter((pkg) => !shipped.some((s) => s.name === pkg.name));
  const footer = untouched.length
    ? `\n\n---\n\nUnchanged in this release: ${untouched.map((p) => `\`${p.name}@${p.version}\``).join(', ')}.`
    : '';

  return `${body.join('\n\n')}${footer}`;
}

const [mode, arg] = process.argv.slice(2);

if (mode === '--check') {
  process.exit(await check());
} else if (mode === '--notes') {
  if (!arg) {
    console.error('usage: release.mjs --notes <publish-log> [tag]');
    process.exit(2);
  }
  console.log(notes(arg, process.argv[4] ?? 'main'));
} else {
  console.error('usage: release.mjs --check | --notes <publish-log> [tag]');
  process.exit(2);
}
