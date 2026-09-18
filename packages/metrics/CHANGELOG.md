# Changelog

## [Unreleased]

### Added

- `metrics({ provides? })`: subscribes to the lifecycle stream and publishes a `Metrics` with
  `render()`. Counts `request:end` as requests and `request:failed` separately, labelled on the
  bounded `route` rather than on the caller-controlled `name`. `prometheus` is a `TransformerFn` for
  serving `render()` from a route the application owns. Closes green-tea#68.
