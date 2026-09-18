import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createApp } from '@green-tea/core';
import { exportJWK, generateKeyPair, generateSecret } from 'jose';

import { probeModule } from '../../../test/helpers.ts';
import { importJWKKey, jwt, Signer, type JwtRegistry } from '../src/index.ts';

// One key file for the whole file, written once. A promise rather than a `before` hook: only flat
// `test()` is relied on, because this file runs unchanged under Node, Deno and Bun.
const keyFile = (async () => {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  const path = join(await mkdtemp(join(tmpdir(), 'green-tea-jwt-')), 'access.json');
  await writeFile(path, JSON.stringify({ ...(await exportJWK(privateKey)), alg: 'ES256', kid: 'test' }));
  return path;
})();

// Generic in the body: `Response.json()` is typed `Promise<unknown>`, so a caller that reaches into
// the payload has to say what it expects. The default keeps the deepEqual callers untouched.
const get = async <T = unknown>(
  app: { fetch(request: Request): Promise<Response> },
  path: string,
): Promise<{ status: number; body: T }> => {
  const response = await app.fetch(new Request(`http://plugin.test${path}`));
  return { status: response.status, body: (await response.json()) as T };
};

test('a handler signs and verifies through the published registry', async () => {
  const app = createApp({
    modules: [
      probeModule('jwt', async (registry: JwtRegistry) => {
        const signer = registry.get('access');
        return (await signer.verify<{ sub: string }>(await signer.sign({ sub: '42' }))).sub;
      }),
    ],
    plugins: [jwt({ keys: { access: { path: await keyFile } } })],
  });

  assert.deepEqual(await get(app, '/jwt/probe'), { status: 200, body: { value: '42' } });
});

test('publicJwk serves the public half only', async () => {
  const app = createApp({
    modules: [probeModule('jwt', (registry: JwtRegistry) => registry.publicJwk('access'))],
    plugins: [jwt({ keys: { access: { path: await keyFile } } })],
  });

  const { body } = await get<{ value: Record<string, unknown> }>(app, '/jwt/probe');

  assert.equal('d' in body.value, false);
  assert.equal(body.value.use, 'sig');
  assert.deepEqual(body.value.key_ops, ['verify']);
});

// Convention rule 4: the promise the plugin makes is that a bad key is a startup failure.
test('a key file that does not exist fails app.boot(), naming the provider', async () => {
  const app = createApp({
    modules: [probeModule('jwt', () => null)],
    plugins: [jwt({ keys: { access: { path: join(tmpdir(), 'green-tea-jwt-missing', 'nope.json') } } })],
  });

  await assert.rejects(app.boot(), /provider 'jwt' failed/);
});

test('a key file that is not a JWK fails app.boot() too', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'green-tea-jwt-')), 'broken.json');
  await writeFile(path, 'not json');
  const app = createApp({ modules: [probeModule('jwt', () => null)], plugins: [jwt({ keys: { access: { path } } })] });

  await assert.rejects(app.boot(), /provider 'jwt' failed/);
});

// Convention rule 2, checked where it bites: two instances in one app.
test('two instances with different provides both answer, without colliding', async () => {
  const path = await keyFile;
  const app = createApp({
    modules: [
      probeModule('userJwt', (registry: JwtRegistry) => registry.names()),
      probeModule('serviceJwt', (registry: JwtRegistry) => registry.names()),
    ],
    plugins: [
      jwt({ provides: 'userJwt', keys: { user: { path } } }),
      jwt({ provides: 'serviceJwt', keys: { service: { path } } }),
    ],
  });

  assert.deepEqual(await get(app, '/userJwt/probe'), { status: 200, body: { value: ['user'] } });
  assert.deepEqual(await get(app, '/serviceJwt/probe'), { status: 200, body: { value: ['service'] } });
});

test('the plugin is named after what it provides', () => {
  assert.equal(jwt({ keys: {} }).name, 'jwt');
  assert.equal(jwt({ provides: 'serviceJwt', keys: {} }).name, 'serviceJwt');
});

// One algorithm is not coverage. A signer that verified with the key it signed with passed every
// symmetric test and threw `CryptoKey instances must be of type "public"` on every asymmetric one —
// which is all of ES*, RS*, PS* and EdDSA, and in practice every key anyone signs a session with.
// jose 5 accepted a private key here and derived the public half itself; jose 6 does not, so the
// defect only appears on the upgrade. Each family is listed so the next one to break says which.
for (const [alg, kind] of [
  ['EdDSA', 'asymmetric'],
  ['ES256', 'asymmetric'],
  ['RS256', 'asymmetric'],
  ['HS256', 'symmetric'],
] as const) {
  test(`round-trips a token signed with ${alg} (${kind})`, async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'green-tea-jwt-alg-')), `${alg}.json`);

    if (kind === 'symmetric') {
      await writeFile(
        path,
        JSON.stringify({ ...(await exportJWK(await generateSecret(alg, { extractable: true }))), alg }),
      );
    } else {
      const { privateKey } = await generateKeyPair(alg, { extractable: true });
      await writeFile(path, JSON.stringify({ ...(await exportJWK(privateKey)), alg, kid: alg }));
    }

    const signer = new Signer(await importJWKKey(path));

    assert.equal((await signer.verify<{ sub: string }>(await signer.sign({ sub: 'u1' }))).sub, 'u1');
  });
}
