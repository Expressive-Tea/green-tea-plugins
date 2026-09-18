#!/usr/bin/env node
// Runs the contract tests of every package whose `engines` declares <runtime>, on that runtime.
// `engines` is the one declaration (convention rule 9): a package that does not claim a runtime is not
// tested on it, and a package that claims one cannot skip it.
//
// Usage: node scripts/run-runtime.mjs <deno|bun|workerd>
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const COMMANDS = {
  deno: (dirs) => ['deno', ['test', '--allow-all', '--no-check', ...dirs.map((dir) => `packages/${dir}/test/`)]],
  bun: (dirs) => ['bun', ['test', ...dirs.map((dir) => `./packages/${dir}/test/`)]],
};

const runtime = process.argv[2];
if (!(runtime in COMMANDS) && runtime !== 'workerd') {
  console.error('usage: run-runtime.mjs <deno|bun|workerd>');
  process.exit(2);
}

const declares = (dir) => {
  const { engines = {} } = JSON.parse(readFileSync(`packages/${dir}/package.json`, 'utf8'));
  return runtime in engines;
};
const dirs = readdirSync('packages').filter(declares);

if (dirs.length === 0) {
  console.log(`no package declares ${runtime}; nothing to run`);
  process.exit(0);
}

// There is no workerd harness for plugins yet (spec, section 4). A package that declares workerd must
// not pass CI by having nothing run against it — copy core's test/edge harness first.
if (runtime === 'workerd') {
  console.error(`${dirs.join(', ')} declare workerd, and there is no workerd harness yet.`);
  process.exit(1);
}

const [command, args] = COMMANDS[runtime](dirs);
const { status } = spawnSync(command, args, { stdio: 'inherit' });
process.exit(status ?? 1);
