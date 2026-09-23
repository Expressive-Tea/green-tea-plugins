import { strict as assert } from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// Static checks for convention rules 8 and 9 and for npm provenance. They read files only, so they run
// under Node alone; the contract tests are what run on every runtime.

const ROOT = join(import.meta.dirname, '..');
const RUNTIMES = new Set(['node', 'deno', 'bun', 'workerd']);
// The README names runtimes for people; `engines` names them for tools. This is the whole mapping.
const README_RUNTIMES: Record<string, string> = { Node: 'node', Deno: 'deno', Bun: 'bun', 'workerd (edge)': 'workerd' };

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  repository?: { type?: string; url?: string; directory?: string };
  main?: string;
  module?: string;
  types?: string;
  files?: string[];
  exports?: unknown;
  scripts?: Record<string, string>;
}

interface DenoJson {
  name?: string;
  version?: string;
  imports?: Record<string, string>;
  workspace?: string[];
  exports?: string;
}

const readJson = <T>(...path: string[]): T => JSON.parse(readFileSync(join(ROOT, ...path), 'utf8')) as T;

const packages = existsSync(join(ROOT, 'packages'))
  ? readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

/** Rows of the README's `## Runtimes` table, as `[runtime, supported]`. */
function runtimeRows(readme: string): Array<[string, boolean]> {
  const section = readme.split(/^## /m).find((part) => part.startsWith('Runtimes'));
  assert.ok(section, 'README has no "## Runtimes" section');

  return section
    .split('\n')
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells[1] in README_RUNTIMES)
    .map((cells) => [README_RUNTIMES[cells[1]], cells[2] === '✅']);
}

test('the workspace has at least one package', () => {
  assert.ok(packages.length > 0, 'no directories under packages/');
});

for (const dir of packages) {
  const pkg = readJson<PackageJson>('packages', dir, 'package.json');
  const deno = readJson<DenoJson>('packages', dir, 'deno.json');

  test(`${dir}: npm and JSR publish the same package at the same version`, () => {
    assert.equal(pkg.name, `@green-tea/${dir}`);
    assert.equal(deno.name, pkg.name);
    assert.equal(deno.version, pkg.version);
  });

  test(`${dir}: core is a dev dependency only`, () => {
    assert.ok(pkg.devDependencies?.['@green-tea/core'], 'core missing from devDependencies');
    assert.equal(pkg.dependencies?.['@green-tea/core'], undefined, 'core in dependencies');
    assert.equal(pkg.peerDependencies?.['@green-tea/core'], undefined, 'core in peerDependencies');
  });

  test(`${dir}: JSR maps the core version npm installs`, () => {
    assert.equal(deno.imports?.['@green-tea/core'], `npm:@green-tea/core@${pkg.devDependencies?.['@green-tea/core']}`);
  });

  test(`${dir}: engines declares runtimes, and only known ones`, () => {
    const keys = Object.keys(pkg.engines ?? {});
    assert.ok(keys.length > 0, 'engines is empty');
    for (const key of keys) assert.ok(RUNTIMES.has(key), `unknown engines key "${key}"`);
  });

  test(`${dir}: the README lists all four runtimes, and ✅ exactly the engines keys`, () => {
    const rows = runtimeRows(readFileSync(join(ROOT, 'packages', dir, 'README.md'), 'utf8'));
    assert.deepEqual(rows.map(([runtime]) => runtime).sort(), [...RUNTIMES].sort());

    const supported = rows.filter(([, ok]) => ok).map(([runtime]) => runtime);
    assert.deepEqual(supported.sort(), Object.keys(pkg.engines ?? {}).sort());
  });

  test(`${dir}: npm provenance points at the public repository and this directory`, () => {
    assert.deepEqual(pkg.repository, {
      type: 'git',
      url: 'git+https://github.com/Expressive-Tea/green-tea-plugins.git',
      directory: `packages/${dir}`,
    });
  });

  test(`${dir}: the Deno workspace includes it`, () => {
    assert.ok(readJson<DenoJson>('deno.json').workspace?.includes(`./packages/${dir}`));
  });

  test(`${dir}: JSR is served the source`, () => {
    // JSR transpiles TypeScript itself and hands consumers a typed ESM package, so it gets `src/`
    // and the packages carry no build of their own.
    assert.equal(deno.exports, './src/index.ts', 'JSR should publish the TypeScript source');
  });

  test(`${dir}: nothing here is publishable to npm`, () => {
    // Plugins publish to JSR alone. `npx jsr add` installs them under npm, yarn, pnpm and bun
    // through `npm.jsr.io`, which leaves the import specifier intact, so the second registry bought
    // a per-package tsup build and a dual `exports` map without buying a reader anything.
    //
    // JSR is also the only one of the two that can say *where a plugin runs*, per package. That is
    // not cosmetic for a framework whose claim is one app on four runtimes: `jwt` needs
    // `node:fs/promises` and `metrics` imports nothing at all, and npm has nowhere to record the
    // difference.
    //
    // `private` is the guard, not a leftover: it is what makes an accidental `npm publish` fail
    // instead of shipping a package whose entry points describe a `dist/` nobody builds.
    assert.equal(pkg.private, true, 'a plugin must not be publishable to npm');

    for (const field of ['main', 'module', 'types', 'exports', 'files'] as const) {
      assert.equal(pkg[field], undefined, `${field} describes an npm tarball that is never built`);
    }

    assert.equal(pkg.scripts?.build, undefined, 'there is no build to run');
  });
}
