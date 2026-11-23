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

- `jwt({ keys, provides? })`: loads each JWK file while providers boot and publishes a `JwtRegistry`
  under `provides` (default `jwt`). `Signer` signs with `iat` and a random `jti`, and verifies issuer
  and audience. `JwtRegistry.publicJwk(name)` returns a key's public half for a JWKS endpoint.

[26.11.0-rc.2]: https://jsr.io/@green-tea/jwt@26.11.0-rc.2
[26.9.0-beta.0]: https://jsr.io/@green-tea/jwt@26.9.0-beta.0
