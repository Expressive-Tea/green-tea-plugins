---
name: Plugin proposal
about: Suggest something for the official set — before writing it
labels: enhancement
---

## What it does

<!-- One paragraph. What a user gets that they do not have today. -->

## Why it belongs in the official set

<!--
The honest question is not whether the code would be good. It is whether this
belongs here rather than as your own package.

A plugin that depends on a service, a vendor or a protocol we cannot test is
usually better as `@you/green-tea-whatever`, published to JSR or npm. That is a
first-class outcome, not a consolation — say so if you already plan it that way
and only want a sanity check.
-->

## Runtimes it could support

<!--
Node, Deno, Bun, workerd — and which it cannot, with the reason. A plugin that
needs a filesystem cannot serve workerd, for instance, and knowing that early
changes the design rather than the documentation.
-->

## Shape

```ts
// The call as a user would write it.
```
