# @green-tea/jwt

Loads JWT signing keys at boot and publishes them into the graph as one registry. A handler asks for
it with `@needs('jwt')` and signs or verifies by key name.

## Runtimes

| Runtime | Supported | Why not |
|---|---|---|
| Node | ✅ | |
| Deno | ✅ | |
| Bun | ✅ | |
| workerd (edge) | ❌ | Reads the signing key from a file path, and workerd has no filesystem. |

## Usage

```ts
import { createApp } from '@green-tea/core';
import { jwt } from '@green-tea/jwt';

const app = createApp({
  modules: [AuthModule],
  plugins: [
    jwt({
      keys: {
        access: { path: '/etc/keys/access.json', settings: { issuer: 'api', maxAge: '15m' } },
        refresh: { path: '/etc/keys/refresh.json', settings: { maxAge: '7d' } },
      },
    }),
  ],
});
```

```ts
@Post('/signin')
async signIn(@needs('jwt') jwt: JwtRegistry) {
  return { token: await jwt.get('access').sign({ sub: user.id }) };
}
```

Keys are read once, while providers boot. A missing or malformed key therefore fails `app.listen()` —
or `await app.boot()` on Deno and Bun — instead of the first sign-in of the day. Call `app.boot()`
before `Deno.serve` or `Bun.serve`; without it, the failure surfaces on every request instead.

Two instances need two graph names: `jwt({ provides: 'serviceJwt', keys })` publishes under
`serviceJwt`, and the plugin takes that name too.
