# green-tea plugins

Official plugins for [green-tea](https://github.com/Expressive-Tea/green-tea). Each one is its own
package under `packages/`, published to npm and JSR, and each README says which runtimes it supports
and why not the others.

| Package | What it does |
|---|---|
| [`@green-tea/jwt`](packages/jwt) | Loads signing keys at boot and publishes a sign/verify registry |

Plugins import core as types only, so installing one never pulls a second copy of core — and never
warns about a version range, which under CalVer no range can express.
