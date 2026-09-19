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

Signing belongs in the handler — it is the response to that one request:

```ts
@Post('/signin')
async signIn(@needs('jwt') jwt: JwtRegistry) {
  return { token: await jwt.get('access').sign({ sub: user.id }) };
}
```

Verifying does not. It is a precondition shared by every protected route, and its result is what
those routes are actually asking for, so it belongs in a `@Step`:

```ts
@Step({ provides: 'user', needs: ['jwt', 'req'] })
class Authenticate {
  async run(ctx) {
    const header = ctx.req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) throw new Unauthorized('missing bearer token');

    // verify() throws on a bad signature, a wrong issuer or an expired token, which cuts the
    // request before the handler — the handler only ever sees a token that was good.
    return { user: await ctx.jwt.get('access').verify(header.slice(7)) };
  }
}

@Get('/me')
me(@needs('user') user: Claims) {
  return user;
}
```

The handler asks for `user`, never for `jwt`, and green-tea runs `Authenticate` only for the routes
that do — the route table says which ones, rather than a matcher on a middleware chain.

Keys are read once, while providers boot. A missing or malformed key therefore fails `app.listen()` —
or `await app.boot()` on Deno and Bun — instead of the first sign-in of the day. Call `app.boot()`
before `Deno.serve` or `Bun.serve`; without it, the failure surfaces on every request instead.

Two instances need two graph names: `jwt({ provides: 'serviceJwt', keys })` publishes under
`serviceJwt`, and the plugin takes that name too.
