# Security Policy

## Reporting a vulnerability

Email **security@expressive-tea.io**. Please do not open a public issue for something exploitable — an issue is world-readable from the moment you press the button, and that is the one thing a security report cannot be.

Include whatever you have: which plugin, the version, the runtime, and the smallest app that shows it. A route and a request is usually enough. If you have a working exploit, send it; if you only have a suspicion, send that instead of sitting on it.

You can also report privately through GitHub's [security advisory form](https://github.com/Expressive-Tea/green-tea-plugins/security/advisories/new), which reaches the same people.

## What happens next

Acknowledgement within **5 working days**. A verdict on whether we agree it is a vulnerability within **15**. If we agree, you get the fix timeline and a heads-up before the advisory goes public. If we don't, you get the reasoning rather than silence.

Those numbers are deliberately slower than the 24 to 48 hours you will see quoted elsewhere. That figure describes vendors and coordinators — organizations with someone on rotation. This project is one person. A number that only holds in a good week is worse than an honest one.

Which is why there is an escape hatch, and you should use it. **If you have no acknowledgement after 10 working days**, write directly to diego.resendez@expressive-tea.io. If that is also met with silence, consider yourself released from any embargo and disclose as you see fit. You will not have done anything wrong: a project that goes quiet on a security report has spent whatever claim it had on your patience.

## Disclosure window

We ask for **90 days** from your report before public disclosure, or until the fix ships, whichever comes first. If the fix is out in a week, so is the advisory.

If a vulnerability is being actively exploited, the window is however long it takes us to ship, and we will say so rather than hold you to 90 days while users are being attacked.

We publish a GitHub advisory for anything that affects a released version, and credit you by the name you ask for. Say so if you would rather not be named.

There is no bug bounty and no money, which we would rather state here than leave you to find out after the work.

## Supported versions

Nothing has been released yet. When the first versions ship, only the most recent of each package receives fixes, and this section gets the real table.

## Scope

Each package is its own scope, and a report should name which one.

**In scope** — anything in a package's `src/` that ships:

- `@green-tea/jwt` — key loading, signature verification, claim validation, and anything that could make a bad token verify or a good one fail open.
- `@green-tea/rate-limit` — anything that lets a caller exceed a configured limit, or that lets one caller's traffic count against another's.
- `@green-tea/metrics` — anything that puts request data into the metrics output that should not be there, since that endpoint is often less protected than the app around it.

**Out of scope:** the test suites, dev-only tooling, and anything that requires an attacker to already control your application code. A misconfiguration is not a vulnerability — a plugin that does what you told it to, where what you told it was unsafe, belongs in an issue or the documentation rather than here. If you are unsure which one you have, send it and let us decide.

**Vulnerabilities in green-tea itself** go to the [core repository](https://github.com/Expressive-Tea/green-tea/security/advisories/new) instead. Same address, same people, but the advisory needs to live where the fix does.

Advisories in a dependency — `jose`, for instance — are worth telling us about, and we handle them as ordinary dependency updates rather than as vulnerabilities in these packages. If the advisory is exploitable *through* the way a plugin uses that dependency, that is a real report and we want it.
