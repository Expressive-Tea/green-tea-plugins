import { defineConfig } from 'tsup';

// The npm half of the dual publish. JSR serves `src/` straight from `deno.json` and transpiles it
// itself, so nothing here is JSR's problem — this exists because a plain `npm i` gets none of that
// and Node refuses to strip types under `node_modules`.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node22',
  // Convention rule 8 keeps core in `devDependencies`, and tsup bundles devDependencies by default.
  // Without this line the emitted declarations would inline core's types rather than import them,
  // and every plugin would ship a frozen private copy of a contract core owns.
  external: ['@green-tea/core'],
});
