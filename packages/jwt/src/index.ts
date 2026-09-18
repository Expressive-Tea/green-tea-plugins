import type { Plugin } from '@green-tea/core';
import type { JWK } from 'jose';

import { importJWKKey, readPublicJWK } from './keys.ts';
import { Signer } from './signer.ts';
import type { JwtKeyConfig, JwtOptions } from './types.ts';

export { Signer } from './signer.ts';
export { importJWKKey, readPublicJWK } from './keys.ts';
export type { ImportedJWK, JwtKeyConfig, JwtOptions, JwtSettings, KeyMaterial } from './types.ts';

/** The value published into the graph: every configured signer, by name. */
export class JwtRegistry<Name extends string = string> {
  constructor(
    private readonly signers: Map<Name, Signer>,
    private readonly paths: Map<Name, string>,
  ) {}

  get(name: Name): Signer {
    const signer = this.signers.get(name);
    // Reachable only through a typo in a key name — the configured set is fixed at boot.
    if (!signer) throw new Error(`Unknown JWT signer "${name}". Configured: ${[...this.signers.keys()].join(', ')}`);
    return signer;
  }

  names(): Name[] {
    return [...this.signers.keys()];
  }

  /** The public half of a key, for serving at a JWKS endpoint. */
  async publicJwk(name: Name): Promise<JWK> {
    const path = this.paths.get(name);
    if (!path) throw new Error(`Unknown JWT signer "${name}"`);
    return await readPublicJWK(path);
  }
}

async function loadRegistry<Name extends string>(entries: Array<[Name, JwtKeyConfig]>): Promise<JwtRegistry<Name>> {
  const signers = new Map<Name, Signer>();
  const paths = new Map<Name, string>();

  for (const [name, config] of entries) {
    signers.set(name, new Signer(await importJWKKey(config.path), config.settings));
    paths.set(name, config.path);
  }

  return new JwtRegistry(signers, paths);
}

/**
 * Loads signing keys while providers boot and publishes them as one graph node.
 *
 * Keys are read once, in the provider's `run`, so a missing or malformed key fails `app.listen()` or
 * `app.boot()` instead of turning the first sign-in of the day into a 500. Nothing loads lazily and
 * nothing is cached in the module registry. A key read once holds nothing open, so there is no
 * `onShutdown` (convention rule 7).
 *
 * @example
 * const app = createApp({
 *   modules: [AuthModule],
 *   plugins: [jwt({ keys: { access: { path: '/etc/keys/access.json', settings: { maxAge: '15m' } } } })],
 * });
 *
 * @example <caption>In a handler.</caption>
 * ⁣@Post('/signin')
 * async signIn(@needs('jwt') jwt: JwtRegistry) {
 *   return { token: await jwt.get('access').sign({ sub: user.id }) };
 * }
 */
export function jwt<Name extends string>(options: JwtOptions<Name>): Plugin {
  const provides = options.provides ?? 'jwt';
  const entries = Object.entries(options.keys) as Array<[Name, JwtKeyConfig]>;

  return {
    // Rule 2: plugin name, node name and provided token are one string.
    name: provides,
    mount({ scope }) {
      scope.add({
        kind: 'provider',
        name: provides,
        needs: [],
        provides: [provides],
        run: async () => ({ [provides]: await loadRegistry(entries) }),
      });
    },
  };
}
