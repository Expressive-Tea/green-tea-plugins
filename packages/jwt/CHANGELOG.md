# Changelog

## [Unreleased]

### Added

- `jwt({ keys, provides? })`: loads each JWK file while providers boot and publishes a `JwtRegistry`
  under `provides` (default `jwt`). `Signer` signs with `iat` and a random `jti`, and verifies issuer
  and audience. `JwtRegistry.publicJwk(name)` returns a key's public half for a JWKS endpoint.
