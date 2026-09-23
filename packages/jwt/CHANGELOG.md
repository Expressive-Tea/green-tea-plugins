# Changelog

## [26.9.0-beta.0] - 2026-09-23

### Added

- `jwt({ keys, provides? })`: loads each JWK file while providers boot and publishes a `JwtRegistry`
  under `provides` (default `jwt`). `Signer` signs with `iat` and a random `jti`, and verifies issuer
  and audience. `JwtRegistry.publicJwk(name)` returns a key's public half for a JWKS endpoint.

[26.9.0-beta.0]: https://jsr.io/@green-tea/jwt@26.9.0-beta.0
