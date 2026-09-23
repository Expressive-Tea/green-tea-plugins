> **Base branch:** on GitHub this must target `contrib`, not `main`. You can change it above before you submit — and [here is why](https://github.com/Expressive-Tea/green-tea-plugins/blob/main/CONTRIBUTING.md#where-to-send-your-changes). Delete this line once the base is right.

## What this changes

<!-- A sentence or two, on the why rather than the what. -->

Closes #

## Which runtimes you ran

<!-- Not all four are expected for a typo. Say which you ran rather than leaving it to be guessed. -->

- [ ] `npm test` (Node)
- [ ] `npm run test:deno`
- [ ] `npm run test:bun`
- [ ] `npm run test:edge`

## Checklist

- [ ] The base branch above is `contrib`
- [ ] Commits are signed off (`git commit -s`)
- [ ] `lint`, `format:check`, `typecheck`, `complexity:check` and `deno publish --dry-run` pass locally
- [ ] New behaviour has a test
- [ ] Core is still imported as `import type` only — never a value import
- [ ] If `engines` changed, the package README's Runtimes table changed with it
- [ ] A breaking change is under `### Breaking`, first in that package's CHANGELOG
