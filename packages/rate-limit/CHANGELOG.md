# Changelog

## [26.9.0-beta.0] - 2026-09-23

### Added

- `rateLimit({ rules, store?, keyOf?, provides? })`: publishes a `RateLimiter` under `provides`
  (default `rateLimit`). Exceeding a rule throws `TooManyRequests`, a branded 429 carrying
  `Retry-After`. The default `MemoryStore` sweeps expired windows on an interval and is released by
  the plugin's `onShutdown`.

[26.9.0-beta.0]: https://jsr.io/@green-tea/rate-limit@26.9.0-beta.0
