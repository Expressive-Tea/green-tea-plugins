#!/usr/bin/env node
// Cognitive-complexity gate over every package's src. Fails (exit 1) if any named function exceeds the
// threshold. Same gate as core's, walked per package because ccts-json takes one directory.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const THRESHOLD = 25;

function scores(dir) {
  try {
    return execSync(`npx ccts-json ${dir}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (error) {
    return error.stdout?.toString() ?? '';
  }
}

const offenders = [];

function walk(node, dir) {
  if (!node || typeof node !== 'object') return;
  if (node.kind === 'function' && node.name && node.score > THRESHOLD) {
    offenders.push({ score: node.score, name: `${dir}: ${node.name}` });
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'inner' && Array.isArray(value)) value.forEach((child) => walk(child, dir));
    else if (value && typeof value === 'object') walk(value, dir);
  }
}

const dirs = readdirSync('packages')
  .map((name) => `packages/${name}/src`)
  .filter((dir) => existsSync(dir));

for (const dir of dirs) {
  const raw = scores(dir);
  if (!raw.trim()) {
    console.error(`check-complexity: no output from ccts-json for ${dir}`);
    process.exit(2);
  }

  walk(JSON.parse(raw), dir);
}

if (offenders.length) {
  offenders.sort((a, b) => b.score - a.score);
  console.error(`\n✖ cognitive complexity: ${offenders.length} function(s) over ${THRESHOLD}\n`);
  for (const o of offenders) console.error(`  ${String(o.score).padStart(4)}  ${o.name}`);
  console.error('\nExtract helpers to bring them under the threshold. The threshold is not raised.\n');
  process.exit(1);
}

console.log(`✓ cognitive complexity: every function ≤ ${THRESHOLD} (${dirs.length} package(s))`);
