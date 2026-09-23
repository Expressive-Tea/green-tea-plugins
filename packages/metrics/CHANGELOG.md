# Changelog

## [26.9.0-beta.0] - 2026-09-23

### Added

- `metrics({ provides? })`: subscribes to the lifecycle stream and publishes a `Metrics` with
  `render()`. Counts `request:end` as requests and `request:failed` separately, labelled on the
  bounded `route` rather than on the caller-controlled `name`. `prometheus` is a `TransformerFn` for
  serving `render()` from a route the application owns. Closes green-tea#68.

[26.9.0-beta.0]: https://jsr.io/@green-tea/metrics@26.9.0-beta.0
