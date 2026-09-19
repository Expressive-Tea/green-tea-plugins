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

  test(`${dir}: npm is served the build and JSR the source`, () => {
    // The two registries are fed different things on purpose. JSR transpiles TypeScript itself, so
    // it gets `src/`. npm does not, and Node refuses to strip types under `node_modules` — a package
    // whose `exports` pointed at a `.ts` file installed fine and then threw on the first import.
    assert.equal(deno.exports, './src/index.ts', 'JSR should publish the TypeScript source');

    assert.deepEqual(pkg.exports, {
      '.': {
        import: { types: './dist/index.d.ts', default: './dist/index.js' },
        require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
      },
    });
    assert.equal(pkg.main, './dist/index.cjs');
    assert.equal(pkg.module, './dist/index.js');
    assert.equal(pkg.types, './dist/index.d.ts');
  });

  test(`${dir}: the tarball ships the build and nothing else`, () => {
    // Without `files`, npm packs the whole directory — the first tarball carried `test/` along.
    assert.deepEqual(pkg.files, ['dist', 'README.md', 'CHANGELOG.md']);
    assert.equal(pkg.scripts?.build, 'tsup');
    // A stale `dist/` is the one packaging failure no static check can see, so the build runs again
    // on the way out rather than trusting whatever CI left behind.
    assert.equal(pkg.scripts?.prepublishOnly, 'npm run build');
  });
}
