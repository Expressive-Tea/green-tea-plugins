import { readFile } from 'node:fs/promises';

import { importJWK, type JWK } from 'jose';

import type { ImportedJWK, KeyMaterial } from './types.ts';

/**
 * Reads a JWK from disk.
 *
 * `readFile` + `JSON.parse` rather than `await import(path)`: a dynamic import of a JSON file is cached
 * by the module registry for the life of the process, resolves differently under CommonJS and ESM, and
 * puts private key material into a module cache anything in the process can read.
 */
async function readJWK(filePath: string): Promise<JWK> {
  return JSON.parse(await readFile(filePath, 'utf8')) as JWK;
}

const PRIVATE_FIELDS = new Set(['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'key_ops']);

/** Whether the key is symmetric, in which case one secret both signs and verifies. */
function isSymmetric(jwk: JWK): boolean {
  return jwk.kty === 'oct' || 'k' in jwk;
}

/** The same JWK with every private field removed. */
function publicHalf(jwk: JWK): JWK {
  return Object.fromEntries(Object.entries(jwk).filter(([field]) => !PRIVATE_FIELDS.has(field))) as JWK;
}

/**
 * Reads and imports a JWK file, keeping the algorithm and key id it declares.
 *
 * Imports the key **twice** for an asymmetric pair: once as given, to sign with, and once with the
 * private fields stripped, to verify with. That is not redundancy — jose 6 rejects a private
 * `CryptoKey` in `jwtVerify` with `CryptoKey instances must be of type "public"`, where jose 5
 * accepted one and derived the public half itself. A signer that kept a single key therefore signed
 * fine and threw on every verification, for every asymmetric algorithm, which is all of ES*, RS*,
 * PS* and EdDSA.
 *
 * A symmetric key has no public half to derive, so it verifies with the same secret it signs with.
 */
export async function importJWKKey(filePath: string): Promise<ImportedJWK> {
  const jwk = await readJWK(filePath);
  const key: KeyMaterial = await importJWK(jwk, jwk.alg);
  const verifyKey: KeyMaterial = isSymmetric(jwk) ? key : await importJWK(publicHalf(jwk), jwk.alg);

  return { key, verifyKey, alg: jwk.alg, kid: jwk.kid };
}

/** Strips every private field, so the result is safe to serve at a JWKS endpoint. */
export async function readPublicJWK(filePath: string): Promise<JWK> {
  const jwk = await readJWK(filePath);

  if (isSymmetric(jwk)) {
    throw new Error('A JWKS endpoint requires an asymmetric key; a symmetric JWK has no public half to publish.');
  }

  return { ...publicHalf(jwk), use: 'sig', key_ops: ['verify'] };
}
