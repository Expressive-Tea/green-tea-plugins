<p align="center">
  <img src="https://raw.githubusercontent.com/Expressive-Tea/green-tea/main/assets/logo.png" width="96" alt="Green Tea" />
</p>

<h1 align="center">green&nbsp;tea plugins.</h1>

<p align="center"><b>Each one is a node in the graph, not a link in a chain.</b></p>

<p align="center">
  A plugin declares what it provides; your route declares what it needs.<br />
  Nothing runs for a route that never asked for it.
</p>

---

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

Plugins import core as types only, and a type import leaves nothing behind when it compiles — the
JavaScript JSR publishes never mentions core. So the core that runs is always your application's,
whatever version a plugin was written against.

The types still come from somewhere, so each plugin's `deno.json` names a core **range**,
`^26.11.0-rc.1`: the version its tests run against, up to the next year. After core's first stable
release only the first release of a year may break, so that range is exactly the set of cores a
plugin stays compatible with, and your application's core satisfies it without a second copy. A
plugin published before this named an exact core, and an application on a newer one could get a
second, older copy under the plugin. It was inert at runtime, but `tsc` could resolve the plugin's
`Plugin` type against it and fail at compile time.
