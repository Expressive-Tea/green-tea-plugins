# Changelog

## [Unreleased]

## [26.11.0-rc.2] - 2026-11-23

### Changed

- **Versions track core.** This release is 26.11.0-rc.2, the core it is tested against.
- **Core is a range, `^26.11.0-rc.2`, not an exact `26.9.0-beta.2`.** JSR consumers resolve the
  `@green-tea/core` import in `deno.json`, and the exact pin gave an application on a newer core a
  second, older copy whose types `tsc` could pick up. The range starts at the core the tests run
  against (26.11.0-rc.2, which fixes nine security advisories reported against rc.1) and stops at
  the next year, the only core release that may break.

## [26.9.0-beta.0] - 2026-09-23

### Added

- `rateLimit({ rules, store?, keyOf?, provides? })`: publishes a `RateLimiter` under `provides`
  (default `rateLimit`). Exceeding a rule throws `TooManyRequests`, a branded 429 carrying
  `Retry-After`. The default `MemoryStore` sweeps expired windows on an interval and is released by
  the plugin's `onShutdown`.

[26.11.0-rc.2]: https://jsr.io/@green-tea/rate-limit@26.11.0-rc.2
[26.9.0-beta.0]: https://jsr.io/@green-tea/rate-limit@26.9.0-beta.0
