# AGENTS.md

Guidance for AI coding assistants working in this repository. A person reads every line of what you
produce and signs off on it: leave the reasoning visible, don't widen scope, say what you were unsure of.

## What this is

Official plugins for `@green-tea/core`, one package per directory under `packages/`. A plugin is a
factory returning `{ name, mount(api) }`; `mount` receives `bus.on`, `scope.add` and `onShutdown`.

## Commands

```bash
npm run lint
npm run format:check
npm run complexity:check   # ≤ 25 per function; never relaxed or exempted
npm run typecheck
npm test                   # Node: every package's contract tests + the workspace checks
npm run test:deno          # packages whose engines declare deno
npm run test:bun           # packages whose engines declare bun
```

Run all of them before proposing anything as finished. CI runs each one and each gates a merge.

## Two forges

Gitea `Green-Tea/plugins` is the origin. `develop` and `main` are protected; everything lands through
a pull request. Until core is consumed from npm (Plan B3), CI runs on Gitea only, because
`@green-tea/core` comes from Verdaccio, which a GitHub runner cannot reach.

## The plugin convention

1. A named factory export that returns a `Plugin`.
2. `options.provides` renames the graph node. The node's `name`, its `provides` entry and the
   plugin's `name` are the same string, so two instances cannot collide on any of the three.
3. The published value is reached with `@needs(provides)`.
4. Expensive work happens in `run`, so a bad key fails `listen()` or `app.boot()`. On workerd it fails
   the first request, and the README says so.
5. Types are exported beside the factory.
6. JSDoc carries an `@example` for the `createApp` wiring and one for the handler.
7. `onShutdown` releases whatever would keep the process alive or drop work in flight: a pool, a
   socket, a timer, a file handle. A key read once or a cached value needs nothing.
8. **Core is imported as types only**, and `@green-tea/core` sits in `devDependencies` alone. Errors
   carry the `Symbol.for('green-tea.http-error')` brand instead of extending `HttpError`. The lint
   rule and `test/workspace.test.ts` enforce it.
9. **Runtimes are declared twice, and the two must agree:** as `engines` keys (`node`, `deno`, `bun`,
   `workerd`), and as a Runtimes table near the top of the README that lists all four, with the reason
   beside every one that is not supported. Nobody should have to open an issue to learn where a
   plugin runs.
10. A breaking change goes under `### Breaking`, first in the package's CHANGELOG.
11. **Plugins publish to JSR alone.** `deno.json` exports `./src/index.ts` and there is no build:
    JSR transpiles the TypeScript itself and hands consumers a typed ESM package with generated
    declarations. Every `package.json` here stays `private`, so an accidental `npm publish` fails
    rather than shipping entry points that describe a `dist/` nobody produces. `test/workspace.test.ts`
    pins that.

    The second registry was dropped because it was not buying a reader anything. `npx jsr add
    @green-tea/<name>` installs under npm, yarn, pnpm and bun via `npm.jsr.io` — one line in
    `.npmrc`, and the import specifier stays `@green-tea/<name>`; the `@jsr/` name appears only in
    the lockfile. What it cost was a tsup config per package, a dual `exports` map, and a `dist/`
    that could go stale between a merge and a release.

    JSR is also the only one of the two that can say **where a plugin runs**. Its `runtimeCompat` is
    per package, which matters for a framework whose claim is one app on four runtimes: `jwt` needs
    `node:fs/promises` and cannot serve workerd, while `metrics` imports nothing and runs everywhere.
    npm has nowhere to record that difference, so rule 9's `engines`/README pair was the only place
    it lived. It is declared in the JSR package settings, not in `deno.json` — the config schema
    accepts `name`, `version`, `license`, `exports` and `publish`, and nothing else.

    What this gives up: no discovery on npmjs.org, where the marketplace is the channel anyway, and
    a site behind a registry proxy that mirrors npmjs.org and refuses a second one cannot reach the
    plugins. Core still can — it publishes to both.

## Conventions

- Conventional Commits, focused on the *why*. Every commit signed off (`git commit -s`). No AI
  co-authoring attribution.
- Comments carry reasoning the code cannot show. Keep them when editing.
- Relative imports carry the `.ts` extension: Deno and JSR require it.
