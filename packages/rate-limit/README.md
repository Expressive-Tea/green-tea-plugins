# @green-tea/rate-limit

Publishes a per-request rate limiter into the graph. A handler opts in by asking for it and naming a
rule, so the limit is visible in the handler's signature rather than hidden in a middleware chain —
and green-tea runs the step only for the routes that depend on it.

## Runtimes

| Runtime | Supported | Why not |
|---|---|---|
| Node | ✅ | |
| Deno | ✅ | |
| Bun | ✅ | |
| workerd (edge) | ❌ | The default store counts per isolate, and an edge deployment has many, so a shared limit is not one. Supported once a store that shares state ships. |

## Usage

```ts
import { createApp } from '@green-tea/core';
import { rateLimit } from '@green-tea/rate-limit';

const app = createApp({
  modules: [AuthModule],
  plugins: [
    rateLimit({
      rules: {
        signin: { windowMs: 15 * 60 * 1000, max: 5, message: 'Too many attempts, try again later.' },
      },
    }),
  ],
});
```

Then spend the limit in a `@Step`, so the handler stays the thing it is about and the limit is a
dependency rather than a first line of code someone can forget to write:

```ts
@Step({ provides: 'signinAllowed', needs: ['rateLimit', 'req'] })
class ThrottleSignin {
  async run(ctx) {
    await ctx.rateLimit('signin');   // throws 429, so the handler never runs
    return { signinAllowed: true };
  }
}

@Post('/signin')
async signIn(@needs('signinAllowed') _allowed: true, @body() credentials: Credentials) {
  // ...
}
```

**The step has to provide something the handler asks for.** green-tea slices the graph per route and
runs only what the handler transitively needs, so a step providing a token nobody names is not in the
closure and never runs — the limit would silently not apply. That is why there is a
`signinAllowed` at all.

Better still, fold it into a step that already provides something real. A protected route usually
has one:

```ts
@Step({ provides: 'user', needs: ['jwt', 'rateLimit', 'req'] })
class Authenticate {
  async run(ctx) {
    await ctx.rateLimit('api');            // spend it before the expensive part
    return { user: await verifyBearer(ctx) };
  }
}
```

Calling `@needs('rateLimit')` straight from the handler and awaiting it there works too, and for a
single route it is less machinery. It just puts the limit somewhere a reader of the signature cannot
see it.

Exceeding a rule throws a `429` carrying `Retry-After`. The error is recognised by green-tea through
a registered symbol rather than by extending its `HttpError`, so this package never imports core at
runtime.

## The store

The default `MemoryStore` keeps fixed windows in this process and sweeps expired ones on an interval.
**One process, one set of counters:** two replicas each enforce the limit separately, so the real
ceiling is `max × replicas`. Implement `RateLimitStore` against Redis when you scale past one.

The sweep timer keeps the process alive on purpose, and the plugin's `onShutdown` clears it. A custom
store owns its own lifecycle; `close()` is called on it if it has one.
