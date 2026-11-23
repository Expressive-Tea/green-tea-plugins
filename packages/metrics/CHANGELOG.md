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

- `metrics({ provides? })`: subscribes to the lifecycle stream and publishes a `Metrics` with
  `render()`. Counts `request:end` as requests and `request:failed` separately, labelled on the
  bounded `route` rather than on the caller-controlled `name`. `prometheus` is a `TransformerFn` for
  serving `render()` from a route the application owns. Closes green-tea#68.

[26.11.0-rc.2]: https://jsr.io/@green-tea/metrics@26.11.0-rc.2
[26.9.0-beta.0]: https://jsr.io/@green-tea/metrics@26.9.0-beta.0
