# green-tea plugins

Official plugins for [green-tea](https://github.com/Expressive-Tea/green-tea). Each one is its own
package under `packages/`, published to JSR, and each README says which runtimes it supports and why
not the others.

```bash
npx jsr add @green-tea/jwt      # npm, and the same command for yarn and pnpm
deno add jsr:@green-tea/jwt
bunx jsr add @green-tea/jwt
```

That works under every package manager: `jsr add` writes one line to `.npmrc` and installs through
`npm.jsr.io`, so the import stays `@green-tea/jwt` and nothing in your code mentions JSR. A plain
`npm i @green-tea/jwt` will **not** work — these packages are not on npmjs.org.

| Package | What it does |
|---|---|
| [`@green-tea/jwt`](packages/jwt) | Loads signing keys at boot and publishes a sign/verify registry |
| [`@green-tea/rate-limit`](packages/rate-limit) | A per-request limiter with a branded `429` and a swept in-memory store |
| [`@green-tea/metrics`](packages/metrics) | Counts the lifecycle stream and renders the Prometheus text format |

Plugins import core as types only. Their built code never imports it at all, so the core that runs
is always your application's, whatever version a plugin was written against — and nothing warns
about a version range, which under CalVer no range can express.

That is about *loading*, not about disk. A plugin names an exact core in its `deno.json`, and when
your version differs by more than the patch, npm places a second copy under the plugin rather than
deduplicating. Measured, on purpose: it is inert, because nothing ever imports it. What it can do
is make `tsc` resolve a plugin's `Plugin` type against that copy instead of yours, which fails
loudly at compile time rather than quietly at runtime.
