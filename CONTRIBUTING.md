# Contributing to green-tea plugins

Thanks for your interest. These are the official plugins for [green-tea](https://github.com/Expressive-Tea/green-tea), and they are open source — but nobody pushes directly. Everything lands through a reviewed pull request with a **DCO sign-off**.

## Where to send your changes

Development happens on a private Gitea instance. The GitHub repository is a downstream mirror: it receives `main`, and `develop` under the name `contrib`.

**Open your pull request against `contrib`. Not `main`.** `main` is a mirror of what has been promoted, and merging into it puts the two forges out of step and breaks the next promotion. A maintainer reviews on `contrib` and carries your commits upstream with your authorship and your sign-off intact. Because `contrib` follows `develop`, you are working against current code rather than the last promotion.

### Worked example

```bash
# fork Expressive-Tea/green-tea-plugins on GitHub, then
git clone git@github.com:<you>/green-tea-plugins.git
cd green-tea-plugins
git remote add upstream https://github.com/Expressive-Tea/green-tea-plugins.git
git fetch upstream

# branch from contrib, not from main
git checkout -b fix/sweep-interval upstream/contrib

# ... make the change, add a test ...

git commit -s -m "fix(rate-limit): clear the sweep timer on close"
git push origin fix/sweep-interval
```

`contrib` moves whenever development does. If your branch has been open a while, rebase onto the current `contrib` before pushing again.

## Developer Certificate of Origin (DCO)

We use the [Developer Certificate of Origin](./DCO) instead of a CLA. It is a per-commit affirmation that you have the right to submit your work under this project's license. No copyright assignment, no paperwork.

**Every commit must be signed off:**

```bash
git commit -s -m "feat(metrics): count upgrades separately"
```

That appends `Signed-off-by: Your Name <your.email@example.com>`, and the name and email must match your real `git config`. Commits without it are rejected by CI.

Forgot on a range you already wrote?

```bash
git rebase --signoff <base>
```

Or on the commit you just made: `git commit --amend -s`, then `git push --force-with-lease`.

## Local setup

Node 22 or newer, which is what every package's `engines` requires and what CI runs.

```bash
npm install
```

That points `core.hooksPath` at `.githooks/`, which installs a pre-commit gate: it formats and lint-fixes your staged sources, then refuses the commit if `lint` or `complexity:check` fails. It exists so CI tells you nothing you could not have heard locally. Confirm it took:

```bash
git config core.hooksPath   # should print .githooks
```

If it prints nothing, run `git config core.hooksPath .githooks` yourself.

**There is no build step.** These packages publish to JSR, which transpiles the TypeScript and generates the declarations, so what you edit in `src/` is what ships. `deno publish --dry-run` is the closest thing to a build, and CI runs it.

## Before you open a pull request

Run what CI runs:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run complexity:check
npm test               # Node: every package's contract tests plus the workspace checks
npm run test:deno      # packages whose engines declare deno
npm run test:bun       # packages whose engines declare bun
npm run test:edge      # packages whose engines declare workerd
deno publish --dry-run # the actual publish path, including the slow-types check
```

You are not expected to install every runtime to fix a typo. You are expected to run the one your change touches, and to say in the pull request which ones you ran.

## What a plugin has to do

The full list is in [`AGENTS.md`](./AGENTS.md), and `test/workspace.test.ts` enforces most of it so you will hear about a miss before a reviewer has to mention it. The parts that catch people out:

- **A plugin imports core as types only.** `import type { Plugin } from '@green-tea/core'` — never a value import. A type import leaves nothing behind when it compiles, which is what keeps a plugin from dragging a second copy of the framework into someone's application.
- **Runtimes are declared twice and the two must agree:** as `engines` keys, and as the Runtimes table in the package README, which lists all four with a reason beside every one that is not supported. Nobody should have to open an issue to find out where a plugin runs.
- **Errors carry the `Symbol.for('green-tea.http-error')` brand** rather than extending `HttpError`. A lint rule and the workspace test enforce it.
- **A breaking change goes under `### Breaking`**, first in that package's CHANGELOG.
- **Relative imports carry the `.ts` extension.** Deno and JSR require it.

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/), scoped to the package where that helps: `fix(jwt):`, `feat(metrics):`, `docs:`. Focus the message on the *why*. Do not add AI co-authoring attribution.

## Working with AI assistance

Use one if it helps. There is no permission to ask for and nothing to declare.

What we do ask is that you read what it hands you before it becomes a pull request. Every line that lands here is reviewed by a person, by hand, and usually that person is one person. A diff its own author has not read moves that work onto them, and turns review into proofreading — which is the thing review is worst at.

So go through the diff the way you would go through a stranger's, because that is what it is. If you cannot say why a line is there, it is not ready to send.

**What assistants tend to get wrong in this repository in particular:**

- They turn `import type` into a value import, which is the one thing a plugin must never do to core.
- They add a build. There isn't one, and `package.json` deliberately carries no `main`, `exports` or `files`.
- They write for Node and assume the rest follows. `npm test` does not cover Deno, Bun or workerd.
- They update `engines` without the README table, or the table without `engines`.

**Where you are unsure, say so** — not as a disclosure, as a pointer. "I am not confident about the Deno path here" tells a reviewer where to spend their attention, and that is worth more than a pull request that merely looks clean.

None of this changes the sign-off. `Signed-off-by` says you have the right to submit the work under this project's license, and that stays true however the text was produced.

If your assistant reads repository instructions, [`AGENTS.md`](./AGENTS.md) has the conventions.

## Proposing a new plugin

Open an issue before writing it. The useful question is not whether the code is good — it is whether the thing belongs in the official set at all, and that is cheaper to answer in a paragraph than in a pull request you have already written.

A plugin that depends on a service, a vendor or a protocol we cannot test is usually better as your own package. Nothing stops you publishing `@you/green-tea-whatever` to JSR or npm, and that is a first-class outcome rather than a consolation.

## Reporting issues

Open an issue with a minimal reproduction: which plugin and version, the runtime and version, and the smallest app that shows the problem.

**Except for security.** If what you found is exploitable, do not open an issue — an issue is world-readable the moment you press the button. See [`SECURITY.md`](./SECURITY.md).

## Code of conduct

By taking part here you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md), which is the Contributor Covenant 2.1. Reports go to compliance@expressive-tea.io.
