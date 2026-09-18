import { SignJWT, errors, jwtVerify, type JWTPayload } from 'jose';

import type { ImportedJWK, JwtSettings, KeyMaterial } from './types.ts';

/** Signs and verifies with one key. */
export class Signer {
  private readonly key: KeyMaterial;
  /** Separate from `key`: jose 6 will not verify with a private one. See `importJWKKey`. */
  private readonly verifyKey: KeyMaterial;
  private readonly algorithm: string;
  private readonly kid?: string;

  constructor(
    jwk: ImportedJWK,
    private readonly settings: JwtSettings = {},
  ) {
    this.key = jwk.key;
    this.verifyKey = jwk.verifyKey;
    this.algorithm = jwk.alg ?? '';
    this.kid = jwk.kid;
  }

  /**
   * Issues a token, stamping `iat` and a random `jti`.
   *
   * The `jti` is what makes a token revocable — without it the only way to retire a token early is to
   * rotate the key and invalidate everyone's. `crypto.randomUUID` is the Web Crypto global, present on
   * every runtime this package declares, so nothing is imported from `node:crypto`.
   */
  async sign<T = JWTPayload>(payload: T & JWTPayload, overrides: JwtSettings = {}): Promise<string> {
    const { audience, issuer, maxAge } = { ...this.settings, ...overrides };
    const jwt = new SignJWT(payload).setProtectedHeader({ alg: this.algorithm, kid: this.kid });

    if (audience) jwt.setAudience(audience);
    if (issuer) jwt.setIssuer(issuer);
    jwt.setIssuedAt();
    jwt.setJti(crypto.randomUUID());
    if (maxAge) jwt.setExpirationTime(maxAge);

    return await jwt.sign(this.key);
  }

  /**
   * Verifies signature, issuer and audience.
   *
   * @param ignoreExpiration returns the payload of an expired token instead of throwing. Only for refresh
   *   flows that need the claims of a token they already know has expired — never for authenticating a
   *   request.
   */
  async verify<T = JWTPayload>(token: string, ignoreExpiration = false): Promise<T> {
    const { issuer, audience } = this.settings;

    try {
      const { payload } = await jwtVerify(token, this.verifyKey, { issuer, audience });
      return payload as T;
    } catch (error) {
      if (ignoreExpiration && error instanceof errors.JWTExpired) return error.payload as T;
      throw error;
    }
  }

  /** Signs with no managed claims — no audience, issuer, expiry or jti. */
  async signUnmanaged<T = JWTPayload>(payload: T & JWTPayload): Promise<string> {
    return await new SignJWT(payload).setProtectedHeader({ alg: this.algorithm, kid: this.kid }).sign(this.key);
  }
}
