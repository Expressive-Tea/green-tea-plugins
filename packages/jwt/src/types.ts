import type { CryptoKey, JWK } from 'jose';

/** What jose signs and verifies with: an imported asymmetric key, or the bytes of a symmetric one. */
export type KeyMaterial = CryptoKey | Uint8Array;

/** A JWK imported from disk, with the algorithm and key id it declares. */
export interface ImportedJWK {
  /** Signs. The private half of an asymmetric pair, or the secret of a symmetric key. */
  key: KeyMaterial;
  /**
   * Verifies. The public half for an asymmetric key, and the same secret again for a symmetric one.
   *
   * Kept separate because jose 6 refuses a private `CryptoKey` in `jwtVerify` — see `importJWKKey`.
   */
  verifyKey: KeyMaterial;
  alg?: string;
  kid?: string;
}

/** Claim defaults applied to every token a signer issues. */
export interface JwtSettings {
  audience?: string;
  issuer?: string;
  /** Anything jose's `setExpirationTime` accepts — `'15m'`, `'1h'`, a timestamp. */
  maxAge?: string;
}

export interface JwtKeyConfig {
  /** Path to a JWK file. Resolved as given, so pass an absolute path if unsure. */
  path: string;
  settings?: JwtSettings;
}

export interface JwtOptions<Name extends string = string> {
  /** One entry per signing key. The names become the keys of the published registry. */
  keys: Record<Name, JwtKeyConfig>;
  /** Graph name the registry is published under, and the plugin's name. Defaults to `jwt`. */
  provides?: string;
}

export type { JWK };
